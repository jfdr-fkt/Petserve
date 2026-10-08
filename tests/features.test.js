const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');
const { manilaNow } = require('../src/helpers');

async function fixture(t) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'petserve-features-'));
  const dbFile = path.join(temporary, 'db.json');
  const app = await createApp({ dbFile });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const servers = [app.server];
  t.after(async () => {
    for (const server of servers) await new Promise((resolve) => server.close(resolve));
    assert.ok(
      path.resolve(temporary).startsWith(path.resolve(os.tmpdir()) + path.sep) &&
        path.basename(temporary).startsWith('petserve-features-'),
    );
    fs.rmSync(temporary, { recursive: true, force: true });
  });
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
  const customer = await login('customer'),
    staff = await login('staff'),
    admin = await login('admin');
  const other = (
    await request('/api/auth/register', '', 'POST', {
      name: 'Another owner',
      email: 'other@example.test',
      password: 'Petserve123!',
    })
  ).cookie;
  const pet = (await request('/api/bootstrap', customer)).data.pets[0];
  const second = (await request('/api/pets', customer, 'POST', { name: 'Luna', species: 'Cat' }))
    .data.pet;
  const date = new Date(`${manilaNow().date}T12:00Z`);
  date.setUTCDate(date.getUTCDate() + ((6 - date.getUTCDay() + 7) % 7 || 7));
  const booking = {
    petIds: [pet.id, second.id],
    serviceId: 'consultation',
    date: date.toISOString().slice(0, 10),
    time: '10:00',
  };
  return { request, customer, staff, admin, other, pet, second, booking, dbFile, servers };
}

test('group consultations keep all pets in one visit and protect every pet and the shared resource', async (t) => {
  const { request, customer, staff, other, pet, second, booking, dbFile } = await fixture(t);
  assert.equal((await request('/api/appointments', other, 'POST', booking)).status, 400);
  assert.equal(
    (await request('/api/appointments', customer, 'POST', { ...booking, petIds: [pet.id, pet.id] }))
      .status,
    400,
  );
  assert.equal(
    (await request('/api/appointments', customer, 'POST', { ...booking, serviceId: 'grooming' }))
      .status,
    400,
  );
  const added = await request('/api/appointments', customer, 'POST', booking);
  assert.equal(added.status, 201);
  const visit = added.data.appointment;
  assert.deepEqual(visit.petIds, booking.petIds);
  assert.equal(visit.petName, 'Milo, Luna');
  assert.equal(visit.basePrice, 70000);
  assert.equal(visit.unitPrice, 35000);
  assert.equal(
    (
      await request('/api/appointments', customer, 'POST', {
        ...booking,
        petIds: [second.id],
        serviceId: 'grooming',
      })
    ).status,
    409,
  );
  assert.equal((await request(`/api/pets/${second.id}`, customer, 'DELETE')).status, 409);
  assert.equal(
    (await request(`/api/appointments/${visit.id}/status`, staff, 'PATCH', { status: 'confirmed' }))
      .status,
    200,
  );
  const otherPet = (
    await request('/api/pets', other, 'POST', { name: 'Other pet', species: 'Dog' })
  ).data.pet;
  assert.equal(
    (await request('/api/appointments', other, 'POST', { ...booking, petIds: [otherPet.id] }))
      .status,
    409,
  );
  const moved = await request(`/api/appointments/${visit.id}/reschedule`, customer, 'PATCH', {
    date: booking.date,
    time: '11:00',
  });
  assert.equal(moved.status, 200);
  assert.deepEqual(moved.data.appointment.petIds, booking.petIds);
  await request(`/api/appointments/${visit.id}/status`, staff, 'PATCH', { status: 'confirmed' });
  await request(`/api/appointments/${visit.id}/status`, staff, 'PATCH', {
    status: 'completed',
    serviceNotes: 'Both pets examined together.',
  });
  const saved = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  assert.equal(saved.appointments.length, 1);
  assert.equal(saved.serviceRecords.length, 1);
  assert.deepEqual(saved.serviceRecords[0].petIds, booking.petIds);
  const loaded = await createApp({ dbFile });
  t.after(() => loaded.server.close());
  assert.deepEqual(
    JSON.parse(fs.readFileSync(dbFile, 'utf8')).appointments[0].petIds,
    booking.petIds,
  );
});

