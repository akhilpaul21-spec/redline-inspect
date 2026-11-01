import type { ElementSpec, TokenMaps } from '../types';
import type { RedlineComment } from '../comments/store';
import { buildElementSpec } from '../inspect/spec';
import { collectTokens } from '../inspect/tokens';
import { extractBreakpoints } from '../inspect/breakpoints';
import { isRedlineNode } from '../core/hit-test';

export async function buildPageReport(
  format: 'json' | 'html',
  shadowRoot: ShadowRoot | null,
  remBase: number | 'auto' = 'auto',
  comments: RedlineComment[] = [],
): Promise<Blob> {
  const tokens = collectTokens();
  const nodes: ElementSpec[] = [];
  let warning: string | undefined;
  const els = Array.from(document.querySelectorAll('body *'));
  for (const el of els) {
    if (isRedlineNode(el, shadowRoot)) continue;
    const style = getComputedStyle(el);
    if (style.display === 'none') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    nodes.push(buildElementSpec(el, tokens, remBase));
    if (nodes.length >= 5000) {
      warning = 'Capped at 5,000 nodes';
      break;
    }
  }

  const typeScale = aggregate(
    nodes.filter((n) => n.typography).map((n) => {
      const t = n.typography!;
      return `${t.renderedFont || t.fontFamily}|${t.fontSize.px}|${t.fontWeight.value}|${t.lineHeight.unitless}`;
    }),
  );
  const colorPalette = aggregate(
    nodes.flatMap((n) =>
      Object.values(n.colors)
        .filter(Boolean)
        .map((c) => c!.hex),
    ),
  );
  const spacingScale = aggregate(
    nodes.flatMap((n) => {
      const b = n.box;
      return [
        ...Object.values(b.padding),
        ...Object.values(b.margin),
        ...(n.layout.flex ? [n.layout.flex.gap.row, n.layout.flex.gap.column] : []),
        ...(n.layout.grid ? [n.layout.grid.gap.row, n.layout.grid.gap.column] : []),
      ]
        .filter((x) => x)
        .map(String);
    }),
  );

  const payload = {
    generator: 'redline@0.1.0',
    page: { url: location.href, title: document.title, exportedAt: new Date().toISOString() },
    warning,
    tokens: tokens.all,
    breakpoints: extractBreakpoints(),
    typeScale,
    colorPalette,
    spacingScale,
    comments,
    elements: nodes,
  };

  if (format === 'json') {
    return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  }

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>redline page spec</title>
<style>
body{font-family:system-ui,sans-serif;margin:24px;color:#111}
.swatches{display:flex;flex-wrap:wrap;gap:8px}
.swatch{width:64px;height:64px;border-radius:8px;border:1px solid #ddd;display:flex;align-items:flex-end;justify-content:center;font-size:10px;color:#fff;text-shadow:0 1px 2px #000}
table{border-collapse:collapse;width:100%;margin-top:12px}
td,th{border:1px solid #ddd;padding:6px;text-align:left;font-size:12px}
</style></head><body>
<h1>Page spec — ${escapeHtml(document.title)}</h1>
<p>${escapeHtml(location.href)}</p>
${warning ? `<p><strong>${escapeHtml(warning)}</strong></p>` : ''}
<h2>Palette</h2>
<div class="swatches">${colorPalette
    .map(
      ([hex, count]) =>
        `<div class="swatch" style="background:${escapeHtml(hex)}"><span>${escapeHtml(hex)} (${count})</span></div>`,
    )
    .join('')}</div>
<h2>Type scale</h2>
<ul>${typeScale.map(([k, c]) => `<li>${escapeHtml(k)} — ${c}</li>`).join('')}</ul>
<h2>Spacing scale</h2>
<ul>${spacingScale.map(([k, c]) => `<li>${escapeHtml(k)}px — ${c}</li>`).join('')}</ul>
<h2>Comments</h2>
<table><thead><tr><th>Component</th><th>Comment</th><th>Selector</th></tr></thead><tbody>
${comments
  .map(
    (c) =>
      `<tr><td>${escapeHtml(c.label)}</td><td>${escapeHtml(c.text)}</td><td>${escapeHtml(c.selector)}</td></tr>`,
  )
  .join('') || '<tr><td colspan="3">None</td></tr>'}
</tbody></table>
<h2>Notes / components</h2>
<table><thead><tr><th>Selector</th><th>Notes</th></tr></thead><tbody>
${nodes
  .filter((n) => n.notes.spec || n.classes.length)
  .slice(0, 200)
  .map(
    (n) =>
      `<tr><td>${escapeHtml(n.selector)}</td><td>${escapeHtml(n.notes.spec || n.classes.join('.'))}</td></tr>`,
  )
  .join('')}
</tbody></table>
</body></html>`;
  return new Blob([html], { type: 'text/html' });
}

function aggregate(values: string[]): Array<[string, number]> {
  const map = new Map<string, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

void (null as unknown as TokenMaps);
