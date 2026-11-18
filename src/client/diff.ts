/* diff.ts: dsh-editor Commit/Diff model module. Generated into lib/client.js by scripts/build-client.mjs. */
import { dirname } from './components/editor/editor-path-model';
import { basename } from './editor-core';

export interface DiffChange {
  path: string;
  status: string;
  staged?: boolean;
  stagedLines?: { additions: number; deletions: number; binary?: boolean };
  unstagedLines?: { additions: number; deletions: number; binary?: boolean };
  [key: string]: unknown;
}

interface DiffChangeBands {
  staged: DiffChange[];
  unstaged: DiffChange[];
  unversioned: DiffChange[];
}

export interface DiffTarget {
  path: string;
  staged?: boolean;
  replaceSelection?: boolean;
  shift?: boolean;
  toggle?: boolean;
  row?: HTMLElement;
  [key: string]: unknown;
}

interface DiffFilePosition {
  index: number;
  total: number;
}

interface DiffToolbarAction {
  id?: string;
  group?: string;
  icon?: string;
  label?: string;
  disabled?: boolean;
  active?: boolean;
  run?: (...args: unknown[]) => void;
  items?: DiffToolbarAction[];
  [key: string]: unknown;
}

export type DiffTreeFile = DiffChange;

export interface DiffTreeNode {
  name: string;
  path: string;
  directories: Map<string, DiffTreeNode>;
  files: DiffChange[];
}

export interface DiffRow {
  kind: 'directory' | 'file';
  path: string;
  name: string;
  depth: number;
  parent?: string;
  open?: boolean;
  collapseKey?: string;
  change?: DiffTreeFile;
  changes?: DiffChange[];
}

interface DiffKeyboardEvent {
  key?: unknown;
  ctrlKey?: unknown;
  metaKey?: unknown;
  altKey?: unknown;
  shiftKey?: unknown;
}

interface CombinedDiffFile {
  line?: number;
  endLine?: number;
  originalLine?: number;
  originalEndLine?: number;
  [key: string]: unknown;
}

export function splitChanges(changes: DiffChange[]): DiffChangeBands {
  const staged = [];
  const unstaged = [];
  /* IDEA keeps brand-new files in their own "Unversioned Files" node. */
  const unversioned = [];
  for (const change of changes) {
    const index = change.status[0];
    const worktree = change.status[1];
    if (change.status === '??') {
      unversioned.push(change);
      continue;
    }
    if (index !== ' ' && index !== '?') staged.push(change);
    if (worktree !== ' ') unstaged.push(change);
  }
  return { staged, unstaged, unversioned };
}

/**
 * Paths IDEA stages for Stage All / Stage All Tracked.
 *
 * An `MM` path has a staged side and a newer working side, so it belongs in
 * this list even though the porcelain row's `staged` flag is true. Reuse the
 * existing band split instead of re-reading porcelain status locally.
 * @param {object[]} changes - porcelain changes from the host.
 * @param {boolean} [trackedOnly=false] - omit untracked files.
 * @returns {string[]} unique workspace-relative paths with working-side changes.
 */
export function stageAllTargets(changes: DiffChange[], trackedOnly = false): string[] {
  const bands = splitChanges(Array.isArray(changes) ? changes : []);
  const rows = trackedOnly === true ? bands.unstaged : [...bands.unstaged, ...bands.unversioned];
  return [...new Set(rows.map((change) => change.path).filter((path) => typeof path === 'string' && path !== ''))];
}

/**
 * Which Changes band owns one row.
 *
 * Unversioned files use the working-tree selection namespace, but they are
 * rendered in their own group. Keeping that decision in one helper prevents
 * Group by reveal and diff navigation from disagreeing about the collapse key.
 * @param {object|undefined} change - git status entry.
 * @param {boolean} staged - whether the current identity is the index side.
 * @returns {'staged'|'unstaged'|'unversioned'} display group.
 */
export function changeRowGroup(change: DiffChange | undefined, staged: boolean): 'staged' | 'unstaged' | 'unversioned' {
  if (change?.status === '??') return 'unversioned';
  return staged === true ? 'staged' : 'unstaged';
}

