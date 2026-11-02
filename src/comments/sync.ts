import type { SyncConfig } from '../types';
import type { RedlineComment } from './store';
import { pagePath } from './store';

export interface RemoteComment {
  id: string;
  project?: string;
  page?: string;
  selector: string;
  label: string;
  text: string;
  author: string;
  createdAt: string;
  resolved?: boolean;
}

function headers(sync: SyncConfig): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-Redline-Key': sync.key,
  };
}

function endpoint(sync: SyncConfig, path: string): string {
  return `${sync.endpoint.replace(/\/+$/, '')}${path}`;
}

export function toLocalComment(remote: RemoteComment): RedlineComment {
  return {
    id: remote.id,
    selector: remote.selector,
    label: remote.label,
    text: remote.text,
    createdAt: remote.createdAt,
    author: remote.author,
    resolved: !!remote.resolved,
  };
}

export async function fetchRemoteComments(
  sync: SyncConfig,
  page = pagePath(),
): Promise<RedlineComment[]> {
  const url = new URL(endpoint(sync, '/comments'));
  url.searchParams.set('project', sync.project);
  url.searchParams.set('page', page);
  const res = await fetch(url.href, { headers: headers(sync), credentials: 'omit' });
  if (!res.ok) throw new Error(`Sync failed (${res.status})`);
  const body = (await res.json()) as { comments?: RemoteComment[] };
  return (body.comments ?? []).map(toLocalComment);
}

export async function createRemoteComment(
  sync: SyncConfig,
  comment: RedlineComment,
  page = pagePath(),
): Promise<RedlineComment> {
  const res = await fetch(endpoint(sync, '/comments'), {
    method: 'POST',
    headers: headers(sync),
    credentials: 'omit',
    body: JSON.stringify({
      id: comment.id,
      project: sync.project,
      page,
      selector: comment.selector,
      label: comment.label,
      text: comment.text,
      author: comment.author || 'Anonymous',
      createdAt: comment.createdAt,
      resolved: !!comment.resolved,
    }),
  });
  if (!res.ok) throw new Error(`Create failed (${res.status})`);
  const body = (await res.json()) as { comment: RemoteComment };
  return toLocalComment(body.comment);
}

export async function patchRemoteComment(
  sync: SyncConfig,
  id: string,
  patch: { text?: string; resolved?: boolean },
): Promise<RedlineComment> {
  const res = await fetch(endpoint(sync, `/comments/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: headers(sync),
    credentials: 'omit',
    body: JSON.stringify({ project: sync.project, ...patch }),
  });
  if (!res.ok) throw new Error(`Update failed (${res.status})`);
  const body = (await res.json()) as { comment: RemoteComment };
  return toLocalComment(body.comment);
}

export async function deleteRemoteComment(sync: SyncConfig, id: string): Promise<void> {
  const url = new URL(endpoint(sync, `/comments/${encodeURIComponent(id)}`));
  url.searchParams.set('project', sync.project);
  const res = await fetch(url.href, {
    method: 'DELETE',
    headers: headers(sync),
    credentials: 'omit',
  });
  if (!res.ok) throw new Error(`Delete failed (${res.status})`);
}
