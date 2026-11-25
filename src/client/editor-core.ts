/* editor-core.ts: dsh-editor file API, Monaco and path utility module. Generated into lib/client.js by scripts/build-client.mjs. */
import type * as Monaco from 'monaco-editor';
import type { CommitGraphPayload } from './components/commit/CommitGraph';
import type { ShelfEntry } from './components/commit/stash-shelve-menu';
import { languageFor } from './components/editor/editor-language-model';
import { dirname } from './components/editor/editor-path-model';
import {
  EDITOR_CODE_FONT_SIZE,
  EDITOR_CODE_LINE_HEIGHT,
  EDITOR_GUTTER_LAYOUT,
  EDITOR_SURFACE_BACKGROUNDS,
  EDITOR_UI_FONT,
} from './components/editor/editor-style-model';
import {
  IDEA_LIGHT_SEMANTIC_TOKEN_LEGEND,
  IDEA_LIGHT_THEME_ID,
  clipIdeaLightSemanticTokensToRange,
  collectIdeaLightHeuristicSemanticTokens,
  encodeIdeaLightSemanticTokens,
  ideaLightTokenRules,
} from './components/editor/editor-theme-model';
import { navigationPathForModel } from './code-navigation';
import { ideaControlKeyModifier, isMacPlatform } from './foundation';
import { flattenDictionary, interpolateMessage } from './locales';
import { findUsagesSearchTarget } from './commit';
import type { DiffChange } from './diff';
import { editorFindSelectionScope } from './terminal';

interface LocaleDictionaryTree {
  [key: string]: string | LocaleDictionaryTree;
}

interface HarnessEditorLocation {
  path: string;
  line: number;
  column: number;
  endLine: number | null;
  endColumn: number | null;
}

interface FileApiRequestOptions {
  signal?: AbortSignal;
}

interface FileApiResult {
  response: Response;
  data: {
    ok?: boolean;
    error?: { message?: string };
    value?: Record<string, unknown>;
  };
}

interface EditorActionHandlers {
  onSave?: () => void;
  onSaveAll?: () => void;
  onFind?: () => void;
  onSearchText?: () => void;
  onGotoLine?: () => void;
  onGoToDefinition?: (editor: Monaco.editor.ICodeEditor, position: Monaco.Position) => void;
  onGoToImplementation?: (editor: Monaco.editor.ICodeEditor, position: Monaco.Position) => void;
  onNavigateBack?: () => void;
  onNavigateForward?: () => void;
  onFindUsages?: (editor: Monaco.editor.ICodeEditor) => void;
  onFindUsagesInFile?: (editor: Monaco.editor.ICodeEditor) => void;
  onFindInFiles?: (editor: Monaco.editor.ICodeEditor) => void;
  onReplaceInFiles?: (editor: Monaco.editor.ICodeEditor) => void;
  onReplace?: (editor: Monaco.editor.ICodeEditor) => void;
  onIncrementalSearch?: (editor: Monaco.editor.ICodeEditor) => void;
  onFindInSelection?: (editor: Monaco.editor.ICodeEditor) => void;
  onReplaceInSelection?: (editor: Monaco.editor.ICodeEditor) => void;
  onCloseTab?: () => void;
  onSendHarnessReference?: (editor: Monaco.editor.ICodeEditor) => void;
  textSearchLabel?: string;
  findUsagesLabel?: string;
  findUsagesInFileLabel?: string;
  highlightUsagesInFileLabel?: string;
  findWordAtCaretLabel?: string;
  previousWordOccurrenceLabel?: string;
  replaceLabel?: string;
  incrementalSearchLabel?: string;
  findInSelectionLabel?: string;
  replaceInSelectionLabel?: string;
  findInFilesLabel?: string;
  replaceInFilesLabel?: string;
  selectAllOccurrencesLabel?: string;
  selectNextOccurrenceLabel?: string;
  unselectPreviousOccurrenceLabel?: string;
  searchWebLabel?: string;
  gotoLineLabel?: string;
  goToDefinitionLabel?: string;
  goToImplementationLabel?: string;
  navigationBackLabel?: string;
  navigationForwardLabel?: string;
  sendHarnessReferenceLabel?: string;
}

