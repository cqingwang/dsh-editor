/* find-tool.ts: dsh-editor Find, terminal and graph helper module. Generated into lib/client.js by scripts/build-client.mjs. */

import { normalizeFindScopePatterns } from './commit';
import { basename, callFs } from './editor-core';
import { callTerminal } from './terminal';
interface FindOccurrence {
  rowKey?: string;
  [key: string]: unknown;
}

export interface FindToolDraft {
  query: string;
  replace: string;
  searchGeneration?: number;
}

export const FIND_TOOL_PREVIEW_MIN_PERCENT = 20;
export const FIND_TOOL_PREVIEW_MAX_PERCENT = 80;
export const FIND_TOOL_PREVIEW_DEFAULT_PERCENT = 46;
export const FIND_TOOL_PREVIEW_MIN_WIDTH = 120;
export const SEARCH_EVERYWHERE_RESULTS_DEFAULT_PERCENT = 42;
const FIND_TOOL_FLOATING_MIN_PANE_HEIGHT = 60;

/** Keep the remembered result/preview split reachable at every dock width. */
export function clampFindPreviewPercent(value: unknown, width?: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return FIND_TOOL_PREVIEW_DEFAULT_PERCENT;
  const measuredWidth = Number(width);
  const minPercent =
    Number.isFinite(measuredWidth) && measuredWidth > 0
      ? Math.min(50, Math.max(FIND_TOOL_PREVIEW_MIN_PERCENT, (FIND_TOOL_PREVIEW_MIN_WIDTH / measuredWidth) * 100))
      : FIND_TOOL_PREVIEW_MIN_PERCENT;
  const maxPercent = Math.max(50, 100 - minPercent);
  return Math.max(minPercent, Math.min(maxPercent, numeric));
}

/** Keep both stacked Find panes usable while preserving a wide drag range. */
export function clampFindFloatingPreviewPercent(value: unknown, height?: unknown): number {
  const numeric = Number(value);
  const measuredHeight = Number(height);
  const minPercent =
    Number.isFinite(measuredHeight) && measuredHeight > 0
      ? Math.min(50, Math.max(15, (FIND_TOOL_FLOATING_MIN_PANE_HEIGHT / measuredHeight) * 100))
      : 20;
  const maxPercent = Math.max(50, 100 - minPercent);
  return Math.max(minPercent, Math.min(maxPercent, Number.isFinite(numeric) ? numeric : 50));
}

/** Keep Search Everywhere's stacked list and preview panes readable. */
export function clampSearchEverywhereResultsPercent(value: unknown, height?: unknown): number {
  const numeric = Number(value);
  const measuredHeight = Number(height);
  const minPercent =
    Number.isFinite(measuredHeight) && measuredHeight > 0
      ? Math.min(50, Math.max(20, (110 / measuredHeight) * 100))
      : 20;
  const maxPercent = Math.max(50, 100 - minPercent);
  return Math.max(
    minPercent,
    Math.min(maxPercent, Number.isFinite(numeric) ? numeric : SEARCH_EVERYWHERE_RESULTS_DEFAULT_PERCENT),
  );
}

/** Preserve the reopen draft and the generation that owns it. */
export function findToolDraftFromState(
  state: { query?: unknown; replace?: unknown; searchGeneration?: unknown } | null | undefined,
): FindToolDraft {
  return {
    query: typeof state?.query === 'string' ? state.query : '',
    replace: typeof state?.replace === 'string' ? state.replace : '',
    searchGeneration: Number(state?.searchGeneration) || 0,
  };
}

export function findToolReopenDraft(
  draft: FindToolDraft | null | undefined,
  selectedQuery: string,
  mode: 'find' | 'replace',
  restoreDraft: boolean,
): FindToolDraft {
  const query = typeof selectedQuery === 'string' ? selectedQuery : '';
  if (restoreDraft !== true || draft === null || draft === undefined) return { query, replace: '' };
  return {
    query: query.trim() !== '' ? query : draft.query,
    replace: mode === 'replace' ? draft.replace : '',
  };
}

/**
 * Re-run Search Everywhere's handoff inside the persistent Find surface.
 *
 * Reusing the transient result arrays as the dock's initial state makes the
 * handoff lifecycle and the first host search compete for rendering/focus.
 * Keep the query and options, but start from an empty, explicitly refreshed
 * result set so the dock owns exactly one search.
 * @param initial - transient Search Everywhere request.
 * @returns a refresh request without copied result rows.
 */
export function findToolRefreshHandoff<T extends { query?: unknown }>(initial: T | null): T | null {
  if (initial === null) return null;
  return {
    ...initial,
    files: [],
    matches: [],
    index: 0,
    truncated: false,
    refresh: String(initial.query ?? '').trim() !== '',
  } as T;
}

interface FindShortcutEvent {
  key?: unknown;
  ctrlKey?: unknown;
  metaKey?: unknown;
  altKey?: unknown;
  shiftKey?: unknown;
  isComposing?: unknown;
}

interface FuzzyMatchOptions {
  caseSensitive?: boolean;
  wholeWords?: boolean;
}

interface CommitGraphEntry {
  hash: string;
  parents?: string[];
  [key: string]: unknown;
}

interface CommitGraphLanes {
  laneOf: Map<string, number>;
  laneCount: number;
}

interface CommitGraphRun {
  hashes: string[];
  lane: number;
  merge: boolean;
  first: CommitGraphEntry;
}

interface TerminalBlockRange {
  start: number;
  end: number;
}

interface TerminalTabIdentity {
  id?: string;
  path?: string;
  state?: string;
  cwd?: string;
  title?: string;
  exitCode?: number | null;
  shell?: string;
}

interface TerminalMenuAction {
  id: string;
  label: string;
  disabled?: boolean;
  run?: () => unknown;
  items?: TerminalMenuAction[];
  restoreFocus?: boolean;
  shortcut?: string;
  danger?: boolean;
  [key: string]: unknown;
}

interface TerminalBufferLine {
  isWrapped?: boolean;
  translateToString?: (trimRight?: boolean) => string;
}

interface TerminalBuffer {
  baseY?: number;
  cursorX?: number;
  cursorY?: number;
  length?: number;
  getLine?: (row: number) => TerminalBufferLine | undefined;
}

export interface TerminalEmulator {
  buffer: { active: TerminalBuffer };
  cols: number;
  rows: number;
  options: { fontSize?: number; theme?: unknown };
  parser?: {
    registerOscHandler: (code: number, handler: (payload: string) => boolean) => { dispose: () => void };
  };
  clear: () => void;
  clearSelection: () => void;
  dispose: () => void;
  focus: () => void;
  getSelection: () => string;
  getSelectionPosition: () => { start: { x: number; y: number }; end: { x: number; y: number } } | undefined;
  input: (data: string, shouldFocus?: boolean) => void;
  loadAddon: (addon: { fit?: () => void }) => void;
  onData: (handler: (data: string) => void) => { dispose: () => void };
  onTitleChange: (handler: (title: string) => void) => { dispose: () => void };
  onWriteParsed?: (handler: () => void) => { dispose: () => void };
  open: (node: HTMLElement) => void;
  registerLinkProvider: (provider: TerminalLinkProvider) => { dispose: () => void };
  reset: () => void;
  scrollLines: (count: number) => void;
  scrollPages: (count: number) => void;
  select: (column: number, row: number, length: number) => void;
  selectAll: () => void;
  selectLines: (start: number, end: number) => void;
  scrollToLine: (line: number) => void;
  write: (data: string) => void;
}

interface TerminalConstructor {
  new (...args: unknown[]): TerminalEmulator;
}

interface XtermBundle {
  Terminal: TerminalConstructor;
  FitAddon: new () => { fit: () => void };
}

let xtermPromise: Promise<XtermBundle> | null = null;

interface TerminalLinkProvider {
  provideLinks: (line: number, callback: (links: unknown[] | undefined) => void) => void;
  dispose: () => void;
}

interface TerminalLinkParser {
  parseTerminalLinks: (text: string) => Array<{
    kind: string;
    path: string;
    text: string;
    start: number;
    end: number;
    line?: number;
    column?: number;
  }>;
  resolveTerminalPath: (cwd: string, path: string) => string;
}

const importRuntimeModule = (specifier: string): Promise<unknown> => import(specifier);

export type TerminalStreamEvent =
  | { type: 'snapshot'; data: string }
  | { type: 'data'; data: string }
  | { type: 'exit'; code: number | null }
  | { type: 'error'; message: string };

interface CommitGraphBadge {
  name?: unknown;
  hash?: unknown;
}

interface CommitGraphReferenceData {
  branchList?: unknown[];
  tagList?: CommitGraphBadge[];
  [key: string]: unknown;
}

interface TerminalMenuInput {
  t: (key: string, params?: Record<string, unknown>) => string;
  emulator: TerminalEmulator | null;
  active: TerminalTabIdentity | null;
  onSelectAll: () => void;
  onFind: () => void;
  onClose?: () => void;
  onClear: () => void;
  onClearBuffer: () => void;
  onCreate: () => void;
  onSplitRight?: () => void;
  onMoveToEditor?: () => void;
  onSwitchFocusToEditor?: () => void;
  onClipboardError?: (message: string) => void;
  onPastedText?: (text: string) => void;
  pasteHistory?: string[];
  onPasteHistory?: (text: string) => void;
  selectionPosition?: unknown;
}

interface TerminalTabMenuActions {
  rename: () => void;
  close: () => void;
  closeOthers: () => void;
  duplicate?: () => void;
  cycleColor?: () => void;
  canDuplicate?: boolean;
  moveLeft?: () => void;
  canMoveLeft?: boolean;
  moveRight?: () => void;
  canMoveRight?: boolean;
  cwd?: string;
  readmePath?: string;
  openReadme?: () => void;
  revealCwd?: () => void;
  splitRight?: (() => void) | null;
  reopen?: (() => void) | null;
  moveToEditor?: (() => void) | null;
  switchFocusToEditor?: (() => void) | null;
  canCloseOthers?: boolean;
}
/**
 * Choose the row to select after one occurrence was replaced.
 *
 * If the replacement still matches the query, the replaced row remains in
 * the refreshed list at the same identity. Skip that row once and continue
 * to the following occurrence. If it no longer matches, the fallback index
 * already points at the next original occurrence.
 * @param {object[]} occurrences - current visible result rows.
 * @param {string} replacedRowKey - row identity captured before replacement.
 * @param {number} fallbackIndex - prior active row index.
 * @returns {number} row index to select.
 */
export function findToolReplaceAdvanceIndex(
  occurrences: FindOccurrence[],
  replacedRowKey: string,
  fallbackIndex: number,
): number {
  const rows = Array.isArray(occurrences) ? occurrences : [];
  if (rows.length === 0) return 0;
  const replacedIndex =
    typeof replacedRowKey === 'string' ? rows.findIndex((row) => row?.rowKey === replacedRowKey) : -1;
  if (replacedIndex >= 0) return (replacedIndex + 1) % rows.length;
  const requested = Math.trunc(Number(fallbackIndex) || 0);
  return Math.max(0, Math.min(rows.length - 1, requested));
}

