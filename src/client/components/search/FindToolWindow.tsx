import React from 'react';
import { styles } from '../../ui/styles';
import { CodePreviewCode } from '../commit/CodePreviewCode';
import { MoveToPicker } from '../commit/MoveToPicker';
import { EditorSplitDivider } from '../editor/EditorSplitDivider';
import { dirname } from '../editor/editor-path-model';
import { CompactActionBar } from '../ui/CompactActionBar';
import { Icon, POPUP_ICON_SIZE } from '../ui/Icon';
import { ContextMenu } from '../ui/Menu';
import { ToolbarButton } from '../ui/ToolbarButton';
import { trapDialogFocus } from '../ui/focus-trap';
import type { ToolbarActionLike } from '../ui/toolbar-model';
import { FindScopeEditor } from './FindScopeEditor';
import { SearchFileResultItem } from './SearchFileResultItem';
import type { FindToolSession } from './use-find-tool-sessions';
import {
  centerPreviewLineInContainer,
  findSearchScopePresetAvailable,
  findFocusShouldReleaseOutsideSurface,
  findShouldRestoreFocusAfterResultsChange,
  findToolDisplayGroups,
  findToolCompactCount,
  findToolGroupBoundaryTarget,
  findToolGroupId,
  findToolGroupTarget,
  findToolHandoffTarget,
  findToolMenuLeft,
  findToolMenuMaxHeight,
  findToolMenuTop,
  findToolNextTextGroupPath,
  findToolOptionId,
  findToolPathMatchesScope,
  findToolPreviewLineParts,
  findToolResultSummary,
  findToolScopeModeTarget,
  findToolTextLineStarts,
  findToolVisibleRows,
  hasFindToolContentQuery,
  normalizeCustomFindScopes,
  normalizeFindGroupBy,
  readFileMaskHistory,
  replaceInputAction,
  searchEverywhereActiveOptionIds,
  searchEverywherePreviewWindow,
  searchEverywhereRequiresResultConfirmation,
  searchResultContextItems,
  suggestFileMasks,
  useCodePreviewColorizedLines,
  writeFileMaskHistory,
} from '../../commit';
import { basename, callFs } from '../../editor-core';
import {
  findReplaceDisabledReasons,
  findSearchOptionShortcutAction,
  findToolReplaceHistoryActionPinned,
  findToolReplaceAdvanceIndex,
  findToolResultsAreCurrent,
  FIND_TOOL_PREVIEW_DEFAULT_PERCENT,
  clampFindPreviewPercent,
} from '../../find-tool';
import {
  editorFindResult,
  highlightParts,
  normalizeTextSearchContextFilter,
  readStoredNumber,
  readStoredText,
  writeStoredNumber,
} from '../../terminal';

type Translate = (key: string, params?: Record<string, unknown>) => string;
const FIND_PREVIEW_PERCENT_STORAGE_KEY = 'dsh-editor.find.previewPercent';

interface FindToolWindowState {
  query: string;
  replace: string;
  mode?: 'find' | 'replace';
  index?: number;
  files?: SearchFileResult[];
  matches?: SearchTextResult[];
  fileMask?: string;
  caseSensitive?: boolean;
  wholeWords?: boolean;
  regex?: boolean;
  preserveCase?: boolean;
  includeExcluded?: boolean;
  searchGeneration?: number;
  loadedGeneration?: number;
  replaceAdvanceRowKey?: string | null;
  collapsedFiles?: string[];
  handoffHandledRevision?: number;
  [key: string]: unknown;
}

interface SearchFileResult {
  kind?: 'file';
  path: string;
  [key: string]: unknown;
}

interface SearchTextResult {
  kind?: 'text';
  path: string;
  line: number;
  column: number;
  [key: string]: unknown;
}

type FindToolOccurrenceRow =
  | (SearchFileResult & {
      kind: 'file';
      rowKey: string;
      line?: number;
      column?: number;
      preview?: string;
      dirty?: boolean;
    })
  | (SearchTextResult & {
      kind: 'text';
      rowKey: string;
      preview?: string;
      dirty?: boolean;
    });

interface FindCustomScope {
  id: string;
  name?: string;
  includePatterns?: unknown;
  excludePatterns?: unknown;
  [key: string]: unknown;
}

interface DirectoryPickerState {
  query: string;
  index: number;
  loading: boolean;
  directories: string[];
  parent: string;
  rootName: string;
}

interface FindScopeValue {
  mode?: string;
  preset?: string;
  directory?: string;
  [key: string]: unknown;
}