/** One cache identity per loaded browser module instance. */
const SEARCH_SESSION_ID =
  typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `search-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
let activeSearchRevision = 0;

/** Publish the mounted editor's ignore/search revision to every file API call. */
export function setCurrentSearchRevision(value: unknown): void {
  activeSearchRevision = Math.max(0, Math.trunc(Number(value) || 0));
}

interface MonacoContextMenuContribution extends Monaco.editor.IEditorContribution {
  _getMenuActions?: (...args: unknown[]) => Array<{ id?: string }>;
}

interface MonacoViewportSemanticTokensContribution extends Monaco.editor.IEditorContribution {
  _tokenizeViewportNow?: () => void;
}

interface MonacoSemanticTokenizationState {
  forceTokenization?: (lineNumber: number) => void;
  hasSomeSemanticTokens?: () => boolean;
}

interface MonacoVisibleRanges {
  getVisibleRanges?: () => Monaco.Range[];
  getVisibleRangesPlusViewportAboveBelow?: () => Monaco.Range[];
}

interface WorkspaceTreeEntry {
  path?: string;
  kind?: string;
  [key: string]: unknown;
}

export interface WorkspaceGitStatus {
  root: string;
  isRepo?: boolean;
  branch: string;
  prefix: string;
  changes: DiffChange[];
  detached?: boolean;
  ahead?: number;
  behind?: number;
  operation?: string;
  lastCommit?: { hash?: string; subject?: string; body?: string } | null;
  created?: string;
  entries?: ShelfEntry[];
  patch?: string;
  hash?: string;
  subject?: string;
  published?: boolean;
  remotes?: unknown[];
  pushError?: string;
  appliedFiles?: unknown[];
  [key: string]: unknown;
}

export interface WorkspaceLogCommit {
  hash: string;
  parents: string[];
  refs: string[];
  subject: string;
  author: string;
  date: string;
  [key: string]: unknown;
}

export interface WorkspaceLogResponse {
  commits: WorkspaceLogCommit[];
}

export interface WorkspaceGraphResponse {
  entries?: NonNullable<CommitGraphPayload['entries']>;
  branches?: string[];
  tags?: string[];
  branchList?: string[];
  tagList?: CommitGraphPayload['tagList'];
  head?: unknown;
  branch?: unknown;
  at?: unknown;
}

export interface ChangeRowMenuPayload {
  change: DiffChange;
  staged?: boolean;
  selectedChanges?: Set<string>;
  x: number;
  y: number;
}

export interface ChangeDirectoryMenuPayload {
  directory: string;
  changes: DiffChange[];
  group: string;
  x: number;
  y: number;
}

export interface CommitFileMenuPayload {
  path: string;
  hash: string;
  localExists: boolean;
  localDirExists: boolean;
  x: number;
  y: number;
}

export interface SelectedPatch {
  patch: string;
  files?: unknown[];
}

export interface OpenWorkspaceFile {
  path: string;
  content: string;
  dirty: boolean;
  mtime: number | null;
  kind?: 'image';
  size?: number;
  mediaType?: string;
}

export type EditorWorkspaceTranslate = (key: string, params?: Record<string, unknown>) => string;

export interface EditorWorkspaceProps {
  t: EditorWorkspaceTranslate;
  workspaceId?: string;
  restoreToolWindowFocus?: boolean;
  focusRequest?: number;
  initialHarnessCollapsed?: boolean;
  onToggleHarness?: () => void;
  onCloseEditor?: () => void;
  onInsertHarnessReference?: (request: Record<string, unknown>) => Promise<boolean> | boolean;
}

interface DirectoryTreeState<T extends WorkspaceTreeEntry = WorkspaceTreeEntry> {
  expanded?: Set<string>;
  children?: Record<string, T[]>;
}

interface DirectoryTreeResult {
  expanded: Set<string>;
  children: Record<string, WorkspaceTreeEntry[]>;
  visited: number;
  truncated: boolean;
}

interface DirectoryPrefetchResult<T extends WorkspaceTreeEntry = WorkspaceTreeEntry> {
  children: Record<string, T[]>;
  visited: number;
  truncated: boolean;
}

interface RootLabel {
  name: string;
  path: string;
}

interface MonacoEditorGroup {
  editor: Monaco.editor.IStandaloneCodeEditor;
  dispose: () => void;
}

type MonacoApi = typeof Monaco;
type MonacoEditor = Monaco.editor.IStandaloneCodeEditor;
type MonacoTextModel = Monaco.editor.ITextModel;

export function translate(
  bind: (key: string) => string,
  dictionaries: { zh: LocaleDictionaryTree; en: LocaleDictionaryTree },
): (key: string, params?: Record<string, unknown>) => string {
  const zhFlat = flattenDictionary(dictionaries.zh);
  const enFlat = flattenDictionary(dictionaries.en);
  return (key, params) => {
    let text = bind(key);
    if (text === key) {
      const preferred = (navigator.language ?? '').toLowerCase().startsWith('zh') ? zhFlat : enFlat;
      text = preferred[key] ?? zhFlat[key] ?? enFlat[key] ?? key;
    }
    return interpolateMessage(text, params);
  };
}

/** Read the current Session id from the conversation body. */
export function currentSessionId(): string {
  const body = document.querySelector('[data-conversation-region="chat"]');
  return body?.getAttribute('data-conversation-session') ?? '';
}

/**
 * Read the workspace chosen by the Project/Commit entry point.
 *
 * The session body is absent or belongs to another workspace when the user
 * enters from a workspace `... → Editor` item before opening a conversation.
 * The Editor's own root carries that entry scope, so file and git requests
 * can stay bound to the clicked workspace instead of falling back to an
 * empty "Workspace" tree.
 * @returns {string} workspace id, or an empty string for session scope.
 */
export function currentEditorWorkspaceId(): string {
  const activeHost = document.querySelector(
    '[data-dsh-editor-host]:not([data-dsh-editor-host-idle]) [data-dsh-editor-workspace]',
  );
  const host = activeHost ?? document.querySelector('[data-dsh-editor-workspace]');
  return host?.getAttribute('data-dsh-workspace-id') ?? '';
}

/**
 * Read the exact live editor selection for Find/Replace in Files.
 *
 * The query is not trimmed: IDEA preserves selected whitespace and
 * multiline text in the content field. An empty/collapsed selection
 * returns an empty string so callers keep their existing query.
 * @param {object|null} editor - Monaco editor instance.
 * @returns {string} selected text, or an empty string.
 */
export function selectedEditorFindQuery(editor: Monaco.editor.ICodeEditor | null | undefined): string {
  const model = editor?.getModel?.() ?? null;
  const selection = editor?.getSelection?.() ?? null;
  if (model === null || selection === null || typeof selection.isEmpty !== 'function' || selection.isEmpty()) return '';
  return String(model.getValueInRange(selection) ?? '');
}

/**
 * Convert a Monaco editor's live selection into a Harness reference range.
 * @param {object|null} editor - Monaco editor instance.
 * @returns {{path: string, line: number, column: number, endLine: number|null, endColumn: number|null}|null} reference location.
 */
export function harnessEditorLocation(
  editor: Monaco.editor.ICodeEditor | null | undefined,
): HarnessEditorLocation | null {
  const model = editor?.getModel?.() ?? null;
  const path = navigationPathForModel(model);
  if (path === '') return null;
  const selection = editor?.getSelection?.() ?? null;
  const empty = selection === null || typeof selection.isEmpty !== 'function' || selection.isEmpty();
  if (empty === false) {
    let startLine = Math.max(1, Math.floor(Number(selection.startLineNumber) || 1));
    let startColumn = Math.max(1, Math.floor(Number(selection.startColumn) || 1));
    let endLine = Math.max(1, Math.floor(Number(selection.endLineNumber) || startLine));
    let endColumn = Math.max(1, Math.floor(Number(selection.endColumn) || startColumn));
    if (endLine < startLine || (endLine === startLine && endColumn < startColumn)) {
      [startLine, endLine] = [endLine, startLine];
      [startColumn, endColumn] = [endColumn, startColumn];
    }
    return { path, line: startLine, column: startColumn, endLine, endColumn };
  }
  const position = editor?.getPosition?.() ?? null;
  return {
    path,
    line: Math.max(1, Math.floor(Number(position?.lineNumber) || 1)),
    column: Math.max(1, Math.floor(Number(position?.column) || 1)),
    endLine: null,
    endColumn: null,
  };
}

/**
 * Stable key for terminal processes and terminal-only preferences.
 *
 * An Editor opened from a workspace row must not reuse the conversation
 * session's terminal pool: the visible chat may belong to another project.
 * The host derives the same `workspace:<id>` key for API calls.
 * @returns {string} workspace or session scope, or '' before either exists.
 */
export function currentTerminalScope(): string {
  const workspaceId = currentEditorWorkspaceId();
  if (workspaceId !== '') return `workspace:${workspaceId}`;
  return currentSessionId();
}

/**
 * The host may still be replacing an older workspace API registration while
 * the browser has already loaded a newer client. Recognize that narrow
 * response so text search can retry once instead of flashing raw host text.
 * @param {object|undefined} data - parsed host response.
 * @param {string} operation - requested operation.
 * @returns {boolean} whether the host explicitly rejected the operation.
 */
function fileApiMissingOperation(data: FileApiResult['data'], operation: string): boolean {
  const message = String(data?.error?.message ?? '');
  return (
    data?.ok === false && message.toLowerCase().includes('unknown operation') && message.includes(`"${operation}"`)
  );
}

/**
 * Hide the transitional host operation-table error behind a stable,
 * localized recovery message. Other search failures retain their detail.
 * @param {unknown} failure - rejected file API request.
 * @param {Function} t - locale translator.
 * @returns {string} user-facing search failure.
 */
export function searchTextFailureMessage(
  failure: unknown,
  t: (key: string, params?: Record<string, unknown>) => string,
): string {
  const message = failure instanceof Error ? failure.message : String(failure);
  if (/unknown operation\s+"searchText"/iu.test(message)) return t('editor.searchTextServiceUnavailable');
  if (
    /(?:index file (?:smaller than expected|corrupt)|unable to read .*(?:gitignore|exclude)|failed to read .*(?:gitignore|exclude)|stdout maxbuffer.*exceeded)/iu.test(
      message,
    )
  ) {
    const detail = message
      .replace(/^(?:fatal|error):\s*/iu, '')
      .replace(/\s+/gu, ' ')
      .trim()
      .slice(0, 240);
    return t('editor.searchGitIgnoreUnavailable', { message: detail });
  }
  const missingDirectory = message.match(/search directory does not exist:\s*(.+)$/iu);
  if (missingDirectory !== null) {
    return t('editor.findToolDirectoryMissing', { path: missingDirectory[1].trim() });
  }
  const invalidDirectory = message.match(/invalid search directory scope:\s*(.+)$/iu);
  return invalidDirectory === null
    ? message
    : t('editor.findToolDirectoryInvalid', { path: invalidDirectory[1].trim() });
}

/**
 * Post one workspace file API request with the active workspace identity.
 * @param {object} payload - operation-specific request body.
 * @param {{signal?: AbortSignal}} [options] - transport cancellation.
 * @returns {Promise<{response: Response, data: object}>} HTTP and JSON results.
 */
async function requestFileApi(
  payload: Record<string, unknown>,
  options: FileApiRequestOptions = {},
): Promise<FileApiResult> {
  const sessionId = currentSessionId();
  const workspaceId = currentEditorWorkspaceId();
  if (sessionId === '' && workspaceId === '') throw new Error('no active Session or workspace');
  const response = await fetch('api/dsh-editor/fs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      workspaceId,
      searchSessionId: SEARCH_SESSION_ID,
      searchRevision: activeSearchRevision,
      ...payload,
    }),
    signal: options.signal,
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

/**
 * Call the host workspace file API.
 * @param {object} payload - operation-specific request body.
 * @param {{signal?: AbortSignal}} [options] - transport cancellation.
 * @returns {Promise<object>} host operation value.
 */
export async function callFs<T = Record<string, unknown>>(
  payload: Record<string, unknown>,
  options: FileApiRequestOptions = {},
): Promise<T> {
  let { response, data } = await requestFileApi(payload, options);
  if (payload?.op === 'searchText' && fileApiMissingOperation(data, 'searchText')) {
    /* Host hot-reload can briefly expose an older operation table. One
           bounded retry avoids turning that transition into a user-visible
           Search Everywhere error. */
    await new Promise((resolve) => window.setTimeout(resolve, 60));
    ({ response, data } = await requestFileApi(payload, options));
  }
  if (!response.ok) throw new Error(`file API HTTP ${response.status}`);
  if (data?.ok !== true) throw new Error(data?.error?.message ?? 'file API failed');
  return data.value as T;
}

/**
 * List child directories for Harness's Web-only workspace chooser.
 * The host route is deliberately separate from the workspace-scoped file API.
 */
export async function callWorkspaceDirectoryPicker<T = Record<string, unknown>>(
  path: string | undefined,
  options: FileApiRequestOptions = {},
): Promise<T> {
  const response = await fetch('api/dsh-editor/workspace-directory', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: path ?? '' }),
    signal: options.signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`workspace directory API HTTP ${response.status}`);
  if (data?.ok !== true) throw new Error(data?.error?.message ?? 'workspace directory API failed');
  return data.value as T;
}

/** Call the host git API. */
export async function callGit<T = Record<string, unknown>>(
  payload: Record<string, unknown>,
  options: FileApiRequestOptions = {},
): Promise<T> {
  const sessionId = currentSessionId();
  const workspaceId = currentEditorWorkspaceId();
  if (sessionId === '' && workspaceId === '') throw new Error('no active Session or workspace');
  const controller = new AbortController();
  let timedOut = false;
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 20000);
  const abortExternal = () => controller.abort();
  if (options.signal?.aborted === true) controller.abort();
  else options.signal?.addEventListener('abort', abortExternal, { once: true });
  try {
    const response = await fetch('api/dsh-editor/git', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId, workspaceId, ...payload }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`git API HTTP ${response.status}`);
    const data = await response.json();
    if (data?.ok !== true) throw new Error(data?.error?.message ?? 'git API failed');
    return data.value as T;
  } catch (error) {
    if (timedOut) throw new Error('git request timed out after 20 seconds');
    throw error;
  } finally {
    window.clearTimeout(timer);
    options.signal?.removeEventListener('abort', abortExternal);
  }
}

/** Pick a Monaco theme from the page's color scheme. */
export function detectTheme(): 'vs-dark' | 'vs' {
  const root = document.documentElement;
  const explicit = root.dataset.theme ?? root.dataset.colorScheme ?? '';
  if (/dark/i.test(explicit)) return 'vs-dark';
  if (/light/i.test(explicit)) return 'vs';
  return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches === true ? 'vs-dark' : 'vs';
}

const registeredIdeaLightThemes = new WeakSet<object>();
const registeredIdeaLightSemanticLanguages = new WeakSet<object>();
const ideaLightSemanticCache = new WeakMap<
  Monaco.editor.ITextModel,
  { versionId: number; languageId: string; data: Uint32Array }
>();
const ideaLightRangeSemanticCache = new WeakMap<Monaco.editor.ITextModel, Map<string, Uint32Array>>();
const requestedSemanticModels = new WeakMap<MonacoEditor, MonacoTextModel>();
const pendingSemanticModels = new WeakMap<MonacoEditor, MonacoTextModel>();
const scheduledSemanticTokenFrames = new WeakMap<MonacoEditor, number>();
const IDEA_SEMANTIC_RANGE_CACHE_LIMIT = 12;
const SEMANTIC_TOKEN_REFRESH_FIRST_RETRY_MS = 16;
const SEMANTIC_TOKEN_REFRESH_RETRY_MS = 50;
const SEMANTIC_TOKEN_REFRESH_MAX_ATTEMPTS = 6;
const SEMANTIC_TOKEN_REFRESH_MIN_ATTEMPTS = 4;
const IDEA_SEMANTIC_LANGUAGE_IDS = [
  'typescript',
  'typescriptreact',
  'javascript',
  'javascriptreact',
  'python',
  'go',
  'rust',
  'java',
  'c',
  'cpp',
  'csharp',
  'php',
  'ruby',
  'kotlin',
  'swift',
  'dart',
  'lua',
  'r',
  'scala',
  'fsharp',
  'clojure',
  'elixir',
  'julia',
  'perl',
  'pascal',
  'protobuf',
  'solidity',
  'graphql',
  'shell',
  'bash',
  'sh',
] as const;

async function provideIdeaLightSemanticTokens(
  monaco: MonacoApi,
  model: Monaco.editor.ITextModel,
): Promise<{ data: Uint32Array }> {
  const languageId = model.getLanguageId();
  const cached = ideaLightSemanticCache.get(model);
  if (cached?.versionId === model.getVersionId() && cached.languageId === languageId) {
    return { data: cached.data };
  }
  const text = model.getValue();
  const tokens = collectIdeaLightHeuristicSemanticTokens(text, languageId);
  const data = encodeIdeaLightSemanticTokens(tokens);
  ideaLightSemanticCache.set(model, { versionId: model.getVersionId(), languageId, data });
  return { data };
}

function provideIdeaLightSemanticTokensForRange(
  monaco: MonacoApi,
  model: Monaco.editor.ITextModel,
  range: Monaco.Range,
): { data: Uint32Array } {
  const lineCount = Math.max(1, model.getLineCount());
  const requestedStartLine = Math.min(lineCount, Math.max(1, range.startLineNumber));
  const requestedEndLine = Math.min(lineCount, Math.max(requestedStartLine, range.endLineNumber));
  const semanticWindow = semanticTokenLineWindow(requestedStartLine, requestedEndLine, lineCount);
  const expandedStartLine = semanticWindow.startLine;
  const expandedEndLine = semanticWindow.endLine;
  const requestedStartCharacter = Math.max(0, range.startColumn - 1);
  const requestedEndCharacter = Math.max(0, range.endColumn - 1);
  const languageId = model.getLanguageId();
  const key = `${model.getVersionId()}:${languageId}:${expandedStartLine}:${expandedEndLine}:${requestedStartCharacter}:${requestedEndCharacter}`;
  const cached = ideaLightRangeSemanticCache.get(model)?.get(key);
  if (cached !== undefined) return { data: cached };

  const expandedRange = new monaco.Range(
    expandedStartLine,
    1,
    expandedEndLine,
    model.getLineMaxColumn(expandedEndLine),
  );
  const text = model.getValueInRange(expandedRange);
  const clipped = clipIdeaLightSemanticTokensToRange(
    collectIdeaLightHeuristicSemanticTokens(text, languageId),
    {
      startLine: requestedStartLine - 1,
      startCharacter: requestedStartCharacter,
      endLine: requestedEndLine - 1,
      endCharacter: requestedEndCharacter,
    },
    expandedStartLine - 1,
  );
  const data = encodeIdeaLightSemanticTokens(clipped);
  let cache = ideaLightRangeSemanticCache.get(model);
  if (cache === undefined) {
    cache = new Map();
    ideaLightRangeSemanticCache.set(model, cache);
  }
  if (cache.size >= IDEA_SEMANTIC_RANGE_CACHE_LIMIT) cache.clear();
  cache.set(key, data);
  return { data };
}

/**
 * Extend the requested viewport by one equivalent screen above and below.
 * Keeping the margin proportional to the visible span preserves the same
 * pre-tokenized runway on short and tall editor panes without unbounded work.
 */
export function semanticTokenLineWindow(
  startLine: number,
  endLine: number,
  lineCount: number,
): { startLine: number; endLine: number } {
  const total = Math.max(1, Math.floor(lineCount));
  const start = Math.min(total, Math.max(1, Math.floor(startLine)));
  const end = Math.min(total, Math.max(start, Math.floor(endLine)));
  const viewportLines = Math.max(1, end - start + 1);
  return {
    startLine: Math.max(1, start - viewportLines),
    endLine: Math.min(total, end + viewportLines),
  };
}

/**
 * Register IDEA Light semantic highlighting for JS/TS models.
 *
 * Monaco's stock TypeScript integration exposes diagnostics and navigation but
 * does not install semantic tokens. The worker still publishes encoded
 * classifications, so this provider maps those classes onto the shared light
 * palette and supplements the categories TypeScript omits.
 */
export function ensureIdeaLightSemanticTokens(monaco: MonacoApi): boolean {
  const languages = monaco.languages;
  if (
    registeredIdeaLightSemanticLanguages.has(monaco) ||
    typeof languages.registerDocumentSemanticTokensProvider !== 'function'
  ) {
    return registeredIdeaLightSemanticLanguages.has(monaco);
  }
  if (typeof languages.registerDocumentRangeSemanticTokensProvider === 'function') {
    const provider: Monaco.languages.DocumentRangeSemanticTokensProvider = {
      getLegend: () => IDEA_LIGHT_SEMANTIC_TOKEN_LEGEND,
      provideDocumentRangeSemanticTokens: (model, range, token) =>
        token.isCancellationRequested ? null : provideIdeaLightSemanticTokensForRange(monaco, model, range),
    };
    for (const language of IDEA_SEMANTIC_LANGUAGE_IDS) {
      languages.registerDocumentRangeSemanticTokensProvider({ language }, provider);
    }
  } else {
    const provider: Monaco.languages.DocumentSemanticTokensProvider = {
      getLegend: () => IDEA_LIGHT_SEMANTIC_TOKEN_LEGEND,
      provideDocumentSemanticTokens: (model, _lastResultId, token) =>
        token.isCancellationRequested ? null : provideIdeaLightSemanticTokens(monaco, model),
      releaseDocumentSemanticTokens: () => {},
    };
    for (const language of IDEA_SEMANTIC_LANGUAGE_IDS) {
      languages.registerDocumentSemanticTokensProvider({ language }, provider);
    }
  }
  registeredIdeaLightSemanticLanguages.add(monaco);
  return true;
}

/** Ask Monaco to resolve semantic tokens for the current visible ranges now. */
export function requestEditorSemanticTokens(editor: MonacoEditor | null | undefined): boolean {
  const contribution = editor?.getContribution?.('editor.contrib.viewportSemanticTokens') as
    | MonacoViewportSemanticTokensContribution
    | null
    | undefined;
  if (typeof contribution?._tokenizeViewportNow !== 'function') return false;
  contribution._tokenizeViewportNow();
  return true;
}

/**
 * Force Monaco to tokenize the visible lexical runway before semantic tokens.
 *
 * Monaco's semantic provider only supplies grammar classifications. Comments,
 * strings and keywords still depend on the model's lexical tokenization. A
 * hidden or freshly mounted editor can miss that first tokenization request,
 * leaving the viewport monochrome until the user scrolls.
 */
export function requestEditorLexicalTokens(editor: MonacoEditor | null | undefined): boolean {
  const model = editor?.getModel?.() ?? null;
  const tokenization = (model as (MonacoTextModel & { tokenization?: MonacoSemanticTokenizationState }) | null)
    ?.tokenization;
  const forceTokenization = tokenization?.forceTokenization?.bind(tokenization);
  if (model === null || typeof forceTokenization !== 'function') return false;

  const viewportEditor = editor as MonacoEditor & MonacoVisibleRanges;
  const viewportRunway = viewportEditor.getVisibleRangesPlusViewportAboveBelow?.() ?? [];
  const visibleRanges = viewportRunway.length > 0 ? viewportRunway : (viewportEditor.getVisibleRanges?.() ?? []);
  if (visibleRanges.length === 0) return false;

  let startLine = Number.POSITIVE_INFINITY;
  let endLine = 0;
  for (const range of visibleRanges) {
    startLine = Math.min(startLine, range.startLineNumber);
    endLine = Math.max(endLine, range.endLineNumber);
  }
  if (viewportRunway.length === 0) {
    const expanded = semanticTokenLineWindow(startLine, endLine, model.getLineCount());
    startLine = expanded.startLine;
    endLine = expanded.endLine;
  }
  forceTokenization(Math.max(1, Math.min(model.getLineCount(), endLine)));
  return true;
}

function modelHasSomeSemanticTokens(model: MonacoTextModel): boolean {
  const tokenization = (model as MonacoTextModel & { tokenization?: MonacoSemanticTokenizationState }).tokenization;
  return tokenization?.hasSomeSemanticTokens?.() === true;
}

/**
 * Refresh the visible semantic-token window once on the next paint.
 *
 * Monaco's stock viewport contribution debounces scroll-driven refresh by
 * 100ms. Coalescing one explicit request per paint removes the blank window
 * after a scroll without issuing a request for every scroll event.
 */
export function scheduleEditorSemanticTokens(editor: MonacoEditor | null | undefined): boolean {
  if (editor === null || editor === undefined || scheduledSemanticTokenFrames.has(editor)) return false;
  const requestFrame =
    typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame.bind(window)
      : (callback: () => void) => window.setTimeout(callback, 16);
  const frame = requestFrame(() => {
    scheduledSemanticTokenFrames.delete(editor);
    if (editor.getModel?.() === null || editor.getModel?.() === undefined) return;
    requestEditorLexicalTokens(editor);
    requestEditorSemanticTokens(editor);
  });
  scheduledSemanticTokenFrames.set(editor, frame);
  return true;
}

/** Cancel a pending scroll-driven semantic-token refresh during editor disposal. */
export function cancelScheduledEditorSemanticTokens(editor: MonacoEditor | null | undefined): void {
  if (editor === null || editor === undefined) return;
  const frame = scheduledSemanticTokenFrames.get(editor);
  if (frame === undefined) return;
  if (typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(frame);
  else window.clearTimeout(frame);
  scheduledSemanticTokenFrames.delete(editor);
}

/**
 * Re-run semantic tokenization after a model becomes visible.
 *
 * Monaco normally schedules this from its own model-change event, but the lazy
 * language contribution and editor mount can consume that first request. One
 * guarded retry prevents a new file from staying uncolored until the user
 * scrolls.
 */
export function requestEditorSemanticTokensWhenReady(
  editor: MonacoEditor | null | undefined,
  model: MonacoTextModel | null | undefined,
): void {
  if (editor === null || editor === undefined || model === null || model === undefined) return;
  const hasSharedSemanticProvider = IDEA_SEMANTIC_LANGUAGE_IDS.includes(
    model.getLanguageId() as (typeof IDEA_SEMANTIC_LANGUAGE_IDS)[number],
  );
  if (!hasSharedSemanticProvider) {
    requestEditorLexicalTokens(editor);
    return;
  }
  if (requestedSemanticModels.get(editor) === model || pendingSemanticModels.get(editor) === model) {
    requestEditorLexicalTokens(editor);
    return;
  }

  pendingSemanticModels.set(editor, model);
  let attempts = 0;
  const finish = (): void => {
    if (pendingSemanticModels.get(editor) === model) pendingSemanticModels.delete(editor);
    requestedSemanticModels.set(editor, model);
  };
  const attempt = (): void => {
    if (editor.getModel?.() !== model) {
      if (pendingSemanticModels.get(editor) === model) pendingSemanticModels.delete(editor);
      return;
    }
    requestEditorLexicalTokens(editor);
    requestEditorSemanticTokens(editor);
    attempts += 1;
    if (attempts >= SEMANTIC_TOKEN_REFRESH_MAX_ATTEMPTS) {
      finish();
      return;
    }
    window.setTimeout(
      () => {
        if (editor.getModel?.() !== model) {
          if (pendingSemanticModels.get(editor) === model) pendingSemanticModels.delete(editor);
          return;
        }
        if (attempts >= SEMANTIC_TOKEN_REFRESH_MIN_ATTEMPTS && modelHasSomeSemanticTokens(model)) {
          finish();
          return;
        }
        attempt();
      },
      attempts === 1 ? SEMANTIC_TOKEN_REFRESH_FIRST_RETRY_MS : SEMANTIC_TOKEN_REFRESH_RETRY_MS,
    );
  };
  attempt();
}

/**
 * Return the Monaco theme for the current IDE surface. Dark mode keeps the
 * existing `vs-dark` palette; light mode installs the IDEA Light recipe once.
 */
export function ensureEditorTheme(monaco: MonacoApi): string {
  if (detectTheme() === 'vs-dark') return 'vs-dark';
  if (!registeredIdeaLightThemes.has(monaco)) {
    monaco.editor.defineTheme(IDEA_LIGHT_THEME_ID, {
      base: 'vs',
      inherit: true,
      rules: ideaLightTokenRules(),
      colors: {
        'editor.foreground': '#000000',
        'editor.background': EDITOR_SURFACE_BACKGROUNDS.light.code,
      },
    });
    registeredIdeaLightThemes.add(monaco);
  }
  ensureIdeaLightSemanticTokens(monaco);
  return IDEA_LIGHT_THEME_ID;
}

/** Monotonic id source for per-editor Monaco context-key scopes. */
let codeEditorGroupSequence = 0;

/**
 * Remove selected built-in actions from Monaco's editor context menu.
 *
 * Monaco does not expose the menu registry it uses for built-in actions.
 * Its ContextMenuController owns the final action list, so wrap that one
 * seam and restore it when this editor group is disposed.
 * @param {object} editor - Monaco standalone editor.
 * @param {string[]} hiddenActionIds - action ids that must not be rendered.
 * @returns {Function} restores the previous menu action resolver.
 */
function filterMonacoContextMenuActions(editor: MonacoEditor, hiddenActionIds: string[]): () => void {
  const hidden = new Set(hiddenActionIds);
  const controller = editor?.getContribution?.('editor.contrib.contextmenu') as
    | MonacoContextMenuContribution
    | null
    | undefined;
  const original = controller?._getMenuActions;
  if (typeof original !== 'function') return () => {};
  const filtered = function (this: unknown, ...args: unknown[]): Array<{ id?: string }> {
    const menuActions = original.apply(this, args) as Array<{ id?: string }>;
    return menuActions.filter((action): boolean => {
      const id = String(action?.id ?? '');
      for (const hiddenId of hidden) {
        if (id === hiddenId || id.endsWith(`:${hiddenId}`)) return false;
      }
      return true;
    });
  };
  controller._getMenuActions = filtered;
  return () => {
    if (controller._getMenuActions === filtered) controller._getMenuActions = original;
  };
}

/**
 * Create one independent Monaco editor group.
 *
 * The group owns only its editor instance and local actions. Models stay in
 * the workspace-wide model map so future split groups can share them without
 * one pane disposing another pane's document.
 * @param {object} monaco - Monaco global namespace.
 * @param {HTMLElement} container - host element.
 * @param {{onSave?: Function, onFind?: Function, onSearchText?: Function, onFindUsages?: Function, onFindUsagesInFile?: Function, onFindInFiles?: Function, onReplaceInFiles?: Function, onReplace?: Function, onIncrementalSearch?: Function, onFindInSelection?: Function, onReplaceInSelection?: Function, textSearchLabel?: string, findUsagesLabel?: string, findUsagesInFileLabel?: string, highlightUsagesInFileLabel?: string, findWordAtCaretLabel?: string, previousWordOccurrenceLabel?: string, replaceLabel?: string, incrementalSearchLabel?: string, findInSelectionLabel?: string, replaceInSelectionLabel?: string, findInFilesLabel?: string, replaceInFilesLabel?: string, selectAllOccurrencesLabel?: string, selectNextOccurrenceLabel?: string, unselectPreviousOccurrenceLabel?: string, searchWebLabel?: string, onSaveAll?: Function, onGotoLine?: Function, gotoLineLabel?: string, onGoToDefinition?: Function, goToDefinitionLabel?: string, onNavigateBack?: Function, onNavigateForward?: Function, navigationBackLabel?: string, navigationForwardLabel?: string, onCloseTab?: Function}} handlers - shortcut actions.
 * @returns {{editor: object, dispose: Function}} editor group controller.
 */
export function createCodeEditorGroup(
  monaco: MonacoApi,
  container: HTMLElement,
  handlers: EditorActionHandlers,
): MonacoEditorGroup {
  const actionsHandlers: EditorActionHandlers = handlers;
  const groupId = ++codeEditorGroupSequence;
  const findUsagesPrecondition = `dshEditorFindUsagesAvailable${groupId}`;
  const findSelectionPrecondition = `dshEditorFindSelectionAvailable${groupId}`;
  const platform = navigator.userAgentData?.platform ?? navigator.platform;
  const macPlatform = isMacPlatform(platform);
  const ideaControlModifier = ideaControlKeyModifier(monaco, platform);
  const findUsagesInFileKeybindings = [
    monaco.KeyMod.CtrlCmd | monaco.KeyCode.F7,
    ...(macPlatform ? [ideaControlModifier | monaco.KeyMod.Shift | monaco.KeyCode.KeyU] : []),
  ];
  const highlightUsagesInFileKeybindings = [
    monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.F7,
    ...(macPlatform ? [monaco.KeyMod.CtrlCmd | ideaControlModifier | monaco.KeyCode.KeyU] : []),
  ];
  const editor = monaco.editor.create(container, {
    value: '',
    language: 'plaintext',
    theme: ensureEditorTheme(monaco),
    automaticLayout: true,
    fontSize: EDITOR_CODE_FONT_SIZE,
    lineHeight: EDITOR_CODE_LINE_HEIGHT,
    lineNumbersMinChars: EDITOR_GUTTER_LAYOUT.lineNumbersMinChars,
    lineDecorationsWidth: EDITOR_GUTTER_LAYOUT.lineDecorationsWidth,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    wordWrap: 'off',
    'semanticHighlighting.enabled': true,
    tabSize: 2,
    renderWhitespace: 'selection',
    /* The tool window owns find/replace, so Monaco's own widget stays closed. */
    find: { addExtraSpaceOnTop: false, autoFindInSelection: 'never', seedSearchStringFromSelection: 'never' },
    fontFamily: EDITOR_UI_FONT,
  });
  const findUsagesContextKey = editor.createContextKey<boolean>(findUsagesPrecondition, false);
  const findSelectionContextKey = editor.createContextKey<boolean>(findSelectionPrecondition, false);
  const restoreContextMenuActions = filterMonacoContextMenuActions(editor, ['editor.action.quickCommand']);
  const definitionHoverDecorations = editor.createDecorationsCollection?.([]) ?? null;
  let definitionHoverPosition: Monaco.Position | null = null;
  let definitionHoverKey = '';
  const clearDefinitionHover = (): void => {
    definitionHoverKey = '';
    definitionHoverDecorations?.clear?.();
  };
  const paintDefinitionHover = (position: Monaco.Position | null, modifier: boolean): void => {
    if (modifier !== true || position === null) {
      clearDefinitionHover();
      return;
    }
    const model = editor.getModel();
    const word = model?.getWordAtPosition?.(position) ?? null;
    if (word === null || word.word.trim() === '' || /^\d+$/u.test(word.word)) {
      clearDefinitionHover();
      return;
    }
    const key = `${position.lineNumber}:${word.startColumn}:${word.endColumn}:${word.word}`;
    if (key === definitionHoverKey) return;
    definitionHoverKey = key;
    definitionHoverDecorations?.set?.([
      {
        range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn + 1),
        options: {
          inlineClassName: 'dsh-editor-definition-link',
        },
      },
    ]);
  };
  const refreshDefinitionHover = (modifier: boolean): void => {
    paintDefinitionHover(definitionHoverPosition, modifier);
  };
  const definitionHoverSubscription = editor.onMouseMove?.((event) => {
    const browserEvent = event?.event?.browserEvent ?? null;
    definitionHoverPosition = event?.target?.position ?? null;
    paintDefinitionHover(definitionHoverPosition, browserEvent?.metaKey === true || browserEvent?.ctrlKey === true);
  });
  const onDefinitionModifierKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Meta' || event.key === 'Control') refreshDefinitionHover(true);
  };
  const onDefinitionModifierKeyUp = (event: KeyboardEvent): void => {
    if (event.key === 'Meta' || event.key === 'Control') refreshDefinitionHover(false);
  };
  const onDefinitionHoverWindowBlur = (): void => clearDefinitionHover();
  const definitionHoverWindow = typeof window === 'undefined' ? null : window;
  definitionHoverWindow?.addEventListener('keydown', onDefinitionModifierKeyDown, true);
  definitionHoverWindow?.addEventListener('keyup', onDefinitionModifierKeyUp, true);
  definitionHoverWindow?.addEventListener('blur', onDefinitionHoverWindowBlur);
  const definitionHoverContainer = typeof container.addEventListener === 'function' ? container : null;
  definitionHoverContainer?.addEventListener('mouseleave', clearDefinitionHover);
  const updateFindUsagesAvailability = () => {
    const queryAvailable = findUsagesSearchTarget(editor).query !== '';
    findUsagesContextKey?.set(queryAvailable);
    findSelectionContextKey?.set(queryAvailable && editorFindSelectionScope(editor) !== null);
  };
  const runSearchCommand = (command: string): void => {
    const action = editor.getAction?.(command) ?? null;
    if (action === null) return;
    void Promise.resolve(action.run?.()).finally(() => editor.focus?.());
  };
  const actions = [
    editor.addAction({
      id: 'dsh-editor.save',
      label: 'Save file',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => actionsHandlers.onSave?.(),
    }),
    editor.addAction({
      id: `dsh-editor.sendHarnessReference.${groupId}`,
      label: actionsHandlers.sendHarnessReferenceLabel ?? 'Harness->',
      /* Monaco always orders its navigation group first. A lower order
             inside that group keeps this high-frequency action above Go to
             Declaration and the language-service entries. */
      contextMenuGroupId: 'navigation',
      contextMenuOrder: -100,
      run: (editorInstance) => actionsHandlers.onSendHarnessReference?.(editorInstance),
    }),
    editor.addAction({
      id: 'dsh-editor.find',
      label: 'Find',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF],
      run: () => actionsHandlers.onFind?.(),
    }),
    editor.addAction({
      id: 'dsh-editor.textSearch',
      label: actionsHandlers.textSearchLabel ?? 'Text…',
      keybindings: [ideaControlModifier | monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyE],
      run: () => actionsHandlers.onSearchText?.(),
    }),
    editor.addAction({
      id: 'dsh-editor.saveAll',
      label: 'Save All',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyS],
      run: () => actionsHandlers.onSaveAll?.(),
    }),
    editor.addAction({
      id: 'dsh-editor.gotoLine',
      label: actionsHandlers.gotoLineLabel ?? 'Go to Line/Column',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL],
      run: () => actionsHandlers.onGotoLine?.(),
    }),
    editor.addAction({
      id: 'dsh-editor.goToDefinition',
      label: actionsHandlers.goToDefinitionLabel ?? 'Go to Declaration',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.F12, monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB],
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.0,
      run: (editorInstance) => {
        const position = editorInstance.getPosition?.() ?? null;
        if (position !== null) void actionsHandlers.onGoToDefinition?.(editorInstance, position);
      },
    }),
    editor.addAction({
      id: 'dsh-editor.goToImplementation',
      label: actionsHandlers.goToImplementationLabel ?? 'Go to Implementation',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyB],
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.1,
      run: (editorInstance) => {
        const position = editorInstance.getPosition?.() ?? null;
        if (position !== null) void actionsHandlers.onGoToImplementation?.(editorInstance, position);
      },
    }),
    editor.addAction({
      id: 'dsh-editor.navigateBack',
      label: actionsHandlers.navigationBackLabel ?? 'Back',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.BracketLeft],
      run: () => actionsHandlers.onNavigateBack?.(),
    }),
    editor.addAction({
      id: 'dsh-editor.navigateForward',
      label: actionsHandlers.navigationForwardLabel ?? 'Forward',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.BracketRight],
      run: () => actionsHandlers.onNavigateForward?.(),
    }),
    editor.addAction({
      id: `dsh-editor.findUsages.${groupId}`,
      label: actionsHandlers.findUsagesLabel ?? 'Find Usages',
      precondition: findUsagesPrecondition,
      run: () => actionsHandlers.onFindUsages?.(editor),
    }),
    editor.addAction({
      id: `dsh-editor.selectAllOccurrences.${groupId}`,
      label: actionsHandlers.selectAllOccurrencesLabel ?? 'Select All Occurrences',
      precondition: findUsagesPrecondition,
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.2,
      run: () => runSearchCommand('editor.action.selectHighlights'),
    }),
    editor.addAction({
      id: `dsh-editor.selectNextOccurrence.${groupId}`,
      label: actionsHandlers.selectNextOccurrenceLabel ?? 'Add Selection for Next Occurrence',
      precondition: findUsagesPrecondition,
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.3,
      run: () => runSearchCommand('editor.action.addSelectionToNextFindMatch'),
    }),
    editor.addAction({
      id: `dsh-editor.unselectPreviousOccurrence.${groupId}`,
      label: actionsHandlers.unselectPreviousOccurrenceLabel ?? 'Unselect Occurrence',
      precondition: findUsagesPrecondition,
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.4,
      run: () => runSearchCommand('cursorUndo'),
    }),
    editor.addAction({
      id: `dsh-editor.searchWeb.${groupId}`,
      label: actionsHandlers.searchWebLabel ?? 'Browser Search',
      precondition: findUsagesPrecondition,
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      run: () => {
        const query = findUsagesSearchTarget(editor).query;
        if (query === '') return;
        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer');
      },
    }),
    editor.addAction({
      id: `dsh-editor.findInFiles.${groupId}`,
      label: actionsHandlers.findInFilesLabel ?? 'Find in Files…',
      precondition: findUsagesPrecondition,
      run: () => actionsHandlers.onFindInFiles?.(editor),
    }),
    editor.addAction({
      id: `dsh-editor.replaceInFiles.${groupId}`,
      label: actionsHandlers.replaceInFilesLabel ?? 'Replace in Files…',
      precondition: findUsagesPrecondition,
      run: () => actionsHandlers.onReplaceInFiles?.(editor),
    }),
    editor.addAction({
      id: `dsh-editor.findUsagesInFile.${groupId}`,
      label: actionsHandlers.findUsagesInFileLabel ?? 'Find Usages in File',
      keybindings: findUsagesInFileKeybindings,
      precondition: findUsagesPrecondition,
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.8,
      run: () => actionsHandlers.onFindUsagesInFile?.(editor),
    }),
    editor.addAction({
      id: `dsh-editor.highlightUsagesInFile.${groupId}`,
      label: actionsHandlers.highlightUsagesInFileLabel ?? 'Highlight Usages in File',
      keybindings: highlightUsagesInFileKeybindings,
      precondition: findUsagesPrecondition,
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.9,
      run: () => runSearchCommand('editor.action.wordHighlight.trigger'),
    }),
    editor.addAction({
      id: `dsh-editor.findWordAtCaret.${groupId}`,
      label: actionsHandlers.findWordAtCaretLabel ?? 'Next Occurrence of the Word at Caret',
      keybindings: [ideaControlModifier | monaco.KeyCode.F3],
      precondition: findUsagesPrecondition,
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 2.0,
      run: () => runSearchCommand('editor.action.nextSelectionMatchFindAction'),
    }),
    editor.addAction({
      id: `dsh-editor.previousWordOccurrence.${groupId}`,
      label: actionsHandlers.previousWordOccurrenceLabel ?? 'Previous Occurrence of the Word at Caret',
      keybindings: [ideaControlModifier | monaco.KeyMod.Shift | monaco.KeyCode.F3],
      precondition: findUsagesPrecondition,
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 2.1,
      run: () => runSearchCommand('editor.action.previousSelectionMatchFindAction'),
    }),
    editor.addAction({
      id: `dsh-editor.replace.${groupId}`,
      label: actionsHandlers.replaceLabel ?? 'Replace…',
      precondition: findUsagesPrecondition,
      run: () => actionsHandlers.onReplace?.(editor),
    }),
    editor.addAction({
      id: `dsh-editor.incrementalSearch.${groupId}`,
      label: actionsHandlers.incrementalSearchLabel ?? 'Incremental Search',
      precondition: findUsagesPrecondition,
      run: () => actionsHandlers.onIncrementalSearch?.(editor),
    }),
    editor.addAction({
      id: `dsh-editor.findInSelection.${groupId}`,
      label: actionsHandlers.findInSelectionLabel ?? 'Search in Selection Only',
      precondition: findSelectionPrecondition,
      run: () => actionsHandlers.onFindInSelection?.(editor),
    }),
    editor.addAction({
      id: `dsh-editor.replaceInSelection.${groupId}`,
      label: actionsHandlers.replaceInSelectionLabel ?? 'Replace in Selection Only',
      precondition: findSelectionPrecondition,
      run: () => actionsHandlers.onReplaceInSelection?.(editor),
    }),
    editor.addAction({
      id: 'dsh-editor.closeTab',
      label: 'Close Tab',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW],
      run: () => actionsHandlers.onCloseTab?.(),
    }),
  ];
  const availabilitySubscriptions = [
    editor.onDidChangeCursorSelection?.(updateFindUsagesAvailability),
    editor.onDidChangeModel?.(() => {
      clearDefinitionHover();
      updateFindUsagesAvailability();
    }),
    editor.onDidScrollChange?.(() => {
      clearDefinitionHover();
      scheduleEditorSemanticTokens(editor);
    }),
  ];
  const definitionClickSubscription = editor.onMouseDown?.((event) => {
    const browserEvent = event?.event?.browserEvent ?? null;
    if (browserEvent?.metaKey !== true && browserEvent?.ctrlKey !== true) return;
    const position = event?.target?.position ?? null;
    if (position === null) return;
    event.event?.preventDefault?.();
    void actionsHandlers.onGoToDefinition?.(editor, position);
  });
  updateFindUsagesAvailability();
  let disposed = false;
  return {
    editor,
    dispose() {
      if (disposed) return;
      disposed = true;
      restoreContextMenuActions();
      clearDefinitionHover();
      definitionHoverSubscription?.dispose?.();
      definitionHoverWindow?.removeEventListener('keydown', onDefinitionModifierKeyDown, true);
      definitionHoverWindow?.removeEventListener('keyup', onDefinitionModifierKeyUp, true);
      definitionHoverWindow?.removeEventListener('blur', onDefinitionHoverWindowBlur);
      definitionHoverContainer?.removeEventListener('mouseleave', clearDefinitionHover);
      for (const subscription of availabilitySubscriptions) subscription?.dispose?.();
      definitionClickSubscription?.dispose?.();
      cancelScheduledEditorSemanticTokens(editor);
      for (const action of actions) action.dispose?.();
      editor.dispose();
    },
  };
}

/**
 * Reuse one workspace model for every editor group showing a path.
 * @param {object} monaco - Monaco global namespace.
 * @param {Map<string, object>} models - workspace-wide model registry.
 * @param {string} path - workspace-relative path.
 * @param {string} content - initial content when the model must be created.
 * @returns {object} Monaco text model.
 */
export function ensureEditorModel(
  monaco: MonacoApi,
  models: Map<string, MonacoTextModel>,
  path: string,
  content: string,
): MonacoTextModel {
  const existing = models.get(path);
  if (existing !== undefined) return existing;
  const uri = monaco.Uri.parse(`file:///${path.split('/').map(encodeURIComponent).join('/')}`);
  const model = monaco.editor.createModel(content, safeLanguage(monaco, path), uri);
  models.set(path, model);
  /* Reassert shared defaults when a new TS/TSX model appears; this also
     repairs a worker initialized before the lazy language contribution. */
  if (/\.[cm]?tsx?$/iu.test(path)) void configureMonacoLanguageWhenReady(monaco);
  return model;
}

