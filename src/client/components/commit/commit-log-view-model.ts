interface CommitLogFilterable {
  subject?: unknown;
  author?: unknown;
  hash?: unknown;
}

export interface CommitLogInitialLoadState {
  activity: string;
  authorReady: boolean;
  panelVisible: boolean;
  mode: string;
  gitReady: boolean;
  isRepo: boolean;
  commitCount: number;
  exhausted: boolean;
  loading: boolean;
  failed: boolean;
}

export function shouldLoadCommitLogOnOpen(state: CommitLogInitialLoadState): boolean {
  return (
    state.activity === 'commit' &&
    state.authorReady &&
    state.panelVisible &&
    state.mode === 'log' &&
    state.gitReady &&
    state.isRepo &&
    state.commitCount === 0 &&
    !state.exhausted &&
    !state.loading &&
    !state.failed
  );
}

export function commitLogOptionId(hash: string): string {
  return `dsh-editor-commit-log-option-${encodeURIComponent(hash)}`;
}

/**
 * Reveal the selected commit after the visible row set changes.
 *
 * Full-history search replaces the loaded page with a small result set. When
 * the query is cleared, the selected commit can be far below the restored
 * list's current scroll position, so the list must bring its row back into
 * view instead of leaving the detail pane pointing at an invisible row.
 */
export function revealCommitLogSelection(list: HTMLElement | null, hash: string | null): void {
  if (list === null || typeof hash !== 'string' || hash === '') return;
  const target = list.querySelector<HTMLElement>(`#${commitLogOptionId(hash)}`);
  target?.scrollIntoView?.({ block: 'nearest' });
}

export function commitLogDisplayTitle(baseTitle: string, query: string): string {
  const base = typeof baseTitle === 'string' ? baseTitle.trim() : '';
  const needle = typeof query === 'string' ? query.trim() : '';
  if (base === '') return needle === '' ? '' : `'${needle}'`;
  return needle === '' ? base : `${base}: '${needle}'`;
}

export function commitLogFilterCommits<T extends CommitLogFilterable>(commits: T[], query: string): T[] {
  const needle = typeof query === 'string' ? query.trim().toLowerCase() : '';
  if (needle === '') return commits;
  return commits.filter((commit) =>
    [commit.subject, commit.author, commit.hash].some(
      (value) => typeof value === 'string' && value.toLowerCase().includes(needle),
    ),
  );
}

export interface CommitLogLoadMoreState {
  graphMode: boolean;
  loading: boolean;
  exhausted: boolean;
  failed: boolean;
  commitCount: number;
  visibleCount: number;
  searchMode?: boolean;
}

export type CommitLogLoadMorePlacement = 'none' | 'no-matches' | 'footer';

/**
 * Decide where an explicit Load More action belongs.
 *
 * The flat log normally pages on scroll. A text filter can reduce the loaded
 * page to zero rows, which removes the scrollbar and makes older matching
 * commits unreachable. Keep the action visible in that state, and also offer
 * it at the footer when rows are present but the history is not exhausted.
 */
export function commitLogLoadMorePlacement(state: CommitLogLoadMoreState): CommitLogLoadMorePlacement {
  if (
    state.searchMode ||
    state.graphMode ||
    state.loading ||
    state.exhausted ||
    state.failed ||
    state.commitCount === 0
  )
    return 'none';
  return state.visibleCount === 0 ? 'no-matches' : 'footer';
}
