import { expect, test } from '@playwright/test';
import JSZip from 'jszip';

test.describe('asset export', () => {
  test('ZIP contains expected assets', async ({ page }) => {
    await page.goto('/');
    const buffer = await page.evaluate(async () => {
      const blob = await (window as any).__redline.exportAssets();
      const ab = await blob.arrayBuffer();
      return Array.from(new Uint8Array(ab));
    });
    const zip = await JSZip.loadAsync(new Uint8Array(buffer));
    const names = Object.keys(zip.files).filter((n) => !zip.files[n]!.dir);
    // Always-present meta files
    expect(names).toEqual(expect.arrayContaining(['manifest.json', 'README.txt', 'comments.json']));
    expect(names.some((n) => n.startsWith('icons/'))).toBe(true);
    expect(names.some((n) => n.startsWith('images/'))).toBe(true);
    expect(names.some((n) => n.startsWith('fonts/'))).toBe(true);

    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
    expect(manifest.generator).toMatch(/redline/);
    expect(manifest.assets.length).toBeGreaterThan(0);
    expect(Array.isArray(manifest.comments)).toBe(true);
    expect(Array.isArray(manifest.skipped)).toBe(true);
    const files = manifest.assets.map((a: any) => a.file as string);
    expect(
      files.some((f: string) => f.startsWith('icons/') && /search|menu|close/.test(f)),
    ).toBeTruthy();
    expect(files.some((f: string) => f.includes('hero'))).toBeTruthy();
    expect(files.some((f: string) => f.includes('pattern'))).toBeTruthy();
    expect(files.some((f: string) => f.startsWith('fonts/') && f.includes('inter'))).toBeTruthy();
    const svgFile = files.find((f: string) => f.endsWith('.svg'));
    if (svgFile) {
      const svg = await zip.file(svgFile)!.async('string');
      expect(svg).not.toMatch(/<script/i);
    }
  });

  test('Export download saves a ZIP with expected entries', async ({ page }) => {
    await page.goto('/');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.evaluate(() => (window as any).__redline.exportAssets()),
    ]);
    expect(download.suggestedFilename()).toMatch(/assets\.(zip|json)$/);
    const path = await download.path();
    expect(path).toBeTruthy();
    const fs = await import('node:fs/promises');
    const bytes = await fs.readFile(path!);
    // ZIP local file header signature
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    const zip = await JSZip.loadAsync(bytes);
    const names = Object.keys(zip.files).filter((n) => !zip.files[n]!.dir).sort();
    expect(names).toEqual(expect.arrayContaining(['manifest.json', 'README.txt', 'comments.json']));
    expect(names.some((n) => n.startsWith('icons/'))).toBe(true);
    expect(names.some((n) => n.startsWith('images/'))).toBe(true);
    expect(names.some((n) => n.startsWith('fonts/'))).toBe(true);
  });

  test('CORS unfetchable recorded', async ({ page }) => {
    // Abort so the page fetch cannot obtain bytes (simulates CORS/network failure).
    // Playwright's route.fulfill() would succeed without CORS headers, which is not realistic here.
    await page.route('https://cors-fixture.invalid/**', (route) => route.abort('timedout'));
    await page.goto('/cross-origin.html');
    const bytes = await page.evaluate(async () => {
      const blob = await (window as any).__redline.exportAssets();
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    });
    const zip = await JSZip.loadAsync(new Uint8Array(bytes));
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
    const skipped = manifest.skipped ?? manifest.unfetchable ?? [];
    expect(skipped.length).toBeGreaterThan(0);
    expect(['cors', 'network', 'timeout']).toContain(skipped[0].reason);
    expect(String(skipped[0].url)).toContain('cors-fixture.invalid');
  });

  test('hanging asset is skipped and ZIP still downloads', async ({ page }) => {
    test.setTimeout(60_000);
    // Never fulfill — export must abort ~8s and continue.
    // Use domcontentloaded below so <img> pending on this route cannot block navigation.
    await page.route('https://hang-fixture.invalid/**', () => new Promise(() => {}));
    await page.route('https://missing-fixture.invalid/**', (route) =>
      route.fulfill({ status: 404, body: 'missing' }),
    );
    await page.route('https://cors-fixture.invalid/**', (route) => route.abort('timedout'));
    await page.route('https://cors-sheet.invalid/**', (route) => route.abort('timedout'));

    await page.goto('/export-hang.html', { waitUntil: 'domcontentloaded' });

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      page.evaluate(() => (window as any).__redline.exportAssets()),
    ]);
    expect(download.suggestedFilename()).toMatch(/assets\.(zip|json)$/);

    const fs = await import('node:fs/promises');
    const bytes = await fs.readFile((await download.path())!);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);

    const zip = await JSZip.loadAsync(bytes);
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
    const skipped = manifest.skipped as Array<{ url: string; reason: string }>;
    expect(skipped.some((s) => String(s.url).includes('hang-fixture.invalid') && s.reason === 'timeout')).toBe(
      true,
    );
    expect(skipped.some((s) => String(s.url).includes('missing-fixture.invalid') && s.reason === '404')).toBe(
      true,
    );
    expect(
      skipped.some(
        (s) => String(s.url).includes('cors-fixture.invalid') && ['cors', 'network', 'timeout'].includes(s.reason),
      ),
    ).toBe(true);
    // Good local asset still packaged.
    expect(
      manifest.assets.some(
        (a: any) => String(a.file).includes('hero') || String(a.sourceUrl || '').includes('hero'),
      ),
    ).toBe(true);
  });

  test('CORS-blocked stylesheet does not break export', async ({ page }) => {
    await page.route('https://cors-sheet.invalid/**', (route) => route.abort('timedout'));
    await page.route('https://hang-fixture.invalid/**', (route) => route.abort('timedout'));
    await page.route('https://missing-fixture.invalid/**', (route) =>
      route.fulfill({ status: 404, body: 'missing' }),
    );
    await page.route('https://cors-fixture.invalid/**', (route) => route.abort('timedout'));
    await page.goto('/export-hang.html');

    const bytes = await page.evaluate(async () => {
      const blob = await (window as any).__redline.exportAssets();
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    });
    const zip = await JSZip.loadAsync(new Uint8Array(bytes));
    expect(zip.file('manifest.json')).toBeTruthy();
    // Page still has a successful same-origin image.
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
    expect(manifest.assets.length).toBeGreaterThan(0);
  });
});
