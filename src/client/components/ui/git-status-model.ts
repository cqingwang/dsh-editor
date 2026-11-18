export interface GitStatusInfo {
  label: string;
  color: string;
}

/** Status color and compact label for one git porcelain status. */
export function gitStatusInfo(status?: string): GitStatusInfo | null {
  if (status === undefined) return null;
  if (status === '??') return { label: 'U', color: '#6e7781' };
  const index = status[0];
  const worktree = status[1];
  if (index === 'R' || index === 'C') return { label: index, color: '#8250df' };
  if (index === 'A') return { label: 'A', color: '#1a7f37' };
  if (index === 'D' || worktree === 'D') return { label: 'D', color: '#cf222e' };
  if (index === 'U' || worktree === 'U') return { label: '!', color: '#cf222e' };
  if (index === 'M') return { label: 'M', color: '#2f65ca' };
  if (worktree === 'M') return { label: 'M↓', color: '#2f65ca' };
  if (worktree === 'A') return { label: 'A', color: '#1a7f37' };
  return { label: '±', color: '#2f65ca' };
}
