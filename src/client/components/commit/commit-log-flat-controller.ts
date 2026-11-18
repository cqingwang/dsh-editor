type FlatLogAction = 'next' | 'previous' | 'first' | 'last' | 'current';

type FlatKeyIntent =
  | { type: 'context' }
  | { type: 'selectAll' }
  | { type: 'relation'; direction: 'parents' | 'children' }
  | { type: 'action'; action: FlatLogAction }
  | null;

export function commitLogFlatKeyIntent(
  key: string,
  metaKey: boolean,
  ctrlKey: boolean,
  shiftKey: boolean,
): FlatKeyIntent {
  if (key === 'ContextMenu' || (shiftKey === true && key === 'F10')) return { type: 'context' };
  if ((metaKey === true || ctrlKey === true) && key.toLowerCase() === 'a') return { type: 'selectAll' };
  if (key === 'ArrowRight') return { type: 'relation', direction: 'parents' };
  if (key === 'ArrowLeft') return { type: 'relation', direction: 'children' };
  if (key === 'ArrowDown') return { type: 'action', action: 'next' };
  if (key === 'ArrowUp') return { type: 'action', action: 'previous' };
  if (key === 'Home') return { type: 'action', action: 'first' };
  if (key === 'End') return { type: 'action', action: 'last' };
  if (key === 'Enter') return { type: 'action', action: 'current' };
  return null;
}
