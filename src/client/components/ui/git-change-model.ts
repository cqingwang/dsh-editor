import { gitStatusInfo, type GitStatusInfo } from './git-status-model';

export interface GitChange {
  path?: string;
  status?: string;
  staged?: boolean;
}

export interface GitChangeSelection {
  path?: string;
  staged?: boolean;
}

export type GitChangeStatusMap = Map<string, GitChange>;
export type GitStatusMap = Map<string, string>;

/** Whether `HEAD:<path>` can be resolved for this change. */
export function canCompareWithHead(change?: Pick<GitChange, 'status'> | null): boolean {
  const status = typeof change?.status === 'string' ? change.status : '';
  if (status.length < 2 || status === '??') return false;
  return status[0] !== 'A' && status[0] !== 'R' && status[0] !== 'C';
}

/** The status badge a palette row should show, or null when the file is clean. */
export function badgeFor(path: string, changes?: GitStatusMap | null): GitStatusInfo | null {
  if (!(changes instanceof Map)) return null;
  return gitStatusInfo(changes.get(path));
}

/** Whether every selected change is Git-unversioned. */
export function allPathsUnversioned(
  selected?: GitChangeSelection[] | null,
  changes?: GitChangeStatusMap | null,
): boolean {
  const list = Array.isArray(selected) ? selected : [];
  if (list.length === 0 || !(changes instanceof Map)) return false;
  return list.every((entry) => entry?.path !== undefined && changes.get(entry.path)?.status === '??');
}

/** Paths IDEA's Remove from VCS action may schedule for deletion. */
export function pathsScheduledForRemoval(
  selected?: GitChangeSelection[] | null,
  changes?: GitChangeStatusMap | null,
): string[] {
  const list = Array.isArray(selected) ? selected : [];
  if (list.length === 0 || !(changes instanceof Map)) return [];
  const paths: string[] = [];
  for (const entry of list) {
    if (entry?.staged === true || typeof entry?.path !== 'string' || entry.path === '') continue;
    const status = changes.get(entry.path)?.status;
    if (typeof status !== 'string' || status.length < 2) continue;
    if (status[0] === 'D' || status[1] !== 'D') continue;
    if (!paths.includes(entry.path)) paths.push(entry.path);
  }
  return paths;
}
