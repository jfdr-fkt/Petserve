const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');

async function setup(t, demoData = false) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'petserve-staff-'));
  const dbFile = path.join(directory, 'db.json');
  const servers = [];
  const start = async () => {
    const { server } = await createApp({ dbFile, demoData });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    servers.push(server);
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (route, cookie = '', method = 'GET', data, origin) => {
      const response = await fetch(base + route, {
        method,
        headers: {
          ...(cookie ? { Cookie: cookie } : {}),
          ...(data ? { 'Content-Type': 'application/json' } : {}),
          ...(origin ? { Origin: origin } : {}),
        },
        body: data ? JSON.stringify(data) : undefined,
      });
      return {
        status: response.status,
        data: await response.json(),
        cookie: response.headers.get('set-cookie')?.split(';')[0],
      };
    };
    const login = async (email) =>
      (await request('/api/auth/login', '', 'POST', { email, password: 'Petserve123!' })).cookie;
    return { request, login };
  };
  t.after(async () => {
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
    assert.ok(
      path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep) &&
        path.basename(directory).startsWith('petserve-staff-'),
    );
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return { ...(await start()), start, dbFile };
}

test('all signed-in roles can read the staff directory, while only administrators can change it', async (t) => {
  const { request, login } = await setup(t);
  const customer = await login('alex@example.test');
  const employee = await login('staff@petserve.test');
  const admin = await login('admin@petserve.test');
  assert.equal((await request('/api/staff')).status, 401);
  assert.deepEqual((await request('/api/bootstrap')).data.staffDirectory, []);
  const original = (await request('/api/staff', customer)).data.staff;
  assert.equal(original.length, 2);
  for (const entry of original)
    assert.deepEqual(Object.keys(entry).sort(), ['id', 'name', 'position']);
  for (const cookie of [customer, employee, admin]) {
    assert.deepEqual((await request('/api/staff', cookie)).data.staff, original);
    assert.deepEqual((await request('/api/bootstrap', cookie)).data.staffDirectory, original);
  }
  const member = { name: 'Dr. Carla Santos', position: 'Veterinarian' };
  for (const cookie of [customer, employee]) {
    assert.equal((await request('/api/staff', cookie, 'POST', member)).status, 403);
    assert.equal(
      (await request(`/api/staff/${original[0].id}`, cookie, 'PATCH', member)).status,
      403,
    );
    assert.equal(
      (await request(`/api/staff/${original[0].id}`, cookie, 'DELETE', { confirm: true })).status,
      403,
    );
  }
  assert.equal(
    (await request('/api/staff', admin, 'POST', member, 'https://other.test')).status,
    403,
  );
  assert.equal((await request('/api/staff', admin, 'POST', member)).status, 201);
  const added = (await request('/api/staff', customer)).data.staff.find(
    (entry) => entry.name === member.name,
  );
  const edit = {
    name: 'Carla Santos',
    position: 'Senior veterinarian',
    role: 'customer',
    disabled: true,
  };
  assert.equal((await request(`/api/staff/${added.id}`, admin, 'PATCH', edit)).status, 200);
  assert.deepEqual(
    (await request('/api/staff', employee)).data.staff.find((entry) => entry.id === added.id),
    { id: added.id, name: edit.name, position: edit.position },
  );
  assert.equal((await request('/api/bootstrap', admin)).data.users.length, 3);
  assert.equal((await request('/api/bootstrap', customer)).data.user.role, 'customer');
  assert.equal(
    (await request(`/api/staff/${added.id}`, admin, 'DELETE', { confirm: false })).status,
    400,
  );
  assert.equal(
    (await request(`/api/staff/${added.id}`, admin, 'DELETE', { confirm: true })).status,
    200,
  );
  assert.deepEqual((await request('/api/staff', customer)).data.staff, original);
});

