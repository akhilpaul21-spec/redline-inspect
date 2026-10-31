import { h } from './h';
import { viewportInfo } from '../inspect/breakpoints';
import { collectAnnotated } from '../inspect/notes';
import type { UnitsMode } from '../types';

export interface ToolbarApi {
  el: HTMLElement;
  sync(state: {
    active: boolean;
    units: UnitsMode;
    showNotes: boolean;
    showGridLines: boolean;
    breakpoints?: Record<string, number>;
  }): void;
  destroy(): void;
}

export function createToolbar(
  host: ShadowRoot,
  handlers: {
    onExit: () => void;
    onNotes: () => void;
    onGrid: () => void;
    onUnits: () => void;
    onExportAssets: () => void;
    onExportJson: () => void;
    onExportHtml: () => void;
    onHelp: () => void;
    onSelectNote: (el: Element) => void;
  },
): ToolbarApi {
  const el = h('div', { class: 'rl-pill', hidden: true });
  host.appendChild(el);

  const inspectBtn = h('button', { type: 'button', class: 'active', text: 'Inspect ●', on: { click: () => handlers.onExit() } });
  const notesBtn = h('button', { type: 'button', text: 'Notes 0' });
  const gridBtn = h('button', { type: 'button', text: 'Grid lines' });
  const unitsBtn = h('button', { type: 'button', text: 'Units both' });
  const vp = h('span', { text: '' });
  const exportBtn = h('button', { type: 'button', text: 'Export ▾' });
  const helpBtn = h('button', { type: 'button', text: '?' });

  const menu = h('div', {
    style: {
      display: 'none',
      position: 'absolute',
      top: '110%',
      right: '0',
      background: 'var(--rl-bg)',
      border: '1px solid var(--rl-border)',
      borderRadius: '8px',
      padding: '4px',
      flexDirection: 'column',
      minWidth: '160px',
    },
  });
  const mk = (label: string, fn: () => void) =>
    h('button', {
      type: 'button',
      text: label,
      style: { display: 'block', width: '100%', textAlign: 'left', padding: '4px 8px' },
      on: {
        click: () => {
          menu.style.display = 'none';
          fn();
        },
      },
    });
  menu.append(
    mk('Assets ZIP', handlers.onExportAssets),
    mk('Page spec JSON', handlers.onExportJson),
    mk('Page spec HTML', handlers.onExportHtml),
  );

  const exportWrap = h('div', { style: { position: 'relative' } }, exportBtn, menu);
  exportBtn.addEventListener('click', () => {
    menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
  });

  notesBtn.addEventListener('click', () => {
    handlers.onNotes();
    const items = collectAnnotated();
    if (!items.length) return;
    // simple list popover
    const existing = el.querySelector('.rl-notes-list');
    existing?.remove();
    const list = h('div', {
      class: 'rl-notes-list',
      style: {
        position: 'absolute',
        top: '110%',
        left: '0',
        background: 'var(--rl-bg)',
        border: '1px solid var(--rl-border)',
        borderRadius: '8px',
        padding: '4px',
        maxHeight: '240px',
        overflow: 'auto',
        minWidth: '200px',
      },
    });
    for (const item of items) {
      list.appendChild(
        h('button', {
          type: 'button',
          style: { display: 'block', width: '100%', textAlign: 'left', padding: '4px 8px' },
          text: item.getAttribute('data-spec')?.slice(0, 40) || item.tagName.toLowerCase(),
          on: {
            click: () => {
              list.remove();
              handlers.onSelectNote(item);
            },
          },
        }),
      );
    }
    el.style.position = 'fixed';
    el.appendChild(list);
  });

  gridBtn.addEventListener('click', handlers.onGrid);
  unitsBtn.addEventListener('click', handlers.onUnits);
  helpBtn.addEventListener('click', handlers.onHelp);

  el.append(inspectBtn, notesBtn, gridBtn, unitsBtn, vp, exportWrap, helpBtn);

  return {
    el,
    sync(state) {
      el.hidden = !state.active;
      const info = viewportInfo(state.breakpoints);
      const dpr = info.dpr === 1 ? '@1x' : info.dpr === 2 ? '@2x' : `@${info.dpr}x`;
      vp.textContent = `${info.width} · ${info.breakpoint} · ${dpr}${info.zoomWarn ? ' · zoom!' : ''}`;
      notesBtn.textContent = `Notes ${collectAnnotated().length}`;
      notesBtn.classList.toggle('active', state.showNotes);
      gridBtn.classList.toggle('active', state.showGridLines);
      unitsBtn.textContent = `Units ${state.units}`;
    },
    destroy() {
      el.remove();
    },
  };
}
