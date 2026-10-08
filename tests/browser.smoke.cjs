// Run with npm run test:browser. Uses installed Chrome (or BROWSER_CHANNEL=msedge).
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');
const { manilaNow } = require('../src/helpers');

(async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'petserve-browser-'));
  const artifacts = path.join(__dirname, '..', 'artifacts', 'ui');
  fs.mkdirSync(artifacts, { recursive: true });
  const { server } = await createApp({ dbFile: path.join(temporary, 'db.json') });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || 'chrome',
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED')
      errors.push(`${request.failure()?.errorText}: ${request.url()}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const clickNav = async (view) => {
    if (page.viewportSize().width <= 720) {
      await page.locator('.mobile-menu-toggle').click();
      await page.locator('.app-shell.mobile-menu-open').waitFor();
    }
    await page.locator(`.side-nav [data-view="${view}"]`).click();
    await page.locator('#main-content').waitFor();
    if (page.viewportSize().width <= 720)
      await page.waitForFunction(
        () => document.querySelector('.sidebar').getBoundingClientRect().right <= 1,
      );
    if (view === 'reports') await page.locator('.status-bars').waitFor();
  };
  const login = async (role) => {
    await page.goto(base);
    await page.locator('.demo-accounts summary').click();
    await page.locator(`[data-fill="${role}"]`).click();
    await page.locator('form[data-form="auth"] [type=submit]').click();
    await page.locator('.login-welcome').waitFor();
    assert.equal(await page.locator('#app').evaluate((el) => el.inert), true);
    if (role === 'customer') {
      await page.screenshot({ path: path.join(artifacts, 'login-welcome.png') });
      await page.locator('.login-welcome button').click();
    } else if (role === 'admin') {
      await page.keyboard.press('Escape');
    }
    await page.locator('.side-nav').waitFor();
    assert.equal(await page.locator('.login-welcome').count(), 0);
    assert.equal(await page.locator('#app').evaluate((el) => el.inert), false);
  };
  const logout = async () => {
    await page
      .locator(
        page.viewportSize().width <= 720
          ? '.mobile-signout'
          : '.profile-mini [data-action="logout"]',
      )
      .click();
    await page.locator('form[data-form="auth"]').waitFor();
  };
  const submitDialog = async () => {
    await page.locator('#modal-root [type=submit]').click();
    await page.locator('.modal-card').waitFor({ state: 'detached' });
  };
  const noOverflow = async (name) => {
    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert.ok(widths.scroll <= widths.client + 1, `${name} overflows: ${JSON.stringify(widths)}`);
  };
  try {
    await page.goto(base);
    await page.locator('.pet-scene-play').waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.ok((await page.locator('.auth-card').boundingBox()).width >= 430);
    assert.ok((await page.locator('[name=email]').boundingBox()).height >= 54);
    await page.screenshot({ path: path.join(artifacts, 'sign-in.png'), fullPage: true });
    await login('customer');
    await page.locator('[data-action="sidebar-toggle"]').click();
    assert.equal(await page.locator('.mobile-menu-toggle').isVisible(), false);
    assert.equal(await page.locator('.sidebar-mobile-close').isVisible(), false);
    await page.locator('.app-shell.sidebar-collapsed').waitFor();
    await page.waitForFunction(
      () => Math.abs(document.querySelector('.sidebar').getBoundingClientRect().width - 84) < 0.1,
    );
    await page.screenshot({ path: path.join(artifacts, 'sidebar-collapsed.png'), fullPage: true });
    await page.reload();
    await page.locator('.app-shell.sidebar-collapsed').waitFor();
    await page.locator('[data-action="sidebar-toggle"]').click();
    await page.waitForFunction(
      () => Math.abs(document.querySelector('.sidebar').getBoundingClientRect().width - 260) < 0.1,
    );
    await page.evaluate(() => document.fonts.ready);
    assert.ok(await page.evaluate(() => document.fonts.check('16px "Nunito Sans"')));
    await page.screenshot({ path: path.join(artifacts, 'customer-overview.png'), fullPage: true });
    await clickNav('pets');
    assert.equal(
      await page.locator('#main-content').evaluate((el) => getComputedStyle(el).transform),
      'none',
    );
    assert.equal(
      await page.locator('#main-content').evaluate((el) => el.getAnimations().length),
      0,
    );
    await page.locator('[data-action="pet-add"]').first().click();
    await page.locator('#modal-root [name=name]').fill('Luna');
    await page.locator('#modal-root [name=species]').selectOption('Cat');
    await page.locator('#modal-root [name=breed]').fill('Puspin');
    const png = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#b7c8a4';
      ctx.fillRect(0, 0, 64, 64);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await page.locator('#pet-photo').setInputFiles({
      name: 'pet.png',
      mimeType: 'image/png',
      buffer: Buffer.from(png, 'base64'),
    });
    await page.locator('.photo-editor .text-button').waitFor();
    assert.equal(
      await page.locator('#modal-root [name=name]').inputValue(),
      'Luna',
      'Photo must preserve the form draft',
    );
    await submitDialog();
    await page.locator('.pet-identity h2').filter({ hasText: 'Luna' }).waitFor();
    await page.locator('[data-action="pet-edit"]').click();
    await page.locator('#modal-root [name=weight]').fill('4.5');
    await page.locator('#modal-root [name=allergies]').fill('Sensitive to strong fragrances');
    await submitDialog();
    await page.locator('[data-pet-tab="health"]').click();
    await page.locator('[data-action="health-add"]').click();
    await page.locator('#modal-root [name=title]').fill('Vaccination history');
    await page.locator('#modal-root [name=notes]').fill('Owner supplied vaccination record.');
    await submitDialog();
    assert.ok(await page.getByText('Owner provided · Vaccination').count());
    await page.screenshot({ path: path.join(artifacts, 'my-pets.png'), fullPage: true });
    await page.locator('[data-action="book-pet"]').click();
    const date = new Date(`${manilaNow().date}T12:00Z`);
    date.setUTCDate(date.getUTCDate() + ((6 - date.getUTCDay() + 7) % 7 || 7));
    await page.locator('#booking-date').fill(date.toISOString().slice(0, 10));
    await page.locator('[data-time="10:00"]:not(:disabled)').waitFor();
    await page.locator('[data-time="10:00"]').click();
    await page.locator('form[data-form="booking"] [name=note]').fill('Please use gentle products.');
    await page.screenshot({ path: path.join(artifacts, 'booking.png'), fullPage: true });
    await page.locator('form[data-form="booking"] [type=submit]').click();
    await page.locator('.appointment-card').waitFor();
    await page.locator('[data-action="reschedule"]').click();
    await page.locator('#modal-root [data-time="11:00"]:not(:disabled)').waitFor();
    await page.locator('#modal-root [data-time="11:00"]').click();
    await submitDialog();
    await page.reload();
    await page.locator('.appointment-card').waitFor();
    assert.ok(await page.getByText('11:00 AM', { exact: true }).count());
    await logout();
    await login('staff');
    await clickNav('appointments');
    await page.locator('[data-status="confirmed"]').click();
    await page.locator('#modal-root [name=staffNote]').fill('We look forward to meeting Luna.');
    await submitDialog();
    await page.locator('[data-status="completed"]').click();
    await page
      .locator('#modal-root [name=serviceNotes]')
      .fill('Gentle grooming completed. Skin sensitivities noted.');
    await submitDialog();
    await page.locator('[data-action="payment"]').click();
    await page.locator('#modal-root [name=amount]').fill('500');
    await page.locator('#modal-root [name=reference]').fill('DEMO-001');
    await submitDialog();
    await page.locator('[data-action="receipt"]').click();
    assert.ok(await page.getByText('DEMO-001', { exact: true }).count());
    await page.screenshot({ path: path.join(artifacts, 'receipt.png'), fullPage: true });
    await page.keyboard.press('Escape');
    await clickNav('gallery');
    const upload = async (name, mimeType, buffer, caption) => {
      await page.locator('[data-action="gallery-upload"]').first().click();
      await page.locator('#modal-root [name=caption]').fill(caption);
      await page.locator('#gallery-file').setInputFiles({ name, mimeType, buffer });
      assert.equal(await page.locator('#modal-root [name=caption]').inputValue(), caption);
      await page.locator('#modal-root [name=permission]').check();
      await submitDialog();
      await page.getByText(caption, { exact: true }).waitFor();
    };
    await upload(
      'grooming.png',
      'image/png',
      Buffer.from(png, 'base64'),
      'Luna after a gentle groom.',
    );
    const webm = await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 120;
      const ctx = canvas.getContext('2d');
      const stream = canvas.captureStream(15);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      const stopped = new Promise((resolve) => (recorder.onstop = resolve));
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
      const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
      return btoa(String.fromCharCode(...bytes));
    });
    await upload(
      'grooming.webm',
      'video/webm',
      Buffer.from(webm, 'base64'),
      'A little grooming moment.',
    );
    await page.locator('.gallery-card video').evaluate(async (video) => {
      video.muted = true;
      await video.play();
      video.pause();
    });
    await page.screenshot({ path: path.join(artifacts, 'shared-gallery.png'), fullPage: true });
    await clickNav('schedule');
    await page.screenshot({ path: path.join(artifacts, 'staff-schedule.png'), fullPage: true });
    assert.equal(
      await page
        .locator(
          '[data-action="availability"], [data-action="block-add"], [data-action="block-remove"]',
        )
        .count(),
      0,
    );
    await clickNav('services');
    await page.locator('[data-action="service-edit"]').first().click();
    await page.locator('#modal-root [name=price]').fill('550');
    await submitDialog();
    for (const view of [
      'overview',
      'appointments',
      'schedule',
      'pets',
      'services',
      'payments',
      'reports',
      'gallery',
      'feedback',
      'account',
    ]) {
      await clickNav(view);
      await noOverflow(`Employee ${view} desktop`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    for (const view of [
      'overview',
      'appointments',
      'schedule',
      'pets',
      'services',
      'payments',
      'reports',
      'gallery',
      'feedback',
      'account',
    ]) {
      await clickNav(view);
      await noOverflow(`Employee ${view} mobile`);
    }
    await page.screenshot({ path: path.join(artifacts, 'staff-mobile.png'), fullPage: true });
    await page.locator('.mobile-menu-toggle').click();
    await page.waitForFunction(
      () => Math.abs(document.querySelector('.sidebar').getBoundingClientRect().left) < 1,
    );
    await page.screenshot({ path: path.join(artifacts, 'mobile-navigation.png'), fullPage: true });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.main-shell').evaluate((el) => el.inert), false);
    await logout();
    await login('admin');
    await clickNav('schedule');
    await page.locator('[data-action="availability"]').click();
    await page.locator('input[name=weekday][value="1"]').check();
    await submitDialog();
    await page.locator('[data-action="shift-add"]').click();
    const employeeId = await page
      .locator('#modal-root [name=employeeId] option')
      .nth(1)
      .getAttribute('value');
    await page.locator('#modal-root [name=employeeId]').selectOption(employeeId);
    await page.locator('#modal-root [name=notes]').fill('Grooming team — morning care.');
    await submitDialog();
    assert.match(await page.locator('.shift-panel').textContent(), /9:00 AM.*5:00 PM/);
    await page.locator('[data-action="shift-edit"]').click();
    await page.locator('#modal-root [name=end]').fill('16:00');
    await submitDialog();
    await noOverflow('Administrator schedule mobile');
    await logout();
    await login('staff');
    await clickNav('schedule');
    assert.match(
      await page.locator('.shift-panel').textContent(),
      /Your assigned shift.*9:00 AM.*4:00 PM/s,
    );
    assert.equal(
      await page
        .locator(
          '[data-action="shift-add"], [data-action="shift-edit"], [data-action="shift-remove"], [data-action="availability"], [data-action="block-add"]',
        )
        .count(),
      0,
    );
    await page.screenshot({
      path: path.join(artifacts, 'employee-shifts-mobile.png'),
      fullPage: true,
    });
    await logout();
    await login('admin');
    await clickNav('schedule');
    await page.locator('[data-action="shift-remove"]').click();
    await submitDialog();
    assert.match(await page.locator('.shift-panel').textContent(), /No shifts assigned/);
    await clickNav('accounts');
    await page.locator('[data-action="user-edit"]').first().click();
    await page.keyboard.press('Escape');
    await noOverflow('Accounts mobile');
    await clickNav('reports');
    const download = page.waitForEvent('download');
    await page.locator('[data-action="report-export"]').click();
    assert.ok((await download).suggestedFilename().endsWith('.csv'));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: path.join(artifacts, 'admin-reports.png'), fullPage: true });
    await logout();
    await login('customer');
    await clickNav('appointments');
    await page.locator('[data-action="feedback-write"]').click();
    await page.locator('#modal-root [name=rating]').selectOption('5');
    await page
      .locator('#modal-root [name=comment]')
      .fill('Luna was comfortable and the team was kind.');
    await submitDialog();
    await clickNav('feedback');
    await page.getByText('Luna was comfortable and the team was kind.', { exact: true }).waitFor();
    await page.locator('[data-action="feedback-write"]').click();
    await page.locator('#modal-root [name=rating]').selectOption('4');
    await submitDialog();
    await logout();
    await login('staff');
    await clickNav('feedback');
    await page.locator('[data-action="feedback-reply"]').click();
    await page.locator('#modal-root [name=text]').fill('Thank you for trusting us with Luna.');
    await submitDialog();
    await logout();
    await login('customer');
    await clickNav('feedback');
    await page.getByText('Thank you for trusting us with Luna.', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(artifacts, 'customer-feedback.png'), fullPage: true });
    await clickNav('gallery');
    assert.equal(await page.locator('.gallery-card').count(), 2);
    assert.equal(await page.locator('[data-action="gallery-remove"]').count(), 0);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const view of [
      'overview',
      'pets',
      'book',
      'appointments',
      'payments',
      'gallery',
      'feedback',
      'account',
    ]) {
      await clickNav(view);
      await noOverflow(`Customer ${view} mobile`);
    }
    await clickNav('pets');
    await page.screenshot({ path: path.join(artifacts, 'my-pets-mobile.png'), fullPage: true });
    await clickNav('appointments');
    await page.locator('[data-action="receipt"]').click();
    assert.ok(await page.getByText('DEMO-001', { exact: true }).count());
    await page.emulateMedia({ media: 'print' });
    await page.pdf({ path: path.join(artifacts, 'receipt.pdf'), format: 'A4' });
    assert.deepEqual(errors, [], 'No browser or CSP errors');
    console.log(
      'Browser checks passed: all roles, pet login loop and welcome/skip/Escape, immediate navigation, admin shift assignment/edit/removal, employee read-only shifts, collapsible navigation, gallery photo/video playback, feedback, pets, booking, services, payments, receipts, reports, and mobile layouts.',
    );
    console.log(`Screenshots: ${artifacts}`);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    assert.ok(
      path.resolve(temporary).startsWith(path.resolve(os.tmpdir()) + path.sep) &&
        path.basename(temporary).startsWith('petserve-browser-'),
    );
    fs.rmSync(temporary, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
