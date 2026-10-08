const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');

const image = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMioAAAAASUVORK5CYII=',
  'base64',
);
async function setup(t, demoData = false) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'petserve-settings-'));
  const dbFile = path.join(directory, 'db.json');
  const { server } = await createApp({ dbFile, demoData });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    assert.ok(
      path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep) &&
        path.basename(directory).startsWith('petserve-settings-'),
    );
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const request = async (route, cookie = '', method = 'GET', data) => {
    const response = await fetch(base + route, {
      method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(data ? { 'Content-Type': 'application/json' } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get('set-cookie')?.split(';')[0],
    };
  };
  const login = async (email = 'alex@example.test', password = 'Petserve123!') =>
    request('/api/auth/login', '', 'POST', { email, password });
  return {
    base,
    directory,
    dbFile,
    request,
    login,
    saved: () => JSON.parse(fs.readFileSync(dbFile, 'utf8')),
  };
}
test('profile photos validate content, survive saving, and password changes retain the current session while revoking other sessions', async (t) => {
  const { request, login, saved } = await setup(t);
  const first = (await login()).cookie,
    other = (await login()).cookie;
  assert.equal(
    (
      await request('/api/account', first, 'PATCH', {
        name: 'Alex',
        photoUrl: 'data:image/svg+xml;base64,PHN2Zz4=',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/api/account', first, 'PATCH', {
        name: 'Alex',
        photoUrl: 'data:image/png;base64,aHRtbA==',
      })
    ).status,
    400,
  );
  const photoUrl = `data:image/png;base64,${image.toString('base64')}`;
  assert.equal(
    (
      await request('/api/account', first, 'PATCH', {
        name: 'Alex with photo',
        phone: '09123456789',
        photoUrl,
      })
    ).status,
    200,
  );
  assert.equal((await request('/api/bootstrap', first)).data.user.photoUrl, photoUrl);
  assert.equal(
    (
      await request('/api/account/password', first, 'PATCH', {
        currentPassword: 'wrong',
        newPassword: 'Changed123!',
        confirmPassword: 'Changed123!',
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/api/account/password', first, 'PATCH', {
        currentPassword: 'Petserve123!',
        newPassword: 'Changed123!',
        confirmPassword: 'Different123!',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/api/account/password', first, 'PATCH', {
        currentPassword: 'Petserve123!',
        newPassword: 'Changed123!',
        confirmPassword: 'Changed123!',
      })
    ).status,
    200,
  );
  assert.equal((await request('/api/bootstrap', first)).data.user.name, 'Alex with photo');
  assert.equal((await request('/api/bootstrap', other)).data.user, null);
  assert.equal((await login()).status, 401);
  assert.equal((await login('alex@example.test', 'Changed123!')).status, 200);
  assert.ok(!JSON.stringify(saved()).includes('Changed123!'));
});
test('demo password recovery uses expiring one-use hashed links and revokes sessions after reset', async (t) => {
  const { request, login, saved } = await setup(t);
  const cookie = (await login()).cookie;
  const unknown = await request('/api/auth/forgot-password', '', 'POST', {
    email: 'missing@example.test',
  });
  assert.equal(unknown.status, 200);
  assert.equal(unknown.data.resetPath, undefined);
  const first = await request('/api/auth/forgot-password', '', 'POST', {
    email: 'alex@example.test',
  });
  assert.equal(first.status, 200);
  const oldToken = first.data.resetPath.split('/').at(-1);
  const originalTime = Date.now();
  t.mock.method(Date, 'now', () => originalTime + 21 * 60 * 1000);
  assert.equal(
    (
      await request('/api/auth/reset-password', '', 'POST', {
        token: oldToken,
        newPassword: 'Recovered123!',
        confirmPassword: 'Recovered123!',
      })
    ).status,
    400,
  );
  t.mock.restoreAll();
  const second = await request('/api/auth/forgot-password', '', 'POST', {
    email: 'alex@example.test',
  });
  const token = second.data.resetPath.split('/').at(-1);
  assert.ok(!JSON.stringify(saved()).includes(token));
  assert.equal(
    (
      await request('/api/auth/reset-password', '', 'POST', {
        token: oldToken,
        newPassword: 'Recovered123!',
        confirmPassword: 'Recovered123!',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/api/auth/reset-password', '', 'POST', {
        token,
        newPassword: 'short',
        confirmPassword: 'short',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/api/auth/reset-password', '', 'POST', {
        token,
        newPassword: 'Recovered123!',
        confirmPassword: 'Recovered123!',
      })
    ).status,
    200,
  );
  assert.equal((await request('/api/bootstrap', cookie)).data.user, null);
  assert.equal(
    (
      await request('/api/auth/reset-password', '', 'POST', {
        token,
        newPassword: 'Recovered456!',
        confirmPassword: 'Recovered456!',
      })
    ).status,
    400,
  );
  assert.equal((await login('alex@example.test', 'Recovered123!')).status, 200);
  assert.equal(
    saved().users.find((user) => user.email === 'alex@example.test').passwordReset,
    undefined,
  );
});
test('ordinary addresses use administrator-assisted recovery and never expose a reset link anonymously', async (t) => {
  const { request, login } = await setup(t);
  const registered = await request('/api/auth/register', '', 'POST', {
    name: 'Account owner',
    email: 'owner@gmail.com',
    password: 'Original123!',
  });
  const accountId = registered.data.user.id;
  const result = await request('/api/auth/forgot-password', '', 'POST', {
    email: 'owner@gmail.com',
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.resetPath, undefined);
  const staff = (await login('staff@petserve.test')).cookie;
  assert.equal(
    (await request(`/api/users/${accountId}/password-reset`, staff, 'POST', {})).status,
    403,
  );
  const admin = (await login('admin@petserve.test')).cookie;
  const generated = await request(`/api/users/${accountId}/password-reset`, admin, 'POST', {});
  assert.equal(generated.status, 200);
  const token = generated.data.resetPath.split('/').at(-1);
  assert.equal(
    (
      await request('/api/auth/reset-password', '', 'POST', {
        token,
        newPassword: 'Recovered123!',
        confirmPassword: 'Recovered123!',
      })
    ).status,
    200,
  );
  assert.equal((await login('owner@gmail.com', 'Recovered123!')).status, 200);
});
test('whole-conversation deletion requires owner or administrator confirmation and removes every attachment', async (t) => {
  const { request, login, base, directory, saved } = await setup(t);
  const customer = (await login()).cookie,
    staff = (await login('staff@petserve.test')).cookie;
  const customerId = (await request('/api/bootstrap', customer)).data.user.id;
  const other = (
    await request('/api/auth/register', '', 'POST', {
      name: 'Other',
      email: 'other@example.test',
      password: 'Petserve123!',
    })
  ).cookie;
  const route = `/api/chat/${customerId}`;
  await request(route, customer, 'POST', { text: 'An owner message' });
  await request(route, staff, 'POST', { text: 'A staff reply' });
  const upload = await fetch(base + route + '/media', {
    method: 'POST',
    headers: { Cookie: customer, 'Content-Type': 'image/png' },
    body: image,
  });
  assert.equal(upload.status, 201);
  const attachmentUrl = (await upload.json()).messages.at(-1).attachment.url;
  assert.equal((await request(route, other, 'DELETE', { confirm: true })).status, 403);
  assert.equal((await request(route, staff, 'DELETE', { confirm: true })).status, 403);
  assert.equal((await request(route, customer, 'DELETE', { confirm: false })).status, 400);
  assert.equal((await request(route, customer, 'DELETE', { confirm: true })).status, 200);
  assert.equal((await request(route, staff)).data.messages.length, 0);
  assert.equal((await fetch(base + attachmentUrl, { headers: { Cookie: customer } })).status, 404);
  assert.equal(fs.readdirSync(path.join(directory, 'uploads', 'chat')).length, 0);
  assert.equal(saved().chats.length, 0);
  await request(route, staff, 'POST', { text: 'Start again' });
  assert.equal((await request(route, customer)).data.messages.length, 1);
  const admin = (await login('admin@petserve.test')).cookie;
  assert.equal((await request(route, admin, 'DELETE', { confirm: true })).status, 200);
});
test('presentation payment examples include receipts and a working staff verification step without replacing saved records', async (t) => {
  const { request, login, saved, dbFile } = await setup(t, true);
  const customer = (await login()).cookie,
    staff = (await login('staff@petserve.test')).cookie;
  let data = (await request('/api/bootstrap', customer)).data;
  assert.equal(data.appointments.length, 5);
  assert.deepEqual(
    data.appointments
      .filter((visit) => visit.payment)
      .map((visit) => visit.payment.method)
      .sort(),
    ['Cash', 'GCash', 'Maya'],
  );
  assert.equal(data.appointments.filter((visit) => !visit.payment).length, 2);
  assert.ok(data.appointments.every((visit) => visit.demo && visit.serviceRecord));
  assert.ok(data.wallets.Maya.demo && /Do not send money/.test(data.wallets.Maya.instructions));
  const pending = data.appointments.find((visit) => visit.paymentRequest?.status === 'pending');
  assert.equal(
    (
      await request(`/api/payment-requests/${pending.paymentRequest.id}`, staff, 'PATCH', {
        status: 'verified',
        received: true,
      })
    ).status,
    200,
  );
  data = (await request('/api/bootstrap', customer)).data;
  assert.equal(data.appointments.filter((visit) => visit.payment).length, 4);
  const count = saved().appointments.length;
  const reloaded = await createApp({ dbFile, demoData: true });
  reloaded.server.close();
  assert.equal(saved().appointments.length, count);
  assert.equal(saved().payments.length, 4);
});