/**
 * Resolve the live dirty-buffer content that should own a Find preview.
 *
 * A Find row keeps its identity while the user edits the same file. The
 * preview must therefore read the current dirty model instead of keeping the
 * content captured when the row was first opened.
 * @param path - active Find result path.
 * @param openFiles - current editor documents with dirty/content state.
 * @returns live content for a dirty matching file, otherwise null.
 */
export function findToolLivePreviewContent(path: unknown, openFiles: unknown): string | null {
  if (typeof path !== 'string' || path === '' || !Array.isArray(openFiles)) return null;
  const file = openFiles.find(
    (entry) => entry?.path === path && entry?.dirty === true && typeof entry?.content === 'string',
  );
  return typeof file?.content === 'string' ? file.content : null;
}

/**
 * Give Preview read failures a localized action context without hiding the
 * underlying file or host error.
 * @param t - active locale translator.
 * @param failure - rejected preview read.
 * @returns localized message containing the original detail.
 */
export function searchPreviewFailureMessage(
  t: (key: string, params?: Record<string, unknown>) => string,
  failure: unknown,
): string {
  const message = failure instanceof Error ? failure.message : String(failure);
  return t('editor.searchPreviewFailed', { message });
}

/**
 * Recover the active Find row after an asynchronous result set changes.
 *
 * The stable rowKey is authoritative while that row still exists. If it was
 * removed, retain the previous numeric location and clamp it to the new list
 * so focus, preview and handoff all converge on the same valid row.
 * @param rows - current visible file/text rows.
 * @param requestedIndex - numeric selection from the previous row set.
 * @param activeRowKey - stable identity selected before the refresh.
 * @returns the reconciled zero-based index and row identity.
 */
export function findToolReconciledResultRow(
  rows: unknown,
  requestedIndex: unknown,
  activeRowKey: unknown,
): { index: number; rowKey: string | null } {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) return { index: 0, rowKey: null };
  const activeKey = typeof activeRowKey === 'string' ? activeRowKey : '';
  if (activeKey !== '') {
    const preserved = list.findIndex((row) => row?.rowKey === activeKey);
    if (preserved >= 0) return { index: preserved, rowKey: activeKey };
  }
  const index = Math.max(0, Math.min(list.length - 1, Math.trunc(Number(requestedIndex) || 0)));
  const rowKey = typeof list[index]?.rowKey === 'string' ? list[index].rowKey : null;
  return { index, rowKey };
}

interface FindToolSelectionState {
  index?: unknown;
  activeRowKey?: unknown;
  [key: string]: unknown;
}

interface FindToolOptionState extends Record<string, unknown> {
  files?: unknown;
  matches?: unknown;
  index?: unknown;
  activeRowKey?: unknown;
  error?: unknown;
  loadedGeneration?: unknown;
  searchGeneration?: unknown;
}

/**
 * Apply one bounded Find selection movement while retaining its row identity.
 * @param current - current Find surface state.
 * @param direction - relative movement when no absolute row is supplied.
 * @param count - current number of visible result rows.
 * @param absolute - optional zero-based destination row.
 * @param activeRowKey - stable identity of the destination row.
 * @returns updated state with a valid index and row identity.
 */
export function moveFindToolSelection<T extends FindToolSelectionState>(
  current: T,
  direction: unknown,
  count: unknown,
  absolute: unknown = null,
  activeRowKey: unknown = null,
): T {
  const total = Math.max(0, Math.trunc(Number(count) || 0));
  if (total === 0) return { ...current, index: 0, activeRowKey: null } as T;
  const requested = Number(absolute);
  const index =
    absolute !== null && absolute !== undefined && Number.isFinite(requested)
      ? Math.max(0, Math.min(total - 1, requested))
      : (((Math.trunc(Number(current.index) || 0) + Math.trunc(Number(direction) || 0) + total) % total) + total) %
        total;
  return {
    ...current,
    index,
    activeRowKey: typeof activeRowKey === 'string' ? activeRowKey : null,
  } as T;
}

/**
 * Invalidate results after one search option changes.
 * @param current - current Find surface state.
 * @param patch - option values owned by the changed control.
 * @returns state with a new search generation and no stale rows or identity.
 */
export function findToolSearchOptionsTransition<T extends FindToolOptionState>(
  current: T,
  patch: Partial<FindToolOptionState>,
): T {
  return {
    ...current,
    ...patch,
    files: [],
    matches: [],
    index: 0,
    activeRowKey: null,
    error: null,
    loadedGeneration: -1,
    searchGeneration: (Number(current.searchGeneration) || 0) + 1,
  } as T;
}

interface FindReplaceDisabledReasonOptions {
  replaceBusy?: unknown;
  searchGeneration?: unknown;
  loadedGeneration?: unknown;
  loading?: unknown;
  error?: unknown;
  matchCount?: unknown;
  activeKind?: unknown;
  t: (key: string, params?: Record<string, unknown>) => string;
}

/** Whether the visible Find rows were produced by the current request. */
export function findToolResultsAreCurrent(
  state:
    | {
        searchGeneration?: unknown;
        loadedGeneration?: unknown;
      }
    | null
    | undefined,
): boolean {
  return (Number(state?.searchGeneration ?? 0) || 0) === (Number(state?.loadedGeneration ?? 0) || 0);
}

/**
 * Explain why Find-style Replace actions are unavailable.
 *
 * A zero-match search has nothing to select, so both actions must describe the
 * absent replaceable matches instead of asking for an impossible row selection.
 */
export function findReplaceDisabledReasons({
  replaceBusy,
  searchGeneration,
  loadedGeneration,
  loading,
  error,
  matchCount,
  activeKind,
  t,
}: FindReplaceDisabledReasonOptions): { all: string | null; current: string | null } {
  if (replaceBusy === true) {
    const reason = t('editor.findReplaceBusy');
    return { all: reason, current: reason };
  }
  if (!findToolResultsAreCurrent({ searchGeneration, loadedGeneration })) {
    const reason = t('editor.findReplaceLoading');
    return { all: reason, current: reason };
  }
  if (loading === true) {
    const reason = t('editor.findReplaceLoading');
    return { all: reason, current: reason };
  }
  if (error !== null && error !== undefined) {
    const reason = t('editor.findReplaceSearchError');
    return { all: reason, current: reason };
  }
  if (Math.max(0, Math.trunc(Number(matchCount) || 0)) === 0) {
    const reason = t('editor.findReplaceAllDisabled');
    return { all: reason, current: reason };
  }
  return {
    all: null,
    current: activeKind === 'text' ? null : t('editor.findReplaceCurrentDisabled'),
  };
}

/**
 * Keep an available Replace Undo/Redo action in the direct Find toolbar.
 *
 * Floating Find always owns its compact header outright. The dock competes
 * with persistent search configuration, so replacement history becomes a
 * direct action only while it can actually be used.
 */
export function findToolReplaceHistoryActionPinned(floating: boolean, available: boolean): boolean {
  return floating === true || available === true;
}

/**
 * Resolve IDEA's empty-result search-option clearing shortcuts.
 *
 * IDEA offers Ctrl+C/W/X for the three boolean filters and
 * Alt+Shift+Backspace for all used options. The caller additionally
 * requires an idle query caret so normal text copying is never stolen.
 * @param {KeyboardEvent|object} event - current keydown.
 * @returns {'case'|'words'|'regex'|'clear'|null} action to clear.
 */
export function findSearchOptionShortcutAction(
  event: FindShortcutEvent | null | undefined,
): 'case' | 'words' | 'regex' | 'clear' | null {
  if (event === null || typeof event !== 'object' || event.isComposing === true) return null;
  if (
    event.altKey === true &&
    event.shiftKey === true &&
    event.metaKey !== true &&
    event.ctrlKey !== true &&
    event.key === 'Backspace'
  )
    return 'clear';
  if (event.ctrlKey !== true || event.metaKey === true || event.altKey === true || event.shiftKey === true) return null;
  const key = String(event.key ?? '').toLowerCase();
  if (key === 'c') return 'case';
  if (key === 'w') return 'words';
  if (key === 'x') return 'regex';
  return null;
}

