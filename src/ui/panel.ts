import { h, clear } from './h';
import type { ElementSpec, ForceState, PanelSide, UnitsMode } from '../types';
import type { RedlineComment } from '../comments/store';
import { formatLength, formatPx } from '../util/units';
import { copyText } from '../util/clipboard';
import { showToast } from './toast';
import { viewportInfo } from '../inspect/breakpoints';

const FORCE_STATES: ForceState[] = ['hover', 'focus', 'focus-visible', 'active', 'disabled', 'checked'];
export type PanelTab = 'inspect' | 'comments';

export interface PanelApi {
  el: HTMLElement;
  render(spec: ElementSpec | null, opts: PanelRenderOpts): void;
  destroy(): void;
}

export interface PanelRenderOpts {
  open: boolean;
  side: PanelSide;
  units: UnitsMode;
  remBase: number | 'auto';
  tab: PanelTab;
  forcedStates: Set<ForceState>;
  forceSubtree: boolean;
  showTailwind: boolean;
  showGridLines: boolean;
  breakpoints?: Record<string, number>;
  comments: RedlineComment[];
  onTab: (tab: PanelTab) => void;
  onClose: () => void;
  onCrumb: (selector: string) => void;
  onForce: (state: ForceState) => void;
  onForceSubtree: (v: boolean) => void;
  onCopySelector: () => void;
  onCycleUnits: () => void;
  onToggleGrid: () => void;
  onHelp: () => void;
  onExportAssets: () => void;
  onExportJson: () => void;
  onExportHtml: () => void;
  onAddComment: (text: string) => void;
  onDeleteComment: (id: string) => void;
  onSelectComment: (comment: RedlineComment) => void;
}

