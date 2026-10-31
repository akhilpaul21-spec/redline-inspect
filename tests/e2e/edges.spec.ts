import { expect, test } from '@playwright/test';

test.describe('edge cases', () => {
  test('transformed badge / layout size', async ({ page }) => {
    await page.goto('/');
    const spec = await page.evaluate(() => (window as any).__redline.getSpec('#scaled'));
    expect(spec.effects.transformed).toBe(true);
    expect(spec.effects.scaleFactor).toBeCloseTo(1.5, 1);
    expect(spec.effects.layoutSize.width).toBeGreaterThan(0);
  });

  test('scroll moves overlay rect', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      (window as any).__redline.toggle(true);
      (window as any).__redline.select('#scroll-target');
    });
    const before = await page.evaluate(() => document.querySelector('#scroll-target')!.getBoundingClientRect().top);
    await page.locator('#scroll-box').evaluate((el) => {
      el.scrollTop = 80;
    });
    const after = await page.evaluate(() => document.querySelector('#scroll-target')!.getBoundingClientRect().top);
    expect(Math.abs(before - after - 80)).toBeLessThanOrEqual(2);
  });

  test('wrapped inline span has multiple client rects', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');
    const count = await page.evaluate(() => document.querySelector('#wrap-span')!.getClientRects().length);
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('same-origin iframe content selectable via API', async ({ page }) => {
    await page.goto('/');
    const text = await page.frameLocator('#same-iframe').locator('#inside').textContent();
    expect(text).toMatch(/Inside same-origin iframe/);
  });
});