/** Create one browser-local Scope identity without requiring crypto.randomUUID. */
export function newFindScopeId(): string {
  return `scope-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * IDEA's Edit Scopes dialog, bounded to local named scopes.
 *
 * Includes/excludes are workspace-relative globs. The component edits a
 * detached copy so Cancel cannot mutate the active Find scope list.
 */

export const FIND_POPUP_RESIZE_DIRECTIONS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

/* FindToolWindow migrated to components/search/FindToolWindow.tsx. */
/**
 * Locate a whole-word occurrence using Unicode letter/number boundaries.
 * @param {string} value - candidate text.
 * @param {string} needle - query.
 * @param {boolean} [caseSensitive=false] - preserve case.
 * @returns {number} zero-based offset, or -1.
 */
export function wholeWordIndex(value: string, needle: string, caseSensitive = false): number {
  if (typeof value !== 'string' || typeof needle !== 'string' || needle === '') return -1;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const expression = new RegExp(`(?:^|[^\\p{L}\\p{N}_])(${escaped})(?=$|[^\\p{L}\\p{N}_])`, caseSensitive ? 'u' : 'iu');
  const match = expression.exec(value);
  if (match === null) return -1;
  return match.index + match[0].lastIndexOf(match[1]);
}

/**
 * Normalize a user extension filter into IDEA-compatible file masks.
 * `ts, .md` becomes `*.ts,*.md`; explicit glob/path masks are preserved.
 * @param {unknown} value - extension-list input.
 * @returns {string} canonical comma-separated masks.
 */
export function normalizeFileExtensionFilter(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text === '') return '';
  return text
    .split(',')
    .map((part) => {
      const token = part.trim();
      if (token === '') return '';
      const negative = token.startsWith('!');
      const body = (negative ? token.slice(1) : token).trim();
      if (body === '') return '';
      const explicitMask = body.includes('/') || body.includes('*') || body.includes('?');
      const normalized = explicitMask ? body : `*.${body.replace(/^\./u, '')}`;
      return `${negative ? '!' : ''}${normalized}`;
    })
    .filter(Boolean)
    .join(',');
}

/**
 * Match one path against the simple extension/mask list shown by Search
 * Everywhere. Negative masks win; positive masks form an allow-list.
 * @param {string} path - workspace-relative path.
 * @param {unknown} filter - extension/mask list.
 * @returns {boolean} whether the path participates in the search.
 */
export function fileExtensionFilterMatches(path: string, filter: unknown): boolean {
  const masks = normalizeFileExtensionFilter(filter).split(',').filter(Boolean);
  if (masks.length === 0) return true;
  let hasPositive = false;
  let positiveMatch = false;
  for (const raw of masks) {
    const negative = raw.startsWith('!');
    const pattern = negative ? raw.slice(1) : raw;
    const target = pattern.includes('/') ? path : basename(path);
    let source = '';
    for (let index = 0; index < pattern.length; index += 1) {
      const character = pattern[index];
      if (character === '*') {
        if (pattern[index + 1] === '*') {
          source += '.*';
          index += 1;
        } else {
          source += '[^/]*';
        }
      } else if (character === '?') {
        source += '[^/]';
      } else {
        source += character.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
      }
    }
    const matched = new RegExp(`^${source}$`, 'iu').test(target);
    if (negative && matched) return false;
    if (!negative) {
      hasPositive = true;
      if (matched) positiveMatch = true;
    }
  }
  return hasPositive ? positiveMatch : true;
}

/** Match one workspace path against one custom Scope glob. */
function findScopeGlobMatches(path: string, rawPattern: unknown): boolean {
  let pattern = typeof rawPattern === 'string' ? rawPattern.trim().replaceAll('\\', '/') : '';
  if (pattern === '') return false;
  pattern = pattern
    .replace(/^file:/u, '')
    .replace(/^\.\/+/u, '')
    .replace(/\/+$/u, '');
  pattern = pattern.replace(/\/\/\*$/u, '/**');
  if (pattern === '') return true;
  const name = path.slice(path.lastIndexOf('/') + 1);
  const hasGlob = pattern.includes('*') || pattern.includes('?');
  if (!hasGlob && !pattern.includes('/')) {
    return path === pattern || path.startsWith(`${pattern}/`) || name === pattern;
  }
  const target = pattern.includes('/') ? path : name;
  let source = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === '*') {
      if (pattern[index + 1] === '*') {
        source += '.*';
        index += 1;
      } else {
        source += '[^/]*';
      }
    } else if (character === '?') {
      source += '[^/]';
    } else {
      source += character.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    }
  }
  return new RegExp(`^${source}$`, 'iu').test(target);
}

/** Include globs are ORed; any exclude glob wins. */
export function findScopePatternsMatch(path: string, includePatterns: unknown, excludePatterns: unknown): boolean {
  if (typeof path !== 'string' || path === '') return false;
  const includes = normalizeFindScopePatterns(includePatterns);
  const excludes = normalizeFindScopePatterns(excludePatterns);
  if (includes.length > 0 && !includes.some((pattern) => findScopeGlobMatches(path, pattern))) return false;
  return !excludes.some((pattern) => findScopeGlobMatches(path, pattern));
}

/**
 * Subsequence match score, higher is better; -1 means no match.
 * @param {string} path - candidate path.
 * @param {string} query - typed query.
 * @param {{caseSensitive?: boolean, wholeWords?: boolean}} [options] - match options.
 * @returns {number} score.
 */
export function fuzzyScore(path: string, query: string, options?: FuzzyMatchOptions): number {
  options = options ?? {};
  if (query === '') return 0;
  const caseSensitive = options?.caseSensitive === true;
  const haystack = caseSensitive ? path : path.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  if (options?.wholeWords === true) {
    const boundary = wholeWordIndex(haystack, needle, true);
    return boundary < 0 ? -1 : 1000 + boundary - haystack.length;
  }
  const direct = haystack.lastIndexOf(needle);
  if (direct >= 0) return 1000 + direct - haystack.length;
  let position = -1;
  let score = 0;
  for (const character of needle) {
    const found = haystack.indexOf(character, position + 1);
    if (found < 0) return -1;
    score += found === position + 1 ? 2 : 1;
    position = found;
  }
  return score;
}

interface FindFilePathMatchOptions {
  caseSensitive?: boolean;
  wholeWords?: boolean;
  fileMask?: unknown;
  limit?: number;
}

export interface FindToolTextMatchLengthOptions {
  caseSensitive?: boolean;
  regex?: boolean;
}

/** Resolve the exact selected range for a text-search result preview. */
export function findToolTextMatchLength(
  result: { preview?: unknown; column?: unknown; matchLength?: unknown } | null | undefined,
  query: unknown,
  options: FindToolTextMatchLengthOptions = {},
): number {
  const hostLength = Math.floor(Number(result?.matchLength));
  if (Number.isFinite(hostLength) && hostLength > 0) return hostLength;
  const needle = typeof query === 'string' ? query : '';
  const preview = typeof result?.preview === 'string' ? result.preview : '';
  const column = Math.max(1, Math.floor(Number(result?.column) || 1));
  const offset = Math.min(preview.length, column - 1);
  if (needle === '') return 1;
  if (options.regex !== true) {
    return Math.max(1, Math.min(needle.length, Math.max(1, preview.length - offset)));
  }
  try {
    const expression = new RegExp(needle, options.caseSensitive === true ? 'gu' : 'giu');
    for (const match of preview.matchAll(expression)) {
      const start = match.index ?? 0;
      const length = Math.max(0, match[0]?.length ?? 0);
      if (start <= offset && offset < start + length) return Math.max(1, length);
      if (start > offset) break;
    }
  } catch {
    /* The Host accepted the expression; fall back to a caret-only reveal. */
  }
  return 1;
}

/**
 * Keep the selected Find File path stable while indexed candidates arrive.
 *
 * File-scope results are re-sorted as the asynchronous candidate list grows.
 * A numeric index would then point at a different file, so recover the path
 * selected in the previous list and fall back to the bounded prior index only
 * when that file disappeared from the new result set.
 * @param {unknown} previousFiles - file rows from the previous render.
 * @param {unknown} nextFiles - file rows from the refreshed candidate list.
 * @param {unknown} requestedIndex - numeric selection before the refresh.
 * @returns {number} index that preserves the selected file when possible.
 */
export function findToolPreservedFileIndex(
  previousFiles: unknown,
  nextFiles: unknown,
  requestedIndex: unknown,
): number {
  const previous = Array.isArray(previousFiles) ? previousFiles : [];
  const next = Array.isArray(nextFiles) ? nextFiles : [];
  if (next.length === 0) return 0;
  const requested = Math.max(0, Math.min(previous.length - 1, Math.trunc(Number(requestedIndex) || 0)));
  const activePath = typeof previous[requested]?.path === 'string' ? previous[requested].path : '';
  if (activePath !== '') {
    const preserved = next.findIndex((file) => file?.path === activePath);
    if (preserved >= 0) return preserved;
  }
  return Math.max(0, Math.min(next.length - 1, requested));
}

/**
 * Filter workspace file paths for Find's File scope.
 *
 * This mode navigates files, so the query is matched against the path itself
 * and never against file contents. File Mask remains an additional candidate
 * filter, while the bounded result set matches Search Everywhere's Files page.
 * @param {unknown} paths - workspace-relative file candidates.
 * @param {unknown} query - filename or path fragment.
 * @param {FindFilePathMatchOptions} [options] - match and mask options.
 * @returns {string[]} matching paths ordered by match quality.
 */
export function findFilePathMatches(paths: unknown, query: unknown, options: FindFilePathMatchOptions = {}): string[] {
  const needle = typeof query === 'string' ? query.trim() : '';
  if (needle === '') return [];
  const limit = Math.max(1, Math.min(200, Math.floor(Number(options.limit) || 80)));
  const matches: Array<{ path: string; score: number }> = [];
  const seen = new Set<string>();
  for (const rawPath of Array.isArray(paths) ? paths : []) {
    if (typeof rawPath !== 'string' || rawPath === '' || seen.has(rawPath)) continue;
    if (!fileExtensionFilterMatches(rawPath, options.fileMask)) continue;
    const score = fuzzyScore(rawPath, needle, {
      caseSensitive: options.caseSensitive === true,
      wholeWords: options.wholeWords === true,
    });
    if (score < 0) continue;
    seen.add(rawPath);
    matches.push({ path: rawPath, score });
  }
  return matches
    .sort((left, right) => right.score - left.score || left.path.length - right.path.length)
    .slice(0, limit)
    .map((match) => match.path);
}

/**
 * Assign one lane per commit by walking parents, so lines actually connect.
 *
 * A commit inherits the lane of the child that first references it; when a
 * commit has several children the lane stays with the newest child and extra
 * parents open fresh lanes. This is the layout step (pure, testable); drawing
 * is separate so the geometry can be asserted without a DOM.
 * @param {Array<{hash: string, parents: string[]}>} entries - commits, newest first.
 * @returns {{laneOf: Map<string, number>, laneCount: number}} lane assignment.
 */
/**
 * Group consecutive commits that share one lane and no branch point.
 *
 * IDEA's graph can squeeze "nothing else is alive here" stretches into a
 * single row. The unit is a RUN, not a lane: a run ends at a merge or where
 * another lane starts, so folding never hides a fork or a branch tip.
 * @param {object[]} entries - commits in walk order.
 * @param {Map<string, number>} laneOf - lane per commit from assignGraphLanes.
 * @returns {Array<{hashes: string[], lane: number, merge: boolean, first: object}>} runs.
 */
export function linearRun(entries: CommitGraphEntry[], laneOf: Map<string, number>): CommitGraphRun[] {
  const runs: CommitGraphRun[] = [];
  for (const entry of entries) {
    const lane = laneOf.get(entry.hash) ?? 0;
    const merge = (entry.parents?.length ?? 0) > 1;
    const previous = runs[runs.length - 1];
    /* A run continues only while the lane is unchanged and neither row merges. */
    if (previous !== undefined && previous.lane === lane && previous.merge === false && merge === false) {
      previous.hashes.push(entry.hash);
      continue;
    }
    runs.push({ hashes: [entry.hash], lane, merge, first: entry });
  }
  return runs;
}

export function assignGraphLanes(entries: CommitGraphEntry[]): CommitGraphLanes {
  const laneOf = new Map<string, number>();
  let laneCount = 0;
  /* Pass 1: every commit inherits its lane from its first child, so a branch's
         own history stays on one line. Tips get a lane as they are encountered. */
  for (const entry of entries) {
    if (!laneOf.has(entry.hash)) laneOf.set(entry.hash, laneCount++);
    const lane = laneOf.get(entry.hash);
    const parents = entry.parents ?? [];
    const first = parents[0];
    if (first !== undefined && !laneOf.has(first)) laneOf.set(first, lane);
  }
  /* Pass 2: merge parents that pass 1 never reached open a forked lane. */
  for (const entry of entries) {
    for (const parent of (entry.parents ?? []).slice(1)) {
      if (!laneOf.has(parent)) laneOf.set(parent, laneCount++);
    }
  }
  return { laneOf, laneCount };
}

/**
 * Commits represented by the graph rows currently on screen.
 *
 * Expanded mode renders every commit. Folded mode renders one representative
 * per run, so keyboard cursor and context-menu navigation must use this list
 * rather than the full graph payload.
 * @param {object[]|null} entries - graph commits.
 * @param {boolean} folded - whether linear runs are collapsed.
 * @returns {object[]} entries represented by visible graph rows.
 */
export function graphDisplayEntries(
  entries: CommitGraphEntry[] | null | undefined,
  folded: boolean,
): CommitGraphEntry[] {
  const list = Array.isArray(entries) ? entries : [];
  if (folded !== true) return list;
  return linearRun(list, assignGraphLanes(list).laneOf).map((run) => run.first);
}

/**
 * IDEA's commit graph: lanes that connect parent to child, plus ref badges.
 *
 * Each row draws its own lane marker and connector stubs for every parent it
 * has, so a fork reads as a fork instead of mere indentation.
 * @param {{t: Function, graph: object|null, onShow: Function, selected: string|null, onSelect: Function, folded: boolean, onToggleFolded: Function, onContextMenu?: Function}} props - graph data.
 * @returns {object} the graph rows.
 */
/* CommitGraph migrated to components/commit/CommitGraph.tsx. */

/**
 * Turn a clicked ref badge into a graph scope (IDEA's "filter by ref").
 *
 * A branch badge means "walk that branch". A tag badge means "walk the
 * commit that tag points at" — tags have no line of their own, so the graph
 * shows the history *introduced by* the tag, which is what IDEA's
 * "Introduce tag" action does.
 * @param {string} ref - badge text (`main`, `origin/main`, `tag: v1`).
 * @param {object|null} graph - the loaded graph payload.
 * @returns {{branch: string, at: string}} scope for the next request.
 */
export function refScopeOf(ref: string, graph: CommitGraphReferenceData | null): { branch: string; at: string } {
  const value = typeof ref === 'string' ? ref.trim() : '';
  if (value === '') return { branch: '', at: '' };
  if (value.startsWith('tag: ')) {
    const name = value.slice(5).trim();
    const tag = (graph?.tagList ?? []).find((entry) => entry.name === name);
    /* An unknown tag is not a scope: better to stay put than to walk "" and
           look like the filter did nothing. */
    return tag === undefined || typeof tag.hash !== 'string' ? { branch: '', at: '' } : { branch: '', at: tag.hash };
  }
  const known = (graph?.branchList ?? []).includes(value);
  return known ? { branch: value, at: '' } : { branch: '', at: '' };
}

/**
 * Keep the keyboard-selected graph row inside the scrolling list.
 *
 * Scrolls the list, not the page, so the surrounding tool window stays put.
 * @param {HTMLElement|null} node - the active row.
 * @returns {void}
 */
export function scrollGraphRowIntoView(node: HTMLElement | null | undefined): void {
  node?.scrollIntoView?.({ block: 'nearest' });
}

/**
 * Resolve keyboard movement in the flat commit table.
 *
 * The candidate list is already filtered by the visible text query, so
 * navigation cannot jump into a hidden commit. Unknown selections enter at
 * the corresponding edge, matching IDEA's table cursor behaviour.
 * @param {object[]|null} commits - visible commits.
 * @param {string|null} selected - selected hash.
 * @param {'next'|'previous'|'first'|'last'|'current'} action - movement.
 * @returns {string|null} hash to select.
 */
export function flatLogTarget(
  commits: Array<{ hash?: string }> | null | undefined,
  selected: string | null,
  action: 'next' | 'previous' | 'first' | 'last' | 'current',
): string | null {
  const list = (Array.isArray(commits) ? commits : []).filter(
    (commit) => typeof commit?.hash === 'string' && commit.hash !== '',
  );
  if (list.length === 0) return null;
  const index = list.findIndex((commit) => commit.hash === selected);
  if (action === 'first') return list[0].hash;
  if (action === 'last') return list[list.length - 1].hash;
  if (action === 'current') return list[index < 0 ? 0 : index].hash;
  const delta = action === 'previous' ? -1 : 1;
  const base = index < 0 ? (delta > 0 ? -1 : list.length) : index;
  return list[Math.max(0, Math.min(base + delta, list.length - 1))].hash;
}

/**
 * Resolve the commit under IDEA's graph keyboard cursor.
 *
 * Hover is intentionally ignored: `Shift+F10` acts on the row the keyboard
 * selected. If the cursor is absent or no longer present after a refresh,
 * the currently displayed commit is the fallback.
 * @param {object[]|null} entries - graph commits.
 * @param {string|null} cursor - current keyboard cursor hash.
 * @param {string|null} selected - commit currently shown in details.
 * @returns {object|null} commit for the context menu.
 */
export function graphLogMenuTarget(
  entries: CommitGraphEntry[] | null | undefined,
  cursor: string | null,
  selected: string | null,
): CommitGraphEntry | null {
  const list = (Array.isArray(entries) ? entries : []).filter(
    (entry) => typeof entry?.hash === 'string' && entry.hash !== '',
  );
  if (list.length === 0) return null;
  const preferred = typeof cursor === 'string' && cursor !== '' ? cursor : selected;
  return (
    list.find((entry) => entry.hash === preferred) ??
    (typeof selected === 'string' ? (list.find((entry) => entry.hash === selected) ?? null) : null)
  );
}

/**
 * Resolve parent and child commits inside the currently loaded log entries.
 *
 * IDEA navigates the visible commit graph; it does not silently start a
 * repository-wide walk. Using only loaded rows keeps the action predictable
 * and prevents a menu item from selecting a commit the user cannot see.
 *
 * @param {object[]} entries - loaded flat or graph commits.
 * @param {string} hash - commit whose relations are requested.
 * @returns {{parents: object[], children: object[]}} loaded relation targets.
 */
export function commitRelationTargets(
  entries: CommitGraphEntry[],
  hash: string,
): { parents: CommitGraphEntry[]; children: CommitGraphEntry[] } {
  const list = (Array.isArray(entries) ? entries : []).filter(
    (entry) => typeof entry?.hash === 'string' && entry.hash !== '',
  );
  const byHash = new Map(list.map((entry) => [entry.hash, entry]));
  const current = byHash.get(hash);
  const seen = new Set();
  const parents = [];
  for (const parentHash of Array.isArray(current?.parents) ? current.parents : []) {
    if (typeof parentHash !== 'string' || parentHash === '' || seen.has(parentHash)) continue;
    const parent = byHash.get(parentHash);
    if (parent === undefined) continue;
    seen.add(parentHash);
    parents.push(parent);
  }
  const children = list.filter(
    (entry) => Array.isArray(entry.parents) && entry.parents.some((parentHash) => parentHash === hash),
  );
  return { parents, children };
}

/**
 * Pick the first loaded relation target for an IDEA arrow-key navigation.
 *
 * @param {object[]} entries - loaded commits.
 * @param {string|null} hash - starting commit.
 * @param {'parents'|'children'} relation - direction to follow.
 * @returns {object|null} target commit, if one is currently loaded.
 */
export function commitRelationTarget(
  entries: CommitGraphEntry[],
  hash: string | null,
  relation: 'parents' | 'children',
): CommitGraphEntry | null {
  const targets = commitRelationTargets(entries, hash);
  return (relation === 'parents' ? targets.parents : targets.children)[0] ?? null;
}

/**
 * Keep the two revisions in visible Log order.
 *
 * IDEA displays the older selected commit on the left and the newer one on
 * the right. Looking up both hashes in the current log preserves that
 * direction even when the user selected them in the opposite order.
 *
 * @param {string[]} selected - exactly two selected hashes.
 * @param {object[]} entries - loaded commits in display order.
 * @returns {string[]|null} newer, older; or null when not exactly two loaded commits.
 */
export function orderedRevisionPair(selected: string[], entries: Array<{ hash?: string }>): string[] | null {
  const selectedSet = new Set(
    (Array.isArray(selected) ? selected : []).filter((value) => typeof value === 'string' && value !== ''),
  );
  if (selectedSet.size !== 2) return null;
  const order = [
    ...new Set(
      (Array.isArray(entries) ? entries : [])
        .map((entry) => entry?.hash)
        .filter((hash) => typeof hash === 'string' && hash !== ''),
    ),
  ];
  const pair = order.filter((hash) => selectedSet.has(hash));
  return pair.length === 2 ? pair : null;
}

/**
 * Build aggregate-diff entries for the paths affected by one commit.
 *
 * IDEA's Compare with Local passes exactly the selected commit's affected
 * paths to the diff handler. Building the same identities here keeps
 * unrelated working-tree edits out of the comparison.
 *
 * @param {{files?: object[]}|null} detail - `gitShowCommit` payload.
 * @param {string} hash - resolved commit hash.
 * @param {string} [localLabel='local'] - label for the right side.
 * @returns {Array<{path: string, revision: string, heading: string}>} diff entries.
 */
export function commitLocalDiffEntries(
  detail: { files?: Array<{ path?: string }> } | null,
  hash: string,
  localLabel = 'local',
): Array<{ path: string; revision: string; heading: string }> {
  const revision = typeof hash === 'string' ? hash.trim() : '';
  if (revision === '') return [];
  return (Array.isArray(detail?.files) ? detail.files : [])
    .filter((file) => typeof file?.path === 'string' && file.path !== '')
    .map((file) => ({
      path: file.path,
      revision,
      heading: `${file.path} · ${revision.slice(0, 7)} → ${localLabel}`,
    }));
}

/* CommitLog migrated to components/commit/CommitLog.tsx. */

/** Compact absolute time for the log rows. */
export function formatCommitDate(value: unknown): string {
  const candidate = typeof value === 'string' || typeof value === 'number' ? value : '';
  const date = new Date(candidate);
  if (Number.isNaN(date.getTime())) return String(value ?? '');
  const pad = (number: number): string => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Load xterm.js and its fit addon once per page.
 *
 * The ESM builds are imported dynamically because Monaco installs a global
 * AMD `define`, which would otherwise capture a UMD xterm bundle.
 * @returns {Promise<{Terminal: Function, FitAddon: Function}>} constructors.
 */
export function loadXterm(): Promise<{
  Terminal: TerminalConstructor;
  FitAddon: new () => { fit: () => void };
}> {
  if (xtermPromise !== null) return xtermPromise;
  xtermPromise = (async (): Promise<XtermBundle> => {
    injectStylesheet('/api/dsh-editor/xterm/xterm.css', 'dsh-editor-xterm-css');
    const [xterm, fitAddon] = (await Promise.all([
      importRuntimeModule('/api/dsh-editor/xterm/xterm.mjs'),
      importRuntimeModule('/api/dsh-editor/xterm/addon-fit.mjs'),
    ])) as [{ Terminal: unknown }, { FitAddon: unknown }];
    return {
      Terminal: xterm.Terminal as TerminalConstructor,
      FitAddon: fitAddon.FitAddon as new () => { fit: () => void },
    };
  })();
  return xtermPromise;
}

/** Reuse a shared `<link>` for terminal styling. */
function injectStylesheet(href: string, id: string): void {
  if (document.getElementById(id) !== null) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

/**
 * Read one SSE response body in chunks and hand each frame to a parser.
 * @param {Response} response - streaming response.
 * @param {(event: object) => void} onEvent - decoded event consumer.
 * @param {AbortSignal} signal - request lifetime.
 * @returns {Promise<void>} resolves when the stream ends.
 */
export async function readEventStream(
  response: Response,
  onEvent: (event: TerminalStreamEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  if (response.body === null) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const abort = () => {
    reader.cancel().catch(() => {});
  };
  signal.addEventListener('abort', abort, { once: true });
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const payload = frame.startsWith('data: ') ? frame.slice(6) : frame;
        if (payload !== '') {
          try {
            onEvent(JSON.parse(payload));
          } catch {
            /* one malformed frame must not kill the terminal */
          }
        }
        boundary = buffer.indexOf('\n\n');
      }
    }
  } finally {
    signal.removeEventListener('abort', abort);
  }
}

/**
 * Terminal link grammar, loaded once from the module the test suite also imports.
 *
 * It ships as ESM and is imported dynamically for the same reason as xterm:
 * Monaco claims the global AMD `define`, so a static script tag would be captured.
 */
let linkParserPromise: Promise<TerminalLinkParser | null> | null = null;
function loadLinkParser(): Promise<TerminalLinkParser | null> {
  if (linkParserPromise === null) {
    linkParserPromise = importRuntimeModule('/api/dsh-editor/shared/link-parser.mjs')
      .then((module) => module as TerminalLinkParser)
      .catch((): null => null);
  }
  return linkParserPromise;
}

/**
 * Build xterm's link provider for one emulator.
 *
 * The provider only shapes candidates locally; whether a path really exists is
 * asked from the host, so a missing file never becomes a dead underlined link.
 * @param {object} emulator - xterm Terminal instance.
 * @param {() => string} getCwd - current shell working directory.
 * @returns {{provideLinks: Function, dispose: Function}} provider handle.
 */
export function createTerminalLinkProvider(emulator: TerminalEmulator, getCwd: () => string): TerminalLinkProvider {
  interface TerminalExistenceVerdict {
    requested: string;
    exists?: boolean;
    kind?: string;
    path?: string;
  }
  /* Existence cache: terminal lines are re-scanned while scrolling. */
  const cache = new Map<string, TerminalExistenceVerdict>();
  const pending = new Set<string>();
  let disposed = false;

  /**
   * Ask the host which candidate paths exist, in one round trip.
   * @param {string[]} candidates - workspace-relative or absolute paths.
   * @returns {Promise<Map<string, object>>} verdicts keyed by candidate.
   */
  const resolveExistence = async (candidates: string[]): Promise<Map<string, TerminalExistenceVerdict>> => {
    const unknown = candidates.filter((candidate) => !cache.has(candidate) && !pending.has(candidate));
    if (unknown.length > 0) {
      for (const candidate of unknown) pending.add(candidate);
      try {
        const value = await callFs<TerminalExistenceVerdict[]>({
          op: 'exists',
          paths: unknown,
        });
        for (const entry of value ?? []) cache.set(entry.requested, entry);
      } catch {
        /* an unreachable host simply leaves the link unconfirmed */
      } finally {
        for (const candidate of unknown) pending.delete(candidate);
      }
    }
    const verdicts = new Map<string, TerminalExistenceVerdict>();
    for (const candidate of candidates) {
      const entry = cache.get(candidate);
      if (entry !== undefined) verdicts.set(candidate, entry);
    }
    return verdicts;
  };

  return {
    provideLinks(bufferLineNumber, callback) {
      if (disposed) {
        callback(undefined);
        return;
      }
      const line = emulator.buffer.active.getLine(bufferLineNumber - 1);
      if (line === undefined) {
        callback(undefined);
        return;
      }
      void loadLinkParser().then((parser) => {
        if (disposed || parser === null) {
          callback(undefined);
          return;
        }
        const links = parser.parseTerminalLinks(line.translateToString(true));
        if (links.length === 0) {
          callback(undefined);
          return;
        }
        const pathLinks = links.filter((link) => link.kind === 'path');
        const candidates = pathLinks.map((link) => parser.resolveTerminalPath(getCwd(), link.path));
        void resolveExistence(candidates).then((verdicts) => {
          if (disposed) return;
          const decorated = [];
          for (const link of links) {
            /* xterm ranges are 1-based on both axes. */
            const range = {
              start: { x: link.start + 1, y: bufferLineNumber },
              end: { x: link.end + 1, y: bufferLineNumber },
            };
            if (link.kind === 'url') {
              decorated.push({
                range,
                text: link.text,
                decorations: { pointerCursor: true, underline: true },
                activate: () => window.open(link.text, '_blank', 'noopener,noreferrer'),
              });
              continue;
            }
            const candidate = parser.resolveTerminalPath(getCwd(), link.path);
            const verdict = verdicts.get(candidate);
            if (verdict === undefined || verdict.exists !== true || verdict.kind !== 'file') continue;
            decorated.push({
              range,
              text: link.text,
              decorations: { pointerCursor: true, underline: true },
              activate: () => openTerminalTarget({ path: verdict.path, line: link.line, column: link.column }),
            });
          }
          callback(decorated.length === 0 ? undefined : decorated);
        });
      });
    },
    dispose() {
      disposed = true;
      cache.clear();
      pending.clear();
    },
  };
}

/**
 * Open one terminal link target in the editor, optionally revealing a line.
 * Reaches the workspace React tree through a custom DOM event: the terminal
 * dock is a sibling of the editor surface, not a descendant.
 * @param {{path: string, line: number|null, column: number|null}} target - resolved target.
 */
function openTerminalTarget(target: { path?: string; line?: number | null; column?: number | null }): void {
  if (typeof target.path !== 'string' || target.path === '') return;
  const host = document.querySelector('[data-dsh-editor-workspace]');
  host?.dispatchEvent(new CustomEvent('dsh-editor-open-file', { detail: target }));
}

/**
 * Terminal cells are addressed by display columns, not JavaScript string
 * offsets. Wide CJK/emoji glyphs occupy two cells and combining marks occupy
 * none, so xterm selection APIs need this conversion.
 * @param {string} value - displayed terminal text.
 * @returns {number} terminal cell width.
 */
function terminalCellWidth(value: string): number {
  let width = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (
      codePoint === 0 ||
      codePoint === 0x200b ||
      codePoint === 0x200c ||
      codePoint === 0x200d ||
      codePoint === 0xfe0e ||
      codePoint === 0xfe0f ||
      (codePoint >= 0x0300 && codePoint <= 0x036f) ||
      (codePoint >= 0x1ab0 && codePoint <= 0x1aff) ||
      (codePoint >= 0x1dc0 && codePoint <= 0x1dff) ||
      (codePoint >= 0x20d0 && codePoint <= 0x20ff) ||
      (codePoint >= 0xfe20 && codePoint <= 0xfe2f)
    )
      continue;
    width +=
      (codePoint >= 0x1100 && codePoint <= 0x115f) ||
      codePoint === 0x2329 ||
      codePoint === 0x232a ||
      (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f) ||
      (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
      (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
      (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
      (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
      (codePoint >= 0xff00 && codePoint <= 0xff60) ||
      (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
      (codePoint >= 0x1f300 && codePoint <= 0x1faff) ||
      (codePoint >= 0x20000 && codePoint <= 0x3fffd)
        ? 2
        : 1;
  }
  return width;
}

/**
 * Every occurrence of one query inside the terminal's retained buffer.
 *
 * xterm exposes the scrollback as physical rows. A logical terminal line can
 * span several rows where only the continuation row has `isWrapped=true`;
 * scanning each physical row alone misses queries that cross that boundary.
 * @param {object} emulator - xterm instance.
 * @param {string} needle - query.
 * @param {number} limit - safety ceiling for huge scrollbacks.
 * @returns {Array<{row: number, column: number}>} hits in buffer order.
 */
export function terminalMatches(
  emulator: TerminalEmulator,
  needle: string,
  limit = 2000,
): Array<{ row: number; column: number }> {
  if (needle === '') return [];
  const buffer = emulator.buffer.active;
  const length = Math.max(0, Math.floor(Number(buffer.length) || 0));
  const hits = [];
  let row = 0;
  while (row < length && hits.length < limit) {
    const segments: Array<{ row: number; text: string; start: number }> = [];
    let text = '';
    let nextRow = row;
    do {
      const line = buffer.getLine(nextRow);
      if (line === undefined) break;
      const segment = line.translateToString?.(true) ?? '';
      segments.push({ row: nextRow, text: segment, start: text.length });
      text += segment;
      nextRow += 1;
    } while (nextRow < length && buffer.getLine(nextRow)?.isWrapped === true);
    let offset = text.indexOf(needle);
    while (offset >= 0 && hits.length < limit) {
      const segment = segments.find((candidate) => offset < candidate.start + candidate.text.length);
      if (segment !== undefined) {
        const localOffset = offset - segment.start;
        hits.push({ row: segment.row, column: terminalCellWidth(segment.text.slice(0, localOffset)) });
      }
      offset = text.indexOf(needle, offset + Math.max(1, needle.length));
    }
    row = Math.max(nextRow, row + 1);
  }
  return hits;
}

/**
 * Match count for the terminal find bar.
 * @param {object} emulator - xterm instance.
 * @param {string} needle - query.
 * @returns {number} occurrences.
 */
export function countTerminalMatches(emulator: TerminalEmulator, needle: string): number {
  return terminalMatches(emulator, needle).length;
}

/**
 * Select the next/previous occurrence of the find query inside the terminal buffer.
 *
 * xterm has no search API of its own, so the buffer is scanned line by line and
 * the hit is turned into a buffer selection; the count is kept in component state
 * so the bar can show `n/total` the way the editor find bar does.
 * @param {object|null} emulator - xterm instance.
 * @param {{query: string, index: number, total: number}} find - current find state.
 * @param {Function} setFind - state setter.
 * @param {number} direction - +1 next, -1 previous.
 * @returns {void}
 */
export function moveTerminalSelection(
  emulator: TerminalEmulator | null,
  find: { query: string; index: number; total: number },
  setFind: (value: { query: string; index: number; total: number }) => void,
  direction: number,
): void {
  if (emulator === null || find.query === '') return;
  const needle = find.query;
  const hits = terminalMatches(emulator, needle);
  if (hits.length === 0) {
    setFind({ ...find, total: 0, index: 0 });
    return;
  }
  const index = (((find.index + direction) % hits.length) + hits.length) % hits.length;
  const hit = hits[index];
  emulator.select(hit.column, hit.row, terminalCellWidth(needle));
  emulator.scrollToLine(hit.row - Math.floor(emulator.rows / 2));
  setFind({ ...find, index, total: hits.length });
}

/**
 * IDEA's macOS terminal shortcuts that should never be forwarded to the
 * shell. Ctrl+C is deliberately excluded: without Meta it remains SIGINT.
 * @param {KeyboardEvent|object} event - key event.
 * @param {boolean} hasSelection - whether the focused terminal has text selected.
 * @returns {'newTab'|'copy'|'paste'|null} direct terminal action.
 */
export function directTerminalShortcut(
  event: FindShortcutEvent,
  hasSelection: boolean,
): 'newTab' | 'copy' | 'copyBlock' | 'paste' | null {
  if (!event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return null;
  const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
  if (key === 't') return 'newTab';
  if (key === 'c') return hasSelection ? 'copy' : 'copyBlock';
  if (key === 'v') return 'paste';
  return null;
}

/**
 * Resolve the live cursor row in absolute buffer coordinates.
 *
 * xterm's `cursorY` is viewport-relative, while getLine and selection ranges
 * use rows including scrollback. An explicit caller value is already absolute.
 */
function terminalAbsoluteCursorRow(buffer: TerminalBuffer | null, cursorY?: number): number | null {
  if (Number.isInteger(cursorY)) return cursorY;
  if (!Number.isInteger(buffer?.cursorY)) return null;
  const baseY = Number.isInteger(buffer?.baseY) ? Math.max(0, buffer.baseY) : 0;
  return buffer.cursorY + baseY;
}

/**
 * xterm marks continuation rows with isWrapped. IDEA's Select Prompt covers
 * the whole logical prompt, not only the final wrapped visual row.
 * @param {object|null} buffer - xterm active buffer.
 * @param {number} [cursorY] - absolute cursor row when supplied by a caller.
 * @returns {number|null} first visual row occupied by the prompt.
 */
export function terminalPromptStartRow(buffer: TerminalBuffer | null, cursorY?: number): number | null {
  if (buffer === null || buffer === undefined) return null;
  const cursorRow = terminalAbsoluteCursorRow(buffer, cursorY);
  if (cursorRow === null) return null;
  let row = cursorRow;
  while (row > 0 && buffer.getLine?.(row)?.isWrapped === true) row -= 1;
  return row;
}

/**
 * IDEA's Select Prompt selects from the current prompt row's first column to
 * the caret. xterm already exposes the authoritative cursor coordinates, so
 * this intentionally avoids guessing prompt boundaries from shell text.
 * @param {object|null} buffer - xterm active buffer.
 * @param {number} [cursorY] - absolute cursor row when supplied by a caller.
 * @param {number} [cursorX] - current cursor column.
 * @returns {{row: number, column: number, length: number}|null} xterm range.
 */
export function terminalPromptSelection(
  buffer: TerminalBuffer | null,
  cursorY?: number,
  cursorX = buffer?.cursorX,
): { row: number; column: number; length: number } | null {
  if (buffer === null || buffer === undefined) return null;
  const cursorRow = terminalAbsoluteCursorRow(buffer, cursorY);
  if (cursorRow === null || !Number.isInteger(cursorX) || cursorX < 0) return null;
  return { row: cursorRow, column: 0, length: cursorX };
}

/**
 * IDEA's block actions use shell-integration metadata that a plain PTY does
 * not provide. The closest lossless xterm mapping is the contiguous non-empty
 * output range immediately above the current prompt row.
 * @param {object|null} buffer - xterm active buffer.
 * @param {number} [cursorY] - absolute cursor row when supplied by a caller.
 * @returns {{start: number, end: number}|null} inclusive buffer rows.
 */
export function terminalLastBlockSelection(buffer: TerminalBuffer | null, cursorY?: number): TerminalBlockRange | null {
  if (buffer === null || buffer === undefined) return null;
  const cursorRow = terminalAbsoluteCursorRow(buffer, cursorY);
  if (cursorRow === null) return null;
  const rowText = (row: number): string | null => {
    const line = buffer.getLine?.(row);
    return typeof line?.translateToString === 'function' ? line.translateToString(true) : null;
  };

  /* Skip the complete current prompt, including its wrapped visual rows;
         otherwise the first prompt row looks like a one-line output block. */
  let promptRow = cursorRow;
  while (promptRow > 0 && buffer.getLine?.(promptRow)?.isWrapped === true) promptRow -= 1;
  let row = promptRow - 1;
  while (row >= 0 && rowText(row)?.trim() === '') row -= 1;
  if (row < 0 || rowText(row) === null) return null;

  const end = row;
  while (row >= 0) {
    const text = rowText(row);
    if (text === null || text.trim() === '') break;
    row -= 1;
  }
  return { start: row + 1, end };
}

/**
 * Expand one terminal row to its contiguous non-empty block.
 * @param {object|null} buffer - xterm active buffer.
 * @param {number} row - buffer row.
 * @returns {{start: number, end: number}|null} inclusive block range.
 */
function terminalBlockRangeAt(buffer: TerminalBuffer | null, row: number): TerminalBlockRange | null {
  if (buffer === null || buffer === undefined || !Number.isInteger(row) || row < 0) return null;
  const textAt = (candidate: number): string | null => {
    const line = buffer.getLine?.(candidate);
    return typeof line?.translateToString === 'function' ? line.translateToString(true) : null;
  };
  if (textAt(row)?.trim() === '') return null;
  let start = row;
  let end = row;
  const lastRow = Math.max(0, Number.isInteger(buffer.length) ? buffer.length - 1 : row);
  while (start > 0) {
    const previous = textAt(start - 1);
    if (previous === null || previous.trim() === '') break;
    start -= 1;
  }
  while (end < lastRow) {
    const next = textAt(end + 1);
    if (next === null || next.trim() === '') break;
    end += 1;
  }
  return { start, end };
}

/**
 * Map the current xterm text selection to its logical non-empty block range.
 * @param {object|null} buffer - xterm active buffer.
 * @param {{start?: {y?: number}, end?: {y?: number}}|null} position - xterm selection.
 * @returns {{start: number, end: number}|null} selected block span.
 */
export function terminalSelectionBlockRange(
  buffer: TerminalBuffer | null,
  position: { start?: { y?: number }; end?: { y?: number } } | null,
): TerminalBlockRange | null {
  const startRow = position?.start?.y;
  const endRow = position?.end?.y;
  if (!Number.isInteger(startRow) || !Number.isInteger(endRow)) return null;
  const promptRow = terminalPromptStartRow(buffer);
  const maxBlockRow =
    promptRow === null
      ? Number.isInteger(buffer?.length)
        ? buffer.length - 1
        : Math.max(startRow, endRow)
      : promptRow - 1;
  const blockAt = (row: number): TerminalBlockRange | null => {
    const block = terminalBlockRangeAt(buffer, row);
    if (block === null || block.start > maxBlockRow) return null;
    return { start: block.start, end: Math.min(block.end, maxBlockRow) };
  };
  const first = Math.min(startRow, endRow);
  const last = Math.max(startRow, endRow);
  const firstBlock = blockAt(first);
  const lastBlock = blockAt(last);
  if (firstBlock === null && lastBlock === null) return null;
  if (firstBlock === null) return lastBlock;
  if (lastBlock === null) return firstBlock;
  return { start: Math.min(firstBlock.start, lastBlock.start), end: Math.max(firstBlock.end, lastBlock.end) };
}

/**
 * Find the next non-empty block in one direction without crossing a caller's
 * upper bound (normally the row before the current prompt).
 * @param {object|null} buffer - xterm active buffer.
 * @param {{start: number, end: number}|null} range - current block.
 * @param {number} direction - -1 above, +1 below.
 * @param {number} [maxRow] - inclusive final searchable row.
 * @returns {{start: number, end: number}|null} adjacent block.
 */
export function terminalAdjacentBlockRange(
  buffer: TerminalBuffer | null,
  range: TerminalBlockRange | null,
  direction: number,
  maxRow = Number.isInteger(buffer?.length) ? buffer.length - 1 : -1,
): TerminalBlockRange | null {
  if (buffer === null || buffer === undefined || range === null || range === undefined) return null;
  if (!Number.isInteger(range.start) || !Number.isInteger(range.end) || !Number.isInteger(maxRow)) return null;
  const step = Number(direction) < 0 ? -1 : 1;
  let row = step < 0 ? range.start - 1 : range.end + 1;
  const textAt = (candidate: number): string | null => {
    const line = buffer.getLine?.(candidate);
    return typeof line?.translateToString === 'function' ? line.translateToString(true) : null;
  };
  while (row >= 0 && row <= maxRow) {
    const text = textAt(row);
    if (text === null || text.trim() !== '') break;
    row += step;
  }
  if (row < 0 || row > maxRow || textAt(row) === null) return null;
  const block = terminalBlockRangeAt(buffer, row);
  if (block === null) return null;
  return { start: block.start, end: Math.min(block.end, maxRow) };
}

/**
 * Merge the current block with its adjacent block in one direction.
 * @param {object|null} buffer - xterm active buffer.
 * @param {{start: number, end: number}|null} range - current block.
 * @param {number} direction - -1 above, +1 below.
 * @param {number} [maxRow] - inclusive final searchable row.
 * @returns {{start: number, end: number}|null} expanded range.
 */
export function terminalExpandBlockRange(
  buffer: TerminalBuffer | null,
  range: TerminalBlockRange | null,
  direction: number,
  maxRow: number,
): TerminalBlockRange | null {
  const adjacent = terminalAdjacentBlockRange(buffer, range, direction, maxRow);
  if (adjacent === null) return null;
  return Number(direction) < 0 ? { start: adjacent.start, end: range.end } : { start: range.start, end: adjacent.end };
}

/**
 * Resolve IDEA block-mode arrow keys without stealing normal shell history.
 * Arrows belong to blocks only when a block selection already exists and the
 * terminal Find surface is closed.
 * @param {KeyboardEvent|object} event - terminal keydown.
 * @param {boolean} hasSelection - whether the focused pane has a selection.
 * @param {boolean} findOpen - whether Terminal Find owns the current context.
 * @returns {'selectAbove'|'selectBelow'|'expandAbove'|'expandBelow'|null} action.
 */
export function terminalBlockKeyboardAction(
  event: FindShortcutEvent,
  hasSelection: boolean,
  findOpen: boolean,
): string | null {
  if (hasSelection !== true || findOpen === true) return null;
  if (event?.metaKey === true || event?.ctrlKey === true || event?.altKey === true) return null;
  if (event?.key !== 'ArrowUp' && event?.key !== 'ArrowDown') return null;
  const direction = event.key === 'ArrowUp' ? 'Above' : 'Below';
  return `${event.shiftKey === true ? 'expand' : 'select'}${direction}`;
}

/** Whether the focused terminal pane should open its screen context menu. */
export function terminalScreenMenuKeyboardRequest(event: FindShortcutEvent | null | undefined): boolean {
  if (event === null || event === undefined) return false;
  if (event.metaKey === true || event.ctrlKey === true || event.altKey === true) return false;
  return event.key === 'ContextMenu' || (event.shiftKey === true && event.key === 'F10');
}

/**
 * IDEA-style terminal actions shared by the screen context menu and the tab menu.
 * @param {object} input - menu context.
 * @param {object} input.t - translator.
 * @param {object|null} input.emulator - xterm instance.
 * @param {object|null} input.active - active terminal description.
 * @param {Function} input.onSelectAll - select the whole buffer.
 * @param {Function} input.onClear - clear the screen.
 * @param {Function} input.onCreate - open a new terminal.
 * @returns {object|null} menu model.
 */
export function terminalMenuModel(input: TerminalMenuInput): { items: TerminalMenuAction[] } | null {
  const {
    t,
    emulator,
    active,
    onSelectAll,
    onFind,
    onClose,
    onClear,
    onClearBuffer,
    onCreate,
    onSplitRight,
    onMoveToEditor,
    onSwitchFocusToEditor,
    onClipboardError,
    onPastedText,
    pasteHistory = [],
    onPasteHistory,
    selectionPosition: initialSelectionPosition = null,
  } = input;
  if (emulator === null) return null;
  const selection = typeof emulator.getSelection === 'function' ? emulator.getSelection() : '';
  const buffer = emulator.buffer?.active;
  /* Some existing contract tests extract this function without its helper
         closure. Safe aliases keep production behavior while allowing those
         narrow fixtures to instantiate unrelated menu items. */
  const promptStartRowOf = typeof terminalPromptStartRow === 'function' ? terminalPromptStartRow : (): null => null;
  const lastBlockSelectionOf =
    typeof terminalLastBlockSelection === 'function' ? terminalLastBlockSelection : (): null => null;
  const selectionBlockRangeOf =
    typeof terminalSelectionBlockRange === 'function' ? terminalSelectionBlockRange : (): null => null;
  const adjacentBlockRangeOf =
    typeof terminalAdjacentBlockRange === 'function' ? terminalAdjacentBlockRange : (): null => null;
  const expandBlockRangeOf =
    typeof terminalExpandBlockRange === 'function' ? terminalExpandBlockRange : (): null => null;
  const selectionPosition =
    initialSelectionPosition ??
    (typeof emulator.getSelectionPosition === 'function' ? emulator.getSelectionPosition() : null);
  const selectedBlock = selectionBlockRangeOf(buffer, selectionPosition);
  const promptRow = promptStartRowOf(buffer);
  const maxBlockRow = promptRow === null ? (Number.isInteger(buffer?.length) ? buffer.length - 1 : -1) : promptRow - 1;
  const lastBlock = lastBlockSelectionOf(buffer);
  const blockAbove = selectedBlock === null ? lastBlock : adjacentBlockRangeOf(buffer, selectedBlock, -1, maxBlockRow);
  const blockBelow = selectedBlock === null ? null : adjacentBlockRangeOf(buffer, selectedBlock, 1, maxBlockRow);
  const expandedAbove = selectedBlock === null ? null : expandBlockRangeOf(buffer, selectedBlock, -1, maxBlockRow);
  const expandedBelow = selectedBlock === null ? null : expandBlockRangeOf(buffer, selectedBlock, 1, maxBlockRow);
  const selectBlockRange = (range: TerminalBlockRange | null): void => {
    if (range === null || typeof emulator.selectLines !== 'function') return;
    emulator.selectLines(range.start, range.end);
    emulator.focus?.();
  };
  const paneActions = [
    ...(onSplitRight === null || onSplitRight === undefined
      ? []
      : [{ id: 'splitRight', label: t('editor.terminalSplitRight'), run: onSplitRight }]),
    ...(onMoveToEditor === null || onMoveToEditor === undefined
      ? []
      : [{ id: 'moveToEditor', label: t('editor.terminalMoveToEditor'), run: onMoveToEditor }]),
    ...(onSwitchFocusToEditor === null || onSwitchFocusToEditor === undefined
      ? []
      : [
          {
            id: 'switchFocusToEditor',
            label: t('editor.terminalSwitchFocusToEditor'),
            restoreFocus: false,
            run: onSwitchFocusToEditor,
          },
        ]),
  ];
  return {
    items: [
      { id: 'find', label: t('editor.find'), shortcut: '⌘F', run: onFind },
      {
        id: 'searchHistory',
        label: t('editor.terminalSearchHistory'),
        shortcut: '⌃R',
        disabled: active === null || active.state === 'exited',
        restoreFocus: false,
        /* IDEA sends Control+R to the shell's readline; unlike find, this
               searches the shell command history and must keep input ownership
               in the terminal rather than in a dock-owned overlay. */
        run: () => {
          emulator.input('\u0012', true);
          emulator.focus?.();
        },
      },
      {
        id: 'interruptCommand',
        label: t('editor.terminalInterruptCommand'),
        disabled: active === null || active.state === 'exited',
        restoreFocus: false,
        run: () => {
          emulator.input('\u0003', true);
          emulator.focus?.();
        },
      },
      {
        id: 'clearPrompt',
        label: t('editor.terminalClearPrompt'),
        disabled: active === null || active.state === 'exited',
        restoreFocus: false,
        run: () => {
          emulator.input('\u0015', true);
          emulator.focus?.();
        },
      },
      { id: 'new', label: t('editor.terminalNew'), shortcut: '⌘T', run: onCreate },
      onClose === null || onClose === undefined
        ? null
        : {
            id: 'close',
            label: t('editor.terminalClose'),
            shortcut: '⌘W',
            disabled: active === null,
            run: onClose,
          },
      null,
      {
        id: 'copy',
        label: t('editor.terminalCopy'),
        shortcut: '⌘C',
        disabled: selection === '',
        run: () => {
          if (selection !== '') void navigator.clipboard?.writeText(selection).catch(() => {});
        },
      },
      {
        id: 'copyBlock',
        label: t('editor.terminalCopyBlock'),
        disabled: !Number.isInteger(buffer?.cursorY) || typeof emulator.selectLines !== 'function',
        run: () => {
          const range = lastBlockSelectionOf(emulator.buffer?.active);
          if (range === null) return;
          emulator.selectLines(range.start, range.end);
          emulator.focus?.();
          const text = typeof emulator.getSelection === 'function' ? emulator.getSelection() : '';
          if (text !== '') {
            void Promise.resolve(navigator.clipboard?.writeText(text)).catch(() => {
              onClipboardError?.(t('editor.clipboardWriteFailed'));
            });
          }
        },
      },
      {
        id: 'paste',
        label: t('editor.terminalPaste'),
        shortcut: '⌘V',
        disabled: active === null || active.state === 'exited',
        run: () => void pasteIntoTerminal(emulator, active, t, onClipboardError, onPastedText),
      },
      {
        id: 'pasteHistory',
        label: t('editor.terminalPasteHistory'),
        disabled: pasteHistory.length === 0,
        items: pasteHistory.map((text, index) => ({
          id: `pasteHistory:${index}`,
          label: pasteHistoryPreview(text),
          run: () => onPasteHistory?.(text),
        })),
      },
      { id: 'selectAll', label: t('editor.terminalSelectAll'), shortcut: '⌘A', run: onSelectAll },
      {
        id: 'selectLastBlock',
        label: t('editor.terminalSelectLastBlock'),
        shortcut: '⌘↑',
        disabled:
          !Number.isInteger(buffer?.cursorY) || buffer.cursorY <= 0 || typeof emulator.selectLines !== 'function',
        run: () => {
          const range = lastBlockSelectionOf(emulator.buffer?.active);
          if (range === null) return;
          emulator.selectLines(range.start, range.end);
          emulator.focus?.();
        },
      },
      {
        id: 'selectPrompt',
        label: t('editor.terminalSelectPrompt'),
        shortcut: '⌘↓',
        disabled:
          !Number.isInteger(buffer?.cursorY) ||
          !Number.isInteger(buffer?.cursorX) ||
          typeof emulator.select !== 'function',
        run: () => {
          const range = terminalPromptSelection(emulator.buffer?.active);
          if (range === null) return;
          const startRow = promptStartRowOf(emulator.buffer?.active, range.row);
          if (startRow !== null && startRow < range.row && typeof emulator.selectLines === 'function') {
            emulator.selectLines(startRow, range.row);
          } else {
            emulator.select(range.column, range.row, range.length);
          }
          emulator.focus?.();
        },
      },
      {
        id: 'selectBlockAbove',
        label: t('editor.terminalSelectBlockAbove'),
        disabled: blockAbove === null || typeof emulator.selectLines !== 'function',
        run: () => selectBlockRange(blockAbove),
      },
      {
        id: 'selectBlockBelow',
        label: t('editor.terminalSelectBlockBelow'),
        disabled: blockBelow === null || typeof emulator.selectLines !== 'function',
        run: () => selectBlockRange(blockBelow),
      },
      {
        id: 'expandBlockSelectionAbove',
        label: t('editor.terminalExpandBlockSelectionAbove'),
        disabled: expandedAbove === null || typeof emulator.selectLines !== 'function',
        run: () => selectBlockRange(expandedAbove),
      },
      {
        id: 'expandBlockSelectionBelow',
        label: t('editor.terminalExpandBlockSelectionBelow'),
        disabled: expandedBelow === null || typeof emulator.selectLines !== 'function',
        run: () => selectBlockRange(expandedBelow),
      },
      null,
      /* Two different clears, spelled out: ⌘K wipes the visible screen but keeps
             the scrollback, while this one throws the retained history away. The old
             labels ("清屏" vs "清除滚动缓冲") left the difference to the parenthetical. */
      { id: 'clear', label: t('editor.terminalClear'), shortcut: '⌘K', run: onClear },
      { id: 'clearBuffer', label: t('editor.terminalClearBuffer'), danger: true, run: onClearBuffer },
      {
        id: 'pageUp',
        label: t('editor.terminalPageUp'),
        shortcut: '⇧PageUp',
        disabled: typeof emulator.scrollPages !== 'function',
        run: () => {
          emulator.scrollPages?.(-1);
          emulator.focus?.();
        },
      },
      {
        id: 'pageDown',
        label: t('editor.terminalPageDown'),
        shortcut: '⇧PageDown',
        disabled: typeof emulator.scrollPages !== 'function',
        run: () => {
          emulator.scrollPages?.(1);
          emulator.focus?.();
        },
      },
      null,
      {
        id: 'lineUp',
        label: t('editor.terminalLineUp'),
        disabled: typeof emulator.scrollLines !== 'function',
        run: () => {
          emulator.scrollLines?.(-1);
          emulator.focus?.();
        },
      },
      {
        id: 'lineDown',
        label: t('editor.terminalLineDown'),
        disabled: typeof emulator.scrollLines !== 'function',
        run: () => {
          emulator.scrollLines?.(1);
          emulator.focus?.();
        },
      },
      ...(paneActions.length === 0 ? [] : [null, ...paneActions]),
    ],
  };
}

/**
 * Neighbour targeted by IDEA's Move Tab Left/Right action.
 * @param {object[]} terminals - tabs in current display order.
 * @param {string} id - tab being moved.
 * @param {'left'|'right'} direction - movement direction.
 * @returns {string|null} neighbour id, or null at the strip boundary.
 */
export function terminalMoveTarget(
  terminals: TerminalTabIdentity[],
  id: string,
  direction: 'left' | 'right',
): string | null {
  const list = Array.isArray(terminals) ? terminals : [];
  const index = list.findIndex((terminal) => terminal?.id === id);
  if (index < 0) return null;
  const targetIndex = index + (direction === 'left' ? -1 : 1);
  if (targetIndex < 0 || targetIndex >= list.length) return null;
  return list[targetIndex]?.id ?? null;
}

/**
 * Resolve which pane owns a terminal tab context-menu gesture.
 *
 * The split's own tab belongs to the right pane. Re-activating it through
 * the left pane would make both panes reference one PTY, and the split guard
 * would immediately collapse the split.
 * @param {string} terminalId - tab under the pointer.
 * @param {string|null} _activeId - terminal shown in the left pane.
 * @param {string|null} splitId - terminal shown in the right pane.
 * @returns {{pane: 'left'|'right', activate: boolean}} pane focus decision.
 */
export function terminalTabContextFocus(
  terminalId: string,
  _activeId: string | null,
  splitId: string | null,
): { pane: 'left' | 'right'; activate: boolean } {
  const splitTerminal = splitId !== null && terminalId === splitId;
  return {
    pane: splitTerminal ? 'right' : 'left',
    activate: splitTerminal === false,
  };
}

/**
 * Distinguish one hidden terminal tab in the overflow menu.
 *
 * Shell titles are often identical (`zsh`), so include the stable position in
 * the complete tab order rather than resetting numbering inside the hidden set.
 * @param t - translator.
 * @param terminals - all dock terminals in display order.
 * @param terminal - hidden terminal being labelled.
 * @returns localized `index. title` label.
 */
export function terminalOverflowItemLabel(
  t: (key: string, params?: Record<string, unknown>) => string,
  terminals: TerminalTabIdentity[],
  terminal: TerminalTabIdentity,
): string {
  const index = terminals.findIndex((candidate) => candidate?.id === terminal.id);
  return t('editor.terminalOverflowItem', {
    index: index < 0 ? 1 : index + 1,
    title: terminal.title || t('editor.terminalTitleLocal'),
  });
}

/**
 * Context menu for one terminal tab, matching IDEA's tab actions.
 * @param {object} t - translator.
 * @param {object} terminal - terminal description.
 * @param {{rename: Function, close: Function, closeOthers: Function, duplicate: Function}} actions - callbacks.
 * @returns {object[]} menu items.
 */
export function terminalTabMenu(
  t: (key: string, params?: Record<string, unknown>) => string,
  terminal: TerminalTabIdentity,
  actions: TerminalTabMenuActions,
): Array<TerminalMenuAction | null> {
  return [
    {
      id: 'rename',
      label: t('editor.terminalRename'),
      shortcut: '⇧F6',
      restoreFocus: false,
      run: actions.rename,
    },
    { id: 'color', label: t('editor.terminalColor'), run: actions.cycleColor },
    {
      id: 'duplicate',
      label: t('editor.terminalDuplicate'),
      disabled: actions.canDuplicate !== true,
      run: actions.duplicate,
    },
    {
      id: 'moveLeft',
      label: t('editor.terminalMoveLeft'),
      disabled: actions.canMoveLeft !== true,
      run: actions.moveLeft,
    },
    {
      id: 'moveRight',
      label: t('editor.terminalMoveRight'),
      disabled: actions.canMoveRight !== true,
      run: actions.moveRight,
    },
    {
      id: 'copyPath',
      label: t('editor.copyDirectoryPath'),
      run: (): void => void navigator.clipboard?.writeText(actions.cwd ?? terminal.cwd).catch((): void => {}),
    },
    /* IDEA's terminal menu opens the directory's README, so a shell `cd`-ed into
           another package does not force a trip back to the tree. Disabled (not
           hidden) when the directory has none: the user can see it exists. */
    {
      id: 'openReadme',
      label: t('editor.openReadme'),
      /* Enabled until a resolve proves there is none: a first open must not
             require a pre-flight listing, and `''` is the "checked, missing" marker. */
      disabled: actions.readmePath === '',
      run: () => actions.openReadme?.(),
    },
    /* IDEA's tab menu opens the shell's directory in the system file manager;
           without it the only way to find it is to read the path off the title. */
    { id: 'revealCwd', label: t('editor.revealInFinder'), run: () => actions.revealCwd?.() },
    null,
    actions.splitRight === null
      ? null
      : { id: 'splitRight', label: t('editor.terminalSplitRight'), run: actions.splitRight },
    {
      id: 'reopen',
      label: t('editor.terminalReopen'),
      disabled: actions.reopen === null || actions.reopen === undefined,
      run: actions.reopen,
    },
    actions.moveToEditor === null || actions.moveToEditor === undefined
      ? null
      : { id: 'moveToEditor', label: t('editor.terminalMoveToEditor'), run: actions.moveToEditor },
    actions.switchFocusToEditor === null || actions.switchFocusToEditor === undefined
      ? null
      : {
          id: 'switchFocusToEditor',
          label: t('editor.terminalSwitchFocusToEditor'),
          restoreFocus: false,
          run: actions.switchFocusToEditor,
        },
    { id: 'close', label: t('editor.terminalClose'), run: actions.close },
    {
      id: 'closeOthers',
      label: t('editor.terminalCloseOthers'),
      disabled: actions.canCloseOthers !== true,
      run: actions.closeOthers,
    },
  ].filter((item, index, list) => item !== null || (index > 0 && list[index - 1] !== null));
}

/**
 * Read the clipboard and hand the text to the active PTY.
 *
 * IDEA pastes multi-line text after a confirmation; a bracketed paste keeps
 * the shell from executing a pasted block line by line.
 * @param {object} emulator - xterm instance.
 * @param {object|null} active - active terminal.
 * @returns {Promise<void>} resolves once the text reached the PTY or was refused.
 */
export function pushPasteHistory(history: unknown, text: unknown): string[] {
  const value = typeof text === 'string' ? text : '';
  const current = Array.isArray(history) ? history : [];
  if (value === '') return current;
  return [value, ...current.filter((entry) => entry !== value)].slice(0, 10);
}

function pasteHistoryPreview(text: unknown, limit = 60): string {
  const normalized = (typeof text === 'string' ? text : '').replace(/\r\n?/g, '\n').replace(/\n/g, '↵');
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 1))}…`;
}

