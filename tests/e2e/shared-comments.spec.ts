import { expect, test } from '@playwright/test';
import { shadowClick, shadowFill } from './shadow';

test.describe('shared comments sync', () => {
  test('context A adds a comment that context B sees after refresh', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // Stub prompt for display name in both contexts.
    await pageA.addInitScript(() => {
      window.prompt = () => 'Alice';
    });
    await pageB.addInitScript(() => {
      window.prompt = () => 'Bob';
    });

    await pageA.goto('/sync-comments.html');
    await pageB.goto('/sync-comments.html');

    await pageA.evaluate(() => {
      (window as any).__redline.toggle(true);
      (window as any).__redline.select('#cta');
    });
    await shadowClick(pageA, '.rl-tabs-main button:nth-child(2)');
    await shadowFill(pageA, '.rl-comment-form textarea', 'Ship darker CTA');
    await shadowClick(pageA, '.rl-comment-form .rl-primary');

    // Wait for optimistic UI + remote POST.
    await expect
      .poll(async () => {
        return pageA.evaluate(() => {
          const shadow = (window as any).__redline.__shadow as ShadowRoot;
          return shadow.textContent || '';
        });
      })
      .toContain('Ship darker CTA');

    await pageB.evaluate(() => (window as any).__redline.toggle(true));
    await shadowClick(pageB, '.rl-tabs-main button:nth-child(2)');
    await shadowClick(pageB, '.rl-comment-tools button:last-child'); // Refresh

    await expect
      .poll(async () => {
        return pageB.evaluate(() => {
          const shadow = (window as any).__redline.__shadow as ShadowRoot;
          return shadow.textContent || '';
        });
      })
      .toContain('Ship darker CTA');

    await expect
      .poll(async () => {
        return pageB.evaluate(() => {
          const shadow = (window as any).__redline.__shadow as ShadowRoot;
          return shadow.textContent || '';
        });
      })
      .toContain('Alice');

    await contextA.close();
    await contextB.close();
  });
});
