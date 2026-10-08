const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');

(async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'petserve-workspace-'));
  const artifacts = path.join(__dirname, '..', 'artifacts', 'ui');
  fs.mkdirSync(artifacts, { recursive: true });
  const { server } = await createApp({ dbFile: path.join(temporary, 'db.json') });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || 'chrome',
    headless: true,
  });
  const customer = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const staff = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const admin = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const errors = [];
  for (const page of [customer, staff, admin]) {
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
  }
  const navigate = async (page, view) => {
    if (page.viewportSize().width <= 720) await page.locator('.mobile-menu-toggle').click();
    await page.locator(`.side-nav [data-view="${view}"]`).click();
    if (page.viewportSize().width <= 720)
      await page.waitForFunction(
        () => document.querySelector('.sidebar').getBoundingClientRect().right <= 1,
      );
  };
  const confirm = async (page) => {
    await page.locator('#modal-root [type=submit]').click();
    await page.locator('.modal-card').waitFor({ state: 'detached' });
  };
  try {
    for (const [page, role] of [
      [customer, 'customer'],
      [staff, 'staff'],
      [admin, 'admin'],
    ]) {
      const response = await page.request.post(`${base}/api/auth/login`, {
        data: {
          email: role === 'customer' ? 'alex@example.test' : `${role}@petserve.test`,
          password: 'Petserve123!',
        },
      });
      assert.equal(response.status(), 200);
      await page.goto(`${base}/#chat`);
      await page.locator('.side-nav').waitFor();
      assert.equal(await page.locator('.nav-group').count(), 4);
      assert.equal(
        await page.locator('.side-nav [data-view]').first().getAttribute('data-view'),
        role === 'customer' ? 'book' : 'appointments',
      );
      assert.ok(await page.locator('.profile-mini').isVisible());
    }
    await customer.getByText('A friendly conversation starts here', { exact: true }).waitFor();
    const image = await customer.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 120;
      const context = canvas.getContext('2d');
      context.fillStyle = '#e7eff8';
      context.fillRect(0, 0, 160, 120);
      context.fillStyle = '#315f86';
      context.fillRect(50, 35, 60, 50);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await customer.locator('#chat-text').fill('A new photo of Milo 🐾');
    await customer.locator('#chat-file').setInputFiles({
      name: 'milo.png',
      mimeType: 'image/png',
      buffer: Buffer.from(image, 'base64'),
    });
    assert.equal(await customer.locator('#chat-text').inputValue(), 'A new photo of Milo 🐾');
    await customer.locator('.chat-attachment-draft').waitFor();
    await customer.locator('form[data-form=chat] [type=submit]').click();
    await staff
      .locator('.chat-messages')
      .getByText('A new photo of Milo 🐾', { exact: true })
      .waitFor({ timeout: 12000 });
    await staff.waitForFunction(() => {
      const image = document.querySelector('.chat-media');
      return image?.complete && image.naturalWidth > 0;
    });
    assert.equal(await staff.locator('.chat-message .chat-delete').count(), 0);
    const videoData = await staff.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 120;
      const context = canvas.getContext('2d');
      const stream = canvas.captureStream(15);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      const stopped = new Promise((resolve) => (recorder.onstop = resolve));
      recorder.start();
      let frame = 0;
      const paint = setInterval(() => {
        context.fillStyle = '#e7eff8';
        context.fillRect(0, 0, 160, 120);
        context.fillStyle = '#315f86';
        context.fillRect((frame++ * 4) % 120, 40, 40, 40);
      }, 60);
      await new Promise((resolve) => setTimeout(resolve, 950));
      clearInterval(paint);
      recorder.stop();
      await stopped;
      stream.getTracks().forEach((track) => track.stop());
      const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
      return btoa(String.fromCharCode(...bytes));
    });
    await staff.locator('#chat-file').setInputFiles({
      name: 'care-update.webm',
      mimeType: 'video/webm',
      buffer: Buffer.from(videoData, 'base64'),
    });
    await staff.locator('form[data-form=chat] [type=submit]').click();
    await customer.locator('.chat-message video').waitFor({ timeout: 12000 });
    await customer.locator('.chat-message video').evaluate(async (video) => {
      video.muted = true;
      video.loop = true;
      window.currentMedia = video;
      await video.play();
    });
    await customer.locator('#chat-text').fill('Keep my unsent draft.');
    await staff.locator('#chat-text').fill('Another update from the care team.');
    await staff.locator('form[data-form=chat] [type=submit]').click();
    await customer
      .getByText('Another update from the care team.', { exact: true })
      .waitFor({ timeout: 12000 });
    assert.equal(await customer.locator('#chat-text').inputValue(), 'Keep my unsent draft.');
    assert.ok(
      await customer.evaluate(
        () =>
          window.currentMedia === document.querySelector('.chat-message video') &&
          !window.currentMedia.paused,
      ),
      'Incoming messages preserve video playback',
    );
    await customer.locator('[data-action=sidebar-toggle]').click();
    await customer.locator('[data-action=sidebar-toggle]').click();
    assert.ok(
      await customer.evaluate(
        () =>
          window.currentMedia === document.querySelector('.chat-message video') &&
          !window.currentMedia.paused,
      ),
      'Sidebar controls preserve video playback',
    );
    assert.equal(await customer.locator('#chat-text').inputValue(), 'Keep my unsent draft.');
    assert.equal(
      await customer
        .locator('.chat-message')
        .filter({ has: customer.locator('video') })
        .locator('.chat-delete')
        .count(),
      0,
    );
    await customer
      .locator('.chat-message')
      .filter({ hasText: 'A new photo of Milo' })
      .locator('.chat-delete')
      .click();
    await confirm(customer);
    await staff.getByText('Message deleted', { exact: true }).waitFor({ timeout: 12000 });
    assert.equal(await customer.locator('.chat-message img').count(), 0);
    assert.equal(await customer.locator('#chat-text').inputValue(), 'Keep my unsent draft.');
    await staff
      .locator('.chat-message')
      .filter({ has: staff.locator('video') })
      .locator('.chat-delete')
      .click();
    await confirm(staff);
    await customer.waitForFunction(() => !document.querySelector('.chat-message video'), {
      timeout: 12000,
    });
    await admin
      .locator('.chat-messages')
      .getByText('Another update from the care team.', { exact: true })
      .waitFor({ timeout: 12000 });
    assert.equal(await admin.locator('.chat-delete').count(), 1);
    await customer.evaluate(() => document.fonts.ready);
    await customer.screenshot({
      path: path.join(artifacts, 'grouped-sidebar-chat.png'),
      fullPage: true,
    });
    await navigate(customer, 'account');
    await customer.screenshot({
      path: path.join(artifacts, 'account-removal.png'),
      fullPage: true,
    });
    await customer.setViewportSize({ width: 390, height: 844 });
    for (const page of [customer, staff]) {
      await page.setViewportSize({ width: 390, height: 844 });
      await navigate(page, 'chat');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.locator('.mobile-menu-toggle').click();
      await page.waitForFunction(
        () => document.querySelector('.sidebar').getBoundingClientRect().left >= -1,
      );
      await page.locator('.side-nav [data-view=account]').click();
      await page.waitForFunction(
        () => document.querySelector('.sidebar').getBoundingClientRect().right <= 1,
      );
      assert.ok(await page.locator('[data-action=account-delete]').isVisible());
    }
    await customer.locator('[data-action=account-delete]').click();
    await customer.locator('#modal-root [name=password]').fill('Petserve123!');
    await customer.locator('#modal-root [name=confirm]').check();
    await customer.screenshot({
      path: path.join(artifacts, 'account-removal-mobile.png'),
      fullPage: true,
    });
    await confirm(customer);
    await customer.locator('.logout-goodbye').waitFor();
    await customer.locator('.logout-goodbye button').click();
    await customer.locator('form[data-form=auth]').waitFor();
    assert.equal((await (await customer.request.get(`${base}/api/bootstrap`)).json()).user, null);
    await navigate(admin, 'accounts');
    await admin
      .locator('tr')
      .filter({ hasText: 'staff@petserve.test' })
      .locator('[data-action=account-delete]')
      .click();
    await admin.locator('#modal-root [name=password]').fill('Petserve123!');
    await admin.locator('#modal-root [name=confirm]').check();
    await confirm(admin);
    await admin.waitForFunction(
      () => !document.querySelector('#main-content').textContent.includes('staff@petserve.test'),
    );
    assert.deepEqual(errors, [], 'No browser or media errors');
    console.log(
      'Workspace checks passed: grouped navigation, photo/video messages, uninterrupted playback, message permissions and deletion, mobile layouts, customer and administrator account removal.',
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    assert.ok(
      path.resolve(temporary).startsWith(path.resolve(os.tmpdir()) + path.sep) &&
        path.basename(temporary).startsWith('petserve-workspace-'),
    );
    fs.rmSync(temporary, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
