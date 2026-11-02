interface Env {
  DB: D1Database;
  /** Optional fallback API key when no projects row matches (dev / single-tenant). */
  FALLBACK_API_KEY?: string;
}

interface CloudflareTestEnv extends Env {
  TEST_MIGRATIONS: D1Migration[];
}
