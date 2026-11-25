import React from 'react';
import { styles } from '../../ui/styles';
import { findActionShortcutMatches, isMacPlatform, searchHistoryShortcutMatches } from '../../foundation';
import { CodePreviewCode } from '../commit/CodePreviewCode';
import { dirname } from '../editor/editor-path-model';
import { EditorSplitDivider } from '../editor/EditorSplitDivider';
import { CompactActionBar } from '../ui/CompactActionBar';
import { ContextMenu } from '../ui/Menu';
import { badgeFor } from '../ui/git-change-model';
import { Icon, POPUP_ICON_SIZE } from '../ui/Icon';
import { ToolbarButton } from '../ui/ToolbarButton';
import { trapDialogFocus } from '../ui/focus-trap';
import type { ToolbarActionLike } from '../ui/toolbar-model';
import { SearchFileResultItem } from './SearchFileResultItem';
import { searchHistoryMenuLabel } from './search-history-model';
import {
  SEARCH_EVERYWHERE_ALL_FILE_RESULT_LIMIT,
  SEARCH_EVERYWHERE_ALL_TEXT_RESULT_LIMIT,
  centerPreviewLineInContainer,
  defaultSearchEverywhereFilters,
  nextEnabledSearchResultIndex,
  rankSearchActions,
  replaceInputAction,
  searchEverywhereActionCategory,
  searchEverywhereActiveOptionIds,
  searchEverywhereAriaKeyShortcuts,
  searchEverywhereFiltersNeedReset,
  searchEverywhereGroupNavigationDirection,
  searchEverywhereGroupTargetIndex,
  searchEverywhereItemInfo,
  searchEverywhereOffersClearOptions,
  searchEverywhereOffersFindInFiles,
  searchEverywhereOffersScopeExpansion,
  searchEverywhereOptionId,
  searchEverywherePreviewWindow,
  searchEverywhereResultTooltip,
  searchEverywhereSection,
  searchEverywhereTabTarget,
  searchEverywhereTooltipPosition,
  searchFindHandoff,
  searchResultContextItems,
  useCodePreviewColorizedLines,
} from '../../commit';
import { basename, callFs } from '../../editor-core';
import {
  SEARCH_EVERYWHERE_RESULTS_DEFAULT_PERCENT,
  clampSearchEverywhereResultsPercent,
  fileExtensionFilterMatches,
  findToolTextMatchLength,
  fuzzyScore,
  normalizeFileExtensionFilter,
  searchPreviewFailureMessage,
} from '../../find-tool';
import { readStoredNumber, writeStoredNumber } from '../../terminal';

type Translate = (key: string, params?: Record<string, unknown>) => string;
const SEARCH_EVERYWHERE_RESULTS_PERCENT_STORAGE_KEY = 'dsh-editor.searchEverywhere.resultsPercent';

/**
 * Resolve what one Escape key owns inside Search Everywhere.
 *
 * Item Info is the only transient layer that closes before the dialog; every
 * other focus owner, including toolbar buttons and results, must dismiss the
 * dialog itself.
 * @param resultInfoOpen - whether the Item Info overlay is visible.
 * @returns the first surface Escape should close.
 */
export function searchEverywhereEscapeTarget(resultInfoOpen: boolean): 'close-result-info' | 'dismiss' {
  return resultInfoOpen ? 'close-result-info' : 'dismiss';
}

/**
 * Let the dialog dismiss even if a global shortcut or assistive technology
 * moves focus behind it. Inner handlers and nested transient surfaces keep the
 * first Escape; this is only the modal-level fallback.
 * @param options - focus ownership, transient surface state and event guards.
 * @returns the surface Escape should close, or null when another owner wins.
 */
export function searchEverywhereOutsideEscapeTarget({
  targetInsideDialog,
  activeInsideDialog,
  resultInfoOpen,
  defaultPrevented,
  isComposing,
  nestedSurfaceOpen,
}: {
  targetInsideDialog: boolean;
  activeInsideDialog: boolean;
  resultInfoOpen: boolean;
  defaultPrevented: boolean;
  isComposing: boolean;
  nestedSurfaceOpen: boolean;
}): 'close-result-info' | 'dismiss' | null {
  if (targetInsideDialog || activeInsideDialog || defaultPrevented || isComposing || nestedSurfaceOpen) return null;
  return searchEverywhereEscapeTarget(resultInfoOpen);
}

/**
 * Claim one provider Retry before React can unmount the failed provider row.
 *
 * A second click can be dispatched in the same browser task before the
 * provider-owned error clears and the Retry button unmounts. The synchronous
 * claim prevents that task from starting another request.
 * @param guard - mutable request claim shared by both provider Retry actions.
 * @returns whether this caller owns the retry request.
 */
export function claimSearchProviderRetry(guard: { current?: unknown } | null | undefined): boolean {
  if (guard === null || typeof guard !== 'object' || guard.current === true) return false;
  guard.current = true;
  return true;
}

/** Choose grammatically correct result-count copy for one Search Everywhere status. */
export function searchResultStatusLabel(count: number, t: Translate): string {
  const total = Number.isFinite(Number(count)) ? Math.max(0, Math.trunc(Number(count))) : 0;
  return total === 1
    ? t('editor.searchResultCountOne')
    : t('editor.searchResultCount', {
        count: total,
      });
}

/** Choose the single empty-result message owned by the active provider. */
export function searchEverywhereEmptyResultKind(tab: string, queryLength: number): 'text-hint' | 'no-matches' {
  return tab === 'text' && queryLength < 2 ? 'text-hint' : 'no-matches';
}

/** Preserve an active row identity while async providers replace the list. */
export function searchEverywhereActiveResultIndex(
  results: Array<{ rowKey: string; disabled?: boolean }>,
  requestedIndex: number,
  activeRowKey?: string | null,
): number {
  if (typeof activeRowKey === 'string' && activeRowKey !== '') {
    const preserved = results.findIndex((result) => result.rowKey === activeRowKey);
    if (preserved >= 0 && results[preserved].disabled !== true) return preserved;
  }
  if (results.length === 0) return 0;
  const requested = Number.isFinite(Number(requestedIndex)) ? Math.trunc(Number(requestedIndex)) : 0;
  const start = Math.min(results.length - 1, Math.max(0, requested));
  for (let index = start; index < results.length; index += 1) {
    if (results[index].disabled !== true) return index;
  }
  for (let index = 0; index < start; index += 1) {
    if (results[index].disabled !== true) return index;
  }
  return start;
}

/**
 * Avoid claiming that the entire workspace has no match when the provider only
 * exhausted a bounded candidate set or result budget.
 * @param {object} options - active tab, query length and provider truncation.
 * @param {Translate} t - locale lookup.
 * @returns {string} truthful empty-state label.
 */
export function searchEverywhereEmptyResultLabel(
  {
    tab,
    queryLength,
    textTruncated,
    filesTruncated,
  }: {
    tab: string;
    queryLength: number;
    textTruncated: boolean;
    filesTruncated: boolean;
  },
  t: Translate,
): string {
  if (tab === 'text' && queryLength < 2) return t('editor.searchTextHint');
  const incomplete =
    tab === 'text'
      ? textTruncated
      : tab === 'files'
        ? filesTruncated
        : tab === 'all'
          ? textTruncated || filesTruncated
          : false;
  return t(incomplete ? 'editor.searchNoMatchesIncomplete' : 'editor.searchNoMatches');
}

/**
 * Only the provider that owns the active tab may announce its truncation.
 * @param {object} options - active tab, provider and All-tab provider filters.
 * @returns {boolean} whether this provider's truncation is user-visible.
 */
export function searchEverywhereTruncationMessageIsVisible({
  tab,
  provider,
  filters,
}: {
  tab: string;
  provider: 'text' | 'files';
  filters: { text?: boolean; files?: boolean };
}): boolean {
  return tab === provider || (tab === 'all' && filters[provider] !== false);
}

/**
 * The initial transport cap only describes the empty-query candidate list.
 * Once a typed query owns the provider, that warning must disappear because
 * the Host searches the complete persisted path index.
 */
export function searchEverywhereFileListTruncationIsVisible({
  query,
  tab,
  filters,
}: {
  query: string;
  tab: string;
  filters: { text?: boolean; files?: boolean };
}): boolean {
  return query.trim() === '' && (tab === 'files' || (tab === 'all' && filters.files !== false));
}

export interface SearchEverywhereState {
  query: string;
  tab: string;
  index: number;
  activeRowKey?: string | null;
  filesScope?: boolean;
  filesTruncated?: boolean;
  filesScopeComplete?: boolean;
  files: SearchFile[];
  textMatches: SearchTextResult[];
  textLoading: boolean;
  textTruncated: boolean;
  textRevision: number;
  error: string | null;
  errorSource?: 'files' | 'text' | null;
  replacePartialFailure?: boolean;
  replaceBusy: boolean;
  replaceFocusRequest: number;
  replace?: string;
  caseSensitive?: boolean;
  wholeWords?: boolean;
  regex?: boolean;
  preserveCase?: boolean;
  fileMask?: string;
  withReplace?: boolean;
  includeNonProject?: boolean;
  [key: string]: unknown;
}

