export function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}

export function shortestUniqueSelector(el: Element): string {
  if (!(el instanceof Element)) return '';
  if (el.id && !/\d{4,}/.test(el.id)) {
    const idSel = `#${cssEscape(el.id)}`;
    try {
      if (document.querySelectorAll(idSel).length === 1) return idSel;
    } catch {
      /* ignore */
    }
  }

  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
    let part = cur.tagName.toLowerCase();
    if (cur.id && !/\d{4,}/.test(cur.id)) {
      part += `#${cssEscape(cur.id)}`;
      parts.unshift(part);
      break;
    }
    const classList = Array.from(cur.classList).filter(
      (c) => c && !/^(css-|svelte-|ng-|v-)/.test(c) && !/^[a-z]+-\[[^\]]+\]$/.test(c),
    );
    if (classList.length) {
      part += '.' + classList.slice(0, 2).map(cssEscape).join('.');
    }
    const parentEl: Element | null = cur.parentElement;
    if (parentEl) {
      const siblings = Array.from(parentEl.children).filter(
        (c: Element) => c.tagName === cur!.tagName,
      );
      if (siblings.length > 1) {
        const idx = siblings.indexOf(cur) + 1;
        part += `:nth-of-type(${idx})`;
      }
    }
    parts.unshift(part);
    const trial = parts.join(' > ');
    try {
      if (document.querySelectorAll(trial).length === 1) break;
    } catch {
      /* continue */
    }
    cur = parentEl;
  }
  return parts.join(' > ') || el.tagName.toLowerCase();
}

export function breadcrumb(el: Element, max = 6): string[] {
  const crumbs: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== document.documentElement && crumbs.length < max) {
    let label = cur.tagName.toLowerCase();
    if (cur.id) label += `#${cur.id}`;
    else if (cur.classList.length) label += `.${cur.classList[0]}`;
    crumbs.unshift(label);
    cur = cur.parentElement;
  }
  return crumbs;
}
