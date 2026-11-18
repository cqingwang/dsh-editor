/* commit.ts: dsh-editor Search/Find model and storage helpers. Generated into lib/client.js by scripts/build-client.mjs. */
import type * as Monaco from 'monaco-editor';
import { dirname } from './components/editor/editor-path-model';
import { basename, safeLanguage } from './editor-core';
import { findScopePatternsMatch, fuzzyScore, wholeWordIndex } from './find-tool';
import { editorReplaceAll } from './terminal';
import React from 'react';

interface SearchPreviewWindow {
  start: number;
  end: number;
  truncatedBefore: boolean;
  truncatedAfter: boolean;
}

interface PreviewLineMetrics {
  containerTop?: number;
  containerHeight?: number;
  scrollTop?: number;
  scrollHeight?: number;
  lineTop?: number;
  lineHeight?: number;
}

interface FindMatchLike {
  path?: string;
  offset?: number;
  length?: number;
  line?: number;
  column?: number;
  preview?: string;
  mtime?: number;
  [key: string]: unknown;
}

interface FindMatchRange {
  offset: number;
  length: number;
}

interface PreviewLinePart {
  text: string;
  match: boolean;
}

interface CodePreviewRange {
  start: number;
  end: number;
}

interface FindToolFileGroup {
  path: string;
  matches: FindMatchLike[];
}

interface FindToolPathScopeOptions {
  directory?: string;
  recursive?: boolean;
  customScope?: { includePatterns?: unknown; excludePatterns?: unknown } | null;
  preset?: string;
  allowedPaths?: Set<string> | string[] | null;
}

interface FindScopePresetContext {
  gitAvailable?: boolean;
  recentFileCount?: number;
  openFileCount?: number;
  currentFileAvailable?: boolean;
  changedFileCount?: number;
}

interface ReplaceFailure extends Error {
  rollbackFailures?: Array<{ path: string; message: string }>;
}

interface SearchResultContextOptions {
  t: (key: string, params?: Record<string, unknown>) => string;
  result: { kind: string; path: string; line?: number; column?: number };
  onCloseMenu: () => void;
  onOpenEditor: () => void;
  onOpenInRightSplit: () => void;
  onReplace?: () => void;
  onRevealResult: () => void;
  onNotify: (message: string) => void;
  onShowInfo?: () => void;
}

/**
 * Bounded line window for Search Everywhere's lightweight preview.
 *
 * IDEA previews the full file, but rendering a multi-thousand-line document in
 * the modal would duplicate Monaco's editor cost. Keep a fixed maximum and
 * centre it on the selected text hit.
 * @param {string} content - file contents.
 * @param {number} line - one-based focus line.
 * @param {number} [maximum=401] - maximum rendered lines.
 * @returns {{start: number, end: number, truncatedBefore: boolean, truncatedAfter: boolean}} window.
 */
export function searchEverywherePreviewWindow(content: string, line: number, maximum = 401): SearchPreviewWindow {
  const lines = String(content ?? '').split(/\r?\n/u);
  const total = lines.length;
  const limit = Math.max(1, Math.floor(Number(maximum) || 401));
  const focus = Math.max(1, Math.min(total, Math.floor(Number(line) || 1)));
  if (total <= limit) {
    return { start: 1, end: total, truncatedBefore: false, truncatedAfter: false };
  }
  const half = Math.floor((limit - 1) / 2);
  let start = Math.max(1, focus - half);
  let end = Math.min(total, start + limit - 1);
  start = Math.max(1, end - limit + 1);
  return {
    start,
    end,
    truncatedBefore: start > 1,
    truncatedAfter: end < total,
  };
}

/**
 * Scroll offset that places one preview line at the vertical centre.
 *
 * The rendered window may contain the complete short file, but the scroll
 * container still starts at zero. This helper converts absolute viewport
 * boxes into a clamped scrollTop so both short and truncated previews focus
 * the active match instead of the first physical line.
 * @param {{containerTop:number, containerHeight:number, scrollTop:number, scrollHeight:number, lineTop:number, lineHeight:number}} metrics - layout boxes.
 * @returns {number} clamped scrollTop.
 */
function previewLineScrollTop(metrics: PreviewLineMetrics = {}): number {
  const containerTop = Number(metrics.containerTop);
  const containerHeight = Math.max(0, Number(metrics.containerHeight) || 0);
  const current = Math.max(0, Number(metrics.scrollTop) || 0);
  const scrollHeight = Math.max(containerHeight, Number(metrics.scrollHeight) || containerHeight);
  const lineTop = Number(metrics.lineTop);
  const lineHeight = Math.max(0, Number(metrics.lineHeight) || 0);
  if (![containerTop, lineTop].every(Number.isFinite)) return current;
  const centred = current + lineTop - containerTop - (containerHeight - lineHeight) / 2;
  return Math.max(0, Math.min(scrollHeight - containerHeight, centred));
}

/**
 * Centre one rendered preview line inside its own scroll container.
 * @param {HTMLElement|null} container - preview scroll body.
 * @param {HTMLElement|null} lineNode - active preview line.
 * @returns {boolean} whether the container was scrolled.
 */
export function centerPreviewLineInContainer(container: HTMLElement | null, lineNode: HTMLElement | null): boolean {
  if (container === null || lineNode === null) return false;
  if (typeof container.getBoundingClientRect !== 'function' || typeof lineNode.getBoundingClientRect !== 'function')
    return false;
  const containerRect = container.getBoundingClientRect();
  const lineRect = lineNode.getBoundingClientRect();
  container.scrollTop = previewLineScrollTop({
    containerTop: containerRect.top,
    containerHeight: container.clientHeight,
    scrollTop: container.scrollTop,
    scrollHeight: container.scrollHeight,
    lineTop: lineRect.top,
    lineHeight: lineRect.height,
  });
  return true;
}

/**
 * Record the absolute offset where every physical text line starts.
 * @param {string} content - complete text.
 * @returns {number[]} zero-based line-start offsets.
 */
export function findToolTextLineStarts(content: string): number[] {
  const text = typeof content === 'string' ? content : '';
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n') starts.push(index + 1);
  }
  return starts;
}

/**
 * Clip Find match ranges to the visible characters of one preview line.
 *
 * A query may contain newlines and therefore span several lines. Each line
 * receives only its own intersection, while overlapping matches are merged
 * so adjacent visual spans do not stack the same highlight repeatedly.
 * @param {string} lineText - one preview line without its newline.
 * @param {number} lineStart - absolute offset of this line.
 * @param {Array<{offset: number, length: number}>} matches - Find matches.
 * @returns {Array<{text: string, match: boolean}>} ordered line parts.
 */
export function findToolPreviewLineParts(
  lineText: string,
  lineStart: number,
  matches: FindMatchRange[],
): PreviewLinePart[] {
  const text = typeof lineText === 'string' ? lineText : '';
  if (text === '') return [];
  const startOffset = Math.max(0, Math.floor(Number(lineStart) || 0));
  const endOffset = startOffset + text.length;
  const ranges = [];
  for (const match of Array.isArray(matches) ? matches : []) {
    const offset = Number(match?.offset);
    const length = Number(match?.length);
    if (!Number.isFinite(offset) || !Number.isFinite(length) || length <= 0) continue;
    const start = Math.max(startOffset, offset);
    const end = Math.min(endOffset, offset + length);
    if (end <= start) continue;
    ranges.push({ start: start - startOffset, end: end - startOffset });
  }
  ranges.sort((left, right) => left.start - right.start || right.end - left.end);
  const merged = [];
  for (const range of ranges) {
    const previous = merged[merged.length - 1];
    if (previous !== undefined && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  if (merged.length === 0) return [{ text, match: false }];
  const parts = [];
  let cursor = 0;
  for (const range of merged) {
    if (range.start > cursor) parts.push({ text: text.slice(cursor, range.start), match: false });
    parts.push({ text: text.slice(range.start, range.end), match: true });
    cursor = range.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });
  return parts;
}

/**
 * Resolve the language used by Monaco's standalone colorizer for a preview.
 * @param {object|null} monaco - Monaco namespace, when loaded.
 * @param {string} path - previewed file path.
 * @returns {string} registered Monaco language id or plaintext.
 */
function codePreviewLanguage(monaco: typeof Monaco, path: string): string {
  if (monaco?.languages === undefined || typeof monaco.languages.getLanguages !== 'function') return 'plaintext';
  return safeLanguage(monaco, path);
}

/**
 * Color one bounded preview window with Monaco's own tokenizer.
 *
 * Search Everywhere and Find render lightweight DOM previews instead of
 * creating another editor. Reusing Monaco's colorizer keeps syntax colours
 * aligned with the real editor without duplicating language grammars.
 * @param {string[]} lines - visible preview lines.
 * @param {string} path - previewed file path.
 * @returns {string[]|null} one sanitized HTML fragment per line, or null while unavailable.
 */
export function useCodePreviewColorizedLines(lines: string[], path: string): string[] | null {
  const text = Array.isArray(lines) ? lines.join('\n') : '';
  const key = `${path ?? ''}\u0000${text}`;
  const [entry, setEntry] = React.useState({ key: '', lines: null });
  React.useEffect(() => {
    let cancelled = false;
    const monaco = window.monaco;
    if (text === '' || typeof monaco?.editor?.colorize !== 'function') {
      setEntry({ key, lines: null });
      return () => {
        cancelled = true;
      };
    }
    monaco.editor
      .colorize(text, codePreviewLanguage(monaco, path), { tabSize: 2 })
      .then((html) => {
        if (cancelled) return;
        const fragments = String(html).split('<br/>');
        setEntry({
          key,
          lines: fragments.length >= lines.length ? fragments.slice(0, lines.length) : null,
        });
      })
      .catch(() => {
        if (!cancelled) setEntry({ key, lines: null });
      });
    return () => {
      cancelled = true;
    };
  }, [key, lines.length, path, text]);
  return entry.key === key ? entry.lines : null;
}

/**
 * Convert visible line parts into character ranges for DOM highlighting.
 * @param {Array<{text: string, match: boolean}>|null} parts - line parts.
 * @returns {Array<{start: number, end: number}>} non-overlapping ranges.
 */
export function codePreviewMatchRanges(
  parts: Array<{ text: string; match?: boolean }> | null | undefined,
): CodePreviewRange[] {
  const ranges: CodePreviewRange[] = [];
  let offset = 0;
  for (const part of Array.isArray(parts) ? parts : []) {
    const text = typeof part?.text === 'string' ? part.text : '';
    if (part?.match === true && text !== '') ranges.push({ start: offset, end: offset + text.length });
    offset += text.length;
  }
  return ranges;
}

/**
 * Wrap text intersections with Find's match highlight after colorization.
 * Processing text nodes in reverse keeps earlier offsets stable.
 * @param {HTMLElement} root - colorized code element.
 * @param {Array<{start: number, end: number}>} ranges - character ranges.
 * @returns {void}
 */
export function markCodePreviewMatches(root: HTMLElement, ranges: CodePreviewRange[]): void {
  for (const range of ranges) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let offset = 0;
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const length = node.nodeValue?.length ?? 0;
      nodes.push({ node, start: offset, end: offset + length });
      offset += length;
    }
    for (let index = nodes.length - 1; index >= 0; index -= 1) {
      const entry = nodes[index];
      const start = Math.max(range.start, entry.start);
      const end = Math.min(range.end, entry.end);
      if (end <= start) continue;
      let target = entry.node;
      const localStart = start - entry.start;
      const localEnd = end - entry.start;
      if (localStart > 0) target = target.splitText(localStart);
      if (localEnd - localStart < target.length) target.splitText(localEnd - localStart);
      const mark = document.createElement('span');
      mark.className = 'dsh-editor-code-preview-match';
      mark.setAttribute('data-dsh-find-preview-match', '1');
      target.parentNode?.insertBefore(mark, target);
      mark.appendChild(target);
    }
  }
}

/**
 * Group Find-tool occurrences by file while preserving search order.
 *
 * IDEA's Find tool window is a tree: one file row owns each of its
 * occurrences. The host returns flat path/line records, so grouping is a
 * pure projection and must not reorder files or occurrences.
 * @param {object[]} matches - flat text-search hits.
 * @returns {Array<{path: string, matches: object[]}>} stable file groups.
 */
function groupFindMatches(matches: FindMatchLike[]): FindToolFileGroup[] {
  const groups: FindToolFileGroup[] = [];
  const byPath = new Map<string, FindToolFileGroup>();
  for (const match of Array.isArray(matches) ? matches : []) {
    if (typeof match?.path !== 'string' || match.path === '') continue;
    let group = byPath.get(match.path);
    if (group === undefined) {
      group = { path: match.path, matches: [] };
      byPath.set(match.path, group);
      groups.push(group);
    }
    group.matches.push(match);
  }
  return groups;
}

