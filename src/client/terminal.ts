/* terminal.ts: dsh-editor terminal state, search context and project helper module. Generated into lib/client.js by scripts/build-client.mjs. */
import type * as Monaco from 'monaco-editor';
import { dirname } from './components/editor/editor-path-model';
import { gitStatusInfo } from './components/ui/git-status-model';
import { findToolPathMatchesScope } from './commit';
import { detectTheme } from './editor-core';
import { currentEditorWorkspaceId, currentSessionId } from './components/editor/editor-path-model';
import { TYPEAHEAD_RESET_MS } from './diff';
import { basename, currentTerminalScope, remapPathAfterMove } from './editor-core';
import { fileExtensionFilterMatches, normalizeFileExtensionFilter } from './find-tool';

export interface TerminalDescription {
  id: string;
  state?: string;
  title?: string;
  shell?: string;
  cwd?: string;
  exitCode?: number | null;
  order?: number;
  [key: string]: unknown;
}

export interface TerminalShell {
  path: string;
  name: string;
}

interface EditorSelectionScope {
  start: number;
  end: number;
}

interface FindOptions {
  caseSensitive?: boolean;
  wholeWords?: boolean;
  regex?: boolean;
  preserveCase?: boolean;
  contextFilter?: string;
  [key: string]: unknown;
}

interface TextContextStringRule {
  open: string;
  close: string;
  multiline?: boolean;
  doubledClose?: boolean;
}

interface TextContextRules {
  lineComments?: string[];
  blockComments?: string[][];
  strings?: TextContextStringRule[];
  nestedBlockComments?: boolean;
}

interface EditorSession {
  openPaths: string[];
  activePath: string | null;
  splitPaths: string[];
  splitPath: string | null;
  splitPercent: number | null;
}

interface ProjectTreeRow {
  path: string;
  name?: string;
  kind?: string;
  depth?: number;
  [key: string]: unknown;
}

interface ProjectExpansionPruneRequest {
  expanded?: Set<string> | null;
  rootEntries?: ProjectTreeRow[] | null;
  children?: Record<string, ProjectTreeRow[]> | null;
  authoritative?: boolean;
}

interface ProjectManualOrderPruneRequest {
  order?: Record<string, string[]> | null;
  rootEntries?: ProjectTreeRow[] | null;
  children?: Record<string, ProjectTreeRow[]> | null;
  authoritative?: boolean;
}

interface FlattenProjectFrame {
  list: ProjectTreeRow[];
  depth: number;
  ancestors: boolean[];
  pathTrace: string[];
  parentPath: string;
  index: number;
  ordered: ProjectTreeRow[];
}

interface ProjectSelectionTransition {
  selectedPath: string | null;
  previousPaths?: string[] | null;
  rowPaths?: string[] | null;
  expanded?: Set<string> | null;
}

interface ProjectSelectionSetTransition extends ProjectSelectionTransition {
  selection?: Set<string> | null;
}

/**
 * IDEA-style terminal tool window body: xterm screen over the host PTY.
 *
 * The PTY lives on the host, so collapsing the panel, switching tool windows
 * or re-rendering never ends a shell — the view only re-attaches and replays
 * the retained screen.
 */
/**
 * One terminal living in the EDITOR area, IDEA's "Move to Editor".
 *
 * The PTY and its screen buffer belong to the host, so this is just another
 * view onto the same id: moving a shell does not restart it, and moving it
 * back resumes with the output that ran meanwhile. The dock keeps the tab in
 * its list (its number shortcuts still address it) but stops rendering it.
 * @param {object} props - terminal identity plus the shared screen callbacks.
 * @returns {object} React element tree.
 */

/**
 * Choose the next active tab after closing one visible dock terminal.
 *
 * Prefer a different dock terminal so an unrelated split can stay open.
 * Terminals moved into the editor are not valid dock-tab fallbacks.
 * @param {object[]} remaining - surviving terminal descriptions.
 * @param {string|null} splitId - current right-pane terminal id.
 * @param {string[]} editorIds - terminal ids rendered by the editor.
 * @returns {string|null} next active dock terminal id.
 */
export function terminalActiveAfterClose(
  remaining: TerminalDescription[],
  splitId: string | null,
  editorIds: string[],
): string | null {
  const dock = remaining.filter((terminal) => !editorIds.includes(terminal.id));
  return dock.find((terminal) => terminal.id !== splitId)?.id ?? dock[0]?.id ?? null;
}

/**
 * Reconcile the host terminal list with local editor-area placements.
 *
 * Host list is authoritative for live PTYs. Stale editor ids are pruned,
 * and the dock never keeps an editor terminal as its active tab.
 * @param {object[]} listed - terminals currently retained by the host.
 * @param {string[]} editorIds - locally remembered editor placements.
 * @param {string|null} currentActive - current active dock terminal.
 * @returns {{editorIds: string[], activeId: string|null}} reconciled state.
 */
export function reconcileTerminalDockState(
  listed: TerminalDescription[],
  editorIds: string[],
  currentActive: string | null,
): { editorIds: string[]; activeId: string | null } {
  const live = new Set((Array.isArray(listed) ? listed : []).map((terminal) => terminal.id));
  const retainedEditors = (Array.isArray(editorIds) ? editorIds : []).filter((id) => live.has(id));
  const editorSet = new Set(retainedEditors);
  const dock = (Array.isArray(listed) ? listed : []).filter((terminal) => !editorSet.has(terminal.id));
  const activeId =
    currentActive !== null && dock.some((terminal) => terminal.id === currentActive)
      ? currentActive
      : (dock[0]?.id ?? null);
  return { editorIds: retainedEditors, activeId };
}

/** xterm palette derived from the live app tokens, so light/dark both read correctly. */
export function terminalTheme(node: HTMLElement): {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
} {
  const style = getComputedStyle(node);
  const background =
    style.getPropertyValue('--dsw-alias-bg-base').trim() || (detectTheme() === 'vs-dark' ? '#1f1f1f' : '#ffffff');
  const foreground =
    style.getPropertyValue('--dsw-alias-label-primary').trim() || (detectTheme() === 'vs-dark' ? '#d4d4d4' : '#1f1f1f');
  return {
    background,
    foreground,
    cursor: foreground,
    cursorAccent: background,
    selectionBackground: style.getPropertyValue('--dsw-alias-interactive-bg-hover').trim() || 'rgba(127,127,127,0.35)',
  };
}

/**
 * Capture the active Monaco selection as editor-relative offsets.
 * @param {object|null} editor - active Monaco editor.
 * @returns {{start: number, end: number}|null} non-empty selection scope.
 */
export function editorFindSelectionScope(
  editor: Monaco.editor.ICodeEditor | null | undefined,
): EditorSelectionScope | null {
  const model = editor?.getModel?.() ?? null;
  const selection = editor?.getSelection?.() ?? null;
  if (model === null || selection === null || selection.isEmpty?.() !== false) return null;
  const start = model.getOffsetAt(selection.getStartPosition());
  const end = model.getOffsetAt(selection.getEndPosition());
  return end > start ? { start, end } : null;
}

/**
 * Resolve the editor Find input for the current keyboard gesture.
 *
 * A non-empty selection owns both the search scope and, when short enough,
 * the initial query. No selection explicitly means the whole file.
 * @param {object|null} editor - active Monaco editor.
 * @returns {{scope: {start: number, end: number}|null, query: string|null}} request.
 */
export function editorFindKeyboardRequest(editor: Monaco.editor.ICodeEditor | null | undefined): {
  scope: EditorSelectionScope | null;
  query: string | null;
} {
  const scope = editorFindSelectionScope(editor);
  if (scope === null) return { scope: null, query: null };
  const model = editor?.getModel?.() ?? null;
  const selection = editor?.getSelection?.() ?? null;
  if (model === null || selection === null) return { scope, query: null };
  const selected = String(model.getValueInRange(selection) ?? '');
  return {
    scope,
    query: selected.includes('\n') || selected.length > 200 ? null : selected,
  };
}

/**
 * IDEA Toggle Find in Selection either flips the scope of an open Find bar
 * or opens Find directly in the selected range. It is a no-op only when
 * neither an open Find nor a selection scope exists.
 * @param {object|null} replaceState - current editor Find state.
 * @param {{start: number, end: number}|null} scope - current editor selection.
 * @returns {'toggle'|'open'|null} shortcut action.
 */
export function editorFindSelectionShortcutAction(
  replaceState: unknown,
  scope: EditorSelectionScope | null,
): 'toggle' | 'open' | null {
  if (replaceState !== null && replaceState !== undefined) return 'toggle';
  if (scope !== null && scope !== undefined) return 'open';
  return null;
}

/** IDEA Find in Files 的六种文本上下文过滤模式。 */
const TEXT_SEARCH_CONTEXT_FILTERS = new Set([
  'anywhere',
  'comments',
  'strings',
  'exceptComments',
  'exceptStrings',
  'exceptBoth',
]);

/** 收敛持久化值或 UI 值。 */
export function normalizeTextSearchContextFilter(value: unknown): string {
  return typeof value === 'string' && TEXT_SEARCH_CONTEXT_FILTERS.has(value) ? value : 'anywhere';
}

const C_LIKE_TEXT_CONTEXT_RULES: TextContextRules = {
  lineComments: ['//'],
  blockComments: [['/*', '*/']],
  strings: [
    { open: '`', close: '`', multiline: true },
    { open: '"', close: '"', multiline: false },
    { open: "'", close: "'", multiline: false },
  ],
};
const HASH_TEXT_CONTEXT_RULES: TextContextRules = {
  lineComments: ['#'],
  blockComments: [],
  strings: [
    { open: '"', close: '"', multiline: false },
    { open: "'", close: "'", multiline: false },
  ],
};
const PYTHON_TEXT_CONTEXT_RULES: TextContextRules = {
  lineComments: ['#'],
  blockComments: [],
  strings: [
    { open: '"""', close: '"""', multiline: true },
    { open: "'''", close: "'''", multiline: true },
    { open: '"', close: '"', multiline: false },
    { open: "'", close: "'", multiline: false },
  ],
};
const CSS_TEXT_CONTEXT_RULES: TextContextRules = {
  lineComments: [],
  blockComments: [['/*', '*/']],
  strings: [
    { open: '"', close: '"', multiline: false },
    { open: "'", close: "'", multiline: false },
  ],
};
const HTML_TEXT_CONTEXT_RULES: TextContextRules = {
  lineComments: [],
  blockComments: [['<!--', '-->']],
  strings: [
    { open: '"', close: '"', multiline: false },
    { open: "'", close: "'", multiline: false },
    { open: '`', close: '`', multiline: true },
  ],
};
const SQL_TEXT_CONTEXT_RULES: TextContextRules = {
  lineComments: ['--'],
  blockComments: [['/*', '*/']],
  strings: [
    { open: '"', close: '"', multiline: false },
    { open: "'", close: "'", multiline: true, doubledClose: true },
  ],
};
const PHP_TEXT_CONTEXT_RULES: TextContextRules = {
  lineComments: ['//', '#'],
  blockComments: [['/*', '*/']],
  strings: C_LIKE_TEXT_CONTEXT_RULES.strings,
};
const RUST_TEXT_CONTEXT_RULES: TextContextRules = {
  ...C_LIKE_TEXT_CONTEXT_RULES,
  nestedBlockComments: true,
};
const MARKDOWN_TEXT_CONTEXT_RULES: TextContextRules = {
  lineComments: [],
  blockComments: [['<!--', '-->']],
  strings: [],
};

const TEXT_CONTEXT_RULES_BY_EXTENSION = new Map<string, TextContextRules>();
const registerTextContextRules = (extensions: string[], rules: TextContextRules): void => {
  for (const extension of extensions) TEXT_CONTEXT_RULES_BY_EXTENSION.set(extension, rules);
};
registerTextContextRules(
  [
    'js',
    'jsx',
    'mjs',
    'cjs',
    'ts',
    'tsx',
    'mts',
    'cts',
    'java',
    'kt',
    'kts',
    'scala',
    'cs',
    'c',
    'h',
    'cc',
    'cpp',
    'cxx',
    'hpp',
    'hh',
    'swift',
    'dart',
    'go',
    'proto',
    'groovy',
    'gradle',
  ],
  C_LIKE_TEXT_CONTEXT_RULES,
);
registerTextContextRules(['py', 'pyw'], PYTHON_TEXT_CONTEXT_RULES);
registerTextContextRules(
  ['rb', 'sh', 'bash', 'zsh', 'fish', 'yml', 'yaml', 'toml', 'ini', 'cfg', 'conf', 'properties'],
  HASH_TEXT_CONTEXT_RULES,
);
registerTextContextRules(['css', 'scss', 'sass', 'less', 'styl'], CSS_TEXT_CONTEXT_RULES);
registerTextContextRules(['html', 'htm', 'xhtml', 'xml', 'svg', 'vue', 'svelte', 'astro'], HTML_TEXT_CONTEXT_RULES);
registerTextContextRules(['sql', 'lua'], SQL_TEXT_CONTEXT_RULES);
registerTextContextRules(['php'], PHP_TEXT_CONTEXT_RULES);
registerTextContextRules(['rs'], RUST_TEXT_CONTEXT_RULES);
registerTextContextRules(['md', 'markdown'], MARKDOWN_TEXT_CONTEXT_RULES);

/** 按文件名选择保守词法规则；未知类型不猜测注释或字符串。 */
function textSearchContextRulesForPath(path: string): TextContextRules | null {
  const name = typeof path === 'string' ? path.slice(path.lastIndexOf('/') + 1).toLowerCase() : '';
  if (name === 'dockerfile' || name.startsWith('dockerfile.') || name === 'makefile') {
    return HASH_TEXT_CONTEXT_RULES;
  }
  const dot = name.lastIndexOf('.');
  const extension = dot < 0 ? '' : name.slice(dot + 1);
  return TEXT_CONTEXT_RULES_BY_EXTENSION.get(extension) ?? null;
}

/**
 * 标记每个 UTF-16 位置的词法上下文。
 * 0 = 普通代码，1 = 注释，2 = 字符串；这是有界词法扫描，不冒充 AST。
 */
function textSearchContextMask(text: string, path: string): Uint8Array {
  const source = typeof text === 'string' ? text : '';
  const mask = new Uint8Array(source.length);
  const rules = textSearchContextRulesForPath(path);
  if (rules === null) return mask;
  const lineComments = [...(rules.lineComments ?? [])].sort((left, right) => right.length - left.length);
  const blockComments = [...(rules.blockComments ?? [])].sort((left, right) => right[0].length - left[0].length);
  const strings = [...(rules.strings ?? [])].sort((left, right) => right.open.length - left.open.length);
  let index = 0;
  while (index < source.length) {
    const block = blockComments.find(([open]) => source.startsWith(open, index));
    if (block !== undefined) {
      const [open, close] = block;
      let cursor = index + open.length;
      let depth = 1;
      while (cursor < source.length && depth > 0) {
        if (rules.nestedBlockComments === true && source.startsWith(open, cursor)) {
          depth += 1;
          cursor += open.length;
          continue;
        }
        if (source.startsWith(close, cursor)) {
          depth -= 1;
          cursor += close.length;
          continue;
        }
        cursor += 1;
      }
      mask.fill(1, index, cursor);
      index = cursor;
      continue;
    }
    const lineComment = lineComments.find((marker) => source.startsWith(marker, index));
    if (lineComment !== undefined) {
      const newline = source.indexOf('\n', index);
      const end = newline < 0 ? source.length : newline;
      mask.fill(1, index, end);
      index = end;
      continue;
    }
    const stringRule = strings.find((rule) => source.startsWith(rule.open, index));
    if (stringRule !== undefined) {
      let cursor = index + stringRule.open.length;
      while (cursor < source.length) {
        if (source[cursor] === '\\') {
          cursor = Math.min(source.length, cursor + 2);
          continue;
        }
        if (
          stringRule.doubledClose === true &&
          source.startsWith(stringRule.close, cursor) &&
          source.startsWith(stringRule.close, cursor + stringRule.close.length)
        ) {
          cursor += stringRule.close.length * 2;
          continue;
        }
        if (source.startsWith(stringRule.close, cursor)) {
          cursor += stringRule.close.length;
          break;
        }
        if (stringRule.multiline !== true && source[cursor] === '\n') break;
        cursor += 1;
      }
      mask.fill(2, index, cursor);
      index = Math.max(cursor, index + 1);
      continue;
    }
    index += 1;
  }
  return mask;
}

