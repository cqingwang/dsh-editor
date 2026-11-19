export interface HarnessSurfaceRoot {
  hasAttribute: (name: string) => boolean;
}

export interface WorkspaceDirectoryEntry {
  name: string;
  path: string;
  hidden: boolean;
}

export interface WorkspaceDirectoryListing {
  path: string;
  home: string;
  entries: WorkspaceDirectoryEntry[];
}

export interface WorkspaceDirectoryTreeRow {
  path: string;
  name: string;
  kind: 'directory';
  depth: number;
  root?: boolean;
  continues?: boolean[];
  searchOpen?: boolean;
}

export interface WorkspaceDirectorySuggestion {
  name: string;
  path: string;
  displayPath: string;
}

export interface WorkspaceDirectoryAutocompleteQuery {
  requestPath: string;
  prefix: string;
}

export interface WorkspaceDirectoryPickerGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Recognize the Host's explicit "native-only" directory-picker refusal.
 * That is the one public-service failure where the editor's read-only
 * directory bridge is the intended compatibility path.
 */
export function isDirectoryBrowseUnavailable(reason: unknown): boolean {
  const message = reason instanceof Error ? reason.message : String(reason);
  return message.includes('directory-picker/unavailable');
}

/** Default directory-picker geometry that never exceeds the current viewport. */
export function workspaceDirectoryPickerGeometry(
  viewportWidth: unknown,
  viewportHeight: unknown,
): WorkspaceDirectoryPickerGeometry {
  const width = Math.max(1, Math.min(760, Math.floor(Number(viewportWidth) || 0) - 32));
  const height = Math.max(1, Math.min(560, Math.floor(Number(viewportHeight) || 0) - 32));
  return {
    x: Math.max(16, Math.round((Math.floor(Number(viewportWidth) || 0) - width) / 2)),
    y: Math.max(16, Math.round((Math.floor(Number(viewportHeight) || 0) - height) / 2)),
    width,
    height,
  };
}

/** The host marks the desktop App on the document root. Web has no platform attribute. */
export function isDesktopHarnessSurface(root: HarnessSurfaceRoot | null | undefined): boolean {
  return root?.hasAttribute('data-platform') === true;
}

function normalizedAbsolutePath(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().replace(/\\/gu, '/');
  if (trimmed === '') return '';
  if (trimmed === '/') return '/';
  return trimmed.replace(/\/+$/u, '');
}

/** Basename that works for POSIX and Windows paths without importing Node in the browser. */
export function directoryBaseName(path: unknown): string {
  const normalized = normalizedAbsolutePath(path);
  if (normalized === '') return '';
  if (normalized === '/') return '/';
  const segments = normalized.split('/');
  return segments[segments.length - 1] ?? normalized;
}

/** Parent directory for an absolute POSIX/Windows-normalized path. */
export function directoryPathParent(path: unknown): string {
  const normalized = normalizedAbsolutePath(path);
  if (normalized === '' || normalized === '/') return normalized;
  const separator = normalized.lastIndexOf('/');
  if (separator <= 0) return '/';
  return normalized.slice(0, separator);
}

/** Whether one normalized directory path is the same as or below another. */
export function directoryPathIsWithin(parent: unknown, child: unknown): boolean {
  const normalizedParent = normalizedAbsolutePath(parent);
  const normalizedChild = normalizedAbsolutePath(child);
  if (normalizedParent === '' || normalizedChild === '') return false;
  if (normalizedParent === normalizedChild) return true;
  return normalizedParent === '/' || normalizedChild.startsWith(`${normalizedParent}/`);
}

/** Whether an explicit path contains a hidden directory segment. */
export function directoryPathHasHiddenSegment(path: unknown): boolean {
  const normalized = normalizedAbsolutePath(path);
  if (normalized === '' || normalized === '/') return false;
  return normalized
    .split('/')
    .some((segment) => segment !== '' && segment !== '.' && segment !== '..' && segment.startsWith('.'));
}

/** Render the home directory as IDEA's compact `~` path while keeping it absolute on the wire. */
export function displayWorkspaceDirectoryPath(path: unknown, home: unknown): string {
  const normalizedPath = normalizedAbsolutePath(path);
  const normalizedHome = normalizedAbsolutePath(home);
  if (normalizedPath === '') return '';
  if (normalizedHome === '' || normalizedHome === '/') return normalizedPath;
  if (normalizedPath === normalizedHome) return '~';
  if (normalizedPath.startsWith(`${normalizedHome}/`)) return `~${normalizedPath.slice(normalizedHome.length)}`;
  return normalizedPath;
}