/**
 * Count the leading Diff actions that fit beside the fixed controls.
 *
 * The toolbar cannot use a single compact/full breakpoint: at 521px the
 * previous full layout claimed to fit while the action group alone was
 * 524px wide, so its tail was clipped. Allocate real 24px action slots,
 * group separators and one overflow slot against the measured width left
 * after file navigation, hunk navigation, the hint and Close.
 * @param {number} width - measured toolbar width in CSS pixels.
 * @param {number} fixedWidth - measured non-action controls in CSS pixels.
 * @param {object[]} actions - ordered Diff actions.
 * @returns {number} number of leading actions that remain directly visible.
 */
export function diffDirectActionCountForWidth(width: number, fixedWidth: number, actions: DiffToolbarAction[]): number {
  const ordered = Array.isArray(actions)
    ? actions.filter((action) => action !== null && typeof action === 'object')
    : [];
  if (!Number.isFinite(width)) return ordered.length;
  const available = Math.max(
    0,
    /* The toolbar's own padding, inter-group gaps and the path title's
           minimum margin consume space that individual child rects do not
           report. Reserve that chrome before allocating action slots. */
    (Number(width) || 0) - Math.max(0, Number(fixedWidth) || 0) - 44,
  );
  for (let count = ordered.length; count >= 0; count -= 1) {
    const separators = groupDiffToolbarActions(ordered.slice(0, count)).filter((entry) => entry === null).length;
    const overflow = count < ordered.length ? 1 : 0;
    const itemCount = count + separators + overflow;
    const cost = count * 24 + separators * 5 + overflow * 24 + Math.max(0, itemCount - 1) * 2;
    if (cost <= available) return count;
  }
  return 0;
}

/**
 * How much of the changed-file navigator still fits in a diff toolbar.
 *
 * The full `‹ n/total ›` control is 88px. At 193px it pushed the fixed
 * hunk/overflow/close controls outside the pane, so medium widths keep the
 * counter as one clickable chip and the narrowest widths drop it entirely.
 * Keyboard ⌃⇧←/→ remains available at every tier.
 * @param {number} width - measured diff toolbar width.
 * @returns {'full'|'compact'|'hidden'} file navigation presentation.
 */
export function diffFileNavModeForWidth(width: number): 'full' | 'compact' | 'hidden' {
  if (!Number.isFinite(width)) return 'full';
  if (width >= 224) return 'full';
  if (width >= 160) return 'compact';
  return 'hidden';
}

/**
 * IDEA presents Unified and Side-by-side as two adjacent mode buttons.
 *
 * Preserve that recognizable pair while the toolbar has room. In the
 * quarter-width diff the pair would push hunk/close controls out, so it
 * collapses to the same button count as the previous single toggle.
 * @param {number} width - measured diff toolbar width.
 * @returns {'paired'|'toggle'} presentation mode.
 */
export function diffViewModeControlForWidth(width: number): 'paired' | 'toggle' {
  if (!Number.isFinite(width)) return 'paired';
  return width >= 280 ? 'paired' : 'toggle';
}

/**
 * IDEA's included-state label for a local Commit diff.
 *
 * DSH selects whole files for commit, so only the two truthful states exist:
 * zero hunks included or every hunk included. An unchanged file has no label.
 * @param {number} total - changed blocks currently reported by Monaco.
 * @param {boolean} included - whether the file is checked in Commit.
 * @returns {'none'|'all'|null} summary state.
 */
export function diffIncludedSummaryState(total: number, included: boolean): 'all' | 'none' | null {
  const count = Number(total);
  if (!Number.isFinite(count) || count <= 0) return null;
  return included === true ? 'all' : 'none';
}

/**
 * Whether the IDEA-style difference summary fits without displacing controls.
 * @param {number} width - measured toolbar width.
 * @returns {boolean} true when the summary can be shown.
 */
export function diffSummaryVisibleForWidth(width: number): boolean {
  return !Number.isFinite(width) || width >= 380;
}

/**
 * Insert non-interactive separators where Diff actions change semantic group.
 *
 * IDEA registers Diff modes, selection and inspection actions in separate
 * toolbar groups. Keeping that grouping visible prevents the flat icon row
 * from reading as one undifferentiated command strip. The null entries are
 * consumed as separators by both the wide toolbar and the overflow menu.
 * @param {object[]} actions - ordered Diff toolbar actions.
 * @returns {Array<object|null>} actions plus group boundaries.
 */
