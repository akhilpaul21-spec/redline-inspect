export type PushSide = 'left' | 'right' | 'bottom';

export interface PagePush {
  apply(side: PushSide, px: number): void;
  clear(immediate?: boolean): void;
  destroy(): void;
  isActive(): boolean;
}

interface ElSaved {
  marginRight: string;
  marginLeft: string;
  marginBottom: string;
  width: string;
  maxWidth: string;
  boxSizing: string;
  position: string;
  transition: string;
  hadRight: boolean;
  hadLeft: boolean;
  hadBottom: boolean;
  hadWidth: boolean;
  hadMaxWidth: boolean;
  hadBoxSizing: boolean;
  hadPosition: boolean;
  hadTransition: boolean;
}

interface Saved {
  html: ElSaved;
  body: ElSaved;
}

const TRANSITION =
  'margin-right 160ms ease, margin-left 160ms ease, margin-bottom 160ms ease, width 160ms ease, max-width 160ms ease';

function snapEl(el: HTMLElement): ElSaved {
  const g = (p: string) => el.style.getPropertyValue(p) !== '';
  return {
    marginRight: el.style.marginRight,
    marginLeft: el.style.marginLeft,
    marginBottom: el.style.marginBottom,
    width: el.style.width,
    maxWidth: el.style.maxWidth,
    boxSizing: el.style.boxSizing,
    position: el.style.position,
    transition: el.style.transition,
    hadRight: g('margin-right'),
    hadLeft: g('margin-left'),
    hadBottom: g('margin-bottom'),
    hadWidth: g('width'),
    hadMaxWidth: g('max-width'),
    hadBoxSizing: g('box-sizing'),
    hadPosition: g('position'),
    hadTransition: g('transition'),
  };
}

function restoreProp(el: HTMLElement, prop: string, had: boolean, value: string): void {
  if (had) el.style.setProperty(prop, value);
  else el.style.removeProperty(prop);
}

function restoreEl(el: HTMLElement, s: ElSaved): void {
  restoreProp(el, 'margin-right', s.hadRight, s.marginRight);
  restoreProp(el, 'margin-left', s.hadLeft, s.marginLeft);
  restoreProp(el, 'margin-bottom', s.hadBottom, s.marginBottom);
  restoreProp(el, 'width', s.hadWidth, s.width);
  restoreProp(el, 'max-width', s.hadMaxWidth, s.maxWidth);
  restoreProp(el, 'box-sizing', s.hadBoxSizing, s.boxSizing);
  restoreProp(el, 'position', s.hadPosition, s.position);
  restoreProp(el, 'transition', s.hadTransition, s.transition);
}

/**
 * Shrinks the host page so a docked panel doesn't cover content.
 * - <html> gets margin on the docked side (gutter for the panel)
 * - <body> becomes a positioned containing block with shrunk width so
 *   absolute (and most in-flow) right/left-aligned children move with content
 * Fixed redline UI stays viewport-docked (no transform on <html>).
 */
export function createPagePush(onSettled?: () => void): PagePush {
  let saved: Saved | null = null;
  let active = false;
  let timer = 0;
  let lastSide: PushSide | null = null;
  let lastPx = 0;

  function apply(side: PushSide, px: number): void {
    const amount = Math.max(0, Math.round(px));
    if (active && lastSide === side && lastPx === amount) return;

    const html = document.documentElement;
    const body = document.body;
    if (!saved) saved = { html: snapEl(html), body: snapEl(body) };
    active = true;
    lastSide = side;
    lastPx = amount;

    html.style.transition = TRANSITION;
    body.style.transition = TRANSITION;
    body.style.boxSizing = 'border-box';
    body.style.position = 'relative';

    // Clear unused margins on html
    for (const [s, prop] of [
      ['right', 'margin-right'],
      ['left', 'margin-left'],
      ['bottom', 'margin-bottom'],
    ] as const) {
      if (side !== s) {
        const key = s === 'right' ? 'hadRight' : s === 'left' ? 'hadLeft' : 'hadBottom';
        const val =
          s === 'right' ? saved.html.marginRight : s === 'left' ? saved.html.marginLeft : saved.html.marginBottom;
        if (saved.html[key]) html.style.setProperty(prop, val);
        else html.style.removeProperty(prop);
      }
    }

    if (side === 'bottom') {
      html.style.marginBottom = `${amount}px`;
      if (!saved.body.hadWidth) body.style.removeProperty('width');
      if (!saved.body.hadMaxWidth) body.style.removeProperty('max-width');
    } else {
      html.style.setProperty(side === 'right' ? 'margin-right' : 'margin-left', `${amount}px`);
      // Shrink body so absolute right/left:0 children clear the panel gutter.
      body.style.width = `calc(100% - ${amount}px)`;
      body.style.maxWidth = `calc(100vw - ${amount}px)`;
      if (side === 'right') {
        body.style.marginRight = '0px';
        if (!saved.body.hadLeft) body.style.removeProperty('margin-left');
      } else {
        body.style.marginLeft = '0px';
        if (!saved.body.hadRight) body.style.removeProperty('margin-right');
      }
    }

    window.clearTimeout(timer);
    timer = window.setTimeout(() => onSettled?.(), 170);
  }

  function clear(immediate = false): void {
    window.clearTimeout(timer);
    lastSide = null;
    lastPx = 0;
    if (!saved) {
      active = false;
      return;
    }
    const html = document.documentElement;
    const body = document.body;
    const snap = saved;
    if (immediate) {
      restoreEl(html, snap.html);
      restoreEl(body, snap.body);
      saved = null;
      active = false;
      onSettled?.();
      return;
    }
    html.style.transition = TRANSITION;
    body.style.transition = TRANSITION;
    html.style.marginRight = snap.html.hadRight ? snap.html.marginRight : '0px';
    html.style.marginLeft = snap.html.hadLeft ? snap.html.marginLeft : '0px';
    html.style.marginBottom = snap.html.hadBottom ? snap.html.marginBottom : '0px';
    body.style.width = snap.body.hadWidth ? snap.body.width : '';
    body.style.maxWidth = snap.body.hadMaxWidth ? snap.body.maxWidth : '';
    timer = window.setTimeout(() => {
      restoreEl(html, snap.html);
      restoreEl(body, snap.body);
      saved = null;
      active = false;
      onSettled?.();
    }, 170);
  }

  function destroy(): void {
    window.clearTimeout(timer);
    if (saved) {
      restoreEl(document.documentElement, saved.html);
      restoreEl(document.body, saved.body);
    }
    saved = null;
    active = false;
    lastSide = null;
    lastPx = 0;
  }

  return {
    apply,
    clear,
    destroy,
    isActive: () => active,
  };
}
