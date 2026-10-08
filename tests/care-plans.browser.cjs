const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');
const { manilaNow } = require('../src/helpers');

(async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'petserve-care-browser-'));
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
  const nav = async (page, view) => {
    if (page.viewportSize().width <= 720) await page.locator('.mobile-menu-toggle').click();
    await page.locator(`.side-nav [data-view="${view}"]`).click();
    if (page.viewportSize().width <= 720)
      await page.waitForFunction(
        () => document.querySelector('.sidebar').getBoundingClientRect().right <= 1,
      );
  };
  const screenshot = async (page, filename) => {
    await page.evaluate(() => document.fonts.ready);
    if (!(await page.locator('.select-menu').count()))
      await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForFunction(
      () =>
        !document.querySelector('.select-arrow') ||
        !document
          .querySelector('.select-arrow')
          .getAnimations()
          .some((animation) => animation.playState === 'running'),
    );
    await page.screenshot({ path: path.join(artifacts, filename), fullPage: true });
  };
  try {
    for (const [page, email] of [
      [customer, 'alex@example.test'],
      [staff, 'staff@petserve.test'],
    ])
      assert.equal(
        (
          await page.request.post(`${base}/api/auth/login`, {
            data: { email, password: 'Petserve123!' },
          })
        ).status(),
        200,
      );
    const pets = [(await (await customer.request.get(`${base}/api/bootstrap`)).json()).pets[0]];
    for (const name of ['Puspu', 'Dolan', 'Oskar', 'Luna'])
      pets.push(
        (
          await (
            await customer.request.post(`${base}/api/pets`, {
              data: { name, species: name === 'Dolan' ? 'Dog' : 'Cat' },
            })
          ).json()
        ).pet,
      );
    await customer.goto(`${base}/#book`);
    await customer.locator('#booking-multiple').check();
    await customer.locator('#booking-all-pets').check();
    assert.equal(await customer.locator('.pet-option.selected').count(), 5);
    assert.equal(await customer.locator('[data-care-service=grooming]:checked').count(), 5);
    assert.match(await customer.locator('.summary-total').textContent(), /2,500.00/);
    await customer.locator('[data-service=deworming]').click();
    assert.equal(await customer.locator('[data-care-service=deworming]:checked').count(), 5);
    assert.match(await customer.locator('.summary-total').textContent(), /4,000.00/);
    await customer.locator('[data-service=deworming]').click();
    await customer.locator('#booking-all-pets').uncheck();
    assert.equal(await customer.locator('.pet-option.selected').count(), 0);
    assert.ok(await customer.locator('form[data-form=booking] [type=submit]').isDisabled());
    await customer.locator('#booking-all-pets').check();
    await customer.locator(`#care-${pets[0].id}-deworming`).check();
    await customer.locator(`#care-${pets[1].id}-vaccination`).check();
    await customer.locator(`#care-${pets[2].id}-consultation`).check();
    assert.match(await customer.locator('.summary-total').textContent(), /3,550.00/);
    assert.equal(
      await customer.locator('[data-service=deworming]').getAttribute('aria-pressed'),
      'mixed',
    );
    assert.equal(
      await customer.locator('[data-service=vaccination]').getAttribute('aria-pressed'),
      'mixed',
    );
    await customer.locator('[data-service=vaccination]').click();
    assert.equal(await customer.locator('[data-care-service=vaccination]:checked').count(), 5);
    assert.ok(await customer.locator(`#care-${pets[0].id}-deworming`).isChecked());
    assert.ok(await customer.locator(`#care-${pets[2].id}-consultation`).isChecked());
    await customer.locator('[data-service=vaccination]').click();
    assert.equal(await customer.locator('[data-care-service=vaccination]:checked').count(), 0);
    await customer.locator(`#care-${pets[1].id}-vaccination`).check();
    assert.match(await customer.locator('.summary-total').textContent(), /3,550.00/);
    await customer.locator('#field-note').fill('Bring all five pets together.');
    const date = new Date(`${manilaNow().date}T12:00Z`);
    date.setUTCDate(date.getUTCDate() + ((6 - date.getUTCDay() + 7) % 7 || 7));
    await customer.locator('#booking-date').fill(date.toISOString().slice(0, 10));
    await customer.locator('[data-time="09:00"]:not(:disabled)').click();
    assert.equal(await customer.locator('#care-plan-preview li').count(), 8);
    await customer.setViewportSize({ width: 1024, height: 900 });
    assert.ok(
      await customer.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    );
    assert.ok(
      await customer
        .locator('.pet-care-services')
        .first()
        .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    );
    await customer.setViewportSize({ width: 1440, height: 1100 });
    await screenshot(customer, 'multiple-pets-care-plan.png');
    await customer.locator('form[data-form=booking] [type=submit]').click();
    await customer.locator('.care-request-group').waitFor();
    assert.equal(await customer.locator('.care-request-group .appointment-card').count(), 8);
    assert.match(
      await customer.locator('.care-request-heading h2').textContent(),
      /5 pets.*8 service/,
    );
    await staff.goto(`${base}/#appointments`);
    await staff.locator('.care-request-heading [data-status=confirmed]').click();
    assert.equal(await staff.locator('.care-review-list li').count(), 8);
    await staff.locator('#modal-root [type=submit]').click();
    await staff.locator('.modal-card').waitFor({ state: 'detached' });
    await staff.waitForFunction(() =>
      [...document.querySelectorAll('.care-request-group .status')].every(
        (element) => element.textContent.trim() === 'Confirmed',
      ),
    );
    await screenshot(staff, 'staff-care-request.png');
    const appointments = (await (await customer.request.get(`${base}/api/bootstrap`)).json())
      .appointments;
    assert.equal(appointments.length, 8);
    assert.ok(
      appointments.every(
        (item) => item.status === 'confirmed' && item.note === 'Bring all five pets together.',
      ),
    );
    assert.deepEqual(
      appointments
        .filter((item) => item.petIds.includes(pets[0].id))
        .map((item) => item.serviceId)
        .sort(),
      ['deworming', 'grooming'],
    );
    await nav(customer, 'account');
    const theme = customer.getByRole('combobox', { name: 'Color theme' });
    await customer.locator('form[data-form=account] [name=name]').fill('An unsaved name stays');
    const alignment = await theme.evaluate((button) => {
      const box = button.getBoundingClientRect(),
        arrow = button.querySelector('.select-arrow').getBoundingClientRect();
      return {
        inset: box.right - arrow.right,
        offset: Math.abs((box.top + box.bottom) / 2 - (arrow.top + arrow.bottom) / 2),
      };
    });
    assert.ok(
      alignment.inset >= 12 && alignment.offset < 1,
      'The arrow is padded and vertically centered',
    );
    await theme.click();
    await customer.waitForFunction(
      () =>
        new DOMMatrix(
          getComputedStyle(document.querySelector('.select-expanded .select-arrow')).transform,
        ).a < -0.99,
    );
    await customer.getByRole('option', { name: 'Midnight dark', exact: true }).click();
    assert.equal(await customer.locator('#theme-select').inputValue(), 'dark');
    assert.equal(await customer.locator('html').getAttribute('data-theme'), 'dark');
    assert.equal(
      await customer.locator('form[data-form=account] [name=name]').inputValue(),
      'An unsaved name stays',
    );
    await theme.press('Enter');
    await theme.press('End');
    await theme.press('ArrowUp');
    await theme.press('Enter');
    assert.equal(await customer.locator('#theme-select').inputValue(), 'sage');
    await theme.click();
    await theme.press('Escape');
    assert.equal(await customer.locator('.select-menu').count(), 0);
    await nav(customer, 'pets');
    await customer.locator('[data-action=pet-add]').first().click();
    const species = customer.getByRole('combobox', { name: 'Species', exact: true });
    await species.click();
    await customer.getByRole('option', { name: 'Cat', exact: true }).click();
    assert.equal(await customer.locator('#modal-root [name=species]').inputValue(), 'Cat');
    await species.click();
    await species.press('Escape');
    assert.equal(
      await customer.locator('.modal-card').count(),
      1,
      'Escape closes the options before the dialog',
    );
    await species.press('Escape');
    await customer.locator('.modal-card').waitFor({ state: 'detached' });
    await customer.setViewportSize({ width: 390, height: 844 });
    await nav(customer, 'book');
    await customer.locator('#booking-multiple').check();
    await customer.locator('#booking-all-pets').check();
    assert.ok(
      await customer.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    );
    await screenshot(customer, 'multiple-pets-care-mobile.png');
    await nav(customer, 'account');
    await theme.click();
    await customer.getByRole('option', { name: 'Midnight dark', exact: true }).click();
    assert.equal(await customer.locator('#theme-select').inputValue(), 'dark');
    assert.ok(
      await customer.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    );
    await theme.click();
    await screenshot(customer, 'aligned-dropdown-mobile.png');
    await theme.press('Escape');
    await customer.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(
      await customer
        .locator('.select-arrow')
        .evaluate((element) => getComputedStyle(element).transitionDuration),
      '0s',
    );
    assert.deepEqual(errors, [], 'No browser or dropdown errors');
    console.log(
      'Care booking checks passed: select-all, individual pet services, complete previews, grouped staff confirmation, centered animated dropdowns, keyboard/Escape behavior, reduced motion and mobile layouts.',
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    assert.ok(
      path.resolve(temporary).startsWith(path.resolve(os.tmpdir()) + path.sep) &&
        path.basename(temporary).startsWith('petserve-care-browser-'),
    );
    fs.rmSync(temporary, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