/** Normalize the two grouping structures DSH can truthfully provide. */
export function normalizeFindGroupBy(value: unknown): 'file' | 'directory' {
  return value === 'directory' ? 'directory' : 'file';
}

/**
 * Sort file groups according to IDEA's File / Directory Structure modes.
 * Occurrences inside each file keep the host's search order.
 */
function orderFindToolGroups(groups: FindToolFileGroup[], groupBy: string): FindToolFileGroup[] {
  const ordered = Array.isArray(groups) ? [...groups] : [];
  if (normalizeFindGroupBy(groupBy) !== 'directory') return ordered;
  return ordered.sort((left, right) => {
    const leftDirectory = dirname(left.path);
    const rightDirectory = dirname(right.path);
    return (
      leftDirectory.localeCompare(rightDirectory, undefined, { sensitivity: 'base' }) ||
      left.path.localeCompare(right.path, undefined, { sensitivity: 'base' })
    );
  });
}

/**
 * Insert display-only directory headers before file groups. The headers do
 * not enter the keyboard occurrence sequence; file rows keep ownership of
 * every occurrence and replacement target.
 */
export function findToolDisplayGroups(groups, groupBy) {
  const ordered = orderFindToolGroups(groups, groupBy);
  if (normalizeFindGroupBy(groupBy) !== 'directory') {
    return ordered.map((group) => ({ ...group, kind: 'file' }));
  }
  const display = [];
  let currentDirectory = null;
  let currentDirectoryEntry = null;
  for (const group of ordered) {
    const directory = dirname(group.path);
    if (directory !== currentDirectory) {
      currentDirectory = directory;
      currentDirectoryEntry = {
        kind: 'directory',
        path: directory,
        count: 0,
      };
      display.push(currentDirectoryEntry);
    }
    currentDirectoryEntry.count += Array.isArray(group.matches) ? group.matches.length : 0;
    display.push({ ...group, kind: 'file' });
  }
  return display;
}

/**
 * Project file/text search results into the rows currently visible in Find.
 *
 * Collapsing a file removes only its occurrence rows; file-name results are
 * leaves and remain visible. Keeping this projection pure lets keyboard
 * traversal and rendering share exactly the same row order.
 * @param {object[]} files - file-name search results.
 * @param {object[]} matches - flat text-search occurrences.
 * @param {Set<string>} collapsedPaths - text files whose rows are folded.
 * @returns {{groups: object[], rows: object[]}} grouped results and visible rows.
 */
export function findToolVisibleRows(files, matches, collapsedPaths, groupBy = 'file') {
  const groups = orderFindToolGroups(groupFindMatches(matches), groupBy);
  const collapsed = collapsedPaths instanceof Set ? collapsedPaths : new Set();
  const fileRows = (Array.isArray(files) ? files : []).map((file) => ({
    ...file,
    kind: 'file',
    rowKey: `file:${file.path}`,
  }));
  const textRows = groups
    .filter((group) => !collapsed.has(group.path))
    .flatMap((group) =>
      group.matches.map((match) => ({
        ...match,
        kind: 'text',
        rowKey: `text:${match.path}:${match.line}:${match.column}`,
      })),
    );
  return { groups, rows: [...fileRows, ...textRows] };
}

/**
 * Resolve a Search Everywhere handoff index before any Find groups collapse.
 *
 * The handoff index addresses the complete Files + Text option sequence.
 * Find's visible index is narrower after users collapse groups, so reveal
 * must recover the target row identity first instead of clamping the
 * handoff against the currently visible rows.
 * @param {object[]} files - file-name search results.
 * @param {object[]} matches - flat text-search occurrences.
 * @param {number} index - request index in the complete option sequence.
 * @returns {{kind: 'file'|'text', path: string, rowKey: string, index: number}|null} target.
 */
export function findToolHandoffTarget(files, matches, index, groupBy = 'file') {
  const rows = findToolVisibleRows(files, matches, new Set(), groupBy).rows;
  if (rows.length === 0) return null;
  const position = Math.max(0, Math.min(rows.length - 1, Number(index) || 0));
  const target = rows[position];
  if (typeof target?.path !== 'string' || typeof target?.rowKey !== 'string') return null;
  return {
    kind: target.kind === 'file' ? 'file' : 'text',
    path: target.path,
    rowKey: target.rowKey,
    index: position,
  };
}

/**
 * Build a collision-safe DOM id for one persistent Find row.
 * @param {string} rowKey - file/text result identity.
 * @returns {string} id used by aria-activedescendant.
 */
export function findToolOptionId(rowKey) {
  return `dsh-editor-find-option-${encodeURIComponent(String(rowKey ?? ''))}`;
}

/**
 * Build the stable container id for one Find file group.
 * @param {string} path - workspace file path.
 * @returns {string} group container id.
 */
export function findToolGroupId(path) {
  return `dsh-editor-find-group-${encodeURIComponent(String(path ?? ''))}`;
}

/**
 * Resolve keyboard movement between Find file-group headers.
 * @param {object[]} groups - visible file groups.
 * @param {string|null} currentPath - currently focused group.
 * @param {string} key - keyboard key.
 * @returns {string|null} target group path, or null when unavailable.
 */
export function findToolGroupTarget(groups, currentPath, key) {
  const paths = (Array.isArray(groups) ? groups : [])
    .map((group) => group?.path)
    .filter((path) => typeof path === 'string' && path !== '');
  if (paths.length === 0) return null;
  if (key === 'Home') return paths[0];
  if (key === 'End') return paths[paths.length - 1];
  const current = Math.max(0, paths.indexOf(currentPath));
  if (key === 'ArrowDown') return paths[Math.min(paths.length - 1, current + 1)];
  if (key === 'ArrowUp') return paths[Math.max(0, current - 1)];
  return null;
}

/**
 * Route an occurrence boundary back into the flattened Find hierarchy.
 * @param {object[]} groups - visible text groups.
 * @param {string} rowKey - focused text occurrence.
 * @param {'ArrowUp'|'ArrowDown'} key - movement direction.
 * @returns {{kind: 'group', path: string}|null} owning/next group or null.
 */
export function findToolGroupBoundaryTarget(groups, rowKey, key) {
  const list = Array.isArray(groups) ? groups : [];
  for (let groupIndex = 0; groupIndex < list.length; groupIndex += 1) {
    const group = list[groupIndex];
    const matches = Array.isArray(group?.matches) ? group.matches : [];
    const matchIndex = matches.findIndex((match) => `text:${match.path}:${match.line}:${match.column}` === rowKey);
    if (matchIndex < 0) continue;
    if (key === 'ArrowUp' && matchIndex === 0) return { kind: 'group', path: group.path };
    if (key === 'ArrowDown' && matchIndex === matches.length - 1) {
      const next = list[groupIndex + 1];
      return next === undefined ? null : { kind: 'group', path: next.path };
    }
    return null;
  }
  return null;
}

/**
 * Detect the first text-group header after file-name result rows.
 * @param {object[]} occurrences - flattened visible Find result rows.
 * @param {number} position - focused row index.
 * @returns {string|null} next text group path, or null.
 */
export function findToolNextTextGroupPath(occurrences, position) {
  if (!Array.isArray(occurrences) || !Number.isFinite(position)) return null;
  const next = occurrences[position + 1];
  if (next?.kind !== 'text' || typeof next.path !== 'string' || next.path === '') return null;
  return next.path;
}

/**
 * Apply IDEA's Find in Files scope row without inventing modules.
 * Project searches everything; Directory uses the active file's directory;
 * Scope narrows to the selected truthful preset.
 * @param {string} path - workspace-relative path.
 * @param {'project'|'directory'|'scope'} mode - selected scope family.
 * @param {{directory?: string, recursive?: boolean, preset?: 'projectFiles'|'openFiles'|'changedFiles'|'currentFile'|'recentlyViewedFiles'|'gitTrackedFiles'|'gitNonIgnoredFiles', allowedPaths?: Set<string>|string[]}} options - scope data.
 * @returns {boolean} whether the path participates.
 */
export function findToolPathMatchesScope(path: string, mode: string, options: FindToolPathScopeOptions = {}): boolean {
  if (typeof path !== 'string' || path === '') return false;
  if (mode === 'directory') {
    const rawDirectory = typeof options.directory === 'string' ? options.directory.trim() : '';
    const directory =
      rawDirectory === '.' || rawDirectory === '/' ? '' : rawDirectory.replace(/^\.\/+/u, '').replace(/\/+$/u, '');
    if (options.recursive === false) {
      const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
      return parent === directory;
    }
    if (directory === '') return true;
    return path === directory || path.startsWith(`${directory}/`);
  }
  if (mode === 'scope') {
    if (options.customScope !== null && typeof options.customScope === 'object') {
      return findScopePatternsMatch(path, options.customScope.includePatterns, options.customScope.excludePatterns);
    }
    if (
      options.preset === 'projectFiles' ||
      options.preset === 'gitTrackedFiles' ||
      options.preset === 'gitNonIgnoredFiles'
    )
      return true;
    const allowed =
      options.allowedPaths instanceof Set
        ? options.allowedPaths
        : new Set(Array.isArray(options.allowedPaths) ? options.allowedPaths : []);
    return allowed.has(path);
  }
  return true;
}

/**
 * Whether one Find Scope preset has the data it needs to be actionable.
 * The option remains visible but disabled when unavailable, matching IDEA's
 * "present but not currently selectable" behavior for context-bound scopes.
 * @param {string} preset - normalized Scope preset.
 * @param {{gitAvailable?: boolean, recentFileCount?: number, openFileCount?: number, currentFileAvailable?: boolean, changedFileCount?: number}} context - availability.
 * @returns {boolean} true when the preset can produce a real result set.
 */
export function findSearchScopePresetAvailable(preset: string, context: FindScopePresetContext = {}): boolean {
  if (preset === 'gitTrackedFiles' || preset === 'gitNonIgnoredFiles') {
    return context?.gitAvailable === true;
  }
  if (preset === 'recentlyViewedFiles') {
    return Math.max(0, Number(context?.recentFileCount) || 0) > 0;
  }
  if (preset === 'openFiles') {
    return Math.max(0, Number(context?.openFileCount) || 0) > 0;
  }
  if (preset === 'currentFile') {
    return context?.currentFileAvailable === true;
  }
  if (preset === 'changedFiles') {
    return Math.max(0, Number(context?.changedFileCount) || 0) > 0;
  }
  return true;
}

/**
 * Normalize one recent-search entry. Search Everywhere now treats query text
 * literally and leaves provider choice to tabs, so slash text must survive
 * history replay unchanged.
 * @param {unknown} entry - stored query.
 * @returns {string} trimmed replayable query.
 */
export function normalizeRecentSearchEntry(entry) {
  return typeof entry === 'string' ? entry.trim() : '';
}

/**
 * Normalize and deduplicate recent Search Everywhere queries.
 * @param {unknown[]} history - stored newest-first queries.
 * @param {string} [query=''] - newly executed query.
 * @param {number} [limit=20] - maximum retained entries.
 * @returns {string[]} normalized newest-first history.
 */
function rememberRecentSearchHistory(history, query = '', limit = 20) {
  const entries = Array.isArray(history)
    ? history.map((entry) => normalizeRecentSearchEntry(entry)).filter((entry) => entry !== '')
    : [];
  return rememberSearchHistory(entries, normalizeRecentSearchEntry(query), limit);
}

/**
 * Preserve one exact Find query, including newline and surrounding space.
 * @param {unknown} entry - stored or newly entered query.
 * @returns {string} exact query, including IDEA's replayable empty entry.
 */
export function normalizeFindQueryHistoryEntry(entry) {
  return typeof entry === 'string' ? entry : '';
}

/**
 * Keep bounded, exact, newest-first Find query history.
 * @param {unknown[]} history - stored entries.
 * @param {string|undefined} query - newly executed exact query; undefined
 *   when only normalizing stored entries.
 * @param {number} [limit=20] - maximum retained queries.
 * @returns {string[]} exact query history.
 */
function rememberFindQueryHistory(history, query, limit = 20) {
  const entries = (Array.isArray(history) ? history : []).filter((entry) => typeof entry === 'string');
  if (typeof query !== 'string') {
    return [...new Set(entries)].filter((entry, index, list) => list.indexOf(entry) === index).slice(0, limit);
  }
  return [query, ...entries.filter((entry) => entry !== query)]
    .filter((entry, index, list) => list.indexOf(entry) === index)
    .slice(0, limit);
}

/**
 * IDEA asks before materializing a very large Search Everywhere result set.
 * DSH's bounded search tops out below that, but persisted Files/Text results
 * can still be large enough to make an accidental tool-window handoff noisy.
 * @param {unknown[]} files - file-name results.
 * @param {unknown[]} matches - text occurrence results.
 * @param {number} [limit=200] - confirmation threshold.
 * @returns {boolean} whether the user should confirm before opening Find.
 */