/** 判断一处命中是否落在当前过滤模式允许的位置。 */
function textSearchContextAllows(mask: Uint8Array, offset: number, length: number, filter: string): boolean {
  const mode = normalizeTextSearchContextFilter(filter);
  if (mode === 'anywhere') return true;
  const start = Math.max(0, Math.min(mask.length, Math.floor(Number(offset) || 0)));
  const width = Math.max(1, Math.floor(Number(length) || 0));
  const end = Math.min(mask.length, start + width);
  let hasComment = false;
  let hasString = false;
  let onlyComment = start < end;
  let onlyString = start < end;
  for (let index = start; index < end; index += 1) {
    const value = mask[index];
    if (value === 1) hasComment = true;
    else onlyComment = false;
    if (value === 2) hasString = true;
    else onlyString = false;
  }
  if (mode === 'comments') return onlyComment;
  if (mode === 'strings') return onlyString;
  if (mode === 'exceptComments') return hasComment === false;
  if (mode === 'exceptStrings') return hasString === false;
  return hasComment === false && hasString === false;
}

/**
 * Compile and enumerate current-editor Find matches with IDEA options.
 * @param {string} text - editor content.
 * @param {string} query - literal or regular expression.
 * @param {{caseSensitive?: boolean, wholeWords?: boolean, regex?: boolean, scope?: {start: number, end: number}|null, path?: string, contextFilter?: string}} [options] - find options and lexical context.
 * @returns {{source: string|null, flags: string, regex: RegExp|null, matches: object[], error: string|null}} compiled result.
 */
