import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { resetRateLimits } from '../src/rate-limit';

const KEY = 'proj-key-abc';
const PROJECT = 'demo';

async function seedProject(): Promise<void> {
  await env.DB.prepare(
    `INSERT OR REPLACE INTO projects (id, name, api_key, created_at) VALUES (?, ?, ?, ?)`,
  )
    .bind(PROJECT, 'Demo', KEY, new Date().toISOString())
    .run();
}

async function call(
  method: string,
  path: string,
  opts: { key?: string; body?: unknown } = {},
): Promise<Response> {
  const init: RequestInit = {
    method,
    headers: {
      'X-Redline-Key': opts.key ?? KEY,
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  };
  const request = new Request(`http://localhost${path}`, init);
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

describe('redline comments API', () => {
  beforeEach(async () => {
    resetRateLimits();
    await env.DB.prepare('DELETE FROM comments').run();
    await env.DB.prepare('DELETE FROM projects').run();
    await seedProject();
  });

  it('rejects missing API key', async () => {
    const res = await call('GET', `/comments?project=${PROJECT}&page=/overview`, { key: '' });
    // empty header still sent — use raw fetch without header
    const request = new Request(`http://localhost/comments?project=${PROJECT}&page=/overview`);
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(401);
    void res;
  });

  it('creates and lists comments for a page', async () => {
    const create = await call('POST', '/comments', {
      body: {
        project: PROJECT,
        page: '/overview',
        selector: '#hero',
        label: 'div#hero',
        text: 'Tighten spacing',
        author: 'Ada',
      },
    });
    expect(create.status).toBe(201);
    const created = (await create.json()) as { comment: { id: string; text: string } };
    expect(created.comment.text).toBe('Tighten spacing');

    const list = await call('GET', `/comments?project=${PROJECT}&page=/overview`);
    expect(list.status).toBe(200);
    const body = (await list.json()) as { comments: Array<{ id: string; author: string }> };
    expect(body.comments).toHaveLength(1);
    expect(body.comments[0]!.author).toBe('Ada');
    expect(body.comments[0]!.id).toBe(created.comment.id);
  });

  it('isolates comments by page path', async () => {
    await call('POST', '/comments', {
      body: {
        project: PROJECT,
        page: '/a',
        selector: '#a',
        label: 'a',
        text: 'A',
        author: 'Ada',
      },
    });
    await call('POST', '/comments', {
      body: {
        project: PROJECT,
        page: '/b',
        selector: '#b',
        label: 'b',
        text: 'B',
        author: 'Ada',
      },
    });
    const list = await call('GET', `/comments?project=${PROJECT}&page=/a`);
    const body = (await list.json()) as { comments: Array<{ text: string }> };
    expect(body.comments.map((c) => c.text)).toEqual(['A']);
  });

  it('patches resolve and text', async () => {
    const create = await call('POST', '/comments', {
      body: {
        project: PROJECT,
        page: '/overview',
        selector: '#cta',
        label: 'button',
        text: 'WIP',
        author: 'Bea',
      },
    });
    const { comment } = (await create.json()) as { comment: { id: string } };

    const patch = await call('PATCH', `/comments/${comment.id}`, {
      body: { project: PROJECT, text: 'Done', resolved: true },
    });
    expect(patch.status).toBe(200);
    const updated = (await patch.json()) as { comment: { text: string; resolved: boolean } };
    expect(updated.comment.text).toBe('Done');
    expect(updated.comment.resolved).toBe(true);
  });

  it('deletes a comment', async () => {
    const create = await call('POST', '/comments', {
      body: {
        project: PROJECT,
        page: '/overview',
        selector: '#x',
        label: 'x',
        text: 'bye',
        author: 'Ada',
      },
    });
    const { comment } = (await create.json()) as { comment: { id: string } };
    const del = await call('DELETE', `/comments/${comment.id}?project=${PROJECT}`);
    expect(del.status).toBe(200);
    const list = await call('GET', `/comments?project=${PROJECT}&page=/overview`);
    const body = (await list.json()) as { comments: unknown[] };
    expect(body.comments).toHaveLength(0);
  });

  it('rejects oversized text', async () => {
    const res = await call('POST', '/comments', {
      body: {
        project: PROJECT,
        page: '/overview',
        selector: '#x',
        label: 'x',
        text: 'x'.repeat(5000),
        author: 'Ada',
      },
    });
    expect(res.status).toBe(400);
  });

  it('handles CORS preflight', async () => {
    const request = new Request('http://localhost/comments', { method: 'OPTIONS' });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('X-Redline-Key');
  });
});
