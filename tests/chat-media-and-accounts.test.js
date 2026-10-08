const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');
const { manilaNow } = require('../src/helpers');

const password = 'Petserve123!';
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jmHkAAAAASUVORK5CYII=',
  'base64',
);
const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x80, 0x18, 0x53, 0x80, 0x67, 0x80]);

async function fixture(t) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'petserve-accounts-'));
  const dbFile = path.join(temporary, 'db.json');
  const servers = [];
  const launch = async () => {
    const { server } = await createApp({ dbFile });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    servers.push(server);
    return `http://127.0.0.1:${server.address().port}`;
  };
  let base = await launch();
  t.after(async () => {
    for (const server of servers) await new Promise((resolve) => server.close(resolve));
    assert.ok(
      path.resolve(temporary).startsWith(path.resolve(os.tmpdir()) + path.sep) &&
        path.basename(temporary).startsWith('petserve-accounts-'),
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
  const login = async (email) => request('/api/auth/login', '', 'POST', { email, password });
  const customer = await login('alex@example.test');
  const staff = await login('staff@petserve.test');
  const admin = await login('admin@petserve.test');
  const other = await request('/api/auth/register', '', 'POST', {
    name: 'Other owner',
    email: 'other@example.test',
    password,
  });
  const upload = async (
    route,
    cookie,
    mime = 'image/png',
    bytes = png,
    caption = '',
    extra = {},
  ) => {
    const response = await fetch(base + route, {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': mime,
        'X-Message-Caption': Buffer.from(caption).toString('base64'),
        ...extra,
      },
      body: bytes,
    });
    return { status: response.status, data: await response.json() };
  };
  const media = (route, cookie = '', headers = {}, method = 'GET') =>
    fetch(base + route, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...headers } });
  const saved = () => JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  return {
    request,
    login,
    upload,
    media,
    saved,
    dbFile,
    temporary,
    customer,
    staff,
    admin,
    other,
    restart: async () => {
      base = await launch();
    },
  };
}

test('chat attachments are private, seekable, validated, persisted and deleted by their author or administrator', async (t) => {
  const {
    request,
    upload,
    media,
    saved,
    temporary,
    customer,
    staff,
    admin,
    other,
    restart,
    login,
  } = await fixture(t);
  const route = `/api/chat/${customer.data.user.id}`;
  assert.equal((await upload(`${route}/media`, '', 'image/png')).status, 401);
  assert.equal((await upload(`${route}/media`, other.cookie)).status, 403);
  assert.equal((await upload(`${route}/media`, customer.cookie, 'image/svg+xml')).status, 415);
  assert.equal(
    (await upload(`${route}/media`, customer.cookie, 'image/png', Buffer.from('not an image')))
      .status,
    400,
  );
  assert.equal(
    (await upload(`${route}/media`, customer.cookie, 'image/png', png, 'x'.repeat(2001))).status,
    400,
  );
  assert.equal(
    (
      await upload(`${route}/media`, customer.cookie, 'image/png', png, '', {
        Origin: 'https://elsewhere.test',
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await upload(
        `${route}/media`,
        customer.cookie,
        'image/png',
        Buffer.alloc(25 * 1024 * 1024 + 1),
      )
    ).status,
    413,
  );
  const posts = await Promise.all([
    upload(`${route}/media`, customer.cookie, 'image/png', png, 'Milo’s photo 🐾'),
    upload(`${route}/media`, customer.cookie, 'video/webm', webm),
  ]);
  posts.forEach((result) => assert.equal(result.status, 201));
  assert.equal(saved().chats.length, 1, 'Concurrent first messages share one conversation');
  const messages = (await request(route, customer.cookie)).data.messages;
  assert.equal(messages.length, 2);
  const photo = messages.find((message) => message.attachment.mime === 'image/png');
  const video = messages.find((message) => message.attachment.mime === 'video/webm');
  assert.equal(photo.text, 'Milo’s photo 🐾');
  assert.ok(photo.canDelete);
  assert.equal(photo.senderId, undefined);
  assert.equal(photo.attachment.filename, undefined);
  assert.equal(
    (await request('/api/chat', staff.cookie)).data.threads.find(
      (thread) => thread.customerId === customer.data.user.id,
    ).unread,
    2,
  );
  assert.equal((await media(photo.attachment.url)).status, 401);
  assert.equal((await media(photo.attachment.url, other.cookie)).status, 403);
  const downloaded = await media(photo.attachment.url, staff.cookie);
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), png);
  const range = await media(video.attachment.url, customer.cookie, { Range: 'bytes=2-5' });
  assert.equal(range.status, 206);
  assert.equal(range.headers.get('content-range'), `bytes 2-5/${webm.length}`);
  assert.deepEqual(Buffer.from(await range.arrayBuffer()), webm.subarray(2, 6));
  assert.equal(
    (await media(video.attachment.url, customer.cookie, { Range: 'bytes=999-1000' })).status,
    416,
  );
  assert.equal(
    (await media(video.attachment.url, staff.cookie, {}, 'HEAD')).headers.get('content-length'),
    String(webm.length),
  );
  assert.equal(
    (await request(`${route}/messages/${photo.id}`, staff.cookie, 'DELETE')).status,
    403,
  );
  assert.equal(
    (await request(`${route}/messages/${photo.id}`, other.cookie, 'DELETE')).status,
    403,
  );
  const file = path.join(
    temporary,
    'uploads',
    'chat',
    saved().chats[0].messages.find((message) => message.id === photo.id).attachment.filename,
  );
  assert.ok(fs.existsSync(file));
  assert.equal(
    (await request(`${route}/messages/${photo.id}`, customer.cookie, 'DELETE')).status,
    200,
  );
  assert.equal(
    (await request(`${route}/messages/${photo.id}`, customer.cookie, 'DELETE')).status,
    200,
  );
  assert.ok(!fs.existsSync(file));
  assert.equal((await media(photo.attachment.url, staff.cookie)).status, 404);
  const tombstone = (await request(route, staff.cookie)).data.messages.find(
    (message) => message.id === photo.id,
  );
  assert.ok(tombstone.deletedAt);
  assert.equal(tombstone.attachment, null);
  assert.equal(tombstone.text, '');
  assert.equal(tombstone.canDelete, false);
  await request(route, staff.cookie, 'POST', { text: 'We received your video.' });
  const unreadBefore = (await request('/api/chat', customer.cookie)).data.threads[0].unread;
  assert.equal(unreadBefore, 1, 'Deleted messages do not shift read positions');
  await restart();
  const signedIn = await login('alex@example.test');
  assert.equal((await request(route, signedIn.cookie)).data.messages.length, 3);
  assert.deepEqual(
    Buffer.from(await (await media(video.attachment.url, signedIn.cookie)).arrayBuffer()),
    webm,
  );
  const signedInAdmin = await login('admin@petserve.test');
  assert.equal(
    (await request(`${route}/messages/${video.id}`, signedInAdmin.cookie, 'DELETE')).status,
    200,
  );
  assert.equal((await media(video.attachment.url, signedInAdmin.cookie)).status, 404);
});

