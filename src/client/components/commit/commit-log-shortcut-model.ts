type CommitLogShortcutAction = 'focusFilter' | 'findInFiles' | null;

export function commitLogShortcutAction(
  key: string,
  metaKey: boolean,
  ctrlKey: boolean,
  altKey: boolean,
  shiftKey: boolean,
): CommitLogShortcutAction {
  if ((metaKey !== true && ctrlKey !== true) || altKey === true || shiftKey === true) return null;
  const normalized = typeof key === 'string' ? key.toLowerCase() : '';
  if (normalized === 'l') return 'focusFilter';
  if (normalized === 'f') return 'findInFiles';
  return null;
}
