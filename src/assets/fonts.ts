export interface FontFaceInfo {
  family: string;
  weight: string;
  style: string;
  urls: string[];
  iconFont: boolean;
}

const ICON_NAME_RE = /icon|awesome|material|symbols|glyph|feather|remix|bootstrap-icons|ionicons/i;

export function collectFontFaces(): FontFaceInfo[] {
  const out: FontFaceInfo[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      walk(sheet.cssRules, out);
    } catch {
      /* ignore */
    }
  }
  return out;
}

function walk(rules: CSSRuleList | undefined, out: FontFaceInfo[]): void {
  if (!rules) return;
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSFontFaceRule) {
      const family = rule.style.getPropertyValue('font-family').replace(/["']/g, '').trim();
      const weight = rule.style.getPropertyValue('font-weight') || '400';
      const style = rule.style.getPropertyValue('font-style') || 'normal';
      const src = rule.style.getPropertyValue('src');
      const urls = Array.from(src.matchAll(/url\(["']?([^"')]+)["']?\)/g)).map((m) => m[1]!);
      out.push({
        family,
        weight,
        style,
        urls,
        iconFont: ICON_NAME_RE.test(family),
      });
    } else if (rule instanceof CSSMediaRule || rule instanceof CSSSupportsRule) {
      walk(rule.cssRules, out);
    }
  }
}

export function detectIconFontUsage(): Array<{
  family: string;
  text: string;
  codepoint: number | null;
  selector: string;
  size: number;
}> {
  const glyphs: Array<{
    family: string;
    text: string;
    codepoint: number | null;
    selector: string;
    size: number;
  }> = [];

  const els = document.querySelectorAll('body *');
  for (const el of Array.from(els)) {
    const style = getComputedStyle(el);
    const family = style.fontFamily;
    const isNamed = ICON_NAME_RE.test(family);
    const isMaterial =
      el.classList.contains('material-symbols') ||
      el.classList.contains('material-icons') ||
      el.className.toString().includes('material-symbols') ||
      el.className.toString().includes('material-icons');

    if (isNamed || isMaterial) {
      const text = (el.textContent || '').trim();
      if (text) {
        glyphs.push({
          family: family.split(',')[0]!.replace(/["']/g, '').trim(),
          text,
          codepoint: null,
          selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
          size: parseFloat(style.fontSize) || 24,
        });
      }
    }

    for (const pseudo of ['::before', '::after'] as const) {
      const ps = getComputedStyle(el, pseudo);
      const content = ps.content;
      if (!content || content === 'none' || content === 'normal') continue;
      const raw = content.replace(/^['"]|['"]$/g, '');
      if (!raw) continue;
      const code = raw.codePointAt(0) ?? 0;
      const pua = (code >= 0xe000 && code <= 0xf8ff) || code >= 0xf0000;
      if (pua || ICON_NAME_RE.test(ps.fontFamily || family)) {
        glyphs.push({
          family: (ps.fontFamily || family).split(',')[0]!.replace(/["']/g, '').trim(),
          text: raw,
          codepoint: pua ? code : null,
          selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
          size: parseFloat(ps.fontSize) || 24,
        });
      }
    }
  }
  return glyphs;
}
