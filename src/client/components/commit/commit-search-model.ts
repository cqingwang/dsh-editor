export interface CommitSearchEntry {
  hash?: string;
  subject?: string;
  author?: string;
}

/** Score one commit against IDEA's revision-picker query. */
export function commitSearchScore(commit?: CommitSearchEntry | null, query?: string): number {
  const needle = typeof query === 'string' ? query.trim().toLowerCase() : '';
  if (needle === '') return 0;
  const hash = typeof commit?.hash === 'string' ? commit.hash.toLowerCase() : '';
  if (hash.startsWith(needle)) return 1000;
  const subject = typeof commit?.subject === 'string' ? commit.subject.toLowerCase() : '';
  const author = typeof commit?.author === 'string' ? commit.author.toLowerCase() : '';
  let score = 0;
  if (subject.includes(needle)) score += 100;
  if (author.includes(needle)) score += 50;
  return score === 0 ? -1 : score;
}