export function groupDiffToolbarActions(actions: DiffToolbarAction[]): Array<DiffToolbarAction | null> {
  const entries: Array<DiffToolbarAction | null> = [];
  let previousGroup: string | null = null;
  for (const action of Array.isArray(actions) ? actions : []) {
    if (action === null || typeof action !== 'object') continue;
    const group = typeof action.group === 'string' ? action.group : null;
    if (group !== null && previousGroup !== null && group !== previousGroup) entries.push(null);
    entries.push(action);
    if (group !== null) previousGroup = group;
  }
  return entries;
}

/**
 * Whether the modified diff side may currently accept edits.
 *
 * Monaco has no per-action undo for arbitrary typed changes, so restoring a
 * gutter block and then locking the view must disable every write path
 * together: typing, undo/redo, selection restore and page mappings.
 * @param {{writable?: boolean, swapped?: boolean, locked?: boolean}|null} state - diff state.
 * @returns {boolean} true when the editable side is writable.
 */
export function diffEditingEnabled(
  state: { writable?: boolean; swapped?: boolean; locked?: boolean } | null | undefined,
): boolean {
  return state?.writable === true && state?.swapped !== true && state?.locked !== true;
}

/**
 * Whether a path still exists in the change band named by a row identity.
 *
 * Unversioned files use the `unstaged` selection namespace, but they live in
 * their own third band. Checking only `bands.unstaged` made the status poll
 * discard an open untracked-file diff immediately after it was opened.
 * @param {{staged: object[], unstaged: object[], unversioned: object[]}} bands - split changes.
 * @param {string} group - `staged` or `unstaged` row namespace.
 * @param {string} path - workspace-relative path.
 * @returns {boolean} true when the row still belongs to that namespace.
 */
export function listedInChangeBand(bands: DiffChangeBands | null | undefined, group: string, path: string): boolean {
  if (bands === null || typeof bands !== 'object' || typeof path !== 'string') return false;
  const band = group === 'staged' || group === 'unstaged' || group === 'unversioned' ? group : null;
  const listed = band !== null && bands[band].some((change) => change.path === path);
  if (listed) return true;
  return (
    group === 'unstaged' && Array.isArray(bands.unversioned) && bands.unversioned.some((change) => change.path === path)
  );
}

/**
 * Locate the combined-diff file whose heading owns a modified-side line.
 *
 * @param {{line?: number}[]} files - files in combined order.
 * @param {number} line - one-based modified editor line.
 * @returns {number} zero-based file index, clamped to the surrounding files.
 */
export function combinedFileIndexAtLine(files: CombinedDiffFile[], line: number): number {
  const entries = Array.isArray(files) ? files : [];
  if (entries.length === 0) return 0;
  const target = Number.isFinite(Number(line)) ? Number(line) : 1;
  let index = 0;
  for (let cursor = 0; cursor < entries.length; cursor += 1) {
    const start = Number(entries[cursor]?.line);
    if (!Number.isFinite(start)) continue;
    if (start > target) break;
    index = cursor;
  }
  return index;
}

/**
 * Hidden Monaco range for one combined-file body, keeping its heading visible.
 *
 * @param {object|null} file - combined file metadata.
 * @param {'original'|'modified'} side - editor side.
 * @returns {{startLineNumber: number, endLineNumber: number}|null} hidden range.
 */
export function combinedFileHiddenRange(
  file: CombinedDiffFile | null | undefined,
  side: 'original' | 'modified',
): { startLineNumber: number; endLineNumber: number } | null {
  if (file === null || typeof file !== 'object') return null;
  const header = Number(side === 'original' ? file.originalLine : file.line);
  const end = Number(side === 'original' ? file.originalEndLine : file.endLine);
  if (!Number.isFinite(header) || !Number.isFinite(end) || end <= header) return null;
  return { startLineNumber: header + 1, endLineNumber: end };
}

