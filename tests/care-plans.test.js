const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');
const { manilaNow } = require('../src/helpers');

async function setup(t) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'petserve-care-plans-'));
  const dbFile = path.join(temporary, 'db.json');
  const { server } = await createApp({ dbFile });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    assert.ok(
      path.resolve(temporary).startsWith(path.resolve(os.tmpdir()) + path.sep) &&
        path.basename(temporary).startsWith('petserve-care-plans-'),
    );
    fs.rmSync(temporary, { recursive: true, force: true });
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
  const customer = await login('customer'),
    staff = await login('staff'),
    admin = await login('admin');
  const other = (
    await request('/api/auth/register', '', 'POST', {
      name: 'Other owner',
      email: 'other@example.test',
      password: 'Petserve123!',
    })
  ).cookie;
  const first = (await request('/api/bootstrap', customer)).data.pets[0];
  const add = async (name, cookie = customer) =>
    (
      await request('/api/pets', cookie, 'POST', {
        name,
        species: name === 'Puspu' || name === 'Oskar' ? 'Cat' : 'Dog',
      })
    ).data.pet;
  const pets = [
    first,
    await add('Puspu'),
    await add('Dolan'),
    await add('Oskar'),
    await add('Fifth pet'),
  ];
  const date = new Date(`${manilaNow().date}T12:00Z`);
  date.setUTCDate(date.getUTCDate() + ((6 - date.getUTCDay() + 7) % 7 || 7));
  const booking = {
    date: date.toISOString().slice(0, 10),
    time: '09:00',
    items: pets.map((pet) => ({ petId: pet.id, serviceIds: ['grooming'] })),
  };
  return {
    request,
    customer,
    staff,
    admin,
    other,
    pets,
    add,
    booking,
    dbFile,
    saved: () => JSON.parse(fs.readFileSync(dbFile, 'utf8')),
  };
}

function assertNoOverlap(appointments) {
  for (let a = 0; a < appointments.length; a++)
    for (let b = a + 1; b < appointments.length; b++) {
      const first = appointments[a],
        second = appointments[b];
      if (
        first.resource === second.resource ||
        first.petIds.some((id) => second.petIds.includes(id))
      )
        assert.notEqual(
          first.time,
          second.time,
          'A pet or care team is never assigned simultaneous services',
        );
      assert.ok(
        first.time <= '16:00' && second.time <= '16:00',
        'Care finishes within clinic hours',
      );
    }
}