test('directory validation and saved edits survive restart without restoring removed entries', async (t) => {
  const { request, login, start, dbFile } = await setup(t);
  const admin = await login('admin@petserve.test');
  for (const member of [
    { name: '', position: 'Groomer' },
    { name: 'A'.repeat(81), position: 'Groomer' },
    { name: 'Carla', position: {} },
    { name: 'Carla', position: ' ' },
  ])
    assert.equal((await request('/api/staff', admin, 'POST', member)).status, 400);
  const original = (await request('/api/staff', admin)).data.staff;
  assert.equal(
    (
      await request(`/api/staff/${original[0].id}`, admin, 'PATCH', {
        name: 'Maria Santos',
        position: 'Groomer',
      })
    ).status,
    200,
  );
  assert.equal(
    (await request(`/api/staff/${original[1].id}`, admin, 'DELETE', { confirm: true })).status,
    200,
  );
  const saved = (await request('/api/staff', admin)).data.staff;
  const restarted = await start();
  const customer = await restarted.login('alex@example.test');
  assert.deepEqual((await restarted.request('/api/staff', customer)).data.staff, saved);
  assert.equal(saved.length, 1);
  assert.equal(JSON.parse(fs.readFileSync(dbFile, 'utf8')).users.length, 3);
  const missing = '00000000-0000-0000-0000-000000000000';
  assert.equal(
    (await request(`/api/staff/${missing}`, admin, 'DELETE', { confirm: true })).status,
    404,
  );
});

test('startup updates older presentation copy while preserving custom notes, wallets, references, and saved states', async (t) => {
  const { dbFile, start } = await setup(t, true);
  const db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  const [visit, custom] = db.appointments;
  visit.note = 'Sample visit for the presentation.';
  custom.note = 'Owner requested a nail trim.';
  const record = db.serviceRecords.find((item) => item.appointmentId === visit.id);
  record.notes = 'Demo care record. Service completed for this sample visit.';
  const customRecord = db.serviceRecords.find((item) => item.appointmentId === custom.id);
  customRecord.notes = 'Return next month.';
  db.payments[0].reference = 'DEMO-CASH-1';
  db.payments[1].reference = 'CUSTOM-REFERENCE-123';
  const transfer = db.paymentRequests[0];
  transfer.reference = `DEMO-MAYA-REVIEW-${transfer.appointmentId.slice(0, 8)}`;
  transfer.wallet.name = 'Petopia Demo Account';
  db.wallets.Maya.name = 'Petopia Demo Account';
  db.wallets.Maya.instructions =
    'Demo only. Do not send money. Enter a sample reference to demonstrate staff verification.';
  db.wallets.GCash = {
    enabled: true,
    name: 'Shop owner',
    number: '09123456789',
    instructions: 'Use your visit number.',
  };
  fs.writeFileSync(dbFile, JSON.stringify(db));
  const restarted = await start();
  const cookie = await restarted.login('alex@example.test');
  const data = (await restarted.request('/api/bootstrap', cookie)).data;
  const refreshed = data.appointments.find((item) => item.id === visit.id);
  const unchanged = data.appointments.find((item) => item.id === custom.id);
  assert.equal(refreshed.note, '');
  assert.equal(refreshed.serviceRecord.notes, 'Service completed.');
  assert.doesNotMatch(refreshed.payment.reference, /demo/i);
  assert.equal(unchanged.note, custom.note);
  assert.equal(unchanged.serviceRecord.notes, customRecord.notes);
  assert.equal(unchanged.payment.reference, 'CUSTOM-REFERENCE-123');
  assert.equal(data.wallets.Maya.name, 'Petopia Pet Care Services');
  assert.equal(data.wallets.Maya.instructions, '');
  assert.deepEqual(data.wallets.GCash, db.wallets.GCash);
  const pending = data.appointments.find(
    (item) => item.id === transfer.appointmentId,
  ).paymentRequest;
  assert.equal(pending.status, 'pending');
  assert.doesNotMatch(pending.reference, /demo/i);
  assert.equal(pending.wallet.name, 'Petopia Pet Care Services');
  assert.equal(data.appointments.length, db.appointments.length);
});
