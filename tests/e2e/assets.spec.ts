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
    const names = Object.keys(zip.files);
    expect(names.some((n) => n.includes('manifest.json'))).toBe(true);
    expect(names.some((n) => n.includes('README.txt'))).toBe(true);
    // icons / images / fonts folders may vary with naming; check kinds via manifest
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
    expect(manifest.generator).toMatch(/redline/);
    expect(manifest.assets.length).toBeGreaterThan(0);
    const files = manifest.assets.map((a: any) => a.file as string);
    expect(
      files.some((f: string) => f.startsWith('icons/') && /search|menu|close/.test(f)),
    ).toBeTruthy();
    expect(files.some((f: string) => f.includes('hero'))).toBeTruthy();
    expect(files.some((f: string) => f.includes('pattern'))).toBeTruthy();
    expect(files.some((f: string) => f.startsWith('fonts/') && f.includes('inter'))).toBeTruthy();
    // SVG sanitized
    const svgFile = files.find((f: string) => f.endsWith('.svg'));
    if (svgFile) {
      const svg = await zip.file(svgFile)!.async('string');
      expect(svg).not.toMatch(/<script/i);
    }
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
    expect(manifest.unfetchable?.length ?? 0).toBeGreaterThan(0);
    expect(['cors', 'network']).toContain(manifest.unfetchable[0].reason);
    expect(String(manifest.unfetchable[0].url)).toContain('cors-fixture.invalid');
  });
});