export interface FindToolWindowProps {
  t: Translate;
  state: FindToolWindowState;
  tabs?: FindToolSession<FindToolWindowState>[];
  activeTabId?: string | null;
  onSelectFindToolTab?: (id: string) => void;
  onCloseFindToolTab?: (id: string) => void;
  queryHistory?: string[];
  replaceHistory?: string[];
  onQuery: (value: string) => void;
  onReplace: (value: string) => void;
  onToggleCaseSensitive: () => void;
  onToggleWholeWords: () => void;
  onToggleRegex: () => void;
  onTogglePreserveCase: () => void;
  onToggleIncludeExcluded: () => void;
  onContextFilterChange: (value: string) => void;
  onFileMaskChange: (value: string) => void;
  onScopeChange?: (value: FindScopeValue) => void;
  onDirectoryRecursiveChange?: (value: boolean) => void;
  customScopes?: FindCustomScope[];
  onCustomScopesChange?: (scopes: FindCustomScope[]) => FindCustomScope[];
  onWriteScopeXml: (path: string, content: string) => Promise<void>;
  onMove: (direction: number, count: number, index?: number) => void;
  onOpen: (result: SearchTextResult | SearchFileResult, openInNewTab: boolean) => void;
  onReplaceOccurrence: (result: SearchTextResult, index: number) => void;
  onReplaceAll: (paths: Set<string>) => void;
  canUndoLastReplace?: boolean;
  onUndoLastReplace?: () => void;
  canRedoLastReplace?: boolean;
  onRedoLastReplace?: () => void;
  onOpenInRightSplit: (path: string, position: { path?: string; line: number; column: number } | null) => void;
  onRevealResult: (path: string) => void;
  onNotify: (message: string) => void;
  onReplaceMode: () => void;
  onOpenSettings?: () => void;
  onOpenInFindWindow: () => void;
  onCollapsedFilesChange?: (paths: string[]) => void;
  onHandoffHandled?: (revision: number) => void;
  onPopupDragStart?: (event: React.MouseEvent<HTMLElement>) => void;
  onClose: () => void;
  minimized?: boolean;
  onMinimize?: () => void;
  floating?: boolean;
  activeFilePath?: string | null;
  openFilePaths?: string[];
  recentFilePaths?: string[];
  gitAvailable?: boolean;
  openFilesRef: React.MutableRefObject<
    Array<{
      path: string;
      content?: string;
    }>
  >;
  changedFilePaths?: string[];
}
function FindToolWindowView({
  t,
  state,
  tabs = [],
  activeTabId = null,
  onSelectFindToolTab,
  onCloseFindToolTab,
  queryHistory,
  replaceHistory,
  onQuery,
  onReplace,
  onToggleCaseSensitive,
  onToggleWholeWords,
  onToggleRegex,
  onTogglePreserveCase,
  onToggleIncludeExcluded,
  onContextFilterChange,
  onFileMaskChange,
  onScopeChange,
  onDirectoryRecursiveChange,
  customScopes = [],
  onCustomScopesChange,
  onWriteScopeXml,
  onMove,
  onOpen,
  onReplaceOccurrence,
  onReplaceAll,
  canUndoLastReplace = false,
  onUndoLastReplace,
  canRedoLastReplace = false,
  onRedoLastReplace,
  onOpenInRightSplit,
  onRevealResult,
  onNotify,
  onReplaceMode,
  onOpenSettings,
  onOpenInFindWindow,
  onCollapsedFilesChange,
  onHandoffHandled,
  onPopupDragStart,
  onClose,
  minimized = false,
  onMinimize,
  floating = true,
  activeFilePath = null,
  openFilePaths = [],
  recentFilePaths = [],
  gitAvailable = false,
  openFilesRef,
  changedFilePaths = [],
}: FindToolWindowProps) {
  const listRef = React.useRef(null);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const findFocusOwnedRef = React.useRef(false);
  const previewBodyRef = React.useRef(null);
  const groupButtonRefs = React.useRef(new Map());
  const occurrenceRefs = React.useRef(new Map());
  const queryInputRef = React.useRef(null);
  const replaceInputRef = React.useRef(null);
  const fileMaskInputRef = React.useRef(null);
  const scopeModeButtonRefs = React.useRef(new Map());
  const scopeEditorButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const replaceFocusPendingRef = React.useRef(false);
  const replaceAdvanceReadyRef = React.useRef(0);
  const rerunSelectionRef = React.useRef(null);
  const FIND_TOOL_LISTBOX_ID = 'dsh-editor-find-tool-listbox';
  React.useEffect(() => {
    const releaseFindFocusOwnership = (event: Event) => {
      const root = rootRef.current;
      if (root === null) return;
      if (findFocusShouldReleaseOutsideSurface(event.target instanceof Node && root.contains(event.target)))
        findFocusOwnedRef.current = false;
    };
    document.addEventListener('pointerdown', releaseFindFocusOwnership, true);
    document.addEventListener('focusin', releaseFindFocusOwnership, true);
    return () => {
      document.removeEventListener('pointerdown', releaseFindFocusOwnership, true);
      document.removeEventListener('focusin', releaseFindFocusOwnership, true);
    };
  }, []);
  const collapsedFiles = React.useMemo(
    () => new Set(Array.isArray(state.collapsedFiles) ? state.collapsedFiles : []),
    [state.collapsedFiles],
  );
  const setCollapsedFiles = React.useCallback(
    (update: Set<string> | ((current: Set<string>) => Set<string>)) => {
      const next = typeof update === 'function' ? update(collapsedFiles) : update;
      onCollapsedFilesChange?.([...next]);
    },
    [collapsedFiles, onCollapsedFilesChange],
  );
  const [focusedGroupPath, setFocusedGroupPath] = React.useState(null);
  const [previewOpen, setPreviewOpen] = React.useState(true);
  const [previewSoftWrap, setPreviewSoftWrap] = React.useState(true);
  const [dockPreviewPercent, setDockPreviewPercent] = React.useState(() =>
    clampFindPreviewPercent(readStoredNumber(FIND_PREVIEW_PERCENT_STORAGE_KEY, FIND_TOOL_PREVIEW_DEFAULT_PERCENT)),
  );
  const [dockPreviewDragging, setDockPreviewDragging] = React.useState(false);
  const [fileMaskEnabled, setFileMaskEnabled] = React.useState(() => String(state.fileMask ?? '').trim() !== '');
  const [fileMaskDraft, setFileMaskDraft] = React.useState(() => state.fileMask ?? '');
  const [fileMaskHistory, setFileMaskHistory] = React.useState(readFileMaskHistory);
  const [fileMaskMenu, setFileMaskMenu] = React.useState(null);
  const [dockFileMaskOpen, setDockFileMaskOpen] = React.useState(false);
  const [directoryPicker, setDirectoryPicker] = React.useState<DirectoryPickerState | null>(null);
  const [findGroupBy, setFindGroupBy] = React.useState(() =>
    normalizeFindGroupBy(readStoredText('dsh-editor.find.groupBy', 'file')),
  );
  const [groupByMenu, setGroupByMenu] = React.useState(null);
  const [searchNewLine, setSearchNewLine] = React.useState(false);
  const [replaceNewLine, setReplaceNewLine] = React.useState(false);
  const [replaceExpanded, setReplaceExpanded] = React.useState(() => state.mode === 'replace');
  const [openResultsInNewTab, setOpenResultsInNewTab] = React.useState(
    () => readStoredText('dsh-editor.find.openInNewTab', '0') === '1',
  );
  const [filterMenu, setFilterMenu] = React.useState(null);
  const [scopeEditorOpen, setScopeEditorOpen] = React.useState(false);
  const closeScopeEditor = React.useCallback(() => {
    setScopeEditorOpen(false);
    window.setTimeout(() => scopeEditorButtonRef.current?.focus?.(), 0);
  }, []);
  const [pinned, setPinned] = React.useState(() => readStoredText('dsh-editor.find.pinned', '0') === '1');
  const [scopeMode, setScopeMode] = React.useState(() =>
    state.searchScopeMode === 'files' || state.searchScopeMode === 'directory' || state.searchScopeMode === 'scope'
      ? state.searchScopeMode
      : 'project',
  );
  const [scopePreset, setScopePreset] = React.useState(() =>
    state.searchScopePreset === 'openFiles' ||
    state.searchScopePreset === 'changedFiles' ||
    state.searchScopePreset === 'currentFile' ||
    state.searchScopePreset === 'recentlyViewedFiles' ||
    state.searchScopePreset === 'gitTrackedFiles' ||
    state.searchScopePreset === 'gitNonIgnoredFiles' ||
    (typeof state.searchScopePreset === 'string' && /^custom:[a-z0-9][a-z0-9-]{0,63}$/u.test(state.searchScopePreset))
      ? state.searchScopePreset
      : 'projectFiles',
  );
  const [scopeDirectoryDraft, setScopeDirectoryDraft] = React.useState(() =>
    typeof state.searchScopeDirectory === 'string' && state.searchScopeDirectory !== ''
      ? state.searchScopeDirectory
      : activeFilePath === null
        ? ''
        : dirname(activeFilePath),
  );
  const [scopeRecursive, setScopeRecursive] = React.useState(() => state.searchScopeRecursive !== false);
  const resultGroupingIdentity = `${scopeMode}:${scopePreset}:${findGroupBy}`;
  const previousResultGroupingRef = React.useRef<string | null>(null);
  const [historyMenu, setHistoryMenu] = React.useState(null);
  const [resultMenu, setResultMenu] = React.useState(null);
  const [previewState, setPreviewState] = React.useState({
    loading: false,
    path: '',
    content: '',
    line: 1,
    error: null,
  });
  const query = typeof state.query === 'string' ? state.query : '';
  const fileFilterMode = scopeMode === 'files';
  const QueryField = searchNewLine ? 'textarea' : 'input';
  const ReplaceField = replaceNewLine ? 'textarea' : 'input';
  React.useEffect(() => {
    /* A multiline editor selection must stay visible and searchable as
       selected. Switch the query field to New Line mode before rerender. */
    if (/[\r\n]/u.test(query) && searchNewLine === false) setSearchNewLine(true);
  }, [query, searchNewLine]);
  const scopeModeOptions = [
    {
      id: 'project',
      label: `${t('editor.findScopeIn')} ${t('editor.findScopeProject')}`,
      disabled: false,
    },
    {
      id: 'files',
      label: t('editor.findScopeFile'),
      disabled: false,
    },
    {
      id: 'directory',
      label: t('editor.findScopeDirectory'),
      disabled: false,
    },
    {
      id: 'scope',
      label: t('editor.findScopeScope'),
      disabled: false,
    },
  ];
  const replaceMode = state.mode === 'replace';
  const surfaceTitle = floating
    ? t(replaceMode ? 'editor.replaceInFilesTitle' : 'editor.findInFilesTitle')
    : query === ''
      ? t('editor.findToolDockEmptyTitle')
      : t('editor.findToolDockTitle', {
          query,
        });
  const fileResults = React.useMemo(() => (Array.isArray(state.files) ? state.files : []), [state.files]);
  const textResults = React.useMemo(() => (Array.isArray(state.matches) ? state.matches : []), [state.matches]);
  const scopeDirectory = activeFilePath === null ? '' : dirname(activeFilePath);
  const effectiveScopeDirectory = scopeDirectoryDraft.trim() || scopeDirectory;
  const selectedCustomScopeId = scopePreset.startsWith('custom:') ? scopePreset.slice('custom:'.length) : '';
  const selectedCustomScope =
    (Array.isArray(customScopes) ? customScopes : []).find((scope) => scope?.id === selectedCustomScopeId) ?? null;
  const selectedCustomScopeMissing = selectedCustomScopeId !== '' && selectedCustomScope === null;
  const selectedScopePresetAvailable = findSearchScopePresetAvailable(scopePreset, {
    gitAvailable,
    recentFileCount: recentFilePaths.length,
    openFileCount: openFilePaths.length,
    currentFileAvailable: activeFilePath !== null,
    changedFileCount: changedFilePaths.length,
  });
  const effectiveScopePreset =
    selectedCustomScopeMissing || selectedScopePresetAvailable !== true ? 'projectFiles' : scopePreset;
  const retainPreviousResultsWhileLoading =
    (state.loading === true && state.loadedGeneration !== state.searchGeneration) || state.error !== null;
  const scopeFilterOptions = React.useMemo(() => {
    const allowedPaths =
      effectiveScopePreset === 'openFiles'
        ? new Set(openFilePaths)
        : effectiveScopePreset === 'recentlyViewedFiles'
          ? new Set(recentFilePaths)
          : effectiveScopePreset === 'currentFile'
            ? new Set(activeFilePath === null ? [] : [activeFilePath])
            : effectiveScopePreset === 'gitTrackedFiles' || effectiveScopePreset === 'gitNonIgnoredFiles'
              ? null
              : new Set(changedFilePaths);
    return {
      directory: effectiveScopeDirectory,
      preset: effectiveScopePreset,
      allowedPaths,
      recursive: scopeRecursive,
      customScope: selectedCustomScope,
    };
  }, [
    activeFilePath,
    changedFilePaths,
    effectiveScopeDirectory,
    effectiveScopePreset,
    openFilePaths,
    recentFilePaths,
    scopeRecursive,
    selectedCustomScope,
  ]);
  const scopedFileResults = React.useMemo(
    () =>
      retainPreviousResultsWhileLoading
        ? fileResults
        : fileResults.filter((file) => findToolPathMatchesScope(file.path, scopeMode, scopeFilterOptions)),
    [fileResults, retainPreviousResultsWhileLoading, scopeFilterOptions, scopeMode],
  );
  const scopedMatches = React.useMemo(
    () =>
      retainPreviousResultsWhileLoading
        ? textResults
        : textResults.filter((match) => findToolPathMatchesScope(match.path, scopeMode, scopeFilterOptions)),
    [retainPreviousResultsWhileLoading, scopeFilterOptions, scopeMode, textResults],
  );
  const dockVisibleRows = React.useMemo(
    () => findToolVisibleRows(scopedFileResults, scopedMatches, collapsedFiles, findGroupBy),
    [collapsedFiles, findGroupBy, scopedFileResults, scopedMatches],
  );
  const groups = dockVisibleRows.groups;
  const popupOccurrences = React.useMemo(
    (): FindToolOccurrenceRow[] => [
      ...scopedFileResults.map((file) => ({
        ...file,
        kind: 'file' as const,
        rowKey: `file:${file.path}`,
      })),
      ...scopedMatches.map((match) => ({
        ...match,
        kind: 'text' as const,
        rowKey: `text:${match.path}:${match.line}:${match.column}`,
      })),
    ],
    [scopedFileResults, scopedMatches],
  );
  const occurrences: FindToolOccurrenceRow[] = floating ? popupOccurrences : dockVisibleRows.rows;
  const showEmptyFindResult =
    state.error === null && state.loading !== true && hasFindToolContentQuery(query) && occurrences.length === 0;
  const occurrenceIndexByKey = React.useMemo(() => {
    const positions = new Map<string, number>();
    occurrences.forEach((entry, position) => {
      if (!positions.has(entry.rowKey)) positions.set(entry.rowKey, position);
    });
    return positions;
  }, [occurrences]);
  const previewPartsByRowKey = React.useMemo(() => {
    const partsByRowKey = new Map<string, Array<{ text: string; match: boolean }>>();
    occurrences.forEach((result) => {
      if (result.kind !== 'text') return;
      partsByRowKey.set(result.rowKey, highlightParts(result.preview || basename(result.path), query));
    });
    return partsByRowKey;
  }, [occurrences, query]);
  const displayGroups = React.useMemo(() => findToolDisplayGroups(groups, findGroupBy), [findGroupBy, groups]);
  const fileMaskSuggestions = React.useMemo(() => {
    const fileMaskSuggestionPaths = [
      ...(activeFilePath === null ? [] : [activeFilePath]),
      ...(Array.isArray(openFilePaths) ? openFilePaths : []),
      ...(Array.isArray(recentFilePaths) ? recentFilePaths : []),
      ...(Array.isArray(changedFilePaths) ? changedFilePaths : []),
      ...fileResults.map((file) => file?.path),
      ...textResults.map((match) => match?.path),
    ];
    return suggestFileMasks(fileMaskSuggestionPaths, fileMaskHistory, 12);
  }, [activeFilePath, changedFilePaths, fileMaskHistory, fileResults, openFilePaths, recentFilePaths, textResults]);
  const rovingGroupPath = groups.some((group) => group.path === focusedGroupPath)
    ? focusedGroupPath
    : (groups[0]?.path ?? null);
  const activeIndex = Math.max(0, Math.min(Number(state.index) || 0, Math.max(0, occurrences.length - 1)));
  const active = occurrences[activeIndex] ?? null;
  const activeTextOccurrence = active?.kind === 'text' ? active : null;
  const replaceDisabledReasons = findReplaceDisabledReasons({
    replaceBusy: state.replaceBusy,
    searchGeneration: state.searchGeneration,
    loadedGeneration: state.loadedGeneration,
    loading: state.loading,
    error: state.error,
    matchCount: scopedMatches.length,
    activeKind: active?.kind,
    t,
  });
  const replaceAllDisabledReason = replaceDisabledReasons.all;
  const replaceCurrentDisabledReason = replaceDisabledReasons.current;
  const rerunFindSearch = () => {
    if (active !== null && typeof active.rowKey === 'string') {
      rerunSelectionRef.current = {
        rowKey: active.rowKey,
        path: active.path,
        index: activeIndex,
        generation: (state.searchGeneration ?? 0) + 1,
      };
    }
    onQuery(query);
  };
  const handoffRevision = Math.max(0, Number(state.handoffRevision) || 0);
  const handoffHandledRevision = Math.max(0, Number(state.handoffHandledRevision) || 0);
  const handoffTarget = React.useMemo(
    () => findToolHandoffTarget(scopedFileResults, scopedMatches, state.index, findGroupBy),
    [findGroupBy, scopedFileResults, scopedMatches, state.index],
  );
  const replaceAdvanceRevision = Math.max(0, Number(state.replaceAdvanceRevision) || 0);
  React.useEffect(() => {
    if (replaceMode) setReplaceExpanded(true);
  }, [replaceMode]);
  React.useEffect(() => {
    const target = rerunSelectionRef.current;
    if (target === null) return;
    if (target.generation !== state.searchGeneration) return;
    if (state.loadedGeneration !== state.searchGeneration) return;
    const targetIndex = occurrenceIndexByKey.get(target.rowKey) ?? -1;
    if (targetIndex < 0 && collapsedFiles.has(target.path)) {
      setCollapsedFiles((current) => {
        if (!current.has(target.path)) return current;
        const next = new Set(current);
        next.delete(target.path);
        return next;
      });
      return;
    }
    const restoredIndex = targetIndex >= 0 ? targetIndex : target.index;
    if (occurrences.length > 0) {
      onMove(0, occurrences.length, Math.min(restoredIndex, occurrences.length - 1));
    }
    rerunSelectionRef.current = null;
  }, [collapsedFiles, occurrenceIndexByKey, occurrences, onMove, state.loadedGeneration, state.searchGeneration]);
  React.useEffect(() => {
    const previousIdentity = previousResultGroupingRef.current;
    previousResultGroupingRef.current = resultGroupingIdentity;
    if (previousIdentity === null || previousIdentity === resultGroupingIdentity) return;
    onCollapsedFilesChange?.([]);
    if (state.index !== 0) onMove(0, 0);
  }, [onCollapsedFilesChange, onMove, resultGroupingIdentity, state.index]);
  React.useEffect(() => {
    const mask = String(state.fileMask ?? '');
    if (mask.trim() !== '') {
      setFileMaskEnabled(true);
      setFileMaskDraft(mask);
    }
  }, [state.fileMask]);
  React.useEffect(() => {
    if (!floating || pinned) return undefined;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[data-dsh-find-tool-window], [role="menu"], [data-dsh-search-replace-confirm]') !== null)
        return;
      onClose();
    };
    window.addEventListener('mousedown', onMouseDown, true);
    return () => window.removeEventListener('mousedown', onMouseDown, true);
  }, [floating, onClose, pinned]);
  const resultFiles = React.useMemo(
    () => (fileFilterMode ? scopedFileResults.length : groups.length + scopedFileResults.length),
    [fileFilterMode, groups, scopedFileResults],
  );
  const resultMatches = React.useMemo(
    () =>
      fileFilterMode ? 0 : groups.reduce((total, group) => total + group.matches.length, scopedFileResults.length),
    [fileFilterMode, groups, scopedFileResults],
  );
  const resultRowCount = React.useMemo(
    () => scopedFileResults.length + scopedMatches.length,
    [scopedFileResults, scopedMatches],
  );
  const scopedReplacementPaths = React.useMemo(
    () => new Set(scopedMatches.map((match) => match.path)),
    [scopedMatches],
  );
  const requestOpenInFindWindow = () => {
    if (!floating || !hasFindToolContentQuery(query)) return;
    if (
      searchEverywhereRequiresResultConfirmation(scopedFileResults, scopedMatches) &&
      !window.confirm(
        t('editor.searchTooManyResults', {
          count: resultRowCount,
        }),
      )
    )
      return;
    onOpenInFindWindow();
  };
  const openInFindWindowDisabledReason =
    floating !== true
      ? t('editor.findOpenInFindWindowAlreadyDocked')
      : !hasFindToolContentQuery(query)
        ? t('editor.findOpenInFindWindowEmptyQuery')
        : '';
  const findResultStatus =
    state.error !== null
      ? ''
      : state.loading === true
        ? t('editor.loading')
        : !hasFindToolContentQuery(query)
          ? t('editor.findToolEmptyQuery')
          : occurrences.length === 0
            ? t('editor.findToolNoMatches')
            : fileFilterMode
              ? t(state.truncated === true ? 'editor.searchResultCountTruncated' : 'editor.searchResultCount', {
                  count: occurrences.length,
                })
              : findToolResultSummary(t, resultMatches, resultFiles, state.truncated === true);
  const activeFindSearchOptionIds = searchEverywhereActiveOptionIds({
    caseSensitive: state.caseSensitive === true,
    wholeWords: state.wholeWords === true,
    regex: state.regex === true,
    fileMask: state.fileMask,
  });
  const activeFindSearchOptionLabels: Record<string, string> = {
    case: `${t('editor.searchMatchCase')} ⌃C`,
    words: `${t('editor.searchWholeWords')} ⌃W`,
    regex: `${t('editor.searchRegex')} ⌃X`,
    fileMask: t('editor.searchFileMaskLabel'),
  };
  const activeFindSearchOptionsText = activeFindSearchOptionIds
    .map((id) => activeFindSearchOptionLabels[id])
    .filter((label) => typeof label === 'string' && label !== '')
    .join('  ');
  const showFindSearchOptionSummary =
    fileFilterMode !== true &&
    hasFindToolContentQuery(query) &&
    state.loading !== true &&
    occurrences.length === 0 &&
    activeFindSearchOptionIds.length > 0;
  /**
   * Clear only the search filters that produced the empty result.
   * Scope, query, Preserve case and replacement drafts remain untouched.
   * @param {'case'|'words'|'regex'|'fileMask'|'all'} [kind='all'] - option family.
   * @returns {void}
   */
  const clearFindSearchOptions = (kind = 'all') => {
    if ((kind === 'all' || kind === 'case') && state.caseSensitive === true) onToggleCaseSensitive();
    if ((kind === 'all' || kind === 'words') && state.wholeWords === true) onToggleWholeWords();
    if ((kind === 'all' || kind === 'regex') && state.regex === true) onToggleRegex();
    if (
      (kind === 'all' || kind === 'fileMask') &&
      (fileMaskEnabled === true || String(state.fileMask ?? '').trim() !== '' || fileMaskDraft.trim() !== '')
    ) {
      setFileMaskEnabled(false);
      setFileMaskDraft('');
      onFileMaskChange('');
    }
    window.setTimeout(() => queryInputRef.current?.focus?.(), 0);
  };
  /**
   * Apply IDEA's query-field option shortcuts without stealing copy.
   * @param {KeyboardEvent} event - query or replacement input keydown.
   * @returns {boolean} whether the event was consumed.
   */
  const handleFindSearchOptionShortcut = (event: KeyboardEvent): boolean => {
    if (showFindSearchOptionSummary !== true) return false;
    const action = findSearchOptionShortcutAction(event);
    if (action === null) return false;
    const editable =
      event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement ? event.target : null;
    const idleSelection = editable === null || editable.selectionStart === editable.selectionEnd;
    if (idleSelection !== true) return false;
    if (action !== 'clear' && activeFindSearchOptionIds.includes(action) === false) return false;
    event.preventDefault();
    event.stopPropagation();
    clearFindSearchOptions(action === 'clear' ? 'all' : action);
    return true;
  };
  React.useEffect(() => {
    if (showFindSearchOptionSummary !== true) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.target instanceof Element) || event.target.closest('[data-dsh-find-tool-window]') === null) return;
      handleFindSearchOptionShortcut(event);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [
    activeFindSearchOptionsText,
    showFindSearchOptionSummary,
    state.caseSensitive,
    state.wholeWords,
    state.regex,
    state.fileMask,
  ]);
  const replaceFocusRequest = Math.max(0, Number(state.replaceFocusRequest) || 0);
  const previewWindow = React.useMemo(
    () => (previewOpen ? searchEverywherePreviewWindow(previewState.content, previewState.line) : null),
    [previewOpen, previewState.content, previewState.line],
  );
  const previewLines = React.useMemo(
    () =>
      previewWindow === null || previewState.content === ''
        ? []
        : previewState.content.split(/\r?\n/u).slice(previewWindow.start - 1, previewWindow.end),
    [previewState.content, previewWindow],
  );
  const previewColorizedLines = useCodePreviewColorizedLines(previewLines, previewState.path);
  const previewLineStarts = React.useMemo(() => findToolTextLineStarts(previewState.content), [previewState.content]);
  const previewScopeStart = previewWindow === null ? 0 : (previewLineStarts[previewWindow.start - 1] ?? 0);
  const previewScopeEnd =
    previewWindow === null ? 0 : (previewLineStarts[previewWindow.end] ?? previewState.content.length);
  const previewMatches = React.useMemo(
    () =>
      fileFilterMode || previewWindow === null || !hasFindToolContentQuery(query)
        ? []
        : editorFindResult(previewState.content, query, {
            caseSensitive: state.caseSensitive === true,
            wholeWords: state.wholeWords === true,
            regex: state.regex === true,
            scope: {
              start: previewScopeStart,
              end: previewScopeEnd,
            },
          }).matches,
    [
      fileFilterMode,
      previewScopeEnd,
      previewScopeStart,
      previewState.content,
      previewWindow,
      query,
      state.caseSensitive,
      state.regex,
      state.wholeWords,
    ],
  );
  const previewLineParts = React.useMemo(
    () =>
      previewWindow === null
        ? []
        : previewLines.map((code, index) => {
            const previewLineStart = previewLineStarts[previewWindow.start - 1 + index] ?? 0;
            return findToolPreviewLineParts(code, previewLineStart, previewMatches);
          }),
    [previewLineStarts, previewLines, previewMatches, previewWindow],
  );
  const openHistoryMenu = (event: React.SyntheticEvent<HTMLElement>, kind: 'query' | 'replace'): void => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const surfaceRect = event.currentTarget.closest('[data-dsh-find-tool-window]')?.getBoundingClientRect?.();
    const values =
      kind === 'query'
        ? Array.isArray(queryHistory)
          ? queryHistory
          : []
        : Array.isArray(replaceHistory)
          ? replaceHistory
          : [];
    const menuTop = findToolMenuTop(rect.bottom + 4, surfaceRect?.top ?? 0, surfaceRect?.bottom ?? window.innerHeight);
    setHistoryMenu({
      x: findToolMenuLeft(rect.left, surfaceRect?.left ?? 0, surfaceRect?.right ?? window.innerWidth),
      y: menuTop,
      maxHeight: findToolMenuMaxHeight(surfaceRect?.top ?? 0, surfaceRect?.bottom ?? window.innerHeight, menuTop),
      title: kind === 'query' ? t('editor.findSearchHistory') : t('editor.findReplaceHistory'),
      fallbackFocus:
        kind === 'query'
          ? () => queryInputRef.current?.focus?.()
          : () => (replaceInputRef.current ?? queryInputRef.current)?.focus?.(),
      escapeFocus:
        kind === 'query'
          ? () => queryInputRef.current?.focus?.()
          : () => (replaceInputRef.current ?? queryInputRef.current)?.focus?.(),
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
              id: `${kind}:${index}`,
              label: value,
              run: () => {
                setHistoryMenu(null);
                if (kind === 'query') onQuery(value);
                else onReplace(value);
                window.setTimeout(() => {
                  const input =
                    kind === 'query' ? queryInputRef.current : (replaceInputRef.current ?? queryInputRef.current);
                  input?.focus?.();
                }, 0);
              },
            })),
    });
  };
  const acceptFileMask = (value: unknown): void => {
    const next = typeof value === 'string' ? value.trim() : '';
    setFileMaskDraft(next);
    setFileMaskEnabled(next !== '');
    setFileMaskHistory(writeFileMaskHistory(next));
    onFileMaskChange(next);
  };
  const emitFindScopeChange = (mode: string, preset: string, directory: unknown): void => {
    if (typeof onScopeChange !== 'function') return;
    const normalizedPreset =
      preset === 'openFiles' ||
      preset === 'changedFiles' ||
      preset === 'currentFile' ||
      preset === 'recentlyViewedFiles' ||
      preset === 'gitTrackedFiles' ||
      preset === 'gitNonIgnoredFiles' ||
      (typeof preset === 'string' && /^custom:[a-z0-9][a-z0-9-]{0,63}$/u.test(preset))
        ? preset
        : 'projectFiles';
    onScopeChange({
      mode: mode === 'files' || mode === 'directory' || mode === 'scope' ? mode : 'project',
      preset: normalizedPreset,
      directory: mode === 'directory' && typeof directory === 'string' ? directory.trim() : '',
    });
  };
  const selectFindScopeMode = (mode: string): void => {
    setScopeMode(mode);
    emitFindScopeChange(mode, effectiveScopePreset, scopeDirectoryDraft);
  };
  const moveFindScopeMode = (mode: string): void => {
    selectFindScopeMode(mode);
    window.setTimeout(() => scopeModeButtonRefs.current.get(mode)?.focus?.(), 0);
  };
  const handleFindScopeModeKeyDown = (event: React.KeyboardEvent<HTMLElement>, current: string): void => {
    if (
      event.nativeEvent.isComposing === true ||
      event.metaKey === true ||
      event.ctrlKey === true ||
      event.altKey === true ||
      event.shiftKey === true
    )
      return;
    const target = findToolScopeModeTarget(current, event.key);
    if (target === null) return;
    event.preventDefault();
    event.stopPropagation();
    moveFindScopeMode(target);
  };
  const selectFindScopePreset = (preset: string): void => {
    setScopePreset(preset);
    emitFindScopeChange(scopeMode, preset, scopeDirectoryDraft);
    window.setTimeout(() => queryInputRef.current?.focus?.(), 0);
  };
  const toggleFindDirectoryRecursive = () => {
    const next = scopeRecursive !== true;
    setScopeRecursive(next);
    onDirectoryRecursiveChange?.(next);
    window.setTimeout(() => queryInputRef.current?.focus?.(), 0);
  };
  const openFindDirectoryPicker = () => {
    setDirectoryPicker({
      query: '',
      index: 0,
      loading: true,
      directories: [],
      parent: scopeDirectoryDraft.trim(),
      rootName: t('editor.findSelectDirectoryRoot'),
    });
    void callFs({
      op: 'directories',
    })
      .then((value) => {
        const directories = (Array.isArray(value?.directories) ? value.directories : []).filter(
          (path) => typeof path === 'string',
        );
        setDirectoryPicker((current: DirectoryPickerState | null) =>
          current === null
            ? current
            : {
                ...current,
                loading: false,
                directories,
              },
        );
      })
      .catch((failure) => {
        setDirectoryPicker(null);
        onNotify(failure instanceof Error ? failure.message : String(failure));
      });
  };
  const openFileMaskMenu = (event: React.SyntheticEvent<HTMLElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const surfaceRect = event.currentTarget.closest('[data-dsh-find-tool-window]')?.getBoundingClientRect?.();
    const historyItems = fileMaskHistory.map((value, index) => ({
      id: `file-mask:${index}`,
      label: value,
      run: () => {
        setFileMaskMenu(null);
        acceptFileMask(value);
        window.setTimeout(() => fileMaskInputRef.current?.focus?.(), 0);
      },
    }));
    const suggestionItems = fileMaskSuggestions.map((value, index) => ({
      id: `file-mask-suggestion:${index}`,
      label: value,
      run: () => {
        setFileMaskMenu(null);
        acceptFileMask(value);
        window.setTimeout(() => fileMaskInputRef.current?.focus?.(), 0);
      },
    }));
    const menuTop = findToolMenuTop(rect.bottom + 4, surfaceRect?.top ?? 0, surfaceRect?.bottom ?? window.innerHeight);
    setFileMaskMenu({
      x: findToolMenuLeft(rect.right - 220, surfaceRect?.left ?? 0, surfaceRect?.right ?? window.innerWidth),
      y: menuTop,
      maxHeight: findToolMenuMaxHeight(surfaceRect?.top ?? 0, surfaceRect?.bottom ?? window.innerHeight, menuTop),
      title: t('editor.searchFileMaskLabel'),
      fallbackFocus: () => fileMaskInputRef.current?.focus?.(),
      items: [
        ...(historyItems.length === 0 && suggestionItems.length === 0
          ? [
              {
                id: 'empty',
                label: t('editor.findHistoryEmpty'),
                disabled: true,
                run: () => {},
              },
            ]
          : []),
        ...historyItems,
        ...(historyItems.length > 0 && suggestionItems.length > 0 ? [null] : []),
        ...suggestionItems,
        null,
        {
          id: 'clearFileMask',
          label: t('editor.findFileMaskClear'),
          disabled: fileMaskDraft === '',
          run: () => {
            setFileMaskMenu(null);
            acceptFileMask('');
            window.setTimeout(() => fileMaskInputRef.current?.focus?.(), 0);
          },
        },
      ],
    });
  };
  const openFilterMenu = (event: React.SyntheticEvent<HTMLElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const surfaceRect = event.currentTarget.closest('[data-dsh-find-tool-window]')?.getBoundingClientRect?.();
    const contextFilter = normalizeTextSearchContextFilter(state.contextFilter);
    const select = (value: string): void => {
      setFilterMenu(null);
      onContextFilterChange(value);
      window.setTimeout(() => queryInputRef.current?.focus?.(), 0);
    };
    const menuTop = findToolMenuTop(rect.bottom + 4, surfaceRect?.top ?? 0, surfaceRect?.bottom ?? window.innerHeight);
    setFilterMenu({
      x: findToolMenuLeft(rect.right - 220, surfaceRect?.left ?? 0, surfaceRect?.right ?? window.innerWidth),
      y: menuTop,
      maxHeight: findToolMenuMaxHeight(surfaceRect?.top ?? 0, surfaceRect?.bottom ?? window.innerHeight, menuTop),
      title: t('editor.findFilterResults'),
      items: [
        {
          id: 'anywhere',
          label: t('editor.findFilterAnywhere'),
          shortcut: contextFilter === 'anywhere' ? '✓' : '',
          run: () => select('anywhere'),
        },
        null,
        {
          id: 'comments',
          label: t('editor.findFilterComments'),
          shortcut: contextFilter === 'comments' ? '✓' : '',
          run: () => select('comments'),
        },
        {
          id: 'strings',
          label: t('editor.findFilterStringLiterals'),
          shortcut: contextFilter === 'strings' ? '✓' : '',
          run: () => select('strings'),
        },
        {
          id: 'exceptComments',
          label: t('editor.findFilterExceptComments'),
          shortcut: contextFilter === 'exceptComments' ? '✓' : '',
          run: () => select('exceptComments'),
        },
        {
          id: 'exceptStrings',
          label: t('editor.findFilterExceptStringLiterals'),
          shortcut: contextFilter === 'exceptStrings' ? '✓' : '',
          run: () => select('exceptStrings'),
        },
        {
          id: 'exceptBoth',
          label: t('editor.findFilterExceptBoth'),
          shortcut: contextFilter === 'exceptBoth' ? '✓' : '',
          run: () => select('exceptBoth'),
        },
      ],
    });
  };
  const selectFindGroupBy = (value: unknown): void => {
    const next = normalizeFindGroupBy(value);
    setFindGroupBy(next);
    setGroupByMenu(null);
    try {
      window.localStorage.setItem('dsh-editor.find.groupBy', next);
    } catch {
      /* storage-less browsers keep the in-memory mode */
    }
    window.setTimeout(() => queryInputRef.current?.focus?.(), 0);
  };
  const openGroupByMenu = (event: React.SyntheticEvent<HTMLElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setGroupByMenu({
      x: Math.max(4, rect.right - 240),
      y: rect.bottom + 4,
      title: t('editor.findGroupByMenu'),
      fallbackFocus: () => queryInputRef.current?.focus?.(),
      items: [
        {
          id: 'directoryStructure',
          label: t('editor.findGroupByDirectory'),
          shortcut: '⌃D',
          ariaKeyShortcuts: 'Control+D',
          active: findGroupBy === 'directory',
          run: () => selectFindGroupBy('directory'),
        },
        {
          id: 'fileStructure',
          label: t('editor.findGroupByFile'),
          shortcut: '⌃S',
          ariaKeyShortcuts: 'Control+S',
          active: findGroupBy === 'file',
          run: () => selectFindGroupBy('file'),
        },
        null,
        ...[
          {
            id: 'module',
            label: t('editor.findGroupByModule'),
            shortcut: '⌃M',
          },
          {
            id: 'flattenModules',
            label: t('editor.findGroupByFlattenModules'),
            shortcut: '⌃O',
          },
          {
            id: 'package',
            label: t('editor.findGroupByPackage'),
            shortcut: '⌃P',
          },
          {
            id: 'productionTest',
            label: t('editor.findGroupByProductionTest'),
          },
          {
            id: 'usageType',
            label: t('editor.findGroupByUsageType'),
            shortcut: '⌃T',
          },
          {
            id: 'mergeSameLine',
            label: t('editor.findGroupByMergeSameLine'),
            shortcut: '⌃L',
          },
        ].map((item) => ({
          ...item,
          disabled: true,
          disabledReason: t('editor.findGroupByUnavailable'),
          run: () => {},
        })),
      ],
    });
  };
  const togglePinned = () => {
    setPinned((current) => {
      const next = !current;
      try {
        window.localStorage.setItem('dsh-editor.find.pinned', next ? '1' : '0');
      } catch {
        /* storage-less browsers keep the in-memory state */
      }
      return next;
    });
  };
  const toggleOpenResultsInNewTab = () => {
    setOpenResultsInNewTab((current) => {
      const next = !current;
      try {
        window.localStorage.setItem('dsh-editor.find.openInNewTab', next ? '1' : '0');
      } catch {
        /* storage-less browsers keep the in-memory setting */
      }
      return next;
    });
  };
  const focusReplaceInput = () => {
    setReplaceExpanded(true);
    if (replaceInputRef.current !== null) {
      replaceInputRef.current.focus();
      return;
    }
    replaceFocusPendingRef.current = true;
    onReplaceMode();
  };
  const openFindResult = (result: SearchTextResult | SearchFileResult | null): void => {
    if (result === null || typeof result !== 'object') return;
    onOpen(result, openResultsInNewTab === true);
    if (floating) onClose();
  };
  React.useEffect(() => {
    if (!replaceExpanded || replaceFocusPendingRef.current !== true) return;
    replaceFocusPendingRef.current = false;
    window.setTimeout(() => replaceInputRef.current?.focus?.(), 0);
  }, [replaceExpanded]);
  React.useEffect(() => {
    if (!replaceExpanded || replaceFocusRequest === 0) return;
    window.setTimeout(() => replaceInputRef.current?.focus?.(), 0);
  }, [replaceFocusRequest, replaceExpanded]);
  React.useEffect(() => {
    if (floating || activeTabId === null) return;
    const tab = rootRef.current?.querySelector<HTMLElement>(`[data-dsh-find-session-tab="${activeTabId}"]`) ?? null;
    tab?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    tab?.focus?.({ preventScroll: true });
  }, [activeTabId, floating]);
  const openFindResultMenuAt = (x: number, y: number, result: FindToolOccurrenceRow | null): void => {
    if (result?.kind !== 'file' && result?.kind !== 'text') return;
    setResultMenu({
      x,
      y,
      title: basename(result.path),
      fallbackFocus: () => queryInputRef.current?.focus?.(),
      items: searchResultContextItems({
        t,
        result,
        onCloseMenu: () => setResultMenu(null),
        onOpenEditor: () => openFindResult(result),
        onOpenInRightSplit: () =>
          onOpenInRightSplit(
            result.path,
            result.kind === 'text'
              ? {
                  path: result.path,
                  line: result.line,
                  column: result.column,
                }
              : null,
          ),
        onReplace: fileFilterMode ? undefined : () => focusReplaceInput(),
        onRevealResult: () => onRevealResult(result.path),
        onNotify,
      }),
    });
  };
  const toggleGroup = (path: string): void => {
    setCollapsedFiles((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };
  const focusGroupButton = (path: unknown): void => {
    if (typeof path !== 'string' || path === '') return;
    setFocusedGroupPath(path);
    window.setTimeout(() => groupButtonRefs.current.get(path)?.focus?.(), 0);
  };
  const focusOccurrenceByIndex = (position: number): void => {
    if (!Number.isFinite(position) || occurrences.length === 0) return;
    const next = Math.max(0, Math.min(occurrences.length - 1, position));
    const rowKey = occurrences[next]?.rowKey;
    if (typeof rowKey !== 'string' || rowKey === '') return;
    onMove(0, occurrences.length, next);
    window.setTimeout(() => occurrenceRefs.current.get(rowKey)?.focus?.(), 0);
  };
  const focusAdjacentOccurrence = (position: number, direction: number): void => {
    if (!Number.isFinite(position) || direction === 0) return;
    focusOccurrenceByIndex(position + direction);
  };
  const handleOccurrenceKeyDown = (event: React.KeyboardEvent<HTMLElement>, rowKey: string, position: number): void => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'ContextMenu' || (event.shiftKey === true && event.key === 'F10')) {
      const result = occurrences[position];
      if (result?.kind === 'file' || result?.kind === 'text') {
        event.preventDefault();
        event.stopPropagation();
        const rect = occurrenceRefs.current.get(rowKey)?.getBoundingClientRect?.();
        openFindResultMenuAt(rect?.left ?? 20, rect?.bottom ?? 20, result);
      }
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      event.stopPropagation();
      focusOccurrenceByIndex(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      event.stopPropagation();
      focusOccurrenceByIndex(occurrences.length - 1);
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      if (event.key === 'ArrowDown' && rowKey.startsWith('file:')) {
        const nextTextGroupPath = findToolNextTextGroupPath(occurrences, position);
        if (nextTextGroupPath !== null) {
          event.preventDefault();
          event.stopPropagation();
          focusGroupButton(nextTextGroupPath);
          return;
        }
      }
      const target = findToolGroupBoundaryTarget(groups, rowKey, event.key);
      if (target !== null && target.kind === 'group') {
        event.preventDefault();
        event.stopPropagation();
        focusGroupButton(target.path);
        return;
      }
      if (
        (event.key === 'ArrowDown' && position < occurrences.length - 1) ||
        (event.key === 'ArrowUp' && position > 0)
      ) {
        event.preventDefault();
        event.stopPropagation();
        focusAdjacentOccurrence(position, event.key === 'ArrowUp' ? -1 : 1);
      }
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      if (occurrences[position] !== undefined) openFindResult(occurrences[position]);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };
  const handleGroupKeyDown = (
    event: React.KeyboardEvent<HTMLElement>,
    group: { path: string; matches: Array<{ path?: string; line?: number; column?: number }> },
  ): void => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'ArrowDown' && !collapsedFiles.has(group.path) && group.matches.length > 0) {
      const first = group.matches[0];
      const rowKey = `text:${first.path}:${first.line}:${first.column}`;
      const position = occurrenceIndexByKey.get(rowKey) ?? -1;
      if (position >= 0) {
        event.preventDefault();
        event.stopPropagation();
        focusOccurrenceByIndex(position);
        return;
      }
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Home' || event.key === 'End') {
      const targetPath = findToolGroupTarget(groups, rovingGroupPath, event.key);
      if (targetPath === null) return;
      event.preventDefault();
      event.stopPropagation();
      focusGroupButton(targetPath);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      toggleGroup(group.path);
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      event.stopPropagation();
      setCollapsedFiles((current) => new Set([...current, group.path]));
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      event.stopPropagation();
      setCollapsedFiles((current) => {
        const next = new Set(current);
        next.delete(group.path);
        return next;
      });
    }
  };
  const toolbarActions = (
    [
      ...(floating
        ? []
        : [
            {
              id: 'rerun',
              icon: 'refresh',
              label: t('editor.findRerun'),
              disabled: !hasFindToolContentQuery(query) || state.loading === true,
              onClick: rerunFindSearch,
              group: 'navigate',
              pinned: true,
            },
            {
              id: 'replaceMode',
              icon: 'replace',
              label: replaceExpanded ? t('editor.findToolHideReplace') : t('editor.findToolShowReplace'),
              active: replaceExpanded,
              onClick: () => {
                if (replaceExpanded) setReplaceExpanded(false);
                else focusReplaceInput();
              },
              group: 'replace',
            },
            {
              id: 'newLine',
              icon: 'wrap',
              label: t('editor.findNewLine'),
              active: searchNewLine,
              onClick: () => setSearchNewLine((value) => !value),
              group: 'search',
            },
          ]),
      {
        id: 'undoReplace',
        icon: 'undo',
        label: t('editor.findUndoLastReplace'),
        disabled: canUndoLastReplace !== true || state.replaceBusy === true,
        onClick: onUndoLastReplace,
        group: 'replace',
        pinned: findToolReplaceHistoryActionPinned(floating, canUndoLastReplace === true),
      },
      {
        id: 'redoReplace',
        icon: 'redo',
        label: t('editor.findRedoLastReplace'),
        disabled: canRedoLastReplace !== true || state.replaceBusy === true,
        onClick: onRedoLastReplace,
        group: 'replace',
        pinned: findToolReplaceHistoryActionPinned(floating, canRedoLastReplace === true),
      },
      {
        id: 'previous',
        icon: 'chevronUp',
        label: t('editor.previousOccurrence'),
        disabled: occurrences.length === 0,
        onClick: () => onMove(-1, occurrences.length),
        group: 'navigate',
      },
      {
        id: 'next',
        icon: 'chevronDown',
        label: t('editor.nextOccurrence'),
        disabled: occurrences.length === 0,
        onClick: () => onMove(1, occurrences.length),
        group: 'navigate',
      },
      ...(floating
        ? []
        : [
            {
              id: 'settings',
              icon: 'settings',
              label: t('editor.findSettings'),
              onClick: onOpenSettings,
              group: 'configure',
              pinned: true,
            },
            {
              id: 'groupBy',
              icon: 'groupBy',
              label: t('editor.findGroupByMenu'),
              active: groupByMenu !== null,
              onClick: openGroupByMenu,
              ariaHasPopup: 'menu',
              ariaExpanded: groupByMenu !== null,
              group: 'filter',
              pinned: true,
            },
          ]),
      {
        id: 'expand',
        icon: 'expand',
        label: t('editor.expandAll'),
        disabled: collapsedFiles.size === 0,
        onClick: () => setCollapsedFiles(new Set()),
        group: 'result',
      },
      {
        id: 'collapse',
        icon: 'collapse',
        label: t('editor.collapseAll'),
        disabled: groups.length === 0 || collapsedFiles.size >= groups.length,
        onClick: () => setCollapsedFiles(new Set(groups.map((group) => group.path))),
        group: 'result',
      },
      {
        id: 'preview',
        icon: 'preview',
        label: t('editor.findToolPreviewSource'),
        active: previewOpen,
        onClick: () => setPreviewOpen((value) => !value),
        group: 'result',
        pinned: !floating,
      },
      {
        id: 'filterSearch',
        icon: 'filter',
        label: t('editor.findFilterResults'),
        active: filterMenu !== null,
        onClick: openFilterMenu,
        ariaHasPopup: 'menu',
        ariaExpanded: filterMenu !== null,
        group: 'filter',
        pinned: true,
      },
      {
        id: 'pin',
        icon: 'pin',
        label: pinned ? t('editor.findUnpinWindow') : t('editor.findPinWindow'),
        active: pinned,
        onClick: togglePinned,
        group: 'window',
        pinned: true,
      },
      {
        id: 'include',
        icon: 'project',
        label: t('editor.includeNonProjectItems'),
        active: state.includeExcluded === true,
        onClick: onToggleIncludeExcluded,
        group: 'search',
      },
    ] as unknown as ToolbarActionLike[]
  ).filter((action) => floating || action.id !== 'pin');
  const popupHeaderActions = toolbarActions.filter(
    (action) =>
      action.id === 'filterSearch' ||
      action.id === 'pin' ||
      (action.id === 'undoReplace' && canUndoLastReplace === true) ||
      (action.id === 'redoReplace' && canRedoLastReplace === true),
  );
  React.useEffect(() => {
    if (handoffRevision <= handoffHandledRevision) return;
    if (handoffTarget === null) {
      onHandoffHandled?.(handoffRevision);
      return;
    }
    if (handoffTarget.kind === 'text' && collapsedFiles.has(handoffTarget.path)) {
      setCollapsedFiles((current) => {
        if (!current.has(handoffTarget.path)) return current;
        const next = new Set(current);
        next.delete(handoffTarget.path);
        return next;
      });
      return;
    }
    const visiblePosition = occurrenceIndexByKey.get(handoffTarget.rowKey) ?? -1;
    if (visiblePosition < 0) return;
    if (state.index !== visiblePosition) onMove(0, occurrences.length, visiblePosition);
    onHandoffHandled?.(handoffRevision);
  }, [
    collapsedFiles,
    handoffHandledRevision,
    handoffRevision,
    handoffTarget,
    occurrenceIndexByKey,
    occurrences,
    onHandoffHandled,
    onMove,
    state.index,
  ]);
  React.useEffect(() => {
    if (replaceAdvanceRevision === 0 || replaceAdvanceRevision === replaceAdvanceReadyRef.current) return;
    if (state.loading === true || state.loadedGeneration !== state.searchGeneration) return;
    replaceAdvanceReadyRef.current = replaceAdvanceRevision;
    if (occurrences.length === 0) return;
    const nextIndex = findToolReplaceAdvanceIndex(occurrences, state.replaceAdvanceRowKey, state.index);
    onMove(0, occurrences.length, nextIndex);
  }, [
    occurrences,
    onMove,
    replaceAdvanceRevision,
    state.index,
    state.loadedGeneration,
    state.replaceAdvanceRowKey,
    state.searchGeneration,
    state.loading,
  ]);
  React.useEffect(() => {
    listRef.current?.querySelector?.('[data-dsh-find-active="1"]')?.scrollIntoView?.({
      block: 'nearest',
    });
  }, [activeIndex, query, scopeMode, scopePreset, state.matches, state.files, collapsedFiles]);
  React.useEffect(() => {
    if (handoffRevision > handoffHandledRevision) return;
    if (state.index !== activeIndex) onMove(0, occurrences.length, activeIndex);
  }, [handoffHandledRevision, handoffRevision, state.index, activeIndex, occurrences.length, onMove]);
  React.useEffect(() => {
    if (state.loading === true || state.loadedGeneration !== state.searchGeneration) return;
    const target =
      active === null ? queryInputRef.current : (occurrenceRefs.current.get(active.rowKey) ?? queryInputRef.current);
    const focusStillInside = rootRef.current?.contains(document.activeElement) === true;
    if (findShouldRestoreFocusAfterResultsChange(findFocusOwnedRef.current, focusStillInside, target !== null))
      target?.focus?.();
  }, [active?.rowKey, occurrences.length, state.loadedGeneration, state.searchGeneration, state.loading]);
  React.useEffect(() => {
    if (!previewOpen || active === null || typeof active.path !== 'string' || active.path === '') {
      if (previewOpen && rerunSelectionRef.current !== null && state.loading === true) {
        return undefined;
      }
      setPreviewState({
        loading: false,
        path: '',
        content: '',
        line: 1,
        error: null,
      });
      return undefined;
    }
    let cancelled = false;
    setPreviewState({
      loading: true,
      path: active.path,
      content: '',
      line: active.line ?? 1,
      error: null,
    });
    if (active.dirty === true) {
      const entry = openFilesRef.current.find((file) => file.path === active.path);
      const content = entry?.content ?? '';
      setPreviewState({
        loading: false,
        path: active.path,
        content,
        line: active.line ?? 1,
        error: null,
      });
      return undefined;
    }
    const previewAbort = new AbortController();
    callFs(
      {
        op: 'read',
        path: active.path,
      },
      {
        signal: previewAbort.signal,
      },
    )
      .then((value) => {
        if (cancelled) return;
        setPreviewState({
          loading: false,
          path: active.path,
          content: typeof value?.content === 'string' ? value.content : '',
          line: active.line ?? 1,
          error: null,
        });
      })
      .catch((failure) => {
        if (cancelled) return;
        if (failure?.name === 'AbortError' || failure?.name === 'CanceledError') return;
        setPreviewState({
          loading: false,
          path: active.path,
          content: '',
          line: active.line ?? 1,
          error: failure instanceof Error ? failure.message : String(failure),
        });
      });
    return () => {
      cancelled = true;
      previewAbort.abort();
    };
  }, [previewOpen, active?.rowKey, state.loading]);
  React.useLayoutEffect(() => {
    if (
      previewOpen !== true ||
      previewState.loading === true ||
      previewState.error !== null ||
      active === null ||
      active.kind !== 'text'
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
      /* Center before paint, then repeat after the current layout settles. */
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
    previewState.path,
    previewState.line,
    previewState.content,
    previewSoftWrap,
    active?.rowKey,
    active?.kind,
  ]);
  const handleListKeyDown = (event: React.KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      onMove(1, occurrences.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      onMove(-1, occurrences.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (active !== null) openFindResult(active);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };
  const previewParts = (match: { path?: string; preview?: string; rowKey?: string }) =>
    (previewPartsByRowKey.get(typeof match.rowKey === 'string' ? match.rowKey : '') ?? []).map((part, index) => (
      <span
        key={`${match.rowKey}:${index}`}
        style={part.match ? styles.findToolHighlight : null}>
        {part.text}
      </span>
    ));
  const trapFindToolPopupFocus = (event: React.KeyboardEvent<HTMLDivElement>): boolean => {
    if (floating !== true || event.key !== 'Tab') return false;
    const root = event.currentTarget instanceof Element ? event.currentTarget : null;
    return trapDialogFocus(event, root);
  };
  const handleFindToolRootKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.nativeEvent.isComposing === true) return;
    if (floating === true && trapFindToolPopupFocus(event)) return;
    const target = event.target instanceof Element ? event.target : null;
    if (
      event.ctrlKey === true &&
      event.metaKey !== true &&
      event.altKey !== true &&
      event.shiftKey !== true &&
      target?.closest('input, textarea, select, [role="menu"]') == null
    ) {
      const key = event.key.toLowerCase();
      if (key === 'd' || key === 's') {
        event.preventDefault();
        event.stopPropagation();
        selectFindGroupBy(key === 'd' ? 'directory' : 'file');
        return;
      }
    }
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    /* ContextMenu handles Escape in its capture listener. This guard also
       makes that ownership explicit if the menu is rendered inline. */
    if (target !== null && target.closest('[role="menu"]') !== null) return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
  };
  const resultCountText =
    state.loading === true
      ? t('editor.loading')
      : fileFilterMode
        ? t(state.truncated === true ? 'editor.searchResultCountTruncated' : 'editor.searchResultCount', {
            count: occurrences.length,
          })
        : findToolResultSummary(t, resultMatches, resultFiles, state.truncated === true);
  const resultCount = findToolCompactCount(
    fileFilterMode ? occurrences.length : resultMatches,
    resultFiles,
    fileFilterMode,
    state.truncated === true,
  );
  const compactResultCount = (
    <span
      data-dsh-find-count-compact=''
      style={styles.findToolCompactCount}>
      <span style={styles.findToolCompactCountGroup}>
        {resultCount.truncated ? '≥' : ''}
        {resultCount.count}
        <Icon
          name='matchCount'
          size={13}
        />
      </span>
      {resultCount.fileCount === null ? null : (
        <>
          <span style={styles.findToolCompactCountSeparator}>/</span>
          <span style={styles.findToolCompactCountGroup}>
            {resultCount.fileCount}
            <Icon
              name='fileStack'
              size={13}
            />
          </span>
        </>
      )}
    </span>
  );
  const queryControl = (
    <QueryField
      ref={queryInputRef}
      style={{
        ...styles.findToolInput,
        ...(searchNewLine ? styles.findToolMultilineInput : null),
      }}
      autoFocus={true}
      value={state.query}
      placeholder={t(fileFilterMode ? 'editor.findFileFilterPlaceholder' : 'editor.findToolSearchPlaceholder')}
      aria-label={t(fileFilterMode ? 'editor.findFileFilterPlaceholder' : 'editor.findToolSearchPlaceholder')}
      role='combobox'
      aria-autocomplete='list'
      aria-expanded={occurrences.length > 0}
      aria-controls={FIND_TOOL_LISTBOX_ID}
      aria-activedescendant={active === null ? undefined : findToolOptionId(active.rowKey)}
      onChange={(event) => onQuery(event.target.value)}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing === true) return;
        if (searchNewLine && event.key === 'Enter' && event.metaKey !== true && event.ctrlKey !== true) return;
        if (
          floating &&
          event.key === 'Enter' &&
          (event.metaKey === true || event.ctrlKey === true) &&
          event.altKey !== true &&
          event.shiftKey !== true &&
          resultRowCount > 0
        ) {
          event.preventDefault();
          event.stopPropagation();
          requestOpenInFindWindow();
          return;
        }
        if (
          (event.key === 'ContextMenu' || (event.shiftKey === true && event.key === 'F10')) &&
          active !== null &&
          (active.kind === 'file' || active.kind === 'text')
        ) {
          event.preventDefault();
          event.stopPropagation();
          const rect = occurrenceRefs.current.get(active.rowKey)?.getBoundingClientRect?.();
          openFindResultMenuAt(rect?.left ?? 20, rect?.bottom ?? 20, active);
        } else if (event.altKey === true && event.key === 'ArrowDown') {
          openHistoryMenu(event, 'query');
          return;
        } else handleListKeyDown(event);
      }}></QueryField>
  );
  const searchFilterControls = (
    <span
      style={styles.findToolFilterGroup}
      role='group'
      aria-label={t('editor.searchFilter')}>
      <ToolbarButton
        style={styles.findToolFilterButton}
        icon='matchCase'
        label={t('editor.searchMatchCase')}
        active={state.caseSensitive === true}
        onClick={onToggleCaseSensitive}
      />
      <ToolbarButton
        style={styles.findToolFilterButton}
        icon='wholeWords'
        label={t('editor.searchWholeWords')}
        active={state.wholeWords === true}
        disabled={state.regex === true}
        onClick={onToggleWholeWords}
      />
      <ToolbarButton
        style={styles.findToolFilterButton}
        icon='regex'
        label={t('editor.searchRegex')}
        active={fileFilterMode !== true && state.regex === true}
        disabled={fileFilterMode}
        onClick={onToggleRegex}
      />
    </span>
  );
  const fileMaskControl = (
    <label
      className='dsh-editor-find-file-mask-control'
      data-dsh-find-file-mask=''
      style={styles.findToolFileMaskControl}>
      <input
        type='checkbox'
        checked={fileMaskEnabled}
        aria-label={t('editor.searchFileMaskLabel')}
        title={t('editor.searchFileMaskLabel')}
        onChange={(event) => {
          const enabled = event.target.checked;
          setFileMaskEnabled(enabled);
          onFileMaskChange(enabled ? fileMaskDraft : '');
          window.setTimeout(() => {
            (enabled ? fileMaskInputRef : queryInputRef).current?.focus?.();
          }, 0);
        }}
      />
      <span className='dsh-editor-find-file-mask-label'>{`${t('editor.searchFileMaskLabel')}:`}</span>
      <input
        ref={fileMaskInputRef}
        className='dsh-editor-find-file-mask-input'
        style={styles.findToolFileMaskInput}
        value={fileMaskDraft}
        disabled={fileMaskEnabled !== true}
        placeholder='.ts, .md'
        aria-label={t('editor.searchFileMask')}
        onChange={(event) => {
          const value = event.target.value;
          setFileMaskDraft(value);
          if (fileMaskEnabled) onFileMaskChange(value);
        }}
        onBlur={() => {
          if (fileMaskDraft.trim() !== '') setFileMaskHistory(writeFileMaskHistory(fileMaskDraft));
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing === true) return;
          if (event.key !== 'Enter') return;
          event.preventDefault();
          acceptFileMask(fileMaskDraft);
        }}
      />
      <ToolbarButton
        icon='chevronDown'
        label={t('editor.findFileMaskHistory')}
        onClick={openFileMaskMenu}
        ariaHasPopup='menu'
        ariaExpanded={fileMaskMenu !== null}
      />
    </label>
  );
  const searchHistoryControl = (
    <ToolbarButton
      icon={floating ? 'chevronDown' : 'history'}
      label={t('editor.findSearchHistory')}
      ariaHasPopup='menu'
      ariaExpanded={historyMenu?.title === t('editor.findSearchHistory')}
      onClick={(event) => openHistoryMenu(event, 'query')}
    />
  );
  const clearSearchControl =
    query === '' ? null : (
      <ToolbarButton
        icon='close'
        label={t('editor.findClearSearch')}
        style={styles.findToolClearSearch}
        onClick={() => {
          onQuery('');
          window.setTimeout(() => queryInputRef.current?.focus?.(), 0);
        }}
      />
    );
  const searchNewLineControl = (
    <label style={styles.findToolNewLine}>
      <input
        type='checkbox'
        data-dsh-find-search-new-line=''
        aria-label={t('editor.findNewLine')}
        checked={searchNewLine}
        onChange={(event) => setSearchNewLine(event.target.checked)}
      />
      <span>{t('editor.findNewLine')}</span>
    </label>
  );
  const tabItems =
    tabs.length > 0
      ? tabs
      : [
          {
            id: activeTabId ?? 'active',
            state,
          },
        ];
  return (
    <div
      style={
        floating
          ? {
              ...styles.findTool,
              position: 'relative',
            }
          : styles.findTool
      }
      ref={rootRef}
      data-dsh-find-tool-window=''
      data-dsh-find-tool-surface={floating ? 'popup' : 'dock'}
      role={floating ? 'dialog' : 'region'}
      aria-modal={floating ? 'true' : undefined}
      aria-label={surfaceTitle}
      onFocusCapture={() => {
        findFocusOwnedRef.current = true;
      }}
      onBlurCapture={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && !event.currentTarget.contains(next)) findFocusOwnedRef.current = false;
      }}
      onKeyDown={handleFindToolRootKeyDown}>
      <div
        style={floating ? styles.findToolPopupControls : styles.findToolDockControls}
        className='dsh-editor-find-controls'
        data-dsh-find-controls={floating ? undefined : ''}>
        {floating ? (
          <div
            style={{
              ...styles.findToolToolbar,
              ...styles.findToolPopupToolbar,
              cursor: 'move',
              userSelect: 'none',
              touchAction: 'none',
            }}
            data-dsh-find-popup-drag=''
            onPointerDown={(event) => {
              const target = event.target instanceof Element ? event.target : null;
              if (target !== null && target.closest('button, input, textarea, select, a, [role="menuitem"]') !== null)
                return;
              onPopupDragStart?.(event);
            }}>
            <span
              className='dsh-editor-find-tool-title'
              style={{
                ...styles.findToolTitle,
                ...styles.findToolPopupTitle,
              }}
              title={query}>
              {surfaceTitle}
            </span>
            {!hasFindToolContentQuery(query) ? null : (
              <span
                className='dsh-editor-find-tool-count'
                title={resultCountText}
                aria-label={resultCountText}
                style={styles.findToolCount}>
                {compactResultCount}
              </span>
            )}
            <span
              className='dsh-editor-find-tool-spacer'
              style={styles.findToolSpacer}
            />
            {fileMaskControl}
            <CompactActionBar
              actions={popupHeaderActions}
              t={t}
              ariaLabel={t('editor.findInFilesAction')}
              style={styles.findToolHeaderActions}
            />
          </div>
        ) : (
          <div
            style={styles.findToolDockHeader}
            data-dsh-find-dock-header=''>
            <div style={styles.findToolDockScroll}>
              <div
                style={styles.findToolDockTabList}
                data-dsh-find-tab-list-wrapper=''>
                <div
                  role='tablist'
                  aria-label={t('editor.findInFilesTitle')}
                  style={styles.findToolDockTabScroll}>
                  {tabItems.map((tab) => {
                    const tabQuery = typeof tab.state.query === 'string' ? tab.state.query.trim() : '';
                    const label = tabQuery === '' ? t('editor.findToolDockEmptyTitle') : tabQuery;
                    const selected = tab.id === activeTabId;
                    return (
                      <span
                        key={tab.id}
                        style={{
                          ...styles.findToolDockTab,
                          ...(selected ? styles.findToolDockTabActive : null),
                        }}>
                        <button
                          type='button'
                          role='tab'
                          aria-selected={selected}
                          tabIndex={selected ? 0 : -1}
                          title={tabQuery}
                          data-dsh-find-session-tab={tab.id}
                          style={styles.findToolDockTabLabel}
                          onClick={() => onSelectFindToolTab?.(tab.id)}>
                          {label}
                        </button>
                        <button
                          type='button'
                          aria-label={t('editor.findToolCloseTab', { query: label })}
                          title={t('editor.findToolCloseTab', { query: label })}
                          data-dsh-find-session-close={tab.id}
                          style={styles.findToolDockTabClose}
                          onClick={(event) => {
                            event.stopPropagation();
                            onCloseFindToolTab?.(tab.id);
                          }}>
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
            <span
              style={styles.findToolDockFixedTools}
              data-dsh-find-window-actions={floating ? undefined : ''}>
              {!hasFindToolContentQuery(query) ? null : (
                <span
                  className='dsh-editor-find-tool-count'
                  title={resultCountText}
                  aria-label={resultCountText}
                  style={styles.findToolCount}>
                  {compactResultCount}
                </span>
              )}
              {searchFilterControls}
              <span style={{ position: 'relative' }}>
                <ToolbarButton
                  icon='file'
                  label={
                    fileMaskDraft.trim() === ''
                      ? t('editor.searchFileMask')
                      : `${t('editor.searchFileMask')}: ${fileMaskDraft}`
                  }
                  active={fileMaskEnabled === true || fileMaskDraft.trim() !== ''}
                  ariaHasPopup='dialog'
                  ariaExpanded={dockFileMaskOpen}
                  onClick={() => {
                    setDockFileMaskOpen((open) => !open);
                    window.setTimeout(() => fileMaskInputRef.current?.focus?.(), 0);
                  }}
                />
                {dockFileMaskOpen ? (
                  <div
                    style={styles.findToolDockFileMaskPopover}
                    data-dsh-find-dock-file-mask-popover=''>
                    {fileMaskControl}
                  </div>
                ) : null}
              </span>
              <CompactActionBar
                actions={toolbarActions}
                t={t}
                ariaLabel={t('editor.findInFilesAction')}
                className='dsh-editor-find-dock-header-actions'
                style={{
                  ...styles.findToolHeaderActions,
                  flex: '0 0 28px',
                  width: 28,
                  minWidth: 28,
                }}
              />
              <span
                style={{
                  ...styles.findToolWindowControls,
                  marginLeft: 0,
                  paddingLeft: 0,
                  borderLeft: 'none',
                }}
                data-dsh-find-window-controls=''>
                <ToolbarButton
                  icon={minimized ? 'expand' : 'hide'}
                  label={t(minimized ? 'editor.findToolRestore' : 'editor.findToolMinimize')}
                  onClick={onMinimize}
                />
              </span>
            </span>
          </div>
        )}
        {floating ? (
          <div
            style={{
              ...styles.findToolSearchRow,
              ...styles.findToolPopupSearchRow,
            }}>
            <Icon
              name='search'
              size={POPUP_ICON_SIZE}
            />
            {queryControl}
            {clearSearchControl}
            {searchHistoryControl}
            {searchNewLineControl}
            {searchFilterControls}
          </div>
        ) : null}
        {replaceExpanded && !fileFilterMode ? (
          <div style={styles.findToolReplaceRow}>
            <Icon
              name='replace'
              size={POPUP_ICON_SIZE}
            />
            <ReplaceField
              ref={replaceInputRef}
              data-dsh-find-replace-input=''
              style={{
                ...styles.findToolInput,
                ...(replaceNewLine ? styles.findToolMultilineInput : null),
              }}
              value={state.replace}
              placeholder={t('editor.findToolReplacePlaceholder')}
              aria-label={t('editor.findToolReplacePlaceholder')}
              onChange={(event) => onReplace(event.target.value)}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing === true) return;
                if (
                  replaceNewLine &&
                  event.key === 'Enter' &&
                  event.metaKey !== true &&
                  event.ctrlKey !== true &&
                  !(event.altKey === true && event.shiftKey === true)
                )
                  return;
                if (event.altKey === true && event.key === 'ArrowDown') {
                  openHistoryMenu(event, 'replace');
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  onClose();
                } else if (replaceInputAction(event, 'single') !== null) {
                  event.preventDefault();
                  if (state.replaceBusy === true) return;
                  if (replaceInputAction(event, 'single') === 'all') {
                    if (scopedMatches.length > 0) onReplaceAll(scopedReplacementPaths);
                  } else if (active?.kind === 'text') {
                    onReplaceOccurrence(active, activeIndex);
                  }
                }
              }}></ReplaceField>
            <ToolbarButton
              icon={floating ? 'chevronDown' : 'history'}
              label={t('editor.findReplaceHistory')}
              ariaHasPopup='menu'
              ariaExpanded={historyMenu?.title === t('editor.findReplaceHistory')}
              onClick={(event) => openHistoryMenu(event, 'replace')}
            />
            <label style={styles.findToolNewLine}>
              <input
                type='checkbox'
                data-dsh-find-replace-new-line=''
                aria-label={t('editor.findNewLine')}
                checked={replaceNewLine}
                onChange={(event) => setReplaceNewLine(event.target.checked)}
              />
              <span>{t('editor.findNewLine')}</span>
            </label>
            <ToolbarButton
              icon='preserveCase'
              label={t('editor.searchPreserveCase')}
              active={state.preserveCase === true}
              onClick={onTogglePreserveCase}
            />
          </div>
        ) : null}
        {floating ? (
          <div
            style={
              floating
                ? {
                    ...styles.findToolScopeRow,
                    ...styles.findToolPopupScopeRow,
                  }
                : styles.findToolScopeRow
            }
            data-dsh-find-scope=''>
            {floating ? (
              <div
                className='dsh-editor-find-scope-mode-group'
                role='group'
                aria-label={t('editor.findScopeModeGroup')}
                style={styles.findToolScopeModeGroup}>
                {scopeModeOptions.map((scope) => (
                  <button
                    key={scope.id}
                    ref={(node) => {
                      if (node === null) scopeModeButtonRefs.current.delete(scope.id);
                      else scopeModeButtonRefs.current.set(scope.id, node);
                    }}
                    type='button'
                    disabled={scope.disabled}
                    tabIndex={scopeMode === scope.id ? 0 : -1}
                    data-dsh-find-scope-mode={scope.id}
                    aria-pressed={scopeMode === scope.id}
                    style={{
                      ...styles.findToolScopeButton,
                      ...(scopeMode === scope.id ? styles.findToolScopeButtonActive : null),
                    }}
                    onClick={() => {
                      selectFindScopeMode(scope.id);
                      window.setTimeout(() => queryInputRef.current?.focus?.(), 0);
                    }}
                    onKeyDown={(event) => handleFindScopeModeKeyDown(event, scope.id)}>
                    {scope.label}
                  </button>
                ))}
              </div>
            ) : null}
            {scopeMode === 'directory' ? (
              <React.Fragment>
                <input
                  style={styles.findToolScopeDirectoryInput}
                  value={scopeDirectoryDraft}
                  placeholder={t('editor.findScopeDirectoryPlaceholder')}
                  aria-label={t('editor.findScopeDirectory')}
                  onChange={(event) => {
                    const value = event.target.value;
                    setScopeDirectoryDraft(value);
                    emitFindScopeChange('directory', effectiveScopePreset, value);
                  }}
                  onKeyDown={(event) => {
                    if (event.shiftKey === true && event.key === 'Enter') {
                      event.preventDefault();
                      openFindDirectoryPicker();
                    }
                  }}
                />
                <button
                  type='button'
                  style={styles.findToolScopeMore}
                  title={`${t('editor.findSelectDirectory')} (⇧⏎)`}
                  aria-label={t('editor.findSelectDirectory')}
                  aria-keyshortcuts='Shift+Enter'
                  onClick={openFindDirectoryPicker}>
                  …
                </button>
                <button
                  type='button'
                  style={{
                    ...styles.findToolScopeMore,
                    ...(scopeRecursive === true ? styles.findToolScopeButtonActive : null),
                  }}
                  title={t('editor.findScopeSearchRecursively')}
                  aria-label={t('editor.findScopeSearchRecursively')}
                  aria-pressed={scopeRecursive === true}
                  onClick={toggleFindDirectoryRecursive}>
                  <Icon
                    name='project'
                    size={POPUP_ICON_SIZE}
                  />
                </button>
              </React.Fragment>
            ) : scopeMode === 'scope' ? (
              <>
                <select
                  style={styles.findToolScopeSelect}
                  value={effectiveScopePreset}
                  aria-label={t('editor.findScopeScope')}
                  onChange={(event) => selectFindScopePreset(event.target.value)}>
                  <option value='projectFiles'>{t('editor.findScopeProjectFiles')}</option>
                  <option
                    value='gitNonIgnoredFiles'
                    disabled={gitAvailable !== true}>
                    {t('editor.findScopeGitNonIgnoredFiles')}
                  </option>
                  <option
                    value='gitTrackedFiles'
                    disabled={gitAvailable !== true}>
                    {t('editor.findScopeGitTrackedFiles')}
                  </option>
                  <option
                    value='recentlyViewedFiles'
                    disabled={recentFilePaths.length === 0}>
                    {t('editor.findScopeRecentlyViewedFiles')}
                  </option>
                  <option
                    value='openFiles'
                    disabled={openFilePaths.length === 0}>
                    {t('editor.findScopeOpenFiles')}
                  </option>
                  <option
                    value='currentFile'
                    disabled={activeFilePath === null}>
                    {t('editor.findScopeCurrentFile')}
                  </option>
                  <option
                    value='changedFiles'
                    disabled={changedFilePaths.length === 0}>
                    {t('editor.findScopeChangedFiles')}
                  </option>
                  {(Array.isArray(customScopes) ? customScopes : []).map((scope) => (
                    <option
                      key={scope.id}
                      value={`custom:${scope.id}`}>
                      {scope.name}
                    </option>
                  ))}
                </select>
                <button
                  type='button'
                  ref={scopeEditorButtonRef}
                  style={styles.findToolScopeMore}
                  title={t('editor.findEditScopes')}
                  aria-label={t('editor.findEditScopes')}
                  onClick={() => setScopeEditorOpen(true)}>
                  …
                </button>
              </>
            ) : null}
          </div>
        ) : null}
        {state.error !== null ? (
          <div
            style={styles.searchEverywhereError}
            role='alert'>
            {t('editor.findSearchFailed', {
              message: state.error,
            })}
          </div>
        ) : null}
        <div
          role='status'
          aria-live='polite'
          aria-atomic='true'
          style={styles.screenReaderOnly}>
          {findResultStatus}
        </div>
      </div>
      <div
        style={floating ? styles.findToolResultsStack : styles.findToolDockSplit}
        data-dsh-find-results-layout={floating ? 'stack' : 'split'}>
        <div
          style={
            floating
              ? styles.findToolResultsStack
              : {
                  ...styles.findToolDockResultsPane,
                  flex: previewOpen ? `${100 - dockPreviewPercent} 1 0` : '1 1 auto',
                }
          }
          data-dsh-find-results-pane=''>
          <div
            ref={listRef}
            id={FIND_TOOL_LISTBOX_ID}
            style={{
              ...styles.findToolList,
              ...(occurrences.length === 0 ? styles.findToolListEmpty : null),
            }}
            role='listbox'
            aria-busy={state.loading === true ? true : undefined}
            aria-label={t('editor.findInFilesAction')}
            aria-activedescendant={active === null ? undefined : findToolOptionId(active.rowKey)}
            tabIndex={0}
            onKeyDown={handleListKeyDown}>
            {state.error === null && state.loading === true && occurrences.length === 0 ? (
              <div style={floating ? styles.findToolPopupMessage : styles.findToolMessage}>{t('editor.loading')}</div>
            ) : null}
            {state.error === null && state.loading !== true && !hasFindToolContentQuery(query) ? (
              <div style={floating ? styles.findToolPopupMessage : styles.findToolMessage}>
                {t('editor.findToolEmptyQuery')}
              </div>
            ) : null}
            {showEmptyFindResult ? (
              <div style={floating ? styles.findToolPopupMessage : styles.findToolMessage}>
                {floating ? t('editor.findToolNothingFound') : t('editor.findToolNoMatches')}
                {showFindSearchOptionSummary ? (
                  <div
                    style={styles.searchEverywhereUsedOptions}
                    data-dsh-find-used-options=''>{`${t(activeFindSearchOptionIds.length === 1 ? 'editor.searchOptionUsed' : 'editor.searchOptionsUsed')} ${activeFindSearchOptionsText}`}</div>
                ) : null}
                {showFindSearchOptionSummary ? (
                  <button
                    type='button'
                    className='dsh-editor-search-clear-options'
                    style={styles.searchEverywhereInlineAction}
                    data-dsh-find-clear-options=''
                    aria-keyshortcuts='Alt+Shift+Backspace'
                    title={`${t(activeFindSearchOptionIds.length === 1 ? 'editor.searchClearOption' : 'editor.searchClearAllOptions')} (⌥⇧⌫)`}
                    onClick={() =>
                      clearFindSearchOptions('all')
                    }>{`${t(activeFindSearchOptionIds.length === 1 ? 'editor.searchClearOption' : 'editor.searchClearAllOptions')} ⌥⇧⌫`}</button>
                ) : null}
              </div>
            ) : null}
            {floating ? (
              occurrences.map((result, position) => {
                const isText = result.kind === 'text';
                const rowKey = result.rowKey;
                return (
                  <div
                    key={rowKey}
                    ref={(node) => {
                      if (node === null) occurrenceRefs.current.delete(rowKey);
                      else occurrenceRefs.current.set(rowKey, node);
                    }}
                    id={findToolOptionId(rowKey)}
                    role='option'
                    aria-selected={position === activeIndex}
                    tabIndex={position === activeIndex ? 0 : -1}
                    data-dsh-find-active={position === activeIndex ? '1' : '0'}
                    data-dsh-find-popup-result={isText ? 'text' : 'file'}
                    title={
                      result.kind === 'text'
                        ? `${result.path}:${result.line}:${result.column} ${result.preview ?? ''}`
                        : result.path
                    }
                    style={{
                      ...styles.findToolPopupResult,
                      ...(position === activeIndex ? styles.findToolPopupResultActive : null),
                    }}
                    onFocus={() => onMove(0, occurrences.length, position)}
                    onKeyDown={(event) => handleOccurrenceKeyDown(event, rowKey, position)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onMove(0, occurrences.length, position);
                      openFindResultMenuAt(event.clientX, event.clientY, occurrences[position]);
                    }}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onMove(0, occurrences.length, position);
                      event.currentTarget.focus?.();
                    }}
                    onDoubleClick={() => openFindResult(result)}>
                    <SearchFileResultItem
                      path={result.path}
                      name={isText ? previewParts(result) : result.path}
                      detail={isText ? `${basename(result.path)} ${result.line}` : basename(result.path)}
                      selected={position === activeIndex}
                      nameStyle={styles.findToolPopupResultPreview}
                      detailStyle={{
                        ...styles.findToolPopupResultPath,
                        ...(position === activeIndex ? styles.findToolPopupResultPathActive : null),
                      }}
                    />
                  </div>
                );
              })
            ) : (
              <React.Fragment>
                {scopedFileResults.length === 0 ? null : (
                  <React.Fragment>
                    <div style={styles.findToolFileRow}>{t('editor.searchTabFiles')}</div>
                    {scopedFileResults.map((file) => {
                      const rowKey = `file:${file.path}`;
                      const position = occurrenceIndexByKey.get(rowKey) ?? -1;
                      return (
                        <div
                          key={`file-result:${file.path}`}
                          ref={(node) => {
                            if (node === null) occurrenceRefs.current.delete(rowKey);
                            else occurrenceRefs.current.set(rowKey, node);
                          }}
                          id={findToolOptionId(rowKey)}
                          role='option'
                          aria-selected={position === activeIndex}
                          tabIndex={position === activeIndex ? 0 : -1}
                          data-dsh-find-active={position === activeIndex ? '1' : '0'}
                          style={{
                            ...styles.findToolOccurrence,
                            ...(position === activeIndex ? styles.findToolOccurrenceActive : null),
                          }}
                          onFocus={() => onMove(0, occurrences.length, position)}
                          onKeyDown={(event) => handleOccurrenceKeyDown(event, rowKey, position)}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onMove(0, occurrences.length, position);
                            openFindResultMenuAt(event.clientX, event.clientY, occurrences[position]);
                          }}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            onMove(0, occurrences.length, position);
                            event.currentTarget.focus?.();
                          }}
                          onDoubleClick={() =>
                            openFindResult({
                              ...file,
                              kind: 'file',
                            })
                          }>
                          <SearchFileResultItem
                            path={file.path}
                            name={file.path}
                          />
                        </div>
                      );
                    })}
                  </React.Fragment>
                )}
                {displayGroups.map((group) =>
                  group.kind === 'directory' ? (
                    <div
                      key={`directory:${group.path}`}
                      data-dsh-find-directory={group.path}
                      style={styles.findToolDirectoryRow}>
                      <Icon
                        name='project'
                        size={POPUP_ICON_SIZE}
                      />
                      <span style={styles.findToolDirectoryPath}>
                        {group.path === '' ? t('editor.findDirectoryRoot') : group.path}
                      </span>
                      <span style={styles.findToolFileCount}>
                        {group.count === 1
                          ? t('editor.findToolFileGroupOne')
                          : t('editor.findToolFileGroup', {
                              count: group.count,
                            })}
                      </span>
                    </div>
                  ) : (
                    <div
                      key={`group:${group.path}`}
                      id={findToolGroupId(group.path)}
                      role='group'
                      aria-label={group.path}
                      data-dsh-find-group={group.path}>
                      <div
                        style={styles.findToolFileRow}
                        title={group.path}>
                        <button
                          ref={(node) => {
                            if (node === null) groupButtonRefs.current.delete(group.path);
                            else groupButtonRefs.current.set(group.path, node);
                          }}
                          type='button'
                          style={styles.findToolGroupButton}
                          tabIndex={rovingGroupPath === group.path ? 0 : -1}
                          data-dsh-find-group-path={group.path}
                          aria-label={
                            collapsedFiles.has(group.path)
                              ? t('editor.findToolExpandFile')
                              : t('editor.findToolCollapseFile')
                          }
                          aria-expanded={collapsedFiles.has(group.path) === false}
                          aria-controls={findToolGroupId(group.path)}
                          onFocus={() => setFocusedGroupPath(group.path)}
                          onClick={(event) => {
                            setFocusedGroupPath(group.path);
                            event.currentTarget.focus?.();
                            toggleGroup(group.path);
                          }}
                          onKeyDown={(event) => handleGroupKeyDown(event, group)}>
                          <Icon
                            name={collapsedFiles.has(group.path) ? 'chevronRight' : 'chevronDown'}
                            size={POPUP_ICON_SIZE}
                          />
                        </button>
                        <SearchFileResultItem
                          path={group.path}
                          name={group.path}
                        />
                        <span style={styles.findToolFileCount}>
                          {group.matches.length === 1
                            ? t('editor.findToolFileGroupOne')
                            : t('editor.findToolFileGroup', {
                                count: group.matches.length,
                              })}
                        </span>
                      </div>
                      {collapsedFiles.has(group.path)
                        ? null
                        : group.matches.map((match) => {
                            const rowKey = `text:${match.path}:${match.line}:${match.column}`;
                            const position = occurrenceIndexByKey.get(rowKey) ?? -1;
                            return (
                              <div
                                key={rowKey}
                                ref={(node) => {
                                  if (node === null) occurrenceRefs.current.delete(rowKey);
                                  else occurrenceRefs.current.set(rowKey, node);
                                }}
                                id={findToolOptionId(rowKey)}
                                role='option'
                                aria-selected={position === activeIndex}
                                tabIndex={position === activeIndex ? 0 : -1}
                                data-dsh-find-active={position === activeIndex ? '1' : '0'}
                                title={`${match.path}:${match.line}:${match.column} ${match.preview ?? ''}`}
                                style={{
                                  ...styles.findToolOccurrence,
                                  ...(position === activeIndex ? styles.findToolOccurrenceActive : null),
                                }}
                                onFocus={() => onMove(0, occurrences.length, position)}
                                onKeyDown={(event) => handleOccurrenceKeyDown(event, rowKey, position)}
                                onContextMenu={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  onMove(0, occurrences.length, position);
                                  openFindResultMenuAt(event.clientX, event.clientY, occurrences[position]);
                                }}
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  onMove(0, occurrences.length, position);
                                  event.currentTarget.focus?.();
                                }}
                                onDoubleClick={() =>
                                  openFindResult({
                                    ...match,
                                    kind: 'text',
                                    path: match.path ?? '',
                                    line: match.line ?? 1,
                                    column: match.column ?? 1,
                                  })
                                }>
                                <span style={styles.findToolLocation}>{`${match.line}:${match.column}`}</span>
                                <span style={styles.findToolPreview}>
                                  {previewParts({
                                    ...match,
                                    rowKey,
                                  })}
                                </span>
                              </div>
                            );
                          })}
                    </div>
                  ),
                )}
              </React.Fragment>
            )}
            {state.truncated === true ? (
              <div style={styles.searchEverywhereMessage}>{t('editor.searchTextTruncated')}</div>
            ) : null}
          </div>
        </div>
        {floating || !previewOpen ? null : (
          <EditorSplitDivider
            percent={100 - dockPreviewPercent}
            dragging={dockPreviewDragging}
            title={t('editor.findPreviewSplitter')}
            clampPercent={(value) => clampFindPreviewPercent(value)}
            onChange={(next) => setDockPreviewPercent(100 - next)}
            onDraggingChange={setDockPreviewDragging}
            onCommit={(final) =>
              writeStoredNumber(FIND_PREVIEW_PERCENT_STORAGE_KEY, Math.round(100 - clampFindPreviewPercent(final)))
            }
          />
        )}
        {previewOpen && (floating ? active !== null && hasFindToolContentQuery(query) : true) ? (
          <div
            style={
              floating
                ? styles.findToolPreviewPane
                : {
                    ...styles.findToolPreviewPane,
                    ...styles.findToolDockPreviewPane,
                    flex: `${dockPreviewPercent} 1 0`,
                    borderLeft: 'none',
                  }
            }
            data-dsh-find-preview=''
            data-dsh-find-preview-layout={floating ? 'bottom' : 'right'}>
            <div style={styles.searchEverywherePreviewToolbar}>
              <Icon
                name='file'
                size={POPUP_ICON_SIZE}
              />
              <span
                style={styles.searchEverywherePreviewPath}
                title={previewState.path}>
                {previewState.path || t('editor.findToolPreviewSource')}
              </span>
              <ToolbarButton
                icon='wrap'
                label={t('editor.searchPreviewSoftWrap')}
                active={previewSoftWrap}
                onClick={() => setPreviewSoftWrap((value) => !value)}
              />
            </div>
            <div
              ref={previewBodyRef}
              style={styles.searchEverywherePreviewBody}
              className='dsh-editor-code-preview'
              data-dsh-code-preview=''>
              {active === null ? (
                <div style={styles.searchEverywhereMessage}>{t('editor.findToolPreviewSelectResult')}</div>
              ) : null}
              {previewState.loading ? <div style={styles.searchEverywhereMessage}>{t('editor.loading')}</div> : null}
              {previewState.error !== null ? (
                <div
                  style={styles.searchEverywhereError}
                  role='alert'>
                  {previewState.error}
                </div>
              ) : null}
              {active !== null && !previewState.loading && previewState.error === null ? (
                <React.Fragment>
                  {previewWindow?.truncatedBefore ? <div style={styles.searchEverywhereMessage}>…</div> : null}
                  {previewLines.length === 0 ? (
                    <div style={styles.searchEverywhereMessage}>{t('editor.searchPreviewEmpty')}</div>
                  ) : (
                    previewLines.map((code, index) => {
                      const previewSegments = previewLineParts[index] ?? [];
                      return (
                        <div
                          key={previewWindow.start + index}
                          data-dsh-preview-line={previewWindow.start + index}
                          className='dsh-editor-code-preview-line'
                          style={{
                            ...styles.searchEverywherePreviewLine,
                            ...(previewWindow.start + index === previewState.line
                              ? styles.searchEverywherePreviewLineActive
                              : null),
                          }}>
                          <span
                            className='dsh-editor-code-preview-gutter'
                            style={styles.codePreviewGutter}>
                            {String(previewWindow.start + index)}
                          </span>
                          <CodePreviewCode
                            text={previewSegments.map((part) => part.text).join('')}
                            html={previewColorizedLines?.[index] ?? null}
                            segments={previewSegments}
                            style={{
                              ...styles.searchEverywherePreviewCode,
                              whiteSpace: previewSoftWrap ? 'pre-wrap' : 'pre',
                              overflowWrap: previewSoftWrap ? 'anywhere' : 'normal',
                            }}
                          />
                        </div>
                      );
                    })
                  )}
                  {previewWindow?.truncatedAfter ? <div style={styles.searchEverywhereMessage}>…</div> : null}
                </React.Fragment>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      {floating || replaceExpanded ? (
        <div
          style={styles.findToolBottomBar}
          data-dsh-find-bottom-bar=''>
          {floating ? (
            <React.Fragment>
              <label style={styles.findToolNewLine}>
                <input
                  type='checkbox'
                  checked={openResultsInNewTab}
                  onChange={toggleOpenResultsInNewTab}
                />
                <span>{t('editor.findOpenResultsInNewTab')}</span>
              </label>
            </React.Fragment>
          ) : null}
          <span style={styles.findToolSpacer} />
          {floating ? <span style={styles.findToolShortcut}>⌘⏎</span> : null}
          {floating ? (
            <button
              type='button'
              style={{
                ...styles.conflictAction,
                ...styles.findToolBottomAction,
                opacity: hasFindToolContentQuery(query) ? 1 : 0.45,
              }}
              data-dsh-find-bottom-action='open-in-find-window'
              disabled={!hasFindToolContentQuery(query)}
              title={openInFindWindowDisabledReason || `${t('editor.findOpenInFindWindow')} (⌘⏎)`}
              aria-description={openInFindWindowDisabledReason || undefined}
              aria-keyshortcuts='Meta+Enter Control+Enter'
              onClick={requestOpenInFindWindow}>
              {t('editor.findOpenInFindWindow')}
            </button>
          ) : null}
          {replaceExpanded ? (
            <React.Fragment>
              <button
                type='button'
                style={{
                  ...styles.conflictAction,
                  ...styles.findToolBottomAction,
                  opacity:
                    state.replaceBusy ||
                    state.loading ||
                    state.error !== null ||
                    scopedMatches.length === 0 ||
                    !findToolResultsAreCurrent(state)
                      ? 0.45
                      : 1,
                }}
                data-dsh-find-bottom-action='replace-all'
                disabled={
                  state.replaceBusy === true ||
                  state.loading === true ||
                  state.error !== null ||
                  scopedMatches.length === 0 ||
                  !findToolResultsAreCurrent(state)
                }
                title={replaceAllDisabledReason || `${t('editor.searchReplaceAll')} (⌥⇧⏎)`}
                aria-description={replaceAllDisabledReason || undefined}
                aria-keyshortcuts='Alt+Shift+Enter'
                onClick={() => onReplaceAll(scopedReplacementPaths)}>
                {state.replaceBusy ? t('editor.loading') : t('editor.searchReplaceAll')}
              </button>
              <button
                type='button'
                style={{
                  ...styles.conflictAction,
                  ...styles.findToolBottomAction,
                  opacity:
                    state.replaceBusy ||
                    state.loading ||
                    state.error !== null ||
                    activeTextOccurrence === null ||
                    !findToolResultsAreCurrent(state)
                      ? 0.45
                      : 1,
                }}
                data-dsh-find-bottom-action='replace'
                disabled={
                  state.replaceBusy === true ||
                  state.loading === true ||
                  state.error !== null ||
                  activeTextOccurrence === null ||
                  !findToolResultsAreCurrent(state)
                }
                title={replaceCurrentDisabledReason || `${t('editor.replaceCurrent')} (Enter)`}
                aria-description={replaceCurrentDisabledReason || undefined}
                aria-keyshortcuts='Enter'
                onClick={() => {
                  if (activeTextOccurrence !== null) onReplaceOccurrence(activeTextOccurrence, activeIndex);
                }}>
                {t('editor.replaceCurrent')}
              </button>
            </React.Fragment>
          ) : null}
        </div>
      ) : null}
      {directoryPicker === null ? null : (
        <MoveToPicker
          t={t}
          state={directoryPicker}
          title={t('editor.findSelectDirectory')}
          placeholder={t('editor.findSelectDirectoryPlaceholder')}
          currentLabel={t('editor.findSelectDirectoryCurrent')}
          onQuery={(value) =>
            setDirectoryPicker((current: DirectoryPickerState | null) =>
              current === null
                ? current
                : {
                    ...current,
                    query: value,
                    index: 0,
                  },
            )
          }
          onMove={(direction, count) =>
            setDirectoryPicker((current: DirectoryPickerState | null) => {
              if (current === null) return current;
              if (count === 0)
                return {
                  ...current,
                  index: 0,
                };
              return {
                ...current,
                index: (current.index + direction + count) % count,
              };
            })
          }
          onPick={(directory) => {
            setScopeDirectoryDraft(directory);
            setScopeMode('directory');
            emitFindScopeChange('directory', effectiveScopePreset, directory);
            setDirectoryPicker(null);
            window.setTimeout(() => queryInputRef.current?.focus?.(), 0);
          }}
          onClose={() => setDirectoryPicker(null)}
        />
      )}
      {scopeEditorOpen ? (
        <FindScopeEditor
          t={t}
          scopes={customScopes}
          initialId={selectedCustomScope?.id ?? null}
          onWriteScopeXml={onWriteScopeXml}
          onSave={(nextScopes, nextSelectedId) => {
            const normalized =
              typeof onCustomScopesChange === 'function'
                ? onCustomScopesChange(nextScopes as unknown as FindCustomScope[])
                : normalizeCustomFindScopes(nextScopes);
            const savedId = normalized.some((scope) => scope.id === nextSelectedId)
              ? nextSelectedId
              : (normalized[0]?.id ?? '');
            const nextPreset = savedId === '' ? 'projectFiles' : `custom:${savedId}`;
            setScopePreset(nextPreset);
            emitFindScopeChange('scope', nextPreset, scopeDirectoryDraft);
          }}
          onClose={closeScopeEditor}
        />
      ) : null}
      {groupByMenu === null ? null : (
        <ContextMenu
          t={t}
          menu={groupByMenu}
          onClose={() => setGroupByMenu(null)}
        />
      )}
      {filterMenu === null ? null : (
        <ContextMenu
          t={t}
          menu={filterMenu}
          onClose={() => setFilterMenu(null)}
        />
      )}
      {fileMaskMenu === null ? null : (
        <ContextMenu
          t={t}
          menu={fileMaskMenu}
          onClose={() => setFileMaskMenu(null)}
        />
      )}
      {resultMenu === null ? null : (
        <ContextMenu
          t={t}
          menu={resultMenu}
          onClose={() => setResultMenu(null)}
        />
      )}
      {historyMenu === null ? null : (
        <div data-dsh-find-history-menu=''>
          <ContextMenu
            t={t}
            menu={historyMenu}
            onClose={() => setHistoryMenu(null)}
          />
        </div>
      )}
    </div>
  );
}
const FindToolWindow = FindToolWindowView;

export { FindToolWindow };