/**
 * Register the diff-only Monaco theme.
 *
 * Monaco draws line and character diff highlights on canvas, so CSS cannot give
 * them IDEA's stronger green/red treatment. A diff-scoped theme keeps the host's
 * syntax palette while setting only the comparison colors and gutter fills.
 * @param {object} monaco - Monaco global namespace.
 * @returns {string} registered theme name.
 */
export function ensureDiffTheme(monaco: MonacoApi): string {
  const base = detectTheme();
  const id = base === 'vs-dark' ? 'dsh-editor-diff-dark' : 'dsh-editor-diff-light';
  if (base !== 'vs-dark') ensureIdeaLightSemanticTokens(monaco);
  monaco.editor.defineTheme(id, {
    base,
    inherit: true,
    rules: base === 'vs' ? ideaLightTokenRules() : [],
    colors:
      base === 'vs-dark'
        ? {
            'diffEditor.insertedLineBackground': '#1f6f3b38',
            'diffEditor.removedLineBackground': '#8b2f3438',
            'diffEditor.insertedTextBackground': '#2ea04355',
            'diffEditor.removedTextBackground': '#f8514955',
            'diffEditorGutter.insertedLineBackground': '#1f6f3b2e',
            'diffEditorGutter.removedLineBackground': '#8b2f342e',
            'diffEditorOverview.insertedForeground': '#3fb95088',
            'diffEditorOverview.removedForeground': '#f8514988',
          }
        : {
            'diffEditor.insertedLineBackground': '#1a7f3714',
            'diffEditor.removedLineBackground': '#cf222e14',
            'diffEditor.insertedTextBackground': '#1a7f3738',
            'diffEditor.removedTextBackground': '#cf222e38',
            'diffEditorGutter.insertedLineBackground': '#1a7f3724',
            'diffEditorGutter.removedLineBackground': '#cf222e24',
            'diffEditorOverview.insertedForeground': '#1a7f3777',
            'diffEditorOverview.removedForeground': '#cf222e77',
          },
  });
  return id;
}

