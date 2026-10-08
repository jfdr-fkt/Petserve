const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');

(async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'petserve-pet-media-browser-'));
  const { server } = await createApp({ dbFile: path.join(temporary, 'db.json') });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || 'chrome',
    headless: true,
  });
  const customer = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const staff = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const artifacts = path.join(__dirname, '..', 'artifacts', 'ui');
  fs.mkdirSync(artifacts, { recursive: true });
  const errors = [];
  for (const page of [customer, staff]) {
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
  }
  const submit = async (page) => {
    await page.locator('#modal-root [type=submit]').click();
    await page.locator('.modal-card').waitFor({ state: 'detached' });
  };
  const openAlbum = async (page) => {
    await page.goto(base + '/#pets');
    await page.locator('[data-pet-tab=media]').click();
  };
  async function upload(name, mimeType, buffer, caption) {
    await customer.locator('[data-action=pet-media-upload]').first().click();
    await customer.locator('[name=caption]').fill(caption);
    await customer.locator('#pet-media-file').setInputFiles({ name, mimeType, buffer });
    await customer.locator('.upload-preview').waitFor();
    assert.equal(await customer.locator('[name=caption]').inputValue(), caption);
    await submit(customer);
  }
  try {
    for (const [page, email] of [
      [customer, 'alex@example.test'],
      [staff, 'staff@petserve.test'],
    ])
      assert.equal(
        (
          await page.request.post(base + '/api/auth/login', {
            data: { email, password: 'Petserve123!' },
          })
        ).status(),
        200,
      );
    await openAlbum(customer);
    const photo = await customer.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#e7eff8';
      ctx.fillRect(0, 0, 320, 240);
      ctx.fillStyle = '#315f86';
      ctx.font = '32px sans-serif';
      ctx.fillText('Milo’s moment', 40, 130);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await upload(
      'milo.png',
      'image/png',
      Buffer.from(photo, 'base64'),
      'Milo’s first walk. <b>A happy day.</b>',
    );
    assert.equal(await customer.locator('.gallery-caption b').count(), 0);
    const video = await customer.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 120;
      const ctx = canvas.getContext('2d');
      const stream = canvas.captureStream(15);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      const stopped = new Promise((resolve) => {
        recorder.onstop = resolve;
      });
      recorder.start();
      let frame = 0;
      const paint = setInterval(() => {
        ctx.fillStyle = '#e7eff8';
        ctx.fillRect(0, 0, 160, 120);
        ctx.fillStyle = '#315f86';
        ctx.fillRect((frame++ * 4) % 120, 40, 40, 40);
      }, 60);
      await new Promise((resolve) => setTimeout(resolve, 850));
      clearInterval(paint);
      recorder.stop();
      await stopped;
      stream.getTracks().forEach((track) => track.stop());
      return btoa(String.fromCharCode(...new Uint8Array(await new Blob(chunks).arrayBuffer())));
    });
    await upload('milo.webm', 'video/webm', Buffer.from(video, 'base64'), 'Learning a new trick.');
    assert.equal(await customer.locator('.pet-media-card').count(), 2);
    await customer.locator('.pet-media-card video').evaluate(async (element) => {
      element.muted = true;
      await element.play();
      element.pause();
      if (element.error) throw new Error(element.error.message);
    });
    await customer.locator('.pet-media-photo').click();
    await customer.locator('.pet-media-viewer img').waitFor();
    assert.equal(await customer.locator('#dialog-title').textContent(), 'Milo’s photo');
    assert.match(
      await customer.locator('.pet-media-viewer .modal-header p').textContent(),
      /<b>A happy day.<\/b>/,
    );
    await customer.keyboard.press('Escape');
    await customer.locator('.modal-card').waitFor({ state: 'detached' });
    await customer.reload();
    await customer.locator('[data-pet-tab=media]').click();
    assert.equal(await customer.locator('.pet-media-card').count(), 2);

    const miloId = (await (await customer.request.get(base + '/api/bootstrap')).json()).pets[0].id;
    const added = await customer.request.post(base + '/api/pets', {
      data: { name: 'Luna', species: 'Cat' },
    });
    const lunaId = (await added.json()).pet.id;
    await customer.reload();
    await customer.locator('[data-pet-tab=media]').click();
    await customer.locator(`.pet-list-card[data-id="${lunaId}"]`).click();
    assert.equal(await customer.locator('.pet-media-card').count(), 0);
    await upload('luna.png', 'image/png', Buffer.from(photo, 'base64'), 'Luna’s own album.');
    assert.equal(await customer.locator('.pet-media-card').count(), 1);
    await customer.locator(`.pet-list-card[data-id="${miloId}"]`).click();
    assert.equal(await customer.locator('.pet-media-card').count(), 2);
    await customer.evaluate(() => document.fonts.ready);
    await customer.screenshot({
      path: path.join(artifacts, 'pet-album-desktop.png'),
      fullPage: true,
    });

    await openAlbum(staff);
    await staff.locator(`.pet-list-card[data-id="${miloId}"]`).click();
    assert.equal(await staff.locator('.pet-media-card').count(), 2);
    assert.equal(await staff.locator('[data-action=pet-media-upload]').count(), 0);
    assert.equal(await staff.locator('[data-action=pet-media-remove]').count(), 0);
    await staff.locator('.pet-media-photo').click();
    await staff.locator('.pet-media-viewer img').waitFor();
    await staff.keyboard.press('Escape');

    await customer.setViewportSize({ width: 390, height: 844 });
    await customer.locator('[data-pet-tab=media]').click();
    await customer.waitForFunction(
      () => document.querySelector('.sidebar').getBoundingClientRect().right <= 1,
    );
    assert.ok(
      await customer.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      ),
      'Pet albums must fit a phone screen',
    );
    await customer.screenshot({
      path: path.join(artifacts, 'pet-album-mobile.png'),
      fullPage: true,
    });
    await customer.locator('[data-action=pet-media-upload]').first().click();
    assert.ok(
      await customer.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      ),
      'The upload dialog must fit a phone screen',
    );
    await customer.keyboard.press('Escape');
    await customer.locator('[data-action=pet-media-remove]').first().click();
    await customer.locator('#modal-root [data-action=dialog-close]').first().click();
    assert.equal(await customer.locator('.pet-media-card').count(), 2);
    await customer.locator('[data-action=pet-media-remove]').first().click();
    await submit(customer);
    assert.equal(await customer.locator('.pet-media-card').count(), 1);
    await customer.reload();
    await customer.locator('[data-pet-tab=media]').click();
    assert.equal(await customer.locator('.pet-media-card').count(), 1);
    assert.deepEqual(errors, []);
    console.log(
      'Pet album browser checks passed: individual pets, photo/video uploads, escaped captions, playback, larger viewer, reload persistence, read-only staff access, removal, and mobile layout.',
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    assert.ok(
      path.resolve(temporary).startsWith(path.resolve(os.tmpdir()) + path.sep) &&
        path.basename(temporary).startsWith('petserve-pet-media-browser-'),
    );
    fs.rmSync(temporary, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