export function editorFindResult(
  text: string,
  query: string,
  options?: FindOptions,
): {
  source: string | null;
  flags: string;
  regex: RegExp | null;
  matches: Array<{ offset: number; length: number; text: string }>;
  error: string | null;
} {
  options = options ?? {};
  const sourceText = typeof text === 'string' ? text : '';
  const needle = typeof query === 'string' ? query : '';
  if (needle === '') {
    return { source: null, flags: '', regex: null, matches: [], error: null };
  }
  const regexMode = options.regex === true;
  const caseSensitive = options.caseSensitive === true || needle !== needle.toLowerCase();
  if (regexMode && needle.length > 256) {
    return {
      source: null,
      flags: '',
      regex: null,
      matches: [],
      error: 'regular expression is too long (maximum 256 characters)',
    };
  }
  if (regexMode && /\((?:\\.|[^()])*[+*](?:\\.|[^()])*\)\s*[+*]/u.test(needle)) {
    return {
      source: null,
      flags: '',
      regex: null,
      matches: [],
      error: 'regular expression is too complex: rewrite repeated groups without nested quantifiers',
    };
  }
  let source = regexMode ? needle : needle.replace(/[\\^$.*+?()[\]{}|]/gu, '\\$&');
  if (!regexMode && options.wholeWords === true) {
    const word = /^[\p{L}\p{N}\p{M}_]$/u;
    const characters = Array.from(needle);
    const left = word.test(characters[0] ?? '') ? '(?<![\\p{L}\\p{N}\\p{M}_])' : '';
    const right = word.test(characters[characters.length - 1] ?? '') ? '(?![\\p{L}\\p{N}\\p{M}_])' : '';
    source = `${left}(?:${source})${right}`;
  }
  const flags = `gu${caseSensitive ? '' : 'i'}`;
  let regex;
  try {
    regex = new RegExp(source, flags);
  } catch (error) {
    return {
      source: null,
      flags: '',
      regex: null,
      matches: [],
      error: `invalid regular expression: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  const matches = [];
  const contextFilter = ['comments', 'strings', 'exceptComments', 'exceptStrings', 'exceptBoth'].includes(
    options.contextFilter,
  )
    ? options.contextFilter
    : 'anywhere';
  const contextMask =
    contextFilter === 'anywhere' || typeof options.path !== 'string' || options.path === ''
      ? null
      : textSearchContextMask(sourceText, options.path);
  const scope = options.scope as { start?: unknown; end?: unknown } | null | undefined;
  const scopeStart = Math.max(0, Math.floor(Number(scope?.start)));
  const scopeEnd = Math.max(0, Math.floor(Number(scope?.end)));
  const hasScope = Number.isFinite(scopeStart) && Number.isFinite(scopeEnd) && scopeEnd > scopeStart;
  regex.lastIndex = 0;
  while (true) {
    const match = regex.exec(sourceText);
    if (match === null) break;
    const offset = match.index;
    const length = match[0].length;
    if (
      (!hasScope || (offset >= scopeStart && offset + length <= scopeEnd)) &&
      (contextMask === null || textSearchContextAllows(contextMask, offset, length, contextFilter))
    ) {
      matches.push({ offset, length, text: match[0] });
    }
    if (match[0] === '') {
      const codePoint = sourceText.codePointAt(regex.lastIndex);
      regex.lastIndex += codePoint !== undefined && codePoint > 0xffff ? 2 : 1;
    }
  }
  return { source, flags, regex, matches, error: null };
}

/**
 * Every occurrence offset of one query under current Find options.
 * @param {string} text - haystack.
 * @param {string} query - needle; an empty query has no matches.
 * @param {object} [options] - Find options.
 * @returns {number[]} offsets.
 */
export function findMatches(text: string, query: string, options: FindOptions = {}): number[] {
  return editorFindResult(text, query, options).matches.map((match) => match.offset);
}

/** Count occurrences of one query under current Find options. */
export function countOccurrences(text: string, query: string, options: FindOptions = {}): number {
  return editorFindResult(text, query, options).matches.length;
}

/**
 * Adapt one editor replacement to the casing of the text it replaces.
 * @param {string} matched - source text being replaced.
 * @param {string} replacement - expanded replacement for this match.
 * @returns {string} replacement with the matched casing applied.
 */
function editorApplyPreserveCase(matched: string, replacement: string): string {
  const text = String(matched ?? '');
  const output = String(replacement ?? '');
  if (text === '' || output === '') return output;
  const upper = text === text.toUpperCase() && text !== text.toLowerCase();
  const lower = text === text.toLowerCase() && text !== text.toUpperCase();
  if (upper) return output.toUpperCase();
  if (lower) return output.toLowerCase();
  if (/^[A-Z]/u.test(text)) return output.charAt(0).toUpperCase() + output.slice(1);
  return output;
}

/**
 * Expand native replacement tokens for one editor match.
 * @param {string} matched - exact source text selected by Find.
 * @param {string} replacement - replacement template.
 * @param {string} source - compiled Find regex source.
 * @param {string} flags - compiled Find regex flags.
 * @returns {string} expanded replacement text.
 */
function editorRegexReplacementText(matched: string, replacement: string, source: string, flags: string): string {
  if (matched === '') return replacement;
  const single = new RegExp(source, flags.replace(/[gy]/gu, ''));
  return matched.replace(single, replacement);
}

/**
 * Replace all current-editor matches, including regex capture references.
 * @param {string} text - editor content.
 * @param {string} query - literal or regex.
 * @param {string} replacement - replacement text.
 * @param {object} [options] - Find options.
 * @returns {{text: string, count: number, error: string|null}} rewritten text and count.
 */
export function editorReplaceAll(
  text: string,
  query: string,
  replacement: string,
  options: FindOptions = {},
): { text: string; count: number; error: string | null; delta?: number } {
  options = options ?? {};
  const result = editorFindResult(text, query, options);
  if (result.error !== null) return { text, count: 0, error: result.error };
  if (result.matches.length === 0) return { text, count: 0, error: null };
  if (
    (options.scope !== null && options.scope !== undefined) ||
    ['comments', 'strings', 'exceptComments', 'exceptStrings', 'exceptBoth'].includes(options.contextFilter)
  ) {
    let rewritten = text;
    let delta = 0;
    for (let index = result.matches.length - 1; index >= 0; index -= 1) {
      const match = result.matches[index];
      const one = editorReplaceAt(rewritten, query, replacement, match.offset, options);
      if (one.error !== null) return { text, count: 0, error: one.error };
      rewritten = one.text;
      delta += one.replacementText.length - one.length;
    }
    return { text: rewritten, count: result.matches.length, error: null, delta };
  }
  result.regex.lastIndex = 0;
  const preserveCase = options.preserveCase === true;
  const rewritten = preserveCase
    ? text.replace(result.regex, (matched) =>
        editorApplyPreserveCase(matched, editorRegexReplacementText(matched, replacement, result.source, result.flags)),
      )
    : text.replace(result.regex, replacement);
  return { text: rewritten, count: result.matches.length, error: null, delta: 0 };
}

/**
 * Replace exactly one current-editor match at the requested offset.
 * @param {string} text - editor content.
 * @param {string} query - literal or regex.
 * @param {string} replacement - replacement text.
 * @param {number} offset - required match offset.
 * @param {object} [options] - Find options.
 * @returns {{text: string, count: number, replacementText: string, length: number, error: string|null}} rewrite.
 */
export function editorReplaceAt(
  text: string,
  query: string,
  replacement: string,
  offset: number,
  options: FindOptions = {},
): {
  text: string;
  count: number;
  replacementText: string;
  length: number;
  error: string | null;
} {
  options = options ?? {};
  const result = editorFindResult(text, query, options);
  if (result.error !== null) return { text, count: 0, replacementText: '', length: 0, error: result.error };
  const record = result.matches.find((match) => match.offset === offset);
  if (record === undefined) {
    return { text, count: 0, replacementText: '', length: 0, error: 'find result no longer matches' };
  }
  const flags = `${result.flags.replace('g', '')}y`;
  const sticky = new RegExp(result.source, flags);
  sticky.lastIndex = offset;
  const match = sticky.exec(text);
  if (match === null || match.index !== offset) {
    return { text, count: 0, replacementText: '', length: 0, error: 'find result no longer matches' };
  }
  let replaced;
  let replacementText;
  if (options.preserveCase === true) {
    const expanded = editorRegexReplacementText(match[0], replacement, result.source, result.flags);
    replacementText = editorApplyPreserveCase(match[0], expanded);
    replaced = `${text.slice(0, offset)}${replacementText}${text.slice(offset + match[0].length)}`;
  } else {
    sticky.lastIndex = offset;
    replaced = text.replace(sticky, replacement);
    const suffixLength = text.length - offset - match[0].length;
    replacementText = replaced.slice(offset, replaced.length - suffixLength);
  }
  return {
    text: replaced,
    count: 1,
    replacementText,
    length: match[0].length,
    error: null,
  };
}

/**
 * Convert one one-based line/column to a bounded text offset.
 * @param {string} text - text buffer.
 * @param {number} line - one-based line.
 * @param {number} column - one-based column.
 * @returns {number|null} text offset, or null for malformed coordinates.
 */
export function textOffsetAtLineColumn(text: string, line: number, column: number): number | null {
  const sourceText = typeof text === 'string' ? text : '';
  const wantedLine = Number(line);
  const wantedColumn = Number(column);
  if (!Number.isInteger(wantedLine) || wantedLine < 1 || !Number.isInteger(wantedColumn) || wantedColumn < 1)
    return null;
  let lineStart = 0;
  for (let currentLine = 1; currentLine < wantedLine; currentLine += 1) {
    const newline = sourceText.indexOf('\n', lineStart);
    if (newline < 0) return sourceText.length;
    lineStart = newline + 1;
  }
  const newline = sourceText.indexOf('\n', lineStart);
  const lineEnd = newline < 0 ? sourceText.length : newline;
  return lineStart + Math.min(wantedColumn - 1, lineEnd - lineStart);
}

/**
 * Search one open editor buffer with the same IDEA options as workspace Find.
 *
 * The host search only sees disk. Unsaved documents therefore need a second
 * source in the browser; this helper returns occurrence rows in the same
 * path/line/column shape so both sources share sorting, preview and opening.
 * @param {string} path - workspace-relative path.
 * @param {string} content - live editor content.
 * @param {string} query - literal or regular expression.
 * @param {object} options - case, whole-word and regex controls.
 * @param {number|undefined} mtime - last disk timestamp.
 * @param {number} [limit=200] - maximum occurrence rows.
 * @returns {{matches: object[], truncated: boolean, error: string|null}} buffer results.
 */
function textSearchFileMatches(
  path: string,
  content: string,
  query: string,
  options: FindOptions,
  mtime: number | undefined,
  limit = 200,
): { matches: unknown[]; truncated: boolean; error: string | null } {
  const result = editorFindResult(content, query, { ...options, path });
  if (result.error !== null) return { matches: [], truncated: false, error: result.error };
  const maximum = Math.max(1, Math.min(500, Number(limit) || 200));
  const sourceText = typeof content === 'string' ? content : '';
  const lineStarts = [0];
  for (let index = 0; index < sourceText.length; index += 1) {
    if (sourceText[index] === '\n') lineStarts.push(index + 1);
  }
  const matches = [];
  let lineIndex = 0;
  for (const record of result.matches.slice(0, maximum)) {
    while (lineIndex + 1 < lineStarts.length && lineStarts[lineIndex + 1] <= record.offset) lineIndex += 1;
    const lineStart = lineStarts[lineIndex];
    const lineEnd = lineStarts[lineIndex + 1] === undefined ? sourceText.length : lineStarts[lineIndex + 1] - 1;
    const preview = sourceText.slice(lineStart, lineEnd).replace(/\r$/u, '');
    matches.push({
      path,
      line: lineIndex + 1,
      column: record.offset - lineStart + 1,
      preview: preview.length > 220 ? `${preview.slice(0, 217)}…` : preview,
      mtime,
      dirty: true,
    });
  }
  return {
    matches,
    truncated: result.matches.length > maximum,
    error: null,
  };
}

/**
 * Replace disk matches from dirty documents with their live-buffer matches.
 *
 * Dirty buffers are authoritative. Their path is removed from the host rows
 * even when the unsaved version no longer matches, so stale disk text cannot
 * reappear in Find.
 * @param {object[]} hostMatches - bounded workspace matches read from disk.
 * @param {object[]} dirtyFiles - dirty open files with path/content/mtime.
 * @param {string} query - content query.
 * @param {object} options - Find options including fileMask.
 * @param {{mode?: string, directory?: string, preset?: string, allowedPaths?: string[]|null}} scopeOptions - active scope.
 * @param {number} [limit=200] - shared result cap.
 * @returns {{matches: object[], truncated: boolean}} merged result rows.
 */
export function mergeFindToolDirtyMatches(
  hostMatches: Array<{ path?: string; line?: number; column?: number }>,
  dirtyFiles: Array<{ path?: string; content?: string; mtime?: number }>,
  query: string,
  options: FindOptions & { fileMask?: string; scope?: { start?: unknown; end?: unknown } | null } = {},
  scopeOptions: {
    mode?: string;
    directory?: string;
    preset?: string;
    allowedPaths?: string[] | null;
    recursive?: boolean;
  } = {},
  limit = 200,
): { matches: Array<{ path?: string; line?: number; column?: number }>; truncated: boolean } {
  type FindToolMergedMatch = { path?: string; line?: number; column?: number };
  const maximum = Math.max(1, Math.min(500, Number(limit) || 200));
  const dirtyPaths = new Set<string>();
  const dirtyMatches: FindToolMergedMatch[] = [];
  let truncated = false;
  const fileMask =
    typeof options?.fileMask === 'string' && options.fileMask.trim() !== ''
      ? normalizeFileExtensionFilter(options.fileMask)
      : '';
  const scopeMode =
    scopeOptions?.mode ??
    (Array.isArray(scopeOptions?.allowedPaths)
      ? 'scope'
      : typeof scopeOptions?.directory === 'string'
        ? 'directory'
        : 'project');
  for (const file of Array.isArray(dirtyFiles) ? dirtyFiles : []) {
    if (typeof file?.path !== 'string' || file.path === '') continue;
    dirtyPaths.add(file.path);
    if (!findToolPathMatchesScope(file.path, scopeMode, scopeOptions)) continue;
    if (fileMask !== '' && !fileExtensionFilterMatches(file.path, fileMask)) continue;
    const searched = textSearchFileMatches(
      file.path,
      typeof file.content === 'string' ? file.content : '',
      query,
      options,
      typeof file.mtime === 'number' ? file.mtime : undefined,
      maximum,
    );
    dirtyMatches.push(...searched.matches);
    if (searched.truncated) truncated = true;
  }
  const hostClean: FindToolMergedMatch[] = (Array.isArray(hostMatches) ? hostMatches : []).filter(
    (match) => !dirtyPaths.has(match?.path ?? ''),
  );
  const selectedDirty: FindToolMergedMatch[] = dirtyMatches.slice(0, maximum);
  const selectedHost: FindToolMergedMatch[] = hostClean.slice(0, Math.max(0, maximum - selectedDirty.length));
  if (dirtyMatches.length + hostClean.length > maximum) truncated = true;
  const matches: FindToolMergedMatch[] = [...selectedDirty, ...selectedHost].sort(
    (left, right) =>
      String(left.path ?? '').localeCompare(String(right.path ?? ''), undefined, { sensitivity: 'base' }) ||
      (Number(left.line) || 0) - (Number(right.line) || 0) ||
      (Number(left.column) || 0) - (Number(right.column) || 0),
  );
  return { matches, truncated };
}

/**
 * Drop expansion state that is proven to point at deleted directories.
 *
 * A collapsed/unloaded parent listing is not enough evidence: its expanded
 * descendants must survive so reopening the parent restores the user's folds.
 * If an ancestor is removed, every expanded path below it is removed as well.
 * @param {{expanded: Set<string>|null, rootEntries: object[]|null, children: object|null}} request - current tree cache.
 * @returns {Set<string>} the same set when valid, or a pruned copy.
 */
export function pruneProjectExpandedPaths(request: ProjectExpansionPruneRequest): Set<string> {
  const expanded: Set<string> = request?.expanded instanceof Set ? request.expanded : new Set<string>();
  if (expanded.size === 0 || request?.authoritative === false) return expanded;
  const knownListings = new Map<string, ProjectTreeRow[]>();
  knownListings.set('', Array.isArray(request?.rootEntries) ? request.rootEntries : []);
  for (const [path, entries] of Object.entries(request?.children ?? {})) {
    if (Array.isArray(entries)) knownListings.set(path, entries);
  }
  const removed = new Set<string>();
  const ordered = [...expanded]
    .filter((path) => typeof path === 'string')
    .sort((left, right) => left.split('/').length - right.split('/').length);
  for (const path of ordered) {
    if (path === '') continue;
    const parent = dirname(path);
    if (parent !== '' && removed.has(parent)) {
      removed.add(path);
      continue;
    }
    const listing = knownListings.get(parent);
    if (Array.isArray(listing) && !listing.some((entry) => entry?.path === path)) removed.add(path);
  }
  if (removed.size === 0) return expanded;
  return new Set<string>([...expanded].filter((path) => !removed.has(path)));
}

/**
 * Drop saved Manual Order ranks that are proven to point at deleted paths.
 *
 * The same listing evidence as expansion pruning is used: an unloaded parent
 * preserves its order. Deleting a directory removes its parent key and every
 * descendant rank so recreating the same name cannot restore stale placement.
 * @param {{order: object|null, rootEntries: object[]|null, children: object|null}} request - current order and tree cache.
 * @returns {object} the same order when valid, or a pruned copy.
 */
export function pruneProjectManualOrder(request: ProjectManualOrderPruneRequest): Record<string, string[]> {
  const order: Record<string, string[]> =
    request?.order !== null && typeof request?.order === 'object' && !Array.isArray(request.order) ? request.order : {};
  if (Object.keys(order).length === 0 || request?.authoritative === false) return order;
  const knownListings = new Map<string, ProjectTreeRow[]>();
  knownListings.set('', Array.isArray(request?.rootEntries) ? request.rootEntries : []);
  for (const [path, entries] of Object.entries(request?.children ?? {})) {
    if (Array.isArray(entries)) knownListings.set(path, entries);
  }
  const removedParents = new Set<string>();
  const removedAncestor = (path: string): boolean => {
    let parent = dirname(path);
    while (parent !== '' && parent !== '.') {
      if (removedParents.has(parent)) return true;
      parent = dirname(parent);
    }
    return false;
  };
  const next: Record<string, string[]> = {};
  let changed = false;
  const parents = Object.keys(order).sort((left, right) => left.split('/').length - right.split('/').length);
  for (const parent of parents) {
    if (!Array.isArray(order[parent])) continue;
    if (parent !== '') {
      if (removedAncestor(parent)) {
        removedParents.add(parent);
        changed = true;
        continue;
      }
      const parentListing = knownListings.get(dirname(parent));
      if (Array.isArray(parentListing) && !parentListing.some((entry) => entry?.path === parent)) {
        removedParents.add(parent);
        changed = true;
        continue;
      }
    }
    const listing = knownListings.get(parent);
    const paths: string[] = [];
    for (const path of order[parent]) {
      if (typeof path !== 'string' || path === '' || paths.includes(path)) {
        changed = true;
        continue;
      }
      if (Array.isArray(listing) && !listing.some((entry) => entry?.path === path)) {
        changed = true;
        continue;
      }
      paths.push(path);
    }
    if (paths.length === 0) {
      changed = true;
      continue;
    }
    next[parent] = paths;
    if (paths.length !== order[parent].length) changed = true;
  }
  return changed ? next : order;
}

/**
 * Move Project expansion paths with an internal rename/move.
 *
 * refreshTree reads expandedRef immediately after the filesystem operation,
 * before React effects can sync state. Return the remapped Set so callers can
 * update both state and the ref synchronously.
 * @param {Set<string>|null} expanded - current expansion set.
 * @param {Array<[string, string]>} entries - old/new path pairs.
 * @returns {Set<string>} the same set when no expanded path moved.
 */
export function remapProjectExpandedPaths(expanded: Set<string> | null, entries: Array<[string, string]>): Set<string> {
  const source: Set<string> = expanded instanceof Set ? expanded : new Set<string>();
  const moves: Array<[string, string]> = (Array.isArray(entries) ? entries : []).filter(
    (entry) =>
      Array.isArray(entry) &&
      typeof entry[0] === 'string' &&
      entry[0] !== '' &&
      typeof entry[1] === 'string' &&
      entry[1] !== '',
  );
  if (moves.length === 0) return source;
  let changed = false;
  const next = new Set<string>();
  for (const path of source) {
    const mapped = path === '' ? path : remapPathAfterMove(path, moves);
    if (mapped !== path) changed = true;
    next.add(mapped);
  }
  return changed ? next : source;
}

/**
 * Versioned Project expansion key.
 *
 * Legacy `dsh-editor.expanded:<root>` values were also written by the old
 * automatic three-level expansion path. Ignoring that generation prevents
 * stale auto-expanded descendants from opening the new tree.
 * @param {string} root - absolute workspace root.
 * @returns {string} browser-local storage key.
 */
function expandedStorageKey(root: string): string {
  return `dsh-editor.expanded.v2:${root}`;
}

/**
 * Read the persisted expansion set for one workspace.
 * @param {string} root - absolute workspace root, used as the storage key.
 * @returns {string[]} workspace-relative directory paths.
 */
export function readExpanded(root: string): string[] {
  if (root === '') return [];
  try {
    const raw = window.localStorage.getItem(expandedStorageKey(root));
    const parsed = raw === null ? null : JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string' && value !== '') : [];
  } catch {
    return [];
  }
}

/**
 * Persist the expansion set for one workspace.
 * @param {string} root - absolute workspace root.
 * @param {Set<string>} expanded - workspace-relative directory paths.
 */
export function writeExpanded(root: string, expanded: Set<string>): void {
  if (root === '') return;
  try {
    window.localStorage.setItem(
      expandedStorageKey(root),
      JSON.stringify([...expanded].filter((value) => value !== '')),
    );
  } catch {
    /* a storage-less browser simply forgets the expansion */
  }
}

/**
 * The change-tree groups the user has collapsed in this workspace.
 *
 * IDEA remembers the fold state of its change tree; without it every refresh
 * (and every commit) re-expands the groups the user folded away.
 * @param {string} root - workspace root, used as part of the key.
 * @returns {Set<string>} collapse keys (`<group>:<directory path>`).
 */
export function readCollapsedGroups(root: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(`dsh-editor.collapsedGroups:${root}`);
    if (raw === null || raw === '') return new Set();
    const parsed = JSON.parse(raw);
    /* Storage is user-writable and survives upgrades: keep only strings. */
    return Array.isArray(parsed) ? new Set(parsed.filter((entry) => typeof entry === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

/**
 * Persist the change-tree fold state for one workspace.
 * @param {string} root - workspace root.
 * @param {Set<string>} collapsed - collapse keys currently folded.
 * @returns {void}
 */
export function writeCollapsedGroups(root: string, collapsed: Set<string>): void {
  if (root === '') return;
  try {
    window.localStorage.setItem(`dsh-editor.collapsedGroups:${root}`, JSON.stringify([...collapsed]));
  } catch {
    /* a storage-less browser simply forgets the fold state */
  }
}

/** Read a persisted number with a safe fallback. */
export function readStoredNumber(key: string, fallback: number): number {
  try {
    const raw = window.localStorage.getItem(key);
    const value = raw === null ? NaN : Number(raw);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

/** Persist one numeric preference; a storage-less browser keeps the memory value. */
export function writeStoredNumber(key: string, value: number): void {
  try {
    window.localStorage.setItem(key, String(Math.round(value)));
  } catch {
    /* a storage-less browser simply forgets the size */
  }
}

/** Keep the terminal dock within a readable range. */
export const clampTerminalHeight = (value: unknown): number => {
  const next = Number(value);
  return Number.isFinite(next) ? Math.max(96, Math.min(640, next)) : 220;
};

/** 将 IDEA 持久 Find 工具窗高度限制在可读范围内。 */
export function clampFindDockHeight(value: unknown): number {
  const next = Number(value);
  return Number.isFinite(next) ? Math.max(180, Math.min(720, next)) : 280;
}

/* Gufa's Explorer has a 190px floor and opens around 260px. A percentage-only
       flex basis ignored that lesson: in a 496px Editor host, 25% collapsed the
       Project pane to 180px and clipped the root row. Keep the user's percentage
       preference for wide screens, but never go below this readable floor. */
const TOOL_PANEL_MIN_PX = 200;

/**
 * Build the flex-basis for one IDEA tool window.
 * @param {'project'|'commit'} activity - tool-window identity.
 * @param {number} value - remembered percentage.
 * @returns {string} a CSS flex declaration.
 */
export function toolPanelFlex(activity: 'project' | 'commit', value: number): string {
  const percent = Number.isFinite(value) ? Math.max(14, Math.min(72, value)) : activity === 'project' ? 28 : 25;
  const max = activity === 'project' ? 420 : 480;
  return `0 0 clamp(${TOOL_PANEL_MIN_PX}px, ${percent}%, ${max}px)`;
}

/**
 * Keep the left editor group readable while preserving the right group.
 * @param {number|string} value - requested left-pane percentage.
 * @returns {number} percentage in the IDEA editor-split safe range.
 */
export function clampEditorSplitPercent(value: number | string, width: number | string | null = null): number {
  const next = Number(value);
  if (!Number.isFinite(next)) return 50;
  const rowWidth = Number(width);
  if (!Number.isFinite(rowWidth) || rowWidth <= 0) return Math.max(20, Math.min(80, next));
  /* Account for the 5px flex divider plus its two 0.5px borders. */
  const minPercent = (103 / rowWidth) * 100;
  const lower = Math.max(20, minPercent);
  const upper = Math.min(80, 100 - minPercent);
  return lower <= upper ? Math.max(lower, Math.min(upper, next)) : 50;
}

/**
 * Normalise one workspace's persisted editor tab session.
 *
 * localStorage is user-editable and can survive path moves. Only relative,
 * traversal-free paths are restored; actives must belong to the corresponding
 * tab list and the split is limited to paths that are also open cleanly.
 * @param {object|null} value - parsed session.
 * @returns {{openPaths: string[], activePath: string|null, splitPaths: string[], splitPath: string|null, splitPercent: number|null}} safe session.
 */
function normalizeEditorSession(value: unknown): EditorSession {
  const record =
    value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const safePath = (path: unknown): path is string => {
    if (typeof path !== 'string' || path === '' || path.startsWith('/')) return false;
    const parts = path.split('/');
    return parts.every((part) => part !== '' && part !== '.' && part !== '..');
  };
  const uniquePaths = (raw: unknown, limit: number): string[] => {
    const seen = new Set<string>();
    const paths: string[] = [];
    for (const path of Array.isArray(raw) ? raw : []) {
      if (!safePath(path) || seen.has(path)) continue;
      seen.add(path);
      paths.push(path);
      if (paths.length >= limit) break;
    }
    return paths;
  };
  const openPaths = uniquePaths(record.openPaths, 50);
  const openSet = new Set(openPaths);
  const splitPaths = uniquePaths(record.splitPaths, 50).filter((path) => openSet.has(path));
  const activePath =
    typeof record.activePath === 'string' && openSet.has(record.activePath)
      ? record.activePath
      : (openPaths[0] ?? null);
  const splitSet = new Set(splitPaths);
  const splitPath =
    typeof record.splitPath === 'string' && splitSet.has(record.splitPath) ? record.splitPath : (splitPaths[0] ?? null);
  const percent = Number(record.splitPercent);
  return {
    openPaths,
    activePath,
    splitPaths,
    splitPath,
    splitPercent: Number.isFinite(percent) ? Math.max(20, Math.min(80, percent)) : null,
  };
}

/**
 * Read one workspace's editor tab session.
 * @param {string} root - absolute workspace root.
 * @returns {ReturnType<typeof normalizeEditorSession>} safe session, empty when absent.
 */
export function readEditorSession(root: string): EditorSession {
  if (typeof root !== 'string' || root === '') return normalizeEditorSession(null);
  try {
    const raw = window.localStorage.getItem(`dsh-editor.editor.session:${root}`);
    return normalizeEditorSession(raw === null ? null : JSON.parse(raw));
  } catch {
    return normalizeEditorSession(null);
  }
}

/**
 * Persist one workspace's editor tab session.
 * @param {string} root - absolute workspace root.
 * @param {object} value - open/split state.
 * @returns {void}
 */
export function writeEditorSession(root: string, value: unknown): void {
  if (typeof root !== 'string' || root === '') return;
  try {
    window.localStorage.setItem(`dsh-editor.editor.session:${root}`, JSON.stringify(normalizeEditorSession(value)));
  } catch {
    /* a storage-less browser keeps the in-memory tabs */
  }
}

/**
 * Read one persisted string preference.
 * @param {string} key - storage key.
 * @param {string} fallback - value used when nothing usable is stored.
 * @returns {string} stored value or the fallback.
 */
export function readStoredText(key: string, fallback: string): string {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null || raw === '' ? fallback : raw;
  } catch {
    return fallback;
  }
}

/**
 * One tool window's remembered width for one workspace.
 *
 * The default used to live only in React state, so a wide Commit panel was
 * forgotten on every reload. IDE users tune a panel once and expect that
 * proportion to survive workspace switches; invalid values fall back to the
 * built-in default rather than breaking the layout.
 * @param {string} root - absolute workspace root.
 * @param {'project'|'commit'} activity - tool window identity.
 * @param {number} fallback - default percentage.
 * @returns {number} clamped width percentage.
 */
export function readToolWidth(root: string, activity: 'project' | 'commit', fallback: number): number {
  if (typeof root !== 'string' || root === '') return fallback;
  try {
    const raw = window.localStorage.getItem(`dsh-editor.toolWidth.${activity}:${root}`);
    const value = raw === null ? NaN : Number(raw);
    return Number.isFinite(value) ? Math.max(14, Math.min(72, value)) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Persist one tool window's width for one workspace.
 * @param {string} root - absolute workspace root.
 * @param {'project'|'commit'} activity - tool window identity.
 * @param {number} value - width percentage.
 * @returns {void}
 */
export function writeToolWidth(root: string, activity: 'project' | 'commit', value: number): void {
  if (typeof root !== 'string' || root === '' || !Number.isFinite(value)) return;
  try {
    window.localStorage.setItem(
      `dsh-editor.toolWidth.${activity}:${root}`,
      String(Math.round(Math.max(14, Math.min(72, value)) * 10) / 10),
    );
  } catch {
    /* a storage-less browser keeps the in-memory width */
  }
}

/**
 * The files this workspace opened most recently, newest first.
 *
 * IDEA's ⌘E lists what you have actually been in, not every file in the tree:
 * a Go-to-File query only helps if you remember the path, and the point of
 * Recent Files is that you remember the file. Stored per workspace so two
 * projects do not pollute each other's lists.
 * @param {string} root - absolute workspace root.
 * @returns {string[]} workspace-relative paths, newest first.
 */
export function readRecentFiles(root: string): string[] {
  if (root === '') return [];
  try {
    const raw = window.localStorage.getItem(`dsh-editor.recent:${root}`);
    const parsed = raw === null ? null : JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value) => typeof value === 'string' && value !== '').slice(0, 30)
      : [];
  } catch {
    return [];
  }
}

/**
 * Persist the recent-file list for one workspace.
 * @param {string} root - absolute workspace root.
 * @param {string[]} list - workspace-relative paths, newest first.
 * @returns {void}
 */
export function writeRecentFiles(root: string, list: string[]): void {
  if (root === '') return;
  try {
    window.localStorage.setItem(`dsh-editor.recent:${root}`, JSON.stringify(list.slice(0, 30)));
  } catch {
    /* a storage-less browser simply forgets the list */
  }
}

/**
 * Move one path to the head of a recent list (IDEA's MRU semantics).
 *
 * Re-opening a file that is already in the list must MOVE it, not duplicate
 * it, or the list grows one entry per visit and the most useful (newest)
 * position stops meaning anything.
 * @param {string[]} list - current list, newest first.
 * @param {string} path - path just opened.
 * @param {number} limit - maximum entries retained.
 * @returns {string[]} the new list, or the same array when nothing changed.
 */
export function pushRecent(list: string[], path: string, limit = 30): string[] {
  if (typeof path !== 'string' || path === '') return Array.isArray(list) ? list : [];
  const current = Array.isArray(list) ? list : [];
  if (current[0] === path) return current;
  return [path, ...current.filter((entry) => entry !== path)].slice(0, Math.max(1, limit));
}

/**
 * Which terminals live in the editor area rather than the dock.
 *
 * Only the IDS are remembered: the PTY itself belongs to the host and
 * survives either way, so a reload has to know which tab to render where,
 * not how to rebuild a shell. Stored per Session, like the tab profile.
 * @returns {string[]} terminal ids currently moved into the editor.
 */
export function readEditorTerminals(): string[] {
  try {
    const raw = window.localStorage.getItem(`dsh-editor.terminal.editor:${currentTerminalScope()}`);
    const parsed = raw === null ? null : JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string' && value !== '') : [];
  } catch {
    return [];
  }
}

/**
 * Persist the set of terminals living in the editor area.
 * @param {string[]} ids - terminal ids.
 * @returns {void}
 */
export function writeEditorTerminals(ids: string[]): void {
  try {
    window.localStorage.setItem(
      `dsh-editor.terminal.editor:${currentTerminalScope()}`,
      JSON.stringify(ids.filter((value) => typeof value === 'string' && value !== '')),
    );
  } catch {
    /* a storage-less browser keeps the in-memory placement */
  }
}

/** IDEA terminal font-size actions, clamped to a usable range. */
export function terminalFontSize(current: number, action: string): number {
  const value = Number.isFinite(Number(current)) ? Math.round(Number(current)) : 12;
  if (action === 'increase') return Math.min(24, Math.max(8, value) + 1);
  if (action === 'decrease') return Math.max(8, Math.max(8, value) - 1);
  return 12;
}

/** Persist one explicit terminal font size. */
export function storeFontSize(next: number): number {
  try {
    window.localStorage.setItem('dsh-editor.terminal.fontSize', String(next));
  } catch {
    /* a storage-less browser still gets the in-memory size */
  }
  return next;
}

/** Call the host terminal API. */
interface TerminalOperationRequest {
  op: string;
  [key: string]: unknown;
}

interface TerminalListRequest extends TerminalOperationRequest {
  op: 'list';
}

interface TerminalShellsRequest extends TerminalOperationRequest {
  op: 'shells';
}

interface TerminalCreateRequest extends TerminalOperationRequest {
  op: 'create';
}

interface TerminalWriteRequest extends TerminalOperationRequest {
  op: 'write';
}

interface TerminalResizeRequest extends TerminalOperationRequest {
  op: 'resize';
}

interface TerminalRenameRequest extends TerminalOperationRequest {
  op: 'rename';
}

interface TerminalReorderRequest extends TerminalOperationRequest {
  op: 'reorder';
}

interface TerminalCloseRequest extends TerminalOperationRequest {
  op: 'close';
}

export interface TerminalListResponse {
  available?: boolean;
  terminals: TerminalDescription[];
}

export interface TerminalShellsResponse {
  shells: TerminalShell[];
}

export interface TerminalCreateResponse {
  available?: boolean;
  terminal: TerminalDescription;
}

export interface TerminalWriteResponse {
  written: true;
}

export interface TerminalResizeResponse {
  resized: true;
}

export interface TerminalRenameResponse {
  terminal: TerminalDescription;
}

export interface TerminalReorderResponse {
  terminals: TerminalDescription[];
}

export interface TerminalCloseResponse {
  id: string;
  closed: true;
}

export function callTerminal(payload: TerminalListRequest): Promise<TerminalListResponse>;
export function callTerminal(payload: TerminalShellsRequest): Promise<TerminalShellsResponse>;
export function callTerminal(payload: TerminalCreateRequest): Promise<TerminalCreateResponse>;
export function callTerminal(payload: TerminalWriteRequest): Promise<TerminalWriteResponse>;
export function callTerminal(payload: TerminalResizeRequest): Promise<TerminalResizeResponse>;
export function callTerminal(payload: TerminalRenameRequest): Promise<TerminalRenameResponse>;
export function callTerminal(payload: TerminalReorderRequest): Promise<TerminalReorderResponse>;
export function callTerminal(payload: TerminalCloseRequest): Promise<TerminalCloseResponse>;
export async function callTerminal(payload: TerminalOperationRequest): Promise<unknown> {
  const sessionId = currentSessionId();
  const workspaceId = currentEditorWorkspaceId();
  if (sessionId === '' && workspaceId === '') throw new Error('no active Session or workspace');
  const response = await fetch('api/dsh-editor/terminal', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, workspaceId, ...payload }),
  });
  if (!response.ok) throw new Error(`terminal API HTTP ${response.status}`);
  const data = await response.json();
  if (data?.ok !== true) throw new Error(data?.error?.message ?? 'terminal API failed');
  return data.value;
}

/**
 * Read the in-progress commit message for one workspace.
 *
 * The draft is separate from the history: the history is what was committed,
 * the draft is what the user is still typing. Losing it on a Refresh or a
 * panel toggle is the one thing IDEA's message box never does.
 * @param {string} root - workspace root used as the storage key.
 * @returns {string} stored draft, or '' when none.
 */
export function readCommitDraft(root: string): string {
  if (typeof root !== 'string' || root === '') return '';
  try {
    return window.localStorage.getItem(`dsh-editor.commitDraft:${root}`) ?? '';
  } catch {
    return '';
  }
}

/**
 * Persist (or clear) the draft for one workspace.
 * @param {string} root - workspace root used as the storage key.
 * @param {string} text - current message text.
 * @returns {void}
 */
export function writeCommitDraft(root: string, text: string): void {
  if (typeof root !== 'string' || root === '') return;
  try {
    if (typeof text === 'string' && text !== '') window.localStorage.setItem(`dsh-editor.commitDraft:${root}`, text);
    else window.localStorage.removeItem(`dsh-editor.commitDraft:${root}`);
  } catch {
    /* a storage-less browser keeps the draft in memory only */
  }
}

/**
 * A cheap identity for one directory listing.
 *
 * The tree is refreshed from several places (the toolbar, a file operation,
 * the external-change watcher). Handing React a brand-new array every time
 * makes it re-render every row even when nothing changed, which is visible as
 * a flicker. Comparing this fingerprint first lets the caller keep the array
 * React already has, so an unchanged listing costs no render at all.
 * @param {object[]} entries - directory listing.
 * @returns {string} length-differentiated fingerprint.
 */
function directorySignature(entries: unknown[]): string {
  const list = Array.isArray(entries) ? entries : [];
  return list
    .map((entry) => {
      const record = entry !== null && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
      return `${record.path ?? ''}\u0001${record.kind ?? ''}\u0001${record.mtime ?? ''}\u0001${record.size ?? ''}`;
    })
    .join('\u0002');
}

/**
 * Pick the array to hand to React for one directory listing.
 *
 * Returns the PREVIOUS array when the new listing is identical: same entries,
 * same order. React then sees the same reference and skips the subtree, which
 * is what stops the tree from flashing each time the panel is shown or the
 * watcher re-reads an untouched directory.
 * @param {object[]|undefined} previous - array currently in state, if any.
 * @param {object[]} next - freshly read listing.
 * @returns {object[]} previous when nothing changed, else `next`.
 */
export function keepUnchangedListing<T>(previous: T[] | undefined, next: T[]): T[] {
  if (Array.isArray(previous) && directorySignature(previous) === directorySignature(next)) return previous;
  return next;
}

/**
 * Every file path in a root listing, as a flat set.
 *
 * `refreshTree` only reloads the root, so this intentionally covers exactly
 * what "appeared at the root" means; deeper new files surface when their
 * parent directory is refreshed.
 * @param {object[]} entries - root listing.
 * @returns {string[]} file paths.
 */
export function collectFilePaths(entries: unknown): string[] {
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry?.kind === 'file' && typeof entry.path === 'string')
    .map((entry) => entry.path);
}

/**
 * Read the remembered shell tabs for this Session.
 *
 * Only `shell` + `cwd` are trusted: the stored JSON is user-visible local
 * state, so anything malformed is dropped rather than handed to the host as
 * a `shellPath`.
 * @returns {Array<{shell: string, cwd: string, title: string}>} usable entries.
 */
/** IDEA's terminal tab colours, cycled in order. */
export const TERMINAL_COLORS = ['#cf222e', '#bf8700', '#1a7f37', '#2f65ca', '#8250df', '#1b7c83'];

/**
 * Read the colour assigned to each terminal tab of this Session.
 *
 * Colours are a view preference, so they live in the browser rather than on
 * the host: the host's terminal list stays a pure process description.
 * @returns {Record<string, string>} terminal id → CSS colour.
 */
export function readTerminalColors(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(`dsh-editor.terminal.colors:${currentTerminalScope()}`);
    const parsed = raw === null ? null : JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const colours: Record<string, string> = {};
    for (const [id, colour] of Object.entries(parsed)) {
      if (typeof id === 'string' && typeof colour === 'string' && TERMINAL_COLORS.includes(colour))
        colours[id] = colour;
    }
    return colours;
  } catch {
    return {};
  }
}

/**
 * Persist the tab colour map for this Session.
 * @param {Record<string, string>} colours - terminal id → CSS colour.
 * @returns {void}
 */
export function writeTerminalColors(colours: Record<string, string>): void {
  try {
    window.localStorage.setItem(`dsh-editor.terminal.colors:${currentTerminalScope()}`, JSON.stringify(colours));
  } catch {
    /* a storage-less browser keeps colours for this mount only */
  }
}

/**
 * Read the recently closed terminals for this Session.
 *
 * Same trust rules as the open-tab profile: the JSON is local state, so only
 * well-formed `{shell, cwd}` entries survive.
 * @returns {Array<{shell: string, cwd: string, title: string}>} usable entries, newest first.
 */
export function readClosedTerminals() {
  try {
    const raw = window.localStorage.getItem(`dsh-editor.terminal.closed:${currentTerminalScope()}`);
    if (raw === null || raw === '') return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry) => entry !== null && typeof entry === 'object' && typeof entry.shell === 'string' && entry.shell !== '',
      )
      .map((entry) => ({
        shell: entry.shell,
        cwd: typeof entry.cwd === 'string' ? entry.cwd : '',
        title: typeof entry.title === 'string' ? entry.title : '',
      }))
      .slice(0, 8);
  } catch {
    return [];
  }
}

export function readTerminalProfile() {
  try {
    const raw = window.localStorage.getItem(`dsh-editor.terminal.profile:${currentTerminalScope()}`);
    if (raw === null || raw === '') return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry) => entry !== null && typeof entry === 'object' && typeof entry.shell === 'string' && entry.shell !== '',
      )
      .map((entry) => ({
        shell: entry.shell,
        cwd: typeof entry.cwd === 'string' ? entry.cwd : '',
        title: typeof entry.title === 'string' ? entry.title : '',
      }))
      .slice(0, 4);
  } catch {
    return [];
  }
}

/** Maximum restored tabs, matching the existing reopen ceiling. */
const TERMINAL_RESTORE_TAB_LIMIT = 4;
/** Maximum retained output per restored tab; sessionStorage-only and bounded. */
const TERMINAL_RESTORE_BUFFER_CHARS = 64 * 1024;
/** Current raw output per live terminal id. */
const terminalLiveBuffers = new Map<string, string>();
/** One-shot scrollback seeded for terminals recreated after a host restart. */
const terminalPendingRestoreBuffers = new Map<string, string>();

/** Stable sessionStorage key for this Editor terminal scope. */
function terminalRestoreStorageKey(): string {
  return `dsh-editor.terminal.scrollback:${currentTerminalScope()}`;
}

/** Keep only the newest bounded tail of terminal output. */
function boundTerminalRestoreBuffer(value: unknown): string {
  const text = typeof value === 'string' ? value : '';
  return text.length > TERMINAL_RESTORE_BUFFER_CHARS ? text.slice(text.length - TERMINAL_RESTORE_BUFFER_CHARS) : text;
}

/** Read bounded scrollback snapshots for the current browser tab. */
export function readTerminalRestoreSnapshots(): string[] {
  try {
    const raw = window.sessionStorage.getItem(terminalRestoreStorageKey());
    const parsed = raw === null ? null : JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, TERMINAL_RESTORE_TAB_LIMIT).map((entry) => boundTerminalRestoreBuffer(entry));
  } catch {
    return [];
  }
}

/** Persist bounded scrollback snapshots for the current browser tab. */
export function writeTerminalRestoreSnapshots(snapshots: unknown): void {
  try {
    window.sessionStorage.setItem(
      terminalRestoreStorageKey(),
      JSON.stringify(
        (Array.isArray(snapshots) ? snapshots : [])
          .slice(0, TERMINAL_RESTORE_TAB_LIMIT)
          .map((entry) => boundTerminalRestoreBuffer(entry)),
      ),
    );
  } catch {
    /* a storage-less browser keeps only the live emulator */
  }
}

/** Seed one recreated terminal with its previous scrollback tail. */
export function seedTerminalRestoreBuffer(id: unknown, snapshot: unknown): void {
  if (typeof id !== 'string' || id === '') return;
  const text = boundTerminalRestoreBuffer(snapshot);
  if (text === '') return;
  terminalPendingRestoreBuffers.set(id, text);
  terminalLiveBuffers.set(id, text);
}

/** Consume the one-shot scrollback seed for a terminal stream. */
export function takeTerminalRestoreBuffer(id: string): string {
  const text = terminalPendingRestoreBuffers.get(id) ?? '';
  terminalPendingRestoreBuffers.delete(id);
  return text;
}

/** Replace the live buffer with an authoritative host snapshot. */
export function resetTerminalLiveBuffer(id: string, data: unknown, restored = ''): string {
  const next = boundTerminalRestoreBuffer(`${restored}${typeof data === 'string' ? data : ''}`);
  terminalLiveBuffers.set(id, next);
  return next;
}

/** Append incremental output to the live buffer. */
export function appendTerminalLiveBuffer(id: string, data: unknown): string {
  const next = boundTerminalRestoreBuffer(
    `${terminalLiveBuffers.get(id) ?? ''}${typeof data === 'string' ? data : ''}`,
  );
  terminalLiveBuffers.set(id, next);
  return next;
}

/** Explicitly clear one terminal's visible and session-restorable history. */
export function clearTerminalLiveBuffer(id: string): void {
  terminalPendingRestoreBuffers.delete(id);
  terminalLiveBuffers.set(id, '');
}

/** Drop all retained state for a closed terminal. */
export function forgetTerminalLiveBuffer(id: string): void {
  terminalPendingRestoreBuffers.delete(id);
  terminalLiveBuffers.delete(id);
}

/** Write current terminal order and bounded buffers into sessionStorage. */
export function persistTerminalRestoreSnapshots(list: unknown): void {
  const terminals = Array.isArray(list) ? list : [];
  /* Initial mount has no list yet; keep the previous browser-tab snapshots
         until restoreTerminals has recreated the tabs. */
  if (terminals.length === 0) return;
  const previous = readTerminalRestoreSnapshots();
  const snapshots = terminals
    .slice(0, TERMINAL_RESTORE_TAB_LIMIT)
    .map((terminal, index) =>
      terminalLiveBuffers.has(terminal.id) ? terminalLiveBuffers.get(terminal.id) : (previous[index] ?? ''),
    );
  writeTerminalRestoreSnapshots(snapshots);
}

/**
 * IDEA Compact Directories: merge one continuous chain of single-child directories.
 *
 * The deepest directory remains the row's real path, so every action still
 * targets a path the host can resolve. `kids` is the already-loaded listing
 * of that deepest directory; an unloaded directory cannot be compacted.
 * @param {object} entry - directory row from a parent listing.
 * @param {Record<string, object[]>} children - loaded directory listings by path.
 * @returns {object} row-shaped descriptor with the compacted path and listing.
 */
function compactDirectoryChain(
  entry: ProjectTreeRow,
  children: Record<string, ProjectTreeRow[] | undefined>,
): ProjectTreeRow & { kids?: ProjectTreeRow[]; compacted: boolean } {
  const names: Array<string | undefined> = [entry.name];
  let path = entry.path;
  let kids = children?.[path];
  let compacted = false;
  let guard = 0;
  while (Array.isArray(kids) && kids.length === 1 && kids[0]?.kind === 'directory' && guard < 64) {
    const child = kids[0];
    path = typeof child.path === 'string' && child.path !== '' ? child.path : `${path}/${child.name}`;
    names.push(child.name);
    kids = children?.[path];
    compacted = true;
    guard += 1;
  }
  return { ...entry, path, name: names.join('/'), kids, compacted };
}

/**
 * Apply a saved manual order without hiding newly appeared entries.
 * Known paths keep their saved rank; unknown entries retain the host order
 * after them until the user places them explicitly.
 * @param {object[]} entries - directory listing.
 * @param {string[]} order - saved workspace-relative child paths.
 * @returns {object[]} view-ordered entries.
 */
export function orderProjectEntriesByManual(
  entries: ProjectTreeRow[] | null | undefined,
  order: string[] | null | undefined,
): ProjectTreeRow[] {
  const list = Array.isArray(entries) ? [...entries] : [];
  const saved = Array.isArray(order) ? order.filter((path) => typeof path === 'string' && path !== '') : [];
  const rank = new Map(saved.map((path, index) => [path, index]));
  return list
    .map((entry, index) => ({
      entry,
      index,
      rank: rank.has(entry.path) ? rank.get(entry.path) : Number.MAX_SAFE_INTEGER,
    }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map((item) => item.entry);
}

/**
 * Move a contiguous source block before or after one sibling.
 * @param {string[]} current - current sibling paths.
 * @param {string[]} sources - dragged sibling paths.
 * @param {string} target - drop target path.
 * @param {'before'|'after'} edge - insertion side.
 * @returns {string[]} reordered sibling paths.
 */
export function reorderProjectManualPaths(
  current: string[] | null | undefined,
  sources: string[] | null | undefined,
  target: string,
  edge: 'before' | 'after',
): string[] {
  const list = Array.isArray(current) ? current.filter((path) => typeof path === 'string' && path !== '') : [];
  const moving = new Set(
    (Array.isArray(sources) ? sources : []).filter((path) => list.includes(path) && path !== target),
  );
  if (moving.size === 0 || !list.includes(target)) return list;
  const block = list.filter((path) => moving.has(path));
  const remaining = list.filter((path) => !moving.has(path));
  const targetIndex = remaining.indexOf(target);
  const insertAt = targetIndex < 0 ? remaining.length : targetIndex + (edge === 'after' ? 1 : 0);
  return [...remaining.slice(0, insertAt), ...block, ...remaining.slice(insertAt)];
}

/**
 * Move saved Manual Order ranks with an internal rename or file move.
 *
 * Manual Order stores direct children per parent. A file moved into another
 * directory must leave the old parent's list and join the destination list
 * only when that destination already has a manual order; creating a new list
 * would reorder unrelated entries merely because the user moved one item.
 * Directory moves migrate the parent key and every descendant rank.
 * @param {object} order - saved parent-path to direct-child-path map.
 * @param {Array<[string, string]>} entries - old/new workspace paths.
 * @returns {object} the same map when no saved rank moved.
 */
export function remapProjectManualOrder(
  order: Record<string, string[]> | null | undefined,
  entries: Array<[string, string]> | null | undefined,
): Record<string, string[]> {
  const current: Record<string, string[]> =
    order !== null && order !== undefined && typeof order === 'object' && !Array.isArray(order) ? order : {};
  const moves: Array<[string, string]> = (Array.isArray(entries) ? entries : []).filter(
    (entry) =>
      Array.isArray(entry) &&
      typeof entry[0] === 'string' &&
      entry[0] !== '' &&
      typeof entry[1] === 'string' &&
      entry[1] !== '',
  );
  if (moves.length === 0 || Object.keys(current).length === 0) return current;
  const remap = (path: string): string => remapPathAfterMove(path, moves);
  const next: Record<string, string[]> = {};
  let changed = false;
  for (const [parent, paths] of Object.entries(current)) {
    if (!Array.isArray(paths)) continue;
    const nextParent = parent === '' ? parent : remap(parent);
    const target = Array.isArray(next[nextParent]) ? next[nextParent] : [];
    for (const path of paths) {
      if (typeof path !== 'string' || path === '') continue;
      const mapped = remap(path);
      if (dirname(mapped) !== nextParent || target.includes(mapped)) {
        changed = true;
        continue;
      }
      target.push(mapped);
      if (mapped !== path) changed = true;
    }
    if (target.length === 0) {
      if (paths.length > 0) changed = true;
      continue;
    }
    next[nextParent] = target;
    if (nextParent !== parent || target.length !== paths.length) changed = true;
  }
  for (const [, destination] of moves) {
    const parent = dirname(destination);
    const siblings = next[parent];
    if (!Array.isArray(siblings) || siblings.includes(destination)) continue;
    next[parent] = [...siblings, destination];
    changed = true;
  }
  return changed ? next : current;
}

/**
 * Find the sibling boundary for an Alt+Arrow manual reorder.
 * @param {string[]} current - current sibling order.
 * @param {string[]} sources - selected sibling paths.
 * @param {'up'|'down'} direction - requested movement.
 * @returns {{target: string, edge: 'before'|'after'}|null} insertion target.
 */
export function manualReorderBoundary(
  current: string[] | null | undefined,
  sources: string[] | null | undefined,
  direction: 'up' | 'down',
): { target: string; edge: 'before' | 'after' } | null {
  const list = Array.isArray(current) ? current : [];
  const moving = new Set((Array.isArray(sources) ? sources : []).filter((path) => list.includes(path)));
  if (moving.size === 0) return null;
  const positions = list.map((path, index) => ({ path, index })).filter((entry) => moving.has(entry.path));
  if (positions.length === 0) return null;
  if (direction === 'up') {
    const previous = list[positions[0].index - 1];
    return previous === undefined || moving.has(previous) ? null : { target: previous, edge: 'before' };
  }
  const next = list[positions[positions.length - 1].index + 1];
  return next === undefined || moving.has(next) ? null : { target: next, edge: 'after' };
}

/** Read the per-workspace manual Project order map. */
export function readProjectManualOrder(root: string): Record<string, string[]> {
  if (typeof root !== 'string' || root === '') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(`dsh-editor.project.manualOrder:${root}`) ?? '{}');
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const normalized: Record<string, string[]> = {};
    for (const [parent, paths] of Object.entries(parsed)) {
      if (typeof parent !== 'string' || !Array.isArray(paths)) continue;
      normalized[parent] = [...new Set(paths.filter((path) => typeof path === 'string' && path !== ''))];
    }
    return normalized;
  } catch {
    return {};
  }
}

/** Persist the per-workspace manual Project order map. */
export function writeProjectManualOrder(root: string, order: Record<string, string[]> | null): void {
  if (typeof root !== 'string' || root === '') return;
  try {
    window.localStorage.setItem(`dsh-editor.project.manualOrder:${root}`, JSON.stringify(order ?? {}));
  } catch {
    /* a storage-less browser keeps the in-memory order */
  }
}

/**
 * Flatten the expanded tree into the single row list used by the tree and
 * keyboard navigation.
 *
 * The Project toolbar already names and locates the workspace root, so the
 * tree starts directly with the real top-level entries. Keeping a synthetic
 * root row duplicated that information and consumed a full row of height.
 */
export function flattenRows(
  entries: ProjectTreeRow[] | null | undefined,
  children: Record<string, ProjectTreeRow[] | undefined>,
  expanded: Set<string>,
  projectName: string,
  root: string,
  compactDirectories = false,
  sortMode = 'name',
  manualOrder: Record<string, string[]> | null = null,
): ProjectTreeRow[] {
  const orderMap: Record<string, string[]> = manualOrder ?? {};
  const rows: ProjectTreeRow[] = [];
  const MAX_TREE_DEPTH = 128;
  const MAX_TREE_ROWS = 20000;
  /**
   * 显式 DFS 栈替代函数递归：损坏的 children/expanded 关系即使形成环，
   * 也只能消耗有限栈帧，不会把 React 渲染线程的调用栈打满。
   */
  const stack: FlattenProjectFrame[] = [
    {
      list: Array.isArray(entries) ? entries : [],
      depth: 0,
      ancestors: [],
      pathTrace: [],
      parentPath: '',
      index: 0,
      ordered: [],
    },
  ];
  while (stack.length > 0 && rows.length < MAX_TREE_ROWS) {
    const frame = stack[stack.length - 1];
    if (frame.ordered.length === 0 && frame.list.length > 0) {
      frame.ordered =
        sortMode === 'manual' ? orderProjectEntriesByManual(frame.list, orderMap[frame.parentPath]) : frame.list;
    }
    if (frame.index >= frame.ordered.length) {
      stack.pop();
      continue;
    }
    const index = frame.index;
    const entry = frame.ordered[index];
    frame.index += 1;
    const last = index === frame.ordered.length - 1;
    /* `continues[d]` 表示该深度祖先后面仍有同级项，渲染器据此画竖线。 */
    const continues = continuationFlags([...frame.ancestors, last]);
    const compacted =
      compactDirectories === true && entry.kind === 'directory' ? compactDirectoryChain(entry, children) : null;
    const rowEntry =
      compacted === null
        ? entry
        : {
            ...entry,
            path: compacted.path,
            name: compacted.name,
          };
    /* 同一路径再次出现在自己的祖先链中，说明数据形成了环，跳过重复行。 */
    if (frame.pathTrace.includes(rowEntry.path)) continue;
    rows.push({ ...rowEntry, depth: frame.depth, continues });
    if (rowEntry.kind !== 'directory' || !expanded.has(rowEntry.path)) continue;
    const kids = compacted === null ? children[rowEntry.path] : compacted.kids;
    if (kids === undefined) continue;
    if (kids.length === 0) {
      rows.push({
        name: '',
        path: `${rowEntry.path}::empty`,
        kind: 'placeholder',
        depth: frame.depth + 1,
        empty: true,
        continues: continuationFlags([...frame.ancestors, last, true]),
      });
      continue;
    }
    if (frame.depth >= MAX_TREE_DEPTH) continue;
    stack.push({
      list: kids,
      depth: frame.depth + 1,
      ancestors: [...frame.ancestors, last],
      pathTrace: [...frame.pathTrace, rowEntry.path],
      parentPath: rowEntry.path,
      index: 0,
      ordered: [],
    });
  }
  /* The workspace itself can be empty; show that directly under the toolbar. */
  if (rows.length === 0)
    rows.push({ name: '', path: '::empty', kind: 'placeholder', depth: 0, empty: true, continues: [false] });
  return rows;
}

/**
 * Resolve one visible Project row's tree level and sibling position.
 *
 * Project rows are flattened for rendering, but accessibility still needs
 * the hierarchy. A row's direct parent is the nearest preceding visible row
 * with a smaller depth; rows of the same depth within that parent's block
 * are its siblings.
 * @param {object[]} rows - visible Project rows in render order.
 * @param {number} index - target row index.
 * @returns {{level: number, posinset: number, setsize: number}} position.
 */
export function projectTreePosition(
  rows: ProjectTreeRow[] | null | undefined,
  index: number,
): { level: number; posinset: number; setsize: number } {
  const list: ProjectTreeRow[] = Array.isArray(rows) ? rows : [];
  const row = list[index];
  const depth = Math.max(0, Math.floor(Number(row?.depth) || 0));
  if (row === undefined || row.kind === 'placeholder') {
    return { level: depth + 1, posinset: 1, setsize: 1 };
  }
  let parentIndex = -1;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const candidateDepth = Math.max(0, Math.floor(Number(list[cursor]?.depth) || 0));
    if (candidateDepth < depth) {
      parentIndex = cursor;
      break;
    }
  }
  const siblings: number[] = [];
  for (let cursor = parentIndex + 1; cursor < list.length; cursor += 1) {
    const candidate = list[cursor];
    const candidateDepth = Math.max(0, Math.floor(Number(candidate?.depth) || 0));
    if (candidateDepth < depth) break;
    if (candidateDepth === depth && candidate?.kind !== 'placeholder') siblings.push(cursor);
  }
  const position = siblings.indexOf(index);
  return {
    level: depth + 1,
    posinset: position < 0 ? 1 : position + 1,
    setsize: Math.max(1, siblings.length),
  };
}

/** Normalize the Project views that have a real data source in this plugin. */
export function normalizeProjectView(view: unknown): 'projectFiles' | 'openFiles' | 'changedFiles' {
  return view === 'openFiles' || view === 'changedFiles' || view === 'projectFiles' ? view : 'projectFiles';
}

/** Project Files is the only view backed by the real disk tree. */
export function projectViewIsTree(view: unknown): boolean {
  return normalizeProjectView(view) === 'projectFiles';
}

/**
 * Return the row model for one IDEA Project view.
 *
 * Project Files reuses the lazy filesystem tree. Open Files is a
 * stable projection of the editor's open-tab order. All Changed Files is a
 * deduplicated projection of git status. Removed IDEA views migrate to
 * Project Files instead of fabricating package, facet or scratch data.
 * @param {string} view - one IDEA view id.
 * @param {object[]} projectRows - current Project tree rows.
 * @param {object[]} openFiles - open editor files in tab order.
 * @param {{changes?: object[]}|null} git - current Git snapshot.
 * @returns {object[]} rows for the selected view.
 */
export function projectViewRows(
  view: unknown,
  projectRows: ProjectTreeRow[],
  openFiles: Array<{ path?: unknown }> | null | undefined,
  git: { changes?: Array<{ path?: unknown }> } | null | undefined,
): ProjectTreeRow[] {
  const normalized = normalizeProjectView(view);
  if (projectViewIsTree(normalized)) return projectRows;
  if (normalized !== 'openFiles' && normalized !== 'changedFiles') return projectRows;
  const paths: unknown[] =
    normalized === 'openFiles'
      ? (Array.isArray(openFiles) ? openFiles : []).map((file) => file?.path)
      : (Array.isArray(git?.changes) ? git.changes : [])
          .map((change) => change?.path)
          .sort((left, right) => String(left).localeCompare(String(right)));
  const seen = new Set<string>();
  const rows: ProjectTreeRow[] = [];
  for (const path of paths) {
    if (typeof path !== 'string' || path === '' || seen.has(path)) continue;
    seen.add(path);
    const slash = path.lastIndexOf('/');
    rows.push({ name: slash < 0 ? path : path.slice(slash + 1), path, kind: 'file', depth: 0 });
  }
  return rows;
}

/**
 * Keep a filtered Project view's selection inside the rows it can actually show.
 *
 * Switching from the full tree to Open Files or All Changed Files must not
 * leave hidden paths selected: toolbar and context actions would otherwise
 * operate on rows the user cannot see. Keep an existing visible primary,
 * otherwise fall back to the remaining visible selection or first row.
 * The active editor file is deliberately not a fallback: opening/switching
 * files must not locate the Project tree without an explicit reveal.
 * @param {string[]} rowPaths - workspace-relative paths visible in the view.
 * @param {Set<string>|null} selection - current multi-selection.
 * @param {string|null} selectedPath - current primary row.
 * @returns {{selection: Set<string>, primary: string|null}} sanitized state.
 */
export function filteredViewSelection(
  rowPaths: string[] | null | undefined,
  selection: Set<string> | null | undefined,
  selectedPath: string | null | undefined,
): { selection: Set<string>; primary: string | null } {
  const visible = new Set<string>(
    (Array.isArray(rowPaths) ? rowPaths : []).filter((path) => typeof path === 'string' && path !== ''),
  );
  const source: Set<string> = selection instanceof Set ? selection : new Set<string>();
  const next = new Set<string>();
  let changed = false;
  for (const path of source) {
    if (visible.has(path)) next.add(path);
    else changed = true;
  }
  let primary = typeof selectedPath === 'string' && visible.has(selectedPath) ? selectedPath : null;
  if (primary === null) primary = [...next][0] ?? [...visible][0] ?? null;
  if (primary !== null && !next.has(primary)) {
    next.add(primary);
    changed = true;
  }
  return { selection: changed ? next : source, primary };
}

/**
 * Keep a real Project tree selection valid after its rows change.
 *
 * A selected row can disappear because the user collapsed an ancestor or
 * because another process deleted/renamed it. Only the second case is stale:
 * collapsed rows remain valid. For a real disappearance, prefer the nearest
 * survivor from the previous visual order so the tree stays actionable without
 * following the active editor file.
 * @param {{selectedPath: string|null, previousPaths: string[], rowPaths: string[], expanded: Set<string>|null}} request - row transition.
 * @returns {string|null} the current or replacement selection.
 */
function projectSelectionAfterRowsChange(request: ProjectSelectionTransition): string | null {
  const selectedPath =
    typeof request?.selectedPath === 'string' && request.selectedPath !== '' ? request.selectedPath : null;
  if (selectedPath === null) return request?.selectedPath ?? null;
  const currentPaths = new Set<string>(
    (Array.isArray(request?.rowPaths) ? request.rowPaths : []).filter(
      (path) => typeof path === 'string' && path !== '',
    ),
  );
  if (currentPaths.has(selectedPath)) return selectedPath;
  const previousPaths = (Array.isArray(request?.previousPaths) ? request.previousPaths : []).filter(
    (path) => typeof path === 'string' && path !== '',
  );
  if (previousPaths.length === 0) return selectedPath;
  const expanded: Set<string> = request?.expanded instanceof Set ? request.expanded : new Set<string>();
  let ancestor = dirname(selectedPath);
  while (ancestor !== '') {
    if (!expanded.has(ancestor)) return selectedPath;
    ancestor = dirname(ancestor);
  }
  const previousIndex = previousPaths.indexOf(selectedPath);
  /* A rename/move selects its destination before refreshTree() catches up.
         That path cannot be in the previous rows yet and must not be cleared. */
  if (previousIndex < 0) return selectedPath;
  for (let distance = 1; distance < previousPaths.length; distance += 1) {
    const next = previousPaths[previousIndex + distance];
    if (currentPaths.has(next)) return next;
    const previous = previousPaths[previousIndex - distance];
    if (currentPaths.has(previous)) return previous;
  }
  return null;
}

/**
 * Reconcile the complete Project selection, not only its primary row.
 *
 * Multi-selection may contain several rows removed by one external delete or
 * directory operation. Keep every surviving/hidden selection, drop only rows
 * proven stale, and move the primary to the nearest survivor when needed.
 * @param {{selection?: Set<string>|null, selectedPath: string|null, previousPaths: string[], rowPaths: string[], expanded: Set<string>|null}} request - row transition.
 * @returns {{selection: Set<string>, primary: string|null}} reconciled selection.
 */
export function projectSelectionSetAfterRowsChange(request: ProjectSelectionSetTransition): {
  selection: Set<string>;
  primary: string | null;
} {
  const source: Set<string> =
    request?.selection instanceof Set
      ? request.selection
      : new Set<string>(
          typeof request?.selectedPath === 'string' && request.selectedPath !== '' ? [request.selectedPath] : [],
        );
  const next = new Set<string>();
  let changed = false;
  for (const path of source) {
    const resolved = projectSelectionAfterRowsChange({ ...request, selectedPath: path });
    if (resolved === path) next.add(path);
    else changed = true;
  }
  const primary = projectSelectionAfterRowsChange(request);
  if (primary !== null && !next.has(primary)) {
    next.add(primary);
    changed = true;
  }
  return {
    selection: changed ? next : source,
    primary,
  };
}

/**
 * Project views with a real data source, in a compact menu order.
 *
 * Package, facet and scratch views are omitted entirely because this plugin
 * cannot back them honestly; project is the same disk tree as Project Files.
 * @param {(key: string) => string} t - translator.
 * @returns {Array<{id: string, label: string, available: boolean}>} menu entries.
 */
export function projectViewDefinitions(
  t: (key: string) => string,
): Array<{ id: string; label: string; available: boolean }> {
  return [
    { id: 'projectFiles', label: t('editor.projectViewProjectFiles'), available: true },
    { id: 'openFiles', label: t('editor.projectViewOpenFiles'), available: true },
    { id: 'changedFiles', label: t('editor.projectViewChangedFiles'), available: true },
  ];
}

/**
 * One sentence describing a batch move: what moved, and what was refused.
 *
 * A drag that moves three files and refuses the fourth must not report only
 * the refusal — the tree looks different afterwards, and "already exists"
 * alone reads as if nothing happened. The wording comes from the plugin's own
 * translator (NOT `navigator.language`: the UI language is a plugin
 * preference, and the two disagree on a zh UI with an en-US browser).
 * @param {string[]} moved - destinations that were written.
 * @param {string} conflict - destination that was refused.
 * @param {(key: string, params?: object) => string} t - plugin translator.
 * @returns {string} the notice text.
 */
export function describeMoved(
  moved: unknown,
  conflict: unknown,
  t: (key: string, params?: Record<string, unknown>) => string,
): string {
  const done = Array.isArray(moved) ? moved.filter((path) => typeof path === 'string' && path !== '') : [];
  const blocked = typeof conflict === 'string' ? conflict : '';
  if (done.length === 0) return t('editor.moveConflict', { path: blocked });
  return t('editor.movePartial', { moved: done.join(', '), path: blocked });
}

/**
 * Replace a host error's bare English with a localised sentence.
 *
 * The file API answers in plain English (`path does not exist`), which reached a
 * Chinese UI verbatim. Only the two known machine messages are translated — every
 * other failure already carries its own context (a git error, a JSON parse hint)
 * and rewriting it would lose that.
 * @param {string} message - error text from the host.
 * @param {Function} translate - the plugin's translator.
 * @param {string} path - the path the action was about.
 * @returns {string} the text to show.
 */
export function hostErrorText(
  message: unknown,
  translate: (key: string, params?: Record<string, unknown>) => string,
  path: unknown,
): string {
  if (typeof message !== 'string' || message === '') return typeof message === 'string' ? message : '';
  if (message === 'path does not exist') return translate('editor.pathMissing', { path: String(path) });
  if (message === 'path escapes the workspace') return translate('editor.pathOutsideWorkspace');
  return message;
}

/**
 * Which diff hunk a line belongs to, for the diff toolbar's `n/total` label.
 *
 * IDEA labels the diff gutter `2/7` and its `⌥⌘↓` walks the hunks; Monaco's
 * `goToDiff` moves the widget but says nothing about where it landed, so the
 * index has to be derived from the same line-changes list the widget uses.
 * A mapping's modified range is half-open at the end, and an empty (pure
 * deletion) range still occupies the line it was removed at.
 * @param {{modifiedStartLineNumber?: number, modifiedEndLineNumber?: number}[]|null} changes - `getLineChanges()` output.
 * @param {number} line - 1-based line in the modified model.
 * @returns {{index: number, total: number}} 1-based hunk index, together with the total.
 */
export function hunkAt(
  changes: Array<{ modifiedStartLineNumber?: number; modifiedEndLineNumber?: number }> | null | undefined,
  line: number,
): { index: number; total: number } {
  const list = Array.isArray(changes) ? changes : [];
  const total = list.length;
  const target = Number(line);
  if (!Number.isFinite(target) || total === 0) return { index: 0, total };
  for (let index = 0; index < total; index += 1) {
    const start = Number(list[index]?.modifiedStartLineNumber ?? 0);
    const end = Number(list[index]?.modifiedEndLineNumber ?? start);
    if (target >= start && target <= Math.max(start, end)) return { index: index + 1, total };
  }
  /* Between hunks: report the hunk just above, the way a gutter would.
         Before the first hunk IDEA still says 1/N: a file with differences
         always has a "current" difference, and only an unchanged file reads
         0/0. */
  let above = 0;
  for (let index = 0; index < total; index += 1) {
    if (Number(list[index]?.modifiedStartLineNumber ?? 0) <= target) above = index + 1;
  }
  return { index: above === 0 ? 1 : above, total };
}

/**
 * Collapse consecutive writes of one block restore into one undo entry.
 *
 * Monaco's `revert` edits the modified model, and the widget can then emit
 * a second content event while it recomputes. A user pressed one arrow, so
 * there must be one `⌘Z`. The `active` record is the restore currently
 * being persisted; returning it unchanged is the observable contract.
 * @param {object|null} active - restore record currently in flight.
 * @param {object[]} history - existing newest-last undo stack.
 * @returns {object[]} the same stack while a restore is active, else sorted history.
 */
export function restoreUndoStack<T>(active: T | null | undefined, history: T[] | null | undefined): T[] {
  const list: T[] = Array.isArray(history) ? history : [];
  return active === null || active === undefined ? list : list;
}

/**
 * Which char-level diff ranges intersect a modified-side selection.
 *
 * Monaco's public `ILineChange.charChanges` carries original and modified
 * ranges; the widget's `revertRangeMappings()` consumes the same shape.
 * Selection ends are exclusive, except Monaco reports an empty selection at
 * column 1 as a whole-line caret. The caller only needs ranges that really
 * cover at least one changed character, so adjacent touches are excluded.
 * @param {object[]|null} changes - `getLineChanges()` output.
 * @param {{startLineNumber: number, startColumn: number, endLineNumber: number, endColumn: number}} selection - modified selection.
 * @returns {object[]} char changes to revert, in document order.
 */
interface MonacoCharChange {
  originalStartLineNumber?: number;
  originalStartColumn?: number;
  originalEndLineNumber?: number;
  originalEndColumn?: number;
  modifiedStartLineNumber?: number;
  modifiedStartColumn?: number;
  modifiedEndLineNumber?: number;
  modifiedEndColumn?: number;
}

interface MonacoLineChange {
  modifiedStartLineNumber?: number;
  modifiedEndLineNumber?: number;
  charChanges?: MonacoCharChange[];
}

interface MonacoSelectionRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export function selectedCharChanges(
  changes: MonacoLineChange[] | null | undefined,
  selection: MonacoSelectionRange,
): Array<Record<string, unknown>> {
  const list = Array.isArray(changes) ? changes : [];
  const startLine = Number(selection?.startLineNumber);
  const endLine = Number(selection?.endLineNumber);
  if (!Number.isFinite(startLine) || !Number.isFinite(endLine)) return [];
  const endColumn = Number(selection?.endColumn);
  const before = (aLine: number, aColumn: number, bLine: number, bColumn: number): boolean =>
    aLine < bLine || (aLine === bLine && aColumn < bColumn);
  const result: Array<Record<string, unknown>> = [];
  for (const lineChange of list) {
    for (const range of Array.isArray(lineChange?.charChanges) ? lineChange.charChanges : []) {
      const rangeStart = { line: Number(range.modifiedStartLineNumber), column: Number(range.modifiedStartColumn) };
      const rangeEnd = { line: Number(range.modifiedEndLineNumber), column: Number(range.modifiedEndColumn) };
      if (!Number.isFinite(rangeStart.line) || !Number.isFinite(rangeStart.column)) continue;
      if (!Number.isFinite(rangeEnd.line) || !Number.isFinite(rangeEnd.column)) continue;
      /* A caret is not a range: only intersect real changed spans. */
      if (
        before(rangeEnd.line, rangeEnd.column, rangeStart.line, rangeStart.column) === false &&
        rangeEnd.line === rangeStart.line &&
        rangeEnd.column === rangeStart.column
      )
        continue;
      /* Monaco stores a whole-line replacement as endColumn=1 of the NEXT
             line. A strictly column-wise `end <= selectionStart` comparison
             therefore calls the replacement "before" a selection on its own line.
             Compare the half-open line intervals first, and only use columns
             when the edit and the selection share an edge on one line. */
      if (rangeEnd.line < startLine) continue;
      if (endLine < rangeStart.line) continue;
      if (
        rangeStart.line === endLine &&
        rangeEnd.line === startLine &&
        endColumn <= rangeStart.column &&
        rangeEnd.column === 1
      )
        continue;
      result.push({
        originalStartLineNumber: Number(range.originalStartLineNumber),
        originalStartColumn: Number(range.originalStartColumn),
        originalEndLineNumber: Number(range.originalEndLineNumber),
        originalEndColumn: Number(range.originalEndColumn),
        modifiedStartLineNumber: rangeStart.line,
        modifiedStartColumn: rangeStart.column,
        modifiedEndLineNumber: rangeEnd.line,
        modifiedEndColumn: rangeEnd.column,
        /* Monaco's public char-change payload is flat; the widget's
               `revertRangeMappings()` expects the internal `RangeMapping`
               shape. Supplying only the flat fields made it a no-op. */
        originalRange: {
          startLineNumber: Number(range.originalStartLineNumber),
          startColumn: Number(range.originalStartColumn),
          endLineNumber: Number(range.originalEndLineNumber),
          endColumn: Number(range.originalEndColumn),
        },
        modifiedRange: {
          startLineNumber: rangeStart.line,
          startColumn: rangeStart.column,
          endLineNumber: rangeEnd.line,
          endColumn: rangeEnd.column,
        },
      });
    }
  }
  return result;
}

/**
 * Convert one whole Monaco line change into range mappings.
 *
 * IDEA's Apply Left Side acts on the change under the caret when there is
 * no explicit selection. Monaco's public revert API consumes the same
 * char-level mapping shape as a selection, so cover every modified line in
 * the change and reuse the shared selection filter.
 * @param {object|null|undefined} change - one Monaco line change.
 * @returns {object[]} mappings accepted by revertRangeMappings().
 */
export function lineChangeRangeMappings(change: MonacoLineChange | null | undefined): Array<Record<string, unknown>> {
  if (change === null || change === undefined) return [];
  const startLineNumber = Math.max(1, Math.floor(Number(change.modifiedStartLineNumber) || 1));
  const endLineNumber = Math.max(startLineNumber, Math.floor(Number(change.modifiedEndLineNumber) || startLineNumber));
  return selectedCharChanges([change], {
    startLineNumber,
    startColumn: 1,
    endLineNumber,
    endColumn: Number.MAX_SAFE_INTEGER,
  });
}

/**
 * What pressing Enter on a speed-search hit should do.
 *
 * `onToggle` CLOSES an expanded folder, so pressing Enter to jump to a directory
 * that was already open collapsed it — the opposite of "take me there". A file is
 * always opened; a folder is expanded only when it is closed.
 * @param {{kind?: string, open?: boolean}|null} hit - the matched row.
 * @returns {'open'|'expand'|'keep'|'none'} the action to take.
 */
export function revealInTree(
  hit: { kind?: string; open?: boolean } | null | undefined,
): 'open' | 'expand' | 'keep' | 'none' {
  if (hit === null || hit === undefined) return 'none';
  if (hit.kind === 'file') return 'open';
  if (hit.kind === 'directory') {
    /* `open` must be passed in: the row itself carries no such field, so reading
           `hit.open` always looked like "closed" and Enter re-expanded (or, before
           round 134, toggled) a folder that was already open. */
    return hit.open === true ? 'keep' : 'expand';
  }
  return 'none';
}

/**
 * What one indent column draws in a row: a full line or nothing.
 *
 * The last child of a subtree ends the column without drawing a horizontal
 * elbow. The empty cell keeps the depth aligned while avoiding an L-shaped
 * decoration in front of the file icon.
 * @param {{continues: boolean[], index: number, depth: number}} state - per-depth flags, the column, the row's depth.
 * @returns {'line'|'none'} what to draw in that column.
 */
export function guideKind(
  state: { continues?: unknown; index?: unknown; depth?: unknown } | null | undefined,
): 'line' | 'none' {
  if (state === null || state === undefined) return 'none';
  const continues = Array.isArray(state.continues) ? state.continues : [];
  const index = Number(state.index);
  if (!Number.isFinite(index) || index < 0) return 'none';
  return continues[index] === false ? 'none' : 'line';
}

/**
 * Which indent columns still have something below them.
 *
 * IDEA draws one vertical line per ancestor, and the line under the LAST child of
 * a subtree stops at that row. Passing the flags straight through keeps the rule
 * in one place and lets the renderer stay a plain map.
 * @param {boolean[]} isLast - per depth, whether that ancestor has no sibling below.
 * @returns {boolean[]} per depth, whether the column's line continues.
 */
function continuationFlags(isLast: unknown): boolean[] {
  if (!Array.isArray(isLast)) return [];
  return isLast.map((last: unknown) => last !== true);
}

/**
 * The colour a tree row's name takes, detached from any letter.
 *
 * IDEA's tree has NO git letters: the "M" in its screenshots is the Markdown
 * file icon. A changed file or folder is shown by tinting its name, so the row
 * keeps a stable indent and the icon column stays aligned.
 * @param {{status?: string, selected?: boolean}|null} state - the row's porcelain status and selection.
 * @returns {string|null} a CSS colour, or null for "keep the default".
 */
export function treeNameColor(state: { status?: string; selected?: boolean } | null | undefined): string | null {
  if (state === null || state === undefined) return null;
  if (state.selected === true) return '#fff';
  const status = typeof state.status === 'string' ? state.status : '';
  if (status === '') return null;
  const info = gitStatusInfo(status);
  return info === null ? null : info.color;
}

/**
 * The colour a changed folder's name takes, with no letter.
 *
 * IDEA stamps M/A/D on FILES and only tints a folder whose contents changed: a
 * letter on a folder reads like the folder itself was modified, and it also
 * shifted every child row's icon. Precedence is conflict > deleted > added >
 * renamed > modified, and an all-untracked folder is grey.
 * @param {{path: string, status: string}[]|null} changes - changes inside the folder.
 * @returns {{color: string}|null} the tint, or null when the folder is clean.
 */
export function directoryTint(changes: Array<{ status?: unknown }> | null | undefined): { color: string } | null {
  const inside = (Array.isArray(changes) ? changes : [])
    .map((change) => (typeof change.status === 'string' ? change.status : ''))
    .filter((status) => status !== '');
  if (inside.length === 0) return null;
  if (
    inside.some(
      (status) =>
        status === 'UU' ||
        status === 'AA' ||
        status === 'DD' ||
        status === 'AU' ||
        status === 'UA' ||
        status === 'DU' ||
        status === 'UD',
    )
  ) {
    return { color: '#cf222e' };
  }
  if (inside.every((status) => status === '??')) return { color: '#6e7781' };
  if (inside.some((status) => status.includes('D'))) return { color: '#cf222e' };
  if (inside.some((status) => status[0] === 'A')) return { color: '#1a7f37' };
  if (inside.some((status) => status.includes('R'))) return { color: '#8250df' };
  return { color: '#2f65ca' };
}

/**
 * The label a branch chip shows, detached HEAD included.
 *
 * `git rev-parse --abbrev-ref HEAD` answers the literal string "HEAD" when the
 * repository is detached, so the chip read "HEAD" — indistinguishable from a
 * branch of that name. IDEA labels the state instead.
 * @param {{branch?: string, detached?: boolean, hash?: string}|null} git - status payload.
 * @returns {string} the chip text, or '' when there is nothing to show.
 */
export function branchLabel(git: unknown): string {
  if (git === null || typeof git !== 'object' || Array.isArray(git)) return '';
  const record = git as Record<string, unknown>;
  const branch = typeof record.branch === 'string' ? record.branch.trim() : '';
  if (record.detached === true) {
    const hash = typeof record.hash === 'string' ? record.hash.trim() : '';
    const short = hash === '' ? '' : hash.slice(0, 7);
    return short === '' ? 'detached HEAD' : `detached at ${short}`;
  }
  /* A repo with no commits answers "HEAD" too; treat it as no branch. */
  return branch === 'HEAD' ? '' : branch;
}

/**
 * Turn an OSC 7 payload into the working directory it reports.
 *
 * Shells print `ESC ] 7 ; file://host/path ST` after each prompt; xterm hands the
 * middleware the part after `7;`. That is the only way to follow `cd` — the PTY
 * handle exposes no pid and the host never asks the shell for its directory — so
 * the menu actions ("copy directory path", "reveal", "open README") can point at
 * where the user actually is rather than where the tab was created.
 * @param {string} payload - the OSC 7 payload.
 * @returns {string|null} the absolute path, or null when it is not a file URL.
 */
export function cwdFromOsc7(payload: unknown): string | null {
  if (typeof payload !== 'string') return null;
  const match = /^file:\/\/[^/]*(\/.*)$/.exec(payload.trim());
  if (match === null) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    /* A malformed escape keeps the raw path rather than dropping the report. */
    return match[1];
  }
}

/**
 * Find the README in a directory listing, relative to that directory.
 *
 * IDEA's terminal menu opens the directory's README so a shell in another package
 * does not force the user back to the tree. Matching ignores case because the file
 * is spelled README.md / readme.md / Readme.md by different projects, and a
 * missing README must yield null so the menu item can be disabled instead of
 * opening a path that is not there.
 * @param {string[]} names - entries in the directory (basenames).
 * @param {string} directory - workspace-relative directory the shell is in.
 * @returns {string|null} the workspace-relative README path, or null.
 */
export function readmeInDirectory(names: unknown, directory: unknown): string | null {
  if (!Array.isArray(names)) return null;
  const match = names.find(
    (name): name is string => typeof name === 'string' && /^readme(\.(md|markdown|txt|rst))?$/i.test(name),
  );
  if (match === undefined) return null;
  const base = typeof directory === 'string' ? directory.replace(/^\/+|\/+$/g, '') : '';
  return base === '' ? match : `${base}/${match}`;
}

/**
 * IDEA's in-tree typeahead: pick the row a typed prefix lands on.
 *
 * Different from ⌘F speed search: no box opens, nothing filters, and the
 * search wraps around the list — you type `gr` and the selection jumps to
 * `graph.ts`, then `gr` again continues to the next match. Matching is a
 * prefix test on the name (IDEA does not match the middle of a name here).
 * @param {{name: string, path: string, kind: string}[]} rows - flattened rows in display order.
 * @param {string} buffer - the characters typed so far.
 * @param {string|null} fromPath - currently selected path (search starts here).
 * @param {boolean} advance - true to start AFTER `fromPath` (cycling repeats).
 * @returns {string|null} the path to select, or null when nothing matches.
 */
function typeaheadMatch(
  rows: ProjectTreeRow[] | null | undefined,
  buffer: unknown,
  fromPath: string | null,
  advance: boolean,
): string | null {
  const needle = typeof buffer === 'string' ? buffer.trim().toLowerCase() : '';
  if (needle === '') return null;
  const list = Array.isArray(rows)
    ? rows.filter((row) => row.kind !== 'placeholder' && typeof row.name === 'string')
    : [];
  if (list.length === 0) return null;
  const start = list.findIndex((row) => row.path === fromPath);
  /* `advance` steps past the current row; a fresh prefix may hit it again. */
  const from = start < 0 ? 0 : advance ? start + 1 : start;
  for (let step = 0; step < list.length; step += 1) {
    const row = list[(from + step) % list.length];
    if (row.name.toLowerCase().startsWith(needle)) return row.path;
  }
  return null;
}

/**
 * Convert visible change rows into the candidate shape used by the shared
 * typeahead. A path can exist in both staged and working groups (MM), so
 * the identity includes the band while matching still uses the basename.
 * @param {Array<{path?: string, staged?: boolean, order?: number}|null>} changes - visible changes.
 * @returns {Array<{name: string, path: string, workspacePath: string, staged: boolean, order: number}>} candidates.
 */
export function changeTypeaheadRows(
  changes: Array<{ path?: unknown; staged?: unknown; order?: unknown } | null | undefined> | null | undefined,
): Array<{ name: string; path: string; workspacePath: string; staged: boolean; order: number }> {
  const rows: Array<{ name: string; path: string; workspacePath: string; staged: boolean; order: number }> = [];
  for (const [index, change] of (Array.isArray(changes) ? changes : []).entries()) {
    if (change === null || change === undefined || typeof change.path !== 'string' || change.path === '') continue;
    rows.push({
      name: basename(change.path),
      path: `${change.staged === true ? 'staged' : 'unstaged'}:${change.path}`,
      workspacePath: change.path,
      staged: change.staged === true,
      order: typeof change.order === 'number' && Number.isInteger(change.order) ? change.order : index,
    });
  }
  return rows;
}

/**
 * Fold one keystroke into the typeahead prefix and resolve what to select.
 *
 * Three rules, in this order:
 * 1. A fresh keystroke (or a pause past {@link TYPEAHEAD_RESET_MS}) starts a
 *    new prefix and may land on the row already selected.
 * 2. Otherwise the prefix grows — and growing must NOT skip the current row:
 *    typing `g` then `r` has to stay on `graph.ts`. Searching strictly after
 *    the selection sent `gr` to `grid.ts`, i.e. the selection ran away from
 *    the file being narrowed down.
 * 3. Repeating the LAST character cycles to the next match (`g` `g`, `gr` `r`),
 *    which is the classic typeahead gesture. A dead-end prefix that is not a
 *    repeat restarts from the new character, so `g` `x` `r` still finds
 *    `readme.md` instead of staying stuck on `gx`.
 * @param {{rows: object[], buffer: string, path: string|null, key: string, now: number, lastAt: number}} input - one keystroke's context.
 * @returns {{buffer: string, at: number, hit: string|null}} the next typeahead state.
 */
export function typeaheadStep(input: {
  rows?: ProjectTreeRow[] | null;
  buffer?: unknown;
  path?: string | null;
  key?: unknown;
  now?: unknown;
  lastAt?: unknown;
}): { buffer: string; at: number; hit: string | null } {
  const key = typeof input?.key === 'string' ? input.key : '';
  const rows = Array.isArray(input?.rows) ? input.rows : [];
  const previous = typeof input?.buffer === 'string' ? input.buffer : '';
  const path = input?.path ?? null;
  const now = Number(input?.now ?? 0);
  const lastAt = Number(input?.lastAt);
  const fresh = previous === '' || !Number.isFinite(lastAt) || now - lastAt > TYPEAHEAD_RESET_MS;
  if (fresh) return { buffer: key, at: now, hit: typeaheadMatch(rows, key, path, false) };
  /* Rule 3 first: "same letters again" means next match, not "grr". */
  if (key !== '' && key.toLowerCase() === previous.slice(-1).toLowerCase()) {
    return { buffer: previous, at: now, hit: typeaheadMatch(rows, previous, path, true) };
  }
  const grown = previous + key;
  const hit = typeaheadMatch(rows, grown, path, false);
  if (hit !== null) return { buffer: grown, at: now, hit };
  /* Dead end: restart from this one character rather than bury the key in `gx`. */
  const restarted = typeaheadMatch(rows, key, path, false);
  return { buffer: restarted === null ? '' : key, at: now, hit: restarted };
}

/**
 * Rows that are actual speed-search hits, excluding retained ancestors.
 *
 * `filterTreeRows` intentionally keeps every directory above a hit so the
 * result still reads as a tree. Arrow-key navigation and `Enter`, however,
 * must move between files that match the query, not stop on a parent that
 * merely survived the filter.
 * @param {object[]} rows - filtered tree rows.
 * @param {string} query - speed-search text.
 * @returns {object[]} hit rows in display order.
 */
export function speedSearchHitRows(rows: ProjectTreeRow[] | null | undefined, query: unknown): ProjectTreeRow[] {
  const needle = typeof query === 'string' ? query.trim().toLowerCase() : '';
  if (needle === '') return [];
  return (Array.isArray(rows) ? rows : []).filter(
    (row) =>
      row !== null &&
      row !== undefined &&
      row.kind !== 'placeholder' &&
      row.path !== '' &&
      typeof row.name === 'string' &&
      row.name.toLowerCase().includes(needle),
  );
}

/**
 * Pick the next speed-search row without counting ancestor-only nodes.
 *
 * `first` keeps the current hit if it is still valid and otherwise jumps to
 * the first hit. `next` / `previous` cycle through the hit set, matching the
 * arrow-key behaviour in IDEA's in-place search.
 * @param {object[]} rows - filtered tree rows.
 * @param {string} query - speed-search text.
 * @param {string|null} currentPath - selected row path.
 * @param {'first'|'next'|'previous'} direction - navigation intent.
 * @returns {string|null} target row path, or null when nothing matches.
 */
export function speedSearchTarget(
  rows: ProjectTreeRow[] | null | undefined,
  query: unknown,
  currentPath: string | null,
  direction: 'first' | 'next' | 'previous',
): string | null {
  const hits = speedSearchHitRows(rows, query);
  if (hits.length === 0) return null;
  const currentIndex = hits.findIndex((row) => row.path === currentPath);
  if (currentIndex < 0) return hits[0].path;
  if (direction === 'first') return hits[currentIndex].path;
  const offset = direction === 'previous' ? -1 : direction === 'next' ? 1 : 0;
  return hits[(currentIndex + offset + hits.length) % hits.length].path;
}

/**
 * Project files an Open in Right Split gesture should open.
 *
 * The action follows the current visible tree order, ignores directories and
 * the workspace root, and keeps only one entry per path. Right-clicking a row
 * outside the current multi-selection acts on that row alone.
 * @param {object[]} rows - visible Project rows in display order.
 * @param {Set<string>} selection - current Project row selection.
 * @param {string} clickedPath - row that received the context-menu gesture.
 * @returns {string[]} workspace-relative files in stable display order.
 */
export function projectRightSplitPaths(
  rows: ProjectTreeRow[] | null | undefined,
  selection: Set<string> | null | undefined,
  clickedPath: string,
): string[] {
  if (typeof clickedPath !== 'string' || clickedPath === '') return [];
  const selected: Set<string> = selection instanceof Set ? selection : new Set<string>();
  const wanted = selected.size > 1 && selected.has(clickedPath) ? selected : new Set([clickedPath]);
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const path = row?.path;
    if (row?.kind !== 'file' || typeof path !== 'string' || path === '' || !wanted.has(path) || seen.has(path))
      continue;
    seen.add(path);
    paths.push(path);
  }
  return paths;
}

