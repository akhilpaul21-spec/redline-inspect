export type PushSide = 'left' | 'right' | 'bottom';

export interface PagePush {
  apply(side: PushSide, px: number): void;
  clear(immediate?: boolean): void;
  destroy(): void;
  isActive(): boolean;
}

const STYLE_ID = 'redline-push-style';
const VAR = '--rl-push';

/**
 * Dock the page so a fixed panel does not cover content.
 *
 * Previous approach set margin-right on <html> AND width:calc(100% - panel)
 * on <body>, which subtracted the panel twice and left a blank gutter.
 *
 * Now we shrink <html> once to calc(100vw - panel), leave body at 100% of
 * that, and inject a stylesheet (removed on clear) so restore is exact for
 * any prior inline styles. overflow-x:clip mitigates 100vw breakouts.
 */
export function createPagePush(onSettled?: () => void): PagePush {
  let active = false;
  let timer = 0;
  let lastSide: PushSide | null = null;
  let lastPx = 0;
  let styleEl: HTMLStyleElement | null = null;
  let hadInlineVar = false;
  let prevInlineVar = '';

  function ensureStyle(): HTMLStyleElement {
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(el);
    }
    styleEl = el;
    el.textContent = `
html[data-rl-push="right"],
html[data-rl-push="left"] {
  box-sizing: border-box !important;
  width: calc(100vw - var(${VAR}, 0px)) !important;
  max-width: calc(100vw - var(${VAR}, 0px)) !important;
  overflow-x: clip !important;
  position: relative !important;
  transition: width 160ms ease, max-width 160ms ease, margin 160ms ease;
}
html[data-rl-push="right"] {
  margin-left: 0 !important;
  margin-right: 0 !important;
}
html[data-rl-push="left"] {
  /* Sit content to the right of a left-docked panel (width already excludes panel). */
  margin-left: var(${VAR}, 0px) !important;
  margin-right: 0 !important;
}
html[data-rl-push="bottom"] {
  box-sizing: border-box !important;
  margin-bottom: var(${VAR}, 0px) !important;
  transition: margin-bottom 160ms ease;
}
html[data-rl-push] body {
  box-sizing: border-box !important;
  width: 100% !important;
  max-width: 100% !important;
  position: relative !important;
}
`.trim();
    return el;
  }

  function apply(side: PushSide, px: number): void {
    const amount = Math.max(0, Math.round(px));
    if (active && lastSide === side && lastPx === amount) return;

    const html = document.documentElement;
    if (!active) {
      hadInlineVar = html.style.getPropertyValue(VAR) !== '';
      prevInlineVar = html.style.getPropertyValue(VAR);
    }

    ensureStyle();
    html.dataset.rlPush = side;
    html.style.setProperty(VAR, `${amount}px`);

    active = true;
    lastSide = side;
    lastPx = amount;

    window.clearTimeout(timer);
    timer = window.setTimeout(() => onSettled?.(), 170);
  }

  function teardown(): void {
    const html = document.documentElement;
    delete html.dataset.rlPush;
    if (hadInlineVar) html.style.setProperty(VAR, prevInlineVar);
    else html.style.removeProperty(VAR);
    styleEl?.remove();
    styleEl = null;
    hadInlineVar = false;
    prevInlineVar = '';
    active = false;
    lastSide = null;
    lastPx = 0;
  }

  function clear(immediate = false): void {
    window.clearTimeout(timer);
    if (!active) return;
    if (immediate) {
      teardown();
      onSettled?.();
      return;
    }
    // Keep stylesheet for the transition back to full width.
    const html = document.documentElement;
    html.style.setProperty(VAR, '0px');
    timer = window.setTimeout(() => {
      teardown();
      onSettled?.();
    }, 170);
  }

  function destroy(): void {
    window.clearTimeout(timer);
    if (active || styleEl) teardown();
  }

  return {
    apply,
    clear,
    destroy,
    isActive: () => active,
  };
}