export async function writeTerminalText(
  emulator: TerminalEmulator,
  active: TerminalTabIdentity | null,
  text: unknown,
  t: (key: string, params?: Record<string, unknown>) => string,
): Promise<boolean | undefined> {
  if (active === null || active.state === 'exited') return;
  if (typeof text !== 'string' || text === '') return false;
  const lines = text.trimEnd().split('\n').length;
  /* IDEA's wording: say how much is about to be pasted before it runs. */
  if (lines > 1 && !window.confirm(t('editor.terminalPasteConfirm', { count: lines }))) return false;
  await callTerminal({ op: 'write', id: active.id, data: text }).catch(() => {});
  emulator.focus();
  return true;
}

export async function pasteIntoTerminal(
  emulator: TerminalEmulator,
  active: TerminalTabIdentity | null,
  t: (key: string, params?: Record<string, unknown>) => string,
  onRefused?: (message: string) => void,
  onPasted?: (text: string) => void,
): Promise<void> {
  if (active === null || active.state === 'exited') return;
  let text = '';
  try {
    text = (await navigator.clipboard?.readText()) ?? '';
  } catch {
    /* Refused or empty: tell the user instead of pretending the paste worked. */
    onRefused?.(t('editor.clipboardReadFailed'));
    return;
  }
  if (await writeTerminalText(emulator, active, text, t)) onPasted?.(text);
}