export function searchEverywhereRequiresResultConfirmation(files, matches, limit = 200) {
  const total = (Array.isArray(files) ? files.length : 0) + (Array.isArray(matches) ? matches.length : 0);
  return total > Math.max(0, Number(limit) || 200);
}

/**
 * Resolve IDEA Find Usages' search text from the active editor.
 *
 * A selected phrase is already an explicit user choice. Otherwise Monaco's
 * word API supplies the identifier under the caret. The caller reuses the
 * existing workspace Find path instead of introducing a second search
 * surface or a language-service dependency.
 * @param {object|null} editor - active Monaco editor.
 * @returns {{query: string, reason: 'editor'|'symbol'|null}} search request.
 */
export function findUsagesSearchTarget(editor) {
  const model = editor?.getModel?.() ?? null;
  if (model === null) return { query: '', reason: 'editor' };
  const normalize = (value) => {
    const raw = typeof value === 'string' ? value : '';
    if (/[\r\n]/u.test(raw)) return '';
    const text = raw.trim();
    if (text === '' || text.length > 200) return '';
    return text;
  };
  const selection = editor?.getSelection?.() ?? null;
  if (selection !== null && selection.isEmpty?.() === false) {
    const selected = normalize(model.getValueInRange?.(selection));
    if (selected !== '') return { query: selected, reason: null };
  }
  const position = selection?.getPosition?.() ?? selection?.getStartPosition?.() ?? editor?.getPosition?.() ?? null;
  const word = position === null ? null : (model.getWordAtPosition?.(position) ?? null);
  const query = normalize(word?.word);
  return query === '' ? { query: '', reason: 'symbol' } : { query, reason: null };
}

/**
 * Build the single Search Everywhere to Find handoff contract.
 * @param {object} options - query, result sets, mode and persisted search options.
 * @returns {{needsConfirmation: boolean, total: number, request: object}} handoff request.
 */
export function searchFindHandoff({
  query,
  files,
  matches,
  activeRowKey = '',
  truncated = false,
  mode = 'find',
  withReplace = false,
  caseSensitive = false,
  wholeWords = false,
  regex = false,
  preserveCase = false,
  includeExcluded = false,
  fileMask = '',
  limit = 200,
}) {
  const fileList = Array.isArray(files) ? files : [];
  const matchList = Array.isArray(matches) ? matches : [];
  const total = fileList.length + matchList.length;
  const boundedLimit = Math.max(0, Number(limit) || 200);
  const rowKeys = [
    ...fileList.map((file) => (typeof file?.rowKey === 'string' ? file.rowKey : `file:${file?.path ?? ''}`)),
    ...matchList.map((match) =>
      typeof match?.rowKey === 'string'
        ? match.rowKey
        : `text:${match?.path ?? ''}:${match?.line ?? 1}:${match?.column ?? 1}`,
    ),
  ];
  const activeIndex = rowKeys.indexOf(activeRowKey);
  return {
    needsConfirmation: searchEverywhereRequiresResultConfirmation(fileList, matchList, boundedLimit),
    total,
    request: {
      query: typeof query === 'string' ? query : '',
      files: fileList,
      matches: matchList,
      index: activeIndex < 0 ? 0 : activeIndex,
      truncated: truncated === true,
      mode: mode === 'replace' || withReplace === true ? 'replace' : 'find',
      caseSensitive: caseSensitive === true,
      wholeWords: regex === true ? false : wholeWords === true,
      regex: regex === true,
      preserveCase: preserveCase === true,
      includeExcluded: includeExcluded === true,
      fileMask: typeof fileMask === 'string' ? fileMask : '',
    },
  };
}

/**
 * Reserve one replace write before React can commit its busy state.
 *
 * Two keyboard events can run in the same task while `replaceBusy` is still
 * false. The ref closes that gap; state continues to drive disabled UI.
 * @param {{current: boolean}|null} guard - synchronous write guard.
 * @param {boolean} stateBusy - current React busy state.
 * @returns {boolean} whether this caller owns the next write.
 */
/**
 * Preserve Find in Files query text exactly, including New Line whitespace.
 *
 * Whitespace is user data here: trimming it changes the literal searched or
 * replaced bytes and makes a textarea query disagree with its visible value.
 * @param {unknown} query - raw Find query.
 * @returns {string} exact query string.
 */
export function findToolContentQuery(query) {
  return typeof query === 'string' ? query : '';
}

/**
 * Decide whether Find has a representable content query.
 *
 * Empty strings are the only empty state. A space or newline is a valid
 * one-character literal query, matching IDEA's Find in Files field.
 * @param {unknown} query - raw Find query.
 * @returns {boolean} whether the query has at least one character.
 */
export function hasFindToolContentQuery(query) {
  return findToolContentQuery(query).length > 0;
}

/**
 * Enter a new Find query generation without claiming a completed search.
 *
 * IDEA clears the old query's rows as soon as the text changes. DSH keeps
 * the same row-clearing semantics, but its 180 ms host debounce means the
 * new result cannot be known yet: report Loading immediately rather than a
 * false "No matches" state.
 * @param {object|null} current - current Find state.
 * @param {unknown} query - next raw query text.
 * @returns {object|null} next Find state.
 */
export function findToolQueryTransition(current, query) {
  if (current === null || typeof current !== 'object') return current;
  const nextQuery = findToolContentQuery(query);
  return {
    ...current,
    query: nextQuery,
    files: [],
    matches: [],
    truncated: false,
    index: 0,
    loading: hasFindToolContentQuery(nextQuery),
    error: null,
    loadedGeneration: -1,
    searchGeneration: (current.searchGeneration ?? 0) + 1,
  };
}

/**
 * Move Search Everywhere to another provider tab without leaking text state.
 *
 * A text-search error belongs only to All/Text. Leaving those providers
 * must clear it immediately, and Actions/Files cannot inherit a hanging
 * textLoading flag. All and Text both own the text request, so switching
 * between them keeps an in-flight text search alive.
 * @param {object|null} current - current Search Everywhere state.
 * @param {unknown} tab - requested provider tab.
 * @returns {object|null} next state.
 */
export function searchEverywhereTabTransition(current, tab) {
  if (current === null || typeof current !== 'object') return current;
  const nextTab = tab === 'files' || tab === 'text' || tab === 'actions' ? tab : 'all';
  const textCapable = nextTab === 'all' || nextTab === 'text';
  return {
    ...current,
    tab: nextTab,
    index: 0,
    error: null,
    textLoading: textCapable ? current.textLoading === true : false,
  };
}

/**
 * Format the bounded Find result count with correct file singular/plural.
 * @param {Function} t - locale translator.
 * @param {number} matches - visible occurrence count.
 * @param {number} files - visible file group count.
 * @returns {string} localized result summary.
 */
export function findToolResultSummary(t, matches, files) {
  if (matches === 1 && files === 1) return t('editor.findToolSummaryOne');
  if (files === 1) return t('editor.findToolSummaryOneFile', { matches });
  return t('editor.findToolSummary', { matches, files });
}

/**
 * Decide whether one asynchronous Find response may still mutate state.
 *
 * Matching requestId alone is insufficient after a workspace switch: the
 * old response can otherwise record its query into the new workspace's
 * history even though the Find surface has already been closed.
 * @param {number} requestId - request generation captured before I/O.
 * @param {string} requestRoot - workspace root captured before I/O.
 * @param {number} currentRequestId - latest request generation.
 * @param {string} currentRoot - current workspace root.
 * @returns {boolean} whether the response still belongs to the live surface.
 */
export function findToolRequestIsCurrent(requestId, requestRoot, currentRequestId, currentRoot) {
  return requestId === currentRequestId && requestRoot === currentRoot;
}

/**
 * Resolve the next enabled Find scope mode for keyboard navigation.
 *
 * Module is intentionally excluded while the text workspace has no module
 * search model. Arrow keys therefore cycle the visible usable modes instead
 * of trapping focus on a disabled button.
 * @param {string} current - active scope mode.
 * @param {string} key - keyboard event key.
 * @returns {'project'|'directory'|'scope'|null} next mode, or null.
 */
export function findToolScopeModeTarget(current, key) {
  const modes = ['project', 'directory', 'scope'];
  if (key === 'Home') return modes[0];
  if (key === 'End') return modes[modes.length - 1];
  const currentIndex = modes.indexOf(current);
  if (currentIndex < 0) return modes[0];
  if (key === 'ArrowRight') return modes[(currentIndex + 1) % modes.length];
  if (key === 'ArrowLeft') return modes[(currentIndex - 1 + modes.length) % modes.length];
  return null;
}

/**
 * Apply preflighted dirty-buffer replacement plans as one undoable group.
 *
 * Each model retains its own Monaco undo boundary. If a later model fails,
 * earlier successful model edits are restored before the primary error is
 * rethrown, so Replace All cannot leave a partial dirty commit.
 * @param {Array<{path: string, model: object, text: string, count: number}>} plans - dirty plans.
 * @returns {{contents: Map<string, string>, paths: string[], count: number}} committed state.
 */
export function commitFindToolDirtyPlans(plans) {
  const attempted = [];
  const contents = new Map();
  const paths = [];
  let count = 0;
  try {
    for (const plan of Array.isArray(plans) ? plans : []) {
      const model = plan?.model;
      if (model === null || typeof model !== 'object' || typeof model.getValue !== 'function') {
        throw new Error(`dirty buffer is unavailable: ${plan?.path ?? '<unknown>'}`);
      }
      const original = model.getValue();
      if (plan.text === original) continue;
      attempted.push({ path: plan.path, model, original });
      model.pushStackElement?.();
      model.pushEditOperations(
        [],
        [
          {
            range: model.getFullModelRange(),
            text: plan.text,
            forceMoveMarkers: true,
          },
        ],
        () => null,
      );
      contents.set(plan.path, plan.text);
      paths.push(plan.path);
      count += Math.max(0, Number(plan.count) || 0);
    }
  } catch (failure) {
    const primary = (failure instanceof Error ? failure : new Error(String(failure))) as ReplaceFailure;
    const rollbackFailures: Array<{ path: string; message: string }> = [];
    for (const entry of [...attempted].reverse()) {
      if (entry.model.getValue?.() === entry.original) continue;
      try {
        entry.model.pushStackElement?.();
        entry.model.pushEditOperations(
          [],
          [
            {
              range: entry.model.getFullModelRange(),
              text: entry.original,
              forceMoveMarkers: true,
            },
          ],
          () => null,
        );
      } catch (rollbackFailure) {
        rollbackFailures.push({
          path: entry.path,
          message: rollbackFailure instanceof Error ? rollbackFailure.message : String(rollbackFailure),
        });
      }
    }
    if (rollbackFailures.length > 0) {
      primary.message += `; dirty rollback failed for ${rollbackFailures.map((item) => item.path).join(', ')}`;
      primary.rollbackFailures = rollbackFailures;
    }
    throw primary;
  }
  return { contents, paths, count };
}

/**
 * Split workspace replacement hits into clean host targets and dirty model
 * plans using one shared preflight for Search Everywhere and Find.
 *
 * No model is mutated here. The caller first completes any clean host write,
 * then passes the returned dirty plans to `commitFindToolDirtyPlans()`.
 * @param {object[]} matches - bounded text occurrences.
 * @param {object[]} openFiles - current editor files.
 * @param {Map<string, object>} models - live Monaco models by workspace path.
 * @param {string} query - exact search query.
 * @param {string} replacement - exact replacement template.
 * @param {object} options - search and replacement options.
 * @returns {{
 *   dirtyMatches: object[],
 *   cleanMatches: object[],
 *   cleanTargets: Map<string, object>,
 *   dirtyPlans: object[],
 *   errorPath: string|null,
 *   errorMessage: string|null
 * }} replacement plan.
 */
export function planWorkspaceReplacements(matches, openFiles, models, query, replacement, options) {
  const dirtyFiles = new Map(
    (Array.isArray(openFiles) ? openFiles : [])
      .filter((file) => file?.dirty === true && typeof file.path === 'string')
      .map((file) => [file.path, file]),
  );
  const hitList = Array.isArray(matches) ? matches : [];
  const dirtyMatches = hitList.filter((match) => dirtyFiles.has(match.path));
  const cleanMatches = hitList.filter((match) => !dirtyFiles.has(match.path));
  const cleanTargets = new Map();
  for (const match of cleanMatches) {
    if (typeof match?.path === 'string' && match.path !== '' && !cleanTargets.has(match.path)) {
      cleanTargets.set(match.path, { path: match.path, mtime: match.mtime });
    }
  }
  const dirtyPlans = [];
  const dirtyPaths = [...new Set(dirtyMatches.map((match) => match.path))];
  for (const path of dirtyPaths) {
    const model = models instanceof Map ? models.get(path) : undefined;
    if (model === undefined) {
      return {
        dirtyMatches,
        cleanMatches,
        cleanTargets,
        dirtyPlans: [],
        errorPath: path,
        errorMessage: null,
      };
    }
    const rewritten = editorReplaceAll(model.getValue(), query, replacement, { ...options, path });
    if (rewritten.error !== null) {
      return {
        dirtyMatches,
        cleanMatches,
        cleanTargets,
        dirtyPlans: [],
        errorPath: null,
        errorMessage: rewritten.error,
      };
    }
    if (rewritten.count > 0) {
      dirtyPlans.push({ path, model, text: rewritten.text, count: rewritten.count });
    }
  }
  return {
    dirtyMatches,
    cleanMatches,
    cleanTargets,
    dirtyPlans,
    errorPath: null,
    errorMessage: null,
  };
}

