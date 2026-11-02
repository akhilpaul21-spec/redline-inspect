#!/usr/bin/env node
/**
 * Minimal shared-comments API mock for Playwright e2e.
 * Mirrors worker/ GET|POST|PATCH|DELETE /comments with X-Redline-Key auth.
 */
import http from 'node:http';

const PORT = Number(process.env.REDLINE_COMMENTS_MOCK_PORT || 8787);
const KEY = process.env.REDLINE_COMMENTS_KEY || 'e2e-demo-key';
const PROJECT = process.env.REDLINE_COMMENTS_PROJECT || 'e2e-demo';

/** @type {Map<string, any>} */
const comments = new Map();

function send(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Redline-Key',
    'Content-Length': Buffer.byteLength(data),
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function authed(req) {
  return req.headers['x-redline-key'] === KEY;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Redline-Key',
    });
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  try {
    if (!authed(req) && path !== '/health') {
      send(res, 401, { error: 'Invalid API key' });
      return;
    }

    if (req.method === 'GET' && path === '/health') {
      send(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && path === '/comments') {
      const project = url.searchParams.get('project');
      const page = url.searchParams.get('page');
      if (project !== PROJECT) {
        send(res, 403, { error: 'API key does not match project' });
        return;
      }
      const list = [...comments.values()].filter((c) => c.project === project && c.page === page);
      send(res, 200, { comments: list });
      return;
    }

    if (req.method === 'POST' && path === '/comments') {
      const body = await readBody(req);
      if (body.project !== PROJECT) {
        send(res, 403, { error: 'API key does not match project' });
        return;
      }
      const comment = {
        id: body.id || `c_${Date.now()}`,
        project: body.project,
        page: body.page,
        selector: body.selector,
        label: body.label,
        text: body.text,
        author: body.author,
        createdAt: body.createdAt || new Date().toISOString(),
        resolved: !!body.resolved,
      };
      comments.set(comment.id, comment);
      send(res, 201, { comment });
      return;
    }

    const m = path.match(/^\/comments\/([^/]+)$/);
    if (m && req.method === 'PATCH') {
      const id = decodeURIComponent(m[1]);
      const body = await readBody(req);
      const existing = comments.get(id);
      if (!existing || existing.project !== body.project) {
        send(res, 404, { error: 'Comment not found' });
        return;
      }
      if (body.text !== undefined) existing.text = body.text;
      if (body.resolved !== undefined) existing.resolved = !!body.resolved;
      comments.set(id, existing);
      send(res, 200, { comment: existing });
      return;
    }

    if (m && req.method === 'DELETE') {
      const id = decodeURIComponent(m[1]);
      const project = url.searchParams.get('project');
      const existing = comments.get(id);
      if (!existing || existing.project !== project) {
        send(res, 404, { error: 'Comment not found' });
        return;
      }
      comments.delete(id);
      send(res, 200, { ok: true });
      return;
    }

    send(res, 404, { error: 'Not found' });
  } catch (err) {
    send(res, 500, { error: err instanceof Error ? err.message : 'error' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[comments-mock] http://127.0.0.1:${PORT} project=${PROJECT}`);
});