test('customer deletion revokes all sessions, removes private content and cancels future care while retaining clinic records', async (t) => {
  const {
    request,
    login,
    upload,
    media,
    saved,
    temporary,
    customer,
    staff,
    admin,
    other,
    restart,
  } = await fixture(t);
  const accountId = customer.data.user.id;
  const route = `/api/chat/${accountId}`;
  const secondSession = await login('alex@example.test');
  await request('/api/account', customer.cookie, 'PATCH', {
    name: 'Alex Rivera',
    phone: '09123456789',
  });
  const pet = (await request('/api/bootstrap', customer.cookie)).data.pets[0];
  const date = new Date(`${manilaNow().date}T12:00Z`);
  date.setUTCDate(date.getUTCDate() + ((6 - date.getUTCDay() + 7) % 7 || 7));
  const booking = {
    petId: pet.id,
    serviceId: 'consultation',
    date: date.toISOString().slice(0, 10),
    time: '10:00',
  };
  const visit = (await request('/api/appointments', customer.cookie, 'POST', booking)).data
    .appointment;
  await request(`/api/appointments/${visit.id}/status`, staff.cookie, 'PATCH', {
    status: 'confirmed',
  });
  await request(`/api/appointments/${visit.id}/status`, staff.cookie, 'PATCH', {
    status: 'completed',
    serviceNotes: 'Care history to retain.',
  });
  assert.equal(
    (
      await request(`/api/appointments/${visit.id}/payment`, staff.cookie, 'POST', {
        amount: 350,
        method: 'Cash',
      })
    ).status,
    201,
  );
  await request(`/api/appointments/${visit.id}/feedback`, customer.cookie, 'POST', {
    rating: 5,
    comment: 'Feedback to remove.',
  });
  const upcoming = (
    await request('/api/appointments', customer.cookie, 'POST', { ...booking, time: '11:00' })
  ).data.appointment;
  await upload(`${route}/media`, customer.cookie);
  const response = await upload(`${route}/media`, staff.cookie, 'video/webm', webm);
  const url = response.data.messages.at(-1).attachment.url;
  await request(`/api/chat/${other.data.user.id}`, other.cookie, 'POST', {
    text: 'Keep my conversation.',
  });
  const deletion = { password, confirm: true };
  assert.equal((await request('/api/account', '', 'DELETE', deletion)).status, 401);
  assert.equal(
    (await request('/api/account', customer.cookie, 'DELETE', { password })).status,
    400,
  );
  assert.equal(
    (await request('/api/account', customer.cookie, 'DELETE', { ...deletion, password: 'wrong' }))
      .status,
    403,
  );
  assert.equal(saved().users.length, 4);
  const deleted = await request('/api/account', customer.cookie, 'DELETE', deletion);
  assert.equal(deleted.status, 200);
  assert.equal(deleted.data.signedOut, true);
  assert.equal(deleted.cookie, 'petserve_session=');
  for (const session of [customer.cookie, secondSession.cookie])
    assert.equal((await request('/api/bootstrap', session)).data.user, null);
  assert.equal((await login('alex@example.test')).status, 401);
  assert.equal((await media(url, staff.cookie)).status, 404);
  assert.equal(fs.readdirSync(path.join(temporary, 'uploads', 'chat')).length, 0);
  const db = saved();
  assert.ok(!db.users.some((user) => user.id === accountId));
  assert.ok(db.pets.find((item) => item.id === pet.id).deletedAt);
  assert.equal(db.appointments.find((item) => item.id === upcoming.id).status, 'cancelled');
  assert.equal(db.appointments.find((item) => item.id === visit.id).status, 'completed');
  assert.equal(db.serviceRecords[0].notes, 'Care history to retain.');
  assert.equal(db.payments.length, 1);
  assert.ok(db.healthLogs.length);
  assert.equal(db.feedback.length, 0);
  assert.equal(db.chats.length, 1);
  assert.equal(db.chats[0].customerId, other.data.user.id);
  const clinic = (await request('/api/bootstrap', admin.cookie)).data;
  assert.equal(
    clinic.appointments.find((item) => item.id === visit.id).customerName,
    'Deleted account',
  );
  const replacement = await request('/api/auth/register', '', 'POST', {
    name: 'New Alex',
    email: 'alex@example.test',
    password,
  });
  assert.equal(replacement.status, 200);
  assert.notEqual(replacement.data.user.id, accountId);
  const newData = (await request('/api/bootstrap', replacement.cookie)).data;
  assert.equal(newData.pets.length, 0);
  assert.equal(newData.appointments.length, 0);
  await restart();
  assert.equal(
    saved().users.find((user) => user.email === 'alex@example.test').id,
    replacement.data.user.id,
  );
  assert.ok(!JSON.stringify(saved().users).includes('09123456789'));
});