/**
 * Resolve the one IDEA Project preference behind AutoscrollToSource.
 *
 * IntelliJ names the action `ProjectView.AutoscrollToSource`, but its
 * user-facing text is "Open Files with Single Click". Round 358 mistakenly
 * treated the action id as a second preference; keep its stored value only
 * as a migration source for the existing single-click option.
 * @param {string} current - stored `singleClickOpen` value.
 * @param {string} legacy - stored round-358 `autoscrollToSource` value.
 * @returns {boolean} whether the unified preference is enabled.
 */
function projectSingleClickPreference(current: unknown, legacy: unknown): boolean {
  return current === '1' || legacy === '1';
}

/**
 * Read the unified Project single-click preference and migrate old state.
 * @returns {boolean} whether selecting a file with one click opens it.
 */
export function readProjectSingleClickOpen() {
  const current = readStoredText('dsh-editor.project.singleClickOpen', '0');
  const legacy = readStoredText('dsh-editor.project.autoscrollToSource', '0');
  const enabled = projectSingleClickPreference(current, legacy);
  if (legacy === '1') {
    try {
      window.localStorage.setItem('dsh-editor.project.singleClickOpen', enabled ? '1' : '0');
      window.localStorage.removeItem('dsh-editor.project.autoscrollToSource');
    } catch {
      /* a storage-less browser keeps the in-memory choice */
    }
  }
  return enabled;
}

