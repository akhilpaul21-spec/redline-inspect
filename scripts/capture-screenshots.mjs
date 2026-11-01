/**
 * Capture demo UI screenshots into /opt/cursor/artifacts/
 * Usage: REDLINE_DEMO_URL=http://127.0.0.1:5173 node scripts/capture-screenshots.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.REDLINE_DEMO_URL || 'http://127.0.0.1:5173';
const OUT = process.env.REDLINE_ARTIFACTS || '/opt/cursor/artifacts';

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

await page.goto(BASE + '/');
await page.waitForFunction(() => window.__redline);
await page.evaluate(() => {
  localStorage.clear();
  sessionStorage.clear();
});
await page.reload();
await page.waitForFunction(() => window.__redline);
await page.waitForTimeout(250);

// (1) FAB only
await page.screenshot({ path: `${OUT}/01-fab-only.png`, fullPage: false });
console.log('wrote', `${OUT}/01-fab-only.png`);

// Open + select CTA (push mode shifts the page)
await page.evaluate(() => {
  window.__redline.toggle(true);
  window.__redline.select('#cta');
});
await page.waitForTimeout(280);

// (2) Inspect tab with measurements + pushed page
await page.screenshot({ path: `${OUT}/02-inspect-selected.png`, fullPage: false });
console.log('wrote', `${OUT}/02-inspect-selected.png`);

// (3) Comments tab with a comment + pin
await page.evaluate(() => {
  const shadow = window.__redline.__shadow;
  shadow.querySelector('.rl-tabs-main button:nth-child(2)').click();
});
await page.waitForTimeout(100);
await page.evaluate(() => {
  const shadow = window.__redline.__shadow;
  const ta = shadow.querySelector('textarea');
  ta.value = 'CTA needs more padding on mobile';
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  shadow.querySelector('button.rl-primary').click();
});
await page.waitForTimeout(280);
await page.screenshot({ path: `${OUT}/03-comments-listed.png`, fullPage: false });
console.log('wrote', `${OUT}/03-comments-listed.png`);

// (4) Export dropdown open
await page.evaluate(() => {
  const shadow = window.__redline.__shadow;
  shadow.querySelector('.rl-export-wrap > button').click();
});
await page.waitForTimeout(150);
await page.screenshot({ path: `${OUT}/04-export-dropdown.png`, fullPage: false });
console.log('wrote', `${OUT}/04-export-dropdown.png`);

const theme = await page.evaluate(() => {
  const panel = window.__redline.__shadow.querySelector('.rl-panel');
  return {
    hostTheme: document.querySelector('redline-root')?.dataset.theme,
    bg: getComputedStyle(panel).backgroundColor,
    marginRight: document.documentElement.style.marginRight,
  };
});
console.log('verify', theme);

await browser.close();
console.log('done');