/**
 * How many terminal tabs fit in the strip at IDEA's minimum tab width.
 *
 * The dock is narrow and the tab strip does not wrap, so past a handful of
 * shells every label is squeezed to an unreadable stub. Measuring the strip
 * against a fixed minimum lets the tab bar collapse the overflow into IDEA's
 * `»` dropdown instead of shrinking every tab.
 * @param {number} width - strip width in pixels, 0 when unmeasured.
 * @param {number} count - how many tabs exist.
 * @param {number} [reserve=30] - width kept for the `»` button itself.
 * @returns {number} how many leading tabs to render; `count` when all fit.
 */
export function visibleTabCount(width: number, count: number, reserve = 30): number {
  if (!Number.isFinite(width) || width <= 0) return count;
  if (!Number.isFinite(count) || count <= 0) return 0;
  /* 92px is IDEA's practical minimum for a legible "zsh — project" label. */
  const perTab = 92;
  const fits = Math.max(0, Math.floor((width - reserve) / perTab));
  if (fits >= count) return count;
  return Math.max(1, fits);
}

/**
 * Split the dock's tabs into the visible strip and IDEA's `»` overflow list.
 *
 * The active tab always stays in the strip — a selected terminal whose tab
 * lives only in a dropdown looks like the click did nothing — so it displaces
 * the last plain tab of the visible run.
 * @param {object[]} terminals - tabs in their user-ordered sequence.
 * @param {number} visibleCount - how many fit (see {@link visibleTabCount}).
 * @param {string|null} activeId - the currently focused terminal's id.
 * @returns {{visible: object[], hidden: object[]}} strip and overflow tabs.
 */
