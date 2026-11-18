interface CommitGraphLike {
  entries?: unknown[];
  branch?: unknown;
  at?: unknown;
}

interface CommitGraphPlaceholder {
  kind: 'loading' | 'branch-empty' | 'ref-empty' | 'empty';
  messageKey: 'editor.loading' | 'editor.graphNoCommitsOnBranch' | 'editor.graphNoCommitsOnRef' | 'editor.noCommits';
}

export function commitGraphPlaceholder(
  graph: CommitGraphLike | null | undefined,
  error: string | null = null,
): CommitGraphPlaceholder | null {
  if (graph == null) {
    return error !== null && error !== ''
      ? null
      : {
          kind: 'loading',
          messageKey: 'editor.loading',
        };
  }
  const entries = Array.isArray(graph.entries) ? graph.entries : [];
  if (entries.length > 0) return null;
  if (error !== null && error !== '') return null;
  if (typeof graph.branch === 'string' && graph.branch !== '') {
    return {
      kind: 'branch-empty',
      messageKey: 'editor.graphNoCommitsOnBranch',
    };
  }
  if (typeof graph.at === 'string' && graph.at !== '') {
    return {
      kind: 'ref-empty',
      messageKey: 'editor.graphNoCommitsOnRef',
    };
  }
  return {
    kind: 'empty',
    messageKey: 'editor.noCommits',
  };
}
