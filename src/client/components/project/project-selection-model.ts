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

export interface ProjectSpeedSearchReturnSelection {
  selection: Set<string>;
  primary: string | null;
}

/**
 * Restore the selection that existed before speed search when its primary row
 * is still visible in the newly selected Project view.
 *
 * Speed search temporarily moves the cursor to the first hit. Switching views
 * closes the search, so keeping that transient hit would either select an
 * unrelated row or force the filtered-view fallback to the first row. The
 * pre-search selection is the user's real navigation context when it survives
 * the view change; otherwise the caller keeps the normal filtered-view
 * reconciliation.
 */
export function projectSpeedSearchSelectionAfterViewChange(
  previous: ProjectSpeedSearchReturnSelection | null | undefined,
  rows: ProjectTreeSelectionRow[] | null | undefined,
): ProjectSpeedSearchReturnSelection | null {
  const primary = typeof previous?.primary === 'string' && previous.primary !== '' ? previous.primary : null;
  if (previous === null || previous === undefined || primary === null) return null;
  const visible = new Set(
    (Array.isArray(rows) ? rows : [])
      .filter((row) => row?.kind !== 'placeholder')
      .map((row) => row.path)
      .filter((path) => typeof path === 'string' && path !== ''),
  );
  if (!visible.has(primary)) return null;
  const selection = new Set(
    [...(previous.selection instanceof Set ? previous.selection : [])].filter(
      (path) => typeof path === 'string' && visible.has(path),
    ),
  );
  selection.add(primary);
  return { selection, primary };
}

/** Scroll one rendered Project row into view and return keyboard ownership to the tree. */
export function revealProjectRowElement(rowRefs: { current: Map<string, HTMLElement> }, path: string): void {
  const row = rowRefs.current.get(path);
  row?.scrollIntoView({ block: 'center' });
  document.querySelector<HTMLElement>('[data-dsh-project-tree]')?.focus({ preventScroll: true });
}

export type ProjectTreeSelectionModifiers = Pick<ProjectTreeSelectionRequest, 'metaKey' | 'ctrlKey' | 'shiftKey'>;

export interface ProjectFileComparisonActionOptions {
  batchSize: number;
  path: string;
  compareWithClipboard: (path: string) => void;
  compareWithRevision: (path: string) => void;
  t: (key: string) => string;
}

/** Single-path comparisons stay enabled only while the Project selection is singular. */
export function projectFileComparisonActions({
  batchSize,
  path,
  compareWithClipboard,
  compareWithRevision,
  t,
}: ProjectFileComparisonActionOptions) {
  const disabled = batchSize > 1;
  return [
    {
      id: 'compareClipboard',
      label: t('editor.compareWithClipboard'),
      disabled,
      run: (): void => compareWithClipboard(path),
    },
    {
      id: 'compareRevision',
      label: t('editor.compareWithRevision'),
      disabled,
      run: (): void => compareWithRevision(path),
    },
  ];
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

/** Whether collapsing one directory would hide the current primary row. */
export function projectPrimaryHiddenByCollapse(directory: unknown, selectedPath: unknown): boolean {
  return (
    typeof directory === 'string' &&
    directory !== '' &&
    typeof selectedPath === 'string' &&
    selectedPath !== directory &&
    selectedPath.startsWith(`${directory}/`)
  );
}

/** Remove hidden descendants while retaining outside selections and the directory. */
export function projectSelectionAfterDirectoryCollapse(
  selection: Iterable<string> | null | undefined,
  directory: unknown,
  includeDirectory = true,
): Set<string> {
  const next = new Set<string>();
  const path = typeof directory === 'string' ? directory : '';
  const prefix = path === '' ? '' : `${path}/`;
  let directorySelected = false;
  for (const entry of selection ?? []) {
    if (typeof entry !== 'string') continue;
    if (path !== '' && entry === path) {
      directorySelected = true;
      continue;
    }
    if (path !== '' && entry.startsWith(prefix)) continue;
    next.add(entry);
  }
  if (path !== '' && (includeDirectory || directorySelected)) next.add(path);
  return next;
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
