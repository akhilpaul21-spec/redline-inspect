const AUTHOR_KEY = 'redline:author';

export function getAuthorName(): string | null {
  try {
    const v = localStorage.getItem(AUTHOR_KEY)?.trim();
    return v || null;
  } catch {
    return null;
  }
}

export function setAuthorName(name: string): void {
  try {
    localStorage.setItem(AUTHOR_KEY, name.trim());
  } catch {
    /* ignore */
  }
}

/** Prompt once (or when forced) for a display name used on shared comments. */
export function ensureAuthorName(force = false): string | null {
  const existing = getAuthorName();
  if (existing && !force) return existing;
  if (typeof window === 'undefined') return existing;
  const next = window.prompt(
    force ? 'Change your display name for comments:' : 'Choose a display name for comments:',
    existing || '',
  );
  if (next == null) return existing;
  const trimmed = next.trim();
  if (!trimmed) return existing;
  setAuthorName(trimmed);
  return trimmed;
}