export function createPanel(host: ShadowRoot): PanelApi {
  const el = h('aside', { class: 'rl-panel', hidden: true });
  host.appendChild(el);
  let codeTab: 'css' | 'tw' = 'css';
  let exportOpen = false;

  function render(spec: ElementSpec | null, opts: PanelRenderOpts): void {
    el.hidden = !opts.open;
    el.dataset.side = opts.side;
    if (!opts.open) {
      clear(el);
      return;
    }

    clear(el);
    el.append(chrome(opts), body(spec, opts));
  }

  function chrome(opts: PanelRenderOpts): HTMLElement {
    const wrap = h('div', { class: 'rl-panel-chrome' });
    const row = h('div', { class: 'rl-chrome-row' });

    const tabs = h('div', { class: 'rl-tabs-main' });
    tabs.append(
      tabBtn('Inspect', 'inspect', opts),
      tabBtn(`Comments${opts.comments.length ? ` ${opts.comments.length}` : ''}`, 'comments', opts),
    );

    const exportWrap = h('div', { class: 'rl-export-wrap' });
    const menu = h('div', { class: `rl-export-menu${exportOpen ? ' open' : ''}` });
    const exportBtn = h('button', {
      type: 'button',
      class: 'rl-icon-btn',
      text: 'Export ▾',
      on: {
        click: (e: Event) => {
          e.stopPropagation();
          exportOpen = !exportOpen;
          menu.classList.toggle('open', exportOpen);
        },
      },
    });
    const mk = (label: string, fn: () => void) =>
      h('button', {
        type: 'button',
        text: label,
        on: {
          click: () => {
            exportOpen = false;
            fn();
          },
        },
      });
    menu.append(
      mk('Assets ZIP', opts.onExportAssets),
      mk('Page spec JSON', opts.onExportJson),
      mk('Page spec HTML', opts.onExportHtml),
    );
    exportWrap.append(exportBtn, menu);

    const closeBtn = h('button', {
      type: 'button',
      class: 'rl-icon-btn',
      text: '✕',
      title: 'Close panel',
      on: { click: opts.onClose },
    });

    row.append(tabs, exportWrap, closeBtn);
    wrap.appendChild(row);

    const info = viewportInfo(opts.breakpoints);
    const dpr = info.dpr === 1 ? '@1x' : info.dpr === 2 ? '@2x' : `@${info.dpr}x`;
    const settings = h('div', { class: 'rl-settings' });
    settings.append(
      h('button', {
        type: 'button',
        class: `rl-icon-btn${opts.showGridLines ? ' active' : ''}`,
        text: 'Grid',
        title: 'Toggle grid lines',
        on: { click: opts.onToggleGrid },
      }),
      h('button', {
        type: 'button',
        class: 'rl-icon-btn',
        text: `Units ${opts.units}`,
        on: { click: opts.onCycleUnits },
      }),
      h('span', { class: 'rl-num', text: `${info.width}×${info.height} · ${info.breakpoint} · ${dpr}` }),
      h('button', {
        type: 'button',
        class: 'rl-icon-btn',
        text: '?',
        title: 'Shortcuts',
        on: { click: opts.onHelp },
      }),
    );
    wrap.appendChild(settings);
    return wrap;
  }

  function tabBtn(label: string, tab: PanelTab, opts: PanelRenderOpts): HTMLElement {
    return h('button', {
      type: 'button',
      class: opts.tab === tab ? 'active' : '',
      text: label,
      on: {
        click: () => {
          exportOpen = false;
          opts.onTab(tab);
        },
      },
    });
  }

  function body(spec: ElementSpec | null, opts: PanelRenderOpts): HTMLElement {
    const bodyEl = h('div', { class: 'rl-panel-body' });
    if (opts.tab === 'comments') {
      bodyEl.appendChild(commentsView(spec, opts));
      return bodyEl;
    }
    if (!spec) {
      bodyEl.appendChild(h('div', { class: 'rl-empty', text: 'Click an element to inspect' }));
      return bodyEl;
    }
    bodyEl.appendChild(inspectView(spec, opts));
    return bodyEl;
  }

  function commentsView(spec: ElementSpec | null, opts: PanelRenderOpts): HTMLElement {
    const wrap = h('div');
    const form = h('div', { class: 'rl-comment-form' });
    if (spec) {
      form.appendChild(
        h('div', {
          style: { color: 'var(--rl-fg-muted)' },
          text: `On ${spec.tag}${spec.id ? `#${spec.id}` : spec.classes[0] ? `.${spec.classes[0]}` : ''}`,
        }),
      );
      const ta = h('textarea', {
        placeholder: 'Add a comment…',
      }) as HTMLTextAreaElement;
      const add = h('button', {
        type: 'button',
        class: 'rl-primary',
        text: 'Add comment',
        on: {
          click: () => {
            const text = ta.value.trim();
            if (!text) return;
            opts.onAddComment(text);
            ta.value = '';
          },
        },
      });
      form.append(ta, add);
    } else {
      form.appendChild(
        h('div', { class: 'rl-empty', text: 'Select an element to add a comment' }),
      );
    }
    wrap.appendChild(form);

    if (!opts.comments.length) {
      wrap.appendChild(h('div', { class: 'rl-empty', text: 'No comments yet' }));
      return wrap;
    }

    for (const c of [...opts.comments].reverse()) {
      const item = h('div', {
        class: 'rl-comment-item',
        on: {
          click: () => opts.onSelectComment(c),
        },
      });
      item.appendChild(h('div', { class: 'rl-comment-label', text: c.label }));
      item.appendChild(h('div', { text: c.text }));
      const meta = h('div', { class: 'rl-comment-meta' });
      meta.appendChild(h('span', { class: 'rl-mono', text: c.selector }));
      meta.appendChild(
        h('button', {
          type: 'button',
          class: 'rl-comment-delete',
          text: 'Delete',
          on: {
            click: (e: Event) => {
              e.stopPropagation();
              opts.onDeleteComment(c.id);
            },
          },
        }),
      );
      item.appendChild(meta);
      wrap.appendChild(item);
    }
    return wrap;
  }

  function inspectView(spec: ElementSpec, opts: PanelRenderOpts): DocumentFragment {
    const frag = document.createDocumentFragment();

    const header = h('div', { style: { marginBottom: '8px' } });
    header.appendChild(h('strong', { text: `${spec.tag}${spec.id ? `#${spec.id}` : ''}` }));

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
        class: 'rl-icon-btn',
        style: { marginTop: '6px' },
        on: {
          click: async () => {
            await copyText(spec.selector);
            opts.onCopySelector();
            showToast(host, 'Copied');
          },
        },
      }),
    );
    frag.appendChild(header);

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
      frag.appendChild(note);
    }

    frag.appendChild(
      section('Size and box', [
        row('W × H', `${formatPx(spec.rect.width)} × ${formatPx(spec.rect.height)}`),
        row('Page x/y', `${spec.rect.pageX}, ${spec.rect.pageY}`),
        row('box-sizing', spec.box.boxSizing),
        row('padding', sides(spec.box.padding, opts.units, opts.remBase)),
        row('margin', sides(spec.box.margin, opts.units, opts.remBase)),
        row('border', sides(spec.box.border, 'px', opts.remBase)),
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
      frag.appendChild(
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
    if (colorRows.length) frag.appendChild(section('Colors', colorRows));

    frag.appendChild(
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
    frag.appendChild(section('Layout', layoutRows));

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
    frag.appendChild(section('States', [chips, subtree]));

    const tabs = h('div', { class: 'rl-tabs' });
    tabs.appendChild(
      h('button', {
        type: 'button',
        class: codeTab === 'css' ? 'active' : '',
        text: 'CSS',
        on: {
          click: () => {
            codeTab = 'css';
            // parent re-renders via store; trigger soft refresh by copying opts
            opts.onTab(opts.tab);
          },
        },
      }),
    );
    if (opts.showTailwind) {
      tabs.appendChild(
        h('button', {
          type: 'button',
          class: codeTab === 'tw' ? 'active' : '',
          text: 'Tailwind-ish',
          on: {
            click: () => {
              codeTab = 'tw';
              opts.onTab(opts.tab);
            },
          },
        }),
      );
    }
    const code = codeTab === 'tw' ? spec.tailwindSnippet : spec.cssSnippet;
    const codeBlock = h('div', {
      class: 'rl-code',
      text: code + (codeTab === 'tw' ? '\n/* approximate */' : ''),
    });
    const copyBtn = h('button', {
      type: 'button',
      text: 'Copy',
      class: 'rl-icon-btn',
      style: { marginTop: '6px' },
      on: {
        click: async () => {
          await copyText(code);
          showToast(host, 'Copied');
        },
      },
    });
    frag.appendChild(section('Code', [tabs, codeBlock, copyBtn]));

    return frag;
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
  el.append(
    h('span', { class: 'k', text: k }),
    h('span', {
      class: 'v rl-num',
      text: v,
      title: 'Click to copy',
      on: {
        click: async () => {
          await copyText(v);
        },
      },
    }),
  );
  return el;
}

function colorRow(
  k: string,
  c: { hex: string; rgb: string; hsl: string; token?: string; tokenMatch?: string },
): HTMLElement {
  const el = h('div', { class: 'rl-row' });
  const right = h('span', { class: 'v rl-num' });
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
  return [s.top, s.right, s.bottom, s.left]
    .map((n) => formatLength(n, units === 'both' ? 'px' : units, remBase))
    .join(' / ');
}

function withToken(value: string, token?: string): string {
  if (!token) return value || '—';
  return `${value} = ${token}`;
}