export function overflowTabs<T>(
  items: T[],
  visibleCount: number,
  activeId: string | null,
  idOf: (item: T) => string | undefined = (item) =>
    typeof item === 'string' ? item : (item as TerminalTabIdentity | null | undefined)?.id,
): { visible: T[]; hidden: T[] } {
  const list = Array.isArray(items) ? items : [];
  const keep = Math.max(0, Math.min(visibleCount, list.length));
  const visible = list.slice(0, keep);
  const active = list.find((item) => idOf(item) === activeId);
  if (active !== undefined && !visible.includes(active) && visible.length > 0) {
    visible[visible.length - 1] = active;
  }
  const shown = new Set(visible.map((item) => idOf(item)));
  /* Identity comes from `idOf`, NOT `.id`: file tabs carry `path` instead, and
         reading `.id` made every file look identical (`undefined`), so the overflow
         list came back empty and no `»` was ever rendered. */
  return { visible, hidden: list.filter((item) => !shown.has(idOf(item))) };
}

/**
 * Move one tab to the before/after slot of another tab.
 *
 * React gets the original array for invalid or no-op drops, so a missed
 * drag does not trigger a full tab-strip render. The target index is
 * recalculated after removing the source, which makes left-to-right moves
 * land on the side the insertion hint showed.
 * @param {object[]|string[]} items - ordered tabs.
 * @param {string} sourceId - dragged tab identity.
 * @param {string} targetId - tab under the pointer.
 * @param {boolean} after - insert after the target instead of before.
 * @param {(item: object|string) => string} [idOf] - tab identity.
 * @returns {object[]|string[]} reordered list, or the same list for a no-op.
 */
