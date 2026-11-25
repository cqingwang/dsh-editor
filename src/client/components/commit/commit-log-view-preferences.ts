import React from 'react';
import { shouldLoadCommitLogOnOpen, type CommitLogInitialLoadState } from './commit-log-view-model';

interface CommitLogGraphToggle {
  enabled: boolean;
  loadGraph: boolean;
  focusList: boolean;
}

interface CommitLogGraphFoldToggle {
  folded: boolean;
  clearHover: boolean;
}

interface CommitLogFilterToggle {
  visible: boolean;
  focusInput: boolean;
  clearFilter: boolean;
}

export interface CommitLogGraphScope {
  branch: string | null;
  at: string | null;
}

export interface CommitGraphScopeFallback {
  branch: string;
  at: string;
  notice: 'branch' | 'revision' | 'scope' | 'branch-at';
}

export interface CommitGraphScopeRequestResult<T> {
  value: T;
  branch: string;
  at: string;
  notice: CommitGraphScopeFallback['notice'] | null;
}

const COMMIT_SELECTION_KEY = 'dsh-editor.commit.selected';

export function readStoredCommitSelection(): string | null {
  try {
    const stored = window.localStorage.getItem(COMMIT_SELECTION_KEY) ?? '';
    return stored === '' ? null : stored;
  } catch {
    return null;
  }
}

export function readStoredCommitSelectionList(): string[] {
  const selected = readStoredCommitSelection();
  return selected === null ? [] : [selected];
}

export function writeStoredCommitSelection(hash: string | null): void {
  try {
    if (hash === null || hash === '') window.localStorage.removeItem(COMMIT_SELECTION_KEY);
    else if (window.localStorage.getItem(COMMIT_SELECTION_KEY) !== hash) {
      window.localStorage.setItem(COMMIT_SELECTION_KEY, hash);
    }
  } catch {
    /* a storage-less browser simply forgets the selected commit */
  }
}

function storedPreferenceKey(workspaceId: string, preference: string): string {
  return `dsh-editor.commit.${preference}:${workspaceId}`;
}

export function readStoredCommitLogAuthor(workspaceId: string): string {
  if (workspaceId === '') return '';
  try {
    return window.localStorage.getItem(storedPreferenceKey(workspaceId, 'logAuthor')) ?? '';
  } catch {
    return '';
  }
}

export function writeStoredCommitLogAuthor(workspaceId: string, value: string): void {
  if (workspaceId === '') return;
  try {
    const key = storedPreferenceKey(workspaceId, 'logAuthor');
    if (value === '') window.localStorage.removeItem(key);
    else if (window.localStorage.getItem(key) !== value) window.localStorage.setItem(key, value);
  } catch {
    /* a storage-less browser keeps the current Log filter in memory */
  }
}

export function normalizeCommitGraphScope(branch: unknown, at: unknown): CommitLogGraphScope | null {
  const branchValue = typeof branch === 'string' ? branch : '';
  const atValue = typeof at === 'string' ? at : '';
  return branchValue === '' && atValue === ''
    ? null
    : {
        branch: branchValue === '' ? null : branchValue,
        at: atValue === '' ? null : atValue,
      };
}

/**
 * Ordered retries for a persisted graph scope that no longer resolves.
 *
 * A branch and a commit are independent filters. When both are stored, first
 * keep the commit and drop only the branch; if that also fails, clear both.
 * The caller only uses these after Git reports a stale ref, never for network
 * or permission failures.
 * @param {unknown} branch - persisted branch name.
 * @param {unknown} at - persisted commit hash.
 * @returns {CommitGraphScopeFallback[]} retries in least-destructive order.
 */
export function commitGraphScopeFallbackRequests(branch: unknown, at: unknown): CommitGraphScopeFallback[] {
  const scope = normalizeCommitGraphScope(branch, at);
  if (scope === null) return [];
  const branchValue = scope.branch ?? '';
  const atValue = scope.at ?? '';
  if (branchValue !== '' && atValue !== '') {
    return [
      { branch: '', at: atValue, notice: 'branch-at' },
      { branch: '', at: '', notice: 'scope' },
    ];
  }
  if (branchValue !== '') return [{ branch: '', at: '', notice: 'branch' }];
  return [{ branch: '', at: '', notice: 'revision' }];
}

/**
 * Whether a Git failure means the persisted graph scope itself is stale.
 *
 * Retrying every failure would turn a transient Host problem into a silent
 * scope reset. These are the messages Git emits for a deleted branch or an
 * unreachable commit, including the Host's own validation errors.
 * @param {unknown} message - failure message.
 * @returns {boolean} true when the scope should be retried without its ref.
 */
export function commitGraphScopeFailureIsStale(message: unknown): boolean {
  if (typeof message !== 'string' || message === '') return false;
  return /unknown branch:|bad revision:|bad object|unknown revision|not a valid object name|ambiguous argument/iu.test(
    message,
  );
}

