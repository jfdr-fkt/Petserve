const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');

(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'petserve-settings-browser-'));
  const { server } = await createApp({ dbFile: path.join(directory, 'db.json'), demoData: true });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || 'chrome',
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const staff = await browser.newPage();
  const errors = [];
  for (const target of [page, staff]) target.on('pageerror', (error) => errors.push(error.message));
  const artifacts = path.join(__dirname, '..', 'artifacts', 'ui');
  fs.mkdirSync(artifacts, { recursive: true });
  const navigate = async (view) => {
    if (page.viewportSize().width <= 720) await page.locator('.mobile-menu-toggle').click();
    await page
      .locator(view === 'overview' ? '.sidebar .brand' : `.side-nav [data-view="${view}"]`)
      .click();
  };
  const submitDialog = async (target) => {
    await target.locator('#modal-root [type=submit]').click();
    await target.locator('.modal-card').waitFor({ state: 'detached' });
  };
  try {
    await page.request.post(base + '/api/auth/login', {
      data: { email: 'alex@example.test', password: 'Petserve123!' },
    });
    await staff.request.post(base + '/api/auth/login', {
      data: { email: 'staff@petserve.test', password: 'Petserve123!' },
    });
    await page.goto(base + '/#account');
    assert.equal(await page.locator('.side-nav [data-view=overview]').count(), 0);
    assert.equal(await page.getByText('A familiar face.').count(), 0);
    assert.ok(
      await page.locator('.account-page').evaluate((element) => {
        const box = element.getBoundingClientRect(),
          content = document.querySelector('#main-content').getBoundingClientRect();
        return Math.abs((box.left + box.right) / 2 - (content.left + content.right) / 2) < 2;
      }),
    );
    await page.locator('form[data-form=account] [name=name]').fill('Alex with photo');
    const photo = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 80;
      const context = canvas.getContext('2d');
      context.fillStyle = '#315f86';
      context.fillRect(0, 0, 80, 80);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await page.locator('#account-photo').setInputFiles({
      name: 'profile.png',
      mimeType: 'image/png',
      buffer: Buffer.from(photo, 'base64'),
    });
    await page.locator('#profile-photo-editor img').waitFor();
    assert.equal(
      await page.locator('form[data-form=account] [name=name]').inputValue(),
      'Alex with photo',
    );
    await page.locator('form[data-form=account] [type=submit]').click();
    await page.locator('.profile-mini .user-avatar img').waitFor();
    assert.equal(await page.locator('.topbar .user-avatar img').count(), 1);
    await page.reload();
    await page.locator('#profile-photo-editor img').waitFor();
    assert.ok(
      await page
        .locator('.account-delete-row')
        .evaluate((element) => element.getBoundingClientRect().height < 140),
    );
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(artifacts, 'centered-account.png'), fullPage: true });
    await navigate('pets');
    await page.locator('.sidebar .brand-mark').click();
    assert.equal(await page.locator('.breadcrumb strong').textContent(), 'Overview');
    await navigate('account');
    await page.locator('[data-action=password-change]').click();
    await page.locator('[name=currentPassword]').fill('Petserve123!');
    await page.locator('[name=newPassword]').fill('Changed123!');
    await page.locator('[name=confirmPassword]').fill('Changed123!');
    await submitDialog(page);
    assert.equal((await page.request.get(base + '/api/bootstrap')).status(), 200);
    await navigate('payments');
    assert.equal(await page.locator('.payment-outstanding .payment-row').count(), 2);
    assert.equal(await page.locator('table tbody tr').count(), 3);
    await page.locator('[data-action=receipt]').first().click();
    assert.equal(await page.locator('.receipt-heading h2').textContent(), 'Payment receipt');
    await page.locator('[data-action=dialog-close]').first().click();
    await page.locator('[data-action=online-payment]').click();
    assert.match(await page.locator('#wallet-details').textContent(), /Petopia Pet Care Services/);
    assert.doesNotMatch(await page.locator('.modal-body').textContent(), /demo|prototype/i);
    await page.locator('[name=reference]').fill('DEMO-NEW-GCASH-432');
    await submitDialog(page);
    await staff.goto(base + '/#payments');
    assert.equal(await staff.locator('[data-action=transfer-review]').count(), 2);
    await staff.locator('[data-action=transfer-review]').first().click();
    await staff.locator('[name=received]').check();
    await submitDialog(staff);
    await page.reload();
    assert.equal(await page.locator('table tbody tr').count(), 4);
    await page.screenshot({ path: path.join(artifacts, 'demo-payments.png'), fullPage: true });
    await navigate('chat');
    await page.locator('#chat-text').fill('A new conversation for the demo.');
    await page.locator('form[data-form=chat] [type=submit]').click();
    await page.locator('.chat-message').waitFor();
    await page.locator('[data-action=chat-clear]').click();
    await page.locator('#modal-root [name=confirm]').check();
    await submitDialog(page);
    assert.equal(await page.locator('.chat-message').count(), 0);
    await navigate('account');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(
      () => document.querySelector('.sidebar').getBoundingClientRect().right <= 1,
    );
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({
      path: path.join(artifacts, 'centered-account-mobile.png'),
      fullPage: true,
    });
    await page.locator('[data-action=account-photo-remove]').click();
    assert.equal(await page.locator('#profile-photo-editor img').count(), 0);
    await page.locator('form[data-form=account] [type=submit]').click();
    await page.waitForFunction(() => !document.querySelector('.topbar .user-avatar img'));
    await page.request.post(base + '/api/auth/logout', { data: {} });
    await page.goto(base);
    await page.locator('[data-auth-mode=forgot]').click();
    await page.locator('form[data-form=forgot-password] [name=email]').fill('alex@example.test');
    await page.locator('form[data-form=forgot-password] [type=submit]').click();
    await page.locator('.recovery-inbox').waitFor();
    const resetPath = await page.locator('[data-action=reset-open]').getAttribute('href');
    await page.locator('[data-action=reset-open]').click();
    await page.locator('form[data-form=reset-password] [name=newPassword]').fill('Recovered123!');
    await page
      .locator('form[data-form=reset-password] [name=confirmPassword]')
      .fill('Recovered123!');
    await page.locator('form[data-form=reset-password] [type=submit]').click();
    await page.locator('.reset-ready').waitFor();
    const response = await page.request.post(base + '/api/auth/login', {
      data: { email: 'alex@example.test', password: 'Recovered123!' },
    });
    assert.equal(response.status(), 200);
    await page.request.post(base + '/api/auth/logout', { data: {} });
    await page.goto(base + resetPath);
    await page.locator('form[data-form=reset-password]').waitFor();
    await page.locator('[name=newPassword]').fill('Another123!');
    await page.locator('[name=confirmPassword]').fill('Another123!');
    await page.locator('form[data-form=reset-password] [type=submit]').click();
    await page.locator('.form-error:not([hidden])').waitFor();
    assert.match(await page.locator('.form-error').textContent(), /invalid or expired/);
    assert.deepEqual(errors, []);
    console.log(
      'Account and presentation checks passed: centered profile, saved photos and drafts, password change and recovery, brand navigation, compact removal, whole-chat deletion, sample receipts and transfer verification.',
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    assert.ok(
      path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep) &&
        path.basename(directory).startsWith('petserve-settings-browser-'),
    );
    fs.rmSync(directory, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
