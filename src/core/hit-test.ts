const HOST_TAG = 'REDLINE-ROOT';

export function isRedlineNode(node: Node | null, shadowRoot: ShadowRoot | null): boolean {
  if (!node) return false;
  if (node instanceof Element) {
    if (node.tagName === HOST_TAG) return true;
    const root = node.getRootNode();
    if (shadowRoot && root === shadowRoot) return true;
  }
  const root = node.getRootNode?.();
  if (shadowRoot && root === shadowRoot) return true;
  return false;
}

export function deepElementFromPoint(
  x: number,
  y: number,
  shadowRoot: ShadowRoot | null,
  ignore: string[] = [],
): Element | null {
  const stack = document.elementsFromPoint(x, y);
  for (const el of stack) {
    if (isRedlineNode(el, shadowRoot)) continue;
    if (ignore.some((sel) => {
      try {
        return el.matches(sel);
      } catch {
        return false;
      }
    })) {
      continue;
    }

    // Same-origin iframe
    if (el instanceof HTMLIFrameElement) {
      try {
        const doc = el.contentDocument;
        if (doc) {
          const rect = el.getBoundingClientRect();
          const inner = deepElementFromPointInDoc(doc, x - rect.left, y - rect.top, null, ignore);
          if (inner) return inner;
        }
      } catch {
        return el; // cross-origin iframe
      }
    }

    // Open shadow roots
    if (el.shadowRoot) {
      const nested = deepElementFromPointInDoc(el.shadowRoot as unknown as Document, x, y, shadowRoot, ignore);
      if (nested && nested !== el) return nested;
    }

    if (!isSelectable(el)) continue;
    return el;
  }
  return null;
}

function deepElementFromPointInDoc(
  root: Document | ShadowRoot,
  x: number,
  y: number,
  redlineShadow: ShadowRoot | null,
  ignore: string[],
): Element | null {
  const list =
    typeof (root as any).elementsFromPoint === 'function'
      ? (root as Document).elementsFromPoint(x, y)
      : [];
  for (const el of list) {
    if (isRedlineNode(el, redlineShadow)) continue;
    if (ignore.some((sel) => {
      try {
        return el.matches(sel);
      } catch {
        return false;
      }
    })) {
      continue;
    }
    if (el.shadowRoot) {
      const nested = deepElementFromPointInDoc(el.shadowRoot as unknown as Document, x, y, redlineShadow, ignore);
      if (nested) return nested;
    }
    if (!isSelectable(el)) continue;
    return el;
  }
  return null;
}

export function isSelectable(el: Element): boolean {
  if (!(el instanceof Element)) return false;
  if (el.tagName === 'HTML' || el.tagName === 'BODY') return true;
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 && rect.height <= 0) return false;
  return true;
}

export function isCrossOriginIframe(el: Element): boolean {
  if (!(el instanceof HTMLIFrameElement)) return false;
  try {
    void el.contentDocument;
    return false;
  } catch {
    return true;
  }
}