/**
 * The parent directory of a change, printed the way IDEA prints it.
 *
 * A trailing `/` is what tells the row `r147nest/deep/inner/` is a DIRECTORY
 * and not a second file name; without it `note.md  spark` reads like two
 * files on one row. Root-level files return `''` and the caller substitutes
 * the project name (IDEA shows the module there).
 * @param {string} path - workspace-relative path.
 * @returns {string} the parent path with a trailing slash, or ''.
 */
export function parentDirLabel(path: string): string {
  const parent = dirname(path);
  return parent === '' ? '' : `${parent}/`;
}

/** Basename of a workspace-relative path. */
export function basename(path: string): string {
  const index = path.lastIndexOf('/');
  return index < 0 ? path : path.slice(index + 1);
}

/** Parent directory of a workspace-relative path. */
/**
 * Every ancestor directory of one relative path, outermost first.
 * @param {string} path - workspace-relative path.
 * @returns {string[]} ancestor directories, excluding the path itself.
 */
export function ancestorsOf(path: string): string[] {
  if (typeof path !== 'string' || path === '') return [];
  const parts = path.split('/');
  const ancestors = [];
  for (let index = 1; index < parts.length; index += 1) ancestors.push(parts.slice(0, index).join('/'));
  return ancestors;
}

/** Project 首次打开与目录点击默认预取的目录层数。 */
export const PROJECT_PREFETCH_DEPTH = 1;
/** 单次预取最多读取的目录数，防止异常宽树拖垮 UI。 */
export const PROJECT_PREFETCH_VISIT_LIMIT = 200;

