export interface EditorTerminalIdentity {
  id: string;
}

export interface EditorTerminalMetadata {
  title?: string;
  cwd?: string;
}

export function updateEditorTerminalMetadata(
  current: Record<string, EditorTerminalMetadata>,
  id: string,
  patch: EditorTerminalMetadata,
): Record<string, EditorTerminalMetadata> {
  if (typeof id !== 'string' || id === '') return current;
  const previous = current[id] ?? {};
  const next = {
    ...previous,
    ...(typeof patch.title === 'string' && patch.title !== '' ? { title: patch.title } : null),
    ...(typeof patch.cwd === 'string' && patch.cwd !== '' ? { cwd: patch.cwd } : null),
  };
  if (next.title === previous.title && next.cwd === previous.cwd) return current;
  return { ...current, [id]: next };
}

export function editorTerminalsWithMetadata<T extends EditorTerminalIdentity & { title: string; cwd: string }>(
  terminals: T[],
  metadata: Record<string, EditorTerminalMetadata>,
): T[] {
  let changed = false;
  const next = terminals.map((terminal) => {
    const patch = metadata[terminal.id];
    if (patch === undefined) return terminal;
    const merged = {
      ...terminal,
      ...(patch.title === undefined ? null : { title: patch.title }),
      ...(patch.cwd === undefined ? null : { cwd: patch.cwd }),
    };
    if (merged.title !== terminal.title || merged.cwd !== terminal.cwd) changed = true;
    return merged;
  });
  return changed ? next : terminals;
}

export function editorTerminalActiveAfterChange(
  previousIds: string[],
  terminals: EditorTerminalIdentity[],
  activeId: string | null,
): string | null {
  const currentIds = terminals.map((terminal) => terminal.id).filter((id) => typeof id === 'string' && id !== '');
  if (currentIds.length === 0) return null;
  const previous = new Set(previousIds.filter((id) => typeof id === 'string' && id !== ''));
  const added = currentIds.filter((id) => !previous.has(id));
  if (added.length > 0) return added[added.length - 1];
  if (activeId !== null && currentIds.includes(activeId)) return activeId;
  return currentIds[currentIds.length - 1];
}

export function editorTerminalTabTargetIndex(index: number, count: number, key: string): number | null {
  if (!Number.isInteger(index) || !Number.isInteger(count) || count <= 0 || index < 0 || index >= count) return null;
  if (key === 'ArrowLeft') return (index - 1 + count) % count;
  if (key === 'ArrowRight') return (index + 1) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}
