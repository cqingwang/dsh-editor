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