/**
 * 按可选深度递归展开目录路径，使用 IDEA 风格的有界 BFS。
 *
 * 调用方提供当前 children 缓存和目录读取器。`maxDepth` 从起点算第 1 层；
 * Infinity 保留 Expand Selected / Expand All 的完整递归语义。
 * @param {string[]} startPaths - 要展开的 workspace 相对目录。
 * @param {{expanded?: Set<string>, children?: Record<string, object[]>}} current - 当前树缓存。
 * @param {(path: string) => Promise<object[]>} listDirectory - 读取一个目录。
 * @param {number} [limit=200] - 单次最多读取的目录数。
 * @param {number} [maxDepth=Infinity] - 最多展开的目录层数。
 * @returns {Promise<{expanded: Set<string>, children: Record<string, object[]>, visited: number, truncated: boolean}>} 更新后的缓存。
 */
export async function expandDirectorySubtrees(
  startPaths: string[],
  current: DirectoryTreeState,
  listDirectory: (path: string) => Promise<WorkspaceTreeEntry[]>,
  limit = 200,
  maxDepth = Infinity,
): Promise<DirectoryTreeResult> {
  const expanded = new Set(current?.expanded instanceof Set ? current.expanded : []);
  const children = { ...(current?.children ?? {}) };
  const depthLimit = Number.isFinite(maxDepth) ? Math.max(1, Math.floor(Number(maxDepth) || 1)) : Infinity;
  const queue = [
    ...new Set((Array.isArray(startPaths) ? startPaths : []).filter((path) => typeof path === 'string')),
  ].map((path) => ({ path, depth: 1 }));
  const seen = new Set();
  let visited = 0;
  while (queue.length > 0 && visited < limit) {
    const item = queue.shift();
    const path = item.path;
    if (seen.has(path)) continue;
    seen.add(path);
    let rows = children[path];
    if (!Array.isArray(rows)) {
      try {
        rows = await listDirectory(path);
      } catch {
        continue;
      }
      children[path] = rows;
    }
    expanded.add(path);
    for (const child of rows) {
      if (child?.kind === 'directory' && typeof child.path === 'string' && item.depth < depthLimit) {
        queue.push({ path: child.path, depth: item.depth + 1 });
      }
    }
    visited += 1;
  }
  return {
    expanded,
    children,
    visited,
    truncated: queue.some((item) => !seen.has(item.path)),
  };
}

