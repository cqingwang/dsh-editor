import { currentEditorWorkspaceId, currentSessionId } from '../../editor-core';
export { currentEditorWorkspaceId, currentSessionId };

export interface MarkdownAssetRevisions {
  global?: number;
  directories?: Record<string, number>;
}

export function dirname(path: string): string {
  const index = path.lastIndexOf('/');
  return index < 0 ? '' : path.slice(0, index);
}

export function resolveMarkdownLink(basePath: string, target: string): string | null {
  if (typeof basePath !== 'string' || typeof target !== 'string') return null;
  const authored = target.trim();
  if (
    authored === '' ||
    authored.startsWith('#') ||
    /^[a-z][a-z0-9+.-]*:/iu.test(authored) ||
    authored.startsWith('//')
  ) {
    return null;
  }
  const clean = authored.split(/[?#]/u, 1)[0].replaceAll('\\', '/');
  let decoded: string;
  try {
    decoded = decodeURIComponent(clean);
  } catch {
    decoded = clean;
  }
  const parts = [...dirname(basePath).split('/').filter(Boolean), ...decoded.split('/')];
  const normalized: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (normalized.length === 0) return null;
      normalized.pop();
    } else {
      normalized.push(part);
    }
  }
  return normalized.join('/');
}

export function isImagePreviewPath(path: unknown): boolean {
  return typeof path === 'string' && /\.(?:png|jpe?g|jfif|gif|webp|avif|bmp|ico|svg)$/iu.test(path);
}

export function imagePreviewUrl(path: string, version: number | null | undefined): string {
  const query = new URLSearchParams({
    sessionId: currentSessionId(),
    workspaceId: currentEditorWorkspaceId(),
    path,
    version: String(version ?? ''),
  });
  return `api/dsh-editor/image?${query}`;
}

export function markdownAssetRevisionForPath(
  path: string,
  revisions: MarkdownAssetRevisions | null | undefined,
): number {
  const directory = dirname(path);
  const global = Math.max(0, Math.floor(Number(revisions?.global) || 0));
  const local = Math.max(0, Math.floor(Number(revisions?.directories?.[directory]) || 0));
  return global + local;
}

export function nextMarkdownAssetRevisions(
  current: MarkdownAssetRevisions | null | undefined,
  changedListings: string[] | null,
): Required<MarkdownAssetRevisions> {
  const directories = { ...(current?.directories ?? {}) };
  if (changedListings === null) {
    return {
      global: Math.max(0, Math.floor(Number(current?.global) || 0)) + 1,
      directories,
    };
  }
  for (const directory of new Set(Array.isArray(changedListings) ? changedListings : [])) {
    if (typeof directory !== 'string') continue;
    directories[directory] = Math.max(0, Math.floor(Number(directories[directory]) || 0)) + 1;
  }
  return {
    global: Math.max(0, Math.floor(Number(current?.global) || 0)),
    directories,
  };
}

export function markdownWorkspaceImageUrl(
  basePath: string,
  target: string,
  workspaceRoot: string,
  imageVersions: MarkdownAssetRevisions | null = null,
  baseUri: string = document.baseURI,
): string | undefined {
  const resolved = resolveMarkdownLink(basePath, target);
  if (resolved === null || !isImagePreviewPath(resolved) || typeof workspaceRoot !== 'string') {
    return undefined;
  }
  const root = workspaceRoot.replaceAll('\\', '/').replace(/\/+$/u, '');
  if (root === '') return undefined;
  const query = new URLSearchParams({ path: `${root}/${resolved}` });
  const revision = markdownAssetRevisionForPath(resolved, imageVersions);
  if (revision > 0) query.set('v', String(revision));
  return new URL(`api/file?${query}`, baseUri).href;
}
