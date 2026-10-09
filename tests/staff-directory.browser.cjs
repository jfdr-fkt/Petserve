const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');

(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'petserve-staff-browser-'));
  const { server } = await createApp({ dbFile: path.join(directory, 'db.json'), demoData: true });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || 'chrome',
    headless: true,
  });
  const pages = {};
  const errors = [];
  const artifacts = path.join(__dirname, '..', 'artifacts', 'ui');
  fs.mkdirSync(artifacts, { recursive: true });
  const submit = async (page) => {
    await page.locator('#modal-root [type=submit]').click();
    await page.locator('.modal-card').waitFor({ state: 'detached' });
  };
  const checkCopy = async (page) => {
    assert.equal(await page.locator('.page-heading p, .page-heading .eyebrow').count(), 0);
    assert.doesNotMatch(
      await page.locator('body').innerText(),
      /demo|prototype|wallet options|little care milestone|little family of your own|something to look forward to|care milestones together|from fresh trims/i,
    );
  };
  try {
    for (const [role, email] of [
      ['customer', 'alex@example.test'],
      ['staff', 'staff@petserve.test'],
      ['admin', 'admin@petserve.test'],
    ]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      pages[role] = page;
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      assert.equal(
        (
          await page.request.post(base + '/api/auth/login', {
            data: { email, password: 'Petserve123!' },
          })
        ).status(),
        200,
      );
      await page.goto(base + '/#staff');
      await page.locator('.staff-card').first().waitFor();
      assert.equal(await page.locator('.side-nav [data-view=staff]').count(), 1);
      assert.equal(await page.locator('.staff-card').count(), 2);
      await checkCopy(page);
      if (role !== 'admin') assert.equal(await page.locator('[data-action^=staff-]').count(), 0);
    }
    const { admin, customer, staff } = pages;
    await admin.locator('[data-action=staff-add]').click();
    await admin.locator('[name=name]').fill('Carla Santos');
    await admin.locator('[name=position]').fill('Veterinarian');
    await submit(admin);
    assert.equal(await admin.locator('.staff-card').count(), 3);
    const card = admin.locator('.staff-card').filter({ hasText: 'Carla Santos' });
    await card.locator('[data-action=staff-edit]').click();
    await admin.locator('[name=name]').fill('Carla <b>Santos</b>');
    await admin.locator('[name=position]').fill('Senior veterinarian');
    await submit(admin);
    assert.equal(await admin.locator('.staff-identity b').count(), 0);
    for (const page of [customer, staff]) {
      await page.reload();
      const entry = page.locator('.staff-card').filter({ hasText: 'Carla <b>Santos</b>' });
      await entry.waitFor();
      assert.match(await entry.innerText(), /Senior veterinarian/);
      assert.equal(await page.locator('[data-action^=staff-]').count(), 0);
    }
    await admin.screenshot({
      path: path.join(artifacts, 'staff-list-desktop.png'),
      fullPage: true,
    });
    await admin.setViewportSize({ width: 390, height: 844 });
    await admin.waitForFunction(
      () => document.querySelector('.sidebar').getBoundingClientRect().right <= 1,
    );
    await admin.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
    await admin.waitForFunction(() => {
      const button = document.querySelector('.staff-card .btn-outline');
      const card = document.querySelector('.staff-card');
      return getComputedStyle(button).backgroundColor === getComputedStyle(card).backgroundColor;
    });
    assert.ok(
      await admin.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      ),
    );
    await admin.screenshot({ path: path.join(artifacts, 'staff-list-mobile.png'), fullPage: true });
    const updated = admin.locator('.staff-card').filter({ hasText: 'Carla <b>Santos</b>' });
    await updated.locator('[data-action=staff-remove]').click();
    await admin.locator('#modal-root [data-action=dialog-close]').first().click();
    assert.equal(await admin.locator('.staff-card').count(), 3);
    await updated.locator('[data-action=staff-remove]').click();
    await submit(admin);
    await customer.reload();
    assert.equal(await customer.locator('.staff-card').count(), 2);

    for (const page of [customer, staff]) {
      for (const view of [
        'overview',
        'pets',
        'appointments',
        'payments',
        'gallery',
        'feedback',
        'account',
        ...(page === staff ? ['services', 'schedule', 'reports'] : ['book']),
      ]) {
        await page.goto(base + '/#' + view);
        await page.locator('.page-heading h1').waitFor();
        await checkCopy(page);
      }
    }
    await customer.goto(base + '/#payments');
    await customer.locator('[data-action=receipt]').first().click();
    assert.equal(await customer.locator('.receipt-heading h2').textContent(), 'Payment receipt');
    await checkCopy(customer);
    await customer.keyboard.press('Escape');
    await customer.locator('[data-action=online-payment]').click();
    await customer.locator('#wallet-details').waitFor();
    await checkCopy(customer);
    assert.deepEqual(errors, []);
    console.log(
      'Staff directory and copy checks passed: all roles can view, administrator add/edit/remove, escaped names, saved changes, mobile/dark layout, simplified headings and payment labels.',
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    assert.ok(
      path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep) &&
        path.basename(directory).startsWith('petserve-staff-browser-'),
    );
    fs.rmSync(directory, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