test('GCash and Maya submissions remain unpaid until staff confirms receipt, support rejection and avoid duplicate payments', async (t) => {
  const { request, customer, staff, other, booking, dbFile } = await fixture(t);
  const settings = {
    GCash: {
      enabled: true,
      name: 'Test clinic account',
      number: '09123456789',
      instructions: 'Use the visit number.',
    },
    Maya: { enabled: true, name: 'Test clinic account', number: '09987654321' },
  };
  assert.equal((await request('/api/payment-settings', customer, 'PATCH', settings)).status, 403);
  assert.equal((await request('/api/payment-settings', staff, 'PATCH', settings)).status, 200);
  const visit = (await request('/api/appointments', customer, 'POST', booking)).data.appointment;
  const endpoint = `/api/appointments/${visit.id}/online-payment`;
  const transfer = { amount: 700, method: 'GCash', reference: 'WALLET-123456' };
  assert.equal((await request(endpoint, customer, 'POST', transfer)).status, 409);
  await request(`/api/appointments/${visit.id}/status`, staff, 'PATCH', { status: 'confirmed' });
  await request(`/api/appointments/${visit.id}/status`, staff, 'PATCH', {
    status: 'completed',
    serviceNotes: 'Consultation done.',
  });
  assert.equal((await request(endpoint, other, 'POST', transfer)).status, 404);
  assert.equal(
    (await request(endpoint, customer, 'POST', { ...transfer, amount: -1 })).status,
    400,
  );
  const submitted = await request(endpoint, customer, 'POST', transfer);
  assert.equal(submitted.status, 201);
  assert.equal(submitted.data.appointment.payment, null);
  assert.equal(submitted.data.appointment.paymentRequest.status, 'pending');
  assert.equal((await request(endpoint, customer, 'POST', transfer)).status, 409);
  assert.equal(
    (
      await request(`/api/appointments/${visit.id}/payment`, staff, 'POST', {
        amount: 700,
        method: 'Cash',
      })
    ).status,
    409,
  );
  const review = `/api/payment-requests/${submitted.data.appointment.paymentRequest.id}`;
  assert.equal(
    (await request(review, customer, 'PATCH', { status: 'verified', received: true })).status,
    403,
  );
  assert.equal((await request(review, staff, 'PATCH', { status: 'verified' })).status, 400);
  assert.equal((await request(review, staff, 'PATCH', { status: 'rejected' })).status, 400);
  assert.equal(
    (
      await request(review, staff, 'PATCH', {
        status: 'rejected',
        note: 'Reference does not match. Please check it.',
      })
    ).status,
    200,
  );
  const resubmitted = await request(endpoint, customer, 'POST', {
    ...transfer,
    method: 'Maya',
    reference: 'MAYA-234567',
  });
  assert.equal(resubmitted.status, 201);
  const accepted = `/api/payment-requests/${resubmitted.data.appointment.paymentRequest.id}`;
  assert.equal(
    (await request(accepted, staff, 'PATCH', { status: 'verified', received: true })).status,
    200,
  );
  assert.equal(
    (await request(accepted, staff, 'PATCH', { status: 'verified', received: true })).status,
    409,
  );
  assert.equal((await request(endpoint, customer, 'POST', transfer)).status, 409);
  const customerData = (await request('/api/bootstrap', customer)).data;
  assert.equal(customerData.appointments[0].payment.method, 'Maya');
  assert.equal(customerData.appointments[0].payment.amount, 70000);
  const report = (await request('/api/report', staff)).data;
  assert.equal(report.amountCollected, 70000);
  assert.equal(report.paymentsRecorded, 1);
  const saved = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  assert.equal(saved.payments.length, 1);
  assert.equal(saved.paymentRequests.length, 2);
});

test('private chat delivers messages between owners and the care team, tracks unread counts and persists', async (t) => {
  const { request, customer, staff, admin, other, dbFile } = await fixture(t);
  const owner = (await request('/api/bootstrap', customer)).data.user;
  const endpoint = `/api/chat/${owner.id}`;
  assert.equal((await request(endpoint)).status, 401);
  assert.equal((await request(endpoint, other)).status, 403);
  assert.equal((await request(endpoint, other, 'POST', { text: 'Unauthorized' })).status, 403);
  assert.equal((await request(endpoint, customer, 'POST', { text: ' ' })).status, 400);
  assert.equal((await request(endpoint, customer, 'POST', { text: 'a'.repeat(2001) })).status, 400);
  const sent = await request(endpoint, customer, 'POST', {
    text: 'Can Milo and Luna come together?',
  });
  assert.equal(sent.status, 201);
  const staffInbox = (await request('/api/chat', staff)).data.threads.find(
    (c) => c.customerId === owner.id,
  );
  assert.equal(staffInbox.unread, 1);
  assert.equal(
    (await request('/api/chat', other)).data.threads.some((c) => c.customerId === owner.id),
    false,
  );
  assert.equal(
    (await request(endpoint, staff)).data.messages[0].text,
    'Can Milo and Luna come together?',
  );
  assert.equal(
    (await request('/api/chat', admin)).data.threads.find((c) => c.customerId === owner.id).unread,
    0,
  );
  assert.equal(
    (await request(endpoint, staff, 'POST', { text: 'Yes, choose both pets for a consultation.' }))
      .status,
    201,
  );
  assert.equal((await request('/api/chat', customer)).data.threads[0].unread, 1);
  const conversation = (await request(endpoint, customer)).data;
  assert.equal(conversation.messages.length, 2);
  assert.equal(conversation.messages[1].role, 'staff');
  assert.equal((await request('/api/chat', customer)).data.threads[0].unread, 0);
  assert.equal(JSON.parse(fs.readFileSync(dbFile, 'utf8')).chats[0].messages.length, 2);
});