export function claimReplaceAttempt(guard, stateBusy = false) {
  if (stateBusy === true || guard === null || typeof guard !== 'object') return false;
  if (guard.current === true) return false;
  guard.current = true;
  return true;
}

/**
 * Release a replace write reserved by {@link claimReplaceAttempt}.
 * @param {{current: boolean}|null} guard - synchronous write guard.
 * @returns {void}
 */
export function releaseReplaceAttempt(guard) {
  if (guard !== null && typeof guard === 'object') guard.current = false;
}

/**
 * 解析替换输入框的 Enter 意图，避免无关修饰键触发写入。
 * Find 使用 Enter 替换一处、Alt+Shift+Enter 全部替换，并保留
 * Cmd/Ctrl+Enter 兼容；Search Everywhere 仍使用 Enter=全部替换。
 * @param {KeyboardEvent|object} event - replacement input key event.
 * @param {'single'|'all'} plainEnter - action for unmodified Enter.
 * @returns {'single'|'all'|null} resolved replace intent.
 */
export function replaceInputAction(event, plainEnter) {
  if (event === null || typeof event !== 'object' || event.key !== 'Enter') return null;
  if (event.isComposing === true) return null;
  const accelerated = event.metaKey === true || event.ctrlKey === true;
  const replaceAllChord = event.altKey === true && event.shiftKey === true && !accelerated;
  if (replaceAllChord || accelerated) return 'all';
  if (event.shiftKey === true || event.altKey === true) return null;
  return plainEnter === 'all' ? 'all' : 'single';
}

/**
 * Settle one failed replacement without attaching a stale error to a newer query.
 *
 * Query and option changes increment searchGeneration immediately. If that
 * generation no longer matches the request, the user has moved to another
 * result set; the failure must not replace that newer context with an error
 * or steal focus back to the old replacement.
 * @param {object|null} current - current Find state.
 * @param {number} requestGeneration - search generation captured before I/O.
 * @param {string} message - replacement failure text.
 * @returns {object|null} settled Find state.
 */
export function replaceFailureState(current, requestGeneration, message) {
  if (current === null) return current;
  const currentGeneration = Number(current.searchGeneration) || 0;
  const currentRequest = Number(requestGeneration) || 0;
  const isCurrent = currentGeneration === currentRequest;
  return {
    ...current,
    replaceBusy: false,
    error: isCurrent ? message : null,
    replaceFocusRequest: isCurrent ? (current.replaceFocusRequest ?? 0) + 1 : (current.replaceFocusRequest ?? 0),
  };
}

/**
 * Count UTF-8 bytes without depending on Node's Buffer in the browser.
 * @param {unknown} value - text retained by a replace snapshot.
 * @returns {number} encoded byte length.
 */
function replaceHistoryTextBytes(value) {
  const text = String(value ?? '');
  if (typeof TextEncoder === 'function') return new TextEncoder().encode(text).byteLength;
  return text.length * 2;
}

/**
 * Append one Find replace operation to a bounded client history stack.
 * The host applies the same 20-operation / 16 MiB limits to clean content;
 * this budget covers dirty buffer payload retained by the browser.
 * History stays contiguous: once the budget is exceeded, that operation
 * and every older operation are discarded instead of keeping an undoable
 * newest item over budget.
 */
export function boundedReplaceHistory(history, operation, limit = 20, maxBytes = 16 * 1024 * 1024) {
  const next = [...(Array.isArray(history) ? history : []), operation].slice(-Math.max(1, limit));
  const byteLimit = Math.max(0, Number(maxBytes) || 0);
  let totalBytes = 0;
  const retained = [];
  for (let index = next.length - 1; index >= 0; index -= 1) {
    const entry = next[index];
    const dirtyBytes = (Array.isArray(entry?.dirty) ? entry.dirty : []).reduce(
      (total, item) =>
        total + replaceHistoryTextBytes(item?.beforeContent) + replaceHistoryTextBytes(item?.afterContent),
      0,
    );
    if (totalBytes + dirtyBytes > byteLimit) break;
    totalBytes += dirtyBytes;
    retained.push(entry);
  }
  return retained.reverse();
}

/**
 * Add one query to the bounded recent-search list.
 * @param {string[]} history - existing newest-first queries.
 * @param {string} query - query that produced a result the user opened.
 * @param {number} [limit=20] - maximum retained entries.
 * @returns {string[]} normalized newest-first history.
 */
export function rememberSearchHistory(history, query, limit = 20) {
  const entries = Array.isArray(history)
    ? history.filter((entry) => typeof entry === 'string' && entry.trim() !== '').map((entry) => entry.trim())
    : [];
  const next = typeof query === 'string' ? query.trim() : '';
  if (next === '') return [...new Set(entries)].slice(0, limit);
  return [next, ...entries.filter((entry) => entry !== next)]
    .filter((entry, index, list) => list.indexOf(entry) === index)
    .slice(0, limit);
}

/**
 * Preserve one exact replacement, including whitespace-only and multiline
 * text. IDEA stores the replacement that was actually executed, so trimming
 * it here would make History replay a different operation.
 * @param {unknown} entry - stored or newly entered replacement.
 * @returns {string} exact replacement, including the empty deletion value.
 */
export function normalizeReplacementHistoryEntry(entry) {
  return typeof entry === 'string' ? entry : '';
}

/**
 * Add one replacement to its bounded history.
 * @param {string[]} history - existing newest-first replacements.
 * @param {string|undefined} replacement - executed replacement text;
 *   undefined when only normalizing stored entries.
 * @param {number} [limit=20] - maximum retained entries.
 * @returns {string[]} exact newest-first history.
 */
function rememberReplacementHistory(history, replacement, limit = 20) {
  const entries = (Array.isArray(history) ? history : []).filter((entry) => typeof entry === 'string');
  if (typeof replacement !== 'string') return [...new Set(entries)].slice(0, limit);
  return [replacement, ...entries.filter((entry) => entry !== replacement)]
    .filter((entry, index, list) => list.indexOf(entry) === index)
    .slice(0, limit);
}

/**
 * Remember one executed Search Everywhere action.
 * @param {string[]} history - existing newest-first action IDs.
 * @param {string} id - executed action ID.
 * @param {number} [limit=12] - maximum retained IDs.
 * @returns {string[]} normalized newest-first action IDs.
 */
export function rememberCommandHistory(history, id, limit = 12) {
  const entries = Array.isArray(history)
    ? history.filter((entry) => typeof entry === 'string' && entry.trim() !== '').map((entry) => entry.trim())
    : [];
  const next = typeof id === 'string' ? id.trim() : '';
  if (next === '') return [...new Set(entries)].slice(0, limit);
  return [next, ...entries.filter((entry) => entry !== next)]
    .filter((entry, index, list) => list.indexOf(entry) === index)
    .slice(0, limit);
}

/** Global command-recency key for Search Everywhere Actions. */
const COMMAND_HISTORY_KEY = 'dsh-editor.search.commandHistory';

/** Read recent executed action IDs. */
export function readCommandHistory() {
  try {
    return rememberCommandHistory(JSON.parse(window.localStorage.getItem(COMMAND_HISTORY_KEY) ?? '[]'), '', 12);
  } catch {
    return [];
  }
}

/** Persist recent executed action IDs. */
export function writeCommandHistory(history) {
  try {
    window.localStorage.setItem(COMMAND_HISTORY_KEY, JSON.stringify(rememberCommandHistory(history, '', 12)));
  } catch {
    /* storage-less browsers keep the in-memory order */
  }
}

/**
 * Explicit IDEA category inventory for the Actions exposed by this plugin.
 * Null means IDEA Search Everywhere renders the action without a category.
 * This is presentation metadata only: tabs and ordinary text matching own
 * action filtering, never the category value.
 */
const SEARCH_EVERYWHERE_ACTION_CATEGORY_KEYS = new Map([
  ['searchEverywhere', 'editor.searchCategoryNavigate'],
  ['goToFile', 'editor.searchCategoryNavigate'],
  ['recentFiles', 'editor.searchCategoryNavigate'],
  ['textSearch', 'editor.searchCategoryNavigate'],
  ['findAction', 'editor.searchCategoryNavigate'],
  ['showSearchHistory', 'editor.searchCategoryNavigate'],
  ['recentFindUsages', 'editor.searchCategoryEditFindUsages'],
  ['find', 'editor.searchCategoryEditFind'],
  ['findToolWindow', null],
  ['replace', 'editor.searchCategoryEditFind'],
  ['structuralSearch', 'editor.searchCategoryEditFind'],
  ['structuralReplace', 'editor.searchCategoryEditFind'],
  ['incrementalSearch', null],
  ['searchInSelectionOnly', 'editor.searchCategoryEditFind'],
  ['replaceInSelectionOnly', 'editor.searchCategoryEditFind'],
  ['findSelectionInFiles', 'editor.searchCategoryEditFind'],
  ['replaceSelectionInFiles', 'editor.searchCategoryEditFind'],
  ['findUsages', 'editor.searchCategoryEditFindUsages'],
  ['showUsages', 'editor.searchCategoryEditFindUsages'],
  ['findUsagesSettings', 'editor.searchCategoryEditFindUsages'],
  ['findUsagesInFile', 'editor.searchCategoryEditFindUsages'],
  ['highlightUsagesInFile', 'editor.searchCategoryEditFindUsages'],
  ['searchWeb', null],
  ['findNextWordOccurrence', 'editor.searchCategoryEditFind'],
  ['findPreviousWordOccurrence', 'editor.searchCategoryEditFind'],
  ['selectAllOccurrences', 'editor.searchCategoryEditFind'],
  ['selectNextOccurrence', 'editor.searchCategoryEditFind'],
  ['unselectPreviousOccurrence', 'editor.searchCategoryEditFind'],
  ['findNext', 'editor.searchCategoryEditFind'],
  ['findPrevious', 'editor.searchCategoryEditFind'],
  ['searchInChanges', 'editor.searchCategoryEditFind'],
  ['findInFiles', 'editor.searchCategoryEditFind'],
  ['replaceInFiles', 'editor.searchCategoryEditFind'],
]);

/**
 * Return the truthful IDEA category for one exposed search Action.
 * @param {string} id - Search Everywhere action id.
 * @param {Function} t - locale translator.
 * @returns {string} localized category.
 */
export function searchEverywhereActionCategory(id, t) {
  const key = SEARCH_EVERYWHERE_ACTION_CATEGORY_KEYS.get(id);
  return typeof key === 'string' ? t(key) : null;
}

/**
 * Rank Search Everywhere actions by match quality, then command recency.
 * Empty queries therefore show recently executed commands first, while a
 * typed query still prefers an exact/strong textual match.
 * @param {object[]} actions - registered actions.
 * @param {string} query - action query (slash already removed).
 * @param {string[]} recentCommands - newest-first action IDs.
 * @param {{caseSensitive?: boolean, wholeWords?: boolean}} [options] - shared search filters.
 * @returns {object[]} ranked actions.
 */
