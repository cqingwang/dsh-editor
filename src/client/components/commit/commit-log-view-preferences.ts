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