/**
 * IDEA's Control+Escape bindings for the current combined-diff file.
 *
 * The action is scoped to the combined diff surface and uses literal
 * Control, not Command on macOS.
 * @param {KeyboardEvent|object|null} event - keyboard event candidate.
 * @param {boolean} insideDiffPane - whether the focused element is inside the diff.
 * @param {boolean} combined - whether the active target is a combined diff.
 * @returns {boolean} true only for the IDEA key binding in its valid surface.
 */
export function isCombinedFileCollapseShortcut(
  event: DiffKeyboardEvent | null | undefined,
  insideDiffPane: boolean,
  combined: boolean,
): boolean {
  return (
    insideDiffPane === true &&
    combined === true &&
    event?.ctrlKey === true &&
    event?.metaKey !== true &&
    event?.altKey !== true &&
    event?.shiftKey !== true &&
    event?.key === 'Escape'
  );
}

/**
 * IDEA's plain Escape action while the comparison owns the keyboard.
 *
 * Monaco's find/suggest widgets and our context menus also consume Escape.
 * They stay in charge while open; only the idle diff surface closes.
 * @param {KeyboardEvent|object|null} event - keyboard event candidate.
 * @param {boolean} insideDiffPane - whether the focused element is inside the diff.
 * @param {boolean} popupOwnsEscape - whether a menu or Monaco popup is open.
 * @returns {boolean} true only for the unmodified idle-diff binding.
 */
export function isDiffCloseShortcut(
  event: DiffKeyboardEvent | null | undefined,
  insideDiffPane: boolean,
  popupOwnsEscape: boolean,
): boolean {
  return (
    insideDiffPane === true &&
    popupOwnsEscape !== true &&
    event?.key === 'Escape' &&
    event?.ctrlKey !== true &&
    event?.metaKey !== true &&
    event?.altKey !== true &&
    event?.shiftKey !== true
  );
}

/**
 * IDEA's two-step Select Opened File shortcut: Alt+F1 then 1.
 *
 * The second key deliberately has no Alt modifier, so it cannot be confused
 * with the Alt+1 tool-window key. The chord expires instead of leaving stale
 * global state behind.
 * @param {KeyboardEvent|object|null} event - keyboard event candidate.
 * @param {number} armedAt - timestamp of the preceding Alt+F1, or zero.
 * @param {number} now - current timestamp.
 * @param {boolean} hasActiveFile - whether Select Opened File is enabled.
 * @returns {'arm'|'reveal'|'clear'|'ignore'} chord action.
 */
export function selectOpenedChordAction(
  event: DiffKeyboardEvent | null | undefined,
  armedAt: number,
  now: number,
  hasActiveFile: boolean,
): 'arm' | 'reveal' | 'clear' | 'ignore' {
  const armed = Number(armedAt);
  const elapsed = Number(now) - armed;
  const sequenceActive =
    Number.isFinite(armed) && armed > 0 && Number.isFinite(elapsed) && elapsed >= 0 && elapsed <= 1500;
  if (
    hasActiveFile === true &&
    event?.altKey === true &&
    event?.metaKey !== true &&
    event?.ctrlKey !== true &&
    event?.shiftKey !== true &&
    event?.key === 'F1'
  ) {
    return 'arm';
  }
  if (
    sequenceActive &&
    event?.altKey !== true &&
    event?.metaKey !== true &&
    event?.ctrlKey !== true &&
    event?.shiftKey !== true &&
    event?.key === '1'
  ) {
    return 'reveal';
  }
  return armed > 0 ? 'clear' : 'ignore';
}

/**
 * Changed files in the same order the Commit tree presents them.
 *
 * IDEA's combined diff walks from one changed file to the next with
 * Control+Shift+Left/Right. The order must come from the visible tree model,
 * not raw `git status`: staged files come first, then working-tree changes,
 * then unversioned files, with each band using the active Group by sorting.
 * An `MM` path intentionally appears twice because its staged and working
 * copies are two separately addressable diffs.
 * @param {object[]} changes - porcelain changes from the host.
 * @param {'flat'|'module'|'directory'} [groupBy='directory'] - Commit tree grouping.
 * @returns {Array<{path: string, staged: boolean}>} navigable change identities.
 */
