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

/**
 * Keep the graph cursor on the commit whose detail is already visible.
 *
 * Scope changes can invalidate the old cursor while the selected commit is
 * still present. Falling back to the first row in that case would highlight a
 * different commit than the detail pane.
 */
export function commitLogGraphPreferredCursor(
  rows: GraphRowIdentity[],
  cursor: string | null,
  selected: string | null,
): string | null {
  if (selected !== null && rows.some((row) => row.hash === selected)) return selected;
  return commitLogGraphCursor(rows, cursor);
}

/**
 * Keep the detail pane on a commit that the visible graph actually contains.
 *
 * Branch/tag scope and the local graph filter can remove the previously
 * selected commit. The graph cursor already falls back to the first row; the
 * detail pane must follow it instead of showing a commit outside the graph.
 */
export function commitLogGraphSelection(rows: GraphRowIdentity[], selected: string | null): string | null {
  if (rows.length === 0) return selected;
  if (selected !== null && rows.some((row) => row.hash === selected)) return selected;
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
