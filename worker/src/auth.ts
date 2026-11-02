export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const aa = enc.encode(a);
  const bb = enc.encode(b);
  if (aa.byteLength !== bb.byteLength) {
    // Still compare to keep timing flatter for length mismatches of similar size.
    const dummy = new Uint8Array(aa.byteLength);
    crypto.getRandomValues(dummy);
    await crypto.subtle.digest('SHA-256', aa);
    await crypto.subtle.digest('SHA-256', dummy);
    return false;
  }
  let out = 0;
  for (let i = 0; i < aa.byteLength; i++) out |= aa[i]! ^ bb[i]!;
  return out === 0;
}

export async function resolveProjectId(
  db: D1Database,
  apiKey: string,
  fallbackKey?: string,
): Promise<string | null> {
  const row = await db
    .prepare('SELECT id, api_key FROM projects WHERE api_key = ? LIMIT 1')
    .bind(apiKey)
    .first<{ id: string; api_key: string }>();
  if (row && (await timingSafeEqual(row.api_key, apiKey))) return row.id;
  if (fallbackKey && (await timingSafeEqual(fallbackKey, apiKey))) {
    // Single-tenant fallback: project id is the key fingerprint prefix.
    return 'default';
  }
  return null;
}