/**
 * Whether Expand Selected has at least one selected directory to act on.
 *
 * IDEA enables the action for a selected root and recursively expands the
 * whole project. File-only and empty selections remain disabled because they
 * have no expandable target.
 * @param {object[]|null} rows - visible Project rows.
 * @param {Set<string>|null} selection - selected paths.
 * @returns {boolean} true when at least one selected row is an expandable directory.
 */
export function projectCanExpandSelection(
  rows: ProjectTreeRow[] | null | undefined,
  selection: Set<string> | null | undefined,
): boolean {
  const selected: Set<string> = selection instanceof Set ? selection : new Set<string>();
  if (selected.size === 0) return false;
  return (Array.isArray(rows) ? rows : []).some(
    (row) => row?.kind === 'directory' && selected.has(row.path) && (row.root === true || row.path !== ''),
  );
}

/**
 * Whether IDEA's Expand All action has any collapsed directory to open.
 *
 * `TreeExpander.isExpandAllEnabled()` is false when the tree cannot expand
 * further. DSH knows that boundary from the expanded set plus the cached
 * listings, so an already-expanded tree must not expose a no-op action.
 * @param {object[]|null} entries - top-level directory listing.
 * @param {Record<string, object[]>|null} children - loaded directory listings.
 * @param {Set<string>|null} expanded - expanded directory paths.
 * @returns {boolean} true when at least one directory still needs expansion.
 */
