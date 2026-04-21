import { test, expect } from 'playwright/test';

const BASE_URL = 'http://localhost:3001';

test.describe('Shrimp animation – browser E2E', () => {
  test('canvas is visible and renders non-transparent pixels', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(BASE_URL);

    const canvas = page.locator('canvas#view');
    await expect(canvas).toBeVisible();

    // Wait until at least one non-transparent pixel appears (images loaded + first frame drawn)
    await page.waitForFunction(() => {
      const c = document.getElementById('view');
      if (!c) return false;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
      return false;
    }, { timeout: 8000 });

    expect(errors, `Console errors: ${errors.join(', ')}`).toHaveLength(0);
  });

  test('canvas content changes between frames – shrimp is actually moving', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(BASE_URL);

    // Wait for first frame
    await page.waitForFunction(() => {
      const c = document.getElementById('view');
      if (!c) return false;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
      return false;
    }, { timeout: 8000 });

    const snapshot1 = await page.evaluate(() =>
      document.getElementById('view').toDataURL(),
    );

    // Wait ~half a body-wave period (period ≈ 2.51 s, half ≈ 1.26 s → 600 ms is well within one half-cycle)
    await page.waitForTimeout(600);

    const snapshot2 = await page.evaluate(() =>
      document.getElementById('view').toDataURL(),
    );

    expect(snapshot1, 'Canvas did not change – shrimp appears frozen').not.toBe(snapshot2);
    expect(errors, `Console errors: ${errors.join(', ')}`).toHaveLength(0);
  });

  test('no JavaScript errors during a 2-second animation run', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);

    expect(errors, `Unexpected errors: ${errors.join(', ')}`).toHaveLength(0);
  });
});
