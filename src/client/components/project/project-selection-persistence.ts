import React from 'react';

export interface ProjectSelectionRow {
  path: string;
  kind?: string;
}

interface ProjectSelectionPersistenceOptions {
  root: string;
  ready: boolean;
  rows: readonly ProjectSelectionRow[];
  selectedPath: string | null;
  onSelect: (path: string | null) => void;
}

function projectSelectionStorageKey(root: string): string {
  return `dsh-editor.project.selection.v1:${root}`;
}

export function normalizeProjectSelectionPath(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

export function visibleProjectSelectionPath(
  value: unknown,
  rows: readonly ProjectSelectionRow[] | null | undefined,
): string | null {
  const path = normalizeProjectSelectionPath(value);
  if (path === null || !Array.isArray(rows)) return null;
  return rows.some((row) => row.path === path && row.kind !== 'placeholder') ? path : null;
}

export function readProjectSelection(root: string): string | null {
  if (root === '') return null;
  try {
    return normalizeProjectSelectionPath(window.localStorage.getItem(projectSelectionStorageKey(root)));
  } catch {
    return null;
  }
}

export function writeProjectSelection(root: string, path: string | null): void {
  if (root === '') return;
  try {
    const key = projectSelectionStorageKey(root);
    const normalized = normalizeProjectSelectionPath(path);
    const current = window.localStorage.getItem(key);
    if (normalized === null) {
      if (current !== null) window.localStorage.removeItem(key);
      return;
    }
    if (current !== normalized) window.localStorage.setItem(key, normalized);
  } catch {
    /* A storage-less browser keeps the in-memory Project selection. */
  }
}

export function useProjectSelectionPersistence({
  root,
  ready,
  rows,
  selectedPath,
  onSelect,
}: ProjectSelectionPersistenceOptions): void {
  const restoredRootRef = React.useRef('');
  React.useEffect(() => {
    if (!ready || root === '') return;
    if (restoredRootRef.current !== root) {
      restoredRootRef.current = root;
      const restored = visibleProjectSelectionPath(readProjectSelection(root), rows);
      if (restored !== selectedPath) {
        onSelect(restored);
        return;
      }
    }
    writeProjectSelection(root, selectedPath);
  }, [onSelect, ready, root, rows, selectedPath]);
}