test('only administrators remove other accounts, protect the final administrator and clean employee content and shifts', async (t) => {
  const { request, upload, media, saved, temporary, customer, staff, admin, other } =
    await fixture(t);
  const deletion = { password, confirm: true };
  const staffId = staff.data.user.id;
  const route = `/api/chat/${customer.data.user.id}`;
  await request(route, customer.cookie, 'POST', { text: 'Keep this customer message.' });
  const uploaded = await upload(`${route}/media`, staff.cookie);
  const url = uploaded.data.messages.at(-1).attachment.url;
  const gallery = await upload(
    '/api/gallery?caption=Employee%20post&permission=true',
    staff.cookie,
  );
  assert.equal(gallery.status, 201);
  assert.equal(
    (
      await request('/api/schedule/shifts', admin.cookie, 'POST', {
        employeeId: staffId,
        date: manilaNow().date,
        start: '09:00',
        end: '17:00',
      })
    ).status,
    201,
  );
  assert.equal(
    (await request(`/api/users/${staffId}`, customer.cookie, 'DELETE', deletion)).status,
    403,
  );
  assert.equal(
    (await request(`/api/users/${customer.data.user.id}`, staff.cookie, 'DELETE', deletion)).status,
    403,
  );
  assert.equal((await request('/api/account', admin.cookie, 'DELETE', deletion)).status, 409);
  assert.equal(
    (
      await request(`/api/users/${staffId}`, admin.cookie, 'DELETE', {
        ...deletion,
        password: 'incorrect',
      })
    ).status,
    403,
  );
  const removed = await request(`/api/users/${staffId}`, admin.cookie, 'DELETE', deletion);
  assert.equal(removed.status, 200);
  assert.equal(removed.data.signedOut, false);
  assert.equal((await request('/api/bootstrap', staff.cookie)).data.user, null);
  assert.ok((await request('/api/bootstrap', admin.cookie)).data.user);
  const messages = (await request(route, customer.cookie)).data.messages;
  assert.equal(messages[0].text, 'Keep this customer message.');
  assert.ok(messages[1].deletedAt);
  assert.equal((await media(url, customer.cookie)).status, 404);
  assert.equal(saved().gallery.length, 0);
  assert.equal(saved().shifts.length, 0);
  assert.equal(
    fs.readdirSync(path.join(temporary, 'uploads')).filter((name) => name !== 'chat').length,
    0,
  );
  assert.equal(
    (
      await request(`/api/users/${other.data.user.id}`, admin.cookie, 'PATCH', {
        role: 'admin',
        disabled: false,
      })
    ).status,
    200,
  );
  assert.equal((await request('/api/account', admin.cookie, 'DELETE', deletion)).status, 200);
  assert.equal(saved().users.filter((user) => user.role === 'admin' && !user.disabled).length, 1);
});
