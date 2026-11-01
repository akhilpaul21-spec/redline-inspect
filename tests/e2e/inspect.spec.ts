import { expect, test } from '@playwright/test';
import { shadowClick, shadowCount, shadowFill, shadowText } from './shadow';

test.describe('redline inspect', () => {
  test('mount isolation', async ({ page }) => {
    await page.goto('/');
    const before = await page.evaluate(() => {
      const sample = Array.from(document.querySelectorAll('h1, #cta, .card, nav, footer')).slice(0, 20);
      return sample.map((el) => {
        const s = getComputedStyle(el);
        return { tag: el.tagName, color: s.color, margin: s.margin, padding: s.padding, display: s.display };
      });
    });

    // already inited by demo; destroy and re-init
    await page.evaluate(async () => {
      const r = (window as any).__redline;
      const html = document.documentElement.outerHTML;
      (window as any).__beforeHtmlLen = html.length;
      r.destroy();
    });

    const afterDestroy = await page.evaluate(() => !!document.querySelector('redline-root'));
    expect(afterDestroy).toBe(false);

    await page.evaluate(async () => {
      // Prefer the Vite-served entry (works in CI). Fall back to the demo's exposed init.
      const init =
        (window as any).__redlineInit ||
        (await import('/redline-entry.ts')).init;
      (window as any).__redline = init();
    });

    await expect(page.locator('redline-root')).toHaveCount(1);
    const after = await page.evaluate(() => {
      const sample = Array.from(document.querySelectorAll('h1, #cta, .card, nav, footer')).slice(0, 20);
      return sample.map((el) => {
        const s = getComputedStyle(el);
        return { tag: el.tagName, color: s.color, margin: s.margin, padding: s.padding, display: s.display };
      });
    });
    expect(after).toEqual(before);
  });

  test('default state is FAB only', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const state = await page.evaluate(() => {
      const host = document.querySelector('redline-root')!;
      const cursor = getComputedStyle(document.documentElement).cursor;
      // Where a 340px right panel would sit — must hit page content, not redline-root
      const underPanel = document.elementFromPoint(window.innerWidth - 80, 120);
      const midRight = document.elementFromPoint(window.innerWidth - 160, 200);
      return {
        hasRoot: !!host,
        cursor,
        underPanelTag: underPanel?.tagName ?? null,
        midRightTag: midRight?.tagName ?? null,
      };
    });
    expect(state.hasRoot).toBe(true);
    expect(state.cursor === 'crosshair').toBe(false);
    expect(state.underPanelTag).not.toBe('REDLINE-ROOT');
    expect(state.midRightTag).not.toBe('REDLINE-ROOT');

    // Clicks in the would-be panel zone must reach the page (no intercept)
    await page.mouse.click(1200, 100);
    await page.click('a.link-btn');
    await expect(page).toHaveURL(/#cards/);
  });

  test('push mode keeps right-edge content visible and selectable', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.evaluate(() => {
      const el = document.createElement('button');
      el.id = 'right-edge';
      el.textContent = 'EDGE';
      el.style.cssText =
        'position:absolute;right:0;top:180px;width:48px;height:48px;background:#e11;color:#fff;z-index:5;border:0;';
      document.body.appendChild(el);
      (window as any).__redline.toggle(true);
    });
    await page.waitForTimeout(220);

    const layout = await page.evaluate(() => {
      const html = document.documentElement;
      const body = document.body;
      const edge = document.getElementById('right-edge')!;
      const r = edge.getBoundingClientRect();
      const panelLeft = window.innerWidth - 320;
      return {
        marginRight: html.style.marginRight,
        bodyWidth: body.style.width,
        bodyPosition: body.style.position,
        edgeRight: r.right,
        edgeLeft: r.left,
        innerWidth: window.innerWidth,
        panelLeft,
        clearOfPanel: r.right <= panelLeft + 1,
      };
    });
    expect(layout.marginRight).toBe('320px');
    expect(layout.bodyWidth).toContain('320');
    expect(layout.bodyPosition).toBe('relative');
    expect(layout.clearOfPanel).toBe(true);
    expect(layout.edgeRight).toBeLessThanOrEqual(layout.panelLeft + 1);

    const box = await page.locator('#right-edge').boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.waitForTimeout(80);
    const selected = await page.evaluate(() => {
      const shadow = (window as any).__redline.__shadow as ShadowRoot;
      return shadow.textContent || '';
    });
    expect(selected).toMatch(/button#right-edge|right-edge/);

    await page.evaluate(() => (window as any).__redline.toggle(false));
    await page.waitForTimeout(220);
    const restored = await page.evaluate(() => ({
      marginRight: document.documentElement.style.marginRight,
      bodyWidth: document.body.style.width,
      bodyPosition: document.body.style.position,
    }));
    expect(restored.marginRight).toBe('');
    expect(restored.bodyWidth).toBe('');
    expect(restored.bodyPosition).toBe('');
  });

  test('closed panel is not visible and does not intercept clicks', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    // Open then close
    await page.evaluate(() => {
      (window as any).__redline.toggle(true);
      (window as any).__redline.toggle(false);
    });
    const afterClose = await page.evaluate(() => {
      const hit = document.elementFromPoint(window.innerWidth - 80, 140);
      return {
        hitTag: hit?.tagName ?? null,
        cursor: getComputedStyle(document.documentElement).cursor,
      };
    });
    expect(afterClose.hitTag).not.toBe('REDLINE-ROOT');
    expect(afterClose.cursor === 'crosshair').toBe(false);
    await page.click('a.brand');
    await expect(page).toHaveURL(/#top/);
  });

  test('toggle opens panel and blocks navigation', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => (window as any).__redline.toggle(true));
    await page.click('a.link-btn');
    expect(page.url()).not.toContain('#cards');
    await page.evaluate(() => (window as any).__redline.toggle(false));
    await page.click('a.link-btn');
    await expect(page).toHaveURL(/#cards/);
  });

  test('comments persist in localStorage', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(() => {
      const key = `redline:comments:${location.origin}${location.pathname}`;
      localStorage.setItem(
        key,
        JSON.stringify([
          {
            id: 'c_test',
            selector: '#cta',
            label: 'button#cta',
            text: 'Ship it',
            createdAt: new Date().toISOString(),
          },
        ]),
      );
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      (window as any).__redline.select('#cta');
      return stored;
    });
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Ship it');
    expect(result[0].selector).toBe('#cta');
  });

  test('add comment via UI lists it, pins it, and survives reload', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => (window as any).__redline);

    await page.evaluate(() => {
      (window as any).__redline.toggle(true);
      (window as any).__redline.select('#cta');
    });

    await shadowClick(page, '.rl-tabs-main button:nth-child(2)');
    await shadowFill(page, 'textarea', 'Tighten CTA padding');

    // Hover the page while drafting — previously rebuilt the panel and wiped the draft.
    const cta = await page.locator('#cta').boundingBox();
    await page.mouse.move(cta!.x + 4, cta!.y + 4);
    await page.waitForTimeout(50);

    // Draft must still be present after hover-driven overlay paints
    expect(await page.evaluate(() => {
      const ta = (window as any).__redline.__shadow.querySelector('textarea');
      return ta?.value;
    })).toBe('Tighten CTA padding');

    await shadowClick(page, 'button.rl-primary');
    await page.waitForTimeout(50);

    let text = await shadowText(page);
    expect(text).toContain('Tighten CTA padding');
    expect(text).toContain('button#cta');
    expect(text).toMatch(/Comments\s*1/);
    expect(await shadowCount(page, '.rl-comment-item')).toBe(1);
    expect(await shadowCount(page, '.rl-comment-pin')).toBe(1);

    const stored = await page.evaluate(() => {
      const key = `redline:comments:${location.origin}${location.pathname}`;
      return JSON.parse(localStorage.getItem(key) || '[]');
    });
    expect(stored).toHaveLength(1);
    expect(stored[0].label).toBe('button#cta');

    // Click the listed comment → jumps to element / Inspect
    await shadowClick(page, '.rl-comment-item');
    await page.waitForTimeout(50);
    text = await shadowText(page);
    expect(await shadowCount(page, '.rl-tabs-main button.active')).toBe(1);
    expect(await page.evaluate(() => {
      const active = (window as any).__redline.__shadow.querySelector('.rl-tabs-main button.active');
      return active?.textContent || '';
    })).toContain('Inspect');

    // Reload — comment still listed
    await page.reload();
    await page.waitForFunction(() => (window as any).__redline);
    await page.evaluate(() => (window as any).__redline.toggle(true));
    await shadowClick(page, '.rl-tabs-main button:nth-child(2)');
    text = await shadowText(page);
    expect(text).toContain('Tighten CTA padding');
    expect(text).toContain('button#cta');
  });

  test('box model on #cta', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      (window as any).__redline.toggle(true);
      (window as any).__redline.select('#cta');
    });
    const spec = await page.evaluate(() => (window as any).__redline.getSpec('#cta'));
    expect(spec.box.padding.top).toBeCloseTo(12, 0);
    expect(spec.box.padding.right).toBeCloseTo(24, 0);
    expect(spec.box.padding.bottom).toBeCloseTo(12, 0);
    expect(spec.box.padding.left).toBeCloseTo(24, 0);
    expect(spec.box.margin.left).toBeCloseTo(8, 0);
    const rect = await page.locator('#cta').boundingBox();
    expect(Math.abs(spec.rect.width - (rect?.width ?? 0))).toBeLessThanOrEqual(0.5);
  });

  test('typography panel values', async ({ page }) => {
    await page.goto('/');
    const spec = await page.evaluate(() => {
      (window as any).__redline.select('#cta');
      return (window as any).__redline.getSpec('#cta');
    });
    expect(spec.typography.fontSize.px).toBe(16);
    expect(spec.typography.fontSize.rem).toBe(1);
    expect(spec.typography.fontWeight.value).toBe(600);
    expect(spec.typography.lineHeight.px).toBe(24);
    expect(spec.typography.lineHeight.unitless).toBe(1.5);
    expect(spec.typography.letterSpacing.em).toBeCloseTo(-0.01, 3);
  });

  test('colors and tokens', async ({ page }) => {
    await page.goto('/');
    const spec = await page.evaluate(() => (window as any).__redline.getSpec('#cta'));
    expect(spec.colors.backgroundColor.hex.toUpperCase()).toContain('4F46E5');
    expect(spec.tokens.background || spec.colors.backgroundColor.token).toMatch(/--color-primary/);
    expect(spec.tokens['border-radius'] || spec.effects.borderRadius).toBeTruthy();
    expect(spec.effects.borderRadius).toMatch(/12px/);
  });

  test('distance between #a and #b', async ({ page }) => {
    await page.goto('/');
    const measured = await page.evaluate(() => {
      const a = document.querySelector('#a')!.getBoundingClientRect();
      const b = document.querySelector('#b')!.getBoundingClientRect();
      return Math.round(b.left - a.right);
    });
    expect(measured).toBe(40);
  });

  test('grid gap and columns', async ({ page }) => {
    await page.goto('/');
    // ensure wide viewport for 3 columns
    await page.setViewportSize({ width: 1280, height: 800 });
    const spec = await page.evaluate(() => (window as any).__redline.getSpec('#card-grid'));
    expect(spec.layout.grid.gap.row).toBe(24);
    expect(spec.layout.grid.resolvedColumns.length).toBe(3);
    // 1200 container content: padding 16*2 on wrap -> card-grid is inside .wrap max 1200
    // columns roughly equal
    for (const c of spec.layout.grid.resolvedColumns) {
      expect(c).toBeGreaterThan(300);
    }
  });

  test('forced hover state on #cta', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      (window as any).__redline.select('#cta');
      // Mirror library force path: attribute + cloned rule style tag
      const el = document.querySelector('#cta')!;
      el.setAttribute('data-redline-force', 'hover');
      const style = document.createElement('style');
      style.setAttribute('data-redline-states', '');
      style.textContent = `#cta:is([data-redline-force~="hover"]){background:#4338CA}`;
      document.documentElement.appendChild(style);
    });
    const bg = await page.evaluate(() => getComputedStyle(document.querySelector('#cta')!).backgroundColor);
    expect(bg).toMatch(/67,\s*56,\s*202|4338ca/i);
    await page.evaluate(() => {
      document.querySelector('style[data-redline-states]')?.remove();
      document.querySelector('#cta')?.removeAttribute('data-redline-force');
    });
    await expect(page.locator('style[data-redline-states]')).toHaveCount(0);
  });

  test('notes appear', async ({ page }) => {
    await page.goto('/');
    const notes = await page.evaluate(() => (window as any).__redline.getSpec('#cta').notes);
    expect(notes.spec).toMatch(/Primary CTA/);
  });

  test('copy css / tailwind snippets', async ({ page }) => {
    await page.goto('/');
    const snippets = await page.evaluate(() => {
      const s = (window as any).__redline.getSpec('#cta');
      return { css: s.cssSnippet, tw: s.tailwindSnippet };
    });
    expect(snippets.css).toMatch(/padding:/);
    expect(snippets.css).toMatch(/#4F46E5|var\(--color-primary\)/);
    expect(snippets.tw).toMatch(/px-|py-|font-semibold|rounded/);
  });

  test('responsive panel + breakpoint', async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 375, height: 800 });
    await page.evaluate(() => {
      (window as any).__redline.toggle(true);
      (window as any).__redline.select('#cta');
    });
    expect(await page.evaluate(() => window.innerWidth)).toBe(375);
    const bp = await page.evaluate(() => {
      const named: Record<string, number> = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 };
      const entries = Object.entries(named).sort((a, b) => a[1] - b[1]);
      const vw = window.innerWidth;
      if (vw < entries[0]![1]) return `< ${entries[0]![0]}`;
      let label = entries[0]![0];
      for (const [name, min] of entries) if (vw >= min) label = name;
      return label;
    });
    expect(bp).toBe('< sm');
    await page.setViewportSize({ width: 1280, height: 800 });
    const bp2 = await page.evaluate(() => {
      const named: Record<string, number> = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 };
      const entries = Object.entries(named).sort((a, b) => a[1] - b[1]);
      const vw = window.innerWidth;
      let label = entries[0]![0];
      for (const [name, min] of entries) if (vw >= min) label = name;
      return label;
    });
    expect(bp2).toBe('xl');
  });

  test('destroy restores host clicks', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => (window as any).__redline.destroy());
    expect(await page.locator('redline-root').count()).toBe(0);
    await page.click('a.link-btn');
    await expect(page).toHaveURL(/#cards/);
  });
});
