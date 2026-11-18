export interface GotoLinePosition {
  line: number;
  column: number;
}

export interface GotoLineShortcutEvent {
  key?: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  isComposing?: boolean;
}

export function parseGotoLinePosition(value: unknown): GotoLinePosition | null {
  const match = /^(\d+)(?:\s*[:,]\s*(\d+))?$/u.exec(String(value ?? '').trim());
  if (match === null) return null;
  const line = Number(match[1]);
  const column = match[2] === undefined ? 1 : Number(match[2]);
  if (!Number.isSafeInteger(line) || !Number.isSafeInteger(column) || line < 1 || column < 1) return null;
  return { line, column };
}

export function gotoLineShortcutMatches(event: GotoLineShortcutEvent | null | undefined): boolean {
  if (event === null || typeof event !== 'object' || event.isComposing === true) return false;
  return (
    event.key?.toLowerCase?.() === 'l' &&
    (event.metaKey === true || event.ctrlKey === true) &&
    event.altKey !== true &&
    event.shiftKey !== true
  );
}
