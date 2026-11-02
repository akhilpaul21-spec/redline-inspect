import { LIMITS } from './limits';

type Bucket = { count: number; resetAt: number };

/** Basic per-isolate sliding window. Good enough to blunt abuse; not global. */
const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, now = Date.now()): boolean {
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + LIMITS.rateWindowMs });
    return true;
  }
  if (existing.count >= LIMITS.rateMax) return false;
  existing.count += 1;
  return true;
}

/** Test helper */
export function resetRateLimits(): void {
  buckets.clear();
}