export function rankSearchActions(actions, query, recentCommands, options) {
  options = options ?? {};
  const needle = typeof query === 'string' ? query.trim() : '';
  const caseSensitive = options?.caseSensitive === true;
  const wholeWords = options?.wholeWords === true;
  const normalizedNeedle = (caseSensitive ? needle : needle.toLowerCase()).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const recent = Array.isArray(recentCommands) ? recentCommands : [];
  return (Array.isArray(actions) ? actions : [])
    .map((action, index) => {
      const keywords = Array.isArray(action.keywords) ? action.keywords.join(' ') : (action.keywords ?? '');
      const labelScore = fuzzyScore(action.label, needle, { caseSensitive, wholeWords });
      const normalizedLabel =
        typeof action.label === 'string' ? (caseSensitive ? action.label : action.label.toLowerCase()) : '';
      const needleText = caseSensitive ? needle : needle.toLowerCase();
      const labelDirect =
        needle === ''
          ? -1
          : wholeWords === true
            ? wholeWordIndex(normalizedLabel, needleText, true)
            : normalizedLabel.indexOf(needleText);
      const labelRank = labelDirect === 0 ? 3 : labelDirect > 0 ? 2 : labelScore >= 0 ? 1 : 0;
      const descriptionText = `${action.description ?? ''} ${keywords}`.normalize('NFC');
      const descriptionHaystack = caseSensitive ? descriptionText : descriptionText.toLowerCase();
      const normalizedDescription = descriptionHaystack.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      const descriptionWords = normalizedDescription === '' ? [] : normalizedDescription.split(' ');
      const queryWords = normalizedNeedle === '' ? [] : normalizedNeedle.split(' ');
      const descriptionMatches =
        queryWords.length > 0 &&
        queryWords.every((word) =>
          descriptionWords.some((candidate) => (wholeWords ? candidate === word : candidate.startsWith(word))),
        );
      const firstDescriptionWord = descriptionMatches
        ? Math.max(
            0,
            descriptionWords.findIndex((candidate) => candidate.startsWith(queryWords[0])),
          )
        : -1;
      return {
        action,
        index,
        /* The command label is the primary identity. A description may
               mention both directions ("next or previous"), so relying on the
               combined fuzzy string can rank unrelated actions by scattered
               letters. Labels stay fuzzy-capable; description and keywords
               require a normalized contiguous match, like IDEA's filtered
               Search Everywhere Actions list. */
        score:
          needle === ''
            ? 0
            : labelRank > 0
              ? labelRank * 2000 + labelScore
              : descriptionMatches
                ? 500 - Math.min(firstDescriptionWord, 100)
                : -1,
        recentIndex: recent.indexOf(action.id),
      };
    })
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      if (left.recentIndex >= 0 || right.recentIndex >= 0) {
        if (left.recentIndex < 0) return 1;
        if (right.recentIndex < 0) return -1;
        if (left.recentIndex !== right.recentIndex) return left.recentIndex - right.recentIndex;
      }
      return left.index - right.index;
    })
    .map((entry) => entry.action);
}

/**
 * Move by one result while skipping disabled actions.
 *
 * IDEA keeps disabled actions visible, but keyboard traversal must not land
 * on a row where Enter is guaranteed to do nothing. Wrapping is retained so
 * the search list remains a closed keyboard loop.
 * @param {object[]} results - visible Search Everywhere rows.
 * @param {number} current - current active index.
 * @param {number} direction - +1 next, -1 previous.
 * @returns {number|null} next enabled index, or null when all rows are disabled.
 */
export function nextEnabledSearchResultIndex(results, current, direction) {
  const rows = Array.isArray(results) ? results : [];
  if (rows.length === 0) return null;
  const step = Number(direction) < 0 ? -1 : 1;
  const start = Math.max(0, Math.min(rows.length - 1, Math.floor(Number(current) || 0)));
  for (let offset = 1; offset <= rows.length; offset += 1) {
    const index = (((start + step * offset) % rows.length) + rows.length) % rows.length;
    if (rows[index]?.disabled !== true) return index;
  }
  return null;
}

/**
 * Search Everywhere rows are grouped by recent history and provider kind.
 * @param {object|null} result - visible row.
 * @returns {'recent'|'action'|'file'|'text'|'other'} stable group key.
 */
function searchEverywhereResultGroupKey(result) {
  if (result?.history === true) return 'recent';
  if (result?.kind === 'action' || result?.kind === 'file' || result?.kind === 'text') return result.kind;
  return 'other';
}

/**
 * Resolve IDEA's Search Everywhere group-navigation chord for this platform.
 *
 * The built-in macOS keymap uses Meta+Up/Down, while the generic keymap uses
 * Control+Up/Down. Page Up/Down is shared. Additional modifiers must not be
 * swallowed because those combinations belong to text navigation or the OS.
 * @param {KeyboardEvent|object} event - Search Everywhere query keydown.
 * @param {boolean} mac - whether IDEA's macOS keymap applies.
 * @returns {1|-1|0} next group, previous group, or no group action.
 */
export function searchEverywhereGroupNavigationDirection(event, mac) {
  if (event?.altKey === true || event?.shiftKey === true) return 0;
  if (event?.key === 'PageDown') return 1;
  if (event?.key === 'PageUp') return -1;
  const platformModifier =
    mac === true
      ? event?.metaKey === true && event?.ctrlKey !== true
      : event?.ctrlKey === true && event?.metaKey !== true;
  if (!platformModifier) return 0;
  if (event?.key === 'ArrowDown') return 1;
  if (event?.key === 'ArrowUp') return -1;
  return 0;
}

/**
 * IDEA's NavigateToNextGroup/PrevGroup acts on the provider groups, not on
 * individual disabled rows. Entering either direction targets the first
 * enabled row of the adjacent group and never wraps past the list bounds.
 * @param {object[]} results - visible Search Everywhere rows.
 * @param {number} current - current active index.
 * @param {number} direction - +1 next group, -1 previous group.
 * @returns {number|null} first enabled row in the adjacent group.
 */
export function searchEverywhereGroupTargetIndex(results, current, direction) {
  const rows = Array.isArray(results) ? results : [];
  if (rows.length === 0) return null;
  const active = Math.max(0, Math.min(rows.length - 1, Math.floor(Number(current) || 0)));
  const group = searchEverywhereResultGroupKey(rows[active]);
  if (Number(direction) < 0) {
    let boundary = active;
    while (boundary > 0 && searchEverywhereResultGroupKey(rows[boundary - 1]) === group) boundary -= 1;
    if (boundary === 0) return null;
    let start = boundary - 1;
    while (start > 0 && searchEverywhereResultGroupKey(rows[start - 1]) === searchEverywhereResultGroupKey(rows[start]))
      start -= 1;
    for (let index = start; index < boundary; index += 1) {
      if (rows[index]?.disabled !== true) return index;
    }
    return null;
  }

  let boundary = active;
  while (boundary < rows.length - 1 && searchEverywhereResultGroupKey(rows[boundary + 1]) === group) boundary += 1;
  if (boundary === rows.length - 1) return null;
  const nextGroup = searchEverywhereResultGroupKey(rows[boundary + 1]);
  for (let index = boundary + 1; index < rows.length; index += 1) {
    if (searchEverywhereResultGroupKey(rows[index]) !== nextGroup) break;
    if (rows[index]?.disabled !== true) return index;
  }
  return null;
}

/**
 * Clamp a stale active index and move it off a disabled row when possible.
 * Filtering can remove the previously active result or leave a disabled
 * action at the same numeric position; the visible list must converge before
 * mouse/Enter or the next keyboard step uses it.
 * @param {object[]} results - visible rows after query/filter changes.
 * @param {unknown} index - state index from the previous row set.
 * @returns {number} valid visible index.
 */
export function normalizeSearchResultIndex(results, index) {
  const rows = Array.isArray(results) ? results : [];
  if (rows.length === 0) return 0;
  const clamped = Math.max(0, Math.min(rows.length - 1, Math.floor(Number(index) || 0)));
  if (rows[clamped]?.disabled !== true) return clamped;
  return nextEnabledSearchResultIndex(rows, clamped, 1) ?? clamped;
}

/**
 * Stable option identity for one textual usage result.
 * @param {{path?: string, line?: number, column?: number}} match - text match.
 * @returns {string} listbox option key.
 */
export function usageMatchRowKey(match) {
  return `usage:${match?.path ?? ''}:${match?.line ?? 1}:${match?.column ?? 1}`;
}

/**
 * Filter loaded Show Usages rows without issuing another workspace search.
 * IDEA's transient popup filters its current usage table locally.
 * @param {object[]} matches - loaded text matches.
 * @param {unknown} value - local filter text.
 * @returns {object[]} matching rows.
 */
export function filterUsageMatches(matches, value) {
  const rows = Array.isArray(matches) ? matches : [];
  const query = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (query === '') return rows;
  return rows.filter(
    (match) =>
      String(match?.path ?? '')
        .toLowerCase()
        .includes(query) ||
      String(match?.preview ?? '')
        .toLowerCase()
        .includes(query),
  );
}

/**
 * Clamp a usage selection to the currently filtered rows.
 * @param {object[]} matches - filtered rows.
 * @param {unknown} index - previous selection.
 * @returns {number} valid zero-based index, or zero for an empty list.
 */
export function normalizeUsageMatchIndex(matches, index) {
  const rows = Array.isArray(matches) ? matches : [];
  if (rows.length === 0) return 0;
  return Math.max(0, Math.min(rows.length - 1, Math.floor(Number(index) || 0)));
}

/**
 * Section label for the empty/command Search Everywhere list.
 * @param {object} result - current row.
 * @param {object|undefined} previous - preceding row.
 * @param {string} query - trimmed query.
 * @param {'all'|'files'|'text'|'actions'} tab - active page.
 * @param {boolean} commandMode - whether slash command mode is active.
 * @returns {'recent'|'actions'|null} section to render before this row.
 */
export function searchEverywhereSection(result, previous, query, tab, commandMode) {
  if (!commandMode && !(tab === 'all' && query === '')) return null;
  const current = result?.history === true ? 'recent' : 'actions';
  const prior = previous === undefined || previous === null ? null : previous?.history === true ? 'recent' : 'actions';
  return current === prior ? null : current;
}

/**
 * Human-readable tooltip for one Search Everywhere action.
 * @param {object} result - action row.
 * @returns {string} disabled reason or action metadata.
 */
export function searchEverywhereResultTooltip(result) {
  if (result?.disabled === true) return result.disabledReason ?? '';
  return [result?.label, result?.description, result?.category, result?.shortcut]
    .filter((part) => typeof part === 'string' && part.trim() !== '')
    .join(' — ');
}

/**
 * Describe one Search Everywhere result using only data DSH actually owns.
 * @param {object|null} result - action, file or text result.
 * @param {Function} t - locale translator.
 * @returns {{kind: string, title: string, detail: string, meta: string}|null} item info.
 */
export function searchEverywhereItemInfo(result, t) {
  if (result === null || typeof result !== 'object') return null;
  if (result.kind === 'action') {
    return {
      kind: t('editor.searchItemKindAction'),
      title: typeof result.label === 'string' ? result.label : String(result.title ?? ''),
      detail: typeof result.description === 'string' ? result.description : String(result.subtitle ?? ''),
      meta:
        result.disabled === true
          ? [result.category, result.disabledReason]
              .filter((part) => typeof part === 'string' && part.trim() !== '')
              .join(' · ')
          : [result.category, result.shortcut]
              .filter((part) => typeof part === 'string' && part.trim() !== '')
              .join(' · '),
    };
  }
  if (result.kind === 'file' || result.kind === 'text') {
    const path = typeof result.path === 'string' ? result.path : '';
    const location =
      result.kind === 'text' ? `${path}:${Number(result.line) || 1}:${Number(result.column) || 1}` : path;
    return {
      kind: t(result.kind === 'text' ? 'editor.searchItemKindText' : 'editor.searchItemKindFile'),
      title: basename(path),
      detail: location,
      meta: result.kind === 'text' && typeof result.preview === 'string' ? result.preview : '',
    };
  }
  return null;
}

/**
 * Convert IDEA's visible shortcut glyphs into the ARIA key syntax.
 * @param {unknown} shortcut - shortcut such as `⌘⇧O`.
 * @returns {string|undefined} normalized `aria-keyshortcuts` value.
 */
export function searchEverywhereAriaKeyShortcuts(shortcut) {
  const text = typeof shortcut === 'string' ? shortcut.trim() : '';
  if (text === '') return undefined;
  const modifiers = [];
  const modifierNames = { '⌃': 'Control', '⌥': 'Alt', '⇧': 'Shift', '⌘': 'Meta' };
  for (const character of text) {
    const modifier = modifierNames[character];
    if (modifier !== undefined && !modifiers.includes(modifier)) modifiers.push(modifier);
  }
  const keyGlyphs = {
    '↑': 'ArrowUp',
    '↓': 'ArrowDown',
    '←': 'ArrowLeft',
    '→': 'ArrowRight',
    '⏎': 'Enter',
    '↵': 'Enter',
    '⇥': 'Tab',
    '⎋': 'Escape',
  };
  const key = text.replace(/[⌃⌥⇧⌘]/gu, '').trim();
  if (key === '') return undefined;
  const ariaKey = keyGlyphs[key] ?? (key.length === 1 ? key.toUpperCase() : key);
  if (modifiers.length === 0) return ariaKey;
  return [...modifiers, ariaKey].join('+');
}

/**
 * Place a hover tooltip beside a result without crossing the viewport.
 * @param {number} x - row left edge.
 * @param {number} y - row bottom edge.
 * @param {number} viewportWidth - viewport width.
 * @param {number} viewportHeight - viewport height.
 * @param {number} [width=320] - tooltip width.
 * @param {number} [height=80] - tooltip height.
 * @returns {{left: number, top: number}} fixed position.
 */
