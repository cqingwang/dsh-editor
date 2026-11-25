export type CommitSelectionState = 'all' | 'some' | 'none';
export type CommitBand = 'staged' | 'unstaged' | 'unversioned';

export interface LineStats {
  additions: number;
  deletions: number;
  binary?: boolean;
}

export interface ChangeLineCounts {
  stagedLines?: LineStats;
  unstagedLines?: LineStats;
}

export interface CommitMetrics {
  subject: string;
  body: string;
  subjectLength: number;
  bodyLines: number;
}

/** Stable Changes-list identity for one staged or working-tree row. */
export function changeSelectionKey(path: string, staged: boolean): string {
  return `${staged ? 'staged' : 'unstaged'}:${path}`;
}

/**
 * Find the next file row in a Changes tree while skipping group and directory
 * rows. Shift+Arrow must extend across staged/unstaged bands without stopping
 * on a non-file header, which would clear the range anchor.
 * @param fileRows - one boolean per rendered row, true for a file row.
 * @param index - current row index.
 * @param direction - 1 for down, -1 for up.
 * @returns the next file-row index, or null when the direction is exhausted.
 */
export function nextChangeFileRowIndex(fileRows: readonly boolean[], index: number, direction: 1 | -1): number | null {
  for (let cursor = index + direction; cursor >= 0 && cursor < fileRows.length; cursor += direction) {
    if (fileRows[cursor] === true) return cursor;
  }
  return null;
}

/** Three-state selection for one directory or group (IDEA's tri-state checkbox). */
export function selectionStateOf(paths?: string[] | null, selected?: Set<string> | null): CommitSelectionState {
  const members = Array.isArray(paths) ? paths : [];
  if (members.length === 0) return 'none';
  const picked = members.filter((path) => selected?.has?.(path) === true).length;
  if (picked === 0) return 'none';
  return picked === members.length ? 'all' : 'some';
}

/** Sum one band's line counts, IDEA's `+12 −3` on a directory or group header. */
export function subtotalOf(
  changes?: ChangeLineCounts[] | null,
  band?: CommitBand | string,
): Pick<LineStats, 'additions' | 'deletions'> | undefined {
  if (!Array.isArray(changes) || changes.length === 0) return undefined;
  const readings = changes
    .map((change) =>
      band === 'staged' ? change?.stagedLines : band === 'unstaged' ? change?.unstagedLines : undefined,
    )
    .filter((counts): counts is LineStats => counts !== undefined && counts !== null && counts.binary !== true);
  if (readings.length === 0) return undefined;
  return {
    additions: readings.reduce((total, counts) => total + counts.additions, 0),
    deletions: readings.reduce((total, counts) => total + counts.deletions, 0),
  };
}

/** Split a commit message into IDEA's subject line and its body. */
export function commitMetrics(message?: string): CommitMetrics {
  const text = typeof message === 'string' ? message : '';
  const newline = text.indexOf('\n');
  const subject = newline === -1 ? text : text.slice(0, newline);
  const body = newline === -1 ? '' : text.slice(newline + 1);
  return {
    subject,
    body,
    subjectLength: subject.trimEnd().length,
    bodyLines: body === '' ? 0 : body.trimEnd().split('\n').length,
  };
}

/** Choose the nearest surviving row after a destructive Changes operation. */
export function nearestRowAfterRemoval(
  keysInVisualOrder: readonly string[],
  remaining: ReadonlySet<string>,
  removedKeys: ReadonlySet<string>,
): string | null {
  const firstRemoved = keysInVisualOrder.findIndex((key) => removedKeys.has(key));
  if (firstRemoved < 0) return [...remaining][0] ?? null;
  for (let offset = 1; offset < keysInVisualOrder.length; offset += 1) {
    const next = keysInVisualOrder[firstRemoved + offset];
    if (next !== undefined && remaining.has(next)) return next;
  }
  for (let offset = 1; offset <= firstRemoved; offset += 1) {
    const previous = keysInVisualOrder[firstRemoved - offset];
    if (previous !== undefined && remaining.has(previous)) return previous;
  }
  return [...remaining][0] ?? null;
}

export interface ChangeSelectionReconciliation {
  selection: Set<string>;
  primary: string | null;
}

/**
 * Reconcile the Changes-list selection after a destructive operation.
 *
 * Keep every surviving selected row. If the primary row disappeared, move to
 * the nearest survivor in the order captured before the operation. The caller
 * owns the DOM and React state; this model owns only the selection decision.
 */
export function reconcileChangeSelectionModel(
  keysInVisualOrder: readonly string[],
  remaining: ReadonlySet<string>,
  selectedKeys: ReadonlySet<string>,
  removedKeys: ReadonlySet<string>,
): ChangeSelectionReconciliation {
  const selection = new Set([...selectedKeys].filter((key) => remaining.has(key)));
  const selectedAfterRemoval = keysInVisualOrder.find((key) => selection.has(key));
  const firstRemoved = keysInVisualOrder.find((key) => removedKeys.has(key));
  const separator = firstRemoved?.indexOf(':') ?? -1;
  const movedKey =
    firstRemoved === undefined || separator < 0
      ? null
      : `${firstRemoved.slice(0, separator) === 'staged' ? 'unstaged' : 'staged'}:${firstRemoved.slice(separator + 1)}`;
  const primary =
    selectedAfterRemoval ??
    (movedKey !== null && remaining.has(movedKey) ? movedKey : null) ??
    nearestRowAfterRemoval(keysInVisualOrder, remaining, removedKeys) ??
    [...remaining][0] ??
    null;
  if (primary !== null) selection.add(primary);
  return { selection, primary };
}
