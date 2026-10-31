export function sanitizeSvg(
  svg: SVGElement | string,
  opts: { inlineCurrentColor?: boolean; computedColor?: string } = {},
): string {
  let source =
    typeof svg === 'string' ? svg : new XMLSerializer().serializeToString(svg);
  // Ensure a root svg wrapper for fragment inputs
  if (!/<svg[\s>]/i.test(source)) {
    source = `<svg xmlns="http://www.w3.org/2000/svg">${source}</svg>`;
  }
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.localName === 'parsererror' || root.querySelector('parsererror')) {
    // happy-dom / some parsers may fail — do a regex sanitize fallback
    return source
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/javascript:/gi, '');
  }

  root.querySelectorAll('script, foreignObject').forEach((n) => n.remove());
  const walk = (el: Element) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name;
      const val = attr.value;
      if (/^on/i.test(name)) el.removeAttribute(name);
      else if ((name === 'href' || name === 'xlink:href') && /^\s*javascript:/i.test(val)) el.removeAttribute(name);
      else if ((name === 'href' || name === 'xlink:href') && /^(https?:)?\/\//i.test(val) && !val.startsWith('#')) {
        el.removeAttribute(name);
      } else if (/^data-redline-|^data-v-|^ng-|^data-reactid/.test(name)) el.removeAttribute(name);
    }
    if (opts.inlineCurrentColor && opts.computedColor) {
      for (const attr of ['fill', 'stroke']) {
        if (el.getAttribute(attr) === 'currentColor') {
          el.setAttribute(attr, opts.computedColor);
          el.prepend(doc.createComment(` currentColor was ${opts.computedColor} `));
        }
      }
    }
    for (const child of Array.from(el.children)) walk(child);
  };
  walk(root);

  if (!root.getAttribute('xmlns')) root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (!root.getAttribute('viewBox') && root.hasAttribute('width') && root.hasAttribute('height')) {
    /* keep */
  }

  return new XMLSerializer().serializeToString(root);
}

export function resolveUse(svg: SVGElement): SVGElement {
  const clone = svg.cloneNode(true) as SVGElement;
  clone.querySelectorAll('use').forEach((use) => {
    const href = use.getAttribute('href') || use.getAttribute('xlink:href') || '';
    if (href.startsWith('#')) {
      const id = href.slice(1);
      const ref =
        svg.ownerDocument?.getElementById(id) ||
        document.getElementById(id) ||
        svg.querySelector(href);
      if (ref) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        for (const child of Array.from(ref.childNodes)) g.appendChild(child.cloneNode(true));
        use.replaceWith(g);
      }
    }
  });
  return clone;
}

export function isIconSvg(el: Element, rect: DOMRect): boolean {
  if (rect.width <= 48 && rect.height <= 48) return true;
  if (el.closest('button, a, [role="button"]')) return true;
  const name = `${el.id} ${el.getAttribute('aria-label') ?? ''} ${el.className}`;
  if (/icon|logo|svg/i.test(name)) return true;
  return false;
}
