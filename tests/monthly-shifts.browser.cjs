const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');
const { manilaNow } = require('../src/helpers');

(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'petserve-shift-calendar-browser-'));
  const { server } = await createApp({ dbFile: path.join(directory, 'db.json') });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || 'chrome',
    headless: true,
  });
  const artifacts = path.join(__dirname, '..', 'artifacts', 'ui');
  fs.mkdirSync(artifacts, { recursive: true });
  const errors = [];
  const login = async (email) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
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
    await page.goto(base + '/#schedule');
    await page.locator(email === 'alex@example.test' ? '.side-nav' : '.month-calendar').waitFor();
    return page;
  };
  const choose = async (page, label, name) => {
    await page.getByRole('combobox', { name: label, exact: true }).click();
    await page.getByRole('option', { name, exact: true }).click();
  };
  const apply = async (page) => {
    await page.locator('[data-form="shift-plan"] [type="submit"]').click();
  };
  const save = async (page) => {
    await page.locator('[data-action="plan-save"]').click();
    await page.getByText('All changes saved', { exact: true }).waitFor();
  };
  const noOverflow = async (page) =>
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
      'Calendar must fit the viewport',
    );
  try {
    const admin = await login('admin@petserve.test');
    const employee = await login('staff@petserve.test');
    const customer = await login('alex@example.test');
    assert.equal(
      await customer.locator('.month-calendar').count(),
      0,
      'Customers cannot access staff schedules',
    );
    const employeeId = (await (await employee.request.get(base + '/api/bootstrap')).json()).user.id;
    const registered = await customer.request.post(base + '/api/auth/register', {
      data: {
        name: 'Second employee',
        email: 'other-staff@example.test',
        password: 'Petserve123!',
      },
    });
    const otherId = (await registered.json()).user.id;
    await admin.request.patch(base + `/api/users/${otherId}`, {
      data: { role: 'staff', disabled: false },
    });
    await admin.locator('.side-nav [data-view="schedule"]').click();
    await admin.locator('[data-action="calendar-month"][data-offset="1"]').click();
    await employee.locator('[data-action="calendar-month"][data-offset="1"]').click();
    const first = new Date(`${manilaNow().date}T12:00:00Z`);
    first.setUTCMonth(first.getUTCMonth() + 1, 1);
    const month = first.toISOString().slice(0, 7);
    const length = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
    ).getUTCDate();
    const dates = Array.from(
      { length },
      (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`,
    );
    const sunday = dates.find((date) => new Date(`${date}T12:00:00Z`).getUTCDay() === 0);
    const tuesdays = dates.filter((date) => new Date(`${date}T12:00:00Z`).getUTCDay() === 2);
    const saturday = dates.find((date) => new Date(`${date}T12:00:00Z`).getUTCDay() === 6);
    let saves = 0;
    admin.on('request', (request) => {
      if (request.url().endsWith('/api/schedule/shifts/month') && request.method() === 'POST')
        saves++;
    });

    await admin.locator('[data-action="plan-select"][data-selection="all"]').click();
    assert.equal(await admin.locator('.calendar-day[aria-pressed="true"]').count(), length);
    await admin.locator('#shift-plan-notes').fill('Regular grooming shift');
    await apply(admin);
    assert.equal(
      (await (await admin.request.get(base + '/api/bootstrap')).json()).shifts.length,
      0,
      'Previewing a month must not save it early',
    );
    await admin.locator('[data-action="plan-weekday"][data-weekday="0"]').click();
    assert.equal(
      await admin.locator('[data-action="plan-save"]').isDisabled(),
      true,
      'Apply each selected assignment before saving the month',
    );
    await choose(admin, 'Assignment', 'Rest day');
    assert.equal(await admin.locator('#shift-plan-start').isVisible(), false);
    await admin.locator('#shift-plan-notes').fill('Weekly rest day');
    await apply(admin);
    await admin.locator('[data-action="plan-weekday"][data-weekday="1"]').click();
    await choose(admin, 'Assignment', 'Working shift');
    await admin.locator('#shift-plan-start').fill('11:00');
    await admin.locator('#shift-plan-end').fill('19:00');
    await admin.locator('#shift-plan-notes').fill('Afternoon grooming');
    await apply(admin);
    await admin.locator(`[data-calendar-date="${sunday}"]`).click();
    await choose(admin, 'Assignment', 'Leave');
    await admin.locator('#shift-plan-notes').fill('Personal leave');
    await apply(admin);
    await noOverflow(admin);
    await admin.screenshot({
      path: path.join(artifacts, 'monthly-shift-planner.png'),
      fullPage: true,
    });
    await save(admin);
    assert.equal(saves, 1, 'An entire mixed month saves in one request');
    const shifts = (await (await employee.request.get(base + '/api/bootstrap')).json()).shifts;
    assert.equal(shifts.length, length);
    assert.equal(shifts.find((shift) => shift.date === sunday).notes, 'Personal leave');
    assert.equal(shifts.find((shift) => shift.date === sunday).start, '');
    assert.ok(shifts.some((shift) => shift.start === '11:00' && shift.end === '19:00'));
    await employee.evaluate(() => window.dispatchEvent(new Event('focus')));
    await employee.locator(`[data-calendar-date="${sunday}"] .calendar-assignment.leave`).waitFor();
    await employee.locator(`[data-calendar-date="${sunday}"]`).click();
    assert.match(await employee.locator('.shift-panel').textContent(), /Leave.*Personal leave/s);
    assert.equal(
      await employee
        .locator(
          '.shift-planner, [data-action^="plan-"], [data-action^="shift-"], [data-action="availability"]',
        )
        .count(),
      0,
    );

    for (const date of tuesdays.slice(0, 2))
      await admin.locator(`[data-calendar-date="${date}"]`).click();
    await choose(admin, 'Assignment', 'Working shift');
    await admin.locator('#shift-plan-start').fill('10:00');
    await admin.locator('#shift-plan-end').fill('08:00');
    await apply(admin);
    assert.match(await admin.locator('.shift-planner .form-error').innerText(), /after the start/);
    assert.equal(await admin.locator('[data-action="plan-save"]').isDisabled(), true);
    await admin.locator('#shift-plan-end').fill('18:00');
    await admin.locator('#shift-plan-notes').fill('Afternoon coverage');
    await apply(admin);
    await save(admin);
    assert.equal(saves, 2);
    const updated = (await (await employee.request.get(base + '/api/bootstrap')).json()).shifts;
    for (const shift of updated) {
      if (tuesdays.slice(0, 2).includes(shift.date)) {
        assert.equal(shift.start, '10:00');
        assert.equal(shift.notes, 'Afternoon coverage');
      } else
        assert.deepEqual(
          shift,
          shifts.find((item) => item.id === shift.id),
        );
    }

    await admin.locator(`[data-calendar-date="${tuesdays[0]}"]`).click();
    await admin.locator('#shift-plan-notes').fill('Unsaved draft');
    await apply(admin);
    await choose(admin, 'Employee', 'Second employee');
    assert.equal(await admin.locator('.calendar-assignment').count(), 0);
    assert.equal(await admin.locator('[data-action="plan-save"]').isDisabled(), true);
    await choose(admin, 'Employee', 'Clinic Staff');
    assert.equal(
      await admin.locator('[data-action="plan-save"]').isEnabled(),
      true,
      'Switching employee retains that employee’s draft',
    );
    await admin.locator('[data-action="plan-discard"]').click();
    assert.equal(await admin.locator('.calendar-day.has-draft').count(), 0);

    await admin.locator(`[data-calendar-date="${tuesdays[0]}"]`).click();
    await admin.locator('[data-action="plan-clear"]').click();
    await save(admin);
    assert.equal(
      (await (await employee.request.get(base + '/api/bootstrap')).json()).shifts.length,
      length - 1,
    );
    await employee.evaluate(() => window.dispatchEvent(new Event('focus')));
    await employee.locator(`[data-calendar-date="${tuesdays[0]}"] .calendar-unassigned`).waitFor();
    await employee.locator(`[data-calendar-date="${dates[0]}"]`).focus();
    await employee.keyboard.press('ArrowRight');
    assert.equal(
      await employee
        .locator(`[data-calendar-date="${dates[1]}"]`)
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await employee.keyboard.press('Enter');
    assert.equal(
      await employee.locator('.shift-panel').getAttribute('data-selected-date'),
      dates[1],
    );

    await admin.setViewportSize({ width: 390, height: 844 });
    await admin.waitForFunction(
      () => document.querySelector('.sidebar').getBoundingClientRect().right <= 1,
    );
    await noOverflow(admin);
    await admin.screenshot({
      path: path.join(artifacts, 'monthly-shift-planner-mobile.png'),
      fullPage: true,
    });
    for (const theme of ['dark', 'sage']) {
      await employee.evaluate((theme) => localStorage.setItem('petserve-theme', theme), theme);
      await employee.reload();
      await employee.locator('[data-action="calendar-month"][data-offset="1"]').click();
      await employee.locator(`[data-calendar-date="${sunday}"]`).click();
      await employee.setViewportSize({ width: 390, height: 844 });
      await employee.waitForFunction(
        () => document.querySelector('.sidebar').getBoundingClientRect().right <= 1,
      );
      await noOverflow(employee);
      assert.match(await employee.locator('.shift-panel').textContent(), /Personal leave/);
      await employee.screenshot({
        path: path.join(artifacts, `employee-monthly-shifts-${theme}.png`),
        fullPage: true,
      });
    }
    await admin.setViewportSize({ width: 1440, height: 1100 });
    const owner = await login('alex@example.test');
    const petId = (await (await owner.request.get(base + '/api/bootstrap')).json()).pets[0].id;
    const visit = await owner.request.post(base + '/api/appointments', {
      data: { petId, serviceId: 'grooming', date: saturday, time: '09:00' },
    });
    assert.equal(visit.status(), 201);
    const visitId = (await visit.json()).appointment.id;
    await employee.request.patch(base + `/api/appointments/${visitId}/status`, {
      data: { status: 'confirmed' },
    });
    await admin.locator('.side-nav [data-view="schedule"]').click();
    await admin.locator('[data-action="schedule-mode"][data-mode="visits"]').click();
    await admin
      .locator(`[data-calendar-date="${saturday}"] .calendar-visit-count.has-visits`)
      .waitFor();
    await admin.locator(`[data-calendar-date="${saturday}"]`).click();
    assert.equal(await admin.locator('.schedule-panel:not([hidden]) .schedule-visit').count(), 1);
    await noOverflow(admin);
    await admin.screenshot({
      path: path.join(artifacts, 'clinic-month-calendar.png'),
      fullPage: true,
    });
    await admin.locator('.schedule-visit').click();
    await admin.waitForURL('**/#appointments');
    await admin.locator('.appointment-card').waitFor();

    // A delayed schedule response must not restore the workspace after sign-out.
    await employee.setViewportSize({ width: 1440, height: 1100 });
    let releaseResponse;
    let reportCaptured;
    const captured = new Promise((resolve) => {
      reportCaptured = resolve;
    });
    const released = new Promise((resolve) => {
      releaseResponse = resolve;
    });
    let reportComplete;
    const completed = new Promise((resolve) => {
      reportComplete = resolve;
    });
    await employee.route(
      '**/api/bootstrap',
      async (route) => {
        const response = await route.fetch();
        reportCaptured();
        await released;
        await route.fulfill({ response });
        reportComplete();
      },
      { times: 1 },
    );
    await employee.locator('.side-nav [data-view="schedule"]').click();
    await captured;
    await employee.locator('.profile-mini [data-action="logout"]').click();
    await employee.locator('.logout-goodbye').waitFor();
    releaseResponse();
    await completed;
    await employee.locator('.logout-goodbye button').click();
    await employee.locator('form[data-form="auth"]').waitFor();
    assert.equal(await employee.locator('.side-nav').count(), 0);
    assert.equal((await (await employee.request.get(base + '/api/bootstrap')).json()).user, null);
    assert.deepEqual(errors, []);
    console.log(
      'Monthly shift browser checks passed: one-save mixed month, rest/leave reasons, read-only live employee updates, drafts, clearing, keyboard, themes, mobile, and clinic visits.',
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    assert.ok(
      path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep) &&
        path.basename(directory).startsWith('petserve-shift-calendar-browser-'),
    );
    fs.rmSync(directory, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