export function reorderTabPaths<T>(
  items: T[],
  sourceId: string,
  targetId: string,
  after = false,
  idOf: (item: T) => string | undefined = (item) =>
    typeof item === 'string' ? item : (item as TerminalTabIdentity | null | undefined)?.id,
): T[] {
  const list = Array.isArray(items) ? items : [];
  if (typeof sourceId !== 'string' || typeof targetId !== 'string' || sourceId === targetId) return list;
  const from = list.findIndex((item) => idOf(item) === sourceId);
  if (from < 0 || !list.some((item) => idOf(item) === targetId)) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  const targetIndex = next.findIndex((item) => idOf(item) === targetId);
  if (targetIndex < 0) return list;
  next.splice(targetIndex + (after === true ? 1 : 0), 0, moved);
  return next;
}

/**
 * An invisible xterm that only measures the dock's grid.
 *
 * Before the first shell exists there is no PTY and therefore no `cols`/`rows`
 * to spawn with — the old code guessed 80×24. zsh's PROMPT_SP pads its `%`
 * marker to the PTY width and erases it with a backspacing space, so a PTY
 * wider than the screen leaves that `%` wrapped onto the row above the
 * prompt. Fitting a real emulator to the real box gives the honest number.
 * @param {{fontSize: number, onGrid: Function}} props - font size and grid sink.
 * @returns {object} a zero-opacity xterm host.
 */
/* MeasuringScreen migrated to components/terminal/MeasuringScreen.tsx. */

/**
 * One xterm screen bound to a host terminal id.
 *
 * Used once for the dock and twice when the dock is split, so the effects that
 * own the emulator, the output stream, the PTY grid and the find highlight are
 * shared by both panes instead of being duplicated.
 */