/** Expand a displayed `~` path back to the absolute home path before host I/O. */
export function resolveWorkspaceDirectoryPath(path: unknown, home: unknown): string {
  const normalizedPath = normalizedAbsolutePath(path);
  const normalizedHome = normalizedAbsolutePath(home);
  if (normalizedPath === '') return '';
  if (normalizedHome !== '' && normalizedPath === '~') return normalizedHome;
  if (normalizedHome !== '' && normalizedPath.startsWith('~/')) {
    return `${normalizedHome}${normalizedPath.slice(1)}`;
  }
  return normalizedPath;
}

function isAbsoluteDirectoryPath(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:\//u.test(path);
}

/**
 * Split a path draft into the directory level to query and the completion
 * prefix in that level. A trailing separator browses the named directory.
 */
export function workspaceDirectoryAutocompleteQuery(
  path: unknown,
  home: unknown,
): WorkspaceDirectoryAutocompleteQuery | null {
  const resolved = resolveWorkspaceDirectoryPath(path, home);
  if (!isAbsoluteDirectoryPath(resolved)) return null;
  const typed = typeof path === 'string' ? path.trim().replace(/\\/gu, '/') : '';
  if (typed.endsWith('/')) return { requestPath: resolved, prefix: '' };
  return {
    requestPath: directoryPathParent(resolved),
    prefix: directoryBaseName(resolved),
  };
}

/** Filter loaded directories into display-ready path completions. */
export function workspaceDirectorySuggestions(
  entries: readonly WorkspaceDirectoryEntry[],
  prefix: string,
  home: string,
  showHidden: boolean,
  limit = 12,
): WorkspaceDirectorySuggestion[] {
  const needle = typeof prefix === 'string' ? prefix.toLowerCase() : '';
  const maximum = Math.max(1, Math.floor(Number(limit) || 12));
  return entries
    .filter((entry) => showHidden || !entry.hidden || needle.startsWith('.'))
    .filter((entry) => entry.name.toLowerCase().startsWith(needle))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' }))
    .slice(0, maximum)
    .map((entry) => ({
      name: entry.name,
      path: entry.path,
      displayPath: displayWorkspaceDirectoryPath(entry.path, home),
    }));
}

/**
 * Convert the host's directory-picker response into the narrow tree row model.
 * The host browse backend returns directories only; a defensive kind filter
 * keeps a future mixed listing from exposing files through a directory selector.
 */
export function normalizeHostDirectoryListing(value: unknown, fallbackPath = ''): WorkspaceDirectoryListing {
  const record = value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const path = normalizedAbsolutePath(record.path) || normalizedAbsolutePath(fallbackPath);
  const home = normalizedAbsolutePath(record.home);
  const rows = Array.isArray(record.entries) ? record.entries : [];
  const seen = new Set<string>();
  const entries: WorkspaceDirectoryEntry[] = [];
  for (const row of rows) {
    if (row === null || typeof row !== 'object') continue;
    const entry = row as Record<string, unknown>;
    if (entry.kind !== undefined && entry.kind !== 'directory') continue;
    const entryPath = normalizedAbsolutePath(entry.path);
    if (entryPath === '' || seen.has(entryPath)) continue;
    const name =
      typeof entry.name === 'string' && entry.name.trim() !== '' ? entry.name.trim() : directoryBaseName(entryPath);
    if (name === '') continue;
    seen.add(entryPath);
    entries.push({
      name,
      path: entryPath,
      hidden: entry.hidden === true || name.startsWith('.'),
    });
  }
  entries.sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' }));
  return { path, home, entries };
}

export interface FlattenDirectoryTreeOptions {
  rootPath: string;
  rootName: string;
  expanded: ReadonlySet<string>;
  showHidden: boolean;
  childrenByPath: ReadonlyMap<string, readonly WorkspaceDirectoryEntry[]>;
}

/** Flatten loaded directories into the same depth-first row contract Project uses. */
export function flattenDirectoryTreeRows(options: FlattenDirectoryTreeOptions): WorkspaceDirectoryTreeRow[] {
  const rootPath = normalizedAbsolutePath(options.rootPath);
  if (rootPath === '') return [];
  const rows: WorkspaceDirectoryTreeRow[] = [];
  const visited = new Set<string>();
  const visit = (path: string, name: string, depth: number, root: boolean): void => {
    if (visited.has(path)) return;
    visited.add(path);
    rows.push({
      path,
      name,
      kind: 'directory',
      depth,
      ...(root ? { root: true } : null),
    });
    if (!options.expanded.has(path)) return;
    const children = options.childrenByPath.get(path) ?? [];
    for (const child of children) {
      if (!options.showHidden && child.hidden) continue;
      visit(child.path, child.name, depth + 1, false);
    }
  };
  visit(rootPath, options.rootName || directoryBaseName(rootPath), 0, true);
  return rows;
}
