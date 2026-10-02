const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');
const { manilaNow } = require('../src/helpers');

async function setup(t) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'petserve-community-'));
  const dbFile = path.join(temporary, 'db.json');
  const app = await createApp({ dbFile });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const servers = [app.server];
  t.after(async () => {
    for (const server of servers) await new Promise((resolve) => server.close(resolve));
    assert.ok(
      path.resolve(temporary).startsWith(path.resolve(os.tmpdir()) + path.sep) &&
        path.basename(temporary).startsWith('petserve-community-'),
    );
    fs.rmSync(temporary, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  async function request(route, cookie = '', method = 'GET', body) {
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
  }
  const login = async (role) =>
    (
      await request('/api/auth/login', '', 'POST', {
        email: role === 'customer' ? 'alex@example.test' : `${role}@petserve.test`,
        password: 'Petserve123!',
      })
    ).cookie;
  const customer = await login('customer'),
    staff = await login('staff');
  const other = await request('/api/auth/register', '', 'POST', {
    name: 'Other customer',
    email: 'other@example.test',
    password: 'Petserve123!',
  });
  return { base, request, login, customer, staff, other: other.cookie, temporary, dbFile, servers };
}

test('feedback belongs to completed visits, stays private, supports editing and staff replies', async (t) => {
  const { request, customer, staff, other, dbFile } = await setup(t);
  const petId = (await request('/api/bootstrap', customer)).data.pets[0].id;
  const date = new Date(`${manilaNow().date}T12:00Z`);
  date.setUTCDate(date.getUTCDate() + ((6 - date.getUTCDay() + 7) % 7 || 7));
  const a = (
    await request('/api/appointments', customer, 'POST', {
      petId,
      serviceId: 'grooming',
      date: date.toISOString().slice(0, 10),
      time: '10:00',
    })
  ).data.appointment;
  const endpoint = `/api/appointments/${a.id}/feedback`;
  assert.equal(
    (await request(endpoint, customer, 'POST', { rating: 5, comment: 'Great visit.' })).status,
    409,
  );
  await request(`/api/appointments/${a.id}/status`, staff, 'PATCH', { status: 'confirmed' });
  await request(`/api/appointments/${a.id}/status`, staff, 'PATCH', {
    status: 'completed',
    serviceNotes: 'Grooming completed.',
  });
  assert.equal((await request(endpoint, other, 'POST', { rating: 5 })).status, 404);
  assert.equal((await request(endpoint, staff, 'POST', { rating: 5 })).status, 403);
  assert.equal((await request(endpoint, customer, 'POST', { rating: 6 })).status, 400);
  const added = await request(endpoint, customer, 'POST', {
    rating: 5,
    comment: 'Gentle and kind care.',
  });
  assert.equal(added.status, 201);
  assert.equal((await request('/api/bootstrap', other)).data.feedback.length, 0);
  assert.equal((await request('/api/bootstrap')).data.feedback.length, 0);
  const edited = await request(endpoint, customer, 'POST', {
    rating: 4,
    comment: 'Good visit, a little wait.',
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.feedback.id, added.data.feedback.id);
  const reply = `/api/feedback/${added.data.feedback.id}/reply`;
  assert.equal((await request(reply, customer, 'PATCH', { text: 'Unauthorized' })).status, 403);
  assert.equal(
    (
      await request(reply, staff, 'PATCH', {
        text: 'Thank you for sharing. We will work on wait times.',
      })
    ).status,
    200,
  );
  const visible = (await request('/api/bootstrap', customer)).data.feedback;
  assert.equal(visible.length, 1);
  assert.equal(visible[0].rating, 4);
  assert.equal(visible[0].reply.staffName, 'Clinic Staff');
  assert.equal(JSON.parse(fs.readFileSync(dbFile, 'utf8')).feedback.length, 1);
});

test('gallery uploads require staff, are shared with signed-in customers and stream protected media ranges', async (t) => {
  const { base, request, staff, customer, other, temporary, dbFile, servers } = await setup(t);
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    'base64',
  );
  async function upload(cookie, body = png, mime = 'image/png', permission = 'true') {
    const response = await fetch(
      `${base}/api/gallery?${new URLSearchParams({ caption: 'A fresh grooming moment', serviceId: 'grooming', permission })}`,
      { method: 'POST', headers: { Cookie: cookie, 'Content-Type': mime }, body },
    );
    return { status: response.status, data: await response.json() };
  }
  assert.equal((await upload(customer)).status, 403);
  assert.equal((await upload(staff, png, 'image/png', 'false')).status, 400);
  assert.equal((await upload(staff, Buffer.from('not a PNG'))).status, 400);
  const posted = await upload(staff);
  assert.equal(posted.status, 201);
  const gallery = (await request('/api/bootstrap', other)).data.gallery;
  assert.equal(gallery.length, 1);
  assert.equal(gallery[0].caption, 'A fresh grooming moment');
  assert.equal(gallery[0].filename, undefined);
  assert.equal(gallery[0].uploadedBy, undefined);
  assert.equal((await request('/api/bootstrap')).data.gallery.length, 0);
  assert.equal((await fetch(base + gallery[0].url)).status, 401);
  const part = await fetch(base + gallery[0].url, {
    headers: { Cookie: customer, Range: 'bytes=0-7' },
  });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('content-type'), 'image/png');
  assert.equal((await part.arrayBuffer()).byteLength, 8);
  assert.equal(
    (await fetch(base + gallery[0].url, { headers: { Cookie: other, Range: 'bytes=99999-' } }))
      .status,
    416,
  );
  const app = await createApp({ dbFile });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  servers.push(app.server);
  const restartedBase = `http://127.0.0.1:${app.server.address().port}`;
  const login = await fetch(restartedBase + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alex@example.test', password: 'Petserve123!' }),
  });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal(
    (await fetch(restartedBase + gallery[0].url, { headers: { Cookie: cookie } })).status,
    200,
  );
  assert.equal((await request(`/api/gallery/${posted.data.id}`, customer, 'DELETE')).status, 403);
  assert.equal((await request(`/api/gallery/${posted.data.id}`, staff, 'DELETE')).status, 200);
  assert.equal(fs.readdirSync(path.join(temporary, 'uploads')).length, 0);
  assert.equal((await fetch(base + gallery[0].url, { headers: { Cookie: customer } })).status, 404);
});
