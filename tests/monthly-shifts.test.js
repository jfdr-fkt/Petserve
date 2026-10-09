const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');
const { seedDatabase } = require('../src/db');
const { manilaNow } = require('../src/helpers');

async function setup(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'petserve-monthly-shifts-'));
  const dbFile = path.join(directory, 'db.json');
  const { server } = await createApp({ dbFile });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    assert.ok(
      path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep) &&
        path.basename(directory).startsWith('petserve-monthly-shifts-'),
    );
    fs.rmSync(directory, { recursive: true, force: true });
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
  const login = async (email) =>
    (await request('/api/auth/login', '', 'POST', { email, password: 'Petserve123!' })).cookie;
  const admin = await login('admin@petserve.test'),
    employee = await login('staff@petserve.test'),
    customer = await login('alex@example.test');
  const employeeId = (await request('/api/bootstrap', employee)).data.user.id;
  const future = new Date(`${manilaNow().date}T12:00:00Z`);
  future.setUTCMonth(future.getUTCMonth() + 1, 1);
  const month = future.toISOString().slice(0, 7);
  const days = new Date(
    Date.UTC(future.getUTCFullYear(), future.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const dates = Array.from(
    { length: days },
    (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`,
  );
  return { request, admin, employee, customer, employeeId, month, dates, dbFile };
}

test('one monthly save supports mixed working hours, rest days and leave; employees receive only their own schedule', async (t) => {
  const { request, admin, employee, customer, employeeId, month, dates, dbFile } = await setup(t);
  const changes = dates.map((date, index) => ({
    date,
    kind: index === 0 ? 'leave' : index % 7 === 0 ? 'rest' : 'work',
    start: index % 2 ? '09:00' : '11:00',
    end: index % 2 ? '17:00' : '19:00',
    notes:
      index === 0
        ? 'Personal leave'
        : index % 7 === 0
          ? 'Weekly rest day'
          : 'Assigned grooming hours',
  }));
  const body = { employeeId, month, changes };
  assert.equal((await request('/api/schedule/shifts/month', employee, 'POST', body)).status, 403);
  assert.equal((await request('/api/schedule/shifts/month', customer, 'POST', body)).status, 403);
  assert.equal((await request('/api/schedule/shifts/month', '', 'POST', body)).status, 401);
  const result = await request('/api/schedule/shifts/month', admin, 'POST', body);
  assert.equal(result.status, 200);
  assert.equal(result.data.updated, dates.length);
  const own = (await request('/api/bootstrap', employee)).data.shifts;
  assert.equal(own.length, dates.length);
  for (const shift of own) {
    assert.equal(shift.employeeId, employeeId);
    const expected = changes.find((item) => item.date === shift.date);
    assert.equal(shift.kind, expected.kind);
    assert.equal(shift.notes, expected.notes);
    assert.equal(shift.start, shift.kind === 'work' ? expected.start : '');
    assert.equal(shift.end, shift.kind === 'work' ? expected.end : '');
  }
  assert.deepEqual((await request('/api/bootstrap', customer)).data.shifts, []);
  assert.deepEqual(JSON.parse(fs.readFileSync(dbFile, 'utf8')).shifts, own);
  const reloaded = await seedDatabase(dbFile);
  assert.deepEqual(reloaded.shifts, own);
});

test('editing or clearing selected dates preserves other dates, employees and clinic availability', async (t) => {
  const { request, admin, employee, employeeId, month, dates } = await setup(t);
  const other = await request('/api/auth/register', '', 'POST', {
    name: 'Second employee',
    email: 'second@example.test',
    password: 'Petserve123!',
  });
  await request(`/api/users/${other.data.user.id}`, admin, 'PATCH', {
    role: 'staff',
    disabled: false,
  });
  const otherShift = {
    employeeId: other.data.user.id,
    date: dates[0],
    start: '10:00',
    end: '18:00',
    notes: 'Other employee',
  };
  assert.equal((await request('/api/schedule/shifts', admin, 'POST', otherShift)).status, 201);
  const hours = { kind: 'work', start: '09:00', end: '17:00', notes: 'Original' };
  await request('/api/schedule/shifts/month', admin, 'POST', {
    employeeId,
    month,
    changes: dates.map((date) => ({ date, ...hours })),
  });
  const before = (await request('/api/bootstrap', admin)).data;
  const changed = {
    employeeId,
    month,
    changes: [
      { date: dates[0], kind: 'rest', notes: 'Weekly rest' },
      { date: dates[1], kind: 'clear' },
    ],
  };
  assert.equal((await request('/api/schedule/shifts/month', admin, 'POST', changed)).status, 200);
  const after = (await request('/api/bootstrap', admin)).data;
  assert.deepEqual(after.schedule, before.schedule);
  assert.deepEqual(
    after.shifts.filter(
      (shift) => shift.employeeId !== employeeId || !dates.slice(0, 2).includes(shift.date),
    ),
    before.shifts.filter(
      (shift) => shift.employeeId !== employeeId || !dates.slice(0, 2).includes(shift.date),
    ),
  );
  const own = (await request('/api/bootstrap', employee)).data.shifts;
  assert.equal(own.length, dates.length - 1);
  assert.equal(own.find((shift) => shift.date === dates[0]).kind, 'rest');
  assert.equal(
    own.find((shift) => shift.date === dates[1]),
    undefined,
  );
  assert.equal(
    (await request(`/api/schedule/shifts/${own[0].id}`, employee, 'DELETE')).status,
    403,
  );
  assert.equal(
    (
      await request('/api/schedule/shifts', admin, 'POST', {
        employeeId,
        date: dates[0],
        start: '09:00',
        end: '17:00',
      })
    ).status,
    409,
    'Rest days cannot overlap working hours',
  );
});

test('invalid monthly changes fail atomically and cannot bypass date, account or time validation', async (t) => {
  const { request, admin, employeeId, month, dates, dbFile } = await setup(t);
  const work = { date: dates[0], kind: 'work', start: '09:00', end: '17:00', notes: 'Initial' };
  await request('/api/schedule/shifts/month', admin, 'POST', {
    employeeId,
    month,
    changes: [work],
  });
  const original = JSON.parse(fs.readFileSync(dbFile, 'utf8')).shifts;
  const yesterday = new Date(`${manilaNow().date}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const invalidBodies = [
    {
      employeeId,
      month,
      changes: [
        { ...work, notes: 'Must not persist' },
        { date: dates[1], kind: 'work', start: '17:00', end: '09:00' },
      ],
    },
    { employeeId, month, changes: [work, work] },
    { employeeId, month, changes: [{ ...work, kind: 'unknown' }] },
    { employeeId, month, changes: [{ ...work, start: '25:00' }] },
    { employeeId, month, changes: [{ ...work, date: `${month}-32` }] },
    { employeeId, month, changes: [{ ...work, date: yesterday.toISOString().slice(0, 10) }] },
    { employeeId, month: '2026-13', changes: [work] },
    { employeeId, month, changes: [] },
    { employeeId, month, changes: Array.from({ length: 32 }, () => work) },
    { employeeId, month, changes: [null] },
    { employeeId: 'missing', month, changes: [work] },
  ];
  for (const body of invalidBodies) {
    assert.equal((await request('/api/schedule/shifts/month', admin, 'POST', body)).status, 400);
    assert.deepEqual(JSON.parse(fs.readFileSync(dbFile, 'utf8')).shifts, original);
    assert.deepEqual((await request('/api/bootstrap', admin)).data.shifts, original);
  }
  const before = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  delete before.shifts[0].kind;
  before.version = 11;
  fs.writeFileSync(dbFile, JSON.stringify(before));
  assert.equal(
    (await seedDatabase(dbFile)).shifts[0].kind,
    'work',
    'Older assignments migrate as working shifts',
  );
});