export function searchEverywhereTooltipPosition(x, y, viewportWidth, viewportHeight, width = 320, height = 80) {
  const left = Math.max(4, Math.min(Number(x) || 0, viewportWidth - width - 4));
  const preferredTop = (Number(y) || 0) + 4;
  const top = preferredTop + height > viewportHeight ? (Number(y) || 0) - height : preferredTop;
  return { left, top: Math.max(4, top) };
}

/**
 * Copy one Search/Find result value through the browser clipboard.
 * @param {string} text - text to copy.
 * @param {Function} onNotify - status-line notification callback.
 * @param {Function} t - locale lookup.
 * @returns {void}
 */
export function copySearchResultText(text, onNotify, t) {
  let pending;
  try {
    pending = navigator.clipboard?.writeText(text);
  } catch {
    onNotify(t('editor.clipboardWriteFailed'));
    return;
  }
  if (pending === undefined) {
    onNotify(t('editor.clipboardWriteFailed'));
    return;
  }
  void pending
    .then(() => onNotify(t('editor.copiedToClipboard')))
    .catch(() => onNotify(t('editor.clipboardWriteFailed')));
}

/**
 * Build the shared Search Everywhere / Find result context menu.
 * @param {object} options - localized labels and surface callbacks.
 * @returns {Array<object|null>} menu items with separators.
 */
export function searchResultContextItems({
  t,
  result,
  onCloseMenu,
  onOpenEditor,
  onOpenInRightSplit,
  onReplace,
  onRevealResult,
  onNotify,
  onShowInfo,
}: SearchResultContextOptions) {
  if (result?.kind !== 'file' && result?.kind !== 'text') return [];
  const copyLocation = result.kind === 'text' ? `${result.path}:${result.line}:${result.column}` : result.path;
  return [
    {
      id: 'openRight',
      label: t('editor.openInRightSplit'),
      run: () => {
        onCloseMenu();
        onOpenInRightSplit();
      },
    },
    {
      id: 'openEditor',
      label: t('editor.openInEditor'),
      run: () => {
        onCloseMenu();
        onOpenEditor();
      },
    },
    ...(result.kind === 'text' && typeof onReplace === 'function'
      ? [
          {
            id: 'replace',
            label: t('editor.replaceAction'),
            run: () => {
              onCloseMenu();
              onReplace();
            },
          },
        ]
      : []),
    ...(typeof onShowInfo === 'function'
      ? [
          {
            id: 'showInfo',
            label: t('editor.searchShowItemInfo'),
            run: () => {
              onCloseMenu();
              onShowInfo();
            },
          },
        ]
      : []),
    null,
    {
      id: 'copyRelative',
      label: t('editor.copyRelativePath'),
      run: () => {
        onCloseMenu();
        copySearchResultText(result.path, onNotify, t);
      },
    },
    {
      id: 'copyLocation',
      label: t('editor.copyPathWithLineIdea'),
      run: () => {
        onCloseMenu();
        copySearchResultText(copyLocation, onNotify, t);
      },
    },
    null,
    {
      id: 'reveal',
      label: t('editor.revealInProject'),
      run: () => {
        onCloseMenu();
        onRevealResult();
      },
    },
  ];
}

/**
 * Resolve an accessible option id without letting path punctuation collide.
 * @param {string} rowKey - Search Everywhere's stable result identity.
 * @returns {string} DOM id suitable for aria-activedescendant.
 */
export function searchEverywhereOptionId(rowKey) {
  return `dsh-editor-search-option-${encodeURIComponent(String(rowKey ?? ''))}`;
}

/**
 * Return the tab IDEA's arrow/Home/End navigation should select.
 * @param {{id: string}[]} tabs - visible search tabs.
 * @param {string} currentId - currently selected tab id.
 * @param {string} key - keyboard key.
 * @returns {string|null} target tab id, or null when the key is unrelated.
 */
export function searchEverywhereTabTarget(tabs, currentId, key) {
  if (!Array.isArray(tabs) || tabs.length === 0) return null;
  if (key === 'Home') return tabs[0].id;
  if (key === 'End') return tabs[tabs.length - 1].id;
  const current = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === currentId),
  );
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const direction = key === 'ArrowLeft' ? -1 : 1;
    return tabs[(current + direction + tabs.length) % tabs.length].id;
  }
  if (key === 'Enter' || key === ' ') return tabs[current].id;
  return null;
}

/** Per-workspace search history key. */
function searchHistoryStorageKey(root) {
  return `dsh-editor.search.history:${root}`;
}

/** Per-workspace exact Find query history key. */
function findQueryHistoryStorageKey(root) {
  return `dsh-editor.find.query.history:${typeof root === 'string' ? root : ''}`;
}

/** Browser-local search option key shared by Search Everywhere and Find. */
const SEARCH_OPTIONS_STORAGE_KEY = 'dsh-editor.search.options.v1';
/** Browser-local recent File extension masks for Find in Files. */
const FILE_MASK_HISTORY_STORAGE_KEY = 'dsh-editor.find.fileMasks';

/**
 * Normalize the bounded File extension/mask history.
 * @param {unknown[]} history - stored newest-first masks.
 * @param {string} [value=''] - newly accepted mask.
 * @param {number} [limit=10] - maximum retained masks.
 * @returns {string[]} normalized newest-first history.
 */
function rememberFileMaskHistory(history, value = '', limit = 10) {
  const entries = (Array.isArray(history) ? history : [])
    .filter((entry) => typeof entry === 'string' && entry.trim() !== '' && entry.length <= 512)
    .map((entry) => entry.trim());
  const next = typeof value === 'string' ? value.trim() : '';
  if (next === '' || next.length > 512) return [...new Set(entries)].slice(0, limit);
  return [next, ...entries.filter((entry) => entry !== next)]
    .filter((entry, index, list) => list.indexOf(entry) === index)
    .slice(0, limit);
}

/**
 * Suggest File masks from paths the Find surface already knows about.
 *
 * IDEA's mask dropdown offers project file types in addition to recent
 * input. DSH must not start a second workspace walk merely to open this
 * menu, so active/open/recent/changed/result paths are the bounded source.
 * More frequent extensions come first; accepted history is not repeated.
 * @param {unknown[]} paths - known workspace-relative paths.
 * @param {string[]} [history=[]] - accepted masks, newest first.
 * @param {number} [limit=12] - maximum suggestions.
 * @returns {string[]} IDEA-style `*.ext` suggestions.
 */
export function suggestFileMasks(paths, history = [], limit = 12) {
  const counts = new Map();
  for (const value of Array.isArray(paths) ? paths : []) {
    if (typeof value !== 'string' || value === '') continue;
    const path = value.replaceAll('\\', '/');
    const name = path.slice(path.lastIndexOf('/') + 1);
    const dot = name.lastIndexOf('.');
    if (dot <= 0 || dot === name.length - 1) continue;
    const extension = name.slice(dot + 1).toLowerCase();
    if (!/^[a-z0-9][a-z0-9_+-]{0,15}$/u.test(extension)) continue;
    counts.set(extension, (counts.get(extension) ?? 0) + 1);
  }
  const excluded = new Set(
    (Array.isArray(history) ? history : [])
      .filter((entry) => typeof entry === 'string')
      .map((entry) => entry.trim().toLowerCase()),
  );
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([extension]) => `*.${extension}`)
    .filter((mask) => !excluded.has(mask))
    .slice(0, Math.max(0, Math.floor(Number(limit) || 0)));
}

/**
 * Keep a Find popup menu inside its owning dialog.
 *
 * The menu is fixed-positioned but remains in the dialog's overflow clip.
 * Viewport-only clamping can therefore paint a row over the dialog edge
 * while pointer hit-testing falls through to the page behind it.
 * @param {number} preferredLeft - desired viewport left coordinate.
 * @param {number} surfaceLeft - owning dialog's left edge.
 * @param {number} surfaceRight - owning dialog's right edge.
 * @param {number} [width=220] - reserved menu width.
 * @returns {number} clamped dialog-local left coordinate.
 */
export function findToolMenuLeft(preferredLeft, surfaceLeft, surfaceRight, width = 220) {
  const left = Number(preferredLeft);
  const boundaryLeft = Number(surfaceLeft);
  const right = Number(surfaceRight);
  const reserved = Math.max(120, Number(width) || 220);
  if (!Number.isFinite(left)) return 4;
  if (!Number.isFinite(boundaryLeft) || !Number.isFinite(right)) return Math.max(4, left);
  const localLeft = left - boundaryLeft;
  const maxLeft = Math.max(4, right - boundaryLeft - reserved - 4);
  return Math.max(4, Math.min(localLeft, maxLeft));
}

/**
 * Convert a viewport anchor into the transformed dialog's local Y space.
 * Reserve enough room for a usable menu instead of letting it fall below
 * the dialog's clipped hit-testing surface.
 * @param {number} preferredTop - desired viewport top.
 * @param {number} surfaceTop - owning dialog's top edge.
 * @param {number} surfaceBottom - owning dialog's bottom edge.
 * @returns {number} clamped dialog-local top.
 */
export function findToolMenuTop(preferredTop, surfaceTop, surfaceBottom) {
  const top = Number(preferredTop);
  const boundaryTop = Number(surfaceTop);
  const boundaryBottom = Number(surfaceBottom);
  if (!Number.isFinite(top)) return 4;
  if (!Number.isFinite(boundaryTop) || !Number.isFinite(boundaryBottom)) return Math.max(4, top);
  const localTop = top - boundaryTop;
  const maxTop = Math.max(4, boundaryBottom - boundaryTop - 164);
  return Math.max(4, Math.min(localTop, maxTop));
}

/**
 * Bound a Find menu to the remaining dialog height so long histories scroll.
 * @param {number} surfaceTop - owning dialog's top edge.
 * @param {number} surfaceBottom - owning dialog's bottom edge.
 * @param {number} localTop - menu's dialog-local top.
 * @returns {number} maximum rendered height.
 */
export function findToolMenuMaxHeight(surfaceTop, surfaceBottom, localTop) {
  const top = Number(surfaceTop);
  const bottom = Number(surfaceBottom);
  const y = Number(localTop);
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || !Number.isFinite(y)) return 320;
  /* The menu's own padding and border are outside its content-box
         max-height, so reserve that chrome as well as the edge gutter. */
  return Math.max(120, bottom - top - y - 20);
}

/** Read recent File extension masks from browser storage. */
export function readFileMaskHistory() {
  try {
    return rememberFileMaskHistory(
      JSON.parse(window.localStorage.getItem(FILE_MASK_HISTORY_STORAGE_KEY) ?? '[]'),
      '',
      10,
    );
  } catch {
    return [];
  }
}