/**
 * 预取目录节点信息，但不改变 UI 的展开集合。
 *
 * 起点按第 1 层计算，默认只读取起点本身。调用方点击某目录时
 * 可以显式把该 clicked path 加入 expanded，后代保持折叠。
 * @param {string[]} startPaths - 需要预取的目录。
 * @param {{children?: Record<string, object[]>}} current - 当前 children 缓存。
 * @param {(path: string) => Promise<object[]>} listDirectory - 目录读取器。
 * @param {number} [limit=200] - 单次最多读取的目录数。
 * @param {number} [maxDepth=1] - 最多预取的目录层数。
 * @returns {Promise<{children: Record<string, object[]>, visited: number, truncated: boolean}>} 预取结果。
 */
export async function prefetchDirectorySubtrees<T extends WorkspaceTreeEntry = WorkspaceTreeEntry>(
  startPaths: string[],
  current: DirectoryTreeState<T>,
  listDirectory: (path: string) => Promise<T[]>,
  limit = 200,
  maxDepth = 1,
): Promise<DirectoryPrefetchResult<T>> {
  const children: Record<string, T[]> = { ...(current?.children ?? {}) };
  const depthLimit = Math.max(1, Math.floor(Number(maxDepth) || 1));
  const queue = [
    ...new Set((Array.isArray(startPaths) ? startPaths : []).filter((path) => typeof path === 'string')),
  ].map((path) => ({ path, depth: 1 }));
  const seen = new Set();
  let visited = 0;
  while (queue.length > 0 && visited < limit) {
    const item = queue.shift();
    if (seen.has(item.path)) continue;
    seen.add(item.path);
    let rows = children[item.path];
    if (!Array.isArray(rows)) {
      try {
        rows = await listDirectory(item.path);
      } catch {
        continue;
      }
      children[item.path] = rows;
    }
    for (const child of rows) {
      if (child?.kind === 'directory' && typeof child.path === 'string' && item.depth < depthLimit) {
        queue.push({ path: child.path, depth: item.depth + 1 });
      }
    }
    visited += 1;
  }
  return {
    children,
    visited,
    truncated: queue.some((item) => !seen.has(item.path)),
  };
}

/**
 * Follow a file or directory rename without changing path segments below it.
 *
 * @param {string} path - workspace-relative path currently held by editor state.
 * @param {Array<[string, string]>} entries - old/new roots in operation order.
 * @returns {string} the mapped path, or the original value.
 */