export function projectCanExpandAll(
  entries: ProjectTreeRow[] | null | undefined,
  children: Record<string, ProjectTreeRow[]> | null | undefined,
  expanded: Set<string> | null | undefined,
): boolean {
  const expandedSet: Set<string> = expanded instanceof Set ? expanded : new Set<string>();
  const queue: string[] = (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry?.kind === 'directory' && typeof entry.path === 'string')
    .map((entry) => entry.path);
  const seen = new Set<string>();
  while (queue.length > 0) {
    const path = queue.shift();
    if (seen.has(path)) continue;
    seen.add(path);
    if (!expandedSet.has(path)) return true;
    const listing = children?.[path];
    if (!Array.isArray(listing)) return true;
    for (const child of listing) {
      if (child?.kind === 'directory' && typeof child.path === 'string') queue.push(child.path);
    }
  }
  return false;
}

/**
 * Whether IDEA's Collapse All action has any expanded directory to close.
 * @param {Set<string>|null} expanded - expanded directory paths.
 * @returns {boolean} true when the tree contains an expanded directory.
 */
export function projectCanCollapseAll(expanded: unknown): boolean {
  return expanded instanceof Set && expanded.size > 0;
}

/**
 * Whether a speed search found nothing.
 *
 * `filterTreeRows` always keeps the root row (so the tree still has a frame), which
 * means "no hits" looks like exactly one row — the old `rows.length <= 1` test was a
 * proxy for that. Counting the non-root rows says what it means, and keeps working
 * if the root is ever filtered differently.
 * @param {{query: string, rows: {path: string}[]}|null} state - the query and the filtered rows.
 * @returns {boolean} true when the query is non-empty and nothing but the root matched.
 */
