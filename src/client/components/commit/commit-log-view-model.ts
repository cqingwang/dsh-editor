interface CommitLogFilterable {
  subject?: unknown;
  author?: unknown;
  hash?: unknown;
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