export function changeSequenceOf(changes: DiffChange[], groupBy = 'directory'): DiffTarget[] {
  const bands = splitChanges(Array.isArray(changes) ? changes : []);
  const sequence: DiffTarget[] = [];
  for (const group of ['staged', 'unstaged', 'unversioned'] as const) {
    const tree = changeTreeOf(bands[group], groupingDepth(groupBy));
    const rows = flattenChangeTree(tree, new Set(), group);
    for (const row of rows) {
      if (row.kind === 'file') sequence.push({ path: row.change.path, staged: group === 'staged' });
    }
  }
  return sequence;
}

/**
 * Locate one diff target in the change sequence.
 * @param {Array<{path: string, staged: boolean}>} sequence - navigable changes.
 * @param {{path?: string, staged?: boolean}|null} target - active diff target.
 * @returns {{index: number, total: number}|null} one-based position, or null.
 */
export function changePositionOf(
  sequence: DiffTarget[],
  target: { path?: string; staged?: boolean } | null,
): DiffFilePosition | null {
  if (!Array.isArray(sequence) || target === null || target === undefined || typeof target.path !== 'string')
    return null;
  const staged = target.staged === true;
  const index = sequence.findIndex((entry) => entry.path === target.path && entry.staged === staged);
  return index < 0 ? null : { index: index + 1, total: sequence.length };
}

/**
 * Filter a change list by what the user typed (IDEA's change-list search).
 *
 * Matching is on the path, case-insensitively and as a plain substring: a
 * change list is a list of paths, so `docs/` or `.ts` are the useful queries.
 * The selection is deliberately NOT filtered — a ticked file that does not
 * match stays ticked, or typing in the box would silently change what the
 * next commit contains.
 * @param {object[]} changes - the group's changes.
 * @param {string} query - typed text; empty means "everything".
 * @returns {object[]} matching changes, original order.
 */
export function filterChanges(changes: DiffChange[], query: string): DiffChange[] {
  const needle = typeof query === 'string' ? query.trim().toLowerCase() : '';
  if (needle === '') return Array.isArray(changes) ? changes : [];
  return (Array.isArray(changes) ? changes : []).filter(
    (change) => typeof change?.path === 'string' && change.path.toLowerCase().includes(needle),
  );
}

/**
 * Narrow the changed-file navigation sequence to the Changes filter.
 *
 * File navigation must not jump to rows the current path filter hides. The
 * commit order and staged/working identity stay untouched; only entries whose
 * paths do not contain the case-insensitive query are removed.
 * @param {Array<{path: string, staged: boolean}>} sequence - full diff order.
 * @param {string} query - current Changes path filter.
 * @returns {Array<{path: string, staged: boolean}>} visible diff order.
 */
export function filterChangeSequence(sequence: DiffTarget[], query: string): DiffTarget[] {
  const entries = Array.isArray(sequence) ? sequence : [];
  const needle = typeof query === 'string' ? query.trim().toLowerCase() : '';
  if (needle === '') return entries;
  return entries.filter((entry) => typeof entry?.path === 'string' && entry.path.toLowerCase().includes(needle));
}

/**
 * Flatten the visible Changes groups into selectable row identities.
 *
 * The commit checkboxes and the current-row selection are independent. This
 * list is only for moving the current row while a path filter is active, so
 * it preserves each row's staged/unstaged namespace and never changes what
 * is ticked for commit.
 * @param {Array<{id: string, changes: object[]}>} groups - filtered display groups.
 * @returns {Array<{path: string, staged: boolean}>} visible row identities.
 */
export function changeFilterTargets(groups: Array<{ id?: string; changes?: DiffChange[] }>): DiffTarget[] {
  const targets: DiffTarget[] = [];
  for (const group of Array.isArray(groups) ? groups : []) {
    const staged = group?.id === 'staged';
    for (const change of Array.isArray(group?.changes) ? group.changes : []) {
      if (typeof change?.path === 'string' && change.path !== '') targets.push({ path: change.path, staged });
    }
  }
  return targets;
}

/**
 * Cycle the Changes row selection within the filtered targets.
 *
 * A current row that was filtered out falls back to the first target for
 * either direction, which keeps the action target visible instead of applying
 * Stage/Show Diff/Rollback to a row the user cannot see.
 * @param {Array<{path: string, staged: boolean}>} targets - visible row identities.
 * @param {{path: string, staged: boolean}|null} current - selected row.
 * @param {'next'|'previous'} direction - navigation direction.
 * @returns {{path: string, staged: boolean}|null} next target.
 */
