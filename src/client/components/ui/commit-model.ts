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
