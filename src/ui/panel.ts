import { h, clear } from './h';
import type { ElementSpec, ForceState, PanelSide, UnitsMode } from '../types';
import { formatLength, formatPx } from '../util/units';
import { copyText } from '../util/clipboard';
import { showToast } from './toast';

const FORCE_STATES: ForceState[] = ['hover', 'focus', 'focus-visible', 'active', 'disabled', 'checked'];

export interface PanelApi {
  el: HTMLElement;
  render(spec: ElementSpec | null, opts: PanelRenderOpts): void;
  destroy(): void;
}

export interface PanelRenderOpts {
  side: PanelSide;
  units: UnitsMode;
  remBase: number | 'auto';
  collapsed: boolean;
  forcedStates: Set<ForceState>;
  forceSubtree: boolean;
  showTailwind: boolean;
  onCrumb: (selector: string) => void;
  onForce: (state: ForceState) => void;
  onForceSubtree: (v: boolean) => void;
  onCollapse: () => void;
  onCopySelector: () => void;
}

export function createPanel(host: ShadowRoot): PanelApi {
  const el = h('aside', { class: 'rl-panel', hidden: true });
  host.appendChild(el);
  let codeTab: 'css' | 'tw' = 'css';

  function render(spec: ElementSpec | null, opts: PanelRenderOpts): void {
    el.hidden = !spec;
    el.dataset.side = opts.side;
    el.classList.toggle('collapsed', opts.collapsed);
    if (!spec) {
      clear(el);
      return;
    }

    clear(el);
    const header = h('div', { class: 'rl-panel-header' });
    const top = h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } });
    top.append(
      h('strong', { text: `${spec.tag}${spec.id ? `#${spec.id}` : ''}` }),
      h('button', {
        type: 'button',
        text: opts.collapsed ? '›' : '‹',
        title: 'Collapse',
        on: { click: opts.onCollapse },
      }),
    );
    header.appendChild(top);

    const crumbs = h('div', { class: 'rl-crumbs' });
    spec.breadcrumb.forEach((c, i) => {
      if (i) crumbs.appendChild(document.createTextNode(' › '));
      crumbs.appendChild(
        h('button', {
          type: 'button',
          text: c,
          on: {
            click: () => opts.onCrumb(c.includes('#') ? `#${c.split('#')[1]}` : c),
          },
        }),
      );
    });
    header.appendChild(crumbs);

    const meta = [
      spec.classes.length ? `.${spec.classes.join('.')}` : '',
      spec.role ? `role=${spec.role}` : '',
      spec.ariaLabel ? `aria-label="${spec.ariaLabel}"` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    if (meta) header.appendChild(h('div', { style: { color: 'var(--rl-fg-muted)' }, text: meta }));

    if (opts.forcedStates.size) {
      header.appendChild(
        h('div', {
          text: `State: ${Array.from(opts.forcedStates).join(' ')}`,
          style: { color: 'var(--rl-accent)', fontWeight: '600' },
        }),
      );
    }

    header.appendChild(
      h('button', {
        type: 'button',
        text: 'Copy selector',
        style: { alignSelf: 'start', border: '1px solid var(--rl-border)', borderRadius: '4px', padding: '2px 8px' },
        on: {
          click: async () => {
            await copyText(spec.selector);
            opts.onCopySelector();
            showToast(host, 'Copied');
          },
        },
      }),
    );

    const body = h('div', { class: 'rl-panel-body' });

    // Notes
    if (spec.notes.spec || spec.notes.state || spec.notes.behavior || spec.notes.a11y || spec.notes.link) {
      const note = h('div', { class: 'rl-note' });
      if (spec.notes.spec) note.appendChild(h('div', { text: spec.notes.spec }));
      if (spec.notes.state) note.appendChild(h('div', { text: `State: ${spec.notes.state}` }));
      if (spec.notes.behavior) note.appendChild(h('div', { text: `Behavior: ${spec.notes.behavior}` }));
      if (spec.notes.a11y) note.appendChild(h('div', { text: `A11y: ${spec.notes.a11y}` }));
      if (spec.notes.link) {
        note.appendChild(
          h('a', {
            href: spec.notes.link,
            target: '_blank',
            rel: 'noopener',
            text: spec.notes.link,
            style: { color: 'inherit' },
          }),
        );
      }
      body.appendChild(note);
    }

    body.appendChild(
      section('Size and box', [
        row('W × H', `${formatPx(spec.rect.width)} × ${formatPx(spec.rect.height)}`),
        row('Page x/y', `${spec.rect.pageX}, ${spec.rect.pageY}`),
        row('box-sizing', spec.box.boxSizing),
        row('padding', sides(spec.box.padding, opts.units, opts.remBase)),
        row('margin', sides(spec.box.margin, opts.units, opts.remBase)),
        row(
          'border',
          `${sides(spec.box.border, 'px', opts.remBase)}`,
        ),
        ...(spec.effects.transformed
          ? [
              row('transformed', `scale ${spec.effects.scaleFactor?.toFixed(2)}`),
              row(
                'layout size',
                `${formatPx(spec.effects.layoutSize?.width ?? 0)} × ${formatPx(spec.effects.layoutSize?.height ?? 0)}`,
              ),
            ]
          : []),
      ]),
    );

    if (spec.typography) {
      const t = spec.typography;
      body.appendChild(
        section('Typography', [
          row('family', t.fontFamily),
          row('rendered', t.renderedFont ?? '—'),
          row('size', `${formatPx(t.fontSize.px)}px · ${t.fontSize.rem}rem`),
          row('weight', `${t.fontWeight.value} ${t.fontWeight.name}`),
          row('line-height', `${formatPx(t.lineHeight.px)}px · ${t.lineHeight.unitless}`),
          row('letter-spacing', `${t.letterSpacing.px}px · ${t.letterSpacing.em}em`),
          row('align', t.textAlign),
          colorRow('color', t.color),
          row('contrast', `${t.contrast.ratio}:1 ${t.contrast.aaa ? 'AAA' : t.contrast.aa ? 'AA' : 'fail'}`),
        ]),
      );
    }

    const colorRows = Object.entries(spec.colors)
      .filter(([, v]) => v && v.alpha > 0)
      .map(([k, v]) => colorRow(k, v!));
    if (colorRows.length) body.appendChild(section('Colors', colorRows));

    body.appendChild(
      section('Effects', [
        row('radius', withToken(spec.effects.borderRadius, spec.tokens['border-radius'])),
        row('shadow', withToken(spec.effects.boxShadow.join(', ') || 'none', spec.tokens['box-shadow'])),
        row('opacity', String(spec.effects.opacity)),
        ...(spec.effects.filter ? [row('filter', spec.effects.filter)] : []),
        ...(spec.effects.transform ? [row('transform', spec.effects.transform)] : []),
      ]),
    );

    const layoutRows = [
      row('display', spec.layout.display),
      row('position', spec.layout.position),
      row('z-index', spec.layout.zIndex),
      row('overflow', spec.layout.overflow),
    ];
    if (spec.layout.flex) {
      const f = spec.layout.flex;
      layoutRows.push(
        row('flex', `${f.direction} / ${f.wrap}`),
        row('justify', f.justify),
        row('align', f.alignItems),
        row('gap', `${formatPx(f.gap.row)}px / ${formatPx(f.gap.column)}px`),
      );
    }
    if (spec.layout.grid) {
      const g = spec.layout.grid;
      layoutRows.push(
        row('columns', g.templateColumns),
        row('resolved', g.resolvedColumns.map((n) => `${n}px`).join(' · ') || '—'),
        row('gap', `${formatPx(g.gap.row)}px`),
      );
    }
    if (spec.layout.childSpacing?.length) {
      layoutRows.push(row('child spacing', spec.layout.childSpacing.map((n) => `${n}px`).join(', ')));
    }
    body.appendChild(section('Layout', layoutRows));

    // States
    const chips = h('div', { class: 'rl-chips' });
    for (const s of FORCE_STATES) {
      chips.appendChild(
        h('button', {
          type: 'button',
          class: `rl-chip${opts.forcedStates.has(s) ? ' on' : ''}`,
          text: `:${s}`,
          title: 'JS-driven states and closed shadow styles are not covered',
          on: { click: () => opts.onForce(s) },
        }),
      );
    }
    const subtree = h('label', {
      style: { display: 'flex', gap: '6px', alignItems: 'center', marginTop: '6px' },
    });
    const cb = h('input', { type: 'checkbox' }) as HTMLInputElement;
    cb.checked = opts.forceSubtree;
    cb.addEventListener('change', () => opts.onForceSubtree(cb.checked));
    subtree.append(cb, document.createTextNode('Apply to subtree'));
    body.appendChild(section('States', [chips, subtree]));

    // Code
    const tabs = h('div', { class: 'rl-tabs' });
    const cssBtn = h('button', {
      type: 'button',
      class: codeTab === 'css' ? 'active' : '',
      text: 'CSS',
      on: {
        click: () => {
          codeTab = 'css';
          render(spec, opts);
        },
      },
    });
    tabs.appendChild(cssBtn);
    if (opts.showTailwind) {
      tabs.appendChild(
        h('button', {
          type: 'button',
          class: codeTab === 'tw' ? 'active' : '',
          text: 'Tailwind-ish',
          on: {
            click: () => {
              codeTab = 'tw';
              render(spec, opts);
            },
          },
        }),
      );
    }
    const code = codeTab === 'tw' ? spec.tailwindSnippet : spec.cssSnippet;
    const codeBlock = h('div', { class: 'rl-code', text: code + (codeTab === 'tw' ? '\n/* approximate */' : '') });
    const copyBtn = h('button', {
      type: 'button',
      text: 'Copy',
      style: { marginTop: '6px', border: '1px solid var(--rl-border)', borderRadius: '4px', padding: '2px 8px' },
      on: {
        click: async () => {
          await copyText(code);
          showToast(host, 'Copied');
        },
      },
    });
    body.appendChild(section('Code', [tabs, codeBlock, copyBtn]));

    el.append(header, body);
  }

  return {
    el,
    render,
    destroy() {
      el.remove();
    },
  };
}

function section(title: string, children: (HTMLElement | Node)[]): HTMLElement {
  const s = h('details', { class: 'rl-section', open: true });
  s.appendChild(h('summary', { text: title }));
  const wrap = h('div');
  for (const c of children) wrap.appendChild(c);
  s.appendChild(wrap);
  return s;
}

function row(k: string, v: string): HTMLElement {
  const el = h('div', { class: 'rl-row' });
  el.append(h('span', { class: 'k', text: k }), h('span', {
    class: 'v',
    text: v,
    title: 'Click to copy',
    on: {
      click: async () => {
        await copyText(v);
      },
    },
  }));
  return el;
}

function colorRow(k: string, c: { hex: string; rgb: string; hsl: string; token?: string; tokenMatch?: string }): HTMLElement {
  const el = h('div', { class: 'rl-row' });
  const right = h('span', { class: 'v' });
  right.appendChild(h('span', { class: 'rl-swatch', style: { background: c.hex } }));
  const label = c.token ? `${c.hex} ${c.tokenMatch === 'nearest' ? '≈' : '='} ${c.token}` : c.hex;
  right.appendChild(document.createTextNode(label));
  right.title = `${c.hex}\n${c.rgb}\n${c.hsl}`;
  right.addEventListener('click', async () => copyText(c.hex));
  el.append(h('span', { class: 'k', text: k }), right);
  return el;
}

function sides(
  s: { top: number; right: number; bottom: number; left: number },
  units: UnitsMode,
  remBase: number | 'auto',
): string {
  return [s.top, s.right, s.bottom, s.left].map((n) => formatLength(n, units === 'both' ? 'px' : units, remBase)).join(' / ');
}

function withToken(value: string, token?: string): string {
  if (!token) return value || '—';
  return `${value} = ${token}`;
}