export function cycleChangeTarget(
  targets: DiffTarget[],
  current: DiffTarget | null,
  direction: 'next' | 'previous',
): DiffTarget | null {
  const entries = Array.isArray(targets) ? targets : [];
  if (entries.length === 0) return null;
  const index = entries.findIndex(
    (entry) => entry.path === current?.path && entry.staged === (current?.staged === true),
  );
  if (index < 0) return entries[0];
  const offset = direction === 'previous' ? -1 : 1;
  return entries[(index + offset + entries.length) % entries.length];
}

/** Porcelain codes that mean an unresolved merge conflict. */
const CONFLICT_STATUS = /^(DD|AU|UD|UA|DU|AA|UU)$/u;

/**
 * How long a typeahead prefix survives without another key.
 *
 * One second is IDEA's own feel: fast enough that `g` `r` reads as one
 * prefix, slow enough that a deliberate second search starts clean.
 */
export const TYPEAHEAD_RESET_MS = 1000;

/**
 * Whether one porcelain change is an unresolved conflict.
 * @param {object} change - change entry from the host.
 * @returns {boolean} true when the file needs a resolution.
 */
export function isConflict(change: { status?: unknown } | null | undefined): boolean {
  return typeof change?.status === 'string' && CONFLICT_STATUS.test(change.status);
}

/** Directory tree for one change group, sorted directories-first. */
export function changeTreeOf(changes: DiffChange[], depthLimit = Infinity): DiffTreeNode {
  const root: DiffTreeNode = { name: '', path: '', directories: new Map(), files: [] };
  /* `depthLimit` is IDEA's "Group by" choice: 0 is a single flat list, 1
         groups by module (the first path segment), Infinity by the whole path. */
  const limit = Number.isFinite(depthLimit) ? Math.max(0, depthLimit) : Infinity;
  for (const change of changes) {
    const segments = change.path.split('/');
    let node = root;
    for (let index = 0; index < segments.length - 1 && index < limit; index += 1) {
      const segment = segments[index];
      const child: DiffTreeNode = node.directories.get(segment) ?? {
        name: segment,
        path: segments.slice(0, index + 1).join('/'),
        directories: new Map(),
        files: [],
      };
      node.directories.set(segment, child);
      node = child;
    }
    node.files.push(change);
  }
  return sortChangeTree(root);
}

/**
 * How deep the change tree nests for one "Group by" mode.
 *
 * IDEA's dropdown offers three answers, and the difference is only the
 * nesting depth: a flat list (0), modules (1 — the top-level segment), or
 * the full directory tree. Keeping it as a number means the renderer and the
 * collapse keys stay identical for all three.
 * @param {string} mode - 'flat' | 'module' | 'directory'.
 * @returns {number} depth limit for {@link changeTreeOf}.
 */
export function groupingDepth(mode: string): number {
  if (mode === 'flat') return 0;
  if (mode === 'module') return 1;
  return Infinity;
}

/** Sort one change tree in place and return it. */
function sortChangeTree(node: DiffTreeNode): DiffTreeNode {
  node.directories = new Map(
    [...node.directories.entries()].sort(([left], [right]) =>
      left.localeCompare(right, undefined, { sensitivity: 'base' }),
    ),
  );
  node.files.sort((left, right) => left.path.localeCompare(right.path, undefined, { sensitivity: 'base' }));
  for (const child of node.directories.values()) sortChangeTree(child);
  return node;
}

/**
 * Flatten one change tree into the visible, collapsible row list.
 *
 * A directory only appears as a collapsible group row, and a chain of
 * single-child directories collapses into ONE row. Visible descendants keep
 * their hierarchy depth so IDEA's indentation still tells a folder row apart
 * from files inside it; the muted parent path remains the disambiguator for
 * same-named files.
 * @param {object} tree - sorted tree root.
 * @param {Set<string>} collapsed - collapsed directory paths prefixed by the group id.
 * @param {string} group - group identity used in collapse keys.
 * @param {number} depth - indentation depth.
 * @param {object[]} rows - accumulator.
 * @returns {object[]} visible rows.
 */
