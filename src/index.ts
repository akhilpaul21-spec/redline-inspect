import { configFromUrl, mergeConfig } from './config';
import { attachEvents, navigateSelection } from './core/events';
import { createStore, loadActive, saveActive } from './core/state';
import { rafThrottle } from './util/throttle';
import { buildElementSpec } from './inspect/spec';
import { collectTokens } from './inspect/tokens';
import { applyForcedStates, clearForcedStates, setPauseAnimations } from './inspect/states';
import { copyText } from './util/clipboard';
import { downloadBlob, exportAssetsZip } from './assets/zip';
import { buildPageReport } from './report/page-report';
import { mountRoot, showCheatSheet } from './ui/root';
import { createOverlay } from './ui/overlay';
import { createFab } from './ui/fab';
import { createPanel, type PanelTab } from './ui/panel';
import { showToast } from './ui/toast';
import {
  addComment,
  loadComments,
  removeComment,
  resolveCommentElement,
  type RedlineComment,
} from './comments/store';
import type { ForceState, RedlineConfig, RedlineInstance, TokenMaps, UnitsMode } from './types';

export type { RedlineConfig, RedlineInstance, ElementSpec } from './types';

let singleton: RedlineInstance | null = null;
let destroyInternal: (() => void) | null = null;

export function init(config?: RedlineConfig): RedlineInstance {
  if (singleton) return singleton;

  const urlCfg = configFromUrl();
  const cfg = mergeConfig({ ...urlCfg, ...config });
  if (!cfg.enabled) {
    const noop: RedlineInstance = {
      toggle() {},
      select() {},
      getSpec(el) {
        return buildElementSpec(resolveEl(el), collectTokens(), cfg.remBase);
      },
      async exportAssets() {
        return new Blob();
      },
      async exportReport() {
        return new Blob();
      },
      destroy() {},
    };
    singleton = noop;
    return noop;
  }

  const startOpen = !!(cfg.startActive || loadActive());
  const store = createStore({
    units: cfg.units,
    active: startOpen,
    panelOpen: startOpen,
    panelCollapsed: false,
  });

  let tokens: TokenMaps = collectTokens(cfg.tokenPrefixes);
  let comments: RedlineComment[] = loadComments();
  let panelTab: PanelTab = 'inspect';

  const root = mountRoot(cfg.theme);
  const overlay = createOverlay(root.layer);
  const panel = createPanel(root.shadow);
  const fab = cfg.showFab
    ? createFab(root.shadow, {
        position: cfg.fabPosition,
        onToggle: () => instance.toggle(),
        isOn: () => store.get().panelOpen || store.get().active,
      })
    : null;

  let altHover = false;
  let observers: Array<ResizeObserver | MutationObserver> = [];

  const refreshTokens = () => {
    tokens = collectTokens(cfg.tokenPrefixes);
  };

  const renderOverlays = rafThrottle(() => {
    const s = store.get();
    overlay.render({
      selected: s.selected,
      hovered: s.hovered,
      pinned: s.pinned,
      altHover,
      units: s.units,
      remBase: cfg.remBase,
      showNotes: s.showNotes,
      active: s.active,
      comments: s.panelOpen ? comments : [],
    });
    document.documentElement.style.cursor = s.active ? 'crosshair' : '';
    fab?.sync();

    const spec = s.selected ? buildElementSpec(s.selected, tokens, cfg.remBase) : null;
    panel.render(spec, panelOpts());
  });

  const panelOpts = () => {
    const s = store.get();
    return {
      open: s.panelOpen,
      side: cfg.panelSide,
      units: s.units,
      remBase: cfg.remBase,
      tab: panelTab,
      forcedStates: s.forcedStates,
      forceSubtree: s.forceSubtree,
      showTailwind: cfg.tailwind,
      showGridLines: s.showGridLines,
      breakpoints: cfg.breakpoints,
      comments,
      onTab: (tab: PanelTab) => {
        panelTab = tab;
        renderOverlays();
      },
      onClose: () => instance.toggle(false),
      onCrumb: (sel: string) => {
        try {
          const el = document.querySelector(sel);
          if (el) instance.select(el);
        } catch {
          /* ignore */
        }
      },
      onForce: (state: ForceState) => {
        const next = new Set(s.forcedStates);
        if (next.has(state)) next.delete(state);
        else next.add(state);
        store.set({ forcedStates: next });
        if (s.selected) applyForcedStates(s.selected, next, s.forceSubtree);
        renderOverlays();
      },
      onForceSubtree: (v: boolean) => {
        store.set({ forceSubtree: v });
        if (s.selected) applyForcedStates(s.selected, s.forcedStates, v);
        renderOverlays();
      },
      onCopySelector: () => showToast(root.shadow, 'Copied'),
      onCycleUnits: cycleUnits,
      onToggleGrid: () => {
        store.set({ showGridLines: !store.get().showGridLines });
        renderOverlays();
      },
      onHelp: () => showCheatSheet(root.shadow, () => {}),
      onExportAssets: () => void doExportAssets(),
      onExportJson: () => void doExportReport('json'),
      onExportHtml: () => void doExportReport('html'),
      onAddComment: (text: string) => {
        const el = store.get().selected;
        if (!el) return;
        comments = addComment(el, text, comments);
        panelTab = 'comments';
        showToast(root.shadow, 'Comment added');
        renderOverlays();
      },
      onDeleteComment: (id: string) => {
        comments = removeComment(id, comments);
        renderOverlays();
      },
      onSelectComment: (comment: RedlineComment) => {
        const el = resolveCommentElement(comment);
        if (!el) {
          showToast(root.shadow, 'Element not found');
          return;
        }
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        instance.select(el);
        panelTab = 'inspect';
        renderOverlays();
      },
    };
  };

  function cycleUnits(): void {
    const order: UnitsMode[] = ['px', 'rem', 'both'];
    const cur = store.get().units;
    const next = order[(order.indexOf(cur) + 1) % order.length]!;
    store.set({ units: next });
    renderOverlays();
  }

  async function doExportAssets(): Promise<Blob> {
    showToast(root.shadow, 'Collecting…', 10_000);
    try {
      const blob = await exportAssetsZip(cfg, (msg) => showToast(root.shadow, msg, 10_000), comments);
      const name =
        cfg.assets.zipName ||
        `${location.hostname || 'page'}-assets.${blob.type.includes('json') ? 'json' : 'zip'}`;
      downloadBlob(blob, name);
      showToast(root.shadow, 'Export complete');
      return blob;
    } catch (err) {
      showToast(root.shadow, 'Export failed');
      throw err;
    }
  }

  async function doExportReport(format: 'json' | 'html'): Promise<Blob> {
    const blob = await buildPageReport(format, root.shadow, cfg.remBase, comments);
    downloadBlob(blob, `page-spec.${format === 'json' ? 'json' : 'html'}`);
    showToast(root.shadow, 'Report ready');
    return blob;
  }

  function watchSelected(el: Element | null): void {
    observers.forEach((o) => o.disconnect());
    observers = [];
    if (!el) return;
    const ro = new ResizeObserver(() => renderOverlays());
    ro.observe(el);
    observers.push(ro);
    const mo = new MutationObserver(() => {
      if (!el.isConnected) {
        store.set({ selected: null });
        clearForcedStates();
        renderOverlays();
      } else renderOverlays();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    observers.push(mo);
  }

  const onScrollOrResize = rafThrottle(() => renderOverlays());
  window.addEventListener('scroll', onScrollOrResize, true);
  window.addEventListener('resize', onScrollOrResize);

  const detachEvents = attachEvents(store, {
    onToggle: () => instance.toggle(),
    onSelect: (el, pinned) => {
      if (!store.get().active) return;
      if (pinned) {
        const list = [...store.get().pinned];
        if (!list.includes(el) && list.length < 5) list.push(el);
        store.set({ pinned: list, selected: el, panelOpen: true });
      } else {
        clearForcedStates();
        store.set({ selected: el, forcedStates: new Set(), panelOpen: true });
        cfg.onSelect?.(buildElementSpec(el, tokens, cfg.remBase));
      }
      watchSelected(el);
      renderOverlays();
    },
    onHover: (el, alt) => {
      altHover = alt;
      store.set({ hovered: el });
      renderOverlays();
    },
    onExport: () => void doExportAssets(),
    onCopyCss: async () => {
      const sel = store.get().selected;
      if (!sel) return;
      const spec = buildElementSpec(sel, tokens, cfg.remBase);
      await copyText(spec.cssSnippet);
      showToast(root.shadow, 'Copied');
    },
    onCycleUnits: cycleUnits,
    onToggleGrid: () => {
      store.set({ showGridLines: !store.get().showGridLines });
      renderOverlays();
    },
    onNavigate: (dir) => {
      const next = navigateSelection(store.get().selected, dir);
      if (next) instance.select(next);
    },
    onEsc: () => {
      const s = store.get();
      if (s.selected || s.pinned.length) {
        clearForcedStates();
        store.set({ selected: null, pinned: [], forcedStates: new Set() });
        watchSelected(null);
        renderOverlays();
      } else {
        instance.toggle(false);
      }
    },
    onOpenPanel: () => {
      store.set({ panelOpen: true, active: true });
      renderOverlays();
    },
    onCheatSheet: () => showCheatSheet(root.shadow, () => {}),
    getShadowRoot: () => root.shadow,
    getIgnore: () => cfg.ignore,
    getShortcut: () => cfg.shortcut,
  });

  const onPop = () => {
    refreshTokens();
    comments = loadComments();
    store.set({ selected: null });
    clearForcedStates();
    renderOverlays();
  };
  window.addEventListener('popstate', onPop);
  const origPush = history.pushState.bind(history);
  history.pushState = function (...args) {
    const r = origPush(...args);
    onPop();
    return r;
  };

  const unsub = store.subscribe(() => {
    saveActive(store.get().active);
  });

  const instance: RedlineInstance = {
    toggle(force?: boolean) {
      const next = force ?? !store.get().panelOpen;
      if (next) {
        refreshTokens();
        comments = loadComments();
        store.set({ active: true, panelOpen: true });
      } else {
        clearForcedStates();
        store.set({
          active: false,
          panelOpen: false,
          selected: null,
          hovered: null,
          pinned: [],
          forcedStates: new Set(),
        });
        watchSelected(null);
      }
      renderOverlays();
    },
    select(el) {
      const node = resolveEl(el);
      clearForcedStates();
      store.set({
        selected: node,
        forcedStates: new Set(),
        panelOpen: true,
        active: true,
      });
      watchSelected(node);
      cfg.onSelect?.(buildElementSpec(node, tokens, cfg.remBase));
      renderOverlays();
    },
    getSpec(el) {
      return buildElementSpec(resolveEl(el), tokens, cfg.remBase);
    },
    exportAssets: doExportAssets,
    exportReport: doExportReport,
    destroy() {
      destroyInternal?.();
    },
  };

  destroyInternal = () => {
    detachEvents();
    unsub();
    window.removeEventListener('scroll', onScrollOrResize, true);
    window.removeEventListener('resize', onScrollOrResize);
    window.removeEventListener('popstate', onPop);
    history.pushState = origPush;
    onScrollOrResize.cancel();
    renderOverlays.cancel();
    observers.forEach((o) => o.disconnect());
    clearForcedStates();
    setPauseAnimations(false);
    document.documentElement.style.cursor = '';
    fab?.destroy();
    panel.destroy();
    root.destroy();
    singleton = null;
    destroyInternal = null;
  };

  renderOverlays();
  if (store.get().active) refreshTokens();

  singleton = instance;
  if (typeof window !== 'undefined') window.redline = instance;
  return instance;
}

function resolveEl(el: Element | string): Element {
  if (typeof el === 'string') {
    const found = document.querySelector(el);
    if (!found) throw new Error(`redline: no element for selector ${el}`);
    return found;
  }
  return el;
}

export function destroy(): void {
  singleton?.destroy();
}

export function toggle(force?: boolean): void {
  singleton?.toggle(force);
}
