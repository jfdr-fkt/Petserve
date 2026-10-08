const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');

(async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'petserve-motion-'));
  const { server } = await createApp({ dbFile: path.join(temporary, 'db.json') });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || 'chrome',
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.locator('.demo-accounts summary').click();
    await page.locator('[data-fill="customer"]').click();
    await page.locator('form[data-form="auth"] [type=submit]').click();
    await page.locator('.login-welcome').waitFor();
    const samples = await page.evaluate(() => {
      return ['.scene-dog', '.scene-cat'].map((selector) => {
        const element = document.querySelector(`.login-welcome ${selector}`);
        const animation = element.getAnimations()[0];
        animation.pause();
        const positions = [];
        for (let time = 280; time <= 1280; time += 20) {
          animation.currentTime = time;
          positions.push(new DOMMatrix(getComputedStyle(element).transform).m41);
        }
        const velocities = positions
          .slice(1)
          .map((position, index) => (position - positions[index]) / 0.02);
        const average = velocities.reduce((sum, speed) => sum + speed, 0) / velocities.length;
        return {
          selector,
          average: Math.round(average),
          minimum: Math.round(Math.min(...velocities)),
          maximum: Math.round(Math.max(...velocities)),
        };
      });
    });
    console.log('Running motion:', samples);
    for (const sample of samples) {
      assert.ok(
        sample.minimum >= sample.average * 0.75,
        `${sample.selector} slows abruptly at intermediate keyframes`,
      );
      assert.ok(
        sample.maximum <= sample.average * 1.25,
        `${sample.selector} accelerates abruptly between intermediate keyframes`,
      );
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    assert.ok(
      path.resolve(temporary).startsWith(path.resolve(os.tmpdir()) + path.sep) &&
        path.basename(temporary).startsWith('petserve-motion-'),
    );
    fs.rmSync(temporary, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