export function treeSearchMiss(
  state: { loading?: boolean; query?: unknown; rows?: ProjectTreeRow[] | null } | null | undefined,
): boolean {
  if (state === null || state === undefined) return false;
  if (state.loading === true) return false;
  const query = typeof state.query === 'string' ? state.query.trim() : '';
  if (query === '') return false;
  const rows = Array.isArray(state.rows) ? state.rows : [];
  return rows.every((row) => row === null || row === undefined || row.path === '');
}

/**
 * Summarise one completed drag so the tree can report it.
 *
 * A successful move used to be completely silent: five files disappeared from one
 * folder and appeared in another with no acknowledgement, which reads the same as
 * a drag that did nothing. The count is what makes the outcome visible.
 * @param {{moved: string[], conflicts: {to: string}[], target: string}|null} plan - what the move produced.
 * @returns {{done: number, target: string, blocked?: string}|null} the summary.
 */
export function describeMoveResult(
  plan: {
    moved?: string[];
    conflicts?: Array<{ to?: string }>;
    target?: string;
  } | null,
): { done: number; target: string; blocked?: string } | null {
  if (plan === null || plan === undefined) return null;
  const moved = Array.isArray(plan.moved) ? plan.moved.filter((path) => typeof path === 'string' && path !== '') : [];
  const target = typeof plan.target === 'string' ? plan.target : '';
  const blocked = Array.isArray(plan.conflicts) && plan.conflicts.length > 0 ? plan.conflicts[0]?.to : undefined;
  const summary: { done: number; target: string; blocked?: string } = { done: moved.length, target };
  if (typeof blocked === 'string' && blocked !== '') summary.blocked = blocked;
  return summary;
}

