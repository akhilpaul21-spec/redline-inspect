import { describe, expect, it } from 'vitest';
import redline from '../../plugin/vite';

describe('vite plugin', () => {
  it('injects in serve, not in build by default', () => {
    const plugin = redline();
    const cfg = { command: 'serve' as const };
    (plugin as any).configResolved?.(cfg);
    const html = '<html><body><h1>x</h1></body></html>';
    const out = (plugin as any).transformIndexHtml(html);
    expect(out).toContain('redline-inspect');

    const plugin2 = redline();
    (plugin2 as any).configResolved?.({ command: 'build' });
    const out2 = (plugin2 as any).transformIndexHtml(html);
    expect(out2).toBe(html);
  });

  it('injects in build when build:true', () => {
    const plugin = redline({ build: true });
    (plugin as any).configResolved?.({ command: 'build' });
    const html = '<html><body></body></html>';
    const out = (plugin as any).transformIndexHtml(html);
    expect(out).toContain('redline.iife.js');
  });
});