/** Locale key for the truthful notice shown after a stale scope fallback. */
export function commitGraphScopeFallbackNoticeKey(notice: CommitGraphScopeFallback['notice']): string {
  if (notice === 'branch') return 'editor.graphScopeBranchReset';
  if (notice === 'revision') return 'editor.graphScopeRevisionReset';
  if (notice === 'branch-at') return 'editor.graphScopeBranchAtReset';
  return 'editor.graphScopeReset';
}

/**
 * Request a graph, retrying only a stale persisted scope.
 *
 * The caller owns the abort signal and the final error presentation. This
 * helper owns the ordered fallback so the workspace does not grow another
 * request state machine.
 */
export async function requestCommitGraphWithScopeFallback<T>(
  request: (branch: string, at: string) => Promise<T>,
  branch: string,
  at: string,
  allowFallback: boolean,
  shouldStop: () => boolean = () => false,
): Promise<CommitGraphScopeRequestResult<T>> {
  try {
    return { value: await request(branch, at), branch, at, notice: null };
  } catch (failure) {
    if (
      shouldStop() ||
      !allowFallback ||
      !commitGraphScopeFailureIsStale(failure instanceof Error ? failure.message : String(failure))
    ) {
      throw failure;
    }
    for (const fallback of commitGraphScopeFallbackRequests(branch, at)) {
      if (shouldStop()) throw failure;
      try {
        return {
          value: await request(fallback.branch, fallback.at),
          branch: fallback.branch,
          at: fallback.at,
          notice: fallback.notice,
        };
      } catch {
        if (shouldStop()) throw failure;
      }
    }
    throw failure;
  }
}

export function readStoredCommitGraphScope(workspaceId: string): CommitLogGraphScope | null {
  if (workspaceId === '') return null;
  try {
    const raw = window.localStorage.getItem(storedPreferenceKey(workspaceId, 'graphScope'));
    const parsed: unknown = raw === null ? null : JSON.parse(raw);
    return parsed !== null && typeof parsed === 'object'
      ? normalizeCommitGraphScope((parsed as Record<string, unknown>).branch, (parsed as Record<string, unknown>).at)
      : null;
  } catch {
    return null;
  }
}

export function writeStoredCommitGraphScope(workspaceId: string, branch: unknown, at: unknown): void {
  if (workspaceId === '') return;
  try {
    const key = storedPreferenceKey(workspaceId, 'graphScope');
    const scope = normalizeCommitGraphScope(branch, at);
    if (scope === null) {
      window.localStorage.removeItem(key);
      return;
    }
    const next = JSON.stringify(scope);
    if (window.localStorage.getItem(key) !== next) window.localStorage.setItem(key, next);
  } catch {
    /* a storage-less browser simply forgets the graph scope */
  }
}

export const commitLogStorage = {
  readGraphScope: readStoredCommitGraphScope,
  writeGraphScope: writeStoredCommitGraphScope,
};

export interface CommitLogAuthorController {
  author: string;
  ready: boolean;
  ref: React.MutableRefObject<string>;
  setAuthor: (value: string) => void;
}

export function useCommitLogAuthor(root: string): CommitLogAuthorController {
  const [stored, setStored] = React.useState({ root: '', author: '' });
  const ref = React.useRef('');
  React.useEffect(() => {
    if (root === '') return;
    const author = readStoredCommitLogAuthor(root);
    ref.current = author;
    setStored((current) => (current.root === root && current.author === author ? current : { root, author }));
  }, [root]);
  const ready = root !== '' && stored.root === root;
  const setAuthor = React.useCallback(
    (value: string) => {
      ref.current = value;
      setStored({ root, author: value });
      writeStoredCommitLogAuthor(root, value);
    },
    [root],
  );
  return { author: ready ? stored.author : '', ready, ref, setAuthor };
}

export function useCommitLogInitialLoad(state: CommitLogInitialLoadState, load: () => void): void {
  const shouldLoad = shouldLoadCommitLogOnOpen(state);
  React.useEffect(() => {
    if (shouldLoad) load();
  }, [load, shouldLoad]);
}

export function commitLogGraphToggle(graphMode: boolean): CommitLogGraphToggle {
  const enabled = !graphMode;
  return {
    enabled,
    loadGraph: enabled,
    focusList: enabled,
  };
}

export function commitLogGraphFoldToggle(folded: boolean): CommitLogGraphFoldToggle {
  return {
    folded: !folded,
    clearHover: true,
  };
}

export function commitLogFilterToggle(filterVisible: boolean): CommitLogFilterToggle {
  const visible = !filterVisible;
  return {
    visible,
    focusInput: visible,
    clearFilter: !visible,
  };
}
