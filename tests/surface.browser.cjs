const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');

(async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'petserve-surface-'));
  const { server } = await createApp({ dbFile: path.join(temporary, 'db.json') });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || 'chrome',
    headless: true,
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.request.post(`http://127.0.0.1:${server.address().port}/api/auth/login`, {
      data: { email: 'alex@example.test', password: 'Petserve123!' },
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const icon = page.locator('.sidebar .brand-mark');
    await icon.waitFor();
    for (let index = 0; index < 0x13; index++) await icon.click();
    assert.equal(await page.locator('.ambient-surface').count(), 0);
    await icon.click();
    await page.locator('.ambient-surface video').waitFor();
    await page.waitForFunction(
      () => document.querySelector('.ambient-surface video')?.readyState >= 2,
    );
    assert.ok(
      await page
        .locator('.ambient-surface video')
        .evaluate((video) => video.currentTime > 0 || !video.paused),
    );
    assert.ok(await page.locator('#app').evaluate((element) => element.inert));
    await page.keyboard.press('Escape');
    await page.locator('.ambient-surface').waitFor({ state: 'detached' });
    assert.ok(!(await page.locator('#app').evaluate((element) => element.inert)));
    await page.clock.install({ time: new Date('2030-01-01T00:00:00Z') });
    await page.clock.pauseAt(new Date('2030-01-01T00:00:01Z'));
    const press = async () => {
      const box = await icon.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
    };
    await press();
    await page.clock.runFor(9999);
    assert.ok(
      !(await page
        .locator('body')
        .evaluate((element) => element.classList.contains('surface-reflected'))),
    );
    await page.mouse.up();
    await page.clock.runFor(100);
    assert.ok(
      !(await page
        .locator('body')
        .evaluate((element) => element.classList.contains('surface-reflected'))),
    );
    await press();
    await page.clock.runFor(10000);
    await page.mouse.up();
    await page.clock.runFor(700);
    assert.ok(
      await page
        .locator('body')
        .evaluate((element) => element.classList.contains('surface-reflected')),
    );
    await page.locator('body').evaluate(async (element) => {
      await Promise.all(element.getAnimations().map((animation) => animation.finished));
    });
    const matrix = await page.locator('body').evaluate((element) => {
      const matrix = new DOMMatrix(getComputedStyle(element).transform);
      return [matrix.a, matrix.d];
    });
    assert.deepEqual(matrix, [-1, -1]);
    await press();
    await page.clock.runFor(10000);
    await page.mouse.up();
    await page.clock.runFor(700);
    await page.locator('body').evaluate(async (element) => {
      await Promise.all(element.getAnimations().map((animation) => animation.finished));
    });
    assert.ok(
      !(await page
        .locator('body')
        .evaluate((element) => element.classList.contains('surface-reflected'))),
    );
    assert.deepEqual(errors, []);
    console.log('Surface checks passed.');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    assert.ok(
      path.resolve(temporary).startsWith(path.resolve(os.tmpdir()) + path.sep) &&
        path.basename(temporary).startsWith('petserve-surface-'),
    );
    fs.rmSync(temporary, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
