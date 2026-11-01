import styles from './styles.css?raw';
import { h } from './h';

export interface RedlineRoot {
  host: HTMLElement;
  shadow: ShadowRoot;
  layer: HTMLElement;
  destroy(): void;
}

export function mountRoot(theme: 'dark' | 'light' | 'auto'): RedlineRoot {
  const existing = document.querySelector('redline-root');
  existing?.remove();

  const host = document.createElement('redline-root');
  // Host must not paint a full-viewport surface; children opt into pointer events.
  host.style.cssText =
    'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483000;background:transparent;border:none;box-shadow:none;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;';
  const shadow = host.attachShadow({ mode: 'closed' });

  const sheetOk = applyStyles(shadow, styles);
  void sheetOk;

  const root = h('div', { class: 'rl-root' });
  root.style.cssText = 'background:transparent;pointer-events:none;';
  applyTheme(host, root, theme);
  const layer = h('div', { class: 'rl-layer' });
  root.appendChild(layer);
  shadow.appendChild(root);
  document.documentElement.appendChild(host);

  const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
  const onScheme = () => {
    if (theme === 'auto') applyTheme(host, root, 'auto');
  };
  mq?.addEventListener?.('change', onScheme);

  return {
    host,
    shadow,
    layer,
    destroy() {
      mq?.removeEventListener?.('change', onScheme);
      host.remove();
    },
  };
}

function applyStyles(shadow: ShadowRoot, css: string): boolean {
  try {
    if ('adoptedStyleSheets' in shadow && typeof CSSStyleSheet !== 'undefined') {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      (shadow as any).adoptedStyleSheets = [...((shadow as any).adoptedStyleSheets ?? []), sheet];
      return true;
    }
  } catch {
    /* fall through */
  }
  const style = document.createElement('style');
  style.textContent = css;
  shadow.appendChild(style);
  return false;
}

function applyTheme(host: HTMLElement, root: HTMLElement, theme: 'dark' | 'light' | 'auto'): void {
  let t = theme;
  if (theme === 'auto') {
    t = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  host.dataset.theme = t;
  root.dataset.theme = t;
}

export function showCheatSheet(shadow: ShadowRoot, onClose: () => void): void {
  const existing = shadow.querySelector('.rl-cheat');
  existing?.remove();
  const rows: [string, string][] = [
    ['Alt+Shift+R', 'Toggle Inspect'],
    ['Esc', 'Clear selection, then exit'],
    ['Click', 'Select'],
    ['Shift+Click', 'Pin extra element'],
    ['Alt + hover', 'Distance to hovered'],
    ['↑ ↓ ← →', 'Parent / child / prev / next'],
    ['Alt+Shift+E', 'Export assets ZIP'],
    ['Alt+Shift+C', 'Copy CSS'],
    ['Alt+Shift+U', 'Cycle units'],
    ['Alt+Shift+G', 'Toggle grid lines'],
    ['?', 'This cheat sheet'],
  ];
  const table = h('table');
  for (const [k, v] of rows) {
    const tr = h('tr');
    tr.append(h('td', {}, h('kbd', { text: k })), h('td', { text: v }));
    table.appendChild(tr);
  }
  const box = h('div', { class: 'rl-cheat' }, h('h3', { text: 'redline shortcuts' }), table, h('button', {
    type: 'button',
    text: 'Close',
    style: { marginTop: '12px', border: '1px solid var(--rl-border)', borderRadius: '6px', padding: '4px 10px' },
    on: {
      click: () => {
        box.remove();
        onClose();
      },
    },
  }));
  shadow.appendChild(box);
}
