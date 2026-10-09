const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createApp } = require('../server');
const { seedDatabase } = require('../src/db');
const { prepareDemoPayments } = require('../src/demo-payments');
const { manilaNow } = require('../src/helpers');

(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'petserve-dashboard-browser-'));
  const dbFile = path.join(directory, 'db.json');
  const db = await seedDatabase(dbFile);
  prepareDemoPayments(db);
  const completed = [...db.appointments];
  const added = [];
  const today = manilaNow().date;
  const dateOffset = (days) =>
    new Date(Date.parse(`${today}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
  for (const [status, date] of [
    ['pending', dateOffset(1)],
    ['confirmed', dateOffset(1)],
    ['confirmed', today],
    ['pending', dateOffset(-1)],
    ['cancelled', dateOffset(1)],
  ]) {
    const visit = { ...db.appointments[0], id: crypto.randomUUID(), status, date };
    db.appointments.push(visit);
    added.push(visit);
  }
  fs.writeFileSync(dbFile, JSON.stringify(db));
  const { server } = await createApp({ dbFile });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || 'chrome',
    headless: true,
  });
  const errors = [];
  const artifacts = path.join(__dirname, '..', 'artifacts', 'ui');
  fs.mkdirSync(artifacts, { recursive: true });
  const card = (page, label) =>
    page
      .locator('.stats-grid .stat-card')
      .filter({ has: page.locator('.stat-label', { hasText: new RegExp(`^${label}$`) }) });
  const checkView = async (page, view, title, checkFocus = true) => {
    await page.waitForURL(`**/#${view}`);
    await page.locator('.page-heading h1').filter({ hasText: title }).waitFor();
    assert.equal(new URL(page.url()).hash, `#${view}`);
    if (checkFocus)
      assert.equal(
        await page.locator('#main-content').evaluate((el) => el === document.activeElement),
        true,
      );
  };
  const overview = async (page) => {
    if (page.viewportSize().width <= 720) {
      await page.locator('.mobile-menu-toggle').click();
    }
    await page.locator('.sidebar .brand').click();
    await page.locator('.stats-grid .stat-card').first().waitFor();
  };
  const checkVisits = async (page, filter, expected, checkFocus = true) => {
    await checkView(page, 'appointments', 'appointments', checkFocus);
    assert.equal(await page.locator(`.filter-tabs [data-filter="${filter}"].active`).count(), 1);
    assert.equal(await page.locator('.appointment-card').count(), expected.length);
    const text = await page.locator('.appointment-list').textContent();
    for (const visit of expected)
      assert.ok(
        text.includes(`Visit #${visit.id.slice(0, 8).toUpperCase()}`),
        `Missing visit ${visit.id} in ${filter}`,
      );
  };
  const login = async (email) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
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
    await page.goto(base + '/#overview');
    return page;
  };
  try {
    const page = await login('alex@example.test');
    await card(page, 'My pets').click();
    await checkView(page, 'pets', 'My pets');

    for (const [label, filter, expected, target] of [
      ['Upcoming visits', 'upcoming', [added[0], added[1], added[2]], 'svg'],
      ['Completed visits', 'completed', completed, 'strong'],
      ['Awaiting review', 'pending', [added[0], added[3]], '.stat-label'],
    ]) {
      await overview(page);
      assert.equal(
        Number(await card(page, label).locator('strong').textContent()),
        expected.length,
      );
      await card(page, label).locator(target).click();
      await checkVisits(page, filter, expected);
    }
    await page.locator('.side-nav [data-view="appointments"]').click();
    await checkVisits(page, 'all', db.appointments);
    await page.locator('.filter-tabs [data-filter="confirmed"]').click();
    await checkVisits(page, 'confirmed', [added[1], added[2]], false);

    await overview(page);
    await card(page, 'Upcoming visits').focus();
    await page.keyboard.press('Enter');
    await checkVisits(page, 'upcoming', [added[0], added[1], added[2]]);
    await overview(page);
    await card(page, 'Completed visits').focus();
    await page.keyboard.press('Space');
    await checkVisits(page, 'completed', completed);

    await page.addInitScript(() => localStorage.setItem('petserve-theme', 'dark'));
    await page.goto(base + '/#overview');
    await page.reload();
    await card(page, 'My pets').waitFor();
    await page.screenshot({
      path: path.join(artifacts, 'dashboard-card-links.png'),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(
      () => document.querySelector('.sidebar').getBoundingClientRect().right <= 1,
    );
    await page.screenshot({
      path: path.join(artifacts, 'dashboard-card-links-mobile.png'),
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
      'Dashboard must fit mobile width',
    );
    await card(page, 'Completed visits').click();
    await checkVisits(page, 'completed', completed);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
      'Appointment filters must fit mobile width',
    );

    for (const email of ['staff@petserve.test', 'admin@petserve.test']) {
      const employee = await login(email);
      await card(employee, 'Pet profiles').click();
      await checkView(employee, 'pets', 'Pet records');
      await overview(employee);
      await card(employee, 'Awaiting review').click();
      await checkVisits(employee, 'pending', [added[0], added[3]]);
      await overview(employee);
      await card(employee, 'Collections').click();
      await checkView(employee, 'payments', 'Payments');
      await employee.locator('.side-nav [data-view="schedule"]').click();
      await employee.locator('#schedule-date').fill(dateOffset(1));
      await overview(employee);
      await card(employee, 'Today\u2019s visits').click();
      await checkView(employee, 'schedule', 'Schedule');
      assert.equal(
        await employee.locator('#schedule-date').inputValue(),
        today,
        'Today card must reset an earlier schedule date selection',
      );
      assert.equal(
        await employee.locator('[data-action="availability"]').count(),
        email.startsWith('admin') ? 1 : 0,
      );
    }

    await page.setViewportSize({ width: 1440, height: 1000 });
    const registered = await page.request.post(base + '/api/auth/register', {
      data: { name: 'New pet owner', email: 'new-owner@example.test', password: 'Petserve123!' },
    });
    assert.equal(registered.status(), 200);
    await page.goto(base + '/#overview');
    await page.reload();
    for (const [label, filter] of [
      ['Upcoming visits', 'upcoming'],
      ['Completed visits', 'completed'],
      ['Awaiting review', 'pending'],
    ]) {
      assert.equal(await card(page, label).locator('strong').textContent(), '0');
      await card(page, label).click();
      await checkVisits(page, filter, []);
      assert.equal(
        await page.locator('.appointment-list .empty-state h3').textContent(),
        'No appointments',
      );
      await overview(page);
    }
    await card(page, 'My pets').click();
    await checkView(page, 'pets', 'My pets');
    assert.deepEqual(errors, []);
    console.log(
      'Dashboard navigation passed: all roles, appointment filters, keyboard, mobile, and empty states.',
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    assert.ok(
      path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep) &&
        path.basename(directory).startsWith('petserve-dashboard-browser-'),
    );
    fs.rmSync(directory, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
