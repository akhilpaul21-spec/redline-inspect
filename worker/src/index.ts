import { resolveProjectId, timingSafeEqual } from './auth';
import { LIMITS } from './limits';
import { checkRateLimit } from './rate-limit';

export interface CommentRow {
  id: string;
  project: string;
  page: string;
  selector: string;
  label: string;
  text: string;
  author: string;
  created_at: string;
  resolved: number;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Redline-Key',
  'Access-Control-Max-Age': '86400',
};

function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
      ...extra,
    },
  });
}

function error(status: number, message: string): Response {
  return json({ error: message }, status);
}

function clientKey(request: Request): string {
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'anon';
  return `${ip}|${request.headers.get('x-redline-key')?.slice(0, 8) || 'nokey'}`;
}

function normalizePage(page: string): string {
  try {
    if (page.startsWith('http://') || page.startsWith('https://')) {
      const u = new URL(page);
      return u.pathname || '/';
    }
  } catch {
    /* fall through */
  }
  return page.startsWith('/') ? page : `/${page}`;
}

function trimField(value: unknown, max: number, name: string): string {
  if (typeof value !== 'string') throw new Error(`${name} is required`);
  const v = value.trim();
  if (!v) throw new Error(`${name} is required`);
  if (v.length > max) throw new Error(`${name} too long (max ${max})`);
  return v;
}

async function authenticate(
  request: Request,
  env: Env,
  projectId: string,
): Promise<Response | null> {
  const key = request.headers.get('x-redline-key')?.trim();
  if (!key) return error(401, 'Missing X-Redline-Key');
  if (projectId.length > LIMITS.projectMax) return error(400, 'Invalid project');

  const resolved = await resolveProjectId(env.DB, key, env.FALLBACK_API_KEY);
  if (!resolved) return error(401, 'Invalid API key');

  if (resolved === 'default' && projectId === 'default') {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO projects (id, name, api_key, created_at) VALUES ('default', 'Default', ?, ?)`,
    )
      .bind(key, new Date().toISOString())
      .run();
  }

  if (!(await timingSafeEqual(resolved, projectId))) {
    return error(403, 'API key does not match project');
  }
  return null;
}

function rowToComment(row: CommentRow) {
  return {
    id: row.id,
    project: row.project,
    page: row.page,
    selector: row.selector,
    label: row.label,
    text: row.text,
    author: row.author,
    createdAt: row.created_at,
    resolved: !!row.resolved,
  };
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (!checkRateLimit(clientKey(request))) {
      return error(429, 'Too many requests');
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    try {
      if (request.method === 'GET' && path === '/comments') {
        return await listComments(request, env, url);
      }
      if (request.method === 'POST' && path === '/comments') {
        return await createComment(request, env);
      }
      const patchMatch = path.match(/^\/comments\/([^/]+)$/);
      if (patchMatch && request.method === 'PATCH') {
        return await patchComment(request, env, decodeURIComponent(patchMatch[1]!));
      }
      if (patchMatch && request.method === 'DELETE') {
        return await deleteComment(request, env, decodeURIComponent(patchMatch[1]!));
      }
      if (request.method === 'GET' && path === '/health') {
        return json({ ok: true });
      }
      return error(404, 'Not found');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Server error';
      if (/required|too long|Invalid|must be/i.test(message)) return error(400, message);
      console.error(JSON.stringify({ level: 'error', message }));
      return error(500, 'Server error');
    }
  },
};

async function listComments(request: Request, env: Env, url: URL): Promise<Response> {
  const project = trimField(url.searchParams.get('project') ?? '', LIMITS.projectMax, 'project');
  const page = normalizePage(trimField(url.searchParams.get('page') ?? '', LIMITS.pageMax, 'page'));
  const authErr = await authenticate(request, env, project);
  if (authErr) return authErr;

  const { results } = await env.DB.prepare(
    `SELECT id, project, page, selector, label, text, author, created_at, resolved
     FROM comments WHERE project = ? AND page = ? ORDER BY created_at ASC`,
  )
    .bind(project, page)
    .all<CommentRow>();

  return json({ comments: (results ?? []).map(rowToComment) });
}

async function createComment(request: Request, env: Env): Promise<Response> {
  const rawLen = Number(request.headers.get('content-length') || 0);
  if (rawLen > LIMITS.bodyBytesMax) return error(413, 'Body too large');

  const body = (await request.json()) as Record<string, unknown>;
  const project = trimField(body.project, LIMITS.projectMax, 'project');
  const authErr = await authenticate(request, env, project);
  if (authErr) return authErr;

  const page = normalizePage(trimField(body.page, LIMITS.pageMax, 'page'));
  const selector = trimField(body.selector, LIMITS.selectorMax, 'selector');
  const label = trimField(body.label ?? body.selector, LIMITS.labelMax, 'label');
  const text = trimField(body.text, LIMITS.textMax, 'text');
  const author = trimField(body.author, LIMITS.authorMax, 'author');
  const id =
    typeof body.id === 'string' && /^[a-zA-Z0-9_-]{6,64}$/.test(body.id)
      ? body.id
      : crypto.randomUUID();
  const createdAt =
    typeof body.createdAt === 'string' && body.createdAt ? body.createdAt : new Date().toISOString();
  const resolved = body.resolved === true || body.resolved === 1 ? 1 : 0;

  await env.DB.prepare(
    `INSERT INTO comments (id, project, page, selector, label, text, author, created_at, resolved)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, project, page, selector, label, text, author, createdAt, resolved)
    .run();

  const row = await env.DB.prepare(
    `SELECT id, project, page, selector, label, text, author, created_at, resolved FROM comments WHERE id = ?`,
  )
    .bind(id)
    .first<CommentRow>();

  return json({ comment: row ? rowToComment(row) : null }, 201);
}