/**
 * Turn one drag's sources into an ordered, all-or-nothing move plan.
 *
 * The previous implementation renamed inside the loop, so the second entry's
 * "already exists" error surfaced after the first entry had already moved —
 * a drag could leave the tree half-applied. Planning first means the caller
 * can refuse the whole batch, or run exactly the moves that are safe, and the
 * conflict it reports names the exact destination (IDEA's wording).
 * @param {string[]} sources - dragged workspace-relative paths.
 * @param {string} targetDirectory - directory dropped onto ('' for the root).
 * @param {Set<string>} existing - every path that currently exists, including directories.
 * @returns {{moves: object[], conflicts: object[], intoSelf: string[], unchanged: string[]}} the plan.
 */
export function planMoves(
  sources: unknown,
  targetDirectory: unknown,
  existing: Set<string> | null | undefined,
): {
  moves: Array<{ from: string; to: string }>;
  conflicts: Array<{ from: string; to: string; reason: 'duplicate' | 'exists' }>;
  intoSelf: string[];
  unchanged: string[];
} {
  const taken: Set<string> = existing instanceof Set ? existing : new Set<string>();
  const target = typeof targetDirectory === 'string' ? targetDirectory : '';
  const plan: {
    moves: Array<{ from: string; to: string }>;
    conflicts: Array<{ from: string; to: string; reason: 'duplicate' | 'exists' }>;
    intoSelf: string[];
    unchanged: string[];
  } = { moves: [], conflicts: [], intoSelf: [], unchanged: [] };
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const source of Array.isArray(sources) ? sources : []) {
    if (typeof source !== 'string' || source === '' || seen.has(source)) continue;
    seen.add(source);
    unique.push(source);
  }
  /* Moves land in one directory, so a duplicate basename inside the batch
         collides with itself before the filesystem is ever touched. */
  const destinations = new Set<string>();
  for (const source of unique) {
    if (target === source || target.startsWith(`${source}/`)) {
      plan.intoSelf.push(source);
      continue;
    }
    const name = basename(source);
    const to = target === '' ? name : `${target}/${name}`;
    if (to === source) {
      plan.unchanged.push(source);
      continue;
    }
    if (destinations.has(to)) {
      plan.conflicts.push({ from: source, to, reason: 'duplicate' });
      continue;
    }
    if (taken.has(to)) {
      plan.conflicts.push({ from: source, to, reason: 'exists' });
      continue;
    }
    destinations.add(to);
    plan.moves.push({ from: source, to });
  }
  return plan;
}

/**
 * Split a tree label into plain and matched runs for IDEA's speed-search highlight.
 *
 * The whole row must not be tinted: a long path would be unreadable, and the
 * user needs to see WHICH characters matched. Matching is case-insensitive
 * but the returned text keeps the original casing. Every occurrence is
 * marked, so `a/a.ts` searching `a` lights up both.
 * @param {string} name - the label as rendered.
 * @param {string} query - typed search text.
 * @returns {Array<{text: string, match: boolean}>} runs to render in order.
 */
export function highlightParts(name: unknown, query: unknown): Array<{ text: string; match: boolean }> {
  const text = typeof name === 'string' ? name : '';
  const needle = typeof query === 'string' ? query.trim() : '';
  if (text === '') return [];
  if (needle === '') return [{ text, match: false }];
  const lower = text.toLowerCase();
  const target = needle.toLowerCase();
  const parts: Array<{ text: string; match: boolean }> = [];
  let cursor = 0;
  for (;;) {
    const at = lower.indexOf(target, cursor);
    if (at < 0) break;
    if (at > cursor) parts.push({ text: text.slice(cursor, at), match: false });
    parts.push({ text: text.slice(at, at + target.length), match: true });
    cursor = at + target.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });
  return parts.length === 0 ? [{ text, match: false }] : parts;
}

/**
 * Keep only the rows matching a speed-search query, plus the directories above them.
 *
 * IDEA's Project search filters in place instead of opening a dialog, and a
 * match is only useful when its parent path is still visible — so every
 * ancestor of a hit is retained even though it does not match itself.
 * @param {object[]} rows - flattened tree rows, root first.
 * @param {string} query - case-insensitive substring of the entry name.
 * @returns {object[]} rows to render; the root row is always kept.
 */
export function filterTreeRows(rows: ProjectTreeRow[], query: string): ProjectTreeRow[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return rows;
  const keep = new Set<string>();
  for (const row of rows) {
    if (row.path === '' || row.name.toLowerCase().includes(needle)) keep.add(row.path);
  }
  /* Retain ancestors so a deep hit is still reachable in the tree. */
  for (const path of [...keep]) {
    let parent = path;
    while (parent !== '') {
      parent = parent.includes('/') ? parent.slice(0, parent.lastIndexOf('/')) : '';
      keep.add(parent);
    }
  }
  /* "(empty)" describes the directory as it exists on disk — under a query it
         would claim the matched folder has no children, which is the opposite of
         what the hit means. */
  return rows.filter((row) => keep.has(row.path) && row.kind !== 'placeholder');
}

/**
 * Build Project rows from recursive name-search matches.
 *
 * The host returns only matches, so the client synthesizes their ancestry to
 * preserve IDEA's tree shape. Directories with displayed descendants are
 * marked open explicitly: they may still be collapsed in the real tree, but
 * hiding the child that caused the search would make the hit unreachable.
 *
 * @param {Array<{path: string, name?: string, kind?: string}>} matches - host search hits.
 * @param {string} projectName - root label.
 * @param {boolean} [compactDirectories=false] - Project Compact Directories preference.
 * @param {string} [sortMode='name'] - Project sort mode.
 * @param {Record<string, string[]>|null} [manualOrder=null] - saved sibling order.
 * @returns {object[]} flattened tree rows, including the root.
 */
export function searchEntryRows(
  matches: Array<{ path?: unknown; name?: unknown; kind?: unknown }> | null | undefined,
  projectName: string,
  compactDirectories = false,
  sortMode = 'name',
  manualOrder: Record<string, string[]> | null = null,
): ProjectTreeRow[] {
  const nodes = new Map<string, ProjectTreeRow>();
  for (const match of Array.isArray(matches) ? matches : []) {
    if (match === null || typeof match !== 'object' || typeof match.path !== 'string' || match.path === '') continue;
    const parts = match.path.split('/').filter((part: string) => part !== '');
    let current = '';
    for (let index = 0; index < parts.length; index += 1) {
      current = current === '' ? parts[index] : `${current}/${parts[index]}`;
      const last = index === parts.length - 1;
      const existing = nodes.get(current);
      if (existing === undefined) {
        nodes.set(current, {
          path: current,
          name: parts[index],
          kind: last && match.kind === 'file' ? 'file' : 'directory',
        });
      } else if (last && match.kind === 'file') {
        existing.kind = 'file';
      }
    }
  }
  const children = new Map<string, ProjectTreeRow[]>();
  for (const node of nodes.values()) {
    const parent = dirname(node.path);
    const siblings = children.get(parent) ?? [];
    siblings.push(node);
    children.set(parent, siblings);
  }
  const listings: Record<string, ProjectTreeRow[]> = {};
  const expanded = new Set<string>(['']);
  /* The host applies its normal sort while walking search results. Manual
         Order is client-owned, so search ancestry must apply the same sibling
         ranking as the visible tree instead of exposing host traversal order. */
  const serialize = (parent: string): ProjectTreeRow[] => {
    const siblings = children.get(parent) ?? [];
    const ordered = sortMode === 'manual' ? orderProjectEntriesByManual(siblings, manualOrder?.[parent]) : siblings;
    return ordered.map((node) => {
      const descendants = children.get(node.path) ?? [];
      if (node.kind === 'directory' && descendants.length > 0) {
        expanded.add(node.path);
        listings[node.path] = serialize(node.path);
      }
      return {
        name: node.name,
        path: node.path,
        kind: node.kind,
        searchOpen: node.kind === 'directory' && descendants.length > 0,
      };
    });
  };
  const rootEntries = serialize('');
  return flattenRows(
    rootEntries,
    listings,
    expanded,
    projectName,
    '',
    compactDirectories === true,
    sortMode,
    manualOrder,
  ).filter((row) => row.kind !== 'placeholder');
}

/**
 * Keep a render-time exception inside the Editor split.
 *
 * Before this boundary existed, a ReferenceError anywhere below
 * EditorWorkspace unmounted the whole injected root and left the 65% editor
 * column as an empty host while the host-owned Chat column kept rendering.
 * The boundary provides a visible recovery path and never wraps Chat.
 */
/* EditorErrorBoundary migrated to components/editor/EditorErrorBoundary.tsx. */

/** The editor workspace: activity stripe, Project/Commit/Terminal panels, tabs, Monaco. */