export function remapPathAfterMove(path: string, entries: Array<[string, string]>): string {
  if (typeof path !== 'string') return path;
  for (const entry of Array.isArray(entries) ? entries : []) {
    const [from, to] = Array.isArray(entry) ? entry : [];
    if (typeof from !== 'string' || from === '' || typeof to !== 'string' || to === '') continue;
    if (path === from) return to;
    if (path.startsWith(`${from}/`)) return `${to}${path.slice(from.length)}`;
  }
  return path;
}

/** Abbreviate a home-prefixed absolute path. */
/**
 * Split the project root row into the folder NAME and the path beside it.
 *
 * A narrow tool window cannot show both: the path (`~/Documents/project/doc`)
 * used to win and the folder name — the only part that identifies the project
 * — collapsed to an ellipsis. IDEA keeps the name and shortens the path.
 * @param {string} root - absolute workspace root.
 * @param {string} home - the user's home directory, for the `~` form.
 * @returns {{name: string, path: string}} the label parts.
 */
export function splitRootLabel(root: string, home: string): RootLabel {
  const absolute = typeof root === 'string' ? root : '';
  const trimmed = absolute.length > 1 && absolute.endsWith('/') ? absolute.slice(0, -1) : absolute;
  const name = trimmed === '' ? '' : trimmed.slice(trimmed.lastIndexOf('/') + 1);
  return { name, path: abbreviatePath(absolute, home) };
}

function abbreviatePath(path: string, home: string): string {
  if (!path) return '';
  if (home && path === home) return '~';
  if (home && path.startsWith(`${home}/`)) return `~${path.slice(home.length)}`;
  return path;
}

/** Return a language id only when Monaco knows it. */
export function safeLanguage(monaco: MonacoApi, path: string): string {
  const language = languageFor(path);
  return monaco.languages.getLanguages().some((entry) => entry.id === language) ? language : 'plaintext';
}

/**
 * Stable local-time filename for a downloaded change patch.
 *
 * @param {Date} [date=new Date()] - timestamp to encode.
 * @returns {string} filesystem-safe `.patch` filename.
 */
export function patchDownloadName(date = new Date()): string {
  const value = date instanceof Date ? date : new Date();
  const pad = (part: number): string => String(part).padStart(2, '0');
  return `dsh-editor-changes-${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}-${pad(value.getHours())}${pad(value.getMinutes())}${pad(value.getSeconds())}.patch`;
}

/**
 * Stable, filesystem-safe filename for one commit's exported patch.
 *
 * A short hash guarantees distinct commits cannot silently overwrite the
 * same download. The subject is only a readable suffix: controls and
 * reserved path characters become hyphens, whitespace collapses, and the
 * suffix is bounded so CJK subjects still fit common filename limits.
 *
 * @param {string} hash - resolved commit hash.
 * @param {string} subject - commit subject.
 * @returns {string} filesystem-safe `.patch` filename.
 */