async function patchComment(request: Request, env: Env, id: string): Promise<Response> {
  const body = (await request.json()) as Record<string, unknown>;
  const project = trimField(body.project ?? '', LIMITS.projectMax, 'project');
  const authErr = await authenticate(request, env, project);
  if (authErr) return authErr;

  const existing = await env.DB.prepare(`SELECT * FROM comments WHERE id = ? AND project = ?`)
    .bind(id, project)
    .first<CommentRow>();
  if (!existing) return error(404, 'Comment not found');

  let text = existing.text;
  let resolved = existing.resolved;
  if (body.text !== undefined) text = trimField(body.text, LIMITS.textMax, 'text');
  if (body.resolved !== undefined) {
    if (typeof body.resolved !== 'boolean' && body.resolved !== 0 && body.resolved !== 1) {
      throw new Error('resolved must be boolean');
    }
    resolved = body.resolved === true || body.resolved === 1 ? 1 : 0;
  }

  await env.DB.prepare(`UPDATE comments SET text = ?, resolved = ? WHERE id = ? AND project = ?`)
    .bind(text, resolved, id, project)
    .run();

  const row = await env.DB.prepare(
    `SELECT id, project, page, selector, label, text, author, created_at, resolved FROM comments WHERE id = ?`,
  )
    .bind(id)
    .first<CommentRow>();

  return json({ comment: row ? rowToComment(row) : null });
}

async function deleteComment(request: Request, env: Env, id: string): Promise<Response> {
  const url = new URL(request.url);
  const project = trimField(
    url.searchParams.get('project') ?? '',
    LIMITS.projectMax,
    'project',
  );
  const authErr = await authenticate(request, env, project);
  if (authErr) return authErr;

  const existing = await env.DB.prepare(`SELECT id FROM comments WHERE id = ? AND project = ?`)
    .bind(id, project)
    .first();
  if (!existing) return error(404, 'Comment not found');

  await env.DB.prepare(`DELETE FROM comments WHERE id = ? AND project = ?`).bind(id, project).run();
  return json({ ok: true });
}
