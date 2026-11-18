export interface ProjectTreeSelectionRow {
  path: string;
  kind?: string;
  root?: boolean;
}

export interface ProjectTreeSelectionRequest {
  rows: ProjectTreeSelectionRow[];
  selection?: Set<string>;
  primary?: string | null;
  anchor?: string | null;
  path?: unknown;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
}

export interface ProjectTreeSelectionResult {
  selection: Set<string>;
  primary: string | null;
  anchor: string | null;
}

export function projectTreeSelectionAfterPointer(
  request: ProjectTreeSelectionRequest | null | undefined,
): ProjectTreeSelectionResult {
  const rows = Array.isArray(request?.rows) ? request.rows : [];
  const paths = rows.filter((row) => row?.kind !== 'placeholder').map((row) => row.path);
  const path = typeof request?.path === 'string' ? request.path : '';
  const known = new Set(paths);
  const current = new Set(
    [...(request?.selection instanceof Set ? request.selection : [])].filter(
      (entry) => typeof entry === 'string' && known.has(entry),
    ),
  );
  if (!known.has(path)) {
    return {
      selection: current,
      primary: request?.primary ?? null,
      anchor: request?.anchor ?? null,
    };
  }
  const anchor = typeof request?.anchor === 'string' && known.has(request.anchor) ? request.anchor : null;
  if (request?.shiftKey === true && anchor !== null) {
    const from = paths.indexOf(anchor);
    const to = paths.indexOf(path);
    const [start, end] = from <= to ? [from, to] : [to, from];
    return {
      selection: new Set(paths.slice(start, end + 1)),
      primary: path,
      anchor,
    };
  }
  if (request?.metaKey === true || request?.ctrlKey === true) {
    if (current.has(path)) current.delete(path);
    else current.add(path);
    let primary: string | null = null;
    if (current.has(path)) {
      primary = path;
    } else {
      const remaining = paths.filter((entry) => current.has(entry));
      if (remaining.length > 0) {
        const clickedIndex = paths.indexOf(path);
        primary = remaining[Math.min(clickedIndex, remaining.length - 1)] ?? remaining[remaining.length - 1];
      }
    }
    return {
      selection: current,
      primary,
      anchor: primary,
    };
  }
  return {
    selection: new Set([path]),
    primary: path,
    anchor: path,
  };
}

/**
 * Resolve the visible row that should own a keyboard context menu.
 *
 * The Project tree focuses its scroll container rather than individual rows,
 * so Shift+F10/ContextMenu arrives on the tree. Root and placeholder rows do
 * not have a row-specific menu and intentionally fall back to the project root.
 */
export function projectContextMenuRowAfterKeyboard<T extends ProjectTreeSelectionRow>(
  rows: T[] | null | undefined,
  selectedPath: unknown,
): T | null {
  if (!Array.isArray(rows) || typeof selectedPath !== 'string' || selectedPath === '') return null;
  const row = rows.find((entry) => entry?.path === selectedPath && entry.kind !== 'placeholder' && entry.root !== true);
  return row ?? null;
}

export interface ProjectRowMenuCapabilities {
  isDirectory: boolean;
  isRoot: boolean;
  showDirectoryActions: boolean;
  showFileActions: boolean;
  showReveal: boolean;
}

/** Keep Project context actions scoped to the row kind they can actually affect. */
export function projectRowMenuCapabilities(
  row: ProjectTreeSelectionRow | null | undefined,
  filteredView: unknown,
): ProjectRowMenuCapabilities {
  const isDirectory = row?.kind === 'directory';
  const isRoot = row?.path === '';
  return {
    isDirectory,
    isRoot,
    showDirectoryActions: isDirectory && !isRoot,
    showFileActions: !isDirectory && !isRoot,
    showReveal: !isRoot && (isDirectory || filteredView === true),
  };
}
