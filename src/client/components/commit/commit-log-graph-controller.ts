interface GraphRowIdentity {
  hash: string;
}

interface GraphCursorMove {
  hash: string;
  index: number;
}

type GraphKeyIntent =
  | { type: 'context' }
  | { type: 'relation'; direction: 'parents' | 'children' }
  | { type: 'move'; delta: -1 | 1 }
  | { type: 'first' }
  | { type: 'last' }
  | { type: 'current' }
  | null;

export function commitLogGraphCursor(rows: GraphRowIdentity[], cursor: string | null): string | null {
  if (rows.length === 0) return null;
  if (cursor !== null && rows.some((row) => row.hash === cursor)) return cursor;
  return rows[0].hash;
}

export function commitLogGraphMove(
  rows: GraphRowIdentity[],
  cursor: string | null,
  hover: string | null,
  delta: -1 | 1,
): GraphCursorMove | null {
  if (rows.length === 0) return null;
  const cursorIndex = cursor === null ? -1 : rows.findIndex((row) => row.hash === cursor);
  const hoverIndex = hover === null ? -1 : rows.findIndex((row) => row.hash === hover);
  const base = cursorIndex >= 0 ? cursorIndex : hoverIndex;
  const next = base < 0 ? (delta > 0 ? 0 : rows.length - 1) : base + delta;
  const index = Math.max(0, Math.min(next, rows.length - 1));
  return {
    hash: rows[index].hash,
    index,
  };
}

export function commitLogGraphKeyIntent(key: string, shiftKey: boolean): GraphKeyIntent {
  if (key === 'ContextMenu' || (shiftKey === true && key === 'F10')) return { type: 'context' };
  if (key === 'ArrowRight') return { type: 'relation', direction: 'parents' };
  if (key === 'ArrowLeft') return { type: 'relation', direction: 'children' };
  if (key === 'ArrowDown') return { type: 'move', delta: 1 };
  if (key === 'ArrowUp') return { type: 'move', delta: -1 };
  if (key === 'Home') return { type: 'first' };
  if (key === 'End') return { type: 'last' };
  if (key === 'Enter') return { type: 'current' };
  return null;
}
