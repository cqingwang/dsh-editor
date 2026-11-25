import React from 'react';
import {
  rollbackDialogEntryKey,
  rollbackNavigationEntries,
  type RollbackDialogInitial,
  type RollbackDialogResult,
  type RollbackDialogEntry,
} from './rollback-confirmation';

export interface RollbackDiffSession {
  entries: RollbackDialogEntry[];
  selectedKeys: Set<string>;
  deleteAdded: boolean;
  selectedKey: string;
  scrollTop: number;
  resume: (initial: RollbackDialogInitial) => void;
}

export interface RollbackDiffTargetState {
  key: string;
  included: boolean;
}

/** Locate the rollback row represented by the visible diff target. */
export function rollbackDiffTargetState(
  session: RollbackDiffSession | null,
  target: { path?: string; staged?: boolean } | null,
): RollbackDiffTargetState | null {
  if (session === null || target === null || typeof target.path !== 'string') return null;
  const entry = session.entries.find(
    (candidate) => candidate.path === target.path && (candidate.group === 'staged') === (target.staged === true),
  );
  if (entry === undefined) return null;
  const key = rollbackDialogEntryKey(entry);
  return { key, included: session.selectedKeys.has(key) };
}

/** Start a diff session from the dialog's Show Diff result. */
export function beginRollbackDiffSession(
  begin: (session: Omit<RollbackDiffSession, 'selectedKeys'> & { selectedKeys: Iterable<string> }) => void,
  decision: Extract<RollbackDialogResult, { action: 'showDiff' }>,
  resume: (initial: RollbackDialogInitial) => void,
): void {
  const selectedKeys = new Set(decision.selectedEntries.map(rollbackDialogEntryKey));
  begin({
    entries: decision.entries,
    selectedKeys,
    deleteAdded: decision.deleteAdded,
    selectedKey: rollbackDialogEntryKey(decision.entry),
    scrollTop: decision.scrollTop,
    resume,
  });
}

/** Build the diff target that keeps the dialog's file scope. */
export function rollbackDiffTarget(
  entry: RollbackDialogEntry,
  entries: RollbackDialogEntry[],
): { path: string; staged: boolean; navigationEntries: Array<{ path: string; staged: boolean }> } {
  return {
    path: entry.path,
    staged: entry.group === 'staged',
    navigationEntries: rollbackNavigationEntries(entries),
  };
}

/** Reopen the dialog with the inclusion state the user left in the diff. */
export function resumeRollbackDiffSession(session: RollbackDiffSession): void {
  session.resume({
    selectedKeys: session.selectedKeys,
    deleteAdded: session.deleteAdded,
    selectedKey: session.selectedKey,
    scrollTop: session.scrollTop,
  });
}

/**
 * Keep one Rollback Show Diff session alive while the user inspects the diff.
 *
 * The dialog is closed while the diff is open, so the session owns the
 * inclusion set and the callback that reopens the dialog with the same state.
 */
export function useRollbackDiffSession(
  diffTarget: { path?: string; staged?: boolean; navigationEntries?: unknown } | null,
) {
  const [session, setSession] = React.useState<RollbackDiffSession | null>(null);
  const sessionRef = React.useRef<RollbackDiffSession | null>(null);
  const update = React.useCallback((next: RollbackDiffSession | null): void => {
    sessionRef.current = next;
    setSession(next);
  }, []);
  React.useEffect(() => {
    if (session !== null && diffTarget !== null && diffTarget.navigationEntries === undefined) update(null);
  }, [diffTarget, session, update]);
  React.useEffect(() => {
    if (session === null) return;
    const state = rollbackDiffTargetState(session, diffTarget);
    if (state === null || state.key === session.selectedKey) return;
    update({ ...session, selectedKey: state.key });
  }, [diffTarget, session, update]);
  const begin = React.useCallback(
    (next: Omit<RollbackDiffSession, 'selectedKeys'> & { selectedKeys: Iterable<string> }): void => {
      update({ ...next, selectedKeys: new Set(next.selectedKeys) });
    },
    [update],
  );
  const toggle = React.useCallback(
    (key: string, included: boolean): void => {
      const current = sessionRef.current;
      if (current === null) return;
      const selectedKeys = new Set(current.selectedKeys);
      if (included) selectedKeys.add(key);
      else selectedKeys.delete(key);
      update({ ...current, selectedKeys });
    },
    [update],
  );
  const take = React.useCallback((): RollbackDiffSession | null => {
    const current = sessionRef.current;
    update(null);
    return current;
  }, [update]);
  const targetState = React.useMemo(() => rollbackDiffTargetState(session, diffTarget), [diffTarget, session]);
  const inclusion = React.useMemo(
    () =>
      targetState === null
        ? undefined
        : { included: targetState.included, onToggle: (included: boolean) => toggle(targetState.key, included) },
    [targetState, toggle],
  );
  return React.useMemo(
    () => ({ session, targetState, inclusion, begin, toggle, take }),
    [begin, inclusion, session, take, targetState, toggle],
  );
}