/** Persist one File extension mask after it is accepted by the user. */
export function writeFileMaskHistory(value) {
  const next = rememberFileMaskHistory(readFileMaskHistory(), value, 10);
  try {
    window.localStorage.setItem(FILE_MASK_HISTORY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage-less browsers keep the current field value */
  }
  return next;
}

/**
 * Keep persisted search options within the values the UI can represent.
 * @param {unknown} value - parsed storage value or option-bearing state.
 * @returns {{caseSensitive: boolean, wholeWords: boolean, regex: boolean, preserveCase: boolean, includeExcluded: boolean, fileMask: string, contextFilter?: string}} normalized options.
 */
export function normalizeSearchOptions(value) {
  const source = value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const regex = source.regex === true;
  const includeExcluded =
    typeof source.includeNonProject === 'boolean' ? source.includeNonProject === true : source.includeExcluded === true;
  const contextFilter = ['comments', 'strings', 'exceptComments', 'exceptStrings', 'exceptBoth'].includes(
    source.contextFilter,
  )
    ? source.contextFilter
    : 'anywhere';
  return {
    caseSensitive: source.caseSensitive === true,
    wholeWords: regex ? false : source.wholeWords === true,
    regex,
    preserveCase: source.preserveCase === true,
    includeExcluded,
    fileMask: typeof source.fileMask === 'string' && source.fileMask.length <= 512 ? source.fileMask : '',
    ...(contextFilter === 'anywhere' ? {} : { contextFilter }),
  };
}

/**
 * Read the last valid search options for this browser.
 * @returns {{caseSensitive: boolean, wholeWords: boolean, regex: boolean, preserveCase: boolean, includeExcluded: boolean, fileMask: string, contextFilter?: string}} stored or default options.
 */
export function readSearchOptions() {
  try {
    return normalizeSearchOptions(JSON.parse(window.localStorage.getItem(SEARCH_OPTIONS_STORAGE_KEY) ?? '{}'));
  } catch {
    return normalizeSearchOptions(null);
  }
}

/**
 * Persist only the search option subset; queries and results stay transient.
 * @param {object} options - Search Everywhere or Find state.
 * @returns {void}
 */
export function writeSearchOptions(options) {
  try {
    window.localStorage.setItem(SEARCH_OPTIONS_STORAGE_KEY, JSON.stringify(normalizeSearchOptions(options)));
  } catch {
    /* storage-less browsers keep the current in-memory options */
  }
}

/**
 * Normalize the last IDEA Find scope into values the UI can restore.
 * Invalid Directory paths fall back to Project rather than the workspace root.
 * @param {unknown} value - parsed storage value or scope request.
 * @returns {{mode: 'project'|'directory'|'scope', preset: string, directory: string}} normalized scope.
 */
function normalizeFindSearchScope(value) {
  const source = value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const requestedMode = source.mode;
  const mode = requestedMode === 'directory' || requestedMode === 'scope' ? requestedMode : 'project';
  const customPreset =
    typeof source.preset === 'string' && /^custom:[a-z0-9][a-z0-9-]{0,63}$/u.test(source.preset) ? source.preset : null;
  const preset =
    source.preset === 'openFiles' ||
    source.preset === 'changedFiles' ||
    source.preset === 'currentFile' ||
    source.preset === 'recentlyViewedFiles' ||
    source.preset === 'gitTrackedFiles' ||
    source.preset === 'gitNonIgnoredFiles'
      ? source.preset
      : (customPreset ?? 'projectFiles');
  if (mode !== 'directory') return { mode, preset, directory: '' };
  const raw = typeof source.directory === 'string' ? source.directory.trim().replaceAll('\\', '/') : '';
  const directory = raw.replace(/^\.\/+/u, '').replace(/\/+$/u, '');
  if (
    directory.length > 512 ||
    directory.startsWith('/') ||
    directory.split('/').some((segment) => segment === '' || segment === '..')
  ) {
    return { mode: 'project', preset, directory: '' };
  }
  return { mode, preset, directory };
}

/**
 * Scope storage is per workspace: a directory from one project must not
 * silently constrain another project's Find tool.
 * @param {string} root - workspace root.
 * @returns {string} browser-local storage key.
 */
function findScopeStorageKey(root) {
  return `dsh-editor.find.scope.v1:${typeof root === 'string' ? root : ''}`;
}

/** Browser-local geometry for the movable Find in Files popup. */
const FIND_POPUP_GEOMETRY_STORAGE_KEY = 'dsh-editor.find.popup.geometry.v1';
const FIND_POPUP_DEFAULT_WIDTH = 510;
const FIND_POPUP_DEFAULT_HEIGHT = 440;
const LEGACY_FIND_POPUP_DEFAULT_WIDTH = 580;
const LEGACY_FIND_POPUP_DEFAULT_HEIGHT = 536;

/**
 * Keep the movable Find popup inside the current viewport.
 * @param {unknown} value - saved or requested geometry.
 * @param {number} viewportWidth - current viewport width.
 * @param {number} viewportHeight - current viewport height.
 * @returns {{x: number, y: number, width: number, height: number}} safe geometry.
 */
export function clampFindPopupGeometry(value, viewportWidth, viewportHeight) {
  const source = value !== null && typeof value === 'object' ? value : {};
  const viewportW = Math.max(1, Number(viewportWidth) || 1);
  const viewportH = Math.max(1, Number(viewportHeight) || 1);
  const margin = viewportW >= 32 && viewportH >= 32 ? 8 : 0;
  const availableWidth = Math.max(1, viewportW - margin * 2);
  const availableHeight = Math.max(1, viewportH - margin * 2);
  const minimumWidth = Math.min(360, availableWidth);
  const minimumHeight = Math.min(260, availableHeight);
  const requestedWidth = Number(source.width);
  const requestedHeight = Number(source.height);
  const width = Math.round(
    Math.max(
      minimumWidth,
      Math.min(availableWidth, Number.isFinite(requestedWidth) ? requestedWidth : FIND_POPUP_DEFAULT_WIDTH),
    ),
  );
  const height = Math.round(
    Math.max(
      minimumHeight,
      Math.min(availableHeight, Number.isFinite(requestedHeight) ? requestedHeight : FIND_POPUP_DEFAULT_HEIGHT),
    ),
  );
  const requestedX = Number(source.x);
  const requestedY = Number(source.y);
  const maximumX = Math.max(margin, viewportW - margin - width);
  const maximumY = Math.max(margin, viewportH - margin - height);
  const x = Math.round(
    Math.max(margin, Math.min(maximumX, Number.isFinite(requestedX) ? requestedX : (viewportW - width) / 2)),
  );
  const y = Math.round(
    Math.max(margin, Math.min(maximumY, Number.isFinite(requestedY) ? requestedY : (viewportH - height) / 2)),
  );
  return { x, y, width, height };
}

/** Move the Find popup by a pointer delta and clamp it to the viewport. */
export function moveFindPopupGeometry(start, deltaX, deltaY, viewportWidth, viewportHeight) {
  const geometry = clampFindPopupGeometry(start, viewportWidth, viewportHeight);
  return clampFindPopupGeometry(
    {
      ...geometry,
      x: geometry.x + (Number(deltaX) || 0),
      y: geometry.y + (Number(deltaY) || 0),
    },
    viewportWidth,
    viewportHeight,
  );
}

/** Resize the Find popup from one edge/corner without crossing minimum size. */
export function resizeFindPopupGeometry(start, deltaX, deltaY, direction, viewportWidth, viewportHeight) {
  const geometry = clampFindPopupGeometry(start, viewportWidth, viewportHeight);
  const viewportW = Math.max(1, Number(viewportWidth) || 1);
  const viewportH = Math.max(1, Number(viewportHeight) || 1);
  const margin = viewportW >= 32 && viewportH >= 32 ? 8 : 0;
  const minimumWidth = Math.min(360, Math.max(1, viewportW - margin * 2));
  const minimumHeight = Math.min(260, Math.max(1, viewportH - margin * 2));
  const horizontal = String(direction ?? '');
  let left = geometry.x;
  let top = geometry.y;
  let right = geometry.x + geometry.width;
  let bottom = geometry.y + geometry.height;
  if (horizontal.includes('w')) left = Math.max(margin, Math.min(right - minimumWidth, left + (Number(deltaX) || 0)));
  if (horizontal.includes('e'))
    right = Math.min(viewportW - margin, Math.max(left + minimumWidth, right + (Number(deltaX) || 0)));
  if (horizontal.includes('n')) top = Math.max(margin, Math.min(bottom - minimumHeight, top + (Number(deltaY) || 0)));
  if (horizontal.includes('s'))
    bottom = Math.min(viewportH - margin, Math.max(top + minimumHeight, bottom + (Number(deltaY) || 0)));
  return clampFindPopupGeometry(
    {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    },
    viewportW,
    viewportH,
  );
}

/** Read the last movable Find popup geometry. */
export function readFindPopupGeometry(viewportWidth = window.innerWidth, viewportHeight = window.innerHeight) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(FIND_POPUP_GEOMETRY_STORAGE_KEY) ?? '{}');
    const legacyDefault =
      saved !== null &&
      typeof saved === 'object' &&
      Number(saved.width) === LEGACY_FIND_POPUP_DEFAULT_WIDTH &&
      Number(saved.height) === LEGACY_FIND_POPUP_DEFAULT_HEIGHT;
    return clampFindPopupGeometry(legacyDefault ? {} : saved, viewportWidth, viewportHeight);
  } catch {
    return clampFindPopupGeometry({}, viewportWidth, viewportHeight);
  }
}

/** Persist the completed movable Find popup geometry. */
export function writeFindPopupGeometry(geometry) {
  try {
    window.localStorage.setItem(
      FIND_POPUP_GEOMETRY_STORAGE_KEY,
      JSON.stringify(clampFindPopupGeometry(geometry, window.innerWidth, window.innerHeight)),
    );
  } catch {
    /* storage-less browsers keep the in-memory geometry */
  }
}

/** Per-workspace Directory scope recursion preference. */
function findDirectoryRecursiveStorageKey(root) {
  return `dsh-editor.find.directoryRecursive:${typeof root === 'string' ? root : ''}`;
}

/**
 * Read IDEA's Directory recursion toggle.
 * @param {string} root - workspace root.
 * @returns {boolean} true unless this workspace explicitly disabled it.
 */
export function readFindDirectoryRecursive(root) {
  try {
    return window.localStorage.getItem(findDirectoryRecursiveStorageKey(root)) !== '0';
  } catch {
    return true;
  }
}

/**
 * Persist IDEA's Directory recursion toggle.
 * @param {string} root - workspace root.
 * @param {unknown} recursive - requested toggle value.
 * @returns {boolean} normalized value.
 */
export function writeFindDirectoryRecursive(root, recursive) {
  const normalized = recursive !== false;
  try {
    window.localStorage.setItem(findDirectoryRecursiveStorageKey(root), normalized ? '1' : '0');
  } catch {
    /* storage-less browsers keep the in-memory toggle */
  }
  return normalized;
}

/**
 * Read the last valid scope for one workspace.
 * @param {string} root - workspace root.
 * @returns {{mode: 'project'|'directory'|'scope', preset: 'projectFiles'|'openFiles'|'changedFiles'|'currentFile', directory: string}} stored scope.
 */
export function readFindScope(root) {
  try {
    return normalizeFindSearchScope(JSON.parse(window.localStorage.getItem(findScopeStorageKey(root)) ?? '{}'));
  } catch {
    return normalizeFindSearchScope(null);
  }
}

/**
 * Persist one normalized Find scope for the current workspace.
 * @param {string} root - workspace root.
 * @param {object} scope - scope request.
 * @returns {object} normalized persisted scope.
 */
export function writeFindScope(root, scope) {
  const normalized = normalizeFindSearchScope(scope);
  try {
    window.localStorage.setItem(findScopeStorageKey(root), JSON.stringify(normalized));
  } catch {
    /* storage-less browsers keep the current in-memory scope */
  }
  return normalized;
}

/**
 * Normalize a local named Scope's glob patterns.
 * Patterns are entered one per line, bounded so malformed localStorage
 * cannot turn every Find request into an unbounded matcher.
 * @param {unknown} value - array or newline/comma separated text.
 * @returns {string[]} unique trimmed patterns.
 */
export function normalizeFindScopePatterns(value) {
  const entries = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\n,]/u) : [];
  return [
    ...new Set(
      entries
        .filter((entry) => typeof entry === 'string')
        .map((entry) => entry.trim().replaceAll('\\', '/'))
        .filter((entry) => entry !== '' && entry.length <= 512),
    ),
  ].slice(0, 40);
}

/**
 * Normalize local custom Scopes read from browser storage.
 * @param {unknown} value - stored scope list.
 * @returns {Array<{id: string, name: string, includePatterns: string[], excludePatterns: string[]}>} bounded scopes.
 */
export function normalizeCustomFindScopes(value) {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set();
  const scopes = [];
  for (let index = 0; index < source.length && scopes.length < 30; index += 1) {
    const entry = source[index];
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const name = typeof entry.name === 'string' ? entry.name.trim().slice(0, 80) : '';
    const requestedId =
      typeof entry.id === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/u.test(entry.id) ? entry.id : `scope-${index + 1}`;
    const id = entry.shared === true ? sharedFindScopeId(name === '' ? `Scope ${index + 1}` : name) : requestedId;
    if (seen.has(id)) continue;
    seen.add(id);
    scopes.push({
      id,
      name: name === '' ? `Scope ${index + 1}` : name,
      includePatterns: normalizeFindScopePatterns(entry.includePatterns ?? entry.include),
      excludePatterns: normalizeFindScopePatterns(entry.excludePatterns ?? entry.exclude),
      shared: entry.shared === true,
    });
  }
  return scopes;
}

/** Per-workspace storage key for custom local Find Scopes. */
function customFindScopesStorageKey(root) {
  return `dsh-editor.find.customScopes.v1:${typeof root === 'string' ? root : ''}`;
}

/** Read bounded local custom Scopes for one workspace. */
export function readCustomFindScopes(root) {
  try {
    return normalizeCustomFindScopes(
      JSON.parse(window.localStorage.getItem(customFindScopesStorageKey(root)) ?? '[]'),
    ).filter((scope) => scope.shared !== true);
  } catch {
    return [];
  }
}

/** Persist bounded local custom Scopes for one workspace. */
export function writeCustomFindScopes(root, value) {
  const normalized = normalizeCustomFindScopes(value);
  try {
    window.localStorage.setItem(
      customFindScopesStorageKey(root),
      JSON.stringify(normalized.filter((scope) => scope.shared !== true)),
    );
  } catch {
    /* storage-less browsers keep the in-memory scope list */
  }
  return normalized;
}

/** Stable id for one shared Scope imported from IDEA XML. */
function sharedFindScopeId(name) {
  let hash = 2166136261;
  for (const character of String(name ?? '')) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `shared-${(hash >>> 0).toString(36)}`;
}