export function commitPatchDownloadName(hash: string, subject: string): string {
  const shortHash =
    String(hash ?? '')
      .trim()
      .slice(0, 7)
      .replace(/[^0-9a-z]/giu, '') || 'unknown';
  const safeSubject = String(subject ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f<>:"\/\\|?*]+/gu, '-')
    .replace(/\s+/gu, '-')
    .replace(/-+/gu, '-')
    .replace(/^[.-]+|[.-]+$/gu, '')
    .slice(0, 48)
    .replace(/[.-]+$/gu, '');
  return `dsh-editor-${shortHash}${safeSubject === '' ? '' : `-${safeSubject}`}.patch`;
}

/**
 * Download one text patch through the same Blob URL path used by the local
 * changes exporter.
 *
 * @param {string} patch - complete patch text.
 * @param {string} downloadName - browser download filename.
 * @returns {void}
 */
export function downloadPatchBlob(patch: string, downloadName: string): void {
  const blob = new Blob([patch], { type: 'text/x-patch;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = downloadName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

let monacoPromise: Promise<MonacoApi> | null = null;
/* Monotonic suffix for diff model URIs; see DiffPreview's model swap. */
let diffLoadSerial = 0;

interface MonacoTypeScriptRuntimeConfig {
  target?: string;
  jsx?: string;
  jsxImportSource?: string;
  downlevelIteration?: boolean;
  allowSyntheticDefaultImports?: boolean;
  resolveJsonModule?: boolean;
  baseUrl?: string;
  typeRoots?: string[];
  types?: string[];
  paths?: Record<string, string[]>;
}

function editorTypeScriptConfig(): MonacoTypeScriptRuntimeConfig {
  return (
    (
      globalThis as typeof globalThis & {
        __dshEditorTypeScriptConfig?: MonacoTypeScriptRuntimeConfig;
      }
    ).__dshEditorTypeScriptConfig ?? {}
  );
}

/** Allocate a new Monaco model URI generation for one diff load. */
export function nextDiffLoadSerial(): number {
  diffLoadSerial += 1;
  return diffLoadSerial;
}

/**
 * 修正 Monaco TS/JS worker 与插件 workspace 导航模型之间的诊断差异。
 *
 * Monaco 只认识当前注册的 model，没有完整 tsconfig/project service；
 * extensionless 相对 import 即使能被本插件正确导航，也会产生
 * TS2307/TS2792。这里只忽略 module-not-found 两类假错误，语法错误和
 * 其他 semantic diagnostics 继续保留。
 * @param {object} monaco - Monaco 全局命名空间。
 * @returns {boolean} 是否找到 TypeScript language defaults。
 */
function configureMonacoLanguageDiagnostics(
  monaco: MonacoApi,
  config: MonacoTypeScriptRuntimeConfig = editorTypeScriptConfig(),
): boolean {
  const typescript = monaco?.languages?.typescript;
  if (typescript === undefined || typescript === null) return false;
  const typescriptDefaults = typescript.typescriptDefaults;
  const javascriptDefaults = typescript.javascriptDefaults;
  if (
    typeof typescriptDefaults?.setDiagnosticsOptions !== 'function' ||
    typeof typescriptDefaults?.setCompilerOptions !== 'function' ||
    typeof javascriptDefaults?.setDiagnosticsOptions !== 'function' ||
    typeof javascriptDefaults?.setCompilerOptions !== 'function'
  ) {
    return false;
  }
  const diagnosticsOptions = {
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: true,
    diagnosticCodesToIgnore: [2307, 2792],
  };
  const scriptTargets = typescript.ScriptTarget as unknown as Record<string, number> | undefined;
  const jsxModes = typescript.JsxEmit as unknown as Record<string, number> | undefined;
  const target = String(config.target ?? 'ESNext');
  const jsx = String(config.jsx ?? 'react-jsx');
  const compilerOptions = {
    /* Monaco has no Bundler resolution enum; NodeJs keeps extensionless imports usable. */
    moduleResolution: typescript.ModuleResolutionKind?.NodeJs ?? 2,
    module: typescript.ModuleKind?.ESNext ?? 99,
    target: scriptTargets?.[target === 'ES2022' ? 'ESNext' : target] ?? 99,
    jsx:
      jsx === 'react-jsx'
        ? (jsxModes?.ReactJSX ?? 4)
        : jsx === 'react-jsxdev'
          ? (jsxModes?.ReactJSXDev ?? 5)
          : jsx === 'react'
            ? (jsxModes?.React ?? 2)
            : jsx === 'react-native'
              ? (jsxModes?.ReactNative ?? 3)
              : jsx === 'preserve'
                ? (jsxModes?.Preserve ?? 1)
                : (jsxModes?.None ?? 0),
    jsxImportSource: config.jsxImportSource,
    downlevelIteration: config.downlevelIteration === true,
    allowSyntheticDefaultImports: config.allowSyntheticDefaultImports === true,
    resolveJsonModule: config.resolveJsonModule === true,
    ...(typeof config.baseUrl === 'string' && config.baseUrl !== '' ? { baseUrl: config.baseUrl } : null),
    ...(Array.isArray(config.typeRoots) && config.typeRoots.length > 0 ? { typeRoots: config.typeRoots } : null),
    ...(Array.isArray(config.types) && config.types.length > 0 ? { types: config.types } : null),
    ...(config.paths !== null && typeof config.paths === 'object' && Object.keys(config.paths).length > 0
      ? { paths: config.paths }
      : null),
  };
  typescriptDefaults.setDiagnosticsOptions(diagnosticsOptions);
  javascriptDefaults.setDiagnosticsOptions(diagnosticsOptions);
  typescriptDefaults.setCompilerOptions(compilerOptions);
  javascriptDefaults.setCompilerOptions({
    ...compilerOptions,
    allowJs: true,
    checkJs: false,
  });
  return true;
}

export interface MonacoWorkspaceTypeLibraries {
  files?: Array<{ path?: string; content?: string }>;
  types?: string[];
  typeRoots?: string[];
  baseUrl?: string;
  paths?: Record<string, string[]>;
  truncated?: boolean;
  totalBytes?: number;
}

const workspaceTypeLibraryDisposables = new WeakMap<object, Array<{ dispose?: () => void }>>();
let workspaceTypeLibraryRequestSerial = 0;
const WORKSPACE_TYPE_REFRESH_DELAY_MS = 120;

export interface WorkspaceTypeLibraryRefreshQueue {
  schedule(): void;
  cancel(): void;
}

interface WorkspaceTypeLibraryRefreshEntry {
  abortController: AbortController | null;
  queue: WorkspaceTypeLibraryRefreshQueue;
}

const workspaceTypeLibraryRefreshEntries = new WeakMap<object, WorkspaceTypeLibraryRefreshEntry>();

/**
 * Coalesce rapid type-root invalidations without dropping the final change.
 *
 * A request that is already reading the declaration graph cannot include a
 * later filesystem event. Keeping one pending flag converts that race into one
 * trailing refresh instead of parallel host scans.
 */
export function createWorkspaceTypeLibraryRefreshQueue(
  request: () => Promise<unknown>,
  schedule: (callback: () => void, delay: number) => number,
  cancelSchedule: (handle: number) => void,
  delay = WORKSPACE_TYPE_REFRESH_DELAY_MS,
): WorkspaceTypeLibraryRefreshQueue {
  let timer: number | null = null;
  let inFlight: Promise<void> | null = null;
  let pending = false;
  const drain = (): void => {
    timer = null;
    if (!pending || inFlight !== null) return;
    pending = false;
    inFlight = Promise.resolve()
      .then(request)
      .catch(() => {})
      .then(() => {
        inFlight = null;
        if (pending) drain();
      });
  };
  return {
    schedule() {
      pending = true;
      if (timer !== null) cancelSchedule(timer);
      timer = schedule(() => {
        drain();
      }, delay);
    },
    cancel() {
      if (timer !== null) cancelSchedule(timer);
      timer = null;
      pending = false;
    },
  };
}

/**
 * Install workspace-declared type packages into Monaco's TS worker.
 *
 * Monaco has no filesystem access. The host therefore supplies bounded `.d.ts`
 * contents and the virtual node_modules/typeRoots layout that makes normal
 * imports and global declarations resolve as they do in Node or Deno.
 * @param {object} monaco - Monaco global namespace.
 * @param {object|null|undefined} libraries - host workspace type payload.
 * @returns {number} number of installed declaration files.
 */
export function configureMonacoWorkspaceTypes(
  monaco: MonacoApi,
  libraries: MonacoWorkspaceTypeLibraries | null | undefined,
): number {
  if (libraries === null || libraries === undefined) cancelWorkspaceTypeLibrariesRefresh(monaco);
  const typescript = monaco?.languages?.typescript;
  const typescriptDefaults = typescript?.typescriptDefaults;
  const javascriptDefaults = typescript?.javascriptDefaults;
  if (typeof typescriptDefaults?.addExtraLib !== 'function' || typeof javascriptDefaults?.addExtraLib !== 'function') {
    return 0;
  }
  for (const disposable of workspaceTypeLibraryDisposables.get(monaco) ?? []) disposable.dispose?.();
  const disposables: Array<{ dispose?: () => void }> = [];
  const files = Array.isArray(libraries?.files) ? libraries.files : [];
  let installed = 0;
  for (const file of files) {
    if (typeof file?.path !== 'string' || file.path === '' || typeof file.content !== 'string') continue;
    const uri = `file:///${file.path.split('/').map(encodeURIComponent).join('/')}`;
    disposables.push(typescriptDefaults.addExtraLib(file.content, uri));
    disposables.push(javascriptDefaults.addExtraLib(file.content, uri));
    installed += 1;
  }
  workspaceTypeLibraryDisposables.set(monaco, disposables);
  configureMonacoLanguageDiagnostics(monaco, {
    ...editorTypeScriptConfig(),
    baseUrl: `file:///${
      typeof libraries?.baseUrl === 'string' && libraries.baseUrl !== ''
        ? libraries.baseUrl.split('/').map(encodeURIComponent).join('/')
        : ''
    }`,
    paths:
      libraries?.paths !== null && typeof libraries?.paths === 'object'
        ? Object.fromEntries(
            Object.entries(libraries.paths)
              .slice(0, 100)
              .filter(([, targets]) => Array.isArray(targets))
              .map(([alias, targets]) => [
                alias,
                targets.filter((target): target is string => typeof target === 'string' && target !== '').slice(0, 20),
              ]),
          )
        : {},
    typeRoots: (Array.isArray(libraries?.typeRoots) ? libraries.typeRoots : [])
      .filter((path): path is string => typeof path === 'string' && path !== '')
      .map((path) => `file:///${path.split('/').map(encodeURIComponent).join('/')}`),
    types: (Array.isArray(libraries?.types) ? libraries.types : []).filter(
      (type): type is string => typeof type === 'string' && type !== '',
    ),
  });
  return installed;
}

/** Fetch and install the active workspace's bounded Node/Deno declarations. */
export async function requestWorkspaceTypeLibraries(monaco: MonacoApi, signal?: AbortSignal): Promise<number> {
  const requestId = ++workspaceTypeLibraryRequestSerial;
  const libraries = await callFs<MonacoWorkspaceTypeLibraries>({ op: 'typeLibraries' }, { signal });
  return signal?.aborted === true || requestId !== workspaceTypeLibraryRequestSerial
    ? 0
    : configureMonacoWorkspaceTypes(monaco, libraries);
}

function workspaceTypeLibraryRefreshEntry(monaco: MonacoApi): WorkspaceTypeLibraryRefreshEntry {
  const existing = workspaceTypeLibraryRefreshEntries.get(monaco);
  if (existing !== undefined) return existing;
  const entry: WorkspaceTypeLibraryRefreshEntry = {
    abortController: null,
    queue: null as unknown as WorkspaceTypeLibraryRefreshQueue,
  };
  entry.queue = createWorkspaceTypeLibraryRefreshQueue(
    () => {
      const controller = new AbortController();
      entry.abortController = controller;
      return requestWorkspaceTypeLibraries(monaco, controller.signal).finally(() => {
        if (entry.abortController === controller) entry.abortController = null;
      });
    },
    (callback, delay) => window.setTimeout(callback, delay),
    (handle) => window.clearTimeout(handle),
  );
  workspaceTypeLibraryRefreshEntries.set(monaco, entry);
  return entry;
}

/** Drop a workspace's pending and in-flight coalesced type refresh. */
export function cancelWorkspaceTypeLibrariesRefresh(monaco: MonacoApi | undefined): void {
  if (monaco === undefined) return;
  const entry = workspaceTypeLibraryRefreshEntries.get(monaco);
  if (entry === undefined) return;
  entry.queue.cancel();
  entry.abortController?.abort();
  workspaceTypeLibraryRefreshEntries.delete(monaco);
}

/** True when a workspace change can alter installed Node/Deno type roots. */
export function workspaceChangeInvalidatesTypeLibraries(value: unknown): boolean {
  const paths = Array.isArray(value)
    ? value
        .filter((path): path is string => typeof path === 'string' && path !== '')
        .map((path) => path.replaceAll('\\', '/').replace(/^\.\/+/u, ''))
    : [];
  return paths.some((path) => {
    const name = path.slice(path.lastIndexOf('/') + 1);
    if (
      name === 'package.json' ||
      name === 'tsconfig.json' ||
      name === 'jsconfig.json' ||
      name === 'deno.json' ||
      name === 'deno.jsonc' ||
      name === 'deno.lock' ||
      name === 'package-lock.json' ||
      name === 'pnpm-lock.yaml' ||
      name === 'yarn.lock' ||
      name === 'bun.lock' ||
      name === 'bun.lockb'
    ) {
      return true;
    }
    if (name.endsWith('.d.ts') || name.endsWith('.d.mts') || name.endsWith('.d.cts')) return true;
    return path === 'node_modules' || path.startsWith('node_modules/') || path.includes('/node_modules/');
  });
}

/** Queue one coalesced refresh when a watcher change can alter type roots. */
export function refreshWorkspaceTypesForChange(
  monaco: MonacoApi | undefined,
  paths: unknown,
  directories: unknown,
): boolean {
  if (
    monaco === undefined ||
    !workspaceChangeInvalidatesTypeLibraries([
      ...(Array.isArray(paths) ? paths : []),
      ...(Array.isArray(directories) ? directories : []),
    ])
  ) {
    return false;
  }
  workspaceTypeLibraryRefreshEntry(monaco).queue.schedule();
  return true;
}

/**
 * Apply TypeScript defaults once Monaco's lazy TS contribution is registered.
 *
 * `editor.main` can expose the editor namespace before
 * `languages.typescript` exists. Returning early there permanently cached an
 * unconfigured worker, which surfaced Set/JSX/lib diagnostics in real files.
 * @param monaco - Monaco global namespace.
 * @param config - shared compiler options.
 * @param attempts - maximum availability checks.
 * @param delay - milliseconds between checks.
 * @returns whether the TypeScript defaults accepted the configuration.
 */
function configureMonacoLanguageWhenReady(
  monaco: MonacoApi,
  config: MonacoTypeScriptRuntimeConfig = editorTypeScriptConfig(),
  attempts = 40,
  delay = 25,
): Promise<boolean> {
  return new Promise((resolve) => {
    let remaining = Math.max(1, attempts);
    const attempt = () => {
      if (configureMonacoLanguageDiagnostics(monaco, config)) {
        ensureIdeaLightSemanticTokens(monaco);
        resolve(true);
        return;
      }
      remaining -= 1;
      if (remaining <= 0) {
        resolve(false);
        return;
      }
      window.setTimeout(attempt, delay);
    };
    attempt();
  });
}

/** Load Monaco's AMD build through the host asset bridge. */
export function loadMonaco(): Promise<MonacoApi> {
  if (window.monaco?.editor !== undefined) {
    return configureMonacoLanguageWhenReady(window.monaco).then(() => window.monaco);
  }
  if (monacoPromise !== null) return monacoPromise;
  monacoPromise = new Promise((resolve, reject) => {
    const start = () => {
      const amdRequire = window.require;
      if (typeof amdRequire !== 'function') {
        reject(new Error('Monaco AMD loader did not expose require'));
        return;
      }
      try {
        amdRequire.config({
          paths: { vs: '/api/dsh-editor/monaco/vs' },
          'vs/nls': { availableLanguages: { '*': 'zh-cn' } },
        });
        self.MonacoEnvironment = {
          getWorkerUrl: () => '/api/dsh-editor/monaco/vs/base/worker/workerMain.js',
        };
        amdRequire(
          ['vs/editor/editor.main'],
          () => {
            void configureMonacoLanguageWhenReady(window.monaco).then(() => resolve(window.monaco), reject);
          },
          reject,
        );
      } catch (error) {
        reject(error);
      }
    };
    const existing = document.querySelector('script[data-dsh-editor-monaco-loader]');
    if (existing !== null) {
      start();
      return;
    }
    const script = document.createElement('script');
    script.src = '/api/dsh-editor/monaco/vs/loader.js';
    script.async = true;
    script.dataset.dshEditorMonacoLoader = '';
    script.onload = start;
    script.onerror = () => reject(new Error('failed to load Monaco loader'));
    document.head.appendChild(script);
  });
  return monacoPromise;
}

/** The label and color used by one file-type badge. */
