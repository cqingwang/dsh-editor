interface CommitLogGraphIntent {
  type: 'context' | 'relation' | 'move' | 'first' | 'last' | 'current';
  direction?: 'parents' | 'children';
  delta?: -1 | 1;
}

interface CommitLogFlatIntent {
  type: 'context' | 'selectAll' | 'relation' | 'action';
  direction?: 'parents' | 'children';
  action?: 'next' | 'previous' | 'first' | 'last' | 'current';
}

interface CommitLogRowIdentity {
  hash?: string;
}

type CommitLogGraphListCommand =
  | {
      type: 'context';
    }
  | {
      type: 'relation';
      direction: 'parents' | 'children';
    }
  | {
      type: 'move';
      delta: -1 | 1;
    }
  | {
      type: 'show';
      hash: string;
    }
  | {
      type: 'select';
      hash: string;
    }
  | null;

type CommitLogFlatListCommand =
  | {
      type: 'context';
    }
  | {
      type: 'selectAll';
      hashes: string[];
    }
  | {
      type: 'relation';
      direction: 'parents' | 'children';
    }
  | {
      type: 'row';
      action: 'next' | 'previous' | 'first' | 'last' | 'current';
    }
  | null;

function commitLogRowHashes(rows: CommitLogRowIdentity[]): string[] {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => row?.hash)
    .filter((hash): hash is string => typeof hash === 'string' && hash !== '');
}

export function commitLogGraphListCommand(
  intent: CommitLogGraphIntent | null,
  rows: CommitLogRowIdentity[],
  cursor: string | null,
): CommitLogGraphListCommand {
  if (intent === null) return null;
  if (intent.type === 'context') return { type: 'context' };
  if (intent.type === 'relation') {
    return {
      type: 'relation',
      direction: intent.direction === 'children' ? 'children' : 'parents',
    };
  }
  if (intent.type === 'move') {
    return {
      type: 'move',
      delta: intent.delta === -1 ? -1 : 1,
    };
  }
  const hashes = commitLogRowHashes(rows);
  if (intent.type === 'current') {
    return cursor !== null && hashes.includes(cursor)
      ? {
          type: 'show',
          hash: cursor,
        }
      : null;
  }
  if (hashes.length === 0) return null;
  return {
    type: 'select',
    hash: intent.type === 'first' ? hashes[0] : hashes[hashes.length - 1],
  };
}

export function commitLogFlatListCommand(
  intent: CommitLogFlatIntent | null,
  rows: CommitLogRowIdentity[],
): CommitLogFlatListCommand {
  if (intent === null) return null;
  if (intent.type === 'context') return { type: 'context' };
  if (intent.type === 'selectAll') {
    return {
      type: 'selectAll',
      hashes: commitLogRowHashes(rows),
    };
  }
  if (intent.type === 'relation') {
    return {
      type: 'relation',
      direction: intent.direction === 'children' ? 'children' : 'parents',
    };
  }
  if (intent.action === undefined) return null;
  return {
    type: 'row',
    action: intent.action,
  };
}