/** Decode the five XML entities IDEA writes in scope attributes. */
function decodeScopeXmlText(value) {
  return String(value ?? '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}

/** Encode one IDEA scope attribute value. */
function encodeScopeXmlText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/** Convert one simple IDEA file-scope term into the editor's glob form. */
function ideaScopeTermToPattern(term) {
  let pattern = String(term ?? '')
    .trim()
    .replace(/^!/u, '');
  if (pattern === '') return '';
  const fileMatch = /^file(?:\[[^\]]+\])?:(.*)$/u.exec(pattern);
  if (fileMatch !== null) pattern = fileMatch[1];
  else if (pattern.includes(':') || pattern.includes('(') || pattern.includes(')')) return null;
  pattern = pattern.replace(/^\.\/+/u, '').replace(/\/+$/u, '');
  pattern = pattern.replace(/\/\/\*$/u, '/**');
  return pattern;
}

/**
 * Parse bounded IDEA scope XML files.
 *
 * Only the common `file:path//*` and `&& !file:...` shape is imported.
 * Unsupported package/language expressions are skipped instead of being
 * silently reinterpreted as different file scopes.
 */
export function parseIdeaScopeXml(text) {
  const source = typeof text === 'string' ? text.slice(0, 256 * 1024) : '';
  const scopes = [];
  for (const tag of source.matchAll(/<scope\b([^>]*)\/?>/giu)) {
    const attributes = tag[1];
    const nameMatch = /\bname\s*=\s*"([^"]*)"/iu.exec(attributes);
    const patternMatch = /\bpattern\s*=\s*"([^"]*)"/iu.exec(attributes);
    if (nameMatch === null || patternMatch === null) continue;
    const name = decodeScopeXmlText(nameMatch[1]).trim().slice(0, 80);
    if (name === '') continue;
    const expression = decodeScopeXmlText(patternMatch[1]);
    if (/[()]/u.test(expression)) continue;
    const positive = [];
    const negative = [];
    let supported = true;
    for (const rawTerm of expression.split(/\s*(?:&&|\|\|)\s*/u)) {
      if (rawTerm === '') continue;
      const pattern = ideaScopeTermToPattern(rawTerm);
      if (pattern === null) {
        supported = false;
        break;
      }
      (rawTerm.startsWith('!') ? negative : positive).push(pattern);
    }
    if (!supported) continue;
    scopes.push({
      id: sharedFindScopeId(name),
      name,
      includePatterns: normalizeFindScopePatterns(positive),
      excludePatterns: normalizeFindScopePatterns(negative),
      shared: true,
    });
  }
  return normalizeCustomFindScopes(scopes).slice(0, 30);
}

/** Serialize shared Scopes to the simple IDEA file-scope XML subset we import. */
export function serializeIdeaScopeXml(value) {
  const scopes = normalizeCustomFindScopes(value).filter((scope) => scope.shared === true);
  const lines = ['<component name="DependencyValidationManager">'];
  for (const scope of scopes) {
    const positives = scope.includePatterns.map((pattern) => `file:${pattern}`);
    const negatives = scope.excludePatterns.map((pattern) => `!file:${pattern}`);
    let expression = [...positives, ...negatives].join('&&');
    if (positives.length === 0 && negatives.length === 0) expression = 'file:*';
    if (positives.length > 1) {
      expression = `${positives.join('||')}${negatives.length > 0 ? `&&${negatives.join('&&')}` : ''}`;
    }
    lines.push(`  <scope name="${encodeScopeXmlText(scope.name)}" pattern="${encodeScopeXmlText(expression)}" />`);
  }
  lines.push('</component>', '');
  return lines.join('\n');
}

/** Normalize one explicit workspace-relative IDEA scope XML transfer path. */
export function normalizeScopeXmlTransferPath(value) {
  const raw = typeof value === 'string' ? value.trim().replaceAll('\\', '/') : '';
  const path = raw.replace(/^\.\/+/u, '').replace(/\/+$/u, '');
  if (
    path === '' ||
    path.length > 512 ||
    path.startsWith('/') ||
    !path.toLowerCase().endsWith('.xml') ||
    path.split('/').some((segment) => segment === '' || segment === '..')
  )
    return '';
  return path;
}

/** Parse one scope XML file and report how many scope tags were unsupported. */
export function inspectIdeaScopeXml(value) {
  const source = typeof value === 'string' ? value.slice(0, 256 * 1024) : '';
  const total = [...source.matchAll(/<scope\b/giu)].length;
  const scopes = parseIdeaScopeXml(source);
  return {
    scopes,
    total,
    skipped: Math.max(0, total - scopes.length),
  };
}

/**
 * Read recent Search Everywhere queries for one workspace.
 * @param {string} root - workspace root.
 * @returns {string[]} recent queries, newest first.
 */
export function readSearchHistory(root) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(searchHistoryStorageKey(root)) ?? '[]');
    return rememberRecentSearchHistory(parsed, '', 20);
  } catch {
    return [];
  }
}

/**
 * Persist recent Search Everywhere queries.
 * @param {string} root - workspace root.
 * @param {string[]} history - recent queries.
 * @returns {void}
 */
export function writeSearchHistory(root, history) {
  try {
    window.localStorage.setItem(
      searchHistoryStorageKey(root),
      JSON.stringify(rememberRecentSearchHistory(history, '', 20)),
    );
  } catch {
    /* a storage-less browser keeps the in-memory list */
  }
}

/**
 * Read exact Find query history for one workspace.
 * @param {string} root - workspace root.
 * @returns {string[]} exact recent queries.
 */
export function readFindQueryHistory(root) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(findQueryHistoryStorageKey(root)) ?? '[]');
    return rememberFindQueryHistory(parsed, undefined, 20);
  } catch {
    return [];
  }
}

/**
 * Persist exact Find query history for one workspace.
 * @param {string} root - workspace root.
 * @param {string[]} history - exact recent queries.
 * @returns {void}
 */
function writeFindQueryHistory(root, history) {
  try {
    window.localStorage.setItem(
      findQueryHistoryStorageKey(root),
      JSON.stringify(rememberFindQueryHistory(history, undefined, 20)),
    );
  } catch {
    /* a storage-less browser keeps the in-memory list */
  }
}

/** Per-workspace Find Usages history key. */
function findUsagesHistoryStorageKey(root) {
  return `dsh-editor.findUsages.history:${root}`;
}

/** Read recent Find Usages queries for one workspace. */
export function readFindUsagesHistory(root) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(findUsagesHistoryStorageKey(root)) ?? '[]');
    return rememberSearchHistory(parsed, '', 20);
  } catch {
    return [];
  }
}

/** Persist recent Find Usages queries for one workspace. */
function writeFindUsagesHistory(root, history) {
  try {
    window.localStorage.setItem(
      findUsagesHistoryStorageKey(root),
      JSON.stringify(rememberSearchHistory(history, '', 20)),
    );
  } catch {
    /* storage-less browsers keep the in-memory list */
  }
}

/** Record one successful Find Usages query. */
export function rememberWorkspaceFindUsagesQuery(root, query) {
  if (typeof root !== 'string' || root === '' || typeof query !== 'string' || query.trim() === '') return null;
  const next = rememberSearchHistory(readFindUsagesHistory(root), query, 20);
  writeFindUsagesHistory(root, next);
  return next;
}

/** Per-workspace replacement history key. */
function replaceHistoryStorageKey(root) {
  return `dsh-editor.replace.history:${root}`;
}

/**
 * Read recently executed replacement strings.
 * @param {string} root - workspace root.
 * @returns {string[]} recent replacements, newest first.
 */
export function readReplaceHistory(root) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(replaceHistoryStorageKey(root)) ?? '[]');
    return rememberReplacementHistory(parsed, undefined, 20);
  } catch {
    return [];
  }
}

/**
 * Persist recently executed replacement strings.
 * @param {string} root - workspace root.
 * @param {string[]} history - recent replacements.
 * @returns {void}
 */
function writeReplaceHistory(root, history) {
  try {
    window.localStorage.setItem(
      replaceHistoryStorageKey(root),
      JSON.stringify(rememberReplacementHistory(history, undefined, 20)),
    );
  } catch {
    /* storage-less browsers keep the in-memory list */
  }
}

/**
 * Record one successful query for a workspace.
 * @param {string} root - workspace root.
 * @param {string} query - search query.
 * @returns {string[]|null} normalized history, or null without workspace/query.
 */
export function rememberWorkspaceSearchQuery(root, query) {
  if (typeof root !== 'string' || root === '' || typeof query !== 'string' || query.trim() === '') return null;
  const normalizedQuery = normalizeRecentSearchEntry(query);
  if (normalizedQuery === '') return null;
  const next = rememberSearchHistory(readSearchHistory(root), normalizedQuery, 20);
  writeSearchHistory(root, next);
  return next;
}

/**
 * Record one exact Find query for a workspace.
 * @param {string} root - workspace root.
 * @param {string} query - exact query text.
 * @returns {string[]|null} exact history, or null without workspace/query.
 */
export function rememberWorkspaceFindQuery(root, query) {
  if (typeof root !== 'string' || root === '' || typeof query !== 'string') return null;
  const next = rememberFindQueryHistory(readFindQueryHistory(root), query, 20);
  writeFindQueryHistory(root, next);
  return next;
}

/**
 * Record one executed replacement for a workspace.
 * @param {string} root - workspace root.
 * @param {string} replacement - replacement text.
 * @returns {string[]|null} exact history, or null without workspace/replacement.
 */
export function rememberWorkspaceReplacement(root, replacement) {
  if (typeof root !== 'string' || root === '' || typeof replacement !== 'string') return null;
  const next = rememberReplacementHistory(readReplaceHistory(root), replacement, 20);
  writeReplaceHistory(root, next);
  return next;
}

/**
 * IDEA's empty Search Everywhere state resets only the provider filter.
 * @returns {{files: boolean, text: boolean, actions: boolean}} all providers enabled.
 */
export function defaultSearchEverywhereFilters() {
  return { files: true, text: true, actions: true };
}

/**
 * @param {object|null} filters - current provider visibility filters.
 * @returns {boolean} whether at least one provider is hidden.
 */
export function searchEverywhereFiltersNeedReset(filters) {
  return filters?.files === false || filters?.text === false || filters?.actions === false;
}

/**
 * IDEA's Files empty state hands a real name query to full-text Find.
 * @param {object} options - active tab, query, result count and loading state.
 * @returns {boolean} whether the Find in Files fallback is actionable.
 */
export function searchEverywhereOffersFindInFiles({ tab, query, resultCount, loading }) {
  return tab === 'files' && typeof query === 'string' && query.trim() !== '' && resultCount === 0 && loading !== true;
}

/**
 * Report the Text options that actually affected the current search.
 * @param {object} options - current text-search options.
 * @returns {string[]} stable IDEA-order option ids.
 */
export function searchEverywhereActiveOptionIds({ caseSensitive, wholeWords, regex, fileMask }) {
  const ids = [];
  if (caseSensitive === true) ids.push('case');
  if (wholeWords === true) ids.push('words');
  if (regex === true) ids.push('regex');
  if (typeof fileMask === 'string' && fileMask.trim() !== '') ids.push('fileMask');
  return ids;
}

/**
 * IDEA's Text empty state can clear the search options that produced it.
 * @param {object} options - tab, query state and active text-search options.
 * @returns {boolean} whether Clear all options is actionable.
 */
export function searchEverywhereOffersClearOptions({
  tab,
  query,
  resultCount,
  loading,
  caseSensitive,
  wholeWords,
  regex,
  fileMask,
}) {
  const normalizedQuery = typeof query === 'string' ? query.trim() : '';
  const activeOptionIds = searchEverywhereActiveOptionIds({
    caseSensitive,
    wholeWords,
    regex,
    fileMask,
  });
  return (
    tab === 'text' && normalizedQuery.length >= 2 && resultCount === 0 && loading !== true && activeOptionIds.length > 0
  );
}

/**
 * IDEA's empty All/Text state can widen a project scope to all places.
 * DSH widens to the workspace's normally excluded directories.
 * @param {object} options - tab, query state and current scope.
 * @returns {boolean} whether the scope-expansion action is actionable.
 */
export function searchEverywhereOffersScopeExpansion({ tab, query, resultCount, loading, includeNonProject }) {
  const normalizedQuery = typeof query === 'string' ? query.trim() : '';
  const minimumQueryLength = tab === 'text' ? 2 : 1;
  return (
    (tab === 'all' || tab === 'text') &&
    normalizedQuery.length >= minimumQueryLength &&
    resultCount === 0 &&
    loading !== true &&
    includeNonProject !== true
  );
}

/**
 * IDEA's Search Everywhere dialog.
 *
 * All/Files/Text/Actions share one query, one active row and one keyboard
 * loop. Classes and Symbols are intentionally absent: this plugin has no
 * language index to answer them truthfully.
 * @param {object} props - dialog state, candidates and callbacks.
 * @returns {object} modal palette.
 */