export interface SearchFile {
  path: string;
  content?: string;
  status?: string;
  staged?: boolean;
}

interface SearchTextResult {
  path: string;
  line: number;
  column: number;
  preview?: string;
  matchLength?: number;
  [key: string]: unknown;
}

interface SearchActionRow {
  id: string;
  label: string;
  icon?: string;
  description?: string;
  shortcut?: string;
  group?: string;
  disabled?: boolean;
}

/** Keep provider failures hidden while their owning provider is not visible. */
export function searchEverywhereErrorIsVisible(
  errorSource: unknown,
  tab: string,
  filters: { files?: unknown; text?: unknown },
): boolean {
  if (errorSource === 'files') return tab === 'files' || (tab === 'all' && filters.files === true);
  if (errorSource === 'text') return tab === 'text' || (tab === 'all' && filters.text === true);
  return true;
}

/** Expose cached file candidates only while they belong to the active scope. */
export function searchEverywhereFilesForScope<T>(files: T[], filesScope: unknown, includeNonProject: unknown): T[] {
  return filesScope === (includeNonProject === true) ? files : [];
}

interface SearchResult {
  kind: 'action' | 'file' | 'text' | 'history';
  rowKey: string;
  path?: string;
  id?: string;
  line?: number;
  column?: number;
  title?: string;
  subtitle?: string;
  label?: string;
  description?: string;
  category?: string;
  shortcut?: string;
  icon?: string;
  ariaKeyShortcuts?: string | undefined;
  dirty?: boolean;
  mtime?: unknown;
  preview?: string;
  matchLength?: number;
  disabled?: boolean;
  history?: boolean;
  rememberQuery?: boolean;
  rememberCommand?: boolean;
  run?: () => void;
  keepOpen?: boolean;
  [key: string]: unknown;
}

type FindHandoffRequest = ReturnType<typeof searchFindHandoff>['request'];

export interface SearchEverywhereProps {
  t: Translate;
  state: SearchEverywhereState;
  files: SearchFile[];
  openFiles: SearchFile[];
  changes: Map<string, string>;
  textMatches: SearchTextResult[];
  actions: SearchActionRow[];
  recentSearches: string[];
  recentFindUsages: string[];
  recentCommands: string[];
  historyRequest: number;
  findUsagesHistoryRequest: number;
  replaceHistory: string[];
  textLoading: boolean;
  textTruncated: boolean;
  error: string | null;
  replaceBusy: boolean;
  onRetryFiles: () => void;
  onRetryText: () => void;
  onQuery: (query: string) => void;
  onTab: (tab: string) => void;
  onMove: (delta: number, total?: number, index?: number, activeRowKey?: string) => void;
  onActivate: (result: SearchResult) => void;
  onClose: () => void;
  onDismiss?: () => void;
  onToggleReplace: () => void;
  onReplaceChange: (value: string) => void;
  onReplaceAll: () => void;
  onRememberQuery: (query: string) => void;
  onRememberCommand: (command: string) => void;
  onOpenFindUsagesHistory: (value?: string) => void;
  onOpenInFindToolWindow: (request: FindHandoffRequest) => void;
  onToggleIncludeNonProject: () => void;
  onToggleCaseSensitive: () => void;
  onToggleWholeWords: () => void;
  onToggleRegex: () => void;
  onTogglePreserveCase: () => void;
  onFileMaskChange: (value: string) => void;
  onOpenInRightSplit: (path: string, location?: { path?: string; line?: number; column?: number } | null) => void;
  onRevealResult: (path: string) => void;
  onNotify: (message: string) => void;
  onPopupDragStart?: (event: React.PointerEvent<HTMLElement>) => void;
}

