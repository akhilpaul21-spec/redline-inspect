import { expect, test } from '@playwright/test';

const PANEL_W = 320;

async function openPanel(page: import('@playwright/test').Page) {
  await page.evaluate(() => (window as any).__redline.toggle(true));
  await page.waitForTimeout(220);
}

async function measureGap(page: import('@playwright/test').Page) {
  return page.evaluate((panelW) => {
    const html = document.documentElement;
    const body = document.body;
    const main = (document.getElementById('app') || document.getElementById('shell') || body) as HTMLElement;
    const br = body.getBoundingClientRect();
    const mr = main.getBoundingClientRect();
    const panelLeft = window.innerWidth - panelW;
    const bodyGap = panelLeft - br.right;
    const mainGap = panelLeft - mr.right;
    return {
      rlPush: html.dataset.rlPush || '',
      pushVar: html.style.getPropertyValue('--rl-push').trim(),
      htmlWidth: parseFloat(getComputedStyle(html).width),
      bodyRight: br.right,
      mainRight: mr.right,
      panelLeft,
      bodyGap,
      mainGap,
      innerWidth: window.innerWidth,
    };
  }, PANEL_W);
}

test.describe('push mode layouts', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('fluid full-bleed: body fills up to panel with no gap', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      document.body.innerHTML = `
        <div id="app" style="min-height:100vh;background:#eef;display:flex;flex-direction:column;">
          <header style="background:#234;color:#fff;padding:12px;">Fluid header</header>
          <main style="flex:1;padding:16px;">
            <button id="cta">CTA</button>
            <p id="right-marker" style="text-align:right;margin:0;">END</p>
          </main>
        </div>`;
      document.body.style.margin = '0';
    });
    // Re-init redline after wiping body (host was removed with body children? redline-root is on html)
    await page.evaluate(async () => {
      (window as any).__redline?.destroy?.();
      const init = (window as any).__redlineInit;
      (window as any).__redline = init({ startActive: false, theme: 'dark', panelMode: 'push' });
    });

    await openPanel(page);
    const m = await measureGap(page);
    expect(m.rlPush).toBe('right');
    expect(m.pushVar).toBe('320px');
    expect(m.htmlWidth).toBeCloseTo(m.innerWidth - PANEL_W, 0);
    expect(Math.abs(m.bodyGap)).toBeLessThanOrEqual(2);
    expect(m.bodyGap).toBeGreaterThanOrEqual(-1);
  });

  test('flex app shell: no white strip between shell and panel', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      document.body.innerHTML = `
        <div id="shell" style="display:flex;height:100vh;width:100%;margin:0;">
          <nav style="width:200px;background:#111;color:#fff;flex:0 0 200px;">Nav</nav>
          <main style="flex:1;background:#fafafa;min-width:0;position:relative;">
            <button id="cta" style="position:absolute;right:8px;top:8px;">Action</button>
            <div id="fill" style="height:100%;background:linear-gradient(90deg,#cde,#cde);">Shell</div>
          </main>
        </div>`;
      document.body.style.margin = '0';
      document.documentElement.style.height = '100%';
      document.body.style.height = '100%';
    });
    await page.evaluate(() => {
      (window as any).__redline?.destroy?.();
      (window as any).__redline = (window as any).__redlineInit({
        startActive: false,
        theme: 'dark',
        panelMode: 'push',
      });
    });

    await openPanel(page);
    const m = await measureGap(page);
    expect(Math.abs(m.mainGap)).toBeLessThanOrEqual(2);
    expect(m.htmlWidth).toBeCloseTo(1280 - PANEL_W, 0);
  });

  test('fixed header + 100vw banner still leaves no body/panel gap', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      document.body.innerHTML = `
        <header id="fixed-header" style="position:fixed;top:0;left:0;width:100vw;height:48px;background:#0a0;color:#fff;z-index:10;">
          Fixed 100vw
        </header>
        <div id="app" style="margin-top:48px;min-height:80vh;background:#e8e8ff;width:100%;">
          <p style="padding:16px;">Content under fixed header</p>
          <button id="cta">CTA</button>
        </div>`;
      document.body.style.margin = '0';
    });
    await page.evaluate(() => {
      (window as any).__redline?.destroy?.();
      (window as any).__redline = (window as any).__redlineInit({
        startActive: false,
        theme: 'dark',
        panelMode: 'push',
      });
    });

    await openPanel(page);
    const m = await measureGap(page);
    expect(Math.abs(m.bodyGap)).toBeLessThanOrEqual(2);
    // html is clipped; body fills html — no double-shrink gap
    expect(m.bodyRight).toBeGreaterThan(m.innerWidth - PANEL_W - 3);
  });

  test('absolute right:0 control stays clear of panel and selectable', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      document.body.innerHTML = `
        <div id="app" style="position:relative;height:100vh;background:#f5f5f5;width:100%;">
          <button id="right-edge" style="position:absolute;right:0;top:120px;width:48px;height:48px;background:#e11;color:#fff;border:0;">E</button>
        </div>`;
      document.body.style.margin = '0';
    });
    await page.evaluate(() => {
      (window as any).__redline?.destroy?.();
      (window as any).__redline = (window as any).__redlineInit({
        startActive: false,
        theme: 'dark',
        panelMode: 'push',
      });
    });

    await openPanel(page);
    const edge = await page.evaluate((panelW) => {
      const r = document.getElementById('right-edge')!.getBoundingClientRect();
      return { right: r.right, panelLeft: window.innerWidth - panelW };
    }, PANEL_W);
    expect(edge.right).toBeLessThanOrEqual(edge.panelLeft + 1);

    const box = await page.locator('#right-edge').boundingBox();
    await page.mouse.click(box!.x + 10, box!.y + 10);
    await page.waitForTimeout(80);
    const text = await page.evaluate(() => (window as any).__redline.__shadow.textContent || '');
    expect(text).toMatch(/right-edge/);
  });

  test('closing push restores html dataset and full width', async ({ page }) => {
    await page.goto('/');
    await openPanel(page);
    expect(await page.evaluate(() => document.documentElement.dataset.rlPush)).toBe('right');
    await page.evaluate(() => (window as any).__redline.toggle(false));
    await page.waitForTimeout(220);
    const after = await page.evaluate(() => ({
      rlPush: document.documentElement.dataset.rlPush || '',
      pushVar: document.documentElement.style.getPropertyValue('--rl-push'),
      styleTag: !!document.getElementById('redline-push-style'),
      htmlWidth: parseFloat(getComputedStyle(document.documentElement).width),
      innerWidth: window.innerWidth,
    }));
    expect(after.rlPush).toBe('');
    expect(after.pushVar).toBe('');
    expect(after.styleTag).toBe(false);
    expect(after.htmlWidth).toBeCloseTo(after.innerWidth, 0);
  });

  test('panel chrome uses sans-serif', async ({ page }) => {
    await page.goto('/');
    await openPanel(page);
    const fonts = await page.evaluate(() => {
      const shadow = (window as any).__redline.__shadow as ShadowRoot;
      const chrome = shadow.querySelector('.rl-panel-chrome') as HTMLElement;
      const tab = shadow.querySelector('.rl-tabs-main button') as HTMLElement;
      return {
        chrome: getComputedStyle(chrome).fontFamily,
        tab: getComputedStyle(tab).fontFamily,
      };
    });
    const chrome = fonts.chrome.toLowerCase();
    const tab = fonts.tab.toLowerCase();
    expect(chrome).toMatch(/sans-serif|system-ui/);
    expect(tab).toMatch(/sans-serif|system-ui/);
    expect(chrome.includes('times') || chrome.includes('georgia')).toBe(false);
  });
});