test('five pets receive grooming in one atomic request with a realistic plan, confirmation and retained per-pet records', async (t) => {
  const { request, customer, staff, other, booking, pets, saved, dbFile } = await setup(t);
  const available = await request('/api/care-plans/availability', customer, 'POST', booking);
  assert.equal(available.status, 200);
  assert.equal(available.data.slots.find((slot) => slot.time === '09:00').available, true);
  assert.equal(available.data.slots.find((slot) => slot.time === '16:00').available, false);
  assert.equal(saved().appointments.length, 0, 'A preview creates no appointments');
  const created = await request('/api/care-plans', customer, 'POST', {
    ...booking,
    note: 'Keep their care together.',
  });
  assert.equal(created.status, 201);
  const { carePlanId, appointments } = created.data;
  assert.equal(appointments.length, 5);
  assert.deepEqual(appointments.map((item) => item.petId).sort(), pets.map((pet) => pet.id).sort());
  assert.ok(
    appointments.every(
      (item) =>
        item.carePlanId === carePlanId &&
        item.basePrice === 50000 &&
        item.arrivalTime === '09:00' &&
        item.status === 'pending',
    ),
  );
  assertNoOverlap(appointments);
  assert.equal(
    (await request(`/api/care-plans/${carePlanId}/status`, other, 'PATCH', { status: 'cancelled' }))
      .status,
    403,
  );
  assert.equal(
    (
      await request(`/api/care-plans/${carePlanId}/status`, customer, 'PATCH', {
        status: 'confirmed',
      })
    ).status,
    403,
  );
  assert.equal(
    (await request(`/api/care-plans/${carePlanId}/status`, staff, 'PATCH', { status: 'confirmed' }))
      .status,
    200,
  );
  assert.equal(
    (await request(`/api/care-plans/${carePlanId}/status`, staff, 'PATCH', { status: 'confirmed' }))
      .status,
    409,
  );
  assert.ok(saved().appointments.every((item) => item.status === 'confirmed'));
  const first = appointments[0];
  await request(`/api/appointments/${first.id}/status`, staff, 'PATCH', {
    status: 'completed',
    serviceNotes: 'Gentle grooming complete.',
  });
  assert.equal(
    (
      await request(`/api/appointments/${first.id}/payment`, staff, 'POST', {
        amount: 500,
        method: 'Cash',
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await request(`/api/care-plans/${carePlanId}/status`, customer, 'PATCH', {
        status: 'cancelled',
      })
    ).status,
    200,
  );
  assert.equal(saved().appointments.find((item) => item.id === first.id).status, 'completed');
  assert.equal(saved().appointments.filter((item) => item.status === 'cancelled').length, 4);
  assert.equal(saved().serviceRecords[0].petId, first.petId);
  assert.equal(saved().payments[0].appointmentId, first.id);
  const reloaded = await createApp({ dbFile });
  reloaded.server.close();
  assert.equal(saved().appointments[0].carePlanId, carePlanId);
});

test('different pets retain their own multiple services, prices, availability and history', async (t) => {
  const { request, customer, staff, booking, pets, saved } = await setup(t);
  const services = [
    ['grooming', 'deworming'],
    ['grooming', 'vaccination'],
    ['grooming', 'consultation'],
    ['grooming'],
  ];
  const data = {
    ...booking,
    items: services.map((serviceIds, index) => ({ petId: pets[index].id, serviceIds })),
  };
  const created = await request('/api/care-plans', customer, 'POST', data);
  assert.equal(created.status, 201);
  const appointments = created.data.appointments;
  assert.equal(appointments.length, 7);
  assert.equal(
    appointments.reduce((sum, item) => sum + item.basePrice, 0),
    305000,
  );
  services.forEach((ids, index) =>
    assert.deepEqual(
      appointments
        .filter((item) => item.petIds.includes(pets[index].id))
        .map((item) => item.serviceId)
        .sort(),
      [...ids].sort(),
    ),
  );
  assertNoOverlap(appointments);
  await request(`/api/care-plans/${created.data.carePlanId}/status`, staff, 'PATCH', {
    status: 'confirmed',
  });
  const deworming = appointments.find((item) => item.serviceId === 'deworming');
  await request(`/api/appointments/${deworming.id}/status`, staff, 'PATCH', {
    status: 'completed',
    serviceNotes: 'Milo’s care record only.',
  });
  assert.deepEqual(saved().serviceRecords[0].petIds, [pets[0].id]);
  const changed = await request('/api/services/grooming', staff, 'PATCH', {
    name: 'Updated grooming',
    description: 'Current menu',
    price: 999,
    active: true,
  });
  assert.equal(changed.status, 200);
  assert.equal(saved().appointments.find((item) => item.serviceId === 'grooming').basePrice, 50000);
});

test('invalid selections and changed availability reject whole requests without partial writes or confirmations', async (t) => {
  const { request, customer, staff, admin, other, pets, add, booking, saved } = await setup(t);
  const foreign = await add('Other pet', other);
  const invalid = [
    [],
    [{ petId: pets[0].id, serviceIds: [] }],
    [booking.items[0], booking.items[0]],
    [{ petId: pets[0].id, serviceIds: ['grooming', 'grooming'] }],
    [{ petId: pets[0].id, serviceIds: ['unknown'] }],
    [booking.items[0], { petId: foreign.id, serviceIds: ['grooming'] }],
  ];
  for (const items of invalid)
    assert.equal(
      (await request('/api/care-plans', customer, 'POST', { ...booking, items })).status,
      400,
    );
  assert.equal((await request('/api/care-plans', staff, 'POST', booking)).status, 403);
  assert.equal(saved().appointments.length, 0);
  const short = { ...booking, items: booking.items.slice(0, 2) };
  assert.equal(
    (await request('/api/care-plans/availability', customer, 'POST', short)).data.slots[0]
      .available,
    true,
  );
  const otherVisit = (
    await request('/api/appointments', other, 'POST', {
      petId: foreign.id,
      serviceId: 'grooming',
      date: booking.date,
      time: '10:00',
    })
  ).data.appointment;
  const created = await request('/api/care-plans', customer, 'POST', short);
  assert.equal(created.status, 201);
  await request(`/api/appointments/${otherVisit.id}/status`, staff, 'PATCH', {
    status: 'confirmed',
  });
  const endpoint = `/api/care-plans/${created.data.carePlanId}/status`;
  assert.equal((await request(endpoint, staff, 'PATCH', { status: 'confirmed' })).status, 409);
  assert.ok(
    saved()
      .appointments.filter((item) => item.carePlanId)
      .every((item) => item.status === 'pending'),
  );
  await request(`/api/appointments/${otherVisit.id}/status`, staff, 'PATCH', {
    status: 'cancelled',
  });
  assert.equal((await request(endpoint, staff, 'PATCH', { status: 'confirmed' })).status, 200);
  assert.equal(
    (await request('/api/care-plans', customer, 'POST', { ...booking, time: '16:00' })).status,
    409,
  );
  const persisted = saved().appointments.length;
  assert.equal((await request('/api/care-plans', customer, 'POST', short)).status, 409);
  assert.equal(saved().appointments.length, persisted);
});

test('larger consultation selections preserve shared consultation pricing and the six-pet group size', async (t) => {
  const { request, customer, pets, add, booking } = await setup(t);
  for (let index = 0; index < 3; index++) pets.push(await add(`Extra pet ${index}`));
  const created = await request('/api/care-plans', customer, 'POST', {
    ...booking,
    items: pets.map((pet) => ({ petId: pet.id, serviceIds: ['consultation'] })),
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.appointments.length, 2);
  assert.deepEqual(created.data.appointments.map((item) => item.petIds.length).sort(), [2, 6]);
  assert.equal(
    created.data.appointments.reduce((sum, item) => sum + item.basePrice, 0),
    280000,
  );
  assertNoOverlap(created.data.appointments);
});
