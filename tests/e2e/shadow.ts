import type { Page } from '@playwright/test';

/** Drive the closed shadow UI via the instance `__shadow` hook (all browsers). */

export async function shadowClick(page: Page, selector: string): Promise<void> {
  await page.evaluate((sel) => {
    const shadow = (window as any).__redline.__shadow as ShadowRoot;
    const el = shadow.querySelector(sel) as HTMLElement | null;
    if (!el) throw new Error(`shadow click missed: ${sel}`);
    el.click();
  }, selector);
}

export async function shadowFill(page: Page, selector: string, value: string): Promise<void> {
  await page.evaluate(
    ({ sel, value: v }) => {
      const shadow = (window as any).__redline.__shadow as ShadowRoot;
      const el = shadow.querySelector(sel) as HTMLTextAreaElement | HTMLInputElement | null;
      if (!el) throw new Error(`shadow fill missed: ${sel}`);
      el.focus();
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    },
    { sel: selector, value },
  );
}

export async function shadowText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const shadow = (window as any).__redline.__shadow as ShadowRoot;
    return shadow.textContent || '';
  });
}

export async function shadowCount(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    const shadow = (window as any).__redline.__shadow as ShadowRoot;
    return shadow.querySelectorAll(sel).length;
  }, selector);
}
