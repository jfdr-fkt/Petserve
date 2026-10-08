const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');
const { manilaNow } = require('../src/helpers');

async function fixture(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'petserve-api-'));
  const dbFile = path.join(temp, 'db.json');
  const { server } = await createApp({ dbFile });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    assert.ok(
      path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep) &&
        path.basename(temp).startsWith('petserve-api-'),
    );
    fs.rmSync(temp, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (route, cookie = '', method = 'GET', body) => {
    const response = await fetch(base + route, {
      method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get('set-cookie')?.split(';')[0],
    };
  };
  const login = async (role) =>
    (
      await request('/api/auth/login', '', 'POST', {
        email: role === 'customer' ? 'alex@example.test' : `${role}@petserve.test`,
        password: 'Petserve123!',
      })
    ).cookie;
  const date = new Date(`${manilaNow().date}T12:00Z`);
  date.setUTCDate(date.getUTCDate() + ((6 - date.getUTCDay() + 7) % 7 || 7));
  return { request, login, date: date.toISOString().slice(0, 10), dbFile };
}

test('role management, private records and disabled sessions are enforced', async (t) => {
  const { request, login } = await fixture(t);
  const customer = await login('customer'),
    staff = await login('staff'),
    admin = await login('admin');
  assert.ok(admin);
  const adminData = (await request('/api/bootstrap', admin)).data;
  const owner = adminData.users.find((u) => u.role === 'customer');
  assert.equal(
    (await request(`/api/users/${owner.id}`, staff, 'PATCH', { role: 'admin', disabled: false }))
      .status,
    403,
  );
  assert.equal((await request('/api/bootstrap', staff)).data.users.length, 0);
  assert.equal((await request('/api/report', customer)).status, 403);
  assert.equal(
    (
      await request(`/api/users/${adminData.user.id}`, admin, 'PATCH', {
        role: 'customer',
        disabled: false,
      })
    ).status,
    409,
  );
  const other = await request('/api/auth/register', '', 'POST', {
    name: 'Other owner',
    email: 'other@example.test',
    password: 'Petserve123!',
    role: 'admin',
  });
  assert.equal(other.data.user.role, 'customer');
  const petId = adminData.pets[0].id;
  assert.equal(
    (await request(`/api/pets/${petId}`, other.cookie, 'PATCH', { name: 'Stolen' })).status,
    403,
  );
  assert.equal((await request('/api/bootstrap', other.cookie)).data.healthLogs.length, 0);
  assert.equal(
    (await request(`/api/users/${owner.id}`, admin, 'PATCH', { role: 'customer', disabled: true }))
      .status,
    200,
  );
  assert.equal((await request('/api/bootstrap', customer)).data.user, null);
  assert.equal(
    (await request('/api/auth/login', '', 'POST', { email: owner.email, password: 'Petserve123!' }))
      .status,
    401,
  );
});

test('editable availability and durations protect overlapping resources and keep booking snapshots', async (t) => {
  const { request, login, date } = await fixture(t);
  const customer = await login('customer'),
    staff = await login('staff');
  const pet = (await request('/api/bootstrap', customer)).data.pets[0];
  assert.equal(
    (await request('/api/schedule', customer, 'PATCH', { weekdays: [0, 6], timeSlots: ['10:00'] }))
      .status,
    403,
  );
  assert.equal(
    (
      await request('/api/schedule', staff, 'PATCH', {
        weekdays: [0, 6],
        timeSlots: ['10:00', '10:30', '11:00', '13:00'],
      })
    ).status,
    200,
  );
  const services = (await request('/api/bootstrap', staff)).data.services;
  const grooming = services.find((s) => s.id === 'grooming');
  assert.equal(
    (
      await request('/api/services/grooming', staff, 'PATCH', {
        ...grooming,
        price: 600,
        duration: 90,
      })
    ).status,
    200,
  );
  const first = await request('/api/appointments', customer, 'POST', {
    petId: pet.id,
    serviceId: 'grooming',
    date,
    time: '10:00',
  });
  assert.equal(first.status, 201);
  assert.equal(
    (
      await request(
        `/api/appointments/${first.data.appointment.id}/online-payment`,
        customer,
        'POST',
        { amount: 600 },
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(`/api/appointments/${first.data.appointment.id}/status`, staff, 'PATCH', {
        status: 'confirmed',
      })
    ).status,
    200,
  );
  const slots = (await request(`/api/availability?date=${date}&serviceId=grooming`, customer)).data
    .slots;
  assert.equal(slots.find((s) => s.time === '10:30').available, false);
  const secondPet = (await request('/api/pets', customer, 'POST', { name: 'Luna', species: 'Cat' }))
    .data.pet;
  assert.equal(
    (
      await request('/api/appointments', customer, 'POST', {
        petId: secondPet.id,
        serviceId: 'grooming',
        date,
        time: '11:00',
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request('/api/appointments', customer, 'POST', {
        petId: secondPet.id,
        serviceId: 'consultation',
        date,
        time: '10:30',
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await request('/api/services/grooming', staff, 'PATCH', {
        ...grooming,
        price: 900,
        duration: 30,
      })
    ).status,
    200,
  );
  const saved = (await request('/api/bootstrap', customer)).data.appointments.find(
    (a) => a.id === first.data.appointment.id,
  );
  assert.equal(saved.basePrice, 60000);
  assert.equal(saved.duration, 90);
  assert.equal(
    (
      await request('/api/schedule/blocks', staff, 'POST', {
        date,
        time: '11:00',
        resource: 'groomer',
      })
    ).status,
    409,
  );
  assert.equal(
    (await request('/api/schedule', staff, 'PATCH', { weekdays: [0], timeSlots: ['10:00'] }))
      .status,
    409,
  );
  assert.equal((await request(`/api/pets/${pet.id}`, customer, 'DELETE')).status, 409);
  assert.equal(
    (
      await request(`/api/appointments/${saved.id}/reschedule`, customer, 'PATCH', {
        date,
        time: '13:00',
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request('/api/schedule/blocks', staff, 'POST', {
        date,
        time: '10:00',
        resource: 'groomer',
      })
    ).status,
    201,
  );
  assert.equal(
    (await request(`/api/availability?date=${date}&serviceId=grooming`, customer)).data.slots.find(
      (s) => s.time === '10:30',
    ).available,
    false,
  );
});

test('service records, payment receipts, filtered reports and pet editing survive persistence', async (t) => {
  const { request, login, date, dbFile } = await fixture(t);
  const customer = await login('customer'),
    staff = await login('staff'),
    admin = await login('admin');
  const pet = (await request('/api/bootstrap', customer)).data.pets[0];
  assert.equal(
    (
      await request(`/api/pets/${pet.id}`, customer, 'PATCH', {
        name: 'Milo updated',
        weight: 12.5,
        allergies: 'Sensitive skin',
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/api/pets/${pet.id}/health-logs`, customer, 'POST', {
        title: 'Bad date',
        type: 'vaccine',
        date: '2026-02-31',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`/api/pets/${pet.id}/health-logs`, customer, 'POST', {
        title: 'Owner note',
        type: 'medical',
        date: manilaNow().date,
        dueDate: date,
      })
    ).data.healthLog.source,
    'Owner provided',
  );
  const booked = (
    await request('/api/appointments', customer, 'POST', {
      petId: pet.id,
      serviceId: 'consultation',
      date,
      time: '13:00',
    })
  ).data.appointment;
  assert.equal(
    (
      await request(`/api/appointments/${booked.id}/status`, staff, 'PATCH', {
        status: 'confirmed',
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/api/appointments/${booked.id}/status`, staff, 'PATCH', {
        status: 'completed',
        serviceNotes: 'Consultation completed; follow-up discussed.',
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/api/appointments/${booked.id}/status`, staff, 'PATCH', {
        status: 'completed',
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(`/api/appointments/${booked.id}/payment`, staff, 'POST', {
        amount: 350.25,
        method: 'GCash',
        reference: 'TEST-123',
      })
    ).status,
    201,
  );
  const appointment = (await request('/api/bootstrap', customer)).data.appointments.find(
    (a) => a.id === booked.id,
  );
  assert.equal(appointment.serviceRecord.notes, 'Consultation completed; follow-up discussed.');
  assert.equal(appointment.payment.amount, 35025);
  assert.equal(appointment.payment.recordedBy, 'Clinic Staff');
  const report = (await request(`/api/report?from=${date}&to=${date}`, admin)).data;
  assert.equal(report.servicesCompleted, 1);
  assert.equal(report.amountCollected, 35025);
  assert.equal(report.outstanding, 0);
  assert.equal((await request('/api/report?from=bad', admin)).status, 400);
  assert.equal(
    (
      await request(`/api/appointments/${booked.id}/status`, customer, 'PATCH', {
        status: 'cancelled',
      })
    ).status,
    403,
  );
  const stored = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  assert.equal(stored.serviceRecords.length, 1);
  assert.equal(stored.payments.length, 1);
  assert.equal((await request(`/api/pets/${pet.id}`, customer, 'DELETE')).status, 200);
  assert.equal(
    (await request('/api/bootstrap', customer)).data.appointments[0].payment.reference,
    'TEST-123',
  );
});
