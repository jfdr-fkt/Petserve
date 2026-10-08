const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');
const { manilaNow } = require('../src/helpers');

(async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'petserve-features-browser-'));
  const artifacts = path.join(__dirname, '..', 'artifacts', 'ui');
  fs.mkdirSync(artifacts, { recursive: true });
  const { server } = await createApp({ dbFile: path.join(temporary, 'db.json') });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || 'chrome',
    headless: true,
  });
  const customer = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const staff = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const base = `http://127.0.0.1:${server.address().port}`;
  const errors = [];
  for (const page of [customer, staff]) {
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('requestfailed', (request) => {
      if (request.failure()?.errorText !== 'net::ERR_ABORTED')
        errors.push(`${request.failure()?.errorText}: ${request.url()}`);
    });
  }
  const login = async (page, role) => {
    await page.goto(base);
    await page.locator('.demo-accounts summary').click();
    await page.locator(`[data-fill="${role}"]`).click();
    await page.locator('form[data-form="auth"] [type=submit]').click();
    await page.locator('.side-nav').waitFor();
  };
  const nav = async (page, view) => {
    if (page.viewportSize().width <= 720) await page.locator('.mobile-menu-toggle').click();
    await page.locator(`.side-nav [data-view="${view}"]`).click();
    await page.locator(`.side-nav [data-view="${view}"].active`).waitFor();
    if (page.viewportSize().width <= 720)
      await page.waitForFunction(
        () => document.querySelector('.sidebar').getBoundingClientRect().right <= 1,
      );
  };
  const submit = async (page) => {
    await page.locator('#modal-root [type=submit]').click();
    await page.locator('.modal-card').waitFor({ state: 'detached' });
  };
  const noOverflow = async (page, name) =>
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      ),
      `${name} has horizontal overflow`,
    );
  const capture = async (page, name) => {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(
      () =>
        document.getAnimations().every((animation) => animation.playState !== 'running') &&
        [...document.querySelectorAll('#main-content, .modal-card')].every(
          (el) => Number(getComputedStyle(el).opacity) >= 0.999,
        ),
    );
    await page.screenshot({ path: path.join(artifacts, name), fullPage: true });
  };
  try {
    await login(customer, 'customer');
    await login(staff, 'staff');
    await nav(customer, 'pets');
    await customer.locator('[data-action="pet-add"]').first().click();
    await customer.locator('#modal-root [name=name]').fill('Luna');
    await customer.locator('#modal-root [name=species]').selectOption('Cat');
    await submit(customer);
    await nav(customer, 'book');
    await customer.locator('[data-service="consultation"]').click();
    await customer.locator('.pet-option').filter({ hasText: 'Luna' }).click();
    assert.equal(await customer.locator('.pet-option.selected').count(), 2);
    assert.match(await customer.locator('.summary-total').textContent(), /700.00/);
    assert.doesNotMatch(
      await customer.locator('.booking-form').textContent(),
      /minutes|Visit length|Duration/,
    );
    const date = new Date(`${manilaNow().date}T12:00Z`);
    date.setUTCDate(date.getUTCDate() + ((6 - date.getUTCDay() + 7) % 7 || 7));
    await customer.locator('#booking-date').fill(date.toISOString().slice(0, 10));
    await customer.locator('[data-time="10:00"]:not(:disabled)').click();
    await capture(customer, 'group-consultation.png');
    await customer.locator('form[data-form="booking"] [type=submit]').click();
    await customer.locator('.appointment-card').waitFor();
    assert.match(await customer.locator('.appointment-card h3').textContent(), /Milo, Luna/);
    await nav(staff, 'appointments');
    await staff.reload();
    await staff.locator('[data-status="confirmed"]').click();
    await submit(staff);
    await staff.locator('[data-status="completed"]').click();
    await staff
      .locator('#modal-root [name=serviceNotes]')
      .fill('Milo and Luna examined together. Both comfortable.');
    await submit(staff);
    await nav(staff, 'payments');
    await staff.locator('[data-action="payment-settings"]').click();
    for (const method of ['GCash', 'Maya']) {
      await staff.locator(`#modal-root [name="${method}-enabled"]`).selectOption('true');
      await staff
        .locator(`#modal-root [name="${method}-name"]`)
        .fill('Isolated browser test account');
      await staff
        .locator(`#modal-root [name="${method}-number"]`)
        .fill(method === 'GCash' ? '09123456789' : '09987654321');
    }
    await submit(staff);
    await customer.reload();
    await customer.locator('[data-action="online-payment"]').click();
    assert.match(await customer.locator('#wallet-details').textContent(), /09123456789/);
    await customer.locator('#modal-root [name=method]').selectOption('Maya');
    assert.match(await customer.locator('#wallet-details').textContent(), /09987654321/);
    await customer.locator('#modal-root [name=reference]').fill('BROWSER-MAYA-123456');
    await capture(customer, 'customer-wallet-transfer.png');
    await submit(customer);
    await customer.getByText('Online transfer awaiting verification', { exact: true }).waitFor();
    assert.equal(await customer.locator('[data-action="receipt"]').count(), 0);
    await staff.reload();
    await staff.locator('[data-action="transfer-review"]').click();
    await staff.locator('#modal-root [name=received]').check();
    await submit(staff);
    await customer.reload();
    await customer.locator('[data-action="receipt"]').click();
    await customer.getByText('BROWSER-MAYA-123456', { exact: true }).waitFor();
    await customer.keyboard.press('Escape');
    await nav(customer, 'pets');
    for (const pet of ['Milo', 'Luna']) {
      await customer.locator('.pet-list-card').filter({ hasText: pet }).click();
      await customer.locator('[data-pet-tab="history"]').click();
      await customer
        .getByText('Milo and Luna examined together. Both comfortable.', { exact: true })
        .waitFor();
    }
    await nav(customer, 'chat');
    await customer.locator('#chat-text').fill('Can I ask about their next consultation?');
    await customer.locator('#chat-text').press('Enter');
    await customer
      .locator('.chat-message p')
      .filter({ hasText: 'Can I ask about their next consultation?' })
      .waitFor();
    await nav(staff, 'chat');
    await staff
      .locator('.chat-message p')
      .filter({ hasText: 'Can I ask about their next consultation?' })
      .waitFor();
    await customer.locator('#chat-text').fill('A draft stays while new messages arrive.');
    await staff.locator('#chat-text').fill('Of course. We can help you plan their next visit.');
    await staff.locator('form[data-form="chat"] [type=submit]').click();
    await customer
      .locator('.chat-message p')
      .filter({ hasText: 'Of course. We can help you plan their next visit.' })
      .waitFor({ timeout: 12000 });
    assert.equal(
      await customer.locator('#chat-text').inputValue(),
      'A draft stays while new messages arrive.',
    );
    await customer.locator('#chat-text').fill('');
    await capture(customer, 'customer-chat.png');
    await nav(customer, 'account');
    const draftName = 'An unsaved profile name';
    await customer.locator('form[data-form="account"] [name=name]').fill(draftName);
    await customer.locator('#theme-select').selectOption('dark');
    assert.equal(
      await customer.locator('form[data-form="account"] [name=name]').inputValue(),
      draftName,
    );
    assert.equal(await customer.locator('html').getAttribute('data-theme'), 'dark');
    await customer.reload();
    assert.equal(await customer.locator('html').getAttribute('data-theme'), 'dark');
    await nav(customer, 'overview');
    await capture(customer, 'dark-overview.png');
    await nav(customer, 'book');
    await capture(customer, 'dark-booking.png');
    await nav(customer, 'account');
    await customer.locator('#theme-select').selectOption('sage');
    await capture(customer, 'sage-account.png');
    await customer.locator('#theme-select').selectOption('system');
    await customer.emulateMedia({ colorScheme: 'dark' });
    await customer.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    await customer.emulateMedia({ colorScheme: 'light' });
    await customer.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    await customer.emulateMedia({ reducedMotion: 'reduce' });
    await nav(customer, 'pets');
    assert.equal(
      await customer.locator('#main-content').evaluate((el) => getComputedStyle(el).transform),
      'none',
    );
    // Reduced motion also stops the decorative loop and skips the welcome scene.
    await customer.locator('.profile-mini [data-action="logout"]').click();
    await customer.locator('.logout-goodbye').waitFor();
    assert.equal(
      await customer
        .locator('.pet-scene-goodbye')
        .evaluate((el) => el.getAnimations({ subtree: true }).length),
      0,
    );
    assert.equal(await customer.locator('.side-nav').count(), 0);
    await customer.locator('.logout-goodbye button').click();
    await customer.locator('.logout-goodbye').waitFor({ state: 'detached' });
    await customer.locator('form[data-form="auth"]').waitFor();
    assert.equal(
      await customer.locator('.scene-dog').evaluate((el) => getComputedStyle(el).animationName),
      'none',
    );
    await login(customer, 'customer');
    assert.equal(await customer.locator('.login-welcome').count(), 0);
    await nav(customer, 'pets');
    assert.equal(
      await customer.locator('#main-content').evaluate((el) => el.getAnimations().length),
      0,
    );
    await customer.setViewportSize({ width: 390, height: 844 });
    for (const view of ['book', 'payments', 'chat', 'account']) {
      await nav(customer, view);
      await noOverflow(customer, `Customer ${view}`);
    }
    await customer.locator('#theme-select').selectOption('dark');
    await nav(customer, 'chat');
    await customer.locator('.chat-message').first().waitFor();
    await capture(customer, 'dark-chat-mobile.png');
    await nav(staff, 'services');
    assert.doesNotMatch(
      await staff.locator('#main-content').textContent(),
      /minutes|Visit length|Duration/,
    );
    await staff.locator('[data-action="service-edit"]').first().click();
    assert.equal(await staff.locator('#modal-root [name=duration]').count(), 0);
    await staff.keyboard.press('Escape');
    await staff.setViewportSize({ width: 390, height: 844 });
    for (const view of ['appointments', 'payments', 'chat', 'account']) {
      await nav(staff, view);
      await noOverflow(staff, `Staff ${view}`);
    }
    assert.deepEqual(errors, [], 'No browser or CSP errors');
    console.log(
      'Feature browser checks passed: group consultation, both pet histories, Maya transfer and verification, live private chat, saved themes, reduced motion, and mobile layouts.',
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    assert.ok(
      path.resolve(temporary).startsWith(path.resolve(os.tmpdir()) + path.sep) &&
        path.basename(temporary).startsWith('petserve-features-browser-'),
    );
    fs.rmSync(temporary, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