function SearchEverywhere({
  t,
  state,
  files,
  openFiles,
  changes,
  textMatches,
  actions,
  recentSearches,
  recentFindUsages,
  recentCommands,
  historyRequest,
  findUsagesHistoryRequest,
  replaceHistory,
  textLoading,
  textTruncated,
  error,
  replaceBusy,
  onRetryFiles,
  onRetryText,
  onQuery,
  onTab,
  onMove,
  onActivate,
  onClose,
  onDismiss,
  onToggleReplace,
  onReplaceChange,
  onReplaceAll,
  onRememberQuery,
  onRememberCommand,
  onOpenFindUsagesHistory,
  onOpenInFindToolWindow,
  onToggleIncludeNonProject,
  onToggleCaseSensitive,
  onToggleWholeWords,
  onToggleRegex,
  onTogglePreserveCase,
  onFileMaskChange,
  onOpenInRightSplit,
  onRevealResult,
  onNotify,
  onPopupDragStart,
}: SearchEverywhereProps) {
  const searchEverywhereRootRef = React.useRef<HTMLDivElement | null>(null);
  const listRef = React.useRef(null);
  const previewBodyRef = React.useRef(null);
  const searchInputRef = React.useRef(null);
  const replaceInputRef = React.useRef(null);
  const fileMaskInputRef = React.useRef(null);
  const searchTabListRef = React.useRef(null);
  const resultTooltipTimerRef = React.useRef(null);
  const resultInfoCloseRef = React.useRef(null);
  const providerRetryGuardRef = React.useRef(false);
  const dismissSearchEverywhere = onDismiss ?? onClose;
  const retryProvider = (retry: () => void): void => {
    if (!claimSearchProviderRetry(providerRetryGuardRef)) return;
    retry();
    window.setTimeout(() => {
      providerRetryGuardRef.current = false;
      searchInputRef.current?.focus?.();
    }, 0);
  };
  const SEARCH_EVERYWHERE_LISTBOX_ID = 'dsh-editor-search-everywhere-listbox';
  const [resultTooltip, setResultTooltip] = React.useState(null);
  const [resultMenu, setResultMenu] = React.useState(null);
  const [resultInfo, setResultInfo] = React.useState(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [searchEverywhereResultsPercent, setSearchEverywhereResultsPercent] = React.useState(() =>
    clampSearchEverywhereResultsPercent(
      readStoredNumber(
        SEARCH_EVERYWHERE_RESULTS_PERCENT_STORAGE_KEY,
        SEARCH_EVERYWHERE_RESULTS_DEFAULT_PERCENT,
      ),
    ),
  );
  const [resultsDragging, setResultsDragging] = React.useState(false);
  const [previewSoftWrap, setPreviewSoftWrap] = React.useState(true);
  const [previewState, setPreviewState] = React.useState({
    loading: false,
    kind: null,
    path: '',
    content: '',
    line: 1,
    contentStartLine: 1,
    truncatedBefore: false,
    truncatedAfter: false,
    error: null,
  });
  const [searchFilters, setSearchFilters] = React.useState(defaultSearchEverywhereFilters);
  const [fileMaskOpen, setFileMaskOpen] = React.useState(false);
  const [filterMenu, setFilterMenu] = React.useState(null);
  const [queryHistoryMenu, setQueryHistoryMenu] = React.useState(null);
  const [findUsagesHistoryMenu, setFindUsagesHistoryMenu] = React.useState(null);
  const [replaceHistoryMenu, setReplaceHistoryMenu] = React.useState(null);
  const closeFilterMenu = React.useCallback(() => {
    setFilterMenu(null);
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }, []);
  const resetSearchFilters = React.useCallback(() => {
    setSearchFilters(defaultSearchEverywhereFilters());
    setFilterMenu(null);
    window.setTimeout(() => searchInputRef.current?.focus?.(), 0);
  }, []);
  const clearResultTooltip = React.useCallback(() => {
    if (resultTooltipTimerRef.current !== null) {
      window.clearTimeout(resultTooltipTimerRef.current);
      resultTooltipTimerRef.current = null;
    }
    setResultTooltip(null);
  }, []);
  const closeResultInfo = React.useCallback(() => {
    setResultInfo(null);
    window.setTimeout(() => searchInputRef.current?.focus?.(), 0);
  }, []);
  const scheduleResultTooltip = React.useCallback((event: React.MouseEvent<HTMLElement>, result: SearchResult) => {
    if (result?.kind !== 'action') return;
    const text = searchEverywhereResultTooltip(result);
    if (text === '') return;
    if (resultTooltipTimerRef.current !== null) window.clearTimeout(resultTooltipTimerRef.current);
    const rect = event.currentTarget.getBoundingClientRect();
    resultTooltipTimerRef.current = window.setTimeout(() => {
      const position = searchEverywhereTooltipPosition(rect.left, rect.bottom, window.innerWidth, window.innerHeight);
      setResultTooltip({
        ...position,
        text,
      });
      resultTooltipTimerRef.current = null;
    }, 450);
  }, []);
  React.useEffect(
    () => () => {
      if (resultTooltipTimerRef.current !== null) window.clearTimeout(resultTooltipTimerRef.current);
    },
    [],
  );
  React.useEffect(() => {
    setResultInfo(null);
  }, [state.query, state.tab]);
  React.useEffect(() => {
    if (resultInfo === null) return;
    window.setTimeout(() => resultInfoCloseRef.current?.focus?.(), 0);
  }, [resultInfo]);
  const query = state.query.trim();
  const replaceFocusRequest = Math.max(0, Number(state.replaceFocusRequest) || 0);
  const previousReplaceBusyRef = React.useRef(replaceBusy);
  const toggleReplace = (): void => {
    const next = state.withReplace !== true;
    onToggleReplace();
    if (!next) window.setTimeout(() => searchInputRef.current?.focus?.(), 0);
  };
  React.useEffect(() => {
    if (state.withReplace !== true || replaceFocusRequest === 0) return;
    window.setTimeout(() => replaceInputRef.current?.focus?.(), 0);
  }, [replaceFocusRequest, state.withReplace]);
  React.useEffect(() => {
    const wasBusy = previousReplaceBusyRef.current;
    previousReplaceBusyRef.current = replaceBusy;
    if (!wasBusy || replaceBusy || state.withReplace !== true) return;
    window.setTimeout(() => replaceInputRef.current?.focus?.(), 0);
  }, [replaceBusy, state.withReplace]);
  /* Basic tab ownership: the selected tab alone decides the provider.
     Query text is ordinary content, never an implicit category/provider
     language, so `/actions` stays a literal query instead of switching tab. */
  const effectiveTab = state.tab;
  const effectiveQuery = query;
  const canResetSearchFilters = effectiveTab === 'all' && searchEverywhereFiltersNeedReset(searchFilters);
  const tabs = [
    {
      id: 'all',
      label: t('editor.searchTabAll'),
    },
    {
      id: 'files',
      label: t('editor.searchTabFiles'),
    },
    {
      id: 'text',
      label: t('editor.searchTabText'),
    },
    {
      id: 'actions',
      label: t('editor.searchTabActions'),
    },
  ];
  const actionMatches: SearchResult[] = React.useMemo(
    () =>
      rankSearchActions(actions, effectiveQuery, recentCommands, {
        caseSensitive: state.caseSensitive === true,
        wholeWords: state.wholeWords === true,
      }).map((action) => ({
        ...action,
        kind: 'action',
        rowKey: `action:${action.id}`,
        subtitle: action.description ?? t('editor.searchActionHint'),
        category: searchEverywhereActionCategory(action.id, t),
        ariaKeyShortcuts: searchEverywhereAriaKeyShortcuts(action.shortcut),
      })),
    [actions, effectiveQuery, recentCommands, state.caseSensitive, state.wholeWords, t],
  );
  const scopedFiles = searchEverywhereFilesForScope(files, state.filesScope, state.includeNonProject);
  const fileMatches: SearchResult[] = React.useMemo(
    () =>
      scopedFiles
        .filter((file) => fileExtensionFilterMatches(file.path, state.fileMask))
        .map((file) => ({
          path: file.path,
          score: fuzzyScore(file.path, effectiveQuery, {
            caseSensitive: state.caseSensitive === true,
            wholeWords: state.wholeWords === true,
          }),
        }))
        .filter((entry) => entry.score >= 0)
        .sort((left, right) => right.score - left.score || left.path.length - right.path.length)
        .slice(0, 80)
        .map((entry) => ({
          kind: 'file',
          rowKey: `file:${entry.path}`,
          path: entry.path,
          title: basename(entry.path),
          subtitle: dirname(entry.path),
          icon: 'file',
        })),
    [effectiveQuery, scopedFiles, state.caseSensitive, state.fileMask, state.wholeWords],
  );
  const textResults: SearchResult[] = React.useMemo(
    () =>
      textMatches.map((match) => ({
        kind: 'text',
        rowKey: `text:${match.path}:${match.line}:${match.column}`,
        path: match.path,
        line: match.line,
        column: match.column,
        mtime: match.mtime,
        dirty: match.dirty === true,
        preview: match.preview ?? '',
        matchLength: findToolTextMatchLength(match, effectiveQuery, {
          caseSensitive: state.caseSensitive === true,
          regex: state.regex === true,
        }),
        title: match.preview || basename(match.path),
        subtitle: `${match.path}:${match.line}:${match.column}`,
        icon: 'search',
      })),
    [effectiveQuery, state.caseSensitive, state.regex, textMatches],
  );
  const historyResults: SearchResult[] = React.useMemo(
    () =>
      (Array.isArray(recentSearches) ? recentSearches : []).map((entry) => ({
        kind: 'action',
        history: true,
        rowKey: `history:${entry}`,
        label: entry,
        title: entry,
        subtitle: t('editor.searchRecentQuery'),
        icon: 'history',
        keepOpen: true,
        run: () => {
          onQuery(entry);
          window.setTimeout(() => searchInputRef.current?.focus?.(), 0);
        },
      })),
    [onQuery, recentSearches, t],
  );
  const results: SearchResult[] = React.useMemo(() => {
    if (effectiveTab === 'files') return fileMatches;
    if (effectiveTab === 'text') return textResults;
    if (effectiveTab === 'actions') return actionMatches;
    if (effectiveQuery === '')
      return [...historyResults.slice(0, 8), ...(searchFilters.actions ? actionMatches.slice(0, 12) : [])];
    return [
      ...(searchFilters.actions ? actionMatches.slice(0, 8) : []),
      ...(searchFilters.files ? fileMatches.slice(0, SEARCH_EVERYWHERE_ALL_FILE_RESULT_LIMIT) : []),
      ...(searchFilters.text ? textResults.slice(0, SEARCH_EVERYWHERE_ALL_TEXT_RESULT_LIMIT) : []),
    ];
  }, [
    actionMatches,
    effectiveQuery,
    effectiveTab,
    fileMatches,
    historyResults,
    searchFilters.actions,
    searchFilters.files,
    searchFilters.text,
    textResults,
  ]);
  const activeIndex = searchEverywhereActiveResultIndex(results, state.index, state.activeRowKey);
  const activeResult = results[activeIndex] ?? null;
  const visibleError =
    error !== null && searchEverywhereErrorIsVisible(state.errorSource, effectiveTab, searchFilters) ? error : null;
  const emptyResultLabel = searchEverywhereEmptyResultLabel(
    {
      tab: effectiveTab,
      queryLength: effectiveQuery.length,
      textTruncated: searchFilters.text ? textTruncated : false,
      filesTruncated: searchFilters.files ? state.filesTruncated === true : false,
    },
    t,
  );
  const searchResultStatus =
    visibleError !== null
      ? ''
      : textLoading
        ? t('editor.loading')
        : results.length === 0
          ? emptyResultLabel
          : searchResultStatusLabel(results.length, t);
  const showFindInFilesFallback = searchEverywhereOffersFindInFiles({
    tab: effectiveTab,
    query: effectiveQuery,
    resultCount: results.length,
    loading: textLoading,
  });
  const showClearOptionsFallback = searchEverywhereOffersClearOptions({
    tab: effectiveTab,
    query: effectiveQuery,
    resultCount: results.length,
    loading: textLoading,
    caseSensitive: state.caseSensitive,
    wholeWords: state.wholeWords,
    regex: state.regex,
    fileMask: state.fileMask,
  });
  const showScopeExpansionFallback = searchEverywhereOffersScopeExpansion({
    tab: effectiveTab,
    query: effectiveQuery,
    resultCount: results.length,
    loading: textLoading,
    includeNonProject: state.includeNonProject,
  });
  const activeSearchOptionIds = searchEverywhereActiveOptionIds({
    caseSensitive: state.caseSensitive,
    wholeWords: state.wholeWords,
    regex: state.regex,
    fileMask: state.fileMask,
  });
  const activeSearchOptionLabels: Record<string, string> = {
    case: t('editor.searchMatchCase'),
    words: t('editor.searchWholeWords'),
    regex: t('editor.searchRegex'),
    fileMask: t('editor.searchFileMaskLabel'),
  };
  const activeSearchOptionsText = activeSearchOptionIds
    .map((id) => activeSearchOptionLabels[id])
    .filter((label) => typeof label === 'string' && label !== '')
    .join(' · ');
  const showTextTruncated = searchEverywhereTruncationMessageIsVisible({
    tab: effectiveTab,
    provider: 'text',
    filters: searchFilters,
  });
  const showFilesTruncated = searchEverywhereFileListTruncationIsVisible({
    query: effectiveQuery,
    tab: effectiveTab,
    filters: searchFilters,
  });
  const clearSearchOptions = () => {
    if (state.caseSensitive === true) onToggleCaseSensitive();
    if (state.wholeWords === true) onToggleWholeWords();
    if (state.regex === true) onToggleRegex();
    if (String(state.fileMask ?? '').trim() !== '') onFileMaskChange('');
    window.setTimeout(() => searchInputRef.current?.focus?.(), 0);
  };
  const expandSearchScope = () => {
    if (state.includeNonProject !== true) onToggleIncludeNonProject();
    window.setTimeout(() => searchInputRef.current?.focus?.(), 0);
  };
  const previewLocalLine = Math.max(1, previewState.line - previewState.contentStartLine + 1);
  const previewWindow = previewOpen ? searchEverywherePreviewWindow(previewState.content, previewLocalLine) : null;
  const previewFirstLine = previewState.contentStartLine + (previewWindow?.start ?? 1) - 1;
  const previewLines =
    previewWindow === null || previewState.content === ''
      ? []
      : previewState.content.split(/\r?\n/u).slice(previewWindow.start - 1, previewWindow.end);
  const previewColorizedLines = useCodePreviewColorizedLines(previewLines, previewState.path);
  React.useEffect(() => {
    if (!previewOpen) {
      setPreviewState({
        loading: false,
        kind: null,
        path: '',
        content: '',
        line: 1,
        contentStartLine: 1,
        truncatedBefore: false,
        truncatedAfter: false,
        error: null,
      });
      return undefined;
    }
    if (activeResult === null) {
      setPreviewState({
        loading: false,
        kind: null,
        path: '',
        content: '',
        line: 1,
        contentStartLine: 1,
        truncatedBefore: false,
        truncatedAfter: false,
        error: null,
      });
      return undefined;
    }
    if (activeResult.kind === 'action') {
      setPreviewState({
        loading: false,
        kind: 'action',
        path: '',
        content: activeResult.description ?? '',
        line: 1,
        contentStartLine: 1,
        truncatedBefore: false,
        truncatedAfter: false,
        error: null,
      });
      return undefined;
    }
    if (activeResult.kind === 'text' && activeResult.dirty === true) {
      const liveFile =
        (Array.isArray(openFiles) ? openFiles : []).find((file) => file?.path === activeResult.path) ?? null;
      setPreviewState({
        loading: false,
        kind: activeResult.kind,
        path: activeResult.path,
        content: typeof liveFile?.content === 'string' ? liveFile.content : '',
        line: activeResult.line ?? 1,
        contentStartLine: 1,
        truncatedBefore: false,
        truncatedAfter: false,
        error: null,
      });
      return undefined;
    }
    let cancelled = false;
    const previewAbort = new AbortController();
    setPreviewState({
      loading: true,
      kind: activeResult.kind,
      path: activeResult.path,
      content: '',
      line: activeResult.line ?? 1,
      contentStartLine: 1,
      truncatedBefore: false,
      truncatedAfter: false,
      error: null,
    });
    callFs(
      {
        op: 'readPreview',
        path: activeResult.path,
        line: activeResult.line ?? 1,
        radius: 200,
      },
      {
        signal: previewAbort.signal,
      },
    )
      .then((value) => {
        if (cancelled) return;
        setPreviewState({
          loading: false,
          kind: activeResult.kind,
          path: activeResult.path,
          content: typeof value?.content === 'string' ? value.content : '',
          line: activeResult.line ?? 1,
          contentStartLine: Math.max(1, Math.floor(Number(value?.startLine) || 1)),
          truncatedBefore: value?.truncatedBefore === true,
          truncatedAfter: value?.truncatedAfter === true,
          error: null,
        });
      })
      .catch((failure) => {
        if (cancelled) return;
        if (failure?.name === 'AbortError' || failure?.name === 'CanceledError') return;
        setPreviewState({
          loading: false,
          kind: activeResult.kind,
          path: activeResult.path,
          content: '',
          line: activeResult.line ?? 1,
          contentStartLine: 1,
          truncatedBefore: false,
          truncatedAfter: false,
          error: searchPreviewFailureMessage(t, failure),
        });
      });
    return () => {
      cancelled = true;
      previewAbort.abort();
    };
  }, [previewOpen, activeResult?.rowKey, activeResult?.dirty, openFiles, t]);
  React.useLayoutEffect(() => {
    if (
      previewOpen !== true ||
      previewState.loading === true ||
      previewState.error !== null ||
      previewState.kind === null ||
      previewState.kind === 'action'
    )
      return undefined;
    let frame = 0;
    const centerNow = () => {
      const body = previewBodyRef.current;
      const focusLine = Math.max(1, Math.floor(Number(previewState.line) || 1));
      const lineNode = body?.querySelector?.(`[data-dsh-preview-line="${focusLine}"]`) ?? null;
      centerPreviewLineInContainer(body, lineNode);
    };
    const recenter = () => {
      window.cancelAnimationFrame(frame);
      /* Layout effect centers before paint; the next frame rechecks metrics
         after ResizeObserver and soft-wrap layout settle. */
      centerNow();
      frame = window.requestAnimationFrame(centerNow);
    };
    recenter();
    const body = previewBodyRef.current;
    const observer = typeof ResizeObserver === 'undefined' || body === null ? null : new ResizeObserver(recenter);
    observer?.observe(body);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [
    previewOpen,
    previewState.loading,
    previewState.error,
    previewState.kind,
    previewState.path,
    previewState.line,
    previewState.content,
    previewSoftWrap,
  ]);
  React.useEffect(() => {
    const active = listRef.current?.querySelector?.('[data-search-everywhere-active="1"]');
    active?.scrollIntoView?.({
      block: 'nearest',
    });
  }, [activeIndex, effectiveTab, effectiveQuery]);
  React.useEffect(() => {
    if (state.index !== activeIndex || state.activeRowKey !== results[activeIndex]?.rowKey) {
      onMove(0, results.length, activeIndex, results[activeIndex]?.rowKey);
    }
  }, [state.index, state.activeRowKey, activeIndex, results]);
  const cycleTab = (direction: number): void => {
    const targetId = searchEverywhereTabTarget(tabs, effectiveTab, direction < 0 ? 'ArrowLeft' : 'ArrowRight');
    if (targetId !== null) onTab(targetId);
  };
  const focusSearchTab = (tabId: string): void => {
    const tab = [...(searchTabListRef.current?.querySelectorAll?.('[data-dsh-search-tab-id]') ?? [])].find(
      (candidate) => candidate.getAttribute('data-dsh-search-tab-id') === tabId,
    );
    tab?.focus?.();
  };
  const handleSearchTabKeyDown = (event: React.KeyboardEvent<HTMLElement>): void => {
    if (event.target !== event.currentTarget) return;
    const targetId = searchEverywhereTabTarget(tabs, effectiveTab, event.key);
    if (targetId === null) return;
    event.preventDefault();
    event.stopPropagation();
    onTab(targetId);
    window.setTimeout(() => focusSearchTab(targetId), 0);
  };
  const moveSearchSelection = (direction: number): void => {
    const next = nextEnabledSearchResultIndex(results, activeIndex, direction);
    if (next !== null) onMove(0, results.length, next, results[next]?.rowKey);
  };
  const activateResult = (result: SearchResult | null): void => {
    if (result === null || result.disabled === true) return;
    if (result !== null && result.history !== true && result.rememberQuery !== false && effectiveQuery !== '')
      onRememberQuery(effectiveQuery);
    if (result.kind === 'action' && typeof result.id === 'string' && result.rememberCommand !== false)
      onRememberCommand(result.id);
    onActivate(result);
  };
  const openResultInfo = (result: SearchResult): void => {
    const info = searchEverywhereItemInfo(result, t);
    if (info === null) return;
    clearResultTooltip();
    setResultMenu(null);
    setResultInfo(info);
  };
  const openResultMenuAt = (x: number, y: number, result: SearchResult): void => {
    clearResultTooltip();
    if (result.kind === 'action') {
      setResultMenu({
        x,
        y,
        title: result.label ?? result.title,
        items: [
          {
            id: 'showInfo',
            label: t('editor.searchShowItemInfo'),
            run: () => openResultInfo(result),
          },
        ],
      });
      return;
    }
    if (result.kind !== 'file' && result.kind !== 'text') return;
    const path = typeof result.path === 'string' ? result.path : '';
    if (path === '') return;
    const contextResult = {
      kind: result.kind,
      path,
      line: result.line,
      column: result.column,
    };
    setResultMenu({
      x,
      y,
      title: basename(path),
      items: searchResultContextItems({
        t,
        result: contextResult,
        onCloseMenu: () => setResultMenu(null),
        onOpenEditor: () => activateResult(result),
        onOpenInRightSplit: () => {
          onClose();
          onOpenInRightSplit(
            path,
            result.kind === 'text'
              ? {
                  path,
                  line: result.line,
                  column: result.column,
                }
              : null,
          );
        },
        onReplace: () => openSearchResultsInFind('replace', result),
        onRevealResult: () => {
          onClose();
          onRevealResult(path);
        },
        onNotify,
        onShowInfo: () => openResultInfo(result),
      }),
    });
  };
  const openResultMenu = (event: React.MouseEvent<HTMLElement>, result: SearchResult | null): void => {
    if (result === null || typeof result !== 'object') return;
    event.preventDefault();
    event.stopPropagation();
    openResultMenuAt(event.clientX, event.clientY, result);
  };
  const openFilterAt = (event: React.MouseEvent<HTMLElement>): void => {
    const rect = event?.currentTarget?.getBoundingClientRect?.() ?? searchInputRef.current?.getBoundingClientRect?.();
    const right = rect?.right ?? Math.min(window.innerWidth - 4, 240);
    const bottom = rect?.bottom ?? 120;
    setFilterMenu((current: { x: number; y: number } | null) =>
      current === null
        ? {
            x: Math.max(4, right - 180),
            y: bottom + 4,
          }
        : null,
    );
  };
  const openQueryHistoryMenuAt = React.useCallback(
    (rect: DOMRect) => {
      const values = Array.isArray(recentSearches) ? recentSearches : [];
      setQueryHistoryMenu({
        x: rect.left,
        y: rect.bottom + 4,
        title: t('editor.findSearchHistory'),
        items:
          values.length === 0
            ? [
                {
                  id: 'empty',
                  label: t('editor.findHistoryEmpty'),
                  disabled: true,
                  run: () => {},
                },
              ]
            : values.map((value, index) => ({
                id: `query-history:${index}`,
                label: searchHistoryMenuLabel(value, 'query', t),
                run: () => {
                  onQuery(value);
                  window.setTimeout(() => searchInputRef.current?.focus?.(), 0);
                },
              })),
      });
    },
    [onQuery, recentSearches, t],
  );
  const openQueryHistoryMenu = (event: React.SyntheticEvent<HTMLElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    openQueryHistoryMenuAt(event.currentTarget.getBoundingClientRect());
  };
  const openSearchHistoryShortcut = (event: React.KeyboardEvent<HTMLElement>): void => {
    if (!searchHistoryShortcutMatches(event)) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[data-dsh-search-query], [data-dsh-search-replace-input]') != null) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = searchInputRef.current?.getBoundingClientRect?.();
    if (rect !== undefined && rect !== null) openQueryHistoryMenuAt(rect);
  };
  const trapSearchEverywhereFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const root = event.currentTarget instanceof Element ? event.currentTarget : null;
    return trapDialogFocus(event, root);
  };
  const handleSearchEverywhereDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (trapSearchEverywhereFocus(event)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (searchEverywhereEscapeTarget(resultInfo !== null) === 'close-result-info') closeResultInfo();
      else dismissSearchEverywhere();
      return;
    }
    openSearchHistoryShortcut(event);
  };
  const handledHistoryRequestRef = React.useRef(0);
  React.useEffect(() => {
    const request = Number(historyRequest) || 0;
    if (request <= handledHistoryRequestRef.current) return;
    handledHistoryRequestRef.current = request;
    const rect = searchInputRef.current?.getBoundingClientRect?.();
    if (rect !== undefined && rect !== null) openQueryHistoryMenuAt(rect);
  }, [historyRequest, openQueryHistoryMenuAt]);
  const openFindUsagesHistoryMenuAt = React.useCallback(
    (rect: DOMRect) => {
      const values = Array.isArray(recentFindUsages) ? recentFindUsages : [];
      setFindUsagesHistoryMenu({
        x: rect.left,
        y: rect.bottom + 4,
        title: t('editor.recentFindUsagesAction'),
        items:
          values.length === 0
            ? [
                {
                  id: 'empty',
                  label: t('editor.recentFindUsagesEmpty'),
                  disabled: true,
                  run: () => {},
                },
              ]
            : values.map((value, index) => ({
                id: `find-usages-history:${index}`,
                label: value,
                run: () => onOpenFindUsagesHistory(value),
              })),
      });
    },
    [onOpenFindUsagesHistory, recentFindUsages, t],
  );
  const handledFindUsagesHistoryRequestRef = React.useRef(0);
  React.useEffect(() => {
    const request = Number(findUsagesHistoryRequest) || 0;
    if (request <= handledFindUsagesHistoryRequestRef.current) return;
    handledFindUsagesHistoryRequestRef.current = request;
    const rect = searchInputRef.current?.getBoundingClientRect?.();
    if (rect !== undefined && rect !== null) openFindUsagesHistoryMenuAt(rect);
  }, [findUsagesHistoryRequest, openFindUsagesHistoryMenuAt]);
  const openReplaceHistoryMenu = (event: React.SyntheticEvent<HTMLElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    /* ContextMenu returns focus to the element that owned it when it opened.
       The toolbar button is not the replacement field, so move focus there
       first; otherwise an outside click returns to the query field. */
    replaceInputRef.current?.focus?.();
    const rect = event.currentTarget.getBoundingClientRect();
    const values = Array.isArray(replaceHistory) ? replaceHistory : [];
    setReplaceHistoryMenu({
      x: rect.left,
      y: rect.bottom + 4,
      title: t('editor.findReplaceHistory'),
      items:
        values.length === 0
          ? [
              {
                id: 'empty',
                label: t('editor.findHistoryEmpty'),
                disabled: true,
                run: () => {},
              },
            ]
          : values.map((value, index) => ({
              id: `replace-history:${index}`,
              label: searchHistoryMenuLabel(value, 'replace', t),
              run: () => {
                onReplaceChange(value);
                window.setTimeout(() => replaceInputRef.current?.focus?.(), 0);
              },
            })),
    });
  };
  const handleSearchResultKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape' && resultInfo !== null) {
      event.preventDefault();
      event.stopPropagation();
      closeResultInfo();
      return;
    }
    const macPlatform = isMacPlatform(navigator.userAgentData?.platform ?? navigator.platform);
    const groupDirection = searchEverywhereGroupNavigationDirection(event, macPlatform);
    if (groupDirection !== 0) {
      const nextGroup = searchEverywhereGroupTargetIndex(results, activeIndex, groupDirection);
      event.preventDefault();
      event.stopPropagation();
      if (nextGroup !== null) onMove(0, results.length, nextGroup, results[nextGroup]?.rowKey);
      return;
    }
    if ((event.key === 'ContextMenu' || (event.shiftKey === true && event.key === 'F10')) && activeResult !== null) {
      event.preventDefault();
      event.stopPropagation();
      const activeRow = listRef.current?.querySelector?.('[data-search-everywhere-active="1"]');
      const rect = activeRow?.getBoundingClientRect?.();
      openResultMenuAt(rect?.left ?? 20, rect?.bottom ?? 20, activeResult);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveSearchSelection(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveSearchSelection(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (activeResult !== null) activateResult(activeResult);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      dismissSearchEverywhere();
    }
  };
  const openSearchResultsInFind = (
    mode: 'replace' | null = null,
    result: SearchResult | null = null,
    { refresh = false }: { refresh?: boolean } = {},
  ): boolean => {
    const request = searchFindHandoff({
      query: effectiveQuery,
      files: fileMatches,
      matches: textResults,
      activeRowKey: (result ?? activeResult)?.rowKey,
      truncated: textTruncated || state.filesTruncated === true,
      mode,
      withReplace: state.withReplace === true,
      caseSensitive: state.caseSensitive === true,
      wholeWords: state.wholeWords === true,
      regex: state.regex === true,
      preserveCase: state.preserveCase === true,
      includeExcluded: state.includeNonProject === true,
      fileMask: normalizeFileExtensionFilter(state.fileMask),
    });
    if (
      request.needsConfirmation &&
      !window.confirm(
        t('editor.searchTooManyResults', {
          count: request.total,
        }),
      )
    )
      return false;
    onOpenInFindToolWindow(
      (refresh === true
        ? {
            ...request.request,
            refresh: true,
          }
        : request.request) as FindHandoffRequest,
    );
    return true;
  };
  const openBlankReplaceInFiles = () => {
    onOpenInFindToolWindow({
      query: '',
      mode: 'replace',
      files: [],
      matches: [],
      index: 0,
      truncated: false,
      caseSensitive: state.caseSensitive === true,
      wholeWords: state.regex === true ? false : state.wholeWords === true,
      regex: state.regex === true,
      preserveCase: state.preserveCase === true,
      includeExcluded: state.includeNonProject === true,
      fileMask: normalizeFileExtensionFilter(state.fileMask),
    } as FindHandoffRequest);
  };
  const replaceShortcut = (event: KeyboardEvent): void => {
    const meta = event?.metaKey === true || event?.ctrlKey === true;
    if (!meta || event?.altKey === true || event?.key?.toLowerCase?.() !== 'r') return;
    event.preventDefault();
    event.stopPropagation();
    if (event?.shiftKey === true) {
      openBlankReplaceInFiles();
      return;
    }
    if (fileMatches.length > 0 || textResults.length > 0) {
      openSearchResultsInFind('replace', activeResult);
      return;
    }
    openBlankReplaceInFiles();
  };
  const findActionShortcut = (event: KeyboardEvent): void => {
    const macPlatform = isMacPlatform(navigator.userAgentData?.platform ?? navigator.platform);
    if (!findActionShortcutMatches(event, macPlatform)) return;
    const host = document.querySelector('[data-dsh-editor-workspace]');
    if (host === null || !host.contains(document.activeElement)) return;
    event.preventDefault();
    event.stopPropagation();
    onQuery('');
    onTab('actions');
    window.setTimeout(() => searchInputRef.current?.focus?.(), 0);
  };
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => replaceShortcut(event);
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [
    activeResult?.rowKey,
    fileMatches.length,
    state.caseSensitive,
    state.fileMask,
    state.preserveCase,
    state.regex,
    state.wholeWords,
    textResults.length,
  ]);
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => findActionShortcut(event);
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onQuery, onTab]);
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const root = searchEverywhereRootRef.current;
      const eventTarget = event.target instanceof Node ? event.target : null;
      const activeElement = document.activeElement;
      const eventTargetOutsideDialog = root === null || eventTarget === null || !root.contains(eventTarget);
      const eventActiveOutsideDialog = root === null || activeElement === null || !root.contains(activeElement);
      const nestedSurfaceOpen =
        document.querySelector<HTMLElement>('[role="menu"], [role="alertdialog"][aria-modal="true"]') !== null;
      const escapeTarget = searchEverywhereOutsideEscapeTarget({
        targetInsideDialog: !eventTargetOutsideDialog,
        activeInsideDialog: !eventActiveOutsideDialog,
        resultInfoOpen: resultInfo !== null,
        defaultPrevented: event.defaultPrevented,
        isComposing: event.isComposing,
        nestedSurfaceOpen,
      });
      if (escapeTarget === null) return;
      event.preventDefault();
      event.stopPropagation();
      if (escapeTarget === 'close-result-info') closeResultInfo();
      else dismissSearchEverywhere();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [closeResultInfo, dismissSearchEverywhere, resultInfo]);
  const headerActions: ToolbarActionLike[] = [
    {
      id: 'include',
      icon: 'project',
      label: t('editor.includeNonProjectItems'),
      active: state.includeNonProject === true,
      onClick: onToggleIncludeNonProject,
      group: 'scope',
    },
    {
      id: 'regex',
      icon: 'regex',
      label: t('editor.searchRegex'),
      active: state.regex === true,
      disabled: effectiveTab !== 'all' && effectiveTab !== 'text',
      onClick: onToggleRegex,
      group: 'filter',
    },
    ...(state.withReplace === true
      ? [
          {
            id: 'preserveCase',
            icon: 'preserveCase',
            label: t('editor.searchPreserveCase'),
            active: state.preserveCase === true,
            disabled: effectiveTab !== 'all' && effectiveTab !== 'text',
            onClick: onTogglePreserveCase,
            group: 'filter',
          },
        ]
      : []),
    {
      id: 'preview',
      icon: 'preview',
      label: t('editor.searchPreview'),
      active: previewOpen,
      onClick: () => setPreviewOpen((value) => !value),
      group: 'view',
    },
    {
      id: 'replace',
      icon: 'replace',
      label: t('editor.searchReplaceToggle'),
      active: state.withReplace === true,
      disabled: effectiveTab !== 'all' && effectiveTab !== 'text',
      onClick: toggleReplace,
      group: 'view',
    },
    {
      id: 'filter',
      icon: 'filter',
      label: t('editor.searchFilter'),
      active: filterMenu !== null,
      onClick: openFilterAt,
      ariaHasPopup: 'menu',
      ariaExpanded: filterMenu !== null,
      group: 'view',
      pinned: true,
    },
    {
      id: 'openFind',
      icon: 'findWindow',
      label: t('editor.openInFindToolWindow'),
      disabled: effectiveQuery === '',
      onClick: () => openSearchResultsInFind(null, activeResult),
      group: 'view',
      pinned: true,
    },
    {
      id: 'case',
      icon: 'matchCase',
      label: t('editor.searchMatchCase'),
      active: state.caseSensitive === true,
      onClick: onToggleCaseSensitive,
      group: 'filter',
    },
    {
      id: 'words',
      icon: 'wholeWords',
      label: t('editor.searchWholeWords'),
      active: state.wholeWords === true,
      disabled: state.regex === true,
      onClick: onToggleWholeWords,
      group: 'filter',
    },
    {
      id: 'extension',
      icon: 'file',
      label:
        String(state.fileMask ?? '').trim() === ''
          ? t('editor.searchFileSuffixFilter')
          : `${t('editor.searchFileSuffixFilter')}: ${state.fileMask}`,
      active: String(state.fileMask ?? '').trim() !== '',
      disabled: effectiveTab === 'actions',
      onClick: () => {
        setFileMaskOpen((open) => !open);
        window.setTimeout(() => fileMaskInputRef.current?.focus?.(), 0);
      },
      group: 'filter',
    },
  ];
  return (
    <div
      ref={searchEverywhereRootRef}
      style={{
        ...styles.searchEverywhere,
        width: '100%',
        height: '100%',
        maxHeight: 'none',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        containerType: 'inline-size',
      }}
      role='dialog'
      aria-modal='true'
      aria-label={t('editor.searchEverywhere')}
      onMouseDown={(event) => event.stopPropagation()}
      onKeyDown={handleSearchEverywhereDialogKeyDown}
      data-dsh-search-everywhere=''>
      <div
        style={{
          ...styles.searchEverywhereTabs,
          cursor: 'move',
          userSelect: 'none',
          touchAction: 'none',
        }}
        data-dsh-search-drag-surface=''
        onPointerDown={(event) => onPopupDragStart?.(event)}>
        <div
          ref={searchTabListRef}
          role='tablist'
          className='dsh-editor-search-everywhere-tablist'
          aria-label={t('editor.searchEverywhere')}
          style={{
            display: 'flex',
            alignItems: 'stretch',
            gap: 'clamp(8px, 2.8cqi, 22px)',
            flex: '1 1 auto',
            minWidth: 0,
            height: '100%',
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type='button'
              role='tab'
              aria-selected={effectiveTab === tab.id}
              tabIndex={effectiveTab === tab.id ? 0 : -1}
              data-dsh-search-tab-id={tab.id}
              className='dsh-editor-search-everywhere-tab'
              style={{
                ...styles.searchEverywhereTab,
                ...(effectiveTab === tab.id ? styles.searchEverywhereTabActive : null),
              }}
              onClick={(event) => {
                event.currentTarget.focus?.();
                onTab(tab.id);
              }}
              onKeyDown={(event) => handleSearchTabKeyDown(event)}>
              {tab.label}
            </button>
          ))}
        </div>
        <div
          data-dsh-search-open-find-tool-window=''
          data-dsh-search-toolbar-group=''
          style={{
            display: 'flex',
            alignItems: 'center',
            flex: '0 0 auto',
            width: 'min(40%, 320px)',
            minWidth: 110,
            minHeight: 0,
          }}>
          <CompactActionBar
            actions={headerActions}
            t={t}
            ariaLabel={t('editor.searchEverywhere')}
            style={styles.searchEverywhereActionBar}
            slotWidth={30}
            iconSize={POPUP_ICON_SIZE}
          />
        </div>
      </div>
      <div style={styles.searchEverywhereSearchRow}>
        <Icon
          name='search'
          size={POPUP_ICON_SIZE}
        />
        <input
          ref={searchInputRef}
          style={styles.searchEverywhereInput}
          autoFocus={true}
          value={state.query}
          data-dsh-search-query=''
          placeholder={t('editor.searchEverywherePlaceholder')}
          aria-label={t('editor.searchEverywherePlaceholder')}
          role='combobox'
          aria-autocomplete='list'
          aria-expanded={results.length > 0}
          aria-controls={SEARCH_EVERYWHERE_LISTBOX_ID}
          aria-activedescendant={activeResult === null ? undefined : searchEverywhereOptionId(activeResult.rowKey)}
          onChange={(event) => {
            clearResultTooltip();
            onQuery(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing === true) return;
            if (event.altKey === true && event.key === 'ArrowDown') {
              openQueryHistoryMenu(event);
            } else if (event.key === 'Tab') {
              event.preventDefault();
              event.stopPropagation();
              cycleTab(event.shiftKey ? -1 : 1);
            } else handleSearchResultKeyDown(event);
          }}
        />
        <ToolbarButton
          icon='history'
          label={t('editor.findSearchHistory')}
          ariaHasPopup='menu'
          ariaExpanded={queryHistoryMenu !== null}
          onClick={(event) => openQueryHistoryMenu(event)}
          iconSize={POPUP_ICON_SIZE}
        />
        {effectiveQuery === '' ? (
          <span style={styles.searchEverywhereHint}>{t('editor.searchEverywhereHint')}</span>
        ) : null}
      </div>
      {(effectiveTab === 'text' || effectiveTab === 'all') &&
      (fileMaskOpen || String(state.fileMask ?? '').trim() !== '') ? (
        <div
          style={styles.searchEverywhereSearchRow}
          data-search-file-mask=''>
          <Icon
            name='file'
            size={POPUP_ICON_SIZE}
          />
          <input
            ref={fileMaskInputRef}
            data-dsh-search-file-mask=''
            style={styles.searchEverywhereInput}
            value={state.fileMask ?? ''}
            placeholder={t('editor.searchFileMask')}
            aria-label={t('editor.searchFileMask')}
            onChange={(event) => onFileMaskChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return;
              event.preventDefault();
              event.stopPropagation();
              if (String(state.fileMask ?? '').trim() === '') setFileMaskOpen(false);
              searchInputRef.current?.focus?.();
            }}
          />
        </div>
      ) : null}
      {state.withReplace === true && (effectiveTab === 'text' || effectiveTab === 'all') ? (
        <div style={styles.searchEverywhereReplaceRow}>
          <Icon
            name='code'
            size={POPUP_ICON_SIZE}
          />
          <input
            ref={replaceInputRef}
            data-dsh-search-replace-input=''
            style={styles.searchEverywhereInput}
            value={state.replace}
            placeholder={t('editor.searchReplacePlaceholder')}
            aria-label={t('editor.searchReplacePlaceholder')}
            onChange={(event) => onReplaceChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing === true) return;
              if (event.altKey === true && event.key === 'ArrowDown') {
                openReplaceHistoryMenu(event);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                dismissSearchEverywhere();
              } else if (replaceInputAction(event, 'all') === 'all' && !replaceBusy && textResults.length > 0) {
                event.preventDefault();
                onReplaceAll();
              }
            }}
          />
          <ToolbarButton
            icon='history'
            label={t('editor.findReplaceHistory')}
            ariaHasPopup='menu'
            ariaExpanded={replaceHistoryMenu !== null}
            onClick={(event) => openReplaceHistoryMenu(event)}
            iconSize={POPUP_ICON_SIZE}
          />
          <button
            type='button'
            style={{
              ...styles.conflictAction,
              opacity: replaceBusy || textResults.length === 0 ? 0.45 : 1,
            }}
            disabled={replaceBusy || textResults.length === 0}
            onClick={onReplaceAll}>
            {replaceBusy ? t('editor.loading') : t('editor.searchReplaceAll')}
          </button>
        </div>
      ) : null}
      {visibleError !== null ? (
        <div
          style={styles.searchEverywhereError}
          role='alert'>
          <span>{visibleError}</span>
          {state.errorSource === 'files' ? (
            <button
              type='button'
              style={styles.conflictAction}
              onClick={() => retryProvider(onRetryFiles)}>
              {t('editor.searchFilesRetry')}
            </button>
          ) : state.errorSource === 'text' ? (
            <button
              type='button'
              style={styles.conflictAction}
              onClick={() => retryProvider(onRetryText)}>
              {t('editor.searchTextRetry')}
            </button>
          ) : null}
        </div>
      ) : null}
      {resultInfo !== null ? (
        <div
          style={styles.searchEverywhereItemInfo}
          role='status'
          aria-live='polite'
          data-dsh-search-item-info=''>
          <div style={styles.searchEverywhereItemInfoHeader}>
            <span style={styles.searchEverywhereItemInfoKind}>{resultInfo.kind}</span>
            <strong style={styles.searchEverywhereItemInfoTitle}>{resultInfo.title}</strong>
            <button
              type='button'
              ref={resultInfoCloseRef}
              style={styles.searchEverywhereItemInfoClose}
              aria-label={t('editor.searchItemClose')}
              onClick={closeResultInfo}>
              ×
            </button>
          </div>
          {resultInfo.detail === '' ? null : (
            <div style={styles.searchEverywhereItemInfoDetail}>{resultInfo.detail}</div>
          )}
          {resultInfo.meta === '' ? null : <div style={styles.searchEverywhereItemInfoMeta}>{resultInfo.meta}</div>}
        </div>
      ) : null}
      <div
        role='status'
        aria-live='polite'
        aria-atomic='true'
        style={styles.screenReaderOnly}>
        {searchResultStatus}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 auto',
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
        }}
        data-dsh-search-results-area=''>
      <div
        ref={listRef}
        id={SEARCH_EVERYWHERE_LISTBOX_ID}
        style={{
          ...styles.searchEverywhereList,
          ...(previewOpen ? { flex: `${searchEverywhereResultsPercent} 1 0` } : null),
        }}
        role='listbox'
        aria-busy={textLoading && effectiveTab !== 'actions' ? true : undefined}
        aria-label={t('editor.searchEverywhere')}
        aria-activedescendant={activeResult === null ? undefined : searchEverywhereOptionId(activeResult.rowKey)}
        tabIndex={0}
        onKeyDown={handleSearchResultKeyDown}
        onScroll={clearResultTooltip}>
        {textLoading && effectiveTab !== 'actions' ? (
          <div style={styles.searchEverywhereMessage}>{t('editor.loading')}</div>
        ) : null}
        {results.length === 0 && !textLoading && visibleError === null ? (
          <div style={styles.searchEverywhereMessage}>
            {emptyResultLabel}
            {showClearOptionsFallback ? (
              <div
                style={styles.searchEverywhereUsedOptions}
                data-dsh-search-used-options=''>{`${t('editor.searchOptionsUsed')} ${activeSearchOptionsText}`}</div>
            ) : null}
            {showScopeExpansionFallback ? (
              <button
                type='button'
                className='dsh-editor-search-expand-scope'
                style={styles.searchEverywhereInlineAction}
                data-dsh-search-expand-scope=''
                onClick={expandSearchScope}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
                }}>
                {t('editor.searchExpandScope')}
              </button>
            ) : null}
            {canResetSearchFilters ? (
              <button
                type='button'
                className='dsh-editor-search-reset-filter'
                style={styles.searchEverywhereInlineAction}
                data-dsh-search-reset-filter=''
                onClick={resetSearchFilters}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
                }}>
                {t('editor.searchResetFilters')}
              </button>
            ) : null}
            {showFindInFilesFallback ? (
              <button
                type='button'
                className='dsh-editor-search-find-in-files'
                style={styles.searchEverywhereInlineAction}
                data-dsh-search-find-in-files=''
                onClick={() =>
                  openSearchResultsInFind(null, null, {
                    refresh: true,
                  })
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
                }}>
                {t('editor.searchFindInFilesFallback')}
              </button>
            ) : null}
            {showClearOptionsFallback ? (
              <button
                type='button'
                className='dsh-editor-search-clear-options'
                style={styles.searchEverywhereInlineAction}
                data-dsh-search-clear-options=''
                onClick={clearSearchOptions}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
                }}>
                {t('editor.searchClearAllOptions')}
              </button>
            ) : null}
          </div>
        ) : null}
        {results.map((result, position) => {
          const isFile = result.kind === 'file' || result.kind === 'text';
          const badge = isFile ? badgeFor(result.path, changes) : null;
          const section = searchEverywhereSection(result, results[position - 1], effectiveQuery, effectiveTab, false);
          const row = (
            <div
              key={result.rowKey}
              id={searchEverywhereOptionId(result.rowKey)}
              role='option'
              aria-selected={position === activeIndex}
              aria-disabled={result.disabled === true}
              aria-description={result.kind === 'action' ? searchEverywhereResultTooltip(result) : undefined}
              aria-keyshortcuts={result.ariaKeyShortcuts}
              data-search-everywhere-active={position === activeIndex ? '1' : '0'}
              className='dsh-editor-search-everywhere-row'
              style={{
                ...styles.paletteRow,
                ...styles.searchEverywhereRow,
                ...(position === activeIndex ? styles.paletteRowActive : null),
                ...(result.disabled === true
                  ? {
                      opacity: 0.45,
                    }
                  : null),
              }}
              onMouseEnter={(event) => {
                if (resultsDragging) return;
                onMove(position - activeIndex, results.length, position, result.rowKey);
                scheduleResultTooltip(event, result);
              }}
              onMouseLeave={clearResultTooltip}
              onMouseDown={(event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                clearResultTooltip();
                activateResult(result);
              }}
              onContextMenu={(event) => openResultMenu(event, result)}>
              {isFile ? (
                <SearchFileResultItem
                  path={result.path ?? ''}
                  name={result.title ?? result.label ?? result.path ?? ''}
                  detail={result.subtitle}
                  statusInfo={badge}
                  selected={position === activeIndex}
                />
              ) : (
                <React.Fragment>
                  <Icon
                    name={result.icon ?? 'settings'}
                    size={POPUP_ICON_SIZE}
                  />
                  <span
                    className='dsh-editor-search-result-name'
                    style={{
                      ...styles.paletteName,
                      flex: '1 1 auto',
                    }}>
                    {result.title ?? result.label}
                  </span>
                  <span
                    className='dsh-editor-search-result-detail dsh-editor-search-everywhere-meta'
                    style={styles.searchEverywhereMeta}>
                    {result.subtitle ?? ''}
                  </span>
                </React.Fragment>
              )}
              {result.category ? (
                <span
                  className='dsh-editor-search-everywhere-category'
                  style={styles.searchEverywhereCategory}
                  title={result.category}
                  data-dsh-search-category=''>
                  {result.category}
                </span>
              ) : null}
              {result.shortcut ? <span style={styles.searchEverywhereShortcut}>{result.shortcut}</span> : null}
            </div>
          );
          return section === null ? (
            row
          ) : (
            <React.Fragment key={`section:${section}:${result.rowKey}`}>
              <div
                style={styles.searchEverywhereSection}
                data-search-everywhere-section={section}>
                {section === 'recent' ? t('editor.searchSectionRecent') : t('editor.searchSectionActions')}
              </div>
              {row}
            </React.Fragment>
          );
        })}
        {textTruncated && showTextTruncated ? (
          <div
            style={styles.searchEverywhereMessage}
            role='status'
            aria-live='polite'>
            {t('editor.searchTextTruncated')}
          </div>
        ) : null}
        {state.filesTruncated === true && showFilesTruncated ? (
          <div
            style={styles.searchEverywhereMessage}
            role='status'
            aria-live='polite'>
            {t('editor.searchFilesTruncated')}
          </div>
        ) : null}
      </div>
      {previewOpen ? (
        <EditorSplitDivider
          orientation='horizontal'
          percent={searchEverywhereResultsPercent}
          dragging={resultsDragging}
          title={t('editor.searchEverywherePreviewSplitter')}
          clampPercent={(value, height) => clampSearchEverywhereResultsPercent(value, height)}
          onChange={setSearchEverywhereResultsPercent}
          onDraggingChange={setResultsDragging}
          onCommit={(final) =>
            writeStoredNumber(SEARCH_EVERYWHERE_RESULTS_PERCENT_STORAGE_KEY, Math.round(final))
          }
        />
      ) : null}
      {previewOpen ? (
        <div
          style={{
            ...styles.searchEverywherePreview,
            flex: `${100 - searchEverywhereResultsPercent} 1 0`,
            minHeight: 100,
            borderTop: 'none',
          }}
          className='dsh-editor-search-preview'
          data-dsh-search-preview=''>
          <div style={styles.searchEverywherePreviewToolbar}>
            <Icon
              name={previewState.kind === 'action' ? 'settings' : 'file'}
              size={POPUP_ICON_SIZE}
            />
            <span
              style={styles.searchEverywherePreviewPath}
              title={previewState.path}>
              {previewState.path || activeResult?.label || t('editor.searchPreview')}
            </span>
            <ToolbarButton
              icon='wrap'
              label={t('editor.searchPreviewSoftWrap')}
              active={previewSoftWrap}
              onClick={() => setPreviewSoftWrap((value) => !value)}
              iconSize={POPUP_ICON_SIZE}
            />
          </div>
          <div
            ref={previewBodyRef}
            style={styles.searchEverywherePreviewBody}
            className='dsh-editor-code-preview'
            data-dsh-code-preview=''>
            {previewState.loading ? <div style={styles.searchEverywhereMessage}>{t('editor.loading')}</div> : null}
            {previewState.error !== null ? (
              <div
                style={styles.searchEverywhereError}
                role='alert'>
                {previewState.error}
              </div>
            ) : null}
            {!previewState.loading && previewState.error === null && previewState.kind === 'action' ? (
              <div
                style={{
                  padding: '8px 12px',
                }}>
                {previewState.content}
              </div>
            ) : null}
            {!previewState.loading && previewState.error === null && previewState.kind !== 'action' ? (
              <React.Fragment>
                {previewState.truncatedBefore || previewWindow?.truncatedBefore ? (
                  <div style={styles.searchEverywhereMessage}>…</div>
                ) : null}
                {previewLines.length === 0 ? (
                  <div style={styles.searchEverywhereMessage}>{t('editor.searchPreviewEmpty')}</div>
                ) : (
                  previewLines.map((code, index) => (
                    <div
                      key={previewFirstLine + index}
                      data-dsh-preview-line={previewFirstLine + index}
                      className='dsh-editor-code-preview-line'
                      style={{
                        ...styles.searchEverywherePreviewLine,
                        ...(previewState.kind === 'text' && previewFirstLine + index === previewState.line
                          ? styles.searchEverywherePreviewLineActive
                          : null),
                      }}>
                      <span
                        className='dsh-editor-code-preview-gutter'
                        style={styles.codePreviewGutter}>
                        {String(previewFirstLine + index)}
                      </span>
                      <CodePreviewCode
                        text={code}
                        html={previewColorizedLines?.[index] ?? null}
                        segments={null}
                        style={{
                          ...styles.searchEverywherePreviewCode,
                          whiteSpace: previewSoftWrap ? 'pre-wrap' : 'pre',
                          overflowWrap: previewSoftWrap ? 'anywhere' : 'normal',
                        }}
                      />
                    </div>
                  ))
                )}
                {previewState.truncatedAfter || previewWindow?.truncatedAfter ? (
                  <div style={styles.searchEverywhereMessage}>…</div>
                ) : null}
              </React.Fragment>
            ) : null}
          </div>
        </div>
      ) : null}
      </div>
      {filterMenu === null ? null : (
        <ContextMenu
          t={t}
          onClose={closeFilterMenu}
          menu={{
            ...filterMenu,
            fallbackFocus: () => searchInputRef.current?.focus?.(),
            title: t('editor.searchFilter'),
            items: [
              {
                id: 'search-filter-files',
                label: t('editor.searchTabFiles'),
                active: searchFilters.files,
                shortcut: searchFilters.files ? '✓' : '',
                keepOpen: true,
                run: () =>
                  setSearchFilters((current) => ({
                    ...current,
                    files: !current.files,
                  })),
              },
              {
                id: 'search-filter-text',
                label: t('editor.searchTabText'),
                active: searchFilters.text,
                shortcut: searchFilters.text ? '✓' : '',
                keepOpen: true,
                run: () =>
                  setSearchFilters((current) => ({
                    ...current,
                    text: !current.text,
                  })),
              },
              {
                id: 'search-filter-actions',
                label: t('editor.searchTabActions'),
                active: searchFilters.actions,
                shortcut: searchFilters.actions ? '✓' : '',
                keepOpen: true,
                run: () =>
                  setSearchFilters((current) => ({
                    ...current,
                    actions: !current.actions,
                  })),
              },
            ],
          }}
        />
      )}
      {queryHistoryMenu === null ? null : (
        <ContextMenu
          t={t}
          onClose={() => setQueryHistoryMenu(null)}
          menu={{
            ...queryHistoryMenu,
            fallbackFocus: () => searchInputRef.current?.focus?.(),
            escapeFocus: () => searchInputRef.current?.focus?.(),
          }}
        />
      )}
      {findUsagesHistoryMenu === null ? null : (
        <ContextMenu
          t={t}
          onClose={() => setFindUsagesHistoryMenu(null)}
          menu={{
            ...findUsagesHistoryMenu,
            fallbackFocus: () => searchInputRef.current?.focus?.(),
            escapeFocus: () => searchInputRef.current?.focus?.(),
          }}
        />
      )}
      {replaceHistoryMenu === null ? null : (
        <ContextMenu
          t={t}
          onClose={() => setReplaceHistoryMenu(null)}
          menu={{
            ...replaceHistoryMenu,
            fallbackFocus: () => (replaceInputRef.current ?? searchInputRef.current)?.focus?.(),
            escapeFocus: () => (replaceInputRef.current ?? searchInputRef.current)?.focus?.(),
          }}
        />
      )}
      {resultMenu === null ? null : (
        <ContextMenu
          t={t}
          menu={{
            ...resultMenu,
            fallbackFocus: () => searchInputRef.current?.focus?.(),
          }}
          onClose={() => setResultMenu(null)}
        />
      )}
      {resultTooltip === null ? null : (
        <div
          role='tooltip'
          data-search-everywhere-tooltip=''
          style={{
            ...styles.searchEverywhereTooltip,
            left: resultTooltip.left,
            top: resultTooltip.top,
          }}>
          {resultTooltip.text}
        </div>
      )}
    </div>
  );
}

export { SearchEverywhere };
