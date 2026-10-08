const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { createApp } = require('../server');

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
  'base64',
);
const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x10, 0x20, 0x30, 0x40]);

async function setup(t) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'petserve-pet-media-'));
  const dbFile = path.join(temporary, 'db.json');
  const servers = [];
  async function start() {
    const { server } = await createApp({ dbFile });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    servers.push(server);
    return `http://127.0.0.1:${server.address().port}`;
  }
  const base = await start();
  t.after(async () => {
    for (const server of servers) await new Promise((resolve) => server.close(resolve));
    assert.ok(
      path.resolve(temporary).startsWith(path.resolve(os.tmpdir()) + path.sep) &&
        path.basename(temporary).startsWith('petserve-pet-media-'),
    );
    fs.rmSync(temporary, { recursive: true, force: true });
  });
  async function request(route, cookie = '', method = 'GET', body, origin = base) {
    const response = await fetch(origin + route, {
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
  const login = async (role, origin = base) =>
    (
      await request(
        '/api/auth/login',
        '',
        'POST',
        {
          email: role === 'customer' ? 'alex@example.test' : `${role}@petserve.test`,
          password: 'Petserve123!',
        },
        origin,
      )
    ).cookie;
  const customer = await login('customer');
  const staff = await login('staff');
  const admin = await login('admin');
  const registered = await request('/api/auth/register', '', 'POST', {
    name: 'Another owner',
    email: 'other@example.test',
    password: 'Petserve123!',
  });
  const other = registered.cookie;
  const petId = (await request('/api/bootstrap', customer)).data.pets[0].id;
  const otherPet = (
    await request('/api/pets', other, 'POST', { name: 'Other pet', species: 'Cat' })
  ).data.pet;
  async function upload(id, cookie, bytes = png, mime = 'image/png', caption = '', headers = {}) {
    const response = await fetch(
      `${base}/api/pets/${id}/media?${new URLSearchParams({ caption })}`,
      {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': mime, ...headers },
        body: bytes,
      },
    );
    return { status: response.status, data: await response.json() };
  }
  const content = (url, cookie = '', headers = {}, method = 'GET', origin = base) =>
    fetch(origin + url, {
      method,
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...headers },
    });
  const saved = () => JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  return {
    base,
    server: servers[0],
    start,
    login,
    request,
    upload,
    content,
    saved,
    temporary,
    customer,
    staff,
    admin,
    other,
    petId,
    otherPet,
  };
}

test('pet albums keep pets and owners separate and give the care team read access', async (t) => {
  const { request, upload, content, customer, staff, admin, other, petId, otherPet } =
    await setup(t);
  assert.equal((await upload(petId, '')).status, 401);
  assert.equal((await upload(petId, other)).status, 403);
  assert.equal((await upload(petId, staff)).status, 403);
  assert.equal((await upload(petId, admin)).status, 403);
  const photo = await upload(petId, customer, png, 'image/png', 'Milo’s first walk 🐾');
  const video = await upload(petId, customer, webm, 'video/webm');
  assert.equal(photo.status, 201);
  assert.equal(video.status, 201);
  assert.equal((await upload(otherPet.id, other)).status, 201);
  const ownerData = (await request('/api/bootstrap', customer)).data;
  assert.equal(ownerData.petMedia.length, 2);
  assert.equal(ownerData.gallery.length, 0);
  assert.equal(ownerData.pets[0].photoUrl, '');
  assert.equal(
    ownerData.petMedia.find((item) => item.id === photo.data.id).caption,
    'Milo’s first walk 🐾',
  );
  assert.ok(
    ownerData.petMedia.every((item) => item.petId === petId && item.filename === undefined),
  );
  assert.equal((await request('/api/bootstrap')).data.petMedia.length, 0);
  assert.equal((await request('/api/bootstrap', other)).data.petMedia.length, 1);
  assert.equal((await request('/api/bootstrap', staff)).data.petMedia.length, 3);
  assert.equal((await request('/api/bootstrap', admin)).data.petMedia.length, 3);
  const url = ownerData.petMedia.find((item) => item.id === video.data.id).url;
  assert.equal((await content(url)).status, 401);
  assert.equal((await content(url, other)).status, 403);
  assert.equal((await content(url, staff)).status, 200);
  const range = await content(url, customer, { Range: 'bytes=2-5' });
  assert.equal(range.status, 206);
  assert.equal(range.headers.get('content-type'), 'video/webm');
  assert.deepEqual(Buffer.from(await range.arrayBuffer()), webm.subarray(2, 6));
  assert.equal((await content(url, customer, { Range: 'bytes=999-' })).status, 416);
  assert.equal(
    (await content(url, admin, {}, 'HEAD')).headers.get('content-length'),
    String(webm.length),
  );
  assert.equal(
    (await content(`/api/pets/${otherPet.id}/media/${photo.data.id}/content`, staff)).status,
    404,
  );
  assert.equal(
    (await request(`/api/pets/${petId}/media/${photo.data.id}`, staff, 'DELETE')).status,
    403,
  );
  assert.equal(
    (await request(`/api/pets/${petId}/media/${photo.data.id}`, other, 'DELETE')).status,
    403,
  );
});

test('pet uploads validate bytes and size and survive an application restart', async (t) => {
  const { request, upload, content, saved, start, login, customer, petId, temporary } =
    await setup(t);
  assert.equal((await upload(petId, customer, png, 'image/gif')).status, 415);
  assert.equal((await upload(petId, customer, Buffer.alloc(0))).status, 400);
  assert.equal((await upload(petId, customer, Buffer.from('not a photo'))).status, 400);
  assert.equal((await upload(petId, customer, png, 'image/png', 'x'.repeat(301))).status, 400);
  assert.equal(
    (await upload(petId, customer, png, 'image/png', '', { Origin: 'https://elsewhere.test' }))
      .status,
    403,
  );
  assert.equal((await upload(petId, customer, Buffer.alloc(25 * 1024 * 1024 + 1))).status, 413);
  assert.equal(saved().petMedia.length, 0);
  assert.equal(fs.existsSync(path.join(temporary, 'uploads', 'pets')), false);
  const added = await upload(petId, customer);
  assert.equal(added.status, 201);
  const base = await start();
  const cookie = await login('customer', base);
  const media = (await request('/api/bootstrap', cookie, 'GET', undefined, base)).data.petMedia[0];
  assert.equal(media.id, added.data.id);
  assert.deepEqual(
    Buffer.from(await (await content(media.url, cookie, {}, 'GET', base)).arrayBuffer()),
    png,
  );
});

test('removal deletes one item; account deletion cleans active and archived albums without removing other owners’ media', async (t) => {
  const {
    request,
    upload,
    content,
    saved,
    temporary,
    customer,
    staff,
    admin,
    other,
    petId,
    otherPet,
  } = await setup(t);
  const secondPet = (await request('/api/pets', customer, 'POST', { name: 'Luna', species: 'Cat' }))
    .data.pet;
  const removed = await upload(petId, customer);
  await upload(petId, customer, webm, 'video/webm');
  await upload(secondPet.id, customer);
  await upload(otherPet.id, other);
  const item = saved().petMedia.find((entry) => entry.id === removed.data.id);
  const file = path.join(temporary, 'uploads', 'pets', item.filename);
  assert.equal(
    (await request(`/api/pets/${petId}/media/${item.id}`, customer, 'DELETE')).status,
    200,
  );
  assert.equal(fs.existsSync(file), false);
  assert.equal(saved().petMedia.length, 3);
  assert.equal(
    (await content(`/api/pets/${petId}/media/${item.id}/content`, customer)).status,
    404,
  );
  const archived = saved().petMedia.find((entry) => entry.petId === secondPet.id);
  assert.equal((await request(`/api/pets/${secondPet.id}`, customer, 'DELETE')).status, 200);
  assert.equal(
    (await content(`/api/pets/${secondPet.id}/media/${archived.id}/content`, staff)).status,
    404,
  );
  assert.equal((await request('/api/bootstrap', customer)).data.petMedia.length, 1);
  assert.equal(
    (await request('/api/account', customer, 'DELETE', { password: 'Petserve123!', confirm: true }))
      .status,
    200,
  );
  assert.equal(saved().petMedia.length, 1);
  assert.equal(fs.readdirSync(path.join(temporary, 'uploads', 'pets')).length, 1);
  const retained = (await request('/api/bootstrap', other)).data.petMedia[0];
  assert.equal((await content(retained.url, other)).status, 200);
  const otherId = saved().pets.find((pet) => pet.id === otherPet.id).ownerId;
  assert.equal(
    (
      await request(`/api/users/${otherId}`, admin, 'DELETE', {
        password: 'Petserve123!',
        confirm: true,
      })
    ).status,
    200,
  );
  assert.equal(saved().petMedia.length, 0);
  assert.equal(fs.readdirSync(path.join(temporary, 'uploads', 'pets')).length, 0);
});

test('concurrent uploads enforce a separate 50-item limit for each pet', async (t) => {
  const { upload, saved, customer, petId, other, otherPet, temporary } = await setup(t);
  const results = await Promise.all(Array.from({ length: 51 }, () => upload(petId, customer)));
  assert.equal(results.filter((item) => item.status === 201).length, 50);
  assert.equal(results.filter((item) => item.status === 409).length, 1);
  assert.equal(saved().petMedia.length, 50);
  assert.equal(fs.readdirSync(path.join(temporary, 'uploads', 'pets')).length, 50);
  assert.equal((await upload(otherPet.id, other)).status, 201);
});

test('archiving or signing out while an upload is streaming prevents an orphaned upload', async (t) => {
  const { base, server, login, request, saved, customer, petId } = await setup(t);
  async function interrupted(cookie, change) {
    const started = new Promise((resolve) => server.once('request', () => setImmediate(resolve)));
    let outgoing;
    const done = new Promise((resolve, reject) => {
      outgoing = http.request(
        `${base}/api/pets/${petId}/media`,
        {
          method: 'POST',
          headers: { Cookie: cookie, 'Content-Type': 'image/png', 'Content-Length': png.length },
        },
        (response) => {
          response.resume();
          response.on('end', () => resolve(response.statusCode));
        },
      );
      outgoing.on('error', reject);
      outgoing.write(png.subarray(0, 8));
    });
    t.after(() => outgoing.destroy());
    await started;
    try {
      await change();
    } finally {
      outgoing.end(png.subarray(8));
    }
    return done;
  }
  // Flush only the initial chunk; the response must recheck permissions after
  // reading the remaining bytes, rather than relying on its initial lookup.
  assert.equal(
    await interrupted(customer, () => request('/api/auth/logout', customer, 'POST', {})),
    403,
  );
  const signedIn = await login('customer');
  assert.equal(
    await interrupted(signedIn, () => request(`/api/pets/${petId}`, signedIn, 'DELETE')),
    409,
  );
  assert.equal(saved().petMedia.length, 0);
});