export function flattenChangeTree(
  tree: DiffTreeNode,
  collapsed: Set<string>,
  group: string,
  depth = 0,
  rows: DiffRow[] = [],
): DiffRow[] {
  for (const directory of tree.directories.values()) {
    /* Compact a chain of single-child directories: `a/b/c` is one row, so a
           file under it is told apart by the grey path, not by extra indents. */
    let leaf = directory;
    let path = directory.path;
    while (leaf.files.length === 0 && leaf.directories.size === 1) {
      const only = [...leaf.directories.values()][0];
      leaf = only;
      path = only.path;
    }
    const key = `${group}:${path}`;
    const open = !collapsed.has(key);
    /* The directory row stages/unstages everything below it, so it carries its own leaves. */
    const inside = collectChanges(leaf, []);
    rows.push({
      kind: 'directory',
      path,
      name: basename(path),
      parent: dirname(path),
      depth,
      open,
      collapseKey: key,
      changes: inside,
    });
    if (open) flattenChangeTree(leaf, collapsed, group, depth + 1, rows);
  }
  /* IDEA indents files below their expanded directories. */
  for (const change of tree.files)
    rows.push({ kind: 'file', path: change.path, name: basename(change.path), depth, change });
  return rows;
}

/**
 * Every collapse key below (and including) one directory, group-prefixed.
 *
 * IDEA's ⌥-click on a tree node toggles the whole subtree in one gesture;
 * a plain click still toggles just that level. Returning keys (not a new
 * tree) keeps the caller's `Set` update trivial and side-effect free.
 * @param {object} tree - the group's sorted change tree.
 * @param {string} group - group identity used in collapse keys.
 * @param {string} path - directory path the click landed on.
 * @returns {string[]} keys to flip, outermost first.
 */
export function collapseKeysOf(tree: DiffTreeNode | null, group: string, path: string): string[] {
  const keys: string[] = [];
  if (tree === null || typeof tree !== 'object') return keys;
  const walk = (node: DiffTreeNode): boolean => {
    for (const directory of node.directories?.values?.() ?? []) {
      if (directory.path === path) {
        const collect = (current: DiffTreeNode): void => {
          keys.push(`${group}:${current.path}`);
          for (const child of current.directories?.values?.() ?? []) collect(child);
        };
        collect(directory);
        return true;
      }
      if (walk(directory)) return true;
    }
    return false;
  };
  walk(tree);
  return keys;
}

/**
 * Collapse keys that must be open for one changed file to become visible.
 *
 * IDEA's combined diff can move to a file while the Changes tree has its
 * group or an ancestor directory folded. Navigating the diff must reveal
 * that row in the same view rather than selecting an invisible identity.
 * @param {string} group - `staged`, `unstaged`, or `unversioned`.
 * @param {string} path - workspace-relative changed file path.
 * @returns {string[]} group key first, then each directory ancestor.
 */
export function revealCollapseKeys(group: string, path: string): string[] {
  const keys = [`${group}:`];
  if (typeof path !== 'string' || path === '') return keys;
  const parts = path.split('/');
  for (let index = 1; index < parts.length; index += 1) {
    keys.push(`${group}:${parts.slice(0, index).join('/')}`);
  }
  return keys;
}

/** Every change below one tree node. */
function collectChanges(node: DiffTreeNode, out: DiffTreeFile[] = []): DiffTreeFile[] {
  for (const child of node.directories.values()) collectChanges(child, out);
  out.push(...node.files);
  return out;
}

/**
 * One side-by-side diff surface for the selected change.
 *
 * Monaco's diff editor is created once and re-bound to fresh models per
 * path, so moving between changed files keeps scroll position and theme.
 */
/**
 * Read-only Monaco view of one file as it existed at a commit.
 *
 * IDEA opens repository revisions as VCS virtual files rather than as
 * working-copy files. This preview follows the same boundary: it renders
 * the fetched blob without registering a writable workspace document.
 *
 * @param {{t: Function, target: object, monacoReady: boolean, onClose: Function, onOpenLocal: Function}} props - revision target and actions.
 * @returns {object} repository version surface.
 */
