/* editor-workspace.tsx: dsh-editor workspace component. Generated into lib/client.js by scripts/build-client.mjs. */
import { normalizeMarkdownMode, isMarkdownPath } from './components/editor/editor-document-model';
import { templateFor } from './components/editor/editor-file-template-model';
import { gotoLineShortcutMatches, parseGotoLinePosition } from './components/editor/editor-navigation-model';
import { dirname, isImagePreviewPath, nextMarkdownAssetRevisions } from './components/editor/editor-path-model';
import { DIFF_TAB_KEY } from './components/editor/editor-tab-model';
import { markdownScrollRatio, markdownScrollTopForRatio } from './components/editor/markdown-scroll-model';
import { workspaceImagePreviewElement } from './components/editor/workspace-image-preview';
import {
  workspaceFileAfterReload,
  workspaceFileFromResponse,
  workspaceReloadOperation,
} from './components/editor/workspace-file-model';
import type { AnnotateLine } from './components/diff/AnnotatePreview';
import type { CommitGraphMenuPayload, CommitGraphPayload } from './components/commit/CommitGraph';
import type { CommitLogDetail } from './components/commit/CommitLog';
import type { DiffTarget } from './components/diff/DiffPreview';
import type { EditorFindHistoryMenu, EditorFindState } from './components/editor/EditorFindBar';
import type { EditorGotoLineState } from './components/editor/EditorGotoLinePopup';
import type { EditorExternalChange, EditorSaveConflict } from './components/editor/EditorConflictBars';
import {
  projectRowMenuCapabilities,
  projectTreeSelectionAfterPointer,
} from './components/project/project-selection-model';
import { allPathsUnversioned, canCompareWithHead, pathsScheduledForRemoval } from './components/ui/git-change-model';
import { ContextMenu, type ContextMenuModel } from './components/ui/Menu';
import {
  navigationHistoryRecord,
  navigationHistoryStep,
  navigationPathForModel,
  normalizeNavigationLocation,
  resolveWorkspaceDefinition,
  type DefinitionSearchOptions,
  type NavigationHistory,
  type NavigationLocation,
} from './code-navigation';
import {
  doubleShiftAction,
  findActionShortcutBlockedByChildContext,
  findActionShortcutMatches,
  ideaFindStepShortcutAction,
  ideaUsageFamilyShortcut,
  ideaUsageFamilyShortcutAction,
  isMacPlatform,
  startVisibilityGatedPoll,
  visibleEditorWorkspace,
  workspaceSearchSurfacesShouldReset,
} from './foundation';
import { styles } from './inline-styles';
import { searchReplaceCountParams } from './locales';
import {
  boundedReplaceHistory,
  claimReplaceAttempt,
  commitFindToolDirtyPlans,
  findToolContentQuery,
  findToolQueryTransition,
  findToolRequestIsCurrent,
  findUsagesSearchTarget,
  hasFindToolContentQuery,
  normalizeRecentSearchEntry,
  normalizeSearchOptions,
  parseIdeaScopeXml,
  planWorkspaceReplacements,
  readCommandHistory,
  readCustomFindScopes,
  readFindDirectoryRecursive,
  readFindPopupGeometry,
  readFloatingPopupGeometry,
  readFindQueryHistory,
  readFindScope,
  readFindUsagesHistory,
  readReplaceHistory,
  readSearchHistory,
  readSearchOptions,
  releaseReplaceAttempt,
  rememberCommandHistory,
  rememberSearchHistory,
  rememberWorkspaceFindQuery,
  rememberWorkspaceFindUsagesQuery,
  rememberWorkspaceReplacement,
  rememberWorkspaceSearchQuery,
  replaceFailureState,
  searchEverywhereTabTransition,
  serializeIdeaScopeXml,
  writeCommandHistory,
  writeCustomFindScopes,
  writeFindDirectoryRecursive,
  writeFindPopupGeometry,
  writeFloatingPopupGeometry,
  writeFindScope,
  writeSearchHistory,
  writeSearchOptions,
} from './commit';
import { CommitPanel } from './components/commit/CommitPanel';
import { MoveToPicker } from './components/commit/MoveToPicker';
import { NamePrompt } from './components/commit/NamePrompt';
import { RevisionPicker } from './components/commit/RevisionPicker';
import { projectCreateMenu, projectOptionsMenu } from './components/project/project-options-menu';
import { changesViewOptionsMenu, commitOptionsMenu } from './components/commit/commit-options-menu';
import { shelveMenu, stashMenu, type ShelfEntry } from './components/commit/stash-shelve-menu';
import { commitLogMenu } from './components/commit/log-menu';
import { commitFileMenu } from './components/commit/file-menu';
import { currentSessionId } from './components/editor/editor-path-model';
import { EditorAnnotateArea } from './components/editor/EditorAnnotateArea';
import { EditorConflictBars } from './components/editor/EditorConflictBars';
import { EditorDiffArea } from './components/editor/EditorDiffArea';
import { EditorDiffTab } from './components/editor/EditorDiffTab';
import { EditorErrorBanner } from './components/editor/EditorErrorBanner';
import { EditorFileSurface } from './components/editor/EditorFileSurface';
import { EditorFileTab } from './components/editor/EditorFileTab';
import { EditorFindBar } from './components/editor/EditorFindBar';
import { EditorGotoLinePopup } from './components/editor/EditorGotoLinePopup';
import { EditorMainPane } from './components/editor/EditorMainPane';
import { EditorSplitDivider } from './components/editor/EditorSplitDivider';
import { EditorSplitPane } from './components/editor/EditorSplitPane';
import { EditorStatusBar } from './components/editor/EditorStatusBar';
import { EditorTabStrip } from './components/editor/EditorTabStrip';
import { EditorToolWindowPanel } from './components/editor/EditorToolWindowPanel';
import { EditorToolWindowResizer } from './components/editor/EditorToolWindowResizer';
import { EditorWorkspaceBody } from './components/editor/EditorWorkspaceBody';
import { EditorWorkspaceMainColumn } from './components/editor/EditorWorkspaceMainColumn';
import { EditorWorkspaceShell } from './components/editor/EditorWorkspaceShell';
import { EditorWorkspaceSurface } from './components/editor/EditorWorkspaceSurface';
import { MarkdownPreviewPane } from './components/editor/MarkdownPreviewPane';
import { ProjectPanel } from './components/project/ProjectPanel';
import { FindToolDock } from './components/search/FindToolDock';
import { FloatingToolPopup } from './components/search/FindToolPopup';
import { FindToolWindow } from './components/search/FindToolWindow';
import { confirmSearchReplace } from './components/search/search-replace-confirmation';
import { QuickOpen } from './components/search/QuickOpen';
import { SearchEverywhere } from './components/search/SearchEverywhere';
import { ShowUsagesPopup } from './components/search/ShowUsagesPopup';
import { EditorTerminalArea } from './components/terminal/EditorTerminalArea';
import { EditorTerminalDock } from './components/terminal/EditorTerminalDock';
import type { EditorTerminalDescriptor } from './components/terminal/EditorTerminalTab';
import { TerminalPanel } from './components/terminal/TerminalPanel';
import { ActivityStripe } from './components/ui/ActivityStripe';
import { focusSurfaceWhenReady } from './components/ui/focus-surface';
import {
  changePositionOf,
  changeRowGroup,
  changeSequenceOf,
  type DiffChange,
  filterChangeSequence,
  isConflict,
  listedInChangeBand,
  revealCollapseKeys,
  selectOpenedChordAction,
  splitChanges,
  stageAllTargets,
} from './diff';
import {
  ancestorsOf,
  basename,
  callFs,
  callGit,
  commitPatchDownloadName,
  createCodeEditorGroup,
  downloadPatchBlob,
  ensureEditorModel,
  expandDirectorySubtrees,
  harnessEditorLocation,
  loadMonaco,
  patchDownloadName,
  prefetchDirectorySubtrees,
  PROJECT_PREFETCH_DEPTH,
  PROJECT_PREFETCH_VISIT_LIMIT,
  remapPathAfterMove,
  searchTextFailureMessage,
  selectedEditorFindQuery,
} from './editor-core';
import {
  commitLocalDiffEntries,
  commitRelationTargets,
  type FindToolDraft,
  findFilePathMatches,
  findToolReopenDraft,
  normalizeFileExtensionFilter,
  orderedRevisionPair,
  overflowTabs,
  readEventStream,
  refScopeOf,
  reorderTabPaths,
  visibleTabCount,
} from './find-tool';
import { readLastEditorActivity, writeLastEditorActivity } from './foundation';
import {
  copyReferenceMenuItems,
  restoreScrollTop,
  shellQuote,
  shouldShowTreeLoading,
  terminalShortcutAction,
  toolWindowShortcutAction,
} from './injected-css';
import { commitEnglish } from './locales';
import {
  bindEditorFileDragCleanup,
  compactDirectoryExpansionPaths,
  editorFileDragProps,
  uploadWorkspaceDropToProject,
} from './project';
import type { ProjectUploadBusyState } from './project';
import {
  callTerminal,
  changeTypeaheadRows,
  clampEditorSplitPercent,
  clampFindDockHeight,
  clampTerminalHeight,
  collectFilePaths,
  describeMoved,
  describeMoveResult,
  editorFindKeyboardRequest,
  editorFindResult,
  editorFindSelectionScope,
  editorFindSelectionShortcutAction,
  editorReplaceAll,
  FIND_TOOL_DOCK_MIN_HEIGHT,
  FIND_TOOL_DOCK_MAX_HEIGHT,
  editorReplaceAt,
  filteredViewSelection,
  flattenRows,
  keepUnchangedListing,
  manualReorderBoundary,
  mergeFindToolDirtyMatches,
  normalizeProjectView,
  normalizeTextSearchContextFilter,
  orderProjectEntriesByManual,
  planMoves,
  projectCanCollapseAll,
  projectCanExpandAll,
  projectRightSplitPaths,
  projectSelectionSetAfterRowsChange,
  projectViewIsTree,
  projectViewRows,
  pruneProjectExpandedPaths,
  pruneProjectManualOrder,
  pushRecent,
  readCollapsedGroups,
  readCommitDraft,
  readEditorSession,
  readEditorTerminals,
  readExpanded,
  readProjectManualOrder,
  readProjectSingleClickOpen,
  readRecentFiles,
  readStoredNumber,
  readStoredText,
  readToolWidth,
  remapProjectExpandedPaths,
  remapProjectManualOrder,
  reorderProjectManualPaths,
  textOffsetAtLineColumn,
  TERMINAL_DOCK_MAX_HEIGHT,
  TERMINAL_DOCK_MIN_HEIGHT,
  toolPanelFlex,
  typeaheadStep,
  writeCollapsedGroups,
  writeCommitDraft,
  writeEditorSession,
  writeEditorTerminals,
  writeExpanded,
  writeProjectManualOrder,
  writeRecentFiles,
  writeStoredNumber,
  writeToolWidth,
} from './terminal';
import type * as Monaco from 'monaco-editor';
import React from 'react';

type EditorWorkspaceTranslate = (key: string, params?: Record<string, unknown>) => string;

interface WorkspaceEntry {
  path: string;
  kind?: string;
  [key: string]: unknown;
}

interface WorkspaceListResponse {
  root: string;
  home: string;
  entries: WorkspaceEntry[];
}

interface WorkspaceGitStatus {
  root: string;
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

interface WorkspaceLogCommit {
  hash: string;
  parents: string[];
  refs: string[];
  subject: string;
  author: string;
  date: string;
  [key: string]: unknown;
}

interface WorkspaceLogResponse {
  commits: WorkspaceLogCommit[];
}

interface WorkspaceGraphResponse {
  entries?: NonNullable<CommitGraphPayload['entries']>;
  branches?: string[];
  tags?: string[];
  branchList?: string[];
  tagList?: CommitGraphPayload['tagList'];
  head?: unknown;
  branch?: unknown;
  at?: unknown;
}

interface ChangeRowMenuPayload {
  change: DiffChange;
  staged?: boolean;
  selectedChanges?: Set<string>;
  x: number;
  y: number;
}

interface ChangeDirectoryMenuPayload {
  directory: string;
  changes: DiffChange[];
  group: string;
  x: number;
  y: number;
}

interface CommitFileMenuPayload {
  path: string;
  hash: string;
  localExists: boolean;
  localDirExists: boolean;
  x: number;
  y: number;
}

interface SelectedPatch {
  patch: string;
  files?: unknown[];
}

interface OpenWorkspaceFile {
  path: string;
  content: string;
  dirty: boolean;
  mtime: number | null;
  kind?: 'image';
  size?: number;
  mediaType?: string;
}

interface EditorWorkspaceProps {
  t: EditorWorkspaceTranslate;
  workspaceId?: string;
  initialHarnessCollapsed?: boolean;
  onToggleHarness?: () => void;
  onCloseEditor?: () => void;
  onInsertHarnessReference?: (request: Record<string, unknown>) => Promise<boolean> | boolean;
}

interface EditorFocusRef {
  current: { focus?: () => void } | null;
}

type FindToolState = NonNullable<React.ComponentProps<typeof FindToolWindow>['state']> & {
  surface?: 'popup' | 'dock';
  handoffRevision?: number;
  replaceBusy?: boolean;
  replaceFocusRequest?: number;
  replaceAdvanceRevision?: number;
  loading?: boolean;
  error?: string | null;
  truncated?: boolean;
  searchScopeMode?: string;
  searchScopePreset?: string;
  searchScopeDirectory?: string;
  searchScopeRecursive?: boolean;
  contextFilter?: string;
};
type FindToolInitial = Record<string, unknown> & {
  files?: unknown[];
  matches?: unknown[];
  truncated?: boolean;
  index?: number;
  includeExcluded?: boolean;
  refresh?: boolean;
};
type FindToolScope = Parameters<NonNullable<React.ComponentProps<typeof FindToolWindow>['onScopeChange']>>[0];
type FindToolFile = NonNullable<FindToolState['files']>[number];
type FindToolMatch = NonNullable<FindToolState['matches']>[number];
type FileListResponse = { files?: string[]; truncated?: boolean };
type TextSearchResponse = { matches?: FindToolMatch[]; truncated?: boolean; dirtyPaths?: string[] };
type EditorFindMatches = Pick<ReturnType<typeof editorFindResult>, 'matches' | 'error'>;
type SearchEverywhereFile = React.ComponentProps<typeof SearchEverywhere>['files'][number];
type SearchEverywhereText = React.ComponentProps<typeof SearchEverywhere>['textMatches'][number];
type SearchEverywhereState = NonNullable<React.ComponentProps<typeof SearchEverywhere>['state']> & {
  files: SearchEverywhereFile[];
  textMatches: SearchEverywhereText[];
  textLoading: boolean;
  textTruncated: boolean;
  textRevision: number;
  error: string | null;
  replaceBusy: boolean;
  replaceFocusRequest: number;
  [key: string]: unknown;
};
const SEARCH_EVERYWHERE_POPUP_GEOMETRY_STORAGE_KEY = 'dsh-editor.searchEverywhere.popup.geometry.v1';
const SEARCH_EVERYWHERE_POPUP_GEOMETRY_DEFAULTS = {
  width: 820,
  height: 560,
};
type ShowUsagesState = NonNullable<React.ComponentProps<typeof ShowUsagesPopup>['state']>;
type RevisionPickerState = NonNullable<React.ComponentProps<typeof RevisionPicker>['state']> & { path: string };
type NamePromptState = NonNullable<React.ComponentProps<typeof NamePrompt>['state']> & {
  kind?: 'branch' | 'tag';
  hash?: string;
};
type MoveToPickerState = NonNullable<React.ComponentProps<typeof MoveToPicker>['state']> & { sources: string[] };
type ProjectCreateState = NonNullable<React.ComponentProps<typeof ProjectPanel>['createState']>;
type ProjectRenameState = NonNullable<React.ComponentProps<typeof ProjectPanel>['renameState']> & { fresh?: boolean };
type ProjectRow = React.ComponentProps<typeof ProjectPanel>['rows'][number];
type ProjectUploadProgress = NonNullable<React.ComponentProps<typeof ProjectPanel>['uploadProgress']>;
type AnnotateTarget = React.ComponentProps<typeof EditorAnnotateArea>['target'];
type EditorSaveConflictState = EditorSaveConflict & { message?: string };
type CustomFindScope = ReturnType<typeof readCustomFindScopes>[number];
type MarkdownAssetRevisions = ReturnType<typeof nextMarkdownAssetRevisions>;
type CommitMode = 'changes' | 'log';
type ChangeGroup = 'staged' | 'unstaged' | 'unversioned';
type EditorGroup = 'left' | 'right';
type ProjectView = ReturnType<typeof normalizeProjectView>;

interface SelectionAnchor {
  key: string;
}

interface EditorTabDragState {
  group: EditorGroup;
  path: string;
}

interface EditorTabDropState extends EditorTabDragState {
  after: boolean;
}

interface QuickOpenState {
  query: string;
  index: number;
  files?: string[];
  loading?: boolean;
  error?: string | null;
}

interface FocusedEditorState {
  path: string;
  editor: Monaco.editor.IStandaloneCodeEditor | null;
}

interface ReplaceHistoryEntry {
  operationId: string | null;
  clean: boolean;
  dirty: Array<{
    path: string;
    beforeContent: string;
    afterContent: string;
  }>;
}

interface CommitScrollOffsets {
  changes: number | null;
  log: number | null;
}

type WorkspaceMenuModel = ContextMenuModel & { owner?: string };

interface HarnessReferenceEntry {
  path: string;
  isDirectory?: boolean;
  [key: string]: unknown;
}

interface HarnessReferenceLocation {
  path: string;
  line: number;
  column: number;
  endLine: number | null;
  endColumn: number | null;
}

function completeSearchMatches(
  matches: ReadonlyArray<{ path?: string; line?: number; column?: number }>,
): FindToolMatch[] {
  const completed: FindToolMatch[] = [];
  for (const match of matches) {
    if (typeof match.path !== 'string' || typeof match.line !== 'number' || typeof match.column !== 'number') continue;
    completed.push({ ...match, path: match.path, line: match.line, column: match.column });
  }
  return completed;
}

function completeFindFiles(value: unknown): FindToolFile[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): FindToolFile[] => {
    if (item === null || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (typeof record.path !== 'string' || record.path === '') return [];
    return [{ ...record, path: record.path }];
  });
}

function completeFindMatches(value: unknown): FindToolMatch[] {
  if (!Array.isArray(value)) return [];
  const candidates: Array<{ path?: string; line?: number; column?: number }> = [];
  for (const item of value) {
    if (item === null || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const candidate: { path?: string; line?: number; column?: number; [key: string]: unknown } = { ...record };
    if (typeof record.path === 'string') candidate.path = record.path;
    if (typeof record.line === 'number') candidate.line = record.line;
    if (typeof record.column === 'number') candidate.column = record.column;
    candidates.push(candidate);
  }
  return completeSearchMatches(candidates);
}

/**
 * Focus Monaco only after the file surface has mounted.
 *
 * `openFile()` resolves when the read completes, not when React has
 * committed the editor. The old next-tick focus therefore missed the first
 * open and left keyboard focus in Project; retry for a bounded number of
 * animation frames until the editor ref is available.
 * @param {{current: object|null}} editorRef - main Monaco editor ref.
 * @param {(callback: FrameRequestCallback) => void} requestFrame - frame scheduler.
 * @param {number} maxAttempts - bounded retry count.
 * @returns {void}
 */
function focusEditorOnNextFrame(
  editorRef: EditorFocusRef,
  requestFrame = window.requestAnimationFrame,
  maxAttempts = 60,
) {
  let remaining = Math.max(0, Math.floor(Number(maxAttempts) || 0));
  const attempt = () => {
    const editor = editorRef?.current ?? null;
    if (editor !== null && typeof editor.focus === 'function') {
      editor.focus();
      return;
    }
    if (remaining <= 0) return;
    remaining -= 1;
    requestFrame(attempt);
  };
  requestFrame(attempt);
}

/**
 * Recover a stable keyboard surface when the preferred opener/editor is gone.
 *
 * Tool-window rows and Monaco instances can both unmount while a diff is
 * closing. Leaving focus on BODY disables the workspace's keyboard model, so
 * fall back through the visible search/tree surfaces and finally the Activity
 * Stripe that can reopen the source tool window.
 * @param host - workspace root, or null when it is temporarily unavailable.
 * @returns whether a focusable workspace surface was found.
 */
export function focusWorkspaceFallback(host: Document | Element | null): boolean {
  const target =
    host?.querySelector<HTMLElement>('[data-dsh-changes-list], [data-dsh-project-tree]') ??
    host?.querySelector<HTMLElement>('[data-dsh-activity-id="commit"]') ??
    host?.querySelector<HTMLElement>('[data-dsh-activity-id="project"]') ??
    null;
  if (target === null || typeof target.focus !== 'function') return false;
  target.focus({ preventScroll: true });
  return true;
}

function EditorWorkspace({
  t,
  workspaceId = '',
  initialHarnessCollapsed = false,
  onToggleHarness,
  onCloseEditor,
  onInsertHarnessReference,
}: EditorWorkspaceProps) {
  const [monacoReady, setMonacoReady] = React.useState(false);
  const [monacoError, setMonacoError] = React.useState<string | null>(null);
  const [root, setRoot] = React.useState('');
  const [home, setHome] = React.useState('');
  const [entries, setEntries] = React.useState<WorkspaceEntry[]>([]);
  const [children, setChildren] = React.useState<Record<string, WorkspaceEntry[]>>({});
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set(['']));
  /* Restored once the workspace root is known, so keys can include it. */ const expandedRestoredRef = React.useRef('');
  /* 一层目录预取每个 workspace 只执行一次，轮询刷新不得重复请求。 */ const prefetchedRootRef = React.useRef('');
  /* IDEA's project tree is multi-select: one primary row plus shift/⌘ extended rows. */ const [
    selectedPath,
    setSelectedPathRaw,
  ] = React.useState<string | null>(null);
  const [selection, setSelection] = React.useState<Set<string>>(() => new Set());
  const selectionAnchor = React.useRef<string | null>(null);
  const selectionRef = React.useRef<Set<string>>(new Set());
  const selectionPrimaryRef = React.useRef<string | null>(null);
  const applyTreeSelection = React.useCallback(
    (
      nextSelection: Set<string> | Iterable<string> | null | undefined,
      nextPrimary: string | null | undefined,
      nextAnchor: string | null | undefined = nextPrimary,
    ) => {
      const normalized = nextSelection instanceof Set ? nextSelection : new Set(nextSelection ?? []);
      selectionRef.current = normalized;
      selectionPrimaryRef.current = nextPrimary ?? null;
      selectionAnchor.current = nextAnchor ?? null;
      setSelection(normalized);
      setSelectedPathRaw(nextPrimary ?? null);
    },
    [],
  );
  const setSelectedPath = React.useCallback(
    (next: string | null) => {
      applyTreeSelection(next === null ? new Set() : new Set([next]), next, next);
    },
    [applyTreeSelection],
  );
  React.useEffect(() => {
    selectionRef.current = selection;
    selectionPrimaryRef.current = selectedPath;
  }, [selectedPath, selection]);
  const [treeLoading, setTreeLoading] = React.useState(true);
  /* The flattened rows as of the last render, so the loader can decide whether a
         refresh needs a visible placeholder. */ const rowsRef = React.useRef<WorkspaceEntry[]>([]);
  /* A workspace switch must show the placeholder again: the previous root's rows
         are irrelevant to the new one. */ const treeRootRef = React.useRef('');
  /* Which workspace's tool-window widths are loaded (see loadRoot). */ const toolWidthsRestoredFor = React.useRef('');
  const [treeError, setTreeError] = React.useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<ProjectUploadProgress | null>(null);
  const [activity, setActivity] = React.useState<'project' | 'commit'>(() =>
    readLastEditorActivity() === 'commit' ? 'commit' : 'project',
  );
  const [harnessCollapsed, setHarnessCollapsed] = React.useState(initialHarnessCollapsed === true);
  const toggleHarness = React.useCallback(() => {
    const next = onToggleHarness?.();
    if (typeof next === 'boolean') setHarnessCollapsed(next);
  }, [onToggleHarness]);
  React.useEffect(() => {
    writeLastEditorActivity(activity);
  }, [activity]);
  React.useEffect(bindEditorFileDragCleanup, []);
  const [panelVisible, setPanelVisible] = React.useState(true);
  /* IDEA keeps one width per tool window. Commit used to open at 52%, which
         spent more than half the work area before a diff was even open; the
         default is now the same quarter-sized panel as Project. The user can
         still drag it wider, and that width is remembered per workspace. */ const [toolWidths, setToolWidths] =
    React.useState({ project: 28, commit: 25 });
  const [sideDragging, setSideDragging] = React.useState(false);
  /* IDEA keeps the terminal in its own bottom dock, toggled by Alt+F12. */ const [terminalOpen, setTerminalOpen] =
    React.useState(false);
  /* A monotonic request, not a boolean: repeated Alt+F12 must focus again
         even when the dock component was already mounted and cached. */ const [
    terminalFocusGeneration,
    setTerminalFocusGeneration,
  ] = React.useState(0);
  /* Alt+F12 is a focus round-trip, not just a visibility bit: the surface
         that owned the caret before the dock opened gets it back on close. */ const terminalReturnFocusRef =
    React.useRef<HTMLElement | null>(null);
  /* IDEA remembers the Terminal tool-window height; a reload or app restart
         must not snap it back to the factory default. */ const [terminalHeight, setTerminalHeight] = React.useState(
    () => clampTerminalHeight(readStoredNumber('dsh-editor.terminal.height', 220)),
  );
  const [dockDragging, setDockDragging] = React.useState(false);
  const [terminalGeneration, setTerminalGeneration] = React.useState(0);
  /* Terminals living in the EDITOR area (IDEA's Move to Editor). The PTY is
         owned by the host, so only the description is needed here to render a
         second view onto the same shell. */ const [editorTerminals, setEditorTerminals] = React.useState<
    EditorTerminalDescriptor[]
  >([]);
  /**
   * Return one editor-area terminal to the dock.
   *
   * The dock panel may not be mounted while it is closed, so dispatching the
   * legacy event alone loses the action. Remove the editor placement locally,
   * persist it, then open the dock; the event still updates a mounted panel.
   * @param {{id: string}} terminal - editor terminal being returned.
   * @returns {void}
   */ const returnEditorTerminalToDock = React.useCallback(
    (terminal: EditorTerminalDescriptor) => {
      if (terminal === null || terminal === undefined || typeof terminal.id !== 'string') return;
      const next = editorTerminals.filter((entry) => entry.id !== terminal.id);
      setEditorTerminals(next);
      writeEditorTerminals(next.map((entry) => entry.id));
      window.dispatchEvent(
        new CustomEvent('dsh-editor-return-terminal', {
          detail: { id: terminal.id },
        }),
      );
      setTerminalOpen(true);
      setTerminalFocusGeneration((generation) => generation + 1);
    },
    [editorTerminals],
  );
  /**
   * Rebuild the editor-area terminals after a reload.
   *
   * The dock reports what it moved, but a reload starts with the dock closed,
   * so nothing reports and the stored id renders nowhere. The PTY itself
   * survives in the host, so asking it for the list is enough: the placement
   * is remembered, the process was never ours to restart.
   * @returns {void}
   */ React.useEffect(() => {
    const remembered = readEditorTerminals();
    if (remembered.length === 0) return;
    let cancelled = false;
    callTerminal({ op: 'list' })
      .then((value) => {
        if (cancelled) return;
        const listed = Array.isArray(value?.terminals) ? value.terminals : [];
        /* Only ids the host still holds: a terminal closed while the page was
               away must not be resurrected as a dangling tab. */ const restored = listed.flatMap(
          (terminal): EditorTerminalDescriptor[] => {
            if (!remembered.includes(terminal.id)) return [];
            return [
              {
                id: terminal.id,
                title: typeof terminal.title === 'string' && terminal.title !== '' ? terminal.title : terminal.id,
                cwd: typeof terminal.cwd === 'string' ? terminal.cwd : '',
              },
            ];
          },
        );
        setEditorTerminals(restored);
        writeEditorTerminals(restored.map((terminal) => terminal.id));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  /* Directory "Open in Terminal" asked for, consumed by the next shell. */ const pendingTerminalPath =
    React.useRef('');
  const [terminalStartDirectory, setTerminalStartDirectory] = React.useState('');
  const [createState, setCreateState] = React.useState<ProjectCreateState | null>(null);
  const [git, setGit] = React.useState<WorkspaceGitStatus | null>(null);
  const [openFiles, setOpenFiles] = React.useState<OpenWorkspaceFile[]>([]);
  const [previewPath, setPreviewPath] = React.useState<string | null>(null);
  const [activePath, setActivePath] = React.useState<string | null>(null);
  const [splitPath, setSplitPath] = React.useState<string | null>(null);
  const [splitTabs, setSplitTabs] = React.useState<string[]>([]);
  const [focusedPath, setFocusedPath] = React.useState<string | null>(null);
  const [editorSplitPercent, setEditorSplitPercent] = React.useState(() =>
    readStoredNumber('dsh-editor.editor.splitPercent', 50),
  );
  const [editorSplitDragging, setEditorSplitDragging] = React.useState(false);
  /* The file tab strip's measured width, for IDEA's `»` overflow. */ const [tabStripWidth, setTabStripWidth] =
    React.useState(0);
  const fileTabStripRef = React.useRef<HTMLDivElement | null>(null);
  const [splitTabStripWidth, setSplitTabStripWidth] = React.useState(0);
  const splitTabStripRef = React.useRef<HTMLDivElement | null>(null);
  const [editorTabDrag, setEditorTabDrag] = React.useState<EditorTabDragState | null>(null);
  const editorTabDragRef = React.useRef<EditorTabDragState | null>(null);
  const [editorTabDrop, setEditorTabDrop] = React.useState<EditorTabDropState | null>(null);
  const [editorError, setEditorError] = React.useState<string | null>(null);
  /* IDEA's editor status bar: caret position, indentation and line-ending mode. */ const [caret, setCaret] =
    React.useState({ line: 1, column: 1 });
  /* Line count and selection size for IDEA's status bar. */ const [lineStats, setLineStats] = React.useState({
    lines: 0,
    selected: 0,
  });
  const [fileMode, setFileMode] = React.useState({
    tabSize: 2,
    insertSpaces: true,
    eol: 'LF',
    encoding: 'UTF-8',
  });
  const [commitMessage, setCommitMessage] = React.useState('');
  /* Recently used commit messages, recalled with ↑/↓ like IDEA's message box. */ const [
    messageHistory,
    setMessageHistory,
  ] = React.useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = React.useState(-1);
  const [amend, setAmend] = React.useState(false);
  const [commitSelection, setCommitSelection] = React.useState<Set<string>>(() => new Set());
  const commitSelectionLoadedRef = React.useRef(false);
  const [commitBusy, setCommitBusy] = React.useState(false);
  const [commitError, setCommitError] = React.useState<string | null>(null);
  /* Git refuses to commit without an identity; say so before the message is written. */ const [
    identityMissing,
    setIdentityMissing,
  ] = React.useState(false);
  /* The reason the last push failed; clears on a successful one. */ const [pushError, setPushError] = React.useState<
    string | null
  >(null);
  /* A push can take a while; it needs its own busy flag so Commit stays usable. */ const [pushBusy, setPushBusy] =
    React.useState(false);
  /* Fetch and Update share the network cost of push, so each gets its own flag. */ const [fetchBusy, setFetchBusy] =
    React.useState(false);
  const [updateBusy, setUpdateBusy] = React.useState(false);
  const [commitNotice, setCommitNotice] = React.useState<string | null>(null);
  /* The message that was just committed, offered back as "Undo". */ const [clearedMessage, setClearedMessage] =
    React.useState('');
  /* The draft the user was typing before they started walking the history with ↑. */ const draftBeforeRecall =
    React.useRef<string | null>(null);
  /* What the box held before Amend prefilled it, so unticking Amend can restore it. */ const preAmendMessage =
    React.useRef<string | null>(null);
  const [diffTarget, setDiffTarget] = React.useState<DiffTarget | null>(null);
  /* IDEA's change list has a row selection separate from the diff tab. The
         selection is what ⌘D / stage / rollback act on; opening the diff is a
         double-click (or a deliberate Show Diff shortcut). */ const [selectedChange, setSelectedChange] =
    React.useState<DiffTarget | null>(null);
  const selectedChangeRef = React.useRef<DiffTarget | null>(null);
  /* IDEA's Changes tree can select a group node as well as a file row.
         Group selection is separate from commit inclusion and clears every
         file-scoped target so commands cannot act on a hidden previous row. */ const [
    selectedGroup,
    setSelectedGroup,
  ] = React.useState<ChangeGroup | null>(null);
  const selectedGroupRef = React.useRef<string | null>(null);
  /* IDEA's Changes list has a multi-row selection separate from the commit
         checkboxes. The primary row owns the diff/shortcuts; the range members
         receive row-level actions such as stage/rollback as one batch. */ const [selectedChanges, setSelectedChanges] =
    React.useState<Set<string>>(() => new Set());
  const selectedChangesRef = React.useRef<Set<string>>(new Set());
  const changeSelectionAnchorRef = React.useRef<SelectionAnchor | null>(null);
  const changeRowRefs = React.useRef<Map<string, HTMLElement>>(new Map());
  /* The Changes row that owned the keyboard before Show Diff moved focus
         into the comparison. Closing the diff returns it there, so the user can
         keep walking the list instead of hunting for the tree again. */ const diffReturnFocusRef =
    React.useRef<HTMLElement | null>(null);
  /* IDEA's undo/redo history is global across diff tabs, not scoped to the
         model currently mounted. Keep it here so switching from one changed
         file to another does not throw away the previous edit. */ const diffUndoRef = React.useRef<unknown[]>([]);
  const diffRedoRef = React.useRef<unknown[]>([]);
  const diffViewStatesRef = React.useRef<Map<string, Record<string, unknown>>>(new Map());
  const diffSearchInChangesRef = React.useRef<(() => void) | null>(null);
  /* The Commit diff keeps ONE editor tab. `diffTarget` is what it shows;
         `diffActive` says whether that tab or a file tab owns the code area, so
         picking a file tab does not silently leave the diff on screen. */ const [diffActive, setDiffActive] =
    React.useState(true);
  /* Per-line attribution for the open file (IDEA's Annotate). */ const [annotateTarget, setAnnotateTarget] =
    React.useState<AnnotateTarget | null>(null);
  /* The change the Commit panel is showing, for ⌥⌘Z. Declared AFTER the state
         it mirrors: a ref synced in an effect placed above it hits the TDZ. */ const selectedDiffPathRef =
    React.useRef<string | null>(null);
  const selectedCommitPathRef = React.useRef<string | null>(null);
  /* The context menu resolves conflict actions against the same git snapshot
         the row was rendered from, so a ref keeps the callback stable. */ const changesByPathRef = React.useRef<
    Map<string, DiffChange>
  >(new Map());
  /* The change the Commit panel last pointed at, kept after the diff closes:
         ⌘D closes the diff, and pressing it again must reopen the same one rather
         than fall through to "no current change" and do nothing. */ const lastChangePathRef =
    React.useRef<DiffTarget | null>(null);
  /* A newly opened diff takes the surface; the tab keeps its place when the
         user walks back to a file and returns. */ React.useEffect(() => {
    if (diffTarget !== null) {
      setDiffActive(true);
      setActivity('commit');
      setPanelVisible(true);
    }
  }, [diffTarget]);
  React.useEffect(() => {
    selectedDiffPathRef.current = diffTarget === null ? null : diffTarget.path;
    if (diffTarget !== null)
      lastChangePathRef.current = {
        path: diffTarget.path,
        staged: diffTarget.staged === true,
      };
  }, [diffTarget]);
  React.useEffect(() => {
    selectedChangeRef.current = selectedChange;
  }, [selectedChange]);
  React.useEffect(() => {
    selectedChangesRef.current = selectedChanges;
  }, [selectedChanges]);
  React.useEffect(() => {
    selectedGroupRef.current = selectedGroup;
  }, [selectedGroup]);
  React.useEffect(() => {
    if (selectedGroup === null) return;
    const members = splitChanges(git?.changes ?? [])[selectedGroup] ?? [];
    /* staged/unstaged remain valid, selectable empty tree nodes. Only the
           unversioned node disappears when git removes its last member. */ if (
      selectedGroup === 'unversioned' &&
      members.length === 0
    ) {
      setSelectedGroup(null);
      selectedGroupRef.current = null;
    }
  }, [git, selectedGroup]);
  React.useEffect(() => {
    if (selectedChange === null) return;
    const key = `${selectedChange.staged === true ? 'staged' : 'unstaged'}:${selectedChange.path}`;
    window.setTimeout(() => changeRowRefs.current.get(key)?.scrollIntoView?.({ block: 'nearest' }), 0);
  }, [selectedChange]);
  /**
   * Apply one Changes-list selection gesture.
   *
   * A plain click collapses to one row and moves the Shift anchor; Shift
   * extends from that anchor through the currently rendered visual order;
   * ⌘/Ctrl toggles a row without moving the anchor. These rows are the git
   * selection, not the commit checkboxes.
   * @param {{path: string, staged: boolean}} target - clicked row identity.
   * @param {{shift?: boolean, toggle?: boolean, row?: HTMLElement|null}} options - gesture modifiers.
   * @returns {void}
   */ const chooseChange = React.useCallback(
    (target: DiffTarget | null, options: Partial<Pick<DiffTarget, 'row' | 'shift' | 'toggle'>> = {}) => {
      if (target === null || typeof target.path !== 'string' || target.path === '') return;
      setSelectedGroup(null);
      const node = document.querySelector<HTMLElement>('[data-dsh-changes-list]');
      const rows: HTMLElement[] =
        node === null ? [] : [...node.querySelectorAll<HTMLElement>('[data-dsh-change-path]')];
      const keyOf = (row: HTMLElement) =>
        `${row.getAttribute('data-dsh-change-staged') === 'true' ? 'staged' : 'unstaged'}:${row.getAttribute('data-dsh-change-path')}`;
      const targetKey = `${target.staged === true ? 'staged' : 'unstaged'}:${target.path}`;
      const targetRow = rows.find((row) => keyOf(row) === targetKey) ?? options.row ?? null;
      if (options.shift === true) {
        const anchor = changeSelectionAnchorRef.current;
        const anchorIndex = anchor === null ? -1 : rows.findIndex((row) => keyOf(row) === anchor.key);
        const targetIndex = rows.indexOf(targetRow);
        if (anchor !== null && anchorIndex >= 0 && targetIndex >= 0) {
          const start = Math.min(anchorIndex, targetIndex);
          const end = Math.max(anchorIndex, targetIndex);
          const next = new Set(rows.slice(start, end + 1).map(keyOf));
          setSelectedChanges(next);
          selectedChangesRef.current = next;
        } else {
          const next = new Set([targetKey]);
          setSelectedChanges(next);
          selectedChangesRef.current = next;
        }
      } else if (options.toggle === true) {
        const next = new Set(selectedChangesRef.current);
        if (next.has(targetKey)) next.delete(targetKey);
        else next.add(targetKey);
        if (next.size === 0) next.add(targetKey);
        setSelectedChanges(next);
        selectedChangesRef.current = next;
        changeSelectionAnchorRef.current = { key: targetKey };
      } else {
        const next = new Set([targetKey]);
        setSelectedChanges(next);
        selectedChangesRef.current = next;
        changeSelectionAnchorRef.current = { key: targetKey };
      }
      setSelectedChange({ path: target.path, staged: target.staged === true });
    },
    [],
  );
  /**
   * Select a Changes group node without changing its commit inclusion.
   *
   * IDEA keeps row selection separate from the three-state checkbox. Moving
   * to a group therefore clears the file target and range selection, which
   * disables Show Diff and rollback until a file row is selected again.
   * @param {'staged'|'unstaged'|'unversioned'} group - selected band.
   * @returns {void}
   */ const chooseGroup = React.useCallback((group: ChangeGroup | null) => {
    if (group !== null && group !== 'staged' && group !== 'unstaged' && group !== 'unversioned') return;
    setSelectedGroup(group);
    setSelectedChange(null);
    selectedChangeRef.current = null;
    const empty = new Set<string>();
    setSelectedChanges(empty);
    selectedChangesRef.current = empty;
    changeSelectionAnchorRef.current = null;
  }, []);
  /**
   * Visible Changes rows selected for a batch action, in list order.
   * @returns {Array<{path: string, staged: boolean}>} selected identities.
   */ const chosenChanges = React.useCallback((fallback = selectedChangeRef.current) => {
    const node = document.querySelector<HTMLElement>('[data-dsh-changes-list]');
    const rows = node === null ? [] : [...node.querySelectorAll<HTMLElement>('[data-dsh-change-path]')];
    if (rows.length > 0) {
      return rows
        .map((row) => ({
          path: row.getAttribute('data-dsh-change-path'),
          staged: row.getAttribute('data-dsh-change-staged') === 'true',
        }))
        .filter((entry) => selectedChangesRef.current.has(`${entry.staged ? 'staged' : 'unstaged'}:${entry.path}`));
    }
    return fallback === null || fallback === undefined ? [] : [fallback];
  }, []);
  /**
   * Reconcile the Changes selection after a destructive git operation.
   *
   * IDEA keeps the list's keyboard position near the removed rows rather
   * than selecting the first file again. The current render's row order is
   * the visual truth; choose the nearest surviving row after the first
   * removed row. Checkboxes stay independent and are only pruned.
   * @param {object[]} changes - the post-operation git change list.
   * @param {Set<string>} removedKeys - `<staged|unstaged>:<path>` identities gone.
   * @returns {void}
   */ const reconcileChangeSelection = React.useCallback((changes: DiffChange[], removedKeys: Set<string>) => {
    if (!(removedKeys instanceof Set) || removedKeys.size === 0) return;
    const rows = [...document.querySelectorAll<HTMLElement>('[data-dsh-changes-list] [data-dsh-change-path]')];
    const keyOf = (row: HTMLElement) =>
      `${row.getAttribute('data-dsh-change-staged') === 'true' ? 'staged' : 'unstaged'}:${row.getAttribute('data-dsh-change-path')}`;
    const keysInVisualOrder = rows.map(keyOf);
    const firstRemoved = keysInVisualOrder.findIndex((key) => removedKeys.has(key));
    const remaining = new Set(
      (changes ?? []).flatMap((change) => {
        const entries = [];
        if (change.status[0] !== ' ' && change.status[0] !== '?') entries.push(`staged:${change.path}`);
        if (change.status[1] !== ' ') entries.push(`unstaged:${change.path}`);
        return entries;
      }),
    );
    const keptSelected = new Set([...selectedChangesRef.current].filter((key) => remaining.has(key)));
    let next = null;
    const selectedAfterRemoval = keysInVisualOrder.find((key) => keptSelected.has(key));
    if (selectedAfterRemoval !== undefined) next = selectedAfterRemoval;
    if (next === null && firstRemoved >= 0) {
      for (let offset = 1; offset < keysInVisualOrder.length; offset += 1) {
        const candidate = keysInVisualOrder[Math.min(firstRemoved + offset, keysInVisualOrder.length - 1)];
        if (remaining.has(candidate)) {
          next = candidate;
          break;
        }
      }
    }
    if (next === null) next = [...remaining][0] ?? null;
    if (next === null) {
      setSelectedChanges(new Set());
      selectedChangesRef.current = new Set();
      setSelectedChange(null);
      changeSelectionAnchorRef.current = null;
      return;
    }
    const separator = next.indexOf(':');
    const current = {
      path: next.slice(separator + 1),
      staged: next.slice(0, separator) === 'staged',
    };
    keptSelected.add(next);
    setSelectedChanges(keptSelected);
    selectedChangesRef.current = keptSelected;
    setSelectedChange(current);
    changeSelectionAnchorRef.current = { key: next };
  }, []);
  const closeDiff = React.useCallback(() => {
    setDiffTarget(null);
    /* The comparison tab is gone; without this the strip still points its
           active-key calculation at DIFF_TAB_KEY even though no diff exists. */ setDiffActive(false);
    const path = activePathRef.current;
    if (path !== null) {
      /* IDEA's ⌘W closes the diff tab and activates the editor tab that was
             underneath it. The file view is hidden while the diff owns the
             surface, so wait for React to restore it before moving the caret. */ window.setTimeout(
        () => editorRef.current?.focus(),
        0,
      );
      return;
    }
    const selected = selectedChangeRef.current;
    const selectedKey =
      selected === null ? null : `${selected.staged === true ? 'staged' : 'unstaged'}:${selected.path}`;
    const row =
      diffReturnFocusRef.current ?? (selectedKey === null ? null : changeRowRefs.current.get(selectedKey)) ?? null;
    diffReturnFocusRef.current = null;
    window.setTimeout(() => {
      if (row !== null && row.isConnected) row.focus();
      else focusWorkspaceFallback(document.querySelector<HTMLElement>('[data-dsh-editor-workspace]'));
    }, 0);
  }, []);
  React.useEffect(() => {
    selectedCommitPathRef.current = annotateTarget === null ? null : annotateTarget.path;
  }, [annotateTarget]);
  React.useEffect(() => {
    changesByPathRef.current = new Map((git?.changes ?? []).map((change) => [change.path, change]));
  }, [git]);
  const [annotateLines, setAnnotateLines] = React.useState<AnnotateLine[]>([]);
  const [annotateLoading, setAnnotateLoading] = React.useState(false);
  const [annotateTruncated, setAnnotateTruncated] = React.useState(false);
  /* Keys carry the workspace root, so this starts empty and is restored below. */ const [
    collapsedGroups,
    setCollapsedGroups,
  ] = React.useState<Set<string>>(() => new Set());
  const [menu, setMenu] = React.useState<WorkspaceMenuModel | null>(null);
  const [renameState, setRenameState] = React.useState<ProjectRenameState | null>(null);
  /* Hidden entries are shown BY DEFAULT: the tree hides only `.git`, because
         `.env` / `.github` / `.vscode` are files people actually open. The toggle
         still hides them for a compact view. */ const [showHidden, setShowHidden] = React.useState(
    () => readStoredText('dsh-editor.project.showHidden', '1') !== '0',
  );
  /* IDEA lets the Project view sort by name, type, or modification time. */ const [sortMode, setSortMode] =
    React.useState(() => readStoredText('dsh-editor.project.sort', 'name'));
  const [manualOrder, setManualOrder] = React.useState<Record<string, string[]>>(() => readProjectManualOrder(root));
  React.useEffect(() => {
    setManualOrder(readProjectManualOrder(root));
  }, [root]);
  const [markdownMode, setMarkdownModeState] = React.useState(() =>
    normalizeMarkdownMode(readStoredText('dsh-editor.markdown.mode', 'code')),
  );
  const setMarkdownMode = React.useCallback((next: Parameters<typeof normalizeMarkdownMode>[0]) => {
    const normalized = normalizeMarkdownMode(next);
    setMarkdownModeState(normalized);
    try {
      window.localStorage.setItem('dsh-editor.markdown.mode', normalized);
    } catch {
      /* a storage-less browser keeps the in-memory mode */
    }
  }, []);
  /* IDEA's Project View defaults to select-on-click/open-on-double-click.
         Users who prefer the old one-click behaviour can opt in explicitly. */ const [
    singleClickOpen,
    setSingleClickOpen,
  ] = React.useState(readProjectSingleClickOpen);
  /* Directories have their own IDEA option: default select-on-click and
         toggle-on-double-click, independently of the file-open preference. */ const [
    openDirectoriesSingleClick,
    setOpenDirectoriesSingleClick,
  ] = React.useState(() => readStoredText('dsh-editor.project.openDirectoriesSingleClick', '0') === '1');
  /* IDEA's preview tab is opt-in; enabling it makes single-click Project
         navigation reuse one replaceable tab until the user edits or pins it. */ const [
    previewTabEnabled,
    setPreviewTabEnabled,
  ] = React.useState(() => readStoredText('dsh-editor.project.previewTab', '0') === '1');
  /* IDEA Folders Always on Top: on by default, independently of Sort By. */ const [foldersFirst, setFoldersFirst] =
    React.useState(() => readStoredText('dsh-editor.project.foldersFirst', '1') !== '0');
  const foldersFirstRef = React.useRef(foldersFirst);
  /* IDEA Compact Directories: compatibility default is off, matching
         ViewSettings.isCompactDirectories(). */ const [compactDirectories, setCompactDirectories] = React.useState(
    () => readStoredText('dsh-editor.project.compactDirectories', '0') === '1',
  );
  /* The selected Project view is a reading preference and survives workspace
         switches, like IDEA's last used view for the Project tool window. */ const [projectView, setProjectView] =
    React.useState<ProjectView>(() => normalizeProjectView(readStoredText('dsh-editor.project.view', 'projectFiles')));
  const lastProjectTreeViewRef = React.useRef(projectViewIsTree(projectView) ? projectView : 'projectFiles');
  /** Select one supported IDEA Project view and remember it globally. */ const applyProjectView = React.useCallback(
    (next: Parameters<typeof normalizeProjectView>[0]) => {
      const normalized = normalizeProjectView(next);
      if (projectViewIsTree(normalized)) lastProjectTreeViewRef.current = normalized;
      setProjectView(normalized);
      try {
        window.localStorage.setItem('dsh-editor.project.view', normalized);
      } catch {
        /* a storage-less browser keeps the in-memory view */
      }
    },
    [],
  );
  /* Compatibility default: existing users keep seeing heavy directories
         until they explicitly hide excluded items. */ const [showExcludedFiles, setShowExcludedFiles] = React.useState(
    () => readStoredText('dsh-editor.project.showExcludedFiles', '1') !== '0',
  );
  /* Listing filters update asynchronously through loadRoot. Read the latest
         authority synchronously during render so an older request cannot prune
         paths that are merely hidden from the current listing. */ const listingAuthoritativeRef = React.useRef(
    showHidden && showExcludedFiles,
  );
  listingAuthoritativeRef.current = showHidden && showExcludedFiles;
  const [conflict, setConflict] = React.useState<EditorSaveConflictState | null>(null);
  /* Open tabs whose file changed on disk since they were loaded. */ const [externalChanges, setExternalChanges] =
    React.useState<Record<string, EditorExternalChange>>({});
  /* A workspace change can replace a Markdown image without changing its
         document text. Keep cache keys per changed directory so unrelated
         edits do not make every image in the preview refetch. */ const [
    markdownAssetRevisions,
    setMarkdownAssetRevisions,
  ] = React.useState<MarkdownAssetRevisions>({ global: 0, directories: {} });
  React.useEffect(() => {
    setMarkdownAssetRevisions({ global: 0, directories: {} });
  }, [root]);
  /* Open files that no longer exist on disk, shown with a strikethrough in the tree. */ const [
    deletedPaths,
    setDeletedPaths,
  ] = React.useState<Set<string>>(() => new Set());
  /* Files that appeared outside the editor since the last refresh. */ const [newPaths, setNewPaths] = React.useState<
    Set<string>
  >(() => new Set());
  /* Paths seen in the previous root listing; null until the baseline is established. */ const knownPathsRef =
    React.useRef<Set<string> | null>(null);
  /* Paths whose model is being replaced programmatically: that edit is not a user edit. */ const silentReloadRef =
    React.useRef<Set<string>>(new Set());
  const [replaceState, setReplaceState] = React.useState<EditorFindState | null>(null);
  const [editorFindHistoryMenu, setEditorFindHistoryMenu] = React.useState<EditorFindHistoryMenu | null>(null);
  const [quickOpen, setQuickOpen] = React.useState<QuickOpenState | null>(null);
  const quickOpenReturnFocusRef = React.useRef<HTMLElement | null>(null);
  const quickOpenFilesRequestRef = React.useRef(0);
  const quickOpenFilesAbortRef = React.useRef<AbortController | null>(null);
  const paletteReturnFocusRef = React.useRef<HTMLElement | null>(null);
  /* IDEA's double-Shift search reuses existing file, text and action data. */
  const [searchEverywhere, setSearchEverywhere] = React.useState<SearchEverywhereState | null>(null);
  const [searchHistoryRequest, setSearchHistoryRequest] = React.useState(0);
  const [findUsagesHistoryRequest, setFindUsagesHistoryRequest] = React.useState(0);
  const [recentSearches, setRecentSearches] = React.useState<string[]>([]);
  const [recentFindQueries, setRecentFindQueries] = React.useState<string[]>([]);
  const [recentFindUsages, setRecentFindUsages] = React.useState<string[]>([]);
  const [recentReplacements, setRecentReplacements] = React.useState<string[]>([]);
  const [customFindScopes, setCustomFindScopes] = React.useState<CustomFindScope[]>([]);
  const sharedFindScopesRef = React.useRef<CustomFindScope[]>([]);
  const [findReplaceUndoStack, setFindReplaceUndoStack] = React.useState<ReplaceHistoryEntry[]>([]);
  const [findReplaceRedoStack, setFindReplaceRedoStack] = React.useState<ReplaceHistoryEntry[]>([]);
  const [recentCommands, setRecentCommands] = React.useState(() => readCommandHistory());
  const searchEverywhereFilesRef = React.useRef<SearchEverywhereFile[]>([]);
  const searchEverywhereFilesScopeRef = React.useRef<boolean | null>(null);
  const searchEverywhereFilesRequestRef = React.useRef(0);
  const searchEverywhereFilesAbortRef = React.useRef<AbortController | null>(null);
  const searchEverywhereReturnFocusRef = React.useRef<HTMLElement | null>(null);
  const findToolReturnFocusRef = React.useRef<HTMLElement | null>(null);
  const findToolDraftRef = React.useRef<FindToolDraft>({ query: '', replace: '' });
  const searchTextRequestRef = React.useRef(0);
  const doubleShiftAtRef = React.useRef(0);
  /* Monaco effects mount before Search Everywhere is declared below. Route
         their callbacks through a ref so the dependency arrays cannot hit TDZ. */ const openSearchEverywhereRef =
    React.useRef<(tab?: string, query?: string, withReplace?: boolean) => void>(() => {});
  /* IDEA's persistent Find tool window, shared by Find/Replace in Files. */ const [findTool, setFindTool] =
    React.useState<FindToolState | null>(null);
  React.useEffect(() => {
    if (findTool !== null) findToolDraftRef.current = { query: findTool.query, replace: findTool.replace };
  }, [findTool?.query, findTool?.replace]);
  const [findToolFileCandidates, setFindToolFileCandidates] = React.useState<string[]>([]);
  const [findToolFileCandidatesScope, setFindToolFileCandidatesScope] = React.useState<boolean | null>(null);
  const [findToolFileCandidatesTruncated, setFindToolFileCandidatesTruncated] = React.useState(false);
  const findToolFileRequestRef = React.useRef(0);
  const findToolFileAbortRef = React.useRef<AbortController | null>(null);
  const [findToolPopupGeometry, setFindToolPopupGeometry] = React.useState(() => readFindPopupGeometry());
  const [searchEverywherePopupGeometry, setSearchEverywherePopupGeometry] = React.useState(() =>
    readFloatingPopupGeometry(SEARCH_EVERYWHERE_POPUP_GEOMETRY_STORAGE_KEY, SEARCH_EVERYWHERE_POPUP_GEOMETRY_DEFAULTS),
  );
  const [findToolDockHeight, setFindToolDockHeight] = React.useState(() =>
    clampFindDockHeight(readStoredNumber('dsh-editor.find.height', 280)),
  );
  const [findToolDockMinimized, setFindToolDockMinimized] = React.useState(false);
  const findToolRequestRef = React.useRef(0);
  const findToolHandoffSequenceRef = React.useRef(0);
  const replaceWriteBusyRef = React.useRef(false);
  /* IDEA's transient Show Usages popup is separate from persistent Find. */ const [showUsages, setShowUsages] =
    React.useState<ShowUsagesState | null>(null);
  const showUsagesRequestRef = React.useRef(0);
  const showUsagesAbortRef = React.useRef<AbortController | null>(null);
  const editorFindStepRef = React.useRef<(direction: number) => void>(() => {});
  const editorFindQueryActiveRef = React.useRef(false);
  React.useEffect(() => {
    editorFindQueryActiveRef.current = replaceState !== null && replaceState.find !== '';
  }, [replaceState?.find]);
  /* IDEA's revision picker (Compare with Revision…), searchable. */ const [revisionPicker, setRevisionPicker] =
    React.useState<RevisionPickerState | null>(null);
  const revisionPickerRequestRef = React.useRef(0);
  const revisionPickerAbortRef = React.useRef<AbortController | null>(null);
  /* IDEA's Recent Files (⌘E): the MRU list for this workspace. */ const [recentFiles, setRecentFiles] = React.useState<
    string[]
  >([]);
  /* The palette mode: 'files' is Go to File, 'recent' is Recent Files. */ const [paletteMode, setPaletteMode] =
    React.useState<'files' | 'recent'>('files');
  /* IDEA's in-window name prompt (New Branch / New Tag). */ const [namePrompt, setNamePrompt] =
    React.useState<NamePromptState | null>(null);
  /* Menus restore their own opener after unmounting. Keep the actionable target
     separately so cancelling the prompt returns to the branch chip or log list. */
  const namePromptReturnFocusRef = React.useRef<HTMLElement | null>(null);
  const branchPromptOriginRef = React.useRef<HTMLElement | null>(null);
  const logPromptOriginRef = React.useRef<HTMLElement | null>(null);
  const branchMenuRequestRef = React.useRef(0);
  const commitMenuRequestRef = React.useRef(0);
  /* IDEA's "Move to…" (F6): a directory picker over the whole workspace. */ const [moveTo, setMoveTo] =
    React.useState<MoveToPickerState | null>(null);
  const moveToRequestRef = React.useRef(0);
  const moveToAbortRef = React.useRef<AbortController | null>(null);
  const [commitMode, setCommitMode] = React.useState<'changes' | 'log'>('changes');
  /* IDEA's "Group by" for the change list; persisted because it is a
         preference about how the user reads changes, not about one session. */ const [groupBy, setGroupBy] =
    React.useState(() => readStoredText('dsh-editor.commit.groupBy', 'directory'));
  /* Group by can rebuild the tree under the current row. The effect below
         restores focus only after that new tree has committed. */ const groupByFocusRef =
    React.useRef<DiffTarget | null>(null);
  React.useEffect(() => {
    const target = groupByFocusRef.current;
    if (target === null) return;
    const key = `${target.staged === true ? 'staged' : 'unstaged'}:${target.path}`;
    const row =
      changeRowRefs.current.get(key) ??
      [...document.querySelectorAll<HTMLElement>('[data-dsh-changes-list] [data-dsh-change-path]')].find(
        (candidate) =>
          candidate.getAttribute('data-dsh-change-path') === target.path &&
          candidate.getAttribute('data-dsh-change-staged') === String(target.staged === true),
      );
    if (row === undefined) return;
    row.focus?.();
    row.scrollIntoView?.({ block: 'nearest' });
    groupByFocusRef.current = null;
  }, [collapsedGroups, groupBy]);
  /* The change-list filter; deliberately NOT persisted — a filter left over
         from yesterday makes the list look like files went missing. */ const [pathQuery, setPathQuery] =
    React.useState('');
  /* One remembered offset per Commit tab: switching tabs remounts the list, and
         IDEA keeps each tab where you left it. */ const commitScrollRef = React.useRef<CommitScrollOffsets>({
    changes: null,
    log: null,
  });
  const commitChangesRef = React.useRef<HTMLDivElement | null>(null);
  const commitLogRef = React.useRef<HTMLDivElement | null>(null);
  /**
   * Record the outgoing tab's offset, then switch.
   * @param {'changes'|'log'} next - tab being opened.
   * @returns {void}
   */ const switchCommitMode = React.useCallback(
    (next: CommitMode) => {
      const node = commitMode === 'changes' ? commitChangesRef.current : commitLogRef.current;
      if (node !== null && node !== undefined) commitScrollRef.current[commitMode] = node.scrollTop;
      setCommitMode(next);
    },
    [commitMode],
  );
  /**
   * Put the incoming tab back where the user left it.
   * @param {'changes'|'log'} mode - tab that just rendered.
   * @returns {void}
   */ const rememberCommitScroll = React.useCallback((mode: CommitMode) => {
    const node = mode === 'changes' ? commitChangesRef.current : commitLogRef.current;
    if (node === null || node === undefined) return;
    const next = restoreScrollTop({
      remembered: commitScrollRef.current[mode],
      max: node.scrollHeight - node.clientHeight,
    });
    if (next === null) return;
    node.scrollTop = next;
  }, []);
  /* Apply the remembered offset once the active tab's list has rendered. */ React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => rememberCommitScroll(commitMode));
    return () => window.cancelAnimationFrame(frame);
  }, [commitMode, rememberCommitScroll]);
  const [commits, setCommits] = React.useState<WorkspaceLogCommit[]>([]);
  /* The commit just created, highlighted in the log so the user sees it land. */ const [
    highlightedCommit,
    setHighlightedCommit,
  ] = React.useState<string | null>(null);
  const [logLoading, setLogLoading] = React.useState(false);
  const [logDetail, setLogDetail] = React.useState<CommitLogDetail | null>(null);
  /* The commit chosen in either the flat list or the graph; both views mark it. */ const [
    selectedCommit,
    setSelectedCommit,
  ] = React.useState<string | null>(null);
  const [logSelectedCommits, setLogSelectedCommits] = React.useState<string[]>([]);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const editorRef = React.useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const markdownPreviewRef = React.useRef<HTMLDivElement | null>(null);
  const markdownScrollSyncRef = React.useRef<{ source: 'editor' | 'preview' | null; until: number }>({
    source: null,
    until: 0,
  });
  const splitEditorRef = React.useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const splitContainerRef = React.useRef<HTMLDivElement | null>(null);
  const focusedEditorRef = React.useRef<FocusedEditorState | null>(null);
  const focusedPathRef = React.useRef<string | null>(null);
  const modelsRef = React.useRef<Map<string, Monaco.editor.ITextModel>>(new Map());
  const navigationHistoryRef = React.useRef<NavigationHistory>({ back: [], forward: [] });
  const navigationCurrentLocationRef = React.useRef<NavigationLocation | null>(null);
  const activePathRef = React.useRef<string | null>(null);
  const splitPathRef = React.useRef<string | null>(null);
  const splitTabsRef = React.useRef<string[]>([]);
  const previewPathRef = React.useRef<string | null>(null);
  /* The editor groups mount before the Find tool callback is declared. */ const findUsagesRunnerRef = React.useRef<
    ((editor: Monaco.editor.ICodeEditor) => void) | null
  >(null);
  const findToolContextRunnerRef = React.useRef<
    ((editor: Monaco.editor.ICodeEditor, mode: 'find' | 'replace') => void) | null
  >(null);
  const editorFindContextRunnerRef = React.useRef<
    ((editor: Monaco.editor.ICodeEditor, withReplace?: boolean, focusTarget?: 'query' | 'replace') => void) | null
  >(null);
  const selectionFindContextRunnerRef = React.useRef<
    ((editor: Monaco.editor.ICodeEditor, withReplace?: boolean, focusTarget?: 'query' | 'replace') => void) | null
  >(null);
  /* Read by the window/Monaco shortcuts, which are registered once. */ const diffActiveRef = React.useRef(true);
  const openFilesRef = React.useRef<OpenWorkspaceFile[]>([]);
  const entriesRef = React.useRef<WorkspaceEntry[]>([]);
  const sessionRestoredFor = React.useRef('');
  const sessionRestoringRef = React.useRef(false);
  const sessionRestoreGeneration = React.useRef(0);
  const childrenRef = React.useRef<Record<string, WorkspaceEntry[]>>({});
  const expandedRef = React.useRef<Set<string>>(expanded);
  const rootRef = React.useRef('');
  const rememberCurrentSearchQuery = React.useCallback((query: string) => {
    const next = rememberWorkspaceSearchQuery(rootRef.current, query);
    if (next !== null) setRecentSearches(next);
  }, []);
  const rememberCurrentFindQuery = React.useCallback((query: string) => {
    const next = rememberWorkspaceFindQuery(rootRef.current, query);
    if (next !== null) setRecentFindQueries(next);
  }, []);
  const rememberCurrentReplacement = React.useCallback((replacement: string) => {
    const next = rememberWorkspaceReplacement(rootRef.current, replacement);
    if (next !== null) setRecentReplacements(next);
  }, []);
  /* Which workspace's fold state is currently loaded (see loadRoot). */ const collapsedRestoredFor = React.useRef('');
  const rowRefs = React.useRef<Map<string, HTMLElement>>(new Map());
  const treeRef = React.useRef<HTMLDivElement | null>(null);
  const toolWindowPanelRef = React.useRef<HTMLDivElement | null>(null);
  const cancelFocusRequestRef = React.useRef<(() => void) | null>(null);
  /* Per-directory background prefetch generation, so a slower older walk
         cannot overwrite a newer listing after rapid expand/collapse. */ const projectPrefetchTokensRef = React.useRef<
    Map<string, number>
  >(new Map());
  /* Read by the one-shot keyboard handlers, which must not re-bind per render. */ const panelVisibleRef =
    React.useRef(true);
  const activityRef = React.useRef<'project' | 'commit'>('project');
  const gitRef = React.useRef<WorkspaceGitStatus | null>(null);
  const restageRef = React.useRef<(paths: string[], staged: boolean) => Promise<boolean>>(async () => false);
  /* The sort the tree is currently laid out with, and the row to keep visible. */ const sortAppliedRef =
    React.useRef('');
  const selectedPathRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    activePathRef.current = activePath;
  }, [activePath]);
  React.useEffect(() => {
    splitPathRef.current = splitPath;
  }, [splitPath]);
  React.useEffect(() => {
    splitTabsRef.current = splitTabs;
  }, [splitTabs]);
  React.useEffect(() => {
    focusedPathRef.current = focusedPath;
  }, [focusedPath]);
  const currentCodeEditor = React.useCallback(() => {
    const focused = focusedEditorRef.current?.editor ?? null;
    const model = focused?.getModel?.();
    return model === null || model === undefined ? editorRef.current : focused;
  }, []);
  const currentCodePath = React.useCallback(
    () => focusedEditorRef.current?.path ?? focusedPathRef.current ?? activePathRef.current,
    [],
  );
  const rememberPaletteOrigin = React.useCallback(() => {
    const activeElement =
      typeof HTMLElement !== 'undefined' && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (activeElement !== null && activeElement !== document.body) paletteReturnFocusRef.current = activeElement;
  }, []);
  const restorePaletteFocus = React.useCallback(() => {
    const previous = paletteReturnFocusRef.current;
    paletteReturnFocusRef.current = null;
    window.setTimeout(() => {
      if (previous !== null && previous.isConnected) {
        previous.focus();
        return;
      }
      if (currentCodePath() !== null) {
        currentCodeEditor()?.focus?.();
        return;
      }
      focusWorkspaceFallback(document.querySelector<HTMLElement>('[data-dsh-editor-workspace]'));
    }, 0);
  }, [currentCodeEditor, currentCodePath]);
  const openNamePrompt = React.useCallback((state: NamePromptState, returnFocus: HTMLElement | null = null) => {
    const activeElement =
      typeof HTMLElement !== 'undefined' && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    namePromptReturnFocusRef.current =
      returnFocus !== null && returnFocus.isConnected
        ? returnFocus
        : activeElement !== null && activeElement !== document.body && activeElement.closest('[role="menu"]') === null
          ? activeElement
          : null;
    setNamePrompt(state);
  }, []);
  const finishNamePrompt = React.useCallback(() => {
    namePromptReturnFocusRef.current = null;
    branchPromptOriginRef.current = null;
    logPromptOriginRef.current = null;
    setNamePrompt(null);
  }, []);
  const dismissNamePrompt = React.useCallback(() => {
    const previous = namePromptReturnFocusRef.current;
    namePromptReturnFocusRef.current = null;
    branchPromptOriginRef.current = null;
    logPromptOriginRef.current = null;
    setNamePrompt(null);
    window.setTimeout(() => {
      if (previous !== null && previous.isConnected) {
        previous.focus();
        return;
      }
      if (currentCodePath() !== null) {
        currentCodeEditor()?.focus?.();
        return;
      }
      focusWorkspaceFallback(document.querySelector<HTMLElement>('[data-dsh-editor-workspace]'));
    }, 0);
  }, [currentCodeEditor, currentCodePath]);
  const currentNavigationLocation = React.useCallback(() => {
    const focused = focusedEditorRef.current;
    const editor = focused?.editor ?? editorRef.current;
    const model = editor?.getModel?.() ?? null;
    const position = editor?.getPosition?.() ?? null;
    return normalizeNavigationLocation({
      path: navigationPathForModel(model) || focused?.path || focusedPathRef.current || activePathRef.current || '',
      line: position?.lineNumber ?? 1,
      column: position?.column ?? 1,
    });
  }, []);
  React.useEffect(() => {
    diffActiveRef.current = diffActive;
  }, [diffActive]);
  React.useEffect(() => {
    selectedPathRef.current = selectedPath;
  }, [selectedPath]);
  React.useEffect(() => {
    openFilesRef.current = openFiles;
  }, [openFiles]);
  React.useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);
  React.useEffect(() => {
    previewPathRef.current = previewPath;
  }, [previewPath]);
  React.useEffect(() => {
    childrenRef.current = children;
  }, [children]);
  React.useEffect(() => {
    expandedRef.current = expanded;
    if (expandedRestoredRef.current !== '') writeExpanded(expandedRestoredRef.current, expanded);
  }, [expanded]);
  React.useEffect(() => {
    rootRef.current = root;
  }, [root]);
  /* The keyboard shortcuts are registered once, so they read the panel state,
         the git snapshot and the stager through refs rather than stale closures. */ React.useEffect(() => {
    panelVisibleRef.current = panelVisible;
  }, [panelVisible]);
  React.useEffect(() => {
    activityRef.current = activity;
  }, [activity]);
  React.useEffect(() => {
    gitRef.current = git;
  }, [git]);
  const beginEditorTabDrag = React.useCallback(
    (event: React.DragEvent<HTMLElement>, group: EditorGroup, path: string) => {
      if ((group !== 'left' && group !== 'right') || typeof path !== 'string' || path === '') return;
      const source = { group, path };
      editorTabDragRef.current = source;
      setEditorTabDrag(source);
      setEditorTabDrop(null);
      event.dataTransfer?.setData('text/plain', path);
      if (event.dataTransfer !== null && event.dataTransfer !== undefined) event.dataTransfer.effectAllowed = 'move';
    },
    [],
  );
  const dragOverEditorTab = React.useCallback(
    (event: React.DragEvent<HTMLElement>, group: EditorGroup, path: string) => {
      const source = editorTabDragRef.current;
      if (source === null || source.group !== group || source.path === path) return;
      event.preventDefault();
      if (event.dataTransfer !== null && event.dataTransfer !== undefined) event.dataTransfer.dropEffect = 'move';
      const rect = event.currentTarget.getBoundingClientRect();
      setEditorTabDrop({
        group,
        path,
        after: event.clientX > rect.left + rect.width / 2,
      });
    },
    [],
  );
  const moveEditorTab = React.useCallback((group: EditorGroup, source: string, target: string, after: boolean) => {
    if (group === 'left') {
      const next = reorderTabPaths(openFilesRef.current, source, target, after, (file) => file.path);
      if (next === openFilesRef.current) return;
      openFilesRef.current = next;
      setOpenFiles(next);
      return;
    }
    if (group === 'right') {
      const next = reorderTabPaths(splitTabsRef.current, source, target, after, (path) => path);
      if (next === splitTabsRef.current) return;
      splitTabsRef.current = next;
      setSplitTabs(next);
    }
  }, []);
  /** Move one tab by ±1 while preserving the active document. */ const moveEditorTabByOffset = React.useCallback(
    (group: EditorGroup, path: string, direction: number) => {
      const order =
        group === 'left'
          ? openFilesRef.current.map((file) => file.path)
          : group === 'right'
            ? splitTabsRef.current
            : [];
      const index = order.indexOf(path);
      const target = index < 0 ? undefined : order[index + direction];
      if (target === undefined) return;
      moveEditorTab(group, path, target, direction > 0);
    },
    [moveEditorTab],
  );
  const dropEditorTab = React.useCallback(
    (event: React.DragEvent<HTMLElement>, group: EditorGroup, path: string) => {
      event.preventDefault();
      const source = editorTabDragRef.current;
      const rect = event.currentTarget.getBoundingClientRect();
      const after = event.clientX > rect.left + rect.width / 2;
      editorTabDragRef.current = null;
      setEditorTabDrag(null);
      setEditorTabDrop(null);
      if (source === null || source.group !== group || source.path === path) return;
      moveEditorTab(group, source.path, path, after);
    },
    [moveEditorTab],
  );
  const activeFile = activePath === null ? null : (openFiles.find((file) => file.path === activePath) ?? null);
  const activateImagePane = React.useCallback((path: string) => {
    if (typeof path !== 'string' || path === '') return;
    const editor = splitPathRef.current === path ? splitEditorRef.current : editorRef.current;
    focusedEditorRef.current = { path, editor };
    focusedPathRef.current = path;
    setFocusedPath(path);
  }, []);
  const activeImage = activeFile?.kind === 'image';
  const markdownAvailable = activeFile !== null && isMarkdownPath(activePath);
  const effectiveMarkdownMode = markdownAvailable ? markdownMode : 'code';
  const markdownPreviewVisible = markdownAvailable && effectiveMarkdownMode !== 'code';
  const splitFile = splitPath === null ? null : (openFiles.find((file) => file.path === splitPath) ?? null);
  const splitImage = splitFile?.kind === 'image';
  const splitFocused = splitFile !== null && focusedPath === splitFile.path;
  const statusFile = splitFocused ? splitFile : (activeFile ?? splitFile);
  const statusPath = statusFile === null ? '' : root === '' ? statusFile.path : `${root}/${statusFile.path}`;
  const leftFocused = focusedPath === activePath && splitFocused === false;
  /* The diff preview is rendered only while its tab (or a freshly opened
         change) owns the code area. */ const diffOpen = diffTarget !== null && diffActive;
  const fileSurfaceVisible =
    (activeFile !== null || splitFile !== null) &&
    diffOpen === false &&
    annotateTarget === null &&
    editorTerminals.length === 0;
  /**
   * Move keyboard ownership from the terminal dock back into the editor.
   *
   * A visible diff owns its own modified Monaco instance, so the workspace
   * dispatches a scoped event instead of focusing the hidden main editor.
   * With no diff, Monaco's normal editor is the correct target.
   * @returns {void}
   */ const focusEditorSurface = React.useCallback(() => {
    cancelFocusRequestRef.current?.();
    cancelFocusRequestRef.current = focusSurfaceWhenReady(() => {
      if (!diffOpen) return editorRef.current;
      const host = editorRef.current?.getDomNode?.()?.closest?.('[data-dsh-editor-workspace]') ?? null;
      if (host === null) return null;
      return {
        focus: () => {
          host.dispatchEvent(new CustomEvent('dsh-editor-focus-diff'));
        },
      };
    });
  }, [diffOpen]);
  /* IDEA's combined diff can walk every changed file without returning to
         the Changes tree. The sequence follows the active Group by order, so
         Control+Shift+Left/Right lands on the same file the user sees there. */ const diffChangeSequence =
    React.useMemo(
      () => filterChangeSequence(changeSequenceOf(git?.changes ?? [], groupBy), pathQuery),
      [git, groupBy, pathQuery],
    );
  const diffFilePosition = React.useMemo(
    () => changePositionOf(diffChangeSequence, diffTarget),
    [diffChangeSequence, diffTarget],
  );
  /**
   * Clear every collapsed group/directory that hides one changed row.
   *
   * Diff navigation, Group by and the Changes path filter all need the same
   * visibility repair. Keeping it here means no caller can forget one of the
   * staged/unstaged/unversioned collapse-key variants.
   * @param {{path: string, staged: boolean}|null} target - row identity to reveal.
   * @returns {void}
   */ const revealChangeRow = React.useCallback((target: DiffTarget | null) => {
    if (target === null || target === undefined || typeof target.path !== 'string') return;
    const change = changesByPathRef.current.get(target.path);
    const group = changeRowGroup(change, target.staged);
    const revealKeys = revealCollapseKeys(group, target.path);
    setCollapsedGroups((current) => {
      const revealed = new Set(current);
      let changed = false;
      for (const collapseKey of revealKeys) changed = revealed.delete(collapseKey) || changed;
      if (!changed) return current;
      writeCollapsedGroups(rootRef.current, revealed);
      return revealed;
    });
  }, []);
  const navigateDiffFile = React.useCallback(
    (direction: 'previous' | 'next') => {
      const position = changePositionOf(diffChangeSequence, diffTarget);
      if (position === null) return;
      const nextIndex = position.index - 1 + (direction === 'previous' ? -1 : 1);
      if (nextIndex < 0 || nextIndex >= diffChangeSequence.length) return;
      const next = diffChangeSequence[nextIndex];
      revealChangeRow(next);
      const key = `${next.staged ? 'staged' : 'unstaged'}:${next.path}`;
      diffReturnFocusRef.current = changeRowRefs.current.get(key) ?? null;
      chooseChange(next, {});
      setDiffTarget({ path: next.path, staged: next.staged });
      setDiffActive(true);
    },
    [chooseChange, diffChangeSequence, diffTarget, revealChangeRow],
  );
  const projectName = basename(root) || 'Workspace';
  const filteredView = projectViewIsTree(projectView) === false;
  const projectTreeActionsAvailable = filteredView === false;
  const projectExpandAllAvailable = projectTreeActionsAvailable && projectCanExpandAll(entries, children, expanded);
  const projectRows = React.useMemo(
    () => flattenRows(entries, children, expanded, projectName, root, compactDirectories, sortMode, manualOrder),
    [compactDirectories, entries, children, expanded, manualOrder, projectName, root, sortMode],
  );
  const previousProjectRowsRef = React.useRef<string[]>([]);
  const rows = React.useMemo(
    () => projectViewRows(projectView, projectRows, openFiles, git),
    [git, openFiles, projectRows, projectView],
  );
  /* Mirror the flattened rows for the loader (which runs outside render). */ React.useEffect(() => {
    rowsRef.current = projectRows;
  }, [projectRows]);
  React.useEffect(() => {
    if (root === '' || treeLoading) return;
    const authoritative = listingAuthoritativeRef.current;
    setExpanded((current) =>
      pruneProjectExpandedPaths({
        expanded: current,
        rootEntries: entries,
        children,
        authoritative,
      }),
    );
    setManualOrder((current) => {
      const next = pruneProjectManualOrder({
        order: current,
        rootEntries: entries,
        children,
        authoritative,
      });
      if (next !== current) writeProjectManualOrder(rootRef.current, next);
      return next;
    });
  }, [children, entries, root, showExcludedFiles, showHidden, treeLoading]);
  React.useEffect(() => {
    if (filteredView === false) return;
    const nextState = filteredViewSelection(
      rows.map((row) => row.path),
      selection,
      selectedPath,
    );
    if (nextState.selection !== selection || nextState.primary !== selectedPath) {
      applyTreeSelection(nextState.selection, nextState.primary, nextState.primary);
    }
  }, [applyTreeSelection, filteredView, rows, selectedPath, selection]);
  React.useEffect(() => {
    const previousPaths = previousProjectRowsRef.current;
    previousProjectRowsRef.current = projectRows.map((row) => row.path);
    if (filteredView || root === '' || treeLoading || (selectedPath === null && selection.size === 0)) return;
    const next = projectSelectionSetAfterRowsChange({
      selection,
      selectedPath,
      previousPaths,
      rowPaths: projectRows.map((row) => row.path),
      expanded,
    });
    if (next.selection !== selection || next.primary !== selectedPath) {
      applyTreeSelection(next.selection, next.primary, next.primary);
    }
  }, [applyTreeSelection, expanded, filteredView, projectRows, root, selectedPath, selection, treeLoading]);
  /**
   * Apply one click on a tree row, honouring IDEA's ⌘/Shift modifiers.
   *
   * A plain click replaces the selection; ⌘/Ctrl toggles one row; Shift takes
   * the whole visible range between the anchor and the clicked row, exactly
   * like the Project tool window's DnD and batch delete.
   * @param {object} row - flattened tree row.
   * @param {{metaKey?: boolean, ctrlKey?: boolean, shiftKey?: boolean}} event - click modifiers.
   */ const selectRow = React.useCallback(
    (row: ProjectRow, event: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean }) => {
      const next = projectTreeSelectionAfterPointer({
        rows,
        selection: selectionRef.current,
        primary: selectionPrimaryRef.current,
        anchor: selectionAnchor.current,
        path: row.path,
        metaKey: event.metaKey === true,
        ctrlKey: event.ctrlKey === true,
        shiftKey: event.shiftKey === true,
      });
      applyTreeSelection(next.selection, next.primary, next.anchor);
    },
    [applyTreeSelection, rows],
  );
  /* Load Monaco once. */ React.useEffect(() => {
    let cancelled = false;
    loadMonaco().then(
      () => {
        if (!cancelled) setMonacoReady(true);
      },
      (error) => {
        if (!cancelled) setMonacoError(error instanceof Error ? error.message : String(error));
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);
  /* File tabs overflow like the terminal dock's: measure the strip, not the tabs. */ React.useLayoutEffect(() => {
    const node = fileTabStripRef.current;
    if (node === null) return undefined;
    const measure = () => setTabStripWidth(node.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  /* The right group is often narrower than one full tab; measure it instead
         of letting additional tabs disappear beyond the pane's clipped edge. */ React.useLayoutEffect(() => {
    const node = splitTabStripRef.current;
    if (node === null) return undefined;
    const measure = () => setSplitTabStripWidth(node.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [splitTabs.length === 0]);
  const loadGit = React.useCallback(async () => {
    try {
      const value = await callGit<WorkspaceGitStatus>({ op: 'status' });
      setGit(value);
      setCommitError(null);
      /* Keep the user's checkbox choices across a watcher/signature refresh;
             only drop paths that no longer exist. Re-selecting everything made
             a manual uncheck (or Space) bounce back on the next status frame. */ setCommitSelection((current) => {
        const changes = value?.changes ?? [];
        if (commitSelectionLoadedRef.current === false) {
          commitSelectionLoadedRef.current = true;
          return new Set(changes.map((change) => change.path));
        }
        return new Set([...current].filter((path) => changes.some((change) => change.path === path)));
      });
      /* The watcher can remove one SIDE of an open diff between two status
             reads (e.g. it was unstaged, then only the index copy remains).
             Keeping the preview on the vanished side means its restore arrow
             targets a placeholder that no longer exists. Check the exact group
             the target opened from, not just the path. */ setDiffTarget((current) => {
        if (
          current === null ||
          typeof current.clipboardText === 'string' ||
          typeof current.revision === 'string' ||
          typeof current.commit === 'string' ||
          current.combined === true
        )
          return current;
        const bands = splitChanges(value?.changes ?? []);
        const group = current.staged === true ? 'staged' : 'unstaged';
        const stillListed = listedInChangeBand(bands, group, current.path);
        if (stillListed) return current;
        return null;
      });
      setSelectedChange((current) => {
        if (current === null) return current;
        const bands = splitChanges(value?.changes ?? []);
        const group = current.staged === true ? 'staged' : 'unstaged';
        return listedInChangeBand(bands, group, current.path) ? current : null;
      });
      setSelectedChanges((current) => {
        if (current.size === 0) return current;
        const bands = splitChanges(value?.changes ?? []);
        const valid = new Set<string>();
        for (const key of current) {
          const separator = key.indexOf(':');
          if (separator < 0) continue;
          const group = key.slice(0, separator) === 'staged' ? 'staged' : 'unstaged';
          const path = key.slice(separator + 1);
          if (listedInChangeBand(bands, group, path)) valid.add(key);
        }
        return valid.size === current.size ? current : valid;
      });
      return value;
    } catch (failure) {
      setGit({ root: '', branch: '', prefix: '', changes: [] });
      setCommitSelection(new Set());
      setCommitError(failure instanceof Error ? failure.message : String(failure));
      return null;
    }
  }, []);
  /**
   * Common commit prefixes, IDEA's commit-message templates in miniature.
   *
   * The list is fixed rather than free-form on purpose: a template that the
   * user has to configure first would never be used, and these are the
   * conventional prefixes this repository's history already follows.
   */ const COMMIT_TEMPLATES = ['feat', 'fix', 'refactor', 'docs', 'test', 'chore', 'perf', 'style'];
  /**
   * Insert one template prefix at the start of the message.
   *
   * Applying a template twice must not produce `feat: feat: …`, so an
   * existing prefix that is itself a template is replaced.
   * @param {string} prefix - template to apply.
   */ const applyCommitTemplate = React.useCallback((prefix: string) => {
    setCommitMessage((current) => {
      const text = current ?? '';
      const match = /^([a-z]+)(\([^)]*\))?: ?/u.exec(text);
      const rest = match !== null && COMMIT_TEMPLATES.includes(match[1]) ? text.slice(match[0].length) : text;
      return `${prefix}: ${rest}`;
    });
    setHistoryIndex(-1);
  }, []);
  /* Log paging: IDEA loads the history in pages as you scroll. */ const LOG_PAGE = 60;
  /* Declared before `loadLog`, which resets it: reading it later would hit the TDZ. */ const [
    logExhausted,
    setLogExhausted,
  ] = React.useState(false);
  /* Why the last log/graph request failed; null while the view is healthy. */ const [logError, setLogError] =
    React.useState(null);
  const [logAuthor, setLogAuthor] = React.useState('');
  const logAuthorRef = React.useRef('');
  React.useEffect(() => {
    logAuthorRef.current = logAuthor;
  }, [logAuthor]);
  const loadingMoreRef = React.useRef(false);
  const logMoreRequestRef = React.useRef<AbortController | null>(null);
  const cancelLogMoreRequest = React.useCallback((): void => {
    logMoreRequestRef.current?.abort();
    logMoreRequestRef.current = null;
    loadingMoreRef.current = false;
  }, []);
  const logRequestRef = React.useRef<{
    key: string;
    controller: AbortController;
  } | null>(null);
  const beginLogRequest = React.useCallback(
    (requestKey: string): AbortController | null => {
      cancelLogMoreRequest();
      const current = logRequestRef.current;
      if (current?.key === requestKey) return null;
      current?.controller.abort();
      const controller = new AbortController();
      logRequestRef.current = {
        key: requestKey,
        controller,
      };
      setLogLoading(true);
      return controller;
    },
    [cancelLogMoreRequest],
  );
  const finishLogRequest = React.useCallback((controller: AbortController): void => {
    if (logRequestRef.current?.controller !== controller) return;
    logRequestRef.current = null;
    setLogLoading(false);
  }, []);
  /**
   * Reload the first page of the log, honouring the author filter.
   * @returns {Promise<void>} resolves once the first page is set.
   */ const loadLog = React.useCallback(async () => {
    const controller = beginLogRequest(`log\0${logAuthorRef.current}`);
    if (controller === null) return;
    try {
      const value = await callGit<WorkspaceLogResponse>(
        {
          op: 'log',
          limit: LOG_PAGE,
          skip: 0,
          author: logAuthorRef.current,
        },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      const firstPage = value.commits ?? [];
      setCommits(firstPage);
      /* A short first page already ends the history: no scroll will find more. */ setLogExhausted(
        firstPage.length < LOG_PAGE,
      );
      setLogError(null);
    } catch (failure) {
      if (controller.signal.aborted) return;
      setCommits([]);
      /* An empty list alone reads as "this repo has no commits"; the reason
             git gave is the only thing that explains why the log went blank. */ setLogError(
        failure instanceof Error ? failure.message : String(failure),
      );
    } finally {
      finishLogRequest(controller);
    }
  }, [beginLogRequest, finishLogRequest]);
  /**
   * Append the next page when the list is scrolled to the bottom.
   *
   * A short page means the history ended, so the next scroll does not ask
   * again; the flag resets with every reload or filter change.
   */
  const loadMoreLog = React.useCallback(async () => {
    if (loadingMoreRef.current || logExhausted || logRequestRef.current !== null) return;
    const requestAuthor = logAuthorRef.current;
    const requestSkip = commits.length;
    const controller = new AbortController();
    logMoreRequestRef.current = controller;
    loadingMoreRef.current = true;
    try {
      const value = await callGit<WorkspaceLogResponse>(
        {
          op: 'log',
          limit: LOG_PAGE,
          skip: requestSkip,
          author: requestAuthor,
        },
        { signal: controller.signal },
      );
      if (controller.signal.aborted || logAuthorRef.current !== requestAuthor) return;
      const page = value.commits ?? [];
      setCommits((current) => {
        const known = new Set(current.map((commit) => commit.hash));
        return [...current, ...page.filter((commit) => !known.has(commit.hash))];
      });
      if (page.length < LOG_PAGE) setLogExhausted(true);
      setLogError(null);
    } catch (failure) {
      if (controller.signal.aborted) return;
      /* a failed page leaves the list as it was, but must say why */ setLogError(
        failure instanceof Error ? failure.message : String(failure),
      );
    } finally {
      if (logMoreRequestRef.current === controller) {
        logMoreRequestRef.current = null;
        loadingMoreRef.current = false;
      }
    }
  }, [commits.length, logExhausted]);
  /**
   * Load the bounded commit graph for the Log tab's "Graph" toggle.
   *
   * Read on demand: a repository walk is heavier than the flat log, and most
   * log visits do not ask for lanes. The branch argument is the graph's own
   * filter — the flat log's author box must not leak into it.
   * @param {string} [branch] - local branch to walk; empty means every ref.
   * @returns {Promise<void>} resolves once the graph (or an error) is set.
   */ const [graph, setGraph] = React.useState<CommitGraphPayload | null>(null);
  const loadGraph = React.useCallback(
    async (branch?: string, at?: string) => {
      const branchValue = typeof branch === 'string' ? branch : '';
      const atValue = typeof at === 'string' ? at : '';
      const controller = beginLogRequest(`graph\0${branchValue}\0${atValue}`);
      if (controller === null) return;
      try {
        const value = await callGit<WorkspaceGraphResponse>(
          {
            op: 'graph',
            limit: 80,
            branch: branchValue,
            at: atValue,
          },
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        setGraph({
          entries: value?.entries ?? [],
          branches: value?.branches ?? [],
          tags: value?.tags ?? [],
          branchList: value?.branchList ?? [],
          tagList: Array.isArray(value?.tagList) ? value.tagList : [],
          head: typeof value?.head === 'string' ? value.head : null,
          branch: typeof value?.branch === 'string' ? value.branch : null,
          at: typeof value?.at === 'string' ? value.at : null,
        });
        setLogError(null);
      } catch (failure) {
        if (controller.signal.aborted) return;
        const message = failure instanceof Error ? failure.message : String(failure);
        setLogError(message);
        setGraph((current) => {
          const requestedBranch = branchValue !== '' ? branchValue : null;
          const requestedAt = atValue !== '' ? atValue : null;
          if ((current?.branch ?? null) === requestedBranch && (current?.at ?? null) === requestedAt) return current;
          return {
            entries: [],
            branches: [],
            tags: [],
            branchList: [],
            tagList: [],
            head: null,
            branch: requestedBranch,
            at: requestedAt,
          };
        });
      } finally {
        finishLogRequest(controller);
      }
    },
    [beginLogRequest, finishLogRequest],
  );
  /**
   * Select one commit: load the detail AND keep the list on that row.
   *
   * The graph and the flat log are two views of the same selection. Walking
   * the graph with the keyboard used to fill the detail pane while the flat
   * list stayed where it was, so switching back to the list lost the commit
   * the user had just picked.
   * @param {string} hash - full commit hash.
   * @returns {Promise<void>} resolves once the detail is set.
   */ const showCommit = React.useCallback(async (hash: string) => {
    setSelectedCommit(hash);
    try {
      setLogDetail(await callGit({ op: 'show', hash }));
    } catch (failure) {
      setCommitError(failure instanceof Error ? failure.message : String(failure));
    }
  }, []);
  /**
   * Open one file's version inside one commit as a diff in the editor area.
   *
   * This is IDEA's "Show Diff" from the log: it never touches the working
   * tree, so a commit that deleted the file still renders its full change.
   * @param {{hash: string, path: string}} target - commit and workspace path.
   *//**
   * Compare one workspace file with the current clipboard, IDEA's "Compare with Clipboard".
   *
   * The clipboard is read in the browser (the host never sees it) and handed
   * to the diff as a text target. An empty or unreadable clipboard is reported
   * instead of opening a diff against nothing.
   * @param {string} path - workspace-relative file path.
   * @returns {Promise<void>} resolves once the diff is open or the failure shown.
   */ const compareWithClipboard = React.useCallback(
    async (path: string) => {
      if (typeof path !== 'string' || path === '') return;
      let text = '';
      try {
        text = (await navigator.clipboard?.readText()) ?? '';
      } catch {
        setEditorError(t('editor.clipboardUnavailable'));
        return;
      }
      if (text === '') {
        setEditorError(t('editor.clipboardEmpty'));
        return;
      }
      setDiffTarget({
        path,
        clipboardText: text,
        label: 'clipboard',
        staged: false,
      });
    },
    [t],
  );
  /**
   * Compare one tracked file's current working content with its HEAD blob.
   *
   * This is intentionally the combined view, not the staged-only or
   * worktree-only row: IDEA's file menu also offers a direct HEAD comparison
   * when both index and working copy have moved. It reuses the existing
   * read-only revision target and therefore the one Compare diff tab.
   * @param {string} path - workspace-relative file path.
   * @returns {void}
   */ const compareWithHead = React.useCallback((path: string) => {
    if (typeof path !== 'string' || path === '') return;
    setDiffTarget({ path, revision: 'HEAD', staged: false });
    setDiffActive(true);
  }, []);
  /**
   * Offer the recent commits and compare the file against the chosen one.
   *
   * IDEA's "Compare with Revision" needs a revision first, so the picker is
   * the existing commit log rather than a free-form hash box: a typo would
   * otherwise become an "invalid commit id" error after two round trips.
   * @param {string} path - workspace-relative file path.
   *//**
   * Open IDEA's revision picker for one file ("Compare with Revision").
   *
   * The picker reads a full page (100) and is searchable; a fixed submenu would be too short.
   * @param {string} path - workspace-relative file to compare.
   * @returns {Promise<void>} resolves once the picker has its first page.
   */ const closeRevisionPicker = React.useCallback(() => {
    revisionPickerRequestRef.current += 1;
    revisionPickerAbortRef.current?.abort();
    revisionPickerAbortRef.current = null;
    setRevisionPicker(null);
    restorePaletteFocus();
  }, [restorePaletteFocus]);
  const compareWithRevision = React.useCallback(
    async (path: string) => {
      if (typeof path !== 'string' || path === '') return;
      rememberPaletteOrigin();
      const requestId = ++revisionPickerRequestRef.current;
      revisionPickerAbortRef.current?.abort();
      const searchAbort = new AbortController();
      revisionPickerAbortRef.current = searchAbort;
      setRevisionPicker({
        path,
        query: '',
        index: 0,
        commits: [],
        loading: true,
      });
      try {
        const value = await callGit<WorkspaceLogResponse>({ op: 'log', limit: 100 }, { signal: searchAbort.signal });
        if (revisionPickerRequestRef.current !== requestId) return;
        setRevisionPicker((current) =>
          current === null ? current : { ...current, commits: value.commits ?? [], loading: false },
        );
      } catch (failure) {
        if (failure?.name === 'AbortError' || failure?.name === 'CanceledError') return;
        if (revisionPickerRequestRef.current !== requestId) return;
        setEditorError(failure instanceof Error ? failure.message : String(failure));
        closeRevisionPicker();
      } finally {
        if (revisionPickerAbortRef.current === searchAbort) revisionPickerAbortRef.current = null;
      }
    },
    [closeRevisionPicker, rememberPaletteOrigin],
  );
  const showCommitDiff = React.useCallback((target: { hash: string; path: string }) => {
    if (typeof target?.hash !== 'string' || typeof target?.path !== 'string') return;
    setDiffTarget({ path: target.path, commit: target.hash, staged: false });
    setDiffActive(true);
  }, []);
  /**
   * Open IDEA's combined diff for the selected working changes.
   *
   * The aggregate is intentionally read-only: per-file block restore must
   * keep operating on that file's actual index/worktree side, not on a
   * merged text document. The host reuses the same single-file diff source.
   *
   * @param {Array<{path: string, staged?: boolean}>} targetList - selected change identities.
   * @returns {void}
   */ const showCombinedDiff = React.useCallback(
    (targetList: DiffTarget[]) => {
      const entries = (Array.isArray(targetList) ? targetList : [])
        .filter((entry) => typeof entry?.path === 'string' && entry.path !== '')
        .map((entry) => ({
          path: entry.path,
          staged: entry.staged === true,
          heading: `${entry.path} · ${entry.staged === true ? t('editor.stagedMode') : t('editor.unstagedMode')}`,
        }));
      if (entries.length < 2) return;
      setDiffTarget({ combined: true, entries, staged: false });
      setDiffActive(true);
    },
    [t],
  );
  /* IDEA's per-file history: a filtered log of the commits that touched one path. */ const [
    historyPath,
    setHistoryPath,
  ] = React.useState(null);
  const authorTimer = React.useRef(null);
  const showFileHistory = React.useCallback(
    async (path: string) => {
      if (typeof path !== 'string' || path === '') return;
      if (authorTimer.current !== null) {
        window.clearTimeout(authorTimer.current);
        authorTimer.current = null;
      }
      /* IDEA answers "Show History" by opening the Commit tool window's Log tab. */ setActivity('commit');
      setPanelVisible(true);
      setCommitMode('log');
      setHistoryPath(path);
      const controller = beginLogRequest(`history\0${path}`);
      if (controller === null) return;
      try {
        const value = await callGit<WorkspaceLogResponse>({ op: 'fileHistory', path }, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setCommits(Array.isArray(value.commits) ? value.commits : []);
        setLogExhausted(true);
        setLogDetail(null);
        setLogError(null);
      } catch (failure) {
        if (controller.signal.aborted) return;
        setLogError(failure instanceof Error ? failure.message : String(failure));
        setCommits([]);
      } finally {
        finishLogRequest(controller);
      }
    },
    [beginLogRequest, finishLogRequest],
  );
  /**
   * Apply the log's author filter, debounced so typing does not spawn a git per key.
   *
   * File history and the full log answer different questions, so switching the
   * filter drops back to the repository-wide log — matching IDEA's Log tab.
   */
  const changeLogAuthor = React.useCallback(
    (value: string) => {
      setLogAuthor(value);
      logAuthorRef.current = value;
      cancelLogMoreRequest();
      if (authorTimer.current !== null) window.clearTimeout(authorTimer.current);
      authorTimer.current = window.setTimeout(() => {
        authorTimer.current = null;
        setHistoryPath(null);
        void loadLog();
      }, 350);
    },
    [cancelLogMoreRequest, loadLog],
  );
  React.useEffect(
    () => () => {
      if (authorTimer.current !== null) window.clearTimeout(authorTimer.current);
      logRequestRef.current?.controller.abort();
      logRequestRef.current = null;
      cancelLogMoreRequest();
    },
    [cancelLogMoreRequest],
  );
  const clearFileHistory = React.useCallback(() => {
    setHistoryPath(null);
    void loadLog();
  }, [loadLog]);
  const reloadVisibleLog = React.useCallback((): void => {
    if (historyPath !== null) {
      void showFileHistory(historyPath);
      return;
    }
    void loadLog();
  }, [historyPath, loadLog, showFileHistory]);
  /* Load the workspace root and its git status. */ const loadRoot = React.useCallback(
    async (foldersFirstOverride?: boolean) => {
      /* A silent refresh once there is something on screen: flipping the flag on
           every poll made the placeholder row appear above the list and shove the
           whole tree down (and back) every few seconds. */ if (
        shouldShowTreeLoading({
          loading: true,
          rowCount: treeRootRef.current === '' ? 0 : rowsRef.current.length,
        })
      )
        setTreeLoading(true);
      try {
        const requestFoldersFirst = typeof foldersFirstOverride === 'boolean' ? foldersFirstOverride : foldersFirst;
        const value = await callFs<WorkspaceListResponse>({
          op: 'list',
          path: '',
          showHidden,
          sort: sortMode,
          foldersFirst: requestFoldersFirst,
          showExcluded: showExcludedFiles,
        });
        const listing = Array.isArray(value.entries) ? value.entries : [];
        setRoot(value.root ?? '');
        setHome(value.home ?? '');
        treeRootRef.current = value.root ?? '';
        if (toolWidthsRestoredFor.current !== (value.root ?? '')) {
          toolWidthsRestoredFor.current = value.root ?? '';
          setToolWidths({
            project: readToolWidth(value.root ?? '', 'project', 28),
            commit: readToolWidth(value.root ?? '', 'commit', 25),
          });
        }
        /* Keep the array React already holds when the listing is identical: a
             new array reference re-renders every row (a visible flash) even though
             nothing on disk changed. */ setEntries((current) => keepUnchangedListing(current, listing));
        setTreeError(null);
        /* The fold keys embed the root, so they are restored here (not in the
             initialiser). Guarded by the root itself rather than by "first load":
             a poll must not overwrite folds made a moment ago, but switching to a
             different workspace still has to restore ITS folds. */ if (
          collapsedRestoredFor.current !== (value.root ?? '')
        ) {
          collapsedRestoredFor.current = value.root ?? '';
          setCollapsedGroups(readCollapsedGroups(value.root ?? ''));
        }
        const restored = readExpanded(value.root ?? '');
        setExpanded((current) => {
          let next = null;
          for (const path of ['', ...restored]) {
            if (current.has(path)) continue;
            if (next === null) next = new Set(current);
            next.add(path);
          }
          /* Same membership: return the SAME Set, or the flattened-row memo
               recomputes and every tree row re-renders on an idle poll. */ return next ?? current;
        });
        expandedRestoredRef.current = value.root ?? '';
        const workspaceRoot = value.root ?? '';
        const readDirectory = async (path: string): Promise<WorkspaceEntry[]> => {
          const result = await callFs<{ entries?: WorkspaceEntry[] }>({
            op: 'list',
            path,
            showHidden,
            sort: sortMode,
            foldersFirst,
            showExcluded: showExcludedFiles,
          });
          return Array.isArray(result?.entries) ? result.entries : [];
        };
        if (prefetchedRootRef.current !== workspaceRoot) {
          /* 默认只预取一层节点信息；目录仍保持折叠，用户点击才展开。 */ const prefetched =
            await prefetchDirectorySubtrees(
              listing
                .filter((entry) => entry.kind === 'directory' && typeof entry.path === 'string')
                .map((entry) => entry.path),
              { children: { '': listing } },
              readDirectory,
              PROJECT_PREFETCH_VISIT_LIMIT,
              PROJECT_PREFETCH_DEPTH,
            );
          prefetchedRootRef.current = workspaceRoot;
          const prefetchedChildren = { ...prefetched.children };
          delete prefetchedChildren[''];
          setChildren((current) => {
            const next = { ...current };
            for (const [path, directoryEntries] of Object.entries(prefetchedChildren)) {
              next[path] = keepUnchangedListing(current[path], directoryEntries);
            }
            return next;
          });
        }
        /* Restored directories must also fetch their children, or they render empty. */ const hydrated: Record<
          string,
          WorkspaceEntry[]
        > = {};
        for (const path of restored) {
          try {
            hydrated[path] = await readDirectory(path);
          } catch {
            /* a directory that vanished stays collapsed in effect */
          }
        }
        if (Object.keys(hydrated).length > 0) {
          setChildren((current) => {
            const next = { ...current };
            for (const [path, directoryEntries] of Object.entries(hydrated)) {
              next[path] = keepUnchangedListing(current[path], directoryEntries);
            }
            return next;
          });
        }
        /* Establish the "new file" baseline on load as well: refreshTree compares
             against it, and leaving it null until the first refresh means that
             refresh only re-baselines instead of reporting what appeared. */ if (knownPathsRef.current === null)
          knownPathsRef.current = new Set(collectFilePaths(listing));
        await loadGit();
        return listing;
      } catch (error) {
        setTreeError(error instanceof Error ? error.message : String(error));
        return null;
      } finally {
        setTreeLoading(false);
      }
    },
    [foldersFirst, loadGit, showExcludedFiles, showHidden, sortMode],
  );
  React.useEffect(() => {
    void loadRoot();
  }, [foldersFirst, loadRoot, showExcludedFiles, showHidden, sortMode]);
  /* Restore the per-workspace MRU list once the root is known. */ React.useEffect(() => {
    if (root === '') return;
    setRecentFiles(readRecentFiles(root));
  }, [root]);
  /* Restore the per-workspace commit message history. */ React.useEffect(() => {
    if (root === '') return;
    try {
      const raw = window.localStorage.getItem(`dsh-editor.commitHistory:${root}`);
      const parsed = raw === null ? [] : JSON.parse(raw);
      setMessageHistory(Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : []);
    } catch {
      setMessageHistory([]);
    }
    setHistoryIndex(-1);
  }, [root]);
  /* Restore the unsent draft when the workspace (and so its key) becomes known. */ React.useEffect(() => {
    if (root === '') return;
    const draft = readCommitDraft(root);
    if (draft !== '') setCommitMessage((current) => (current === '' ? draft : current));
  }, [root]);
  /* Debounce writes: typing must not hit localStorage on every keystroke. */ const draftTimer = React.useRef<
    number | null
  >(null);
  React.useEffect(() => {
    if (root === '') return undefined;
    if (draftTimer.current !== null) window.clearTimeout(draftTimer.current);
    draftTimer.current = window.setTimeout(() => {
      draftTimer.current = null;
      writeCommitDraft(root, commitMessage);
    }, 400);
    return () => {
      if (draftTimer.current !== null) window.clearTimeout(draftTimer.current);
    };
  }, [commitMessage, root]);
  /**
   * Expand or collapse one directory, loading its children.
   *
   * Expanding always re-reads the directory: a cached listing goes stale the
   * moment something outside the editor creates or deletes a child, and the
   * tree would then keep hiding it forever (the entry never appears, even
   * after collapse + expand).
   * @param {string} path - workspace-relative directory path.
   * @returns {Promise<void>} resolves once the listing is applied.
   */ const toggleDirectory = React.useCallback(
    async (path: string) => {
      /* Decide from the render's own `expanded` (this closure is rebuilt whenever it
           changes), never from a ref synced in an effect or from inside the updater:
           both are stale at click time, which silently skipped the fetch. */ const willExpand = !expanded.has(path);
      if (!willExpand) {
        setExpanded((current) => {
          const next = new Set(current);
          next.delete(path);
          return next;
        });
        return;
      }
      if (path === '') return;
      const workspaceRoot = treeRootRef.current;
      try {
        const cached = Array.isArray(childrenRef.current[path]) ? childrenRef.current[path] : null;
        let expandedPaths =
          compactDirectories === true ? compactDirectoryExpansionPaths(path, childrenRef.current) : [path];
        /* The root prefetch normally seeded this directory. Expand from that
             cache immediately, then refresh the real listing in the background. */ if (cached !== null) {
          setExpanded((current) => new Set([...current, ...expandedPaths]));
        }
        const listingValue = await callFs({
          op: 'list',
          path,
          showHidden,
          sort: sortMode,
          foldersFirst,
          showExcluded: showExcludedFiles,
        });
        if (treeRootRef.current !== workspaceRoot) return;
        const listing = Array.isArray(listingValue?.entries) ? listingValue.entries : [];
        const mergedChildren = { ...childrenRef.current, [path]: listing };
        childrenRef.current = mergedChildren;
        setChildren((current) => ({
          ...current,
          [path]: keepUnchangedListing(current[path], listing),
        }));
        expandedPaths = compactDirectories === true ? compactDirectoryExpansionPaths(path, mergedChildren) : [path];
        setExpanded((current) => new Set([...current, ...expandedPaths]));
        const token = (projectPrefetchTokensRef.current.get(path) ?? 0) + 1;
        projectPrefetchTokensRef.current.set(path, token);
        /* One-level prefetch is cache warm-up only. It must never hold up the
             visible expand operation or write expanded. */ void prefetchDirectorySubtrees(
          [path],
          { children: mergedChildren },
          async (directory) => {
            const result = await callFs({
              op: 'list',
              path: directory,
              showHidden,
              sort: sortMode,
              foldersFirst,
              showExcluded: showExcludedFiles,
            });
            return Array.isArray(result?.entries) ? result.entries : [];
          },
          PROJECT_PREFETCH_VISIT_LIMIT,
          PROJECT_PREFETCH_DEPTH,
        )
          .then((prefetched) => {
            if (treeRootRef.current !== workspaceRoot || projectPrefetchTokensRef.current.get(path) !== token) return;
            const prefetchedChildren = { ...prefetched.children };
            delete prefetchedChildren[path];
            childrenRef.current = {
              ...childrenRef.current,
              ...(prefetchedChildren as Record<string, WorkspaceEntry[]>),
            };
            setChildren((current) => {
              const next = { ...current };
              for (const [directory, entries] of Object.entries(prefetchedChildren)) {
                next[directory] = keepUnchangedListing(current[directory], entries);
              }
              return next;
            });
          })
          .catch(() => {
            /* Background prefetch is optional; the clicked listing is already visible. */
          });
      } catch (error) {
        setTreeError(error instanceof Error ? error.message : String(error));
      }
    },
    [compactDirectories, expanded, foldersFirst, showExcludedFiles, showHidden, sortMode],
  );
  /* Open a file, reusing its existing tab. */ /**
   * Paths whose read is in flight.
   *
   * A double-click fires two opens before either read resolves; without this
   * guard both appends land and the tab strip shows the same file twice.
   */ const openingRef = React.useRef<Set<string>>(new Set());
  /**
   * Note one visit in this workspace's MRU list (IDEA's Recent Files).
   *
   * Called for every open — including a file that is already in a tab, since
   * clicking a tab is exactly the "I was just here" signal ⌘E is for.
   * @param {string} path - workspace-relative path.
   * @returns {void}
   */ const noteRecent = React.useCallback((path: string) => {
    if (typeof path !== 'string' || path === '') return;
    const workspace = rootRef.current;
    if (workspace === '') return;
    setRecentFiles((current) => {
      const next = pushRecent(current, path);
      /* Same array → same state → no re-render on an idle re-open. */ if (next === current) return current;
      writeRecentFiles(workspace, next);
      return next;
    });
  }, []);
  /**
   * Keep every path-keyed editor surface attached to the same file after a
   * Project rename or move. The filesystem operation already happened; this
   * callback prevents stale Model keys, preview labels, comparisons and MRU
   * entries from pointing at the old path.
   *
   * @param {Array<[string, string]>} entries - old/new paths from the move.
   * @returns {void}
   */ const remapEditorPaths = React.useCallback((entries: Array<[string, string]>) => {
    const moves = (Array.isArray(entries) ? entries : []).filter(
      (entry) =>
        Array.isArray(entry) &&
        typeof entry[0] === 'string' &&
        entry[0] !== '' &&
        typeof entry[1] === 'string' &&
        entry[1] !== '',
    );
    if (moves.length === 0) return;
    const remap = (path: string): string => remapPathAfterMove(path, moves);
    for (const [path, model] of [...modelsRef.current.entries()]) {
      const next = remap(path);
      if (next === path) continue;
      modelsRef.current.delete(path);
      modelsRef.current.set(next, model);
    }
    if (previewPathRef.current !== null) {
      const next = remap(previewPathRef.current);
      if (next !== previewPathRef.current) {
        previewPathRef.current = next;
        setPreviewPath(next);
      }
    }
    setOpenFiles((current) => {
      let changed = false;
      const next = current.map((file) => {
        const path = remap(file.path);
        if (path === file.path) return file;
        changed = true;
        return { ...file, path };
      });
      return changed ? next : current;
    });
    setActivePath((current) => (current === null ? current : remap(current)));
    setSplitTabs((current) => {
      let changed = false;
      const seen = new Set<string>();
      const nextTabs: string[] = [];
      for (const path of current) {
        const next = remap(path);
        if (next !== path) changed = true;
        if (seen.has(next)) {
          changed = true;
          continue;
        }
        seen.add(next);
        nextTabs.push(next);
      }
      if (!changed) return current;
      splitTabsRef.current = nextTabs;
      return nextTabs;
    });
    if (splitPathRef.current !== null) {
      const next = remap(splitPathRef.current);
      if (next !== splitPathRef.current) {
        splitPathRef.current = next;
        setSplitPath(next);
      }
    }
    setDiffTarget((current) => {
      if (current === null || typeof current.path !== 'string') return current;
      const path = remap(current.path);
      return path === current.path ? current : { ...current, path };
    });
    setAnnotateTarget((current) => {
      if (current === null || typeof current.path !== 'string') return current;
      const path = remap(current.path);
      return path === current.path ? current : { ...current, path };
    });
    setRecentFiles((current) => {
      let changed = false;
      const seen = new Set<string>();
      const next: string[] = [];
      for (const path of current) {
        const mapped = remap(path);
        if (mapped !== path || seen.has(mapped)) changed = true;
        if (seen.has(mapped)) continue;
        seen.add(mapped);
        next.push(mapped);
      }
      if (!changed) return current;
      const workspace = rootRef.current;
      if (workspace !== '') writeRecentFiles(workspace, next);
      return next;
    });
  }, []);
  const remapProjectExpandedPathsForMoves = React.useCallback((entries: Array<[string, string]>) => {
    const next = remapProjectExpandedPaths(expandedRef.current, entries);
    if (next === expandedRef.current) return;
    expandedRef.current = next;
    setExpanded(next);
  }, []);
  const remapProjectManualOrderForMoves = React.useCallback((entries: Array<[string, string]>) => {
    setManualOrder((current) => {
      const next = remapProjectManualOrder(current, entries);
      if (next !== current) writeProjectManualOrder(rootRef.current, next);
      return next;
    });
  }, []);
  const openFile = React.useCallback(
    async (path: string, options: { preview?: boolean; silentError?: boolean } = {}) => {
      /* The Commit diff is a tab of its own: picking a file shows that file and
           leaves the diff tab where it is, ready to be clicked back (IDEA). */ setDiffActive(false);
      const wantsPreview = options.preview === true && previewTabEnabled;
      const existing = openFilesRef.current.find((file) => file.path === path);
      /* A second open of a file already being read just focuses it; the first
           read will place the tab. */ if (existing === undefined && openingRef.current.has(path)) {
        setActivePath(path);
        return true;
      }
      if (existing !== undefined) {
        /* Re-opening an already open file must NOT clear Annotate: clicking a
             blame row to inspect a commit while annotating would drop the reading
             mode the user just asked for. Diff still closes, since it replaces
             the same surface with a different file's change. */
        noteRecent(path);
        if (!wantsPreview && previewPathRef.current === path) {
          previewPathRef.current = null;
          setPreviewPath(null);
        }
        setActivePath(path);
        return true;
      }
      openingRef.current.add(path);
      try {
        const imagePreview = isImagePreviewPath(path);
        const value = imagePreview ? await callFs({ op: 'image', path }) : await callFs({ op: 'read', path });
        const file = workspaceFileFromResponse(path, value, imagePreview);
        if (wantsPreview) {
          const previous = previewPathRef.current;
          const previousFile =
            previous === null ? undefined : openFilesRef.current.find((entry) => entry.path === previous);
          if (previous !== null && previous !== path && previousFile?.dirty !== true) {
            const model = modelsRef.current.get(previous);
            model?.dispose?.();
            modelsRef.current.delete(previous);
            setOpenFiles((current) => current.filter((entry) => entry.path !== previous));
          }
        }
        /* Re-check on arrival: a parallel open may have appended it already. */ setOpenFiles((current) =>
          current.some((entry) => entry.path === path) ? current : [file, ...current],
        );
        if (wantsPreview) {
          previewPathRef.current = path;
          setPreviewPath(path);
        }
        setActivePath(path);
        setEditorError(null);
        noteRecent(path);
        return true;
      } catch (error) {
        if (options.silentError !== true) setEditorError(error instanceof Error ? error.message : String(error));
        return false;
      } finally {
        openingRef.current.delete(path);
      }
    },
    [noteRecent, previewTabEnabled],
  );
  /* IDEA's EditSource opens the local working copy and hands it the keyboard.
         Tree clicks intentionally keep focus in the tree, so callers that mean
  "edit this source" use this explicit path instead. */ const editLocalVersion = React.useCallback(
    (path: string) => {
      void openFile(path).then((opened) => {
        if (opened) focusEditorOnNextFrame(editorRef);
      });
    },
    [openFile],
  );
  /**
   * Reveal one search location in the right editor group after it binds.
   * @param {string} path - workspace-relative file.
   * @param {number} line - one-based line.
   * @param {number} column - one-based column.
   * @returns {void}
   */ const revealSplitLocation = React.useCallback((path: string, line: number, column: number) => {
    if (typeof path !== 'string' || path === '' || !Number.isFinite(line) || line < 1) return;
    let attempts = 0;
    let applied = 0;
    const reveal = () => {
      const editor = splitEditorRef.current;
      const model = editor?.getModel?.() ?? null;
      const expectedModel = modelsRef.current.get(path) ?? null;
      if (editor === null || model === null || model !== expectedModel || splitPathRef.current !== path) {
        attempts += 1;
        if (attempts < 60) window.requestAnimationFrame(reveal);
        return;
      }
      const safeLine = Math.min(Math.max(1, Math.floor(line)), model.getLineCount());
      const safeColumn = Math.min(Math.max(1, Math.floor(column ?? 1)), model.getLineMaxColumn(safeLine));
      editor.setSelection(new window.monaco.Range(safeLine, safeColumn, safeLine, safeColumn));
      editor.revealLineInCenter(safeLine);
      applied += 1;
      if (applied < 3) {
        window.requestAnimationFrame(reveal);
        return;
      }
      editor.focus();
    };
    window.requestAnimationFrame(reveal);
  }, []);
  /**
   * Open one or more Project files in the right editor group.
   *
   * Files join the shared openFiles list one at a time in stable caller
   * order. The left group's active tab is restored after the reads so the
   * action never steals the document the user was editing.
   * @param {string|string[]} target - one path or an ordered file batch.
   * @returns {Promise<void>} resolves after the right pane is requested.
   */ const openInRightSplit = React.useCallback(
    async (target: string | string[], location: { path?: string; line: number; column: number } | null = null) => {
      const requested = Array.isArray(target) ? target : [target];
      const paths = [...new Set(requested.filter((path) => typeof path === 'string' && path !== ''))];
      if (paths.length === 0) return;
      const previous = activePathRef.current;
      let lastOpened = null;
      for (const path of paths) {
        if (!(await openFile(path))) continue;
        lastOpened = path;
        const nextSplitTabs = splitTabsRef.current.includes(path)
          ? splitTabsRef.current
          : [...splitTabsRef.current, path];
        splitTabsRef.current = nextSplitTabs;
        setSplitTabs((current) => (current.includes(path) ? current : [...current, path]));
        setSplitPath(path);
        splitPathRef.current = path;
      }
      if (lastOpened === null) return;
      setAnnotateTarget(null);
      setActivePath(previous);
      if (location !== null && lastOpened === location.path) {
        revealSplitLocation(lastOpened, location.line, location.column);
      } else {
        window.setTimeout(() => splitEditorRef.current?.focus(), 0);
      }
    },
    [openFile, revealSplitLocation],
  );
  /**
   * Restore this workspace's clean editor tabs after the root is known.
   *
   * Dirty buffers are intentionally absent from the stored session. Each
   * path is re-read through the normal openFile path so missing or forbidden
   * files are dropped instead of resurrected as invalid tabs.
   * @returns {Promise<void>} resolves once existing tabs and split state settle.
   */ const restoreEditorSession = React.useCallback(async () => {
    if (root === '' || sessionRestoredFor.current === root) return;
    const requestedRoot = root;
    const generation = ++sessionRestoreGeneration.current;
    sessionRestoredFor.current = requestedRoot;
    sessionRestoringRef.current = true;
    const stored = readEditorSession(requestedRoot);
    openFilesRef.current = [];
    splitTabsRef.current = [];
    splitPathRef.current = null;
    setOpenFiles([]);
    setSplitTabs([]);
    setSplitPath(null);
    const requested = [...new Set([...stored.openPaths, ...stored.splitPaths])];
    const opened = new Set<string>();
    try {
      for (const path of requested) {
        if (sessionRestoreGeneration.current !== generation) return;
        if (!(await openFile(path))) continue;
        opened.add(path);
      }
      if (sessionRestoreGeneration.current !== generation) return;
      const restoredOpenPaths = requested.filter((path) => opened.has(path));
      const restoredSplitPaths = stored.splitPaths.filter((path) => opened.has(path));
      if (restoredOpenPaths.length > 0) {
        setOpenFiles((current) => {
          const byPath = new Map(current.map((file) => [file.path, file]));
          return restoredOpenPaths.map((path) => byPath.get(path)).filter(Boolean);
        });
      }
      const restoredActive =
        stored.activePath !== null && opened.has(stored.activePath)
          ? stored.activePath
          : (restoredOpenPaths[0] ?? null);
      const restoredSplit =
        stored.splitPath !== null && restoredSplitPaths.includes(stored.splitPath)
          ? stored.splitPath
          : (restoredSplitPaths[0] ?? null);
      setActivePath(restoredActive);
      setSplitTabs(restoredSplitPaths);
      splitTabsRef.current = restoredSplitPaths;
      setSplitPath(restoredSplit);
      splitPathRef.current = restoredSplit;
      if (stored.splitPercent !== null) setEditorSplitPercent(stored.splitPercent);
    } finally {
      if (sessionRestoreGeneration.current === generation) {
        sessionRestoringRef.current = false;
      }
    }
  }, [openFile, root]);
  React.useEffect(() => {
    void restoreEditorSession();
  }, [restoreEditorSession]);
  /* Persist clean editor tabs per workspace after the initial restore settles. */ const sessionPersistTimer =
    React.useRef<number | null>(null);
  React.useEffect(() => {
    if (root === '' || sessionRestoredFor.current !== root || sessionRestoringRef.current) return undefined;
    if (sessionPersistTimer.current !== null) window.clearTimeout(sessionPersistTimer.current);
    sessionPersistTimer.current = window.setTimeout(() => {
      sessionPersistTimer.current = null;
      const cleanFiles = openFiles.filter((file) => file.dirty !== true);
      const cleanPaths = new Set(cleanFiles.map((file) => file.path));
      const nextActive = activePath !== null && cleanPaths.has(activePath) ? activePath : (cleanFiles[0]?.path ?? null);
      const cleanSplitTabs = splitTabs.filter((path) => cleanPaths.has(path));
      const nextSplit =
        splitPath !== null && cleanPaths.has(splitPath) && cleanSplitTabs.includes(splitPath)
          ? splitPath
          : (cleanSplitTabs[0] ?? null);
      writeEditorSession(root, {
        openPaths: cleanFiles.map((file) => file.path),
        activePath: nextActive,
        splitPaths: cleanSplitTabs,
        splitPath: nextSplit,
        splitPercent: editorSplitPercent,
      });
    }, 250);
    return () => {
      if (sessionPersistTimer.current !== null) {
        window.clearTimeout(sessionPersistTimer.current);
        sessionPersistTimer.current = null;
      }
    };
  }, [activePath, editorSplitPercent, openFiles, root, splitPath, splitTabs]);
  /**
   * Save one open model by path.
   *
   * Split editor groups share this path-addressed save entry so a focused
   * right pane writes its own file instead of whichever tab the left pane
   * happens to expose.
   * @param {string|null} path - workspace-relative file path.
   * @param {boolean} [force=false] - overwrite after an explicit conflict confirmation.
   * @returns {Promise<void>} resolves after the write attempt.
   */ const savePath = React.useCallback(
    async (path: string | null, force = false) => {
      if (typeof path !== 'string' || path === '') return;
      const model = modelsRef.current.get(path);
      if (model === undefined) return;
      const file = openFilesRef.current.find((entry) => entry.path === path);
      try {
        const value = await callFs<{ mtime?: number | null }>({
          op: 'write',
          path,
          content: model.getValue(),
          mtime: file?.mtime ?? undefined,
          force,
        });
        setOpenFiles((current) =>
          current.map((entry) =>
            entry.path === path
              ? {
                  ...entry,
                  content: model.getValue(),
                  dirty: false,
                  mtime: typeof value.mtime === 'number' ? value.mtime : entry.mtime,
                }
              : entry,
          ),
        );
        setEditorError(null);
        setConflict(null);
        await loadGit();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/changed on disk|no longer exists/u.test(message)) {
          /* IDEA asks before clobbering someone else's edit. */ setConflict({
            path,
            message,
          });
        } else {
          setEditorError(message);
        }
      }
    },
    [loadGit],
  );
  /* Save the active model. */ const saveActive = React.useCallback(
    async (force = false) => {
      await savePath(activePathRef.current, force);
    },
    [savePath],
  );
  /**
   * Toggle the Annotate view for the active file.
   *
   * Annotate and diff are mutually exclusive: both replace the editor area,
   * so opening one closes the other instead of stacking two panes.
   */ const toggleAnnotate = React.useCallback(async () => {
    const path = activePathRef.current;
    if (path === null) return;
    if (annotateTarget !== null) {
      setAnnotateTarget(null);
      return;
    }
    setDiffTarget(null);
    setAnnotateTarget({ path });
    setAnnotateLoading(true);
    setAnnotateLines([]);
    setAnnotateTruncated(false);
    try {
      const value = await callGit<{ lines?: AnnotateLine[]; truncated?: boolean }>({ op: 'blame', path });
      setAnnotateLines(Array.isArray(value?.lines) ? value.lines : []);
      setAnnotateTruncated(value?.truncated === true);
    } catch (failure) {
      setCommitError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setAnnotateLoading(false);
    }
  }, [annotateTarget]);
  /**
   * Jump from an Annotate line to the commit that introduced it.
   *
   * IDEA answers the click by opening the change in its Log; here that means
   * the Commit tool window's Log tab with the commit selected, while the
   * annotate reading position is kept so the user can come back.
   * @param {string} hash - full commit hash from the blame row.
   * @returns {void}
   */ const openCommitFromAnnotate = React.useCallback(
    (hash: string) => {
      if (typeof hash !== 'string' || hash === '') return;
      setActivity('commit');
      setPanelVisible(true);
      setCommitMode('log');
      setHistoryPath(null);
      void loadLog();
      void showCommit(hash);
    },
    [loadLog, showCommit],
  );
  /* Reveal a line requested by a terminal link once the model is bound. */ const pendingReveal = React.useRef<{
    path: string;
    line: number;
    column: number;
  } | null>(null);
  const revealLines = React.useCallback(
    (path: string, line: number, column: number, pane: 'left' | 'right' | null = null) => {
      const focused = focusedEditorRef.current;
      const preferred = pane === 'right' ? splitEditorRef.current : pane === 'left' ? editorRef.current : null;
      const editor =
        preferred ??
        (focused?.path === path
          ? focused.editor
          : path === splitPathRef.current
            ? splitEditorRef.current
            : editorRef.current);
      const model = modelsRef.current.get(path);
      if (editor === null || model === undefined || typeof line !== 'number' || line < 1) return;
      const safeLine = Math.min(Math.max(1, line), model.getLineCount());
      const safeColumn = Math.min(Math.max(1, column ?? 1), model.getLineMaxColumn(safeLine));
      editor.setSelection(new window.monaco.Range(safeLine, safeColumn, safeLine, safeColumn));
      editor.revealLineInCenter(safeLine);
      editor.focus();
    },
    [],
  );
  /**
   * Open a search hit and reveal its exact line once the model is bound.
   * Reopening the already-active tab must still move the caret, so this
   * cannot rely on an active-path change effect.
   * @param {string} path - workspace-relative file.
   * @param {number} line - one-based line.
   * @param {number} column - one-based column.
   * @returns {void}
   */ const openFileAtLocation = React.useCallback(
    (
      path: string,
      line: number,
      column: number,
      options: {
        recordHistory?: boolean;
        origin?: { path: string; line: number; column: number } | null;
      } = {},
    ) => {
      if (typeof path !== 'string' || path === '') return;
      const historyOrigin = options.recordHistory === false ? null : (options.origin ?? currentNavigationLocation());
      const targetLocation = normalizeNavigationLocation({
        path,
        line,
        column,
      });
      pendingReveal.current = { path, line, column };
      void openFile(path).then((opened) => {
        if (!opened) {
          if (pendingReveal.current?.path === path) pendingReveal.current = null;
          return;
        }
        if (historyOrigin !== null) {
          navigationHistoryRef.current = navigationHistoryRecord(navigationHistoryRef.current, historyOrigin);
        }
        navigationCurrentLocationRef.current = targetLocation;
        window.requestAnimationFrame(() => {
          const model = modelsRef.current.get(path);
          const editor = editorRef.current;
          if (model === undefined || editor?.getModel?.() !== model) return;
          if (pendingReveal.current?.path === path) pendingReveal.current = null;
          revealLines(path, line, column);
        });
      });
    },
    [currentNavigationLocation, openFile, revealLines],
  );
  /** Transient status-bar message, IDEA's its own "file(s) saved" hint. */ const [statusNotice, setStatusNotice] =
    React.useState<string | null>(null);
  const statusNoticeTimer = React.useRef<number | null>(null);
  const flashStatus = React.useCallback((message: string) => {
    setStatusNotice(message);
    if (statusNoticeTimer.current !== null) window.clearTimeout(statusNoticeTimer.current);
    statusNoticeTimer.current = window.setTimeout(() => {
      statusNoticeTimer.current = null;
      setStatusNotice(null);
    }, 4000);
  }, []);
  const copyStatusPath = React.useCallback(async () => {
    if (statusPath === '') return;
    try {
      if (typeof navigator.clipboard?.writeText !== 'function') {
        throw new Error(t('editor.clipboardWriteFailed'));
      }
      await navigator.clipboard.writeText(statusPath);
      flashStatus(t('editor.statusPathCopied'));
    } catch {
      flashStatus(t('editor.clipboardWriteFailed'));
    }
  }, [flashStatus, statusPath, t]);
  /**
   * Append selected Project or editor paths to the Harness composer.
   * @param {object[]} entries - paths selected by the invoking menu.
   * @param {{line: number, column: number, endLine: number|null, endColumn: number|null}|null} [location=null] - exact editor range.
   * @returns {Promise<void>} resolves after the host reports insertion.
   */ const sendHarnessReference = React.useCallback(
    async (entries: HarnessReferenceEntry[], location: HarnessReferenceLocation | null = null) => {
      const selected = Array.isArray(entries)
        ? entries.filter((entry) => entry !== null && typeof entry?.path === 'string')
        : [];
      if (selected.length === 0) return;
      const position = location !== null && selected.length === 1 && selected[0].isDirectory !== true ? location : null;
      if (typeof onInsertHarnessReference !== 'function') {
        flashStatus(t('editor.harnessReferenceUnavailable'));
        return;
      }
      try {
        const inserted = await onInsertHarnessReference({
          entries: selected.map((entry) => ({ ...entry, root })),
          line: position?.line ?? null,
          column: position?.column ?? null,
          endLine: position?.endLine ?? null,
          endColumn: position?.endColumn ?? null,
        });
        flashStatus(inserted === true ? t('editor.harnessReferenceInserted') : t('editor.harnessReferenceFailed'));
      } catch (failure) {
        flashStatus(
          t('editor.harnessReferenceFailedWithReason', {
            message: failure instanceof Error ? failure.message : String(failure),
          }),
        );
      }
    },
    [flashStatus, onInsertHarnessReference, root, t],
  );
  /**
   * Build the direct Harness action for one path selection.
   *
   * The file tree does not need another submenu level: one click appends
   * the current file, folder or multi-selection to the Chat composer.
   * @param {object[]} entries - Project rows or editor files.
   * @returns {object} ContextMenu-compatible action.
   */ const buildHarnessPathAction = React.useCallback(
    (entries: HarnessReferenceEntry[]) => {
      const selected = Array.isArray(entries)
        ? entries.filter((entry) => entry !== null && typeof entry?.path === 'string')
        : [];
      return {
        id: 'harnessReference',
        label: `${t('editor.harness')}->`,
        disabled: selected.length === 0,
        restoreFocus: false,
        run: (): void => void sendHarnessReference(selected),
      };
    },
    [sendHarnessReference, t],
  );
  /**
   * Send the editor under the pointer-menu invocation, including its live
   * caret or selected line-column range.
   * @param {object} editor - Monaco editor that opened the context menu.
   * @returns {void}
   */ const sendHarnessEditorReference = React.useCallback(
    (editor: Monaco.editor.ICodeEditor) => {
      const location = harnessEditorLocation(editor);
      if (location === null) {
        flashStatus(t('editor.harnessPositionUnavailable'));
        return;
      }
      void sendHarnessReference([{ path: location.path, isDirectory: false }], location);
    },
    [flashStatus, sendHarnessReference, t],
  );
  const navigateHistory = React.useCallback(
    (direction: 'back' | 'forward') => {
      const current = navigationCurrentLocationRef.current ?? currentNavigationLocation();
      const step = navigationHistoryStep(navigationHistoryRef.current, current, direction);
      if (step.target === null) {
        flashStatus(t(direction === 'back' ? 'editor.navigationBackEmpty' : 'editor.navigationForwardEmpty'));
        return;
      }
      navigationHistoryRef.current = step.history;
      openFileAtLocation(step.target.path, step.target.line, step.target.column, { recordHistory: false });
    },
    [currentNavigationLocation, flashStatus, openFileAtLocation, t],
  );
  const navigateBackHistory = React.useCallback(() => navigateHistory('back'), [navigateHistory]);
  const navigateForwardHistory = React.useCallback(() => navigateHistory('forward'), [navigateHistory]);
  React.useEffect(
    () => () => {
      if (statusNoticeTimer.current !== null) window.clearTimeout(statusNoticeTimer.current);
    },
    [],
  );
  /**
   * Resolve the symbol under one editor position and reveal its declaration.
   *
   * Imports are resolved from workspace files first; other languages use the
   * existing bounded text search and re-read the candidate for an exact
   * declaration location. This intentionally stays a navigation shortcut,
   * not a second language server.
   * @param {object} editor - Monaco editor that owned the click.
   * @param {object} position - Monaco one-based line/column.
   * @returns {void}
   */ const goToDefinitionAt = React.useCallback(
    (editor: Monaco.editor.ICodeEditor, position: Monaco.Position) => {
      const model = editor?.getModel?.() ?? null;
      const word = model === null ? null : (model.getWordAtPosition?.(position) ?? null);
      const symbol = typeof word?.word === 'string' ? word.word.trim() : '';
      const path = navigationPathForModel(model);
      if (model === null || path === '') {
        flashStatus(t('editor.definitionNoFile'));
        return;
      }
      if (symbol === '') {
        flashStatus(t('editor.definitionNoSymbol'));
        return;
      }
      const origin = normalizeNavigationLocation({
        path,
        line: position?.lineNumber ?? 1,
        column: position?.column ?? 1,
      });
      void resolveWorkspaceDefinition({
        path,
        content: model.getValue(),
        symbol,
        readFile: async (target: string): Promise<string> => {
          const existing = modelsRef.current.get(target);
          if (existing !== undefined) return existing.getValue();
          const value = await callFs<{ content?: string }>({ op: 'read', path: target });
          return value?.content ?? '';
        },
        searchText: async (query: string, options?: DefinitionSearchOptions) => {
          const value = await callFs({
            op: 'searchText',
            query,
            regex: true,
            maxMatches: 80,
            scopeIncludePatterns: options?.scopeIncludePatterns,
          });
          return Array.isArray(value?.matches) ? value.matches : [];
        },
      })
        .then((target) => {
          if (target === null) {
            flashStatus(t('editor.definitionNotFound', { name: symbol }));
            return;
          }
          openFileAtLocation(target.path, target.line, target.column, {
            origin,
          });
        })
        .catch((failure) => {
          flashStatus(
            t('editor.definitionFailed', {
              message: failure instanceof Error ? failure.message : String(failure),
            }),
          );
        });
    },
    [flashStatus, openFileAtLocation, t],
  );
  /**
   * Save every dirty tab, IDEA's "Save All" (⌥⌘S / Ctrl+Alt+S).
   *
   * A tab whose file changed on disk is left alone: it keeps its conflict
   * banner instead of being force-written behind the user's back.
   * @returns {Promise<number>} how many files were written.
   */ const saveAll = React.useCallback(async () => {
    const dirty = openFilesRef.current.filter((file) => file.dirty);
    let written = 0;
    for (const file of dirty) {
      const model = modelsRef.current.get(file.path);
      if (model === undefined) continue;
      try {
        const value = await callFs<{ mtime?: number | null }>({
          op: 'write',
          path: file.path,
          content: model.getValue(),
          mtime: file.mtime ?? undefined,
        });
        setOpenFiles((current) =>
          current.map((entry) =>
            entry.path === file.path
              ? {
                  ...entry,
                  content: model.getValue(),
                  dirty: false,
                  mtime: typeof value.mtime === 'number' ? value.mtime : entry.mtime,
                }
              : entry,
          ),
        );
        written += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/changed on disk|no longer exists/u.test(message)) setConflict({ path: file.path, message });
        else setEditorError(message);
      }
    }
    if (written > 0) {
      flashStatus(t('editor.savedAll', { count: written }));
      await loadGit();
    }
    return written;
  }, [flashStatus, loadGit, t]);
  const gotoInputRef = React.useRef<HTMLInputElement | null>(null);
  /* IDEA 的 Go to Line/Column：接受行号或 `行:列`。 */ const [gotoState, setGotoState] =
    React.useState<EditorGotoLineState | null>(null);
  const gotoLine = React.useCallback(
    (path: string | null = null, pane: 'left' | 'right' | null = null) => {
      const targetPath = path ?? currentCodePath();
      if (targetPath === null) return false;
      const targetPane =
        pane ??
        (targetPath === splitPathRef.current && focusedEditorRef.current?.path === targetPath ? 'right' : 'left');
      setGotoState({
        value: '',
        error: null,
        path: targetPath,
        pane: targetPane,
      });
      window.setTimeout(() => {
        gotoInputRef.current?.focus?.();
        gotoInputRef.current?.select?.();
      }, 0);
      return true;
    },
    [currentCodePath],
  );
  const closeGotoLine = React.useCallback(() => {
    const pane = gotoState?.pane ?? 'left';
    setGotoState(null);
    window.setTimeout(() => {
      const editor = pane === 'right' ? splitEditorRef.current : editorRef.current;
      editor?.focus?.();
    }, 0);
  }, [gotoState]);
  const commitGotoLine = React.useCallback(() => {
    const parsed = parseGotoLinePosition(gotoState?.value);
    if (parsed === null) {
      setGotoState((current) => (current === null ? null : { ...current, error: t('editor.gotoLineInvalid') }));
      window.setTimeout(() => gotoInputRef.current?.select?.(), 0);
      return;
    }
    const path = gotoState.path;
    const pane = gotoState.pane;
    setGotoState(null);
    revealLines(path, parsed.line, parsed.column, pane);
  }, [gotoState, revealLines, t]);
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (gotoState !== null || !gotoLineShortcutMatches(event)) return;
      const host = document.querySelector<HTMLElement>('[data-dsh-editor-workspace]');
      const active = document.activeElement;
      if (host === null || !(active instanceof Element) || !host.contains(active)) return;
      if (
        active.closest(
          '[data-dsh-editor-terminal], [data-dsh-editor-diff-surface], [data-dsh-find-tool-window], [data-dsh-search-everywhere]',
        ) !== null
      )
        return;
      const path = currentCodePath();
      if (path === null) return;
      event.preventDefault();
      event.stopPropagation();
      gotoLine(path);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [currentCodePath, gotoLine, gotoState]);
  /* A terminal link asks the editor to open a workspace file at a location. */ React.useEffect(() => {
    const host = document.querySelector<HTMLElement>('[data-dsh-editor-workspace]');
    if (host === null) return;
    const onOpen = (event: CustomEvent<{ path?: unknown; line?: unknown; column?: unknown }>) => {
      const detail = event.detail ?? {};
      const path = typeof detail.path === 'string' ? detail.path : '';
      if (path === '') return;
      pendingReveal.current = {
        path,
        line: typeof detail.line === 'number' ? detail.line : 1,
        column: typeof detail.column === 'number' ? detail.column : 1,
      };
      void openFile(path);
    };
    host.addEventListener('dsh-editor-open-file', onOpen);
    return () => host.removeEventListener('dsh-editor-open-file', onOpen);
  }, [openFile]);
  /** Mirror one focused Monaco editor into the shared status bar. */ const syncEditorStatus = React.useCallback(
    (editor: Monaco.editor.ICodeEditor | null) => {
      const model = editor?.getModel?.();
      if (model === null || model === undefined) return;
      const options = (model.getOptions?.() ?? {}) as { tabSize?: number; insertSpaces?: boolean };
      setFileMode({
        tabSize: typeof options.tabSize === 'number' ? options.tabSize : 2,
        insertSpaces: options.insertSpaces !== false,
        eol: model.getEOL?.() === '\r\n' ? 'CRLF' : 'LF',
        encoding: 'UTF-8',
      });
      const position = editor.getPosition?.();
      if (position !== null && position !== undefined) {
        setCaret({ line: position.lineNumber, column: position.column });
      }
      const selection = editor.getSelection?.();
      const selected = selection === null || selection === undefined ? '' : model.getValueInRange(selection);
      setLineStats({ lines: model.getLineCount(), selected: selected.length });
    },
    [],
  );
  /* Create Monaco once the container exists. */ React.useEffect(() => {
    if (!monacoReady || containerRef.current === null) return;
    const monaco = window.monaco;
    if (monaco?.editor === undefined) return;
    const group = createCodeEditorGroup(monaco, containerRef.current, {
      onSave: () => void saveActive(),
      sendHarnessReferenceLabel: `${t('editor.harness')}->`,
      onSendHarnessReference: sendHarnessEditorReference,
      onFind: () => {
        /* ⌘F belongs to whatever has focus: the Project tree's speed search,
               the terminal's find bar, or this editor find bar — never two at once. */ if (
          document.activeElement?.closest('.monaco-editor') == null
        )
          return;
        setReplaceState(
          (current) =>
            current ?? {
              find: '',
              replace: '',
              index: 0,
              total: 0,
              withReplace: false,
              preserveCase: false,
              scope: null,
              error: null,
            },
        );
      },
      textSearchLabel: t('editor.textSearchAction'),
      onSearchText: () => {
        openSearchEverywhereRef.current?.('text');
        window.setTimeout(() => document.querySelector<HTMLElement>('[data-dsh-search-query]')?.focus?.(), 0);
      },
      findUsagesLabel: t('editor.findUsagesAction'),
      selectAllOccurrencesLabel: t('editor.selectAllOccurrencesAction'),
      selectNextOccurrenceLabel: t('editor.selectNextOccurrenceAction'),
      unselectPreviousOccurrenceLabel: t('editor.unselectPreviousOccurrenceAction'),
      searchWebLabel: t('editor.searchWebAction'),
      findInFilesLabel: t('editor.findInFilesAction'),
      replaceInFilesLabel: t('editor.replaceInFilesAction'),
      findUsagesInFileLabel: t('editor.findUsagesInFileAction'),
      highlightUsagesInFileLabel: t('editor.highlightUsagesInFileAction'),
      findWordAtCaretLabel: t('editor.nextWordOccurrenceAction'),
      previousWordOccurrenceLabel: t('editor.previousWordOccurrenceAction'),
      replaceLabel: t('editor.replaceAction'),
      incrementalSearchLabel: t('editor.incrementalSearchAction'),
      onReplace: (editor) => editorFindContextRunnerRef.current?.(editor, true, 'replace'),
      onIncrementalSearch: (editor) => editorFindContextRunnerRef.current?.(editor, false, 'query'),
      findInSelectionLabel: t('editor.searchInSelectionOnly'),
      replaceInSelectionLabel: t('editor.replaceInSelectionOnly'),
      onFindInSelection: (editor) => selectionFindContextRunnerRef.current?.(editor, false, 'query'),
      onReplaceInSelection: (editor) => selectionFindContextRunnerRef.current?.(editor, true, 'replace'),
      onFindUsagesInFile: (editor) => editorFindContextRunnerRef.current?.(editor),
      onFindInFiles: (editor) => findToolContextRunnerRef.current?.(editor, 'find'),
      onReplaceInFiles: (editor) => findToolContextRunnerRef.current?.(editor, 'replace'),
      onFindUsages: (editor) => findUsagesRunnerRef.current?.(editor),
      onSaveAll: () => void saveAll(),
      onGotoLine: () => gotoLine(),
      gotoLineLabel: t('editor.gotoLine'),
      onGoToDefinition: goToDefinitionAt,
      goToDefinitionLabel: t('editor.goToDefinitionAction'),
      onNavigateBack: navigateBackHistory,
      onNavigateForward: navigateForwardHistory,
      navigationBackLabel: t('editor.navigationBackAction'),
      navigationForwardLabel: t('editor.navigationForwardAction'),
      onCloseTab: () => {
        /* ⌘W closes whichever editor tab is showing: the Commit diff while
               that tab is active, otherwise the open file. */ if (diffActiveRef.current) closeDiff();
        else if (activePathRef.current !== null) closeFile(activePathRef.current);
      },
    });
    const editor = group.editor;
    editorRef.current = editor;
    const focusSubscription = editor.onDidFocusEditorText?.(() => {
      focusedEditorRef.current = { path: activePathRef.current, editor };
      focusedPathRef.current = activePathRef.current;
      setFocusedPath(activePathRef.current);
      syncEditorStatus(editor);
    });
    return () => {
      focusSubscription?.dispose?.();
      group.dispose();
      editorRef.current = null;
      for (const model of modelsRef.current.values()) model.dispose();
      modelsRef.current.clear();
    };
  }, [
    closeDiff,
    goToDefinitionAt,
    monacoReady,
    navigateBackHistory,
    navigateForwardHistory,
    saveActive,
    sendHarnessEditorReference,
    syncEditorStatus,
    t,
  ]);
  /* Hidden Monaco panes cannot measure themselves. Re-layout after IDEA's
         Editor / Editor and Preview / Preview switch changes the visible box. */ React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      editorRef.current?.layout?.();
      splitEditorRef.current?.layout?.();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [effectiveMarkdownMode, activePath, fileSurfaceVisible]);
  /* IDEA keeps the Markdown editor and preview on the same reading position.
         Suppress only the echo produced by the opposite pane's programmatic
         assignment; a real scroll in either pane becomes the next driver. */ React.useEffect(() => {
    const editor = editorRef.current;
    const preview = markdownPreviewRef.current;
    if (effectiveMarkdownMode !== 'split' || editor === null || preview === null) return undefined;
    let disposed = false;
    const editorBox = () => ({
      scrollTop: editor.getScrollTop?.() ?? 0,
      scrollHeight: editor.getScrollHeight?.() ?? 0,
      clientHeight: editor.getLayoutInfo?.()?.height ?? 0,
    });
    const isEcho = (source: 'editor' | 'preview') => {
      const lock = markdownScrollSyncRef.current;
      if (lock.source !== source || lock.until <= performance.now()) return false;
      lock.source = null;
      lock.until = 0;
      return true;
    };
    const claim = (source: 'editor' | 'preview') => {
      markdownScrollSyncRef.current = {
        source,
        until: performance.now() + 120,
      };
    };
    const onEditorScroll = () => {
      if (disposed || isEcho('editor')) return;
      claim('preview');
      preview.scrollTop = markdownScrollTopForRatio(markdownScrollRatio(editorBox()), preview);
    };
    const onPreviewScroll = () => {
      if (disposed || isEcho('preview')) return;
      claim('editor');
      const next = markdownScrollTopForRatio(markdownScrollRatio(preview), editorBox());
      if (Math.abs((editor.getScrollTop?.() ?? 0) - next) >= 1) editor.setScrollTop?.(next);
    };
    const subscription = editor.onDidScrollChange?.(onEditorScroll);
    preview.addEventListener('scroll', onPreviewScroll, { passive: true });
    return () => {
      disposed = true;
      subscription?.dispose?.();
      preview.removeEventListener('scroll', onPreviewScroll);
    };
  }, [activePath, effectiveMarkdownMode, fileSurfaceVisible, monacoReady]);
  /* Bind the active file's model to the editor. */ React.useEffect(() => {
    const monaco = window.monaco;
    const editor = editorRef.current;
    if (!monacoReady || monaco?.editor === undefined || editor === null) return;
    if (activePath === null) {
      editor.setModel(null);
      return;
    }
    const file = openFilesRef.current.find((entry) => entry.path === activePath);
    if (file === undefined) return;
    if (file.kind === 'image') {
      editor.setModel(null);
      return;
    }
    const model = ensureEditorModel(monaco, modelsRef.current, activePath, file.content);
    if (editor.getModel() !== model) editor.setModel(model);
    /* An inline create/rename in the tree keeps focus, and so does a plain tree
           click: IDEA opens the file but leaves the caret on the row you clicked, so
           the next arrow key walks the tree instead of the code. Focus is only
           pulled into the editor when it was already heading there (the editor, a
           terminal link, or the tab strip). */ const activeNode = document.activeElement;
    const inlineEditing =
      activeNode?.closest('[data-dsh-editor-workspace] input') !== null &&
      activeNode?.closest('.dsh-editor-tree-row, [data-dsh-editor-workspace] > div') !== null;
    const inTree = activeNode?.closest('[role="tree"]') != null;
    /* Clicking a file tab answers "show me this file"; the Commit panel's
           checkbox or tree must keep the caret where the user is working. */ const inTabs =
      activeNode?.closest('[data-dsh-editor-tabstrip]') != null;
    if (!inlineEditing && !inTree && !inTabs) editor.focus();
    /* Reflect the file's own indentation and line endings in the status bar. */ const options =
      (model.getOptions?.() ?? {}) as { tabSize?: number; insertSpaces?: boolean };
    setFileMode({
      tabSize: typeof options.tabSize === 'number' ? options.tabSize : 2,
      insertSpaces: options.insertSpaces !== false,
      eol: model.getEOL?.() === '\r\n' ? 'CRLF' : 'LF',
      encoding: 'UTF-8',
    });
    /* A terminal link may have asked for a specific line in this file. */ const reveal = pendingReveal.current;
    if (reveal !== null && reveal.path === activePath) {
      pendingReveal.current = null;
      revealLines(activePath, reveal.line, reveal.column);
    }
    const subscription = editor.onDidChangeModelContent(() => {
      /* A reload from disk replaces the model; marking it dirty would fake unsaved work. */ if (
        silentReloadRef.current.has(activePath)
      )
        return;
      if (previewPathRef.current === activePath) {
        previewPathRef.current = null;
        setPreviewPath(null);
      }
      const value = editor.getValue();
      setOpenFiles((current) =>
        current.map((entry) => (entry.path === activePath ? { ...entry, content: value, dirty: true } : entry)),
      );
    });
    const caretSubscription = editor.onDidChangeCursorPosition((event) => {
      setCaret({
        line: event.position.lineNumber,
        column: event.position.column,
      });
      setLineStats((current) => ({
        ...current,
        selected:
          editor.getModel()?.getValueInRange(editor.getSelection() ?? new monaco.Range(1, 1, 1, 1))?.length ?? 0,
        lines: editor.getModel()?.getLineCount() ?? 0,
      }));
    });
    const position = editor.getPosition();
    if (position !== null) {
      setCaret({ line: position.lineNumber, column: position.column });
    }
    setLineStats({ lines: model.getLineCount(), selected: 0 });
    return () => {
      subscription.dispose();
      caretSubscription.dispose();
    };
  }, [activePath, diffActive, monacoReady, openFiles.length]);
  /**
   * Close a set of tabs from the right editor group.
   *
   * Range commands in one editor group never close the shared workspace
   * documents. Dirty files get one confirmation for the whole batch, then
   * only the right group's history is updated.
   * @param {string[]} paths - right-group tab identities.
   * @returns {boolean} whether the batch was closed.
   */ const closeSplitTabs = React.useCallback(
    (paths: string[]) => {
      const wanted = new Set(paths);
      const doomed = splitTabsRef.current.filter((path) => wanted.has(path));
      if (doomed.length === 0) return true;
      const dirty = doomed.filter(
        (path) => openFilesRef.current.find((file) => file.path === path)?.dirty === true,
      ).length;
      if (dirty > 0 && !window.confirm(t('editor.unsavedTabsConfirm', { count: dirty }))) return false;
      const current = splitTabsRef.current;
      const remaining = splitTabsRef.current.filter((path) => wanted.has(path) === false);
      splitTabsRef.current = remaining;
      setSplitTabs(remaining);
      if (splitPathRef.current !== null && wanted.has(splitPathRef.current)) {
        const index = current.indexOf(splitPathRef.current);
        const fallback = remaining[Math.min(Math.max(index, 0), remaining.length - 1)] ?? null;
        splitPathRef.current = fallback;
        setSplitPath(fallback);
        if (fallback === null) {
          splitEditorRef.current?.setModel?.(null);
          const editor = editorRef.current;
          editor?.focus();
          syncEditorStatus(editor);
          focusedEditorRef.current = { path: activePathRef.current, editor };
          focusedPathRef.current = activePathRef.current;
          setFocusedPath(activePathRef.current);
        }
      }
      return true;
    },
    [syncEditorStatus, t],
  );
  /**
   * Close one tab from the right editor group without closing the shared file.
   *
   * The right group is a view over the same workspace models. Removing its
   * tab must therefore leave the file available in the left group; only the
   * per-group tab history changes. When the active tab disappears IDEA moves
   * to the tab that occupied its slot, then falls back to the new last tab.
   * @param {string} path - workspace-relative tab identity.
   * @param {{skipConfirm?: boolean}} [options] - batch callers confirm once.
   * @returns {boolean} whether the tab was closed.
   */ const closeSplitTab = React.useCallback(
    (path: string, options: { skipConfirm?: boolean } = {}) => {
      if (typeof path !== 'string' || path === '') return true;
      const current = splitTabsRef.current;
      if (!current.includes(path)) return true;
      const file = openFilesRef.current.find((entry) => entry.path === path);
      if (
        options.skipConfirm !== true &&
        file?.dirty === true &&
        !window.confirm(t('editor.unsavedTabsConfirm', { count: 1 }))
      )
        return false;
      const index = current.indexOf(path);
      const next = current.filter((entry) => entry !== path);
      splitTabsRef.current = next;
      setSplitTabs(next);
      const fallback = next[Math.min(index, next.length - 1)] ?? null;
      if (splitPathRef.current === path) {
        splitPathRef.current = fallback;
        setSplitPath(fallback);
        if (fallback === null) {
          splitEditorRef.current?.setModel?.(null);
          const editor = editorRef.current;
          editor?.focus();
          syncEditorStatus(editor);
          focusedEditorRef.current = { path: activePathRef.current, editor };
          focusedPathRef.current = activePathRef.current;
          setFocusedPath(activePathRef.current);
        }
      }
      return true;
    },
    [syncEditorStatus, t],
  );
  /** Move within the right group's own tab history, wrapping at both ends. */ const cycleSplitTab = React.useCallback(
    (step: number) => {
      const tabs = splitTabsRef.current;
      if (tabs.length < 2) return false;
      const index = Math.max(0, tabs.indexOf(splitPathRef.current ?? tabs[0]));
      const next = tabs[(index + step + tabs.length) % tabs.length];
      if (next === undefined || next === splitPathRef.current) return false;
      splitPathRef.current = next;
      setSplitPath(next);
      window.setTimeout(() => splitEditorRef.current?.focus?.(), 0);
      return true;
    },
    [],
  );
  /** Alt+Left/Right is owned by the right group only while it contains the caret. */ const splitTabShortcut =
    React.useCallback(
      (event: KeyboardEvent) => {
        if (!event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        const target = event.target instanceof Node ? event.target : null;
        if (target === null || splitContainerRef.current?.contains(target) !== true) return;
        if (!cycleSplitTab(event.key === 'ArrowRight' ? 1 : -1)) return;
        event.preventDefault();
        event.stopPropagation();
      },
      [cycleSplitTab],
    );
  React.useEffect(() => {
    window.addEventListener('keydown', splitTabShortcut, true);
    return () => window.removeEventListener('keydown', splitTabShortcut, true);
  }, [splitTabShortcut]);
  /** Close the entire right editor group and return the caret to the left. */ const closeRightSplit =
    React.useCallback(() => {
      splitTabsRef.current = [];
      setSplitTabs([]);
      splitPathRef.current = null;
      setSplitPath(null);
      splitEditorRef.current?.setModel?.(null);
      const editor = editorRef.current;
      editor?.focus();
      syncEditorStatus(editor);
      focusedEditorRef.current = { path: activePathRef.current, editor };
      focusedPathRef.current = activePathRef.current;
      setFocusedPath(activePathRef.current);
    }, [syncEditorStatus]);
  /**
   * Close one tab and dispose its model.
   *
   * IDEA asks before dropping unsaved edits, and the caller can bypass the
   * prompt when it already confirmed for a whole batch (Close All).
   * @param {string} path - tab identity.
   * @param {boolean} skipConfirm - close even when the model is dirty.
   */ const closeFile = React.useCallback(
    (path: string, skipConfirm = false) => {
      if (!skipConfirm) {
        const file = openFilesRef.current.find((entry) => entry.path === path);
        if (file?.dirty === true && !window.confirm(t('editor.unsavedTabsConfirm', { count: 1 }))) return;
      }
      closeSplitTab(path, { skipConfirm: true });
      const model = modelsRef.current.get(path);
      if (model !== undefined) {
        model.dispose();
        modelsRef.current.delete(path);
      }
      if (previewPathRef.current === path) {
        previewPathRef.current = null;
        setPreviewPath(null);
      }
      const before = openFilesRef.current;
      const index = before.findIndex((file) => file.path === path);
      const remaining = before.filter((file) => file.path !== path);
      setOpenFiles(remaining);
      let nextActivePath = activePathRef.current;
      if (activePathRef.current === path) {
        /* IDEA activates the tab that moved into the closed tab's slot;
             at the right edge it falls back to the new last tab. */ const next =
          remaining.length > 0 ? remaining[Math.min(index, remaining.length - 1)].path : null;
        nextActivePath = next;
        setActivePath(next);
      }
      window.setTimeout(() => {
        /* A menu or another control may already have restored focus after the
           closed button unmounted. Only repair the body/unmounted fallback. */
        const active = document.activeElement;
        if (active !== null && active !== document.body && active.isConnected !== false) return;
        if (nextActivePath !== null) {
          const tab = [...document.querySelectorAll<HTMLElement>('[data-dsh-editor-file-tab-path]')].find(
            (candidate) => candidate.getAttribute('data-dsh-editor-file-tab-path') === nextActivePath,
          );
          if (tab !== undefined) {
            tab.focus({ preventScroll: true });
            return;
          }
        }
        focusWorkspaceFallback(document.querySelector<HTMLElement>('[data-dsh-editor-workspace]'));
      }, 0);
    },
    [closeSplitTab, t],
  );
  /* The right split is a second view over the same workspace model. */ React.useEffect(() => {
    if (!monacoReady || splitTabs.length === 0 || splitContainerRef.current === null) return undefined;
    const monaco = window.monaco;
    if (monaco?.editor === undefined) return undefined;
    const group = createCodeEditorGroup(monaco, splitContainerRef.current, {
      onSave: () => void savePath(splitPathRef.current),
      sendHarnessReferenceLabel: `${t('editor.harness')}->`,
      onSendHarnessReference: sendHarnessEditorReference,
      onFind: () => {
        if (document.activeElement?.closest('.monaco-editor') == null) return;
        setReplaceState(
          (current) =>
            current ?? {
              find: '',
              replace: '',
              index: 0,
              total: 0,
              withReplace: false,
              preserveCase: false,
              scope: null,
              error: null,
            },
        );
      },
      textSearchLabel: t('editor.textSearchAction'),
      onSearchText: () => {
        openSearchEverywhereRef.current?.('text');
        window.setTimeout(() => document.querySelector<HTMLElement>('[data-dsh-search-query]')?.focus?.(), 0);
      },
      findUsagesLabel: t('editor.findUsagesAction'),
      selectAllOccurrencesLabel: t('editor.selectAllOccurrencesAction'),
      selectNextOccurrenceLabel: t('editor.selectNextOccurrenceAction'),
      unselectPreviousOccurrenceLabel: t('editor.unselectPreviousOccurrenceAction'),
      searchWebLabel: t('editor.searchWebAction'),
      findInFilesLabel: t('editor.findInFilesAction'),
      replaceInFilesLabel: t('editor.replaceInFilesAction'),
      findUsagesInFileLabel: t('editor.findUsagesInFileAction'),
      highlightUsagesInFileLabel: t('editor.highlightUsagesInFileAction'),
      findWordAtCaretLabel: t('editor.nextWordOccurrenceAction'),
      previousWordOccurrenceLabel: t('editor.previousWordOccurrenceAction'),
      replaceLabel: t('editor.replaceAction'),
      incrementalSearchLabel: t('editor.incrementalSearchAction'),
      onReplace: (editor) => editorFindContextRunnerRef.current?.(editor, true, 'replace'),
      onIncrementalSearch: (editor) => editorFindContextRunnerRef.current?.(editor, false, 'query'),
      findInSelectionLabel: t('editor.searchInSelectionOnly'),
      replaceInSelectionLabel: t('editor.replaceInSelectionOnly'),
      onFindInSelection: (editor) => selectionFindContextRunnerRef.current?.(editor, false, 'query'),
      onReplaceInSelection: (editor) => selectionFindContextRunnerRef.current?.(editor, true, 'replace'),
      onFindUsagesInFile: (editor) => editorFindContextRunnerRef.current?.(editor),
      onFindInFiles: (editor) => findToolContextRunnerRef.current?.(editor, 'find'),
      onReplaceInFiles: (editor) => findToolContextRunnerRef.current?.(editor, 'replace'),
      onFindUsages: (editor) => findUsagesRunnerRef.current?.(editor),
      onSaveAll: () => void saveAll(),
      onGotoLine: () => gotoLine(),
      gotoLineLabel: t('editor.gotoLine'),
      onGoToDefinition: goToDefinitionAt,
      goToDefinitionLabel: t('editor.goToDefinitionAction'),
      onNavigateBack: navigateBackHistory,
      onNavigateForward: navigateForwardHistory,
      navigationBackLabel: t('editor.navigationBackAction'),
      navigationForwardLabel: t('editor.navigationForwardAction'),
      onCloseTab: () => closeSplitTab(splitPathRef.current),
    });
    const editor = group.editor;
    splitEditorRef.current = editor;
    const contentSubscription = editor.onDidChangeModelContent(() => {
      const path = splitPathRef.current;
      if (path === null || silentReloadRef.current.has(path)) return;
      const value = editor.getValue();
      setOpenFiles((current) =>
        current.map((entry) => (entry.path === path ? { ...entry, content: value, dirty: true } : entry)),
      );
    });
    const cursorSubscription = editor.onDidChangeCursorPosition((event) => {
      setCaret({
        line: event.position.lineNumber,
        column: event.position.column,
      });
    });
    const focusSubscription = editor.onDidFocusEditorText?.(() => {
      const path = splitPathRef.current;
      focusedEditorRef.current = { path, editor };
      focusedPathRef.current = path;
      setFocusedPath(path);
      syncEditorStatus(editor);
    });
    return () => {
      contentSubscription.dispose();
      cursorSubscription.dispose();
      focusSubscription?.dispose?.();
      splitEditorRef.current = null;
      group.dispose();
    };
  }, [
    closeSplitTab,
    goToDefinitionAt,
    monacoReady,
    navigateBackHistory,
    navigateForwardHistory,
    saveAll,
    savePath,
    sendHarnessEditorReference,
    splitTabs.length === 0,
    syncEditorStatus,
    t,
  ]);
  const bindActiveModel = React.useCallback(() => {
    const monaco = window.monaco;
    const editor = splitEditorRef.current;
    const path = splitPathRef.current;
    if (!monacoReady || monaco?.editor === undefined || editor === null || path === null) return;
    const file = openFilesRef.current.find((entry) => entry.path === path);
    if (file === undefined) return;
    if (file.kind === 'image') {
      editor.setModel(null);
      return;
    }
    const model = ensureEditorModel(monaco, modelsRef.current, path, file.content);
    if (editor.getModel() !== model) editor.setModel(model);
    syncEditorStatus(editor);
  }, [monacoReady, syncEditorStatus]);
  React.useEffect(() => {
    bindActiveModel();
    const path = splitPathRef.current;
    if (path !== null) {
      window.setTimeout(() => {
        if (splitPathRef.current === path) splitEditorRef.current?.focus?.();
      }, 0);
    }
  }, [bindActiveModel, openFiles.length, splitPath]);
  React.useEffect(() => {
    if (splitPath !== null && !openFiles.some((file) => file.path === splitPath)) setSplitPath(null);
  }, [openFiles, splitPath]);
  React.useEffect(() => {
    if (splitTabs.length === 0) {
      if (splitPathRef.current === null) return;
      splitPathRef.current = null;
      setSplitPath(null);
      return;
    }
    const validTabs = splitTabs.filter((path) => openFiles.some((file) => file.path === path));
    if (validTabs.length === splitTabs.length) {
      if (splitPath === null && validTabs.length > 0) {
        splitPathRef.current = validTabs[0];
        setSplitPath(validTabs[0]);
      }
      return;
    }
    splitTabsRef.current = validTabs;
    setSplitTabs((current) => current.filter((path) => openFiles.some((file) => file.path === path)));
    if (splitPathRef.current !== null && !validTabs.includes(splitPathRef.current)) {
      const fallback = validTabs[0] ?? null;
      splitPathRef.current = fallback;
      setSplitPath(fallback);
      if (fallback === null) {
        splitEditorRef.current?.setModel?.(null);
        focusedEditorRef.current = {
          path: activePathRef.current,
          editor: editorRef.current,
        };
        focusedPathRef.current = activePathRef.current;
        setFocusedPath(activePathRef.current);
      }
    }
  }, [openFiles, splitPath, splitTabs]);
  /**
   * Close a batch of file paths after warning once.
   *
   * All close-menu operations go through this helper, so a dirty tab can
   * never be discarded silently just because it arrived through a range
   * command instead of the close button.
   * @param {string[]} paths - file paths to close.
   * @returns {void}
   */ const closePaths = React.useCallback(
    (paths: string[]) => {
      const wanted = new Set(paths);
      const before = openFilesRef.current;
      const doomed = before.filter((file) => wanted.has(file.path));
      if (doomed.length === 0) return true;
      const dirty = doomed.filter((file) => file.dirty).length;
      if (dirty > 0 && !window.confirm(t('editor.unsavedTabsConfirm', { count: dirty }))) return false;
      {
        const previousSplitTabs = splitTabsRef.current;
        const remaining = splitTabsRef.current.filter((path) => wanted.has(path) === false);
        if (remaining.length !== previousSplitTabs.length) {
          splitTabsRef.current = remaining;
          setSplitTabs(remaining);
        }
        if (splitPathRef.current !== null && wanted.has(splitPathRef.current)) {
          const index = previousSplitTabs.indexOf(splitPathRef.current);
          const fallback = remaining[Math.min(Math.max(index, 0), remaining.length - 1)] ?? null;
          splitPathRef.current = fallback;
          setSplitPath(fallback);
          if (fallback === null) {
            splitEditorRef.current?.setModel?.(null);
            focusedEditorRef.current = {
              path: activePathRef.current,
              editor: editorRef.current,
            };
            focusedPathRef.current = activePathRef.current;
            setFocusedPath(activePathRef.current);
          }
        }
      }
      for (const file of doomed) {
        const model = modelsRef.current.get(file.path);
        model?.dispose?.();
        modelsRef.current.delete(file.path);
      }
      if (previewPathRef.current !== null && wanted.has(previewPathRef.current)) {
        previewPathRef.current = null;
        setPreviewPath(null);
      }
      const remaining = before.filter((file) => wanted.has(file.path) === false);
      setOpenFiles(remaining);
      const active = activePathRef.current;
      if (active !== null && wanted.has(active)) {
        const index = before.findIndex((file) => file.path === active);
        const next = remaining.length > 0 ? remaining[Math.min(Math.max(index, 0), remaining.length - 1)].path : null;
        setActivePath(next);
      }
      return true;
    },
    [t],
  );
  /** IDEA's "Close Other Tabs": keep one tab, drop the rest after one prompt. */ const closeOtherTabs =
    React.useCallback(
      (keepPath: string) => {
        closePaths(openFilesRef.current.filter((file) => file.path !== keepPath).map((file) => file.path));
      },
      [closePaths],
    );
  /** IDEA's "Close All Tabs". */ const closeAllTabs = React.useCallback(() => {
    if (!closePaths(openFilesRef.current.map((file) => file.path))) return;
    /* Close All is the one command that closes the pinned comparison too. */ closeDiff();
  }, [closeDiff, closePaths]);
  /**
   * Close a set of editor tabs identified by tab-strip keys.
   *
   * The diff tab and file tabs share one strip order, so "close to the
   * left/right" must be evaluated over both kinds. All dirty file tabs are
   * covered by one confirmation, and state is replaced once rather than
   * once per tab (which would leave all but the last tab open).
   * @param {string[]} keys - file paths or DIFF_TAB_KEY entries.
   * @returns {void}
   */ const closeEditorTabs = React.useCallback(
    (keys: string[]) => {
      const wanted = new Set(keys);
      const includesDiff = wanted.has(DIFF_TAB_KEY);
      const fileKeys = [...wanted].filter((key) => key !== DIFF_TAB_KEY);
      if (!closePaths(fileKeys)) return;
      /* Only a range that actually covers the pinned diff may dismiss it.
           Closing tabs to the RIGHT of a file must leave a diff pinned at the
           left intact (it was the observed bug: diff vanished but the file to
           the right stayed open). */ if (includesDiff) {
        setDiffTarget(null);
      }
      const remainingFiles = openFilesRef.current.filter((file) => !fileKeys.includes(file.path));
      if (includesDiff && remainingFiles.length === 0) {
        setDiffActive(false);
        /* No file remains to hand the caret to: return to the Changes row
             that opened the comparison, or to the nearest stable workspace surface. */ window.setTimeout(() => {
          const row = diffReturnFocusRef.current;
          if (row !== null && row.isConnected) row.focus();
          else focusWorkspaceFallback(document.querySelector<HTMLElement>('[data-dsh-editor-workspace]'));
        }, 0);
      }
    },
    [closePaths],
  );
  /* Cmd/Ctrl+Shift+O opens "Go to File", IDEA's most-used navigation shortcut. */ React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || !event.shiftKey || event.key.toLowerCase() !== 'o') return;
      const host = document.querySelector<HTMLElement>('[data-dsh-editor-workspace]');
      if (host === null || !document.body.contains(host)) return;
      event.preventDefault();
      void openQuickOpen();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);
  const rememberQuickOpenOrigin = React.useCallback(() => {
    if (document.querySelector('[data-dsh-quick-open]') !== null) return;
    const activeElement =
      typeof HTMLElement !== 'undefined' && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (activeElement !== null && activeElement !== document.body) quickOpenReturnFocusRef.current = activeElement;
  }, []);
  /* Load the palette's candidate list lazily, once per open. */ const openQuickOpen = React.useCallback(async () => {
    rememberQuickOpenOrigin();
    const requestId = ++quickOpenFilesRequestRef.current;
    quickOpenFilesAbortRef.current?.abort();
    const searchAbort = new AbortController();
    quickOpenFilesAbortRef.current = searchAbort;
    setPaletteMode('files');
    setQuickOpen({ query: '', index: 0, loading: true, error: null });
    try {
      const value = await callFs<FileListResponse>({ op: 'files' }, { signal: searchAbort.signal });
      if (quickOpenFilesRequestRef.current !== requestId) return;
      setQuickOpen((current) =>
        current === null ? current : { ...current, files: value.files ?? [], loading: false, error: null },
      );
    } catch (failure) {
      if (failure?.name === 'AbortError' || failure?.name === 'CanceledError') return;
      if (quickOpenFilesRequestRef.current !== requestId) return;
      const message = failure instanceof Error ? failure.message : String(failure);
      setQuickOpen((current) =>
        current === null ? current : { ...current, files: [], loading: false, error: message },
      );
    } finally {
      if (quickOpenFilesAbortRef.current === searchAbort) quickOpenFilesAbortRef.current = null;
    }
  }, [rememberQuickOpenOrigin]);
  /**
   * Load the file candidate list for one explicit non-project scope.
   * @param {boolean} includeNonProject - whether excluded directories are included.
   * @returns {void}
   */ const requestSearchEverywhereFiles = React.useCallback((includeNonProject: boolean) => {
    const requestId = ++searchEverywhereFilesRequestRef.current;
    searchEverywhereFilesAbortRef.current?.abort();
    const searchAbort = new AbortController();
    searchEverywhereFilesAbortRef.current = searchAbort;
    void callFs<FileListResponse>(
      { op: 'files', includeExcluded: includeNonProject === true },
      { signal: searchAbort.signal },
    )
      .then((value) => {
        if (searchEverywhereFilesRequestRef.current !== requestId) return;
        const files: SearchEverywhereFile[] = Array.isArray(value?.files)
          ? value.files.filter((path): path is string => typeof path === 'string').map((path) => ({ path }))
          : [];
        searchEverywhereFilesRef.current = files;
        searchEverywhereFilesScopeRef.current = includeNonProject === true;
        setSearchEverywhere((current) =>
          current === null || current.includeNonProject !== (includeNonProject === true)
            ? current
            : { ...current, files },
        );
      })
      .catch((failure) => {
        if (failure?.name === 'AbortError' || failure?.name === 'CanceledError') return;
        if (searchEverywhereFilesRequestRef.current !== requestId) return;
        setSearchEverywhere((current) =>
          current === null || current.includeNonProject !== (includeNonProject === true)
            ? current
            : {
                ...current,
                error: failure instanceof Error ? failure.message : String(failure),
              },
        );
      })
      .finally(() => {
        if (searchEverywhereFilesAbortRef.current === searchAbort) {
          searchEverywhereFilesAbortRef.current = null;
        }
      });
  }, []);
  /**
   * Open IDEA's Search Everywhere in one requested tab.
   * @param {'all'|'files'|'text'|'actions'} [tab='all'] - initial tab.
   * @param {string} [query=''] - initial query.
   * @param {boolean} [withReplace=false] - show the Replace in Files row.
   * @returns {void}
   */ const openSearchEverywhere = React.useCallback(
    (tab: 'all' | 'files' | 'text' | 'actions' = 'all', query = '', withReplace = false) => {
      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (
        activeElement !== null &&
        activeElement !== document.body &&
        !activeElement.closest('[data-dsh-search-everywhere]')
      )
        searchEverywhereReturnFocusRef.current = activeElement;
      const savedOptions = readSearchOptions();
      const includeNonProject = savedOptions.includeExcluded === true;
      const cachedFilesMatchScope = searchEverywhereFilesScopeRef.current === includeNonProject;
      const initial: SearchEverywhereState = {
        tab,
        query,
        index: 0,
        withReplace,
        replace: '',
        files: cachedFilesMatchScope ? searchEverywhereFilesRef.current : [],
        textMatches: [],
        textLoading: false,
        textTruncated: false,
        textRevision: 0,
        replaceBusy: false,
        replaceFocusRequest: 0,
        error: null,
        includeNonProject,
        ...savedOptions,
      };
      setSearchEverywhere(initial);
      if (cachedFilesMatchScope && initial.files.length > 0) return;
      requestSearchEverywhereFiles(includeNonProject);
    },
    [requestSearchEverywhereFiles],
  );
  React.useEffect(() => {
    openSearchEverywhereRef.current = openSearchEverywhere;
    return () => {
      if (openSearchEverywhereRef.current === openSearchEverywhere) {
        openSearchEverywhereRef.current = () => {};
      }
    };
  }, [openSearchEverywhere]);
  const toggleIncludeNonProject = React.useCallback(() => {
    if (searchEverywhere === null) return;
    const includeNonProject = searchEverywhere.includeNonProject !== true;
    setSearchEverywhere((current) =>
      current === null ? current : { ...current, includeNonProject, index: 0, error: null },
    );
    requestSearchEverywhereFiles(includeNonProject);
  }, [requestSearchEverywhereFiles, searchEverywhere]);
  const searchEverywhereRawQuery = searchEverywhere?.query.trim() ?? '';
  const searchEverywhereTextQuery = searchEverywhereRawQuery;
  const searchEverywhereOpen = searchEverywhere !== null;
  const searchEverywhereTextActive =
    searchEverywhere !== null && (searchEverywhere.tab === 'all' || searchEverywhere.tab === 'text');
  React.useEffect(() => {
    if (!searchEverywhereTextActive) return undefined;
    const requestId = ++searchTextRequestRef.current;
    if (searchEverywhereTextQuery.length < 2) {
      setSearchEverywhere((current) =>
        current === null
          ? current
          : {
              ...current,
              textMatches: [],
              textLoading: false,
              textTruncated: false,
            },
      );
      return undefined;
    }
    setSearchEverywhere((current) => (current === null ? current : { ...current, textLoading: true, error: null }));
    const searchAbort = new AbortController();
    const timer = window.setTimeout(() => {
      void callFs<TextSearchResponse>(
        {
          op: 'searchText',
          query: searchEverywhereTextQuery,
          maxMatches: 200,
          includeExcluded: searchEverywhere?.includeNonProject === true,
          caseSensitive: searchEverywhere?.caseSensitive === true ? true : undefined,
          wholeWords: searchEverywhere?.wholeWords === true,
          regex: searchEverywhere?.regex === true,
          fileMask: normalizeFileExtensionFilter(searchEverywhere?.fileMask),
        },
        { signal: searchAbort.signal },
      )
        .then((value) => {
          if (searchTextRequestRef.current !== requestId) return;
          const hostMatches = Array.isArray(value?.matches) ? value.matches : [];
          const dirtyFiles = (Array.isArray(openFiles) ? openFiles : []).filter(
            (file) => file?.dirty === true && typeof file.content === 'string',
          );
          const merged = mergeFindToolDirtyMatches(
            hostMatches,
            dirtyFiles,
            searchEverywhereTextQuery,
            {
              caseSensitive: searchEverywhere?.caseSensitive === true,
              wholeWords: searchEverywhere?.wholeWords === true,
              regex: searchEverywhere?.regex === true,
              fileMask: searchEverywhere?.fileMask,
            },
            {
              mode: 'project',
              directory: '',
              preset: 'projectFiles',
              allowedPaths: null,
            },
            200,
          );
          setSearchEverywhere((current) =>
            current === null
              ? current
              : {
                  ...current,
                  textMatches: completeSearchMatches(merged.matches),
                  textTruncated: value?.truncated === true || merged.truncated,
                  textLoading: false,
                  error: null,
                },
          );
        })
        .catch((failure) => {
          if (failure?.name === 'AbortError' || failure?.name === 'CanceledError') return;
          if (searchTextRequestRef.current !== requestId) return;
          setSearchEverywhere((current) =>
            current === null
              ? current
              : {
                  ...current,
                  textMatches: [],
                  textLoading: false,
                  textTruncated: false,
                  error: searchTextFailureMessage(failure, t),
                },
          );
        });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      searchAbort.abort();
    };
  }, [
    searchEverywhereTextActive,
    searchEverywhereTextQuery,
    root,
    searchEverywhere?.textRevision,
    searchEverywhere?.includeNonProject,
    searchEverywhere?.caseSensitive,
    searchEverywhere?.wholeWords,
    searchEverywhere?.regex,
    searchEverywhere?.preserveCase,
    searchEverywhere?.fileMask,
    openFiles,
    t,
  ]);
  /**
   * Move a Search Everywhere result set into IDEA's persistent Find tool.
   *
   * The tool window has its own query lifecycle so subsequent edits no
   * longer depend on the transient dialog being mounted.
   * @param {string} [query=''] - initial search text.
   * @param {'find'|'replace'} [mode='find'] - whether to show replacement.
   * @param {{files?: object[], matches?: object[], truncated?: boolean}|null} [initial=null] - existing results.
   * @param {'query'|'replace'} [focusTarget='query'] - input to focus after mounting.
   * @param {'popup'|'dock'} [surface='popup'] - transient popup or persistent tool window.
   * @param {boolean} [restoreDraft=false] - restore the last direct-shortcut draft.
   * @returns {void}
   */ const openFindTool = React.useCallback(
    (
      query = '',
      mode: 'find' | 'replace' = 'find',
      initial: FindToolInitial | null = null,
      focusTarget: 'query' | 'replace' = 'query',
      surface: 'popup' | 'dock' = 'popup',
      restoreDraft = false,
    ) => {
      const textQuery = findToolContentQuery(query);
      const draft = findToolReopenDraft(findToolDraftRef.current, textQuery, mode, initial === null && restoreDraft);
      const savedOptions = normalizeSearchOptions(initial === null ? readSearchOptions() : initial);
      const savedScope = readFindScope(rootRef.current);
      const initialFiles = completeFindFiles(initial?.files);
      const initialMatches = completeFindMatches(initial?.matches);
      const initialCount = initialFiles.length + initialMatches.length;
      const activeElement =
        typeof HTMLElement !== 'undefined' && document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      if (
        document.querySelector('[data-dsh-find-tool-window]') === null &&
        activeElement !== null &&
        activeElement !== document.body
      )
        findToolReturnFocusRef.current = activeElement;
      setTerminalOpen(false);
      setSearchEverywhere(null);
      setFindTool({
        surface: surface === 'dock' ? 'dock' : 'popup',
        ...savedOptions,
        query: draft.query,
        mode: mode === 'replace' ? 'replace' : 'find',
        replace: draft.replace,
        files: initialFiles,
        matches: initialMatches,
        truncated: initial?.truncated === true,
        loading: false,
        error: null,
        index: Math.max(0, Math.min(initialCount - 1, Number(initial?.index) || 0)),
        handoffRevision: ++findToolHandoffSequenceRef.current,
        replaceBusy: false,
        includeExcluded: initial !== null ? initial.includeExcluded === true : savedOptions.includeExcluded === true,
        searchScopeMode: savedScope.mode,
        searchScopePreset: savedScope.preset,
        searchScopeDirectory: savedScope.directory,
        searchScopeRecursive: readFindDirectoryRecursive(rootRef.current),
        searchGeneration: 0,
        loadedGeneration: initial === null || initial?.refresh === true ? -1 : 0,
      });
      /* Monaco restores editor focus after a context-menu action returns.
           Defer past that restoration so the requested Find field wins. */ window.setTimeout(() => {
        const target =
          focusTarget === 'replace'
            ? '[data-dsh-find-replace-input]'
            : '[data-dsh-find-tool-window] input[role="combobox"]';
        document.querySelector<HTMLElement>(target)?.focus?.();
      }, 40);
    },
    [],
  );
  /**
   * 将当前 transient Find 结果集转入 IDEA 的底部持久 Find 工具窗。
   * query、options、scope 与活动结果保持不变，只切换承载 surface。
   * @returns {void}
   */ const openFindToolInDock = React.useCallback(() => {
    setTerminalOpen(false);
    setFindTool((current) => (current === null ? current : { ...current, surface: 'dock' }));
    window.setTimeout(() => {
      document.querySelector<HTMLElement>('[data-dsh-find-tool-window] input[role="combobox"]')?.focus?.();
    }, 0);
  }, []);
  /**
   * IDEA's persistent Find toolbar Settings action.
   *
   * It reopens the same query and options in the configuration popup while
   * preserving the current find/replace mode and result selection.
   * @returns {void}
   */ const openFindToolSettings = React.useCallback(() => {
    setFindTool((current) => (current === null ? current : { ...current, surface: 'popup', mode: current.mode }));
    window.setTimeout(() => {
      document.querySelector<HTMLElement>('[data-dsh-find-tool-window] input[role="combobox"]')?.focus?.();
    }, 0);
  }, []);
  /**
   * Restart the bounded host search when the Find scope changes.
   *
   * Scope is applied before the host's 200-match ceiling, so matches from
   * outside a directory or file preset cannot starve the selected range.
   * @param {{mode?: string, preset?: string, directory?: string}} scope - selected scope.
   * @returns {void}
   */ const changeFindToolScope = React.useCallback((scope: FindToolScope) => {
    const normalized = writeFindScope(rootRef.current, scope);
    const { mode, preset, directory } = normalized;
    setFindTool((current) => {
      if (current === null) return current;
      if (
        current.searchScopeMode === mode &&
        current.searchScopePreset === preset &&
        current.searchScopeDirectory === directory
      )
        return current;
      const hasQuery = hasFindToolContentQuery(current.query);
      return {
        ...current,
        searchScopeMode: mode,
        searchScopePreset: preset,
        searchScopeDirectory: directory,
        files: current.files,
        matches: current.matches,
        index: current.index,
        loading: hasQuery,
        error: null,
        searchGeneration: (current.searchGeneration ?? 0) + 1,
        loadedGeneration: -1,
      };
    });
  }, []);
  /** Persist and reapply IDEA's Directory recursion toggle. */ const changeFindDirectoryRecursive = React.useCallback(
    (recursive: boolean) => {
      const next = writeFindDirectoryRecursive(rootRef.current, recursive);
      setFindTool((current) => {
        if (current === null || current.searchScopeRecursive === next) return current;
        const hasQuery = hasFindToolContentQuery(current.query);
        return {
          ...current,
          searchScopeRecursive: next,
          loading: hasQuery,
          error: null,
          searchGeneration: (current.searchGeneration ?? 0) + 1,
          loadedGeneration: -1,
        };
      });
    },
    [],
  );
  /** Persist local named Scopes and invalidate a selection that disappeared. */ const changeCustomFindScopes =
    React.useCallback((value: unknown) => {
      const normalized = writeCustomFindScopes(rootRef.current, value);
      const sharedScopes = normalized.filter((scope) => scope.shared === true);
      if (sharedScopes.length > 0 || sharedFindScopesRef.current.length > 0) {
        sharedFindScopesRef.current = sharedScopes;
        void callFs({
          op: 'write',
          path: '.idea/scopes/dsh-editor.xml',
          content: serializeIdeaScopeXml(sharedScopes),
          force: true,
          create: true,
        }).catch((failure) => {
          setEditorError(failure instanceof Error ? failure.message : String(failure));
        });
      }
      setCustomFindScopes(normalized);
      setFindTool((current) => {
        if (
          current === null ||
          typeof current.searchScopePreset !== 'string' ||
          !current.searchScopePreset.startsWith('custom:')
        ) {
          return current;
        }
        const id = current.searchScopePreset.slice('custom:'.length);
        if (normalized.some((scope) => scope.id === id)) return current;
        return {
          ...current,
          searchScopePreset: 'projectFiles',
          files: [],
          matches: [],
          index: 0,
          error: null,
          searchGeneration: (current.searchGeneration ?? 0) + 1,
          loadedGeneration: -1,
        };
      });
      return normalized;
    }, []);
  /**
   * Open Replace in Files from the Editor without losing the live scope.
   *
   * A direct shortcut restores the last Find/Replace draft. Editor selection
   * overrides the query, while Directory and other scope settings remain.
   * @returns {void}
   */ const openReplaceInFilesFromEditor = React.useCallback(() => {
    const selectedQuery = selectedEditorFindQuery(currentCodeEditor());
    if (findTool === null) {
      openFindTool(selectedQuery, 'replace', null, 'query', 'popup', true);
      return;
    }
    setTerminalOpen(false);
    setFindTool((current) => {
      if (current === null) return current;
      const query = selectedQuery !== '' ? selectedQuery : current.query;
      const invalidate = query !== current.query;
      return {
        ...current,
        query,
        mode: 'replace',
        surface: 'popup',
        ...(invalidate ? { files: [], matches: [], truncated: false, loading: false, error: null, index: 0 } : null),
        searchGeneration: invalidate ? (current.searchGeneration ?? 0) + 1 : current.searchGeneration,
        loadedGeneration: invalidate ? -1 : current.loadedGeneration,
      };
    });
    window.setTimeout(() => {
      document.querySelector<HTMLElement>('[data-dsh-find-tool-window] input[role="combobox"]')?.focus?.();
    }, 0);
  }, [currentCodeEditor, findTool, openFindTool]);
  /** Cmd/Ctrl+Shift+F opens IDEA's Find in Files; double Shift remains Search Everywhere. */ const openFindInFilesFromShortcut =
    React.useCallback(() => {
      const selectedQuery = selectedEditorFindQuery(currentCodeEditor());
      const hasSelectionQuery = selectedQuery !== '';
      if (findTool !== null) {
        setFindTool((current) =>
          current === null
            ? current
            : {
                ...current,
                query: hasSelectionQuery ? selectedQuery : current.query,
                mode: 'find',
                files: hasSelectionQuery ? [] : current.files,
                matches: hasSelectionQuery ? [] : current.matches,
                truncated: hasSelectionQuery ? false : current.truncated,
                loading: hasSelectionQuery ? false : current.loading,
                error: hasSelectionQuery ? null : current.error,
                index: hasSelectionQuery ? 0 : current.index,
                surface: current.surface === 'dock' ? 'popup' : (current.surface ?? 'popup'),
                searchGeneration: hasSelectionQuery ? (current.searchGeneration ?? 0) + 1 : current.searchGeneration,
                loadedGeneration: hasSelectionQuery ? -1 : current.loadedGeneration,
              },
        );
        window.setTimeout(() => {
          document.querySelector<HTMLElement>('[data-dsh-find-tool-window] input[role="combobox"]')?.focus?.();
        }, 0);
        return;
      }
      openFindTool(selectedQuery, 'find', null, 'query', 'popup', true);
    }, [currentCodeEditor, findTool, openFindTool]);
  /** Toggle the Find dock between its readable minimum and last user height. */
  const toggleFindToolDockMinimized = React.useCallback(() => {
    setFindToolDockMinimized((current) => !current);
  }, []);
  /**
   * Hide the persistent Find tool and return the caret to its opener.
   *
   * Closing from Escape, Hide, or the toolbar overflow unmounts the focused
   * control. Restore the connected opener first; when that surface was
   * transient, focus the active editor or the nearest stable workspace surface.
   * @returns {void}
   */ const closeFindToolWindow = React.useCallback(() => {
    const previous = findToolReturnFocusRef.current;
    findToolReturnFocusRef.current = null;
    setFindToolDockMinimized(false);
    setFindTool(null);
    window.setTimeout(() => {
      if (previous !== null && previous.isConnected) {
        previous.focus();
        return;
      }
      if (currentCodePath() !== null) {
        currentCodeEditor()?.focus?.();
        return;
      }
      focusWorkspaceFallback(document.querySelector<HTMLElement>('[data-dsh-editor-workspace]'));
    }, 0);
  }, [currentCodeEditor, currentCodePath]);
  /**
   * Open IDEA's transient Show Usages popup for one symbol or selection.
   * The popup owns filtering and navigation for this loaded result set;
   * pinning transfers the same rows to the persistent Find tool.
   * @param {string} [query=''] - symbol text to search.
   * @returns {void}
   */ const openShowUsages = React.useCallback(
    (query = '') => {
      const textQuery = typeof query === 'string' ? query.trim() : '';
      if (textQuery === '') return;
      const requestId = ++showUsagesRequestRef.current;
      showUsagesAbortRef.current?.abort();
      const searchAbort = new AbortController();
      showUsagesAbortRef.current = searchAbort;
      setSearchEverywhere(null);
      setShowUsages({
        query: textQuery,
        filter: '',
        matches: [],
        truncated: false,
        loading: true,
        error: null,
        index: 0,
      });
      void callFs<{ matches?: ShowUsagesState['matches']; truncated?: boolean }>(
        {
          op: 'searchText',
          query: textQuery,
          maxMatches: 200,
        },
        { signal: searchAbort.signal },
      )
        .then((value) => {
          if (showUsagesRequestRef.current !== requestId) return;
          setShowUsages((current) =>
            current === null
              ? current
              : {
                  ...current,
                  matches: Array.isArray(value?.matches) ? value.matches : [],
                  truncated: value?.truncated === true,
                  loading: false,
                  error: null,
                },
          );
        })
        .catch((failure) => {
          if (failure?.name === 'AbortError' || failure?.name === 'CanceledError') return;
          if (showUsagesRequestRef.current !== requestId) return;
          setShowUsages((current) =>
            current === null
              ? current
              : {
                  ...current,
                  matches: [],
                  truncated: false,
                  loading: false,
                  error: searchTextFailureMessage(failure, t),
                },
          );
        })
        .finally(() => {
          if (showUsagesAbortRef.current === searchAbort) showUsagesAbortRef.current = null;
        });
    },
    [t],
  );
  const closeShowUsages = React.useCallback(() => {
    showUsagesRequestRef.current += 1;
    showUsagesAbortRef.current?.abort();
    showUsagesAbortRef.current = null;
    setShowUsages(null);
  }, []);
  const pinShowUsages = React.useCallback(() => {
    const current = showUsages;
    if (current === null) return;
    closeShowUsages();
    openFindTool(
      current.query,
      'find',
      {
        files: [],
        matches: current.matches,
        truncated: current.truncated === true,
        index: 0,
      },
      'query',
      'dock',
    );
  }, [closeShowUsages, openFindTool, showUsages]);
  const openFindUsages = React.useCallback(
    (query = '') => {
      const textQuery = typeof query === 'string' ? query.trim() : '';
      if (textQuery === '') return;
      const workspace = rootRef.current;
      if (workspace !== '') {
        setRecentFindUsages((current) => {
          const stored = rememberWorkspaceFindUsagesQuery(workspace, textQuery);
          return stored ?? current;
        });
      }
      openFindTool(textQuery, 'find');
    },
    [openFindTool],
  );
  React.useEffect(() => {
    findUsagesRunnerRef.current = (editor) => {
      const target = findUsagesSearchTarget(editor);
      if (target.query !== '') openFindUsages(target.query);
    };
    return () => {
      findUsagesRunnerRef.current = null;
    };
  }, [openFindUsages]);
  React.useEffect(() => {
    findToolContextRunnerRef.current = (editor, mode) => {
      const target = findUsagesSearchTarget(editor);
      if (target.query === '') return;
      const replace = mode === 'replace';
      openFindTool(target.query, replace ? 'replace' : 'find', null, replace ? 'replace' : 'query');
    };
    return () => {
      findToolContextRunnerRef.current = null;
    };
  }, [openFindTool]);
  React.useEffect(() => {
    if (searchEverywhere !== null) writeSearchOptions(searchEverywhere);
  }, [
    searchEverywhere?.caseSensitive,
    searchEverywhere?.wholeWords,
    searchEverywhere?.regex,
    searchEverywhere?.includeNonProject,
    searchEverywhere?.fileMask,
  ]);
  React.useEffect(() => {
    if (findTool !== null) writeSearchOptions(findTool);
  }, [
    findTool?.caseSensitive,
    findTool?.wholeWords,
    findTool?.regex,
    findTool?.preserveCase,
    findTool?.includeExcluded,
    findTool?.fileMask,
    findTool?.contextFilter,
  ]);
  React.useEffect(() => {
    if (replaceState !== null) writeSearchOptions({ ...readSearchOptions(), ...replaceState });
  }, [replaceState?.caseSensitive, replaceState?.wholeWords, replaceState?.regex, replaceState?.preserveCase]);
  const findToolOpen = findTool !== null;
  const findToolQuery = findToolContentQuery(findTool?.query);
  const findToolSearchScopeMode = findTool?.searchScopeMode ?? 'project';
  const findToolSearchScopePreset = findTool?.searchScopePreset ?? 'projectFiles';
  const findToolCustomScopeId =
    typeof findToolSearchScopePreset === 'string' && findToolSearchScopePreset.startsWith('custom:')
      ? findToolSearchScopePreset.slice('custom:'.length)
      : '';
  const findToolCustomScope =
    findToolSearchScopeMode === 'scope' && findToolCustomScopeId !== ''
      ? (customFindScopes.find((scope) => scope.id === findToolCustomScopeId) ?? null)
      : null;
  const findToolScopeIncludePatterns = findToolCustomScope?.includePatterns ?? [];
  const findToolScopeExcludePatterns = findToolCustomScope?.excludePatterns ?? [];
  const findToolScopePatternsKey = `${findToolScopeIncludePatterns.join('\u0000')}\u0001${findToolScopeExcludePatterns.join('\u0000')}`;
  const findToolAllowedScopePaths =
    findToolSearchScopeMode === 'scope' &&
    (findToolSearchScopePreset === 'currentFile' ||
      findToolSearchScopePreset === 'openFiles' ||
      findToolSearchScopePreset === 'recentlyViewedFiles' ||
      findToolSearchScopePreset === 'changedFiles')
      ? [
          ...new Set(
            (findToolSearchScopePreset === 'currentFile'
              ? [currentCodePath()].filter((path) => typeof path === 'string' && path !== '')
              : findToolSearchScopePreset === 'openFiles'
                ? openFiles.map((file) => file.path)
                : findToolSearchScopePreset === 'recentlyViewedFiles'
                  ? recentFiles
                  : (git?.changes ?? []).map((change) => change.path)
            ).filter((path) => typeof path === 'string' && path !== ''),
          ),
        ]
      : undefined;
  const findToolAllowedScopePathsKey = findToolAllowedScopePaths?.join('\u0000') ?? '';
  const findToolGitScope =
    findToolSearchScopePreset === 'gitTrackedFiles'
      ? 'tracked'
      : findToolSearchScopePreset === 'gitNonIgnoredFiles'
        ? 'nonIgnored'
        : undefined;
  React.useEffect(() => {
    if (!findToolOpen || findToolSearchScopeMode !== 'files') return undefined;
    const includeExcluded = findTool?.includeExcluded === true;
    if (findToolFileCandidatesScope === includeExcluded) return undefined;
    const requestId = ++findToolFileRequestRef.current;
    findToolFileAbortRef.current?.abort();
    const searchAbort = new AbortController();
    findToolFileAbortRef.current = searchAbort;
    setFindTool((current) =>
      current === null || current.searchScopeMode !== 'files' ? current : { ...current, loading: true, error: null },
    );
    void callFs<FileListResponse>({ op: 'files', includeExcluded }, { signal: searchAbort.signal })
      .then((value) => {
        if (findToolFileRequestRef.current !== requestId) return;
        const files = (Array.isArray(value?.files) ? value.files : []).filter(
          (path): path is string => typeof path === 'string' && path !== '',
        );
        setFindToolFileCandidates(files);
        setFindToolFileCandidatesScope(includeExcluded);
        setFindToolFileCandidatesTruncated(value?.truncated === true);
      })
      .catch((failure) => {
        if (failure?.name === 'AbortError' || failure?.name === 'CanceledError') return;
        if (findToolFileRequestRef.current !== requestId) return;
        setFindTool((current) =>
          current === null || current.searchScopeMode !== 'files'
            ? current
            : {
                ...current,
                loading: false,
                error: failure instanceof Error ? failure.message : String(failure),
              },
        );
      })
      .finally(() => {
        if (findToolFileAbortRef.current === searchAbort) findToolFileAbortRef.current = null;
      });
    return () => searchAbort.abort();
  }, [findToolOpen, findToolSearchScopeMode, findTool?.includeExcluded, findToolFileCandidatesScope]);
  React.useEffect(() => {
    if (!findToolOpen || findToolSearchScopeMode !== 'files') return;
    const includeExcluded = findTool?.includeExcluded === true;
    setFindTool((current) => {
      if (
        current === null ||
        current.searchScopeMode !== 'files' ||
        (current.includeExcluded === true) !== includeExcluded
      )
        return current;
      const generation = current.searchGeneration ?? 0;
      if (!hasFindToolContentQuery(current.query)) {
        return {
          ...current,
          files: [],
          matches: [],
          truncated: false,
          loading: false,
          error: null,
          loadedGeneration: generation,
        };
      }
      if (findToolFileCandidatesScope !== includeExcluded) return current;
      const files = findFilePathMatches(findToolFileCandidates, current.query, {
        caseSensitive: current.caseSensitive === true,
        wholeWords: current.wholeWords === true,
        fileMask: current.fileMask,
      }).map((path): FindToolFile => ({ path }));
      return {
        ...current,
        files,
        matches: [],
        truncated: findToolFileCandidatesTruncated,
        loading: false,
        error: null,
        loadedGeneration: generation,
      };
    });
  }, [
    findToolOpen,
    findToolSearchScopeMode,
    findToolQuery,
    findToolFileCandidates,
    findToolFileCandidatesScope,
    findToolFileCandidatesTruncated,
    findTool?.includeExcluded,
    findTool?.caseSensitive,
    findTool?.wholeWords,
    findTool?.fileMask,
  ]);
  React.useEffect(() => {
    if (!findToolOpen || findTool.loadedGeneration === findTool.searchGeneration) return undefined;
    if (findToolSearchScopeMode === 'files') return undefined;
    const generation = findTool.searchGeneration;
    const requestId = ++findToolRequestRef.current;
    const requestRoot = rootRef.current;
    if (!hasFindToolContentQuery(findToolQuery)) {
      setFindTool((current) =>
        current === null
          ? current
          : {
              ...current,
              files: [],
              matches: [],
              truncated: false,
              loading: false,
              loadedGeneration: generation,
            },
      );
      return undefined;
    }
    setFindTool((current) => (current === null ? current : { ...current, loading: true, error: null }));
    const searchAbort = new AbortController();
    const timer = window.setTimeout(() => {
      const dirtyFiles = (openFilesRef.current ?? []).filter(
        (file) => file.dirty === true && typeof file.content === 'string',
      );
      void callFs<TextSearchResponse>(
        {
          op: 'searchText',
          query: findToolQuery,
          maxMatches: 200,
          caseSensitive: findTool?.caseSensitive === true ? true : undefined,
          wholeWords: findTool?.wholeWords === true,
          regex: findTool?.regex === true,
          includeExcluded: findTool?.includeExcluded === true,
          fileMask: normalizeFileExtensionFilter(findTool?.fileMask),
          contextFilter: normalizeTextSearchContextFilter(findTool?.contextFilter),
          scopeIncludePatterns: findToolScopeIncludePatterns,
          scopeExcludePatterns: findToolScopeExcludePatterns,
          directory: findTool?.searchScopeMode === 'directory' ? (findTool.searchScopeDirectory ?? '') : '',
          recursive: findTool?.searchScopeMode === 'directory' ? findTool?.searchScopeRecursive !== false : true,
          allowedPaths:
            findTool?.searchScopeMode === 'scope' && findTool?.searchScopePreset !== 'projectFiles'
              ? findToolAllowedScopePaths
              : undefined,
          gitScope: findToolGitScope,
          dirtyPaths: dirtyFiles.map((file) => file.path),
        },
        { signal: searchAbort.signal },
      )
        .then((value) => {
          if (!findToolRequestIsCurrent(requestId, requestRoot, findToolRequestRef.current, rootRef.current)) return;
          const hostMatches = Array.isArray(value?.matches) ? value.matches : [];
          const eligibleDirtyPaths = Array.isArray(value?.dirtyPaths) ? new Set(value.dirtyPaths) : null;
          const mergeDirtyFiles =
            eligibleDirtyPaths === null ? dirtyFiles : dirtyFiles.filter((file) => eligibleDirtyPaths.has(file.path));
          const merged = mergeFindToolDirtyMatches(
            hostMatches,
            mergeDirtyFiles,
            findToolQuery,
            {
              caseSensitive: findTool?.caseSensitive === true,
              wholeWords: findTool?.wholeWords === true,
              regex: findTool?.regex === true,
              fileMask: findTool?.fileMask,
              contextFilter: normalizeTextSearchContextFilter(findTool?.contextFilter),
              customScope: findToolCustomScope,
            },
            {
              mode: findToolSearchScopeMode,
              directory: findTool?.searchScopeDirectory ?? '',
              preset: findToolSearchScopePreset,
              recursive: findTool?.searchScopeRecursive !== false,
              allowedPaths: Array.isArray(findToolAllowedScopePaths) ? (findToolAllowedScopePaths as string[]) : null,
            },
            200,
          );
          setFindTool((current) =>
            current === null
              ? current
              : {
                  ...current,
                  matches: completeSearchMatches(merged.matches),
                  truncated: value?.truncated === true || merged.truncated,
                  loading: false,
                  loadedGeneration: generation,
                  error: null,
                },
          );
          rememberCurrentFindQuery(findToolQuery);
        })
        .catch((failure) => {
          if (failure?.name === 'AbortError' || failure?.name === 'CanceledError') return;
          if (!findToolRequestIsCurrent(requestId, requestRoot, findToolRequestRef.current, rootRef.current)) return;
          setFindTool((current) =>
            current === null
              ? current
              : {
                  ...current,
                  truncated: false,
                  loading: false,
                  loadedGeneration: generation,
                  error: searchTextFailureMessage(failure, t),
                },
          );
        });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      searchAbort.abort();
    };
  }, [
    findToolOpen,
    findToolQuery,
    root,
    findTool?.searchGeneration,
    findTool?.loadedGeneration,
    findTool?.caseSensitive,
    findTool?.wholeWords,
    findTool?.regex,
    findTool?.fileMask,
    findTool?.contextFilter,
    findToolScopePatternsKey,
    findToolSearchScopeMode,
    findToolSearchScopePreset,
    findTool?.searchScopeDirectory,
    findTool?.searchScopeRecursive,
    findToolAllowedScopePathsKey,
    findToolGitScope,
    openFiles,
    recentFiles,
    rememberCurrentFindQuery,
    t,
  ]);
  /* IDEA's Find Action chord opens Search Everywhere in Actions mode.
         Existing focused controls keep their own shortcut semantics. */ React.useEffect(() => {
    const findActionGlobalShortcut = (event: KeyboardEvent) => {
      const macPlatform = isMacPlatform(navigator.userAgentData?.platform ?? navigator.platform);
      if (!findActionShortcutMatches(event, macPlatform)) return;
      if (searchEverywhereOpen) return;
      const host = document.querySelector<HTMLElement>('[data-dsh-editor-workspace]');
      if (host === null || !host.contains(document.activeElement)) return;
      const shortcutTarget = event.target instanceof Element ? event.target : null;
      const shortcutActive = document.activeElement instanceof Element ? document.activeElement : null;
      if (findActionShortcutBlockedByChildContext(shortcutTarget, shortcutActive)) return;
      event.preventDefault();
      event.stopPropagation();
      openSearchEverywhere('actions');
      window.setTimeout(() => document.querySelector<HTMLElement>('[data-dsh-search-query]')?.focus?.(), 0);
    };
    window.addEventListener('keydown', findActionGlobalShortcut, true);
    return () => window.removeEventListener('keydown', findActionGlobalShortcut, true);
  }, [openSearchEverywhere, searchEverywhereOpen]);
  /* IDEA reserves double Shift for Search Everywhere. Cmd/Ctrl+Shift+F remains
         a separate Find in Files gesture handled by the editor search family. */ React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (visibleEditorWorkspace(document) === null) {
        doubleShiftAtRef.current = 0;
        return;
      }
      const next = doubleShiftAction(doubleShiftAtRef.current, event, performance.now());
      doubleShiftAtRef.current = next.lastAt;
      if (!next.open) return;
      event.preventDefault();
      event.stopPropagation();
      openSearchEverywhere('all');
      window.setTimeout(() => document.querySelector<HTMLElement>('[data-dsh-search-query]')?.focus?.(), 0);
    };
    const resetGesture = () => {
      doubleShiftAtRef.current = 0;
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('blur', resetGesture);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('blur', resetGesture);
    };
  }, [openSearchEverywhere]);
  const cancelWorkspaceSearchRequests = React.useCallback(() => {
    searchEverywhereFilesRequestRef.current += 1;
    searchEverywhereFilesAbortRef.current?.abort();
    searchEverywhereFilesAbortRef.current = null;
    quickOpenFilesRequestRef.current += 1;
    quickOpenFilesAbortRef.current?.abort();
    quickOpenFilesAbortRef.current = null;
    revisionPickerRequestRef.current += 1;
    revisionPickerAbortRef.current?.abort();
    revisionPickerAbortRef.current = null;
    moveToRequestRef.current += 1;
    moveToAbortRef.current?.abort();
    moveToAbortRef.current = null;
    branchMenuRequestRef.current += 1;
    commitMenuRequestRef.current += 1;
    showUsagesRequestRef.current += 1;
    showUsagesAbortRef.current?.abort();
    showUsagesAbortRef.current = null;
    findToolRequestRef.current += 1;
    findToolFileRequestRef.current += 1;
    findToolFileAbortRef.current?.abort();
    findToolFileAbortRef.current = null;
  }, []);
  const previousWorkspaceSearchRootRef = React.useRef(root);
  React.useEffect(() => {
    const previousWorkspaceRoot = previousWorkspaceSearchRootRef.current;
    previousWorkspaceSearchRootRef.current = root;
    if (workspaceSearchSurfacesShouldReset(previousWorkspaceRoot, root)) {
      cancelWorkspaceSearchRequests();
      setFindToolFileCandidates([]);
      setFindToolFileCandidatesScope(null);
      setFindToolFileCandidatesTruncated(false);
      searchEverywhereFilesRef.current = [];
      searchEverywhereFilesScopeRef.current = null;
      setSearchEverywhere(null);
      setShowUsages(null);
      setFindTool(null);
      setFindReplaceUndoStack([]);
      setFindReplaceRedoStack([]);
    }
    setRecentSearches(root === '' ? [] : readSearchHistory(root));
    setRecentFindQueries(root === '' ? [] : readFindQueryHistory(root));
    setRecentFindUsages(root === '' ? [] : readFindUsagesHistory(root));
    setRecentReplacements(root === '' ? [] : readReplaceHistory(root));
  }, [cancelWorkspaceSearchRequests, root]);
  React.useEffect(() => {
    return () => cancelWorkspaceSearchRequests();
  }, [cancelWorkspaceSearchRequests]);
  /* Local Scopes live in browser storage; Shared Scopes are loaded only
         from the explicit dsh-editor scope file inside the workspace. */ React.useEffect(() => {
    const localScopes = root === '' ? [] : readCustomFindScopes(root);
    sharedFindScopesRef.current = [];
    setCustomFindScopes(localScopes);
    if (root === '') return undefined;
    let cancelled = false;
    void callFs({ op: 'read', path: '.idea/scopes/dsh-editor.xml' })
      .then((value) => {
        if (cancelled) return;
        const sharedScopes = parseIdeaScopeXml(value?.content);
        sharedFindScopesRef.current = sharedScopes;
        setCustomFindScopes([...localScopes, ...sharedScopes]);
      })
      .catch(() => {
        /* A workspace without shared Scopes is the normal case. */
      });
    return () => {
      cancelled = true;
    };
  }, [root]);
  /**
   * ⌘E — IDEA's Recent Files.
   *
   * The list is the MRU for this workspace, newest first, and it is shown
   * WITHOUT a filesystem walk: a recent-file popup that waits for a disk scan
   * before it can render defeats the point. Files that no longer exist are
   * still listed (IDEA keeps them); opening one reports the failure in the
   * usual status line instead of the row silently doing nothing.
   * @returns {void}
   */ const openRecent = React.useCallback(() => {
    if (rootRef.current === '') return;
    rememberQuickOpenOrigin();
    setPaletteMode('recent');
    /* Read through the ref: the keydown handler closes over an older render. */ const list = readRecentFiles(
      rootRef.current,
    );
    setRecentFiles(list);
    setQuickOpen({ query: '', index: 0, files: list, loading: false });
  }, [rememberQuickOpenOrigin]);
  const closeQuickOpen = React.useCallback(() => {
    const previous = quickOpenReturnFocusRef.current;
    quickOpenReturnFocusRef.current = null;
    quickOpenFilesRequestRef.current += 1;
    quickOpenFilesAbortRef.current?.abort();
    quickOpenFilesAbortRef.current = null;
    setQuickOpen(null);
    window.setTimeout(() => {
      if (previous !== null && previous.isConnected) {
        previous.focus();
        return;
      }
      if (currentCodePath() !== null) {
        currentCodeEditor()?.focus?.();
        return;
      }
      focusWorkspaceFallback(document.querySelector<HTMLElement>('[data-dsh-editor-workspace]'));
    }, 0);
  }, [currentCodeEditor, currentCodePath]);
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta || event.altKey) return;
      if (event.key.toLowerCase() !== 'e') return;
      const host = document.querySelector<HTMLElement>('[data-dsh-editor-workspace]');
      if (host === null || !document.body.contains(host)) return;
      event.preventDefault();
      event.stopPropagation();
      openRecent();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [openRecent]);
  const openEditorFind = React.useCallback(
    (
      withReplace = false,
      initialQuery: string | null = null,
      focusTarget: 'query' | 'replace' = 'query',
      scopeOverride: EditorFindState['scope'] | undefined = undefined,
    ) => {
      const savedOptions = readSearchOptions();
      const editor = currentCodeEditor();
      const model = editor?.getModel?.() ?? null;
      const requestedFind = typeof initialQuery === 'string' ? initialQuery.trim() : '';
      const hasExplicitQuery = typeof initialQuery === 'string';
      setReplaceState((current) => {
        const base = current ?? {
          find: '',
          replace: '',
          index: 0,
          total: 0,
          withReplace: false,
          caseSensitive: savedOptions.caseSensitive,
          wholeWords: savedOptions.wholeWords,
          regex: savedOptions.regex,
          preserveCase: savedOptions.preserveCase,
          scope: null,
          error: null,
        };
        const find = hasExplicitQuery ? requestedFind : base.find;
        const scope = scopeOverride === undefined ? (hasExplicitQuery ? null : (base.scope ?? null)) : scopeOverride;
        const result: EditorFindMatches =
          model !== null && find !== ''
            ? editorFindResult(model.getValue(), find, { ...base, scope })
            : { matches: [], error: null };
        return {
          ...base,
          find,
          withReplace,
          scope,
          total: result.matches.length,
          error: result.error,
          index: hasExplicitQuery ? 0 : Math.min(base.index, Math.max(0, result.matches.length - 1)),
        };
      });
      /* Monaco restores editor focus after a context-menu action returns.
           Defer past that restoration so the editor Find query wins. */ window.setTimeout(() => {
        const selector =
          focusTarget === 'replace' ? '[data-dsh-editor-find-replace-input]' : '[data-dsh-editor-find-input]';
        document.querySelector<HTMLElement>(selector)?.focus?.();
      }, 40);
    },
    [currentCodeEditor],
  );
  React.useEffect(() => {
    editorFindContextRunnerRef.current = (editor, withReplace = false, focusTarget = 'query') => {
      const target = findUsagesSearchTarget(editor);
      if (target.query !== '') openEditorFind(withReplace, target.query, focusTarget);
    };
    return () => {
      editorFindContextRunnerRef.current = null;
    };
  }, [openEditorFind]);
  const openEditorFindInSelection = React.useCallback(
    (
      scope: { start: number; end: number } | null,
      withReplace: boolean | null = null,
      initialQuery: string | null = null,
      focusTarget: 'query' | 'replace' | null = null,
    ) => {
      const editor = currentCodeEditor();
      const model = editor?.getModel?.() ?? null;
      if (model === null || scope === null) return;
      const savedOptions = readSearchOptions();
      const requestedFind = typeof initialQuery === 'string' ? initialQuery.trim() : '';
      const hasExplicitQuery = typeof initialQuery === 'string';
      setReplaceState((current) => {
        const base = current ?? {
          find: '',
          replace: '',
          index: 0,
          total: 0,
          withReplace: false,
          caseSensitive: savedOptions.caseSensitive,
          wholeWords: savedOptions.wholeWords,
          regex: savedOptions.regex,
          preserveCase: savedOptions.preserveCase,
          scope: null,
          error: null,
        };
        const nextScope = { start: scope.start, end: scope.end };
        const find = hasExplicitQuery ? requestedFind : base.find;
        const result: EditorFindMatches =
          find === ''
            ? { matches: [], error: null }
            : editorFindResult(model.getValue(), find, {
                ...base,
                scope: nextScope,
              });
        return {
          ...base,
          find,
          withReplace: withReplace === null ? base.withReplace === true : withReplace === true,
          scope: nextScope,
          total: result.matches.length,
          error: result.error,
          index: hasExplicitQuery ? 0 : Math.min(base.index, Math.max(0, result.matches.length - 1)),
        };
      });
      if (focusTarget !== null) {
        window.setTimeout(() => {
          const selector =
            focusTarget === 'replace' ? '[data-dsh-editor-find-replace-input]' : '[data-dsh-editor-find-input]';
          document.querySelector<HTMLElement>(selector)?.focus?.();
        }, 40);
      }
    },
    [currentCodeEditor],
  );
  const openEditorFindFromShortcut = React.useCallback(
    (withReplace = false, focusTarget: 'query' | 'replace' = 'query') => {
      const editor = currentCodeEditor();
      const request = editorFindKeyboardRequest(editor);
      if (request.scope === null) {
        openEditorFind(withReplace, null, focusTarget, null);
        return;
      }
      openEditorFindInSelection(request.scope, withReplace, request.query, focusTarget);
    },
    [currentCodeEditor, openEditorFind, openEditorFindInSelection],
  );
  React.useEffect(() => {
    selectionFindContextRunnerRef.current = (editor, withReplace = false, focusTarget = 'query') => {
      const scope = editorFindSelectionScope(editor);
      const target = findUsagesSearchTarget(editor);
      if (scope === null || target.query === '') return;
      openEditorFindInSelection(scope, withReplace, target.query, focusTarget);
    };
    return () => {
      selectionFindContextRunnerRef.current = null;
    };
  }, [openEditorFindInSelection]);
  /* IDEA's editor search family: ⌘F Find, ⌘R Replace,
         ⇧⌘F Find in Files and ⇧⌘R Replace in Files. The legacy
         ⌥⌘F replace alias stays available. */ React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const usageFamilyAction = ideaUsageFamilyShortcutAction(
        event,
        isMacPlatform(navigator.userAgentData?.platform ?? navigator.platform),
      );
      if (usageFamilyAction !== null) {
        const target = event.target instanceof Element ? event.target : null;
        const active = document.activeElement instanceof Element ? document.activeElement : null;
        const monacoTarget = target?.closest('.monaco-editor') ?? active?.closest('.monaco-editor');
        if (monacoTarget == null || monacoTarget.closest('[data-dsh-editor-file-surface]') == null) return;
        const host = document.querySelector<HTMLElement>('[data-dsh-editor-workspace]');
        if (host === null || !host.contains(document.activeElement)) return;
        const request = findUsagesSearchTarget(currentCodeEditor());
        if (request.query === '') return;
        if (usageFamilyAction === 'findUsagesSettings') return;
        event.preventDefault();
        event.stopPropagation();
        if (usageFamilyAction === 'findUsages') openFindUsages(request.query);
        else if (usageFamilyAction === 'showUsages') openShowUsages(request.query);
        return;
      }
      const findStepDirection = ideaFindStepShortcutAction(
        event,
        isMacPlatform(navigator.userAgentData?.platform ?? navigator.platform),
      );
      if (findStepDirection !== 0) {
        const host = document.querySelector<HTMLElement>('[data-dsh-editor-workspace]');
        if (host === null || !host.contains(document.activeElement)) return;
        if (editorFindQueryActiveRef.current !== true) return;
        const target = event.target instanceof Element ? event.target : null;
        const active = document.activeElement instanceof Element ? document.activeElement : null;
        const blocked =
          '[data-dsh-editor-terminal], [role="tree"], [data-dsh-changes-panel], ' +
          '[data-dsh-log-panel], [data-dsh-find-tool-window], [data-dsh-editor-diff-surface]';
        if (target?.closest(blocked) != null || active?.closest(blocked) != null) return;
        const editable =
          target?.closest('input, textarea, [contenteditable="true"]') ??
          active?.closest('input, textarea, [contenteditable="true"]');
        if (
          editable != null &&
          editable.closest(
            '[data-dsh-search-everywhere], [data-dsh-editor-find-input], ' +
              '[data-dsh-editor-find-replace-input], .monaco-editor',
          ) == null
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        const fromSearchEverywhere = searchEverywhereOpen;
        if (fromSearchEverywhere) setSearchEverywhere(null);
        editorFindStepRef.current?.(findStepDirection);
        if (fromSearchEverywhere) {
          window.setTimeout(() => currentCodeEditor()?.focus?.(), 0);
        }
        return;
      }
      const key = event.key.toLowerCase();
      const macMultipleCaretShortcut =
        isMacPlatform(navigator.userAgentData?.platform ?? navigator.platform) &&
        key === 'g' &&
        event.ctrlKey === true &&
        event.altKey !== true;
      /* IDEA's macOS keymap reserves Control+G for multiple-caret selection;
             the dedicated listener below owns those chords. */ if (macMultipleCaretShortcut) return;
      const meta = event.metaKey || event.ctrlKey;
      if (!meta) return;
      if (searchEverywhereOpen && key === 'r') return;
      if (key !== 'f' && key !== 'r' && key !== 'g') return;
      if (key === 'f' && event.shiftKey) {
        if (visibleEditorWorkspace(document) === null) return;
        event.preventDefault();
        event.stopPropagation();
        openFindInFilesFromShortcut();
        return;
      }
      const host = document.querySelector<HTMLElement>('[data-dsh-editor-workspace]');
      if (host === null || !host.contains(document.activeElement)) return;
      if (event.target instanceof Element && event.target.closest('[data-dsh-editor-diff-surface]') !== null) return;
      if (document.activeElement?.closest('[data-dsh-editor-diff-surface]') != null) return;
      if (key === 'r' && event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        openReplaceInFilesFromEditor();
        return;
      }
      /* The terminal dock owns ⌘F inside its own screen. */ if (
        document.activeElement?.closest('[data-dsh-editor-terminal]') !== null &&
        document.activeElement?.closest('[data-dsh-editor-terminal]') !== undefined
      )
        return;
      /* So does the Project tree: ⌘F there is the tree's speed search. */ if (
        event.target instanceof Element &&
        event.target.closest('[role="tree"]') !== null
      )
        return;
      if (document.activeElement?.closest('[role="tree"]') != null) return;
      /* Commit Changes owns ⌘F for its path filter. */ if (
        event.target instanceof Element &&
        event.target.closest('[data-dsh-changes-panel]') !== null
      )
        return;
      if (document.activeElement?.closest('[data-dsh-changes-panel]') != null) return;
      /* Commit Log owns its IDEA shortcuts: ⌘L filter and ⌘F Find in Files. */ if (
        event.target instanceof Element &&
        event.target.closest('[data-dsh-log-panel]') !== null
      )
        return;
      if (document.activeElement?.closest('[data-dsh-log-panel]') != null) return;
      /* The persistent Find tool owns its own search/replace fields. */ if (
        event.target instanceof Element &&
        event.target.closest('[data-dsh-find-tool-window]') !== null
      )
        return;
      if (document.activeElement?.closest('[data-dsh-find-tool-window]') != null) return;
      if (key === 'g') {
        event.preventDefault();
        event.stopPropagation();
        const fromSearchEverywhere = searchEverywhereOpen;
        if (fromSearchEverywhere) setSearchEverywhere(null);
        editorFindStepRef.current?.(event.shiftKey ? -1 : 1);
        if (fromSearchEverywhere) {
          window.setTimeout(() => currentCodeEditor()?.focus?.(), 0);
        }
        return;
      }
      if (searchEverywhereOpen && key === 'f' && !event.shiftKey) setSearchEverywhere(null);
      event.preventDefault();
      if (key === 'r') {
        openEditorFindFromShortcut(true, 'replace');
        return;
      }
      openEditorFindFromShortcut(event.altKey);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [
    openReplaceInFilesFromEditor,
    openEditorFindFromShortcut,
    openFindInFilesFromShortcut,
    openFindTool,
    openFindUsages,
    openShowUsages,
    searchEverywhereOpen,
    currentCodeEditor,
  ]);
  const closeSearchEverywhere = React.useCallback(() => {
    searchEverywhereFilesRequestRef.current += 1;
    searchEverywhereFilesAbortRef.current?.abort();
    searchEverywhereReturnFocusRef.current = null;
    setSearchEverywhere(null);
  }, []);
  const dismissSearchEverywhere = React.useCallback(() => {
    searchEverywhereFilesRequestRef.current += 1;
    searchEverywhereFilesAbortRef.current?.abort();
    const previous = searchEverywhereReturnFocusRef.current;
    searchEverywhereReturnFocusRef.current = null;
    setSearchEverywhere(null);
    window.setTimeout(() => {
      if (previous !== null && previous.isConnected) previous.focus();
      else currentCodeEditor()?.focus?.();
    }, 0);
  }, [currentCodeEditor]);
  const rememberSearchEverywhereQuery = React.useCallback((query: string) => {
    const workspace = rootRef.current;
    if (workspace === '') return;
    const normalizedQuery = normalizeRecentSearchEntry(query);
    if (normalizedQuery === '') return;
    setRecentSearches((current) => {
      const next = rememberSearchHistory(current, normalizedQuery, 20);
      writeSearchHistory(workspace, next);
      return next;
    });
  }, []);
  const rememberSearchEverywhereCommand = React.useCallback((id: string) => {
    setRecentCommands((current) => {
      const next = rememberCommandHistory(current, id, 12);
      writeCommandHistory(next);
      return next;
    });
  }, []);
  const activeSourceEditor = currentCodeEditor();
  const editorModel = activeSourceEditor?.getModel?.() ?? null;
  const hasEditorModel = editorModel !== null;
  const findUsagesTarget = findUsagesSearchTarget(activeSourceEditor);
  const selectionScope = editorFindSelectionScope(activeSourceEditor);
  const hasSelectionScope = selectionScope !== null;
  const searchPlatform = navigator.userAgentData?.platform ?? navigator.platform;
  const searchMacPlatform = isMacPlatform(searchPlatform);
  const runWordOccurrence = React.useCallback(
    (command: string) => {
      closeSearchEverywhere();
      if (activeSourceEditor === null) return;
      window.setTimeout(() => {
        void Promise.resolve(activeSourceEditor.getAction?.(command)?.run?.()).finally(() =>
          activeSourceEditor.focus?.(),
        );
      }, 0);
    },
    [activeSourceEditor, closeSearchEverywhere],
  );
  React.useEffect(() => {
    const platform = navigator.userAgentData?.platform ?? navigator.platform;
    if (!isMacPlatform(platform)) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'g' || event.ctrlKey !== true || event.altKey === true) return;
      const host = document.querySelector<HTMLElement>('[data-dsh-editor-workspace]');
      if (host === null || !host.contains(document.activeElement)) return;
      const command =
        event.metaKey === true && event.shiftKey !== true
          ? 'editor.action.selectHighlights'
          : event.metaKey !== true && event.shiftKey === true
            ? 'cursorUndo'
            : event.metaKey !== true && event.shiftKey !== true
              ? 'editor.action.addSelectionToNextFindMatch'
              : null;
      if (command === null) return;
      event.preventDefault();
      event.stopPropagation();
      runWordOccurrence(command);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [runWordOccurrence]);
  /* Show Usages has its own transient popup with local filtering and an
         explicit pin-to-Find handoff; it remains separate from Find Usages. */ const searchEverywhereActions =
    React.useMemo(
      () => [
        {
          id: 'searchEverywhere',
          icon: 'search',
          label: t('editor.searchEverywhereAction'),
          description: t('editor.searchEverywhereActionHint'),
          keepOpen: true,
          rememberQuery: false,
          run: () => {
            openSearchEverywhere('all');
            window.setTimeout(() => document.querySelector<HTMLElement>('[data-dsh-search-query]')?.focus?.(), 0);
          },
        },
        {
          id: 'goToFile',
          icon: 'file',
          label: t('editor.gotoFile'),
          description: t('editor.gotoFileHint'),
          shortcut: '⌘⇧O',
          run: () => {
            closeSearchEverywhere();
            void openQuickOpen();
          },
        },
        {
          id: 'recentFiles',
          icon: 'history',
          label: t('editor.recentFiles'),
          description: t('editor.recentFilesHint'),
          shortcut: '⌘E',
          run: () => {
            closeSearchEverywhere();
            openRecent();
          },
        },
        {
          id: 'textSearch',
          icon: 'search',
          label: t('editor.textSearchAction'),
          description: t('editor.textSearchHint'),
          shortcut: '⌃⇧⌥E',
          keepOpen: true,
          rememberQuery: false,
          run: () => {
            setSearchEverywhere((current) => {
              if (current === null) return current;
              return {
                ...current,
                query: current.query,
                tab: 'text',
                index: 0,
              };
            });
            window.setTimeout(() => document.querySelector<HTMLElement>('[data-dsh-search-query]')?.focus?.(), 0);
          },
        },
        {
          id: 'findAction',
          icon: 'settings',
          label: t('editor.findActionAction'),
          description: t('editor.findActionHint'),
          shortcut: '⇧⌘A',
          keepOpen: true,
          rememberQuery: false,
          run: () => {
            setSearchEverywhere((current) =>
              current === null ? current : { ...current, query: '', tab: 'actions', index: 0 },
            );
            window.setTimeout(() => document.querySelector<HTMLElement>('[data-dsh-search-query]')?.focus?.(), 0);
          },
        },
        {
          id: 'showSearchHistory',
          icon: 'history',
          label: t('editor.showSearchHistoryAction'),
          description: t('editor.showSearchHistoryHint'),
          shortcut: '⌥↓',
          keepOpen: true,
          rememberQuery: false,
          run: () => {
            setSearchEverywhere((current) => (current === null ? current : { ...current, tab: 'all', index: 0 }));
            setSearchHistoryRequest((current) => current + 1);
          },
        },
        {
          id: 'recentFindUsages',
          icon: 'history',
          label: t('editor.recentFindUsagesAction'),
          description: t('editor.recentFindUsagesHint'),
          keepOpen: true,
          rememberQuery: false,
          run: () => setFindUsagesHistoryRequest((current) => current + 1),
        },
        {
          id: 'find',
          icon: 'search',
          label: t('editor.findAction'),
          description: t('editor.find'),
          shortcut: '⌘F',
          disabled: !hasEditorModel,
          disabledReason: t('editor.findEditorRequired'),
          run: () => {
            closeSearchEverywhere();
            openEditorFind(false);
          },
        },
        {
          id: 'findToolWindow',
          icon: 'search',
          label: t('editor.findToolWindowAction'),
          description: t('editor.findToolWindowHint'),
          keywords: t('editor.findToolWindowSynonym'),
          rememberQuery: false,
          run: () => {
            closeSearchEverywhere();
            openFindTool('', 'find', null, 'query', 'dock');
          },
        },
        {
          id: 'replace',
          icon: 'code',
          label: t('editor.replaceAction'),
          description: t('editor.replace'),
          shortcut: '⌘R',
          disabled: !hasEditorModel,
          disabledReason: t('editor.findEditorRequired'),
          run: () => {
            closeSearchEverywhere();
            openEditorFind(true);
          },
        },
        {
          id: 'structuralSearch',
          icon: 'search',
          label: t('editor.structuralSearchAction'),
          description: t('editor.structuralSearchHint'),
          keywords: t('editor.structuralSearchSynonym'),
          rememberQuery: false,
          disabled: true,
          disabledReason: t('editor.structuralSearchUnavailable'),
          run: () => {},
        },
        {
          id: 'structuralReplace',
          icon: 'code',
          label: t('editor.structuralReplaceAction'),
          description: t('editor.structuralReplaceHint'),
          keywords: t('editor.structuralReplaceSynonym'),
          rememberQuery: false,
          disabled: true,
          disabledReason: t('editor.structuralSearchUnavailable'),
          run: () => {},
        },
        {
          id: 'incrementalSearch',
          icon: 'search',
          label: t('editor.incrementalSearchAction'),
          description: t('editor.incrementalSearchHint'),
          rememberQuery: false,
          disabled: !hasEditorModel,
          disabledReason: t('editor.findEditorRequired'),
          run: () => {
            closeSearchEverywhere();
            openEditorFind(false, findUsagesTarget.query);
          },
        },
        {
          id: 'searchInSelectionOnly',
          icon: 'target',
          label: t('editor.searchInSelectionOnly'),
          description: t('editor.searchInSelectionOnly'),
          shortcut: '⌃⌥E',
          keywords: t('editor.toggleFindInSelectionSynonym'),
          rememberQuery: false,
          disabled: !hasSelectionScope,
          disabledReason: hasEditorModel ? t('editor.findSelectionRequired') : t('editor.findEditorRequired'),
          run: () => {
            closeSearchEverywhere();
            openEditorFindInSelection(selectionScope);
          },
        },
        {
          id: 'replaceInSelectionOnly',
          icon: 'code',
          label: t('editor.replaceInSelectionOnly'),
          description: t('editor.replaceInSelectionOnly'),
          rememberQuery: false,
          disabled: !hasSelectionScope,
          disabledReason: hasEditorModel ? t('editor.findSelectionRequired') : t('editor.findEditorRequired'),
          run: () => {
            closeSearchEverywhere();
            openEditorFindInSelection(selectionScope, true);
          },
        },
        {
          id: 'findSelectionInFiles',
          icon: 'search',
          label: t('editor.findSelectionInFilesAction'),
          description: t('editor.findSelectionInFilesHint'),
          keywords: t('editor.findSelectionInFilesSynonym'),
          rememberQuery: false,
          disabled: findUsagesTarget.query === '',
          disabledReason:
            findUsagesTarget.reason === 'editor'
              ? t('editor.findEditorRequired')
              : t('editor.findUsagesSymbolRequired'),
          run: () => openFindTool(findUsagesTarget.query, 'find'),
        },
        {
          id: 'replaceSelectionInFiles',
          icon: 'code',
          label: t('editor.replaceSelectionInFilesAction'),
          description: t('editor.replaceSelectionInFilesHint'),
          rememberQuery: false,
          disabled: findUsagesTarget.query === '',
          disabledReason:
            findUsagesTarget.reason === 'editor'
              ? t('editor.findEditorRequired')
              : t('editor.findUsagesSymbolRequired'),
          run: () => openFindTool(findUsagesTarget.query, 'replace', null, 'replace'),
        },
        {
          id: 'findUsages',
          icon: 'search',
          label: t('editor.findUsagesAction'),
          description: t('editor.findUsagesHint'),
          shortcut: ideaUsageFamilyShortcut('findUsages', searchMacPlatform),
          disabled: findUsagesTarget.query === '',
          disabledReason:
            findUsagesTarget.reason === 'editor'
              ? t('editor.findEditorRequired')
              : t('editor.findUsagesSymbolRequired'),
          run: () => openFindUsages(findUsagesTarget.query),
        },
        {
          id: 'showUsages',
          icon: 'findWindow',
          label: t('editor.showUsagesAction'),
          description: t('editor.showUsagesHint'),
          shortcut: ideaUsageFamilyShortcut('showUsages', searchMacPlatform),
          disabled: findUsagesTarget.query === '',
          disabledReason:
            findUsagesTarget.reason === 'editor'
              ? t('editor.findEditorRequired')
              : t('editor.findUsagesSymbolRequired'),
          run: () => {
            closeSearchEverywhere();
            openShowUsages(findUsagesTarget.query);
          },
        },
        {
          id: 'findUsagesSettings',
          icon: 'settings',
          label: t('editor.findUsagesSettingsAction'),
          description: t('editor.findUsagesSettingsHint'),
          shortcut: ideaUsageFamilyShortcut('findUsagesSettings', searchMacPlatform),
          keywords: t('editor.findUsagesSettingsSynonym'),
          disabled: true,
          disabledReason: t('editor.findUsagesSettingsUnavailable'),
          run: () => {},
        },
        {
          id: 'findUsagesInFile',
          icon: 'search',
          label: t('editor.findUsagesInFileAction'),
          description: t('editor.findUsagesInFileHint'),
          shortcut: '⌘F7',
          disabled: findUsagesTarget.query === '',
          disabledReason:
            findUsagesTarget.reason === 'editor'
              ? t('editor.findEditorRequired')
              : t('editor.findUsagesSymbolRequired'),
          run: () => {
            closeSearchEverywhere();
            openEditorFind(false, findUsagesTarget.query);
          },
        },
        {
          id: 'highlightUsagesInFile',
          icon: 'search',
          label: t('editor.highlightUsagesInFileAction'),
          description: t('editor.highlightUsagesInFileHint'),
          shortcut: '⇧⌘F7',
          rememberQuery: false,
          disabled: findUsagesTarget.query === '',
          disabledReason:
            findUsagesTarget.reason === 'editor'
              ? t('editor.findEditorRequired')
              : t('editor.findUsagesSymbolRequired'),
          run: () => {
            closeSearchEverywhere();
            if (activeSourceEditor === null) return;
            window.setTimeout(() => {
              activeSourceEditor.focus?.();
              void Promise.resolve(
                activeSourceEditor.getAction?.('editor.action.wordHighlight.trigger')?.run?.(),
              ).finally(() => activeSourceEditor.focus?.());
            }, 0);
          },
        },
        {
          id: 'searchWeb',
          icon: 'search',
          label: t('editor.searchWebAction'),
          description: t('editor.searchWebHint'),
          keywords: t('editor.searchWebSynonym'),
          disabled: findUsagesTarget.query === '',
          disabledReason:
            findUsagesTarget.reason === 'editor'
              ? t('editor.findEditorRequired')
              : t('editor.findUsagesSymbolRequired'),
          run: () => {
            const query = findUsagesTarget.query;
            if (query === '') return;
            closeSearchEverywhere();
            window.open(
              `https://www.google.com/search?q=${encodeURIComponent(query)}`,
              '_blank',
              'noopener,noreferrer',
            );
          },
        },
        {
          id: 'findNextWordOccurrence',
          icon: 'search',
          label: t('editor.nextWordOccurrenceAction'),
          description: t('editor.findWordAtCaretHint'),
          keywords: t('editor.nextWordOccurrenceSynonym'),
          shortcut: '⌃F3',
          disabled: findUsagesTarget.query === '',
          disabledReason:
            findUsagesTarget.reason === 'editor'
              ? t('editor.findEditorRequired')
              : t('editor.findUsagesSymbolRequired'),
          run: () => runWordOccurrence('editor.action.nextSelectionMatchFindAction'),
        },
        {
          id: 'findPreviousWordOccurrence',
          icon: 'search',
          label: t('editor.previousWordOccurrenceAction'),
          description: t('editor.wordOccurrenceHint'),
          shortcut: '⌃⇧F3',
          disabled: findUsagesTarget.query === '',
          disabledReason:
            findUsagesTarget.reason === 'editor'
              ? t('editor.findEditorRequired')
              : t('editor.findUsagesSymbolRequired'),
          run: () => runWordOccurrence('editor.action.previousSelectionMatchFindAction'),
        },
        {
          id: 'selectAllOccurrences',
          icon: 'target',
          label: t('editor.selectAllOccurrencesAction'),
          description: t('editor.selectAllOccurrencesHint'),
          shortcut: '⌃⌘G',
          disabled: findUsagesTarget.query === '',
          disabledReason:
            findUsagesTarget.reason === 'editor'
              ? t('editor.findEditorRequired')
              : t('editor.findUsagesSymbolRequired'),
          run: () => runWordOccurrence('editor.action.selectHighlights'),
        },
        {
          id: 'selectNextOccurrence',
          icon: 'search',
          label: t('editor.selectNextOccurrenceAction'),
          description: t('editor.selectNextOccurrenceHint'),
          keywords: t('editor.selectNextOccurrenceSynonym'),
          shortcut: '⌃G',
          disabled: findUsagesTarget.query === '',
          disabledReason:
            findUsagesTarget.reason === 'editor'
              ? t('editor.findEditorRequired')
              : t('editor.findUsagesSymbolRequired'),
          run: () => runWordOccurrence('editor.action.addSelectionToNextFindMatch'),
        },
        {
          id: 'unselectPreviousOccurrence',
          icon: 'history',
          label: t('editor.unselectPreviousOccurrenceAction'),
          description: t('editor.unselectPreviousOccurrenceHint'),
          keywords: t('editor.unselectPreviousOccurrenceSynonym'),
          shortcut: '⌃⇧G',
          disabled: findUsagesTarget.query === '',
          disabledReason:
            findUsagesTarget.reason === 'editor'
              ? t('editor.findEditorRequired')
              : t('editor.findUsagesSymbolRequired'),
          run: () => runWordOccurrence('cursorUndo'),
        },
        {
          id: 'findNext',
          icon: 'search',
          label: t('editor.findNextAction'),
          description: t('editor.findNextActionHint'),
          shortcut: '⌘G',
          disabled: !hasEditorModel || replaceState === null || replaceState.find === '',
          disabledReason: !hasEditorModel ? t('editor.findEditorRequired') : t('editor.findStepInactive'),
          run: () => {
            closeSearchEverywhere();
            editorFindStepRef.current?.(1);
          },
        },
        {
          id: 'findPrevious',
          icon: 'search',
          label: t('editor.findPreviousAction'),
          description: t('editor.findPreviousActionHint'),
          shortcut: '⇧⌘G',
          disabled: !hasEditorModel || replaceState === null || replaceState.find === '',
          disabledReason: !hasEditorModel ? t('editor.findEditorRequired') : t('editor.findStepInactive'),
          run: () => {
            closeSearchEverywhere();
            editorFindStepRef.current?.(-1);
          },
        },
        {
          id: 'searchInChanges',
          icon: 'search',
          label: t('editor.searchInChanges'),
          description: t('editor.searchInChangesHint'),
          shortcut: '⌘F',
          disabled:
            diffOpen === false ||
            (diffTarget?.repositoryVersion !== null && typeof diffTarget?.repositoryVersion === 'object'),
          disabledReason: t('editor.searchInChangesUnavailable'),
          run: () => {
            closeSearchEverywhere();
            setActivity('commit');
            setPanelVisible(true);
            setDiffActive(true);
            window.setTimeout(() => diffSearchInChangesRef.current?.(), 40);
          },
        },
        {
          id: 'findInFiles',
          icon: 'search',
          label: t('editor.findInFilesAction'),
          description: t('editor.findInFilesHint'),
          shortcut: '⇧⌘F',
          keywords: t('editor.findInPathSynonym'),
          run: () => openFindTool('', 'find'),
        },
        {
          id: 'replaceInFiles',
          icon: 'code',
          label: t('editor.replaceInFilesAction'),
          description: t('editor.replaceInFilesHint'),
          shortcut: '⇧⌘R',
          keywords: t('editor.replaceInPathSynonym'),
          run: () => openFindTool('', 'replace'),
        },
      ],
      [
        activeSourceEditor,
        findUsagesTarget.query,
        findUsagesTarget.reason,
        hasSelectionScope,
        hasEditorModel,
        closeSearchEverywhere,
        openEditorFind,
        openEditorFindInSelection,
        openFindTool,
        openFindUsages,
        openShowUsages,
        openQuickOpen,
        openRecent,
        openSearchEverywhere,
        replaceState,
        runWordOccurrence,
        searchMacPlatform,
        selectionScope,
        diffOpen,
        t,
      ],
    );
  /* Recompute match count whenever the query or the active file changes. */ const updateFind = React.useCallback(
    (patch: Partial<EditorFindState>) => {
      setReplaceState((current) => {
        if (current === null) return current;
        const next = { ...current, ...patch };
        const path = currentCodePath();
        const model = path === null ? undefined : modelsRef.current.get(path);
        const text = model?.getValue() ?? '';
        const result: EditorFindMatches =
          next.find === '' ? { matches: [], error: null } : editorFindResult(text, next.find, next);
        next.total = result.matches.length;
        next.error = result.error;
        next.index = Math.min(next.index, Math.max(0, next.total - 1));
        return next;
      });
    },
    [currentCodePath],
  );
  const toggleFindOption = React.useCallback(
    (key: 'caseSensitive' | 'wholeWords' | 'regex' | 'preserveCase') => {
      setReplaceState((current) => {
        if (current === null) return current;
        const next = { ...current, [key]: current[key] !== true };
        if (key === 'regex' && next.regex === true) next.wholeWords = false;
        if (key === 'wholeWords' && current.regex === true) return current;
        const path = currentCodePath();
        const model = path === null ? undefined : modelsRef.current.get(path);
        const result = editorFindResult(model?.getValue() ?? '', next.find, next);
        next.total = result.matches.length;
        next.error = result.error;
        next.index = Math.min(next.index, Math.max(0, next.total - 1));
        return next;
      });
    },
    [currentCodePath],
  );
  const toggleFindSelectionScope = React.useCallback(() => {
    const scope = editorFindSelectionScope(currentCodeEditor());
    setReplaceState((current) => {
      if (current === null) return current;
      const scoped = current.scope !== null && current.scope !== undefined;
      const nextScope = scoped ? null : scope;
      if (!scoped && nextScope === null) return current;
      const path = currentCodePath();
      const model = path === null ? undefined : modelsRef.current.get(path);
      const result: EditorFindMatches =
        current.find === ''
          ? { matches: [], error: null }
          : editorFindResult(model?.getValue() ?? '', current.find, {
              ...current,
              scope: nextScope,
            });
      return {
        ...current,
        scope: nextScope,
        total: result.matches.length,
        error: result.error,
        index: Math.min(current.index, Math.max(0, result.matches.length - 1)),
      };
    });
  }, [currentCodePath, currentCodeEditor]);
  /* IDEA Toggle Find in Selection: ⌃⌥E. Keep editor Find as the sole
         owner of scope state instead of adding a second selection matcher. */ React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.ctrlKey !== true ||
        event.altKey !== true ||
        event.metaKey === true ||
        event.shiftKey === true ||
        event.key.toLowerCase() !== 'e'
      )
        return;
      const target = event.target instanceof Element ? event.target : null;
      const host = document.querySelector<HTMLElement>('[data-dsh-editor-workspace]');
      if (target === null || host === null || !host.contains(target)) return;
      if (
        target.closest('[data-dsh-search-everywhere], [data-dsh-find-tool-window], [data-dsh-editor-terminal]') !== null
      )
        return;
      if (target.closest('.monaco-editor, [data-dsh-editor-find-input], [data-dsh-editor-find-replace-input]') === null)
        return;
      const scope = editorFindSelectionScope(currentCodeEditor());
      const action = editorFindSelectionShortcutAction(replaceState, scope);
      if (action === null) return;
      event.preventDefault();
      event.stopPropagation();
      if (action === 'toggle') {
        toggleFindSelectionScope();
        return;
      }
      openEditorFindInSelection(scope, null, null, 'query');
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [currentCodeEditor, openEditorFindInSelection, replaceState, toggleFindSelectionScope]);
  const openEditorFindHistory = (event: React.SyntheticEvent<HTMLElement>, kind: 'query' | 'replace') => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setEditorFindHistoryMenu({ kind, x: rect.left, y: rect.bottom + 4 });
  };
  /* Move the editor selection to the next/previous match. */ const jumpToMatch = React.useCallback(
    (direction: number) => {
      const editor = currentCodeEditor();
      const model = editor?.getModel() ?? null;
      if (editor === null || model === null) return;
      if (replaceState !== null && replaceState.find !== '') rememberCurrentSearchQuery(replaceState.find);
      setReplaceState((current) => {
        if (current === null || current.find === '') return current;
        const text = model.getValue();
        const result = editorFindResult(text, current.find, current);
        const matches = result.matches;
        if (matches.length === 0) return { ...current, total: 0, index: 0, error: result.error };
        const index = (((current.index + direction) % matches.length) + matches.length) % matches.length;
        const match = matches[index];
        const position = model.getPositionAt(match.offset);
        editor.setSelection(
          new window.monaco.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column + match.length,
          ),
        );
        editor.revealPositionInCenterIfOutsideViewport(position);
        return { ...current, index, total: matches.length, error: null };
      });
    },
    [currentCodeEditor, rememberCurrentSearchQuery, replaceState?.find],
  );
  editorFindStepRef.current = jumpToMatch;
  /**
   * Replace the selected occurrence, or the current find result, then move to
   * the next match. This is IDEA's single Replace action; Replace All remains
   * a separate explicit command.
   * @returns {void}
   */ const replaceCurrent = React.useCallback(() => {
    const editor = currentCodeEditor();
    const model = editor?.getModel() ?? null;
    if (editor === null || model === null || replaceState === null || replaceState.find === '') return;
    const query = replaceState.find;
    const selection = editor.getSelection();
    const text = model.getValue();
    const result = editorFindResult(text, query, replaceState);
    if (result.error !== null) {
      setReplaceState((current) =>
        current === null ? current : { ...current, total: 0, index: 0, error: result.error },
      );
      return;
    }
    if (result.matches.length === 0) {
      setReplaceState((current) => (current === null ? current : { ...current, total: 0, index: 0, error: null }));
      return;
    }
    const selectionOffset = selection === null ? null : model.getOffsetAt(selection.getStartPosition());
    const selectedMatch =
      selectionOffset === null ? null : result.matches.find((match) => match.offset === selectionOffset);
    const match = selectedMatch ?? result.matches[Math.min(replaceState.index, result.matches.length - 1)];
    const offset = match.offset;
    if (!Number.isFinite(offset)) return;
    const rewritten = editorReplaceAt(text, query, replaceState.replace, offset, replaceState);
    if (rewritten.error !== null) {
      setReplaceState((current) => (current === null ? current : { ...current, error: rewritten.error }));
      return;
    }
    rememberCurrentSearchQuery(query);
    rememberCurrentReplacement(replaceState.replace);
    const start = model.getPositionAt(offset);
    const end = model.getPositionAt(offset + rewritten.length);
    editor.executeEdits('dsh-editor-replace', [
      {
        range: new window.monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
        text: rewritten.replacementText,
        forceMoveMarkers: true,
      },
    ]);
    const replacementEnd = offset + rewritten.replacementText.length;
    const after = model.getValue();
    const nextScope =
      replaceState.scope === null || replaceState.scope === undefined
        ? null
        : {
            start: replaceState.scope.start,
            end: replaceState.scope.end + rewritten.replacementText.length - rewritten.length,
          };
    const nextResult = editorFindResult(after, query, {
      ...replaceState,
      scope: nextScope,
    });
    const nextMatches = nextResult.matches;
    const nextIndex = Math.max(
      0,
      nextMatches.findIndex((entry) => entry.offset >= replacementEnd),
    );
    if (nextMatches.length > 0) {
      const nextMatch = nextMatches[nextIndex];
      const position = model.getPositionAt(nextMatch.offset);
      editor.setSelection(
        new window.monaco.Range(
          position.lineNumber,
          position.column,
          position.lineNumber,
          position.column + nextMatch.length,
        ),
      );
      editor.revealPositionInCenterIfOutsideViewport(position);
    }
    setReplaceState((current) =>
      current === null
        ? current
        : {
            ...current,
            scope: nextScope,
            total: nextMatches.length,
            index: nextMatches.length === 0 ? 0 : nextIndex,
            error: nextResult.error,
          },
    );
  }, [currentCodeEditor, rememberCurrentReplacement, rememberCurrentSearchQuery, replaceState]);
  const replaceAll = React.useCallback(() => {
    const editor = currentCodeEditor();
    const model = editor?.getModel() ?? null;
    if (model === null) return;
    if (replaceState !== null && replaceState.find !== '') {
      rememberCurrentSearchQuery(replaceState.find);
      rememberCurrentReplacement(replaceState.replace);
    }
    setReplaceState((current) => {
      if (current === null || current.find === '') return current;
      const query = current.find;
      const next = current.replace;
      const before = model.getValue();
      const rewritten = editorReplaceAll(before, query, next, current);
      if (rewritten.error !== null) return { ...current, total: 0, index: 0, error: rewritten.error };
      if (rewritten.text !== before) {
        editor.executeEdits('dsh-editor-replace-all', [
          {
            range: model.getFullModelRange(),
            text: rewritten.text,
            forceMoveMarkers: true,
          },
        ]);
      }
      const nextScope =
        current.scope === null || current.scope === undefined
          ? null
          : {
              start: current.scope.start,
              end: current.scope.end + (rewritten.delta ?? 0),
            };
      const result = editorFindResult(rewritten.text, query, {
        ...current,
        scope: nextScope,
      });
      return {
        ...current,
        scope: nextScope,
        total: result.matches.length,
        index: 0,
        error: result.error,
      };
    });
  }, [currentCodeEditor, rememberCurrentReplacement, rememberCurrentSearchQuery, replaceState]);
  const closeFind = React.useCallback(() => {
    setReplaceState(null);
    currentCodeEditor()?.focus();
  }, [currentCodeEditor]);
  /* Discard local edits and take the on-disk contents, IDEA's "Load File from Disk". */ /**
   * Re-read one open tab from disk, keeping it open and clean.
   *
   * `openFile` short-circuits when a path is already open, so anything that
   * rewrites a file behind the editor (restore-to-revision, checkout) needs
   * this instead — otherwise the tab keeps showing stale bytes.
   * @param {string} path - workspace-relative file path.
   * @returns {Promise<void>} resolves once the tab reflects the disk.
   */ const reloadFile = React.useCallback(async (path: string) => {
    if (typeof path !== 'string' || path === '') return;
    try {
      const value = await callFs<{ content?: string; mtime?: number | null }>({ op: 'read', path });
      const model = modelsRef.current.get(path);
      if (model !== undefined) {
        silentReloadRef.current.add(path);
        try {
          model.setValue(typeof value.content === 'string' ? value.content : '');
        } finally {
          silentReloadRef.current.delete(path);
        }
      }
      setOpenFiles((current) =>
        current.map((entry) =>
          entry.path === path
            ? {
                ...entry,
                content: typeof value.content === 'string' ? value.content : '',
                dirty: false,
                mtime: typeof value.mtime === 'number' ? value.mtime : null,
              }
            : entry,
        ),
      );
      setExternalChanges((current) => {
        if (current[path] === undefined) return current;
        const next = { ...current };
        delete next[path];
        return next;
      });
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : String(error));
    }
  }, []);
  /**
   * IDEA's Replace in Files apply step.
   *
   * Search results supply the exact files and their observed mtimes. Dirty
   * open buffers are rewritten in their Monaco models; clean targets keep
   * the host's protected disk-write path and transactional rollback.
   * @returns {Promise<void>} resolves after the write attempt and refresh.
   */ const replaceInFiles = React.useCallback(async () => {
    const query = searchEverywhere?.query.trim() ?? '';
    const replacement = typeof searchEverywhere?.replace === 'string' ? searchEverywhere.replace : '';
    const matches = Array.isArray(searchEverywhere?.textMatches) ? searchEverywhere.textMatches : [];
    if (query === '' || matches.length === 0) return;
    const replacementPlan = planWorkspaceReplacements(
      matches,
      openFilesRef.current,
      modelsRef.current,
      query,
      replacement,
      {
        caseSensitive: searchEverywhere.caseSensitive === true,
        wholeWords: searchEverywhere.wholeWords === true,
        regex: searchEverywhere.regex === true,
        preserveCase: searchEverywhere.preserveCase === true,
      },
    );
    if (replacementPlan.errorPath !== null) {
      setSearchEverywhere((current) =>
        current === null
          ? current
          : {
              ...current,
              error: t('editor.searchReplaceDirty', {
                files: replacementPlan.errorPath,
              }),
            },
      );
      return;
    }
    if (replacementPlan.errorMessage !== null) {
      setSearchEverywhere((current) =>
        current === null ? current : { ...current, error: replacementPlan.errorMessage },
      );
      return;
    }
    const { cleanTargets, dirtyPlans } = replacementPlan;
    const operationFileCount = new Set([...cleanTargets.keys(), ...dirtyPlans.map((plan) => plan.path)]).size;
    if (operationFileCount === 0) return;
    if (!claimReplaceAttempt(replaceWriteBusyRef, searchEverywhere?.replaceBusy === true)) return;
    if (!(await confirmSearchReplace(t, query, replacement, matches.length, operationFileCount))) {
      releaseReplaceAttempt(replaceWriteBusyRef);
      setSearchEverywhere((current) =>
        current === null
          ? current
          : {
              ...current,
              replaceFocusRequest: (current.replaceFocusRequest ?? 0) + 1,
            },
      );
      return;
    }
    /* Search Everywhere uses the same host undo slot. Any previous Find
           operation is no longer recoverable once this replacement starts. */ setFindReplaceUndoStack([]);
    setFindReplaceRedoStack([]);
    const dirtyUndo = dirtyPlans.map((plan) => ({
      path: plan.path,
      afterContent: plan.text,
      beforeContent: plan.model.getValue(),
    }));
    setSearchEverywhere((current) => (current === null ? current : { ...current, replaceBusy: true, error: null }));
    try {
      const value =
        cleanTargets.size === 0
          ? null
          : await callFs({
              op: 'replaceText',
              query,
              replacement,
              targets: [...cleanTargets.values()],
              caseSensitive: searchEverywhere.caseSensitive === true ? true : undefined,
              wholeWords: searchEverywhere.wholeWords === true,
              regex: searchEverywhere.regex === true,
              preserveCase: searchEverywhere.preserveCase === true,
              fileMask: normalizeFileExtensionFilter(searchEverywhere.fileMask),
            });
      const dirtyCommit = commitFindToolDirtyPlans(dirtyPlans);
      const dirtyReplacements = dirtyCommit.count;
      const dirtyChanged = dirtyCommit.paths;
      if (dirtyCommit.contents.size > 0) {
        setOpenFiles((current) =>
          current.map((file) =>
            dirtyCommit.contents.has(file.path)
              ? {
                  ...file,
                  content: dirtyCommit.contents.get(file.path),
                  dirty: true,
                }
              : file,
          ),
        );
      }
      const hostChanged = Array.isArray(value?.files) ? value.files : [];
      const changed = [...new Set([...hostChanged, ...dirtyChanged])];
      const openChanged = new Set(openFilesRef.current.map((file) => file.path));
      const dirtyChangedSet = new Set(dirtyChanged);
      for (const path of hostChanged) {
        if (openChanged.has(path) && !dirtyChangedSet.has(path)) await reloadFile(path);
      }
      await loadGit();
      rememberCurrentSearchQuery(query);
      rememberCurrentReplacement(replacement);
      const replacedCount = Number(value?.replacements ?? 0) + dirtyReplacements;
      const operationId = typeof value?.operationId === 'string' ? value.operationId : '';
      const operation = {
        operationId,
        clean: operationId !== '' && hostChanged.length > 0,
        dirty: dirtyUndo,
        files: changed,
        replacements: replacedCount,
      };
      setFindReplaceRedoStack([]);
      setFindReplaceUndoStack((current) => boundedReplaceHistory(current, operation));
      flashStatus(t('editor.searchReplaceDone', searchReplaceCountParams(t, replacedCount, changed.length)));
      setSearchEverywhere((current) =>
        current === null
          ? current
          : {
              ...current,
              textMatches: [],
              textRevision: (current.textRevision ?? 0) + 1,
              replaceBusy: false,
              error: null,
            },
      );
    } catch (failure) {
      setSearchEverywhere((current) =>
        current === null
          ? current
          : {
              ...current,
              replaceBusy: false,
              error: failure instanceof Error ? failure.message : String(failure),
            },
      );
    } finally {
      releaseReplaceAttempt(replaceWriteBusyRef);
    }
  }, [flashStatus, loadGit, reloadFile, rememberCurrentReplacement, rememberCurrentSearchQuery, searchEverywhere, t]);
  /**
   * Apply IDEA's Replace in Files action from the persistent Find window.
   *
   * Dirty open documents are replaced in their Monaco models; clean targets
   * continue through the host's guarded disk write. Each dirty model edit is
   * isolated as its own undo step.
   * @returns {Promise<void>} resolves after the guarded write and refresh.
   */ const replaceInFindTool = React.useCallback(
    async (allowedPaths: Set<string> | null = null) => {
      const query = findToolContentQuery(findTool?.query);
      const requestGeneration = Math.max(0, Number(findTool?.searchGeneration) || 0);
      const allowed = allowedPaths instanceof Set ? allowedPaths : null;
      const matches = (Array.isArray(findTool?.matches) ? findTool.matches : []).filter(
        (match) => allowed === null || allowed.has(match.path),
      );
      if (!hasFindToolContentQuery(query) || matches.length === 0) return;
      const replacementPlan = planWorkspaceReplacements(
        matches,
        openFilesRef.current,
        modelsRef.current,
        query,
        findTool.replace,
        {
          caseSensitive: findTool.caseSensitive === true,
          wholeWords: findTool.wholeWords === true,
          regex: findTool.regex === true,
          preserveCase: findTool.preserveCase === true,
          contextFilter: normalizeTextSearchContextFilter(findTool.contextFilter),
        },
      );
      if (replacementPlan.errorPath !== null) {
        setFindTool((current) =>
          current === null
            ? current
            : {
                ...current,
                error: t('editor.searchReplaceDirty', {
                  files: replacementPlan.errorPath,
                }),
                replaceFocusRequest: (current.replaceFocusRequest ?? 0) + 1,
              },
        );
        return;
      }
      if (replacementPlan.errorMessage !== null) {
        setFindTool((current) =>
          current === null
            ? current
            : {
                ...current,
                error: replacementPlan.errorMessage,
                replaceFocusRequest: (current.replaceFocusRequest ?? 0) + 1,
              },
        );
        return;
      }
      const { cleanTargets, dirtyPlans } = replacementPlan;
      const operationFileCount = new Set([...cleanTargets.keys(), ...dirtyPlans.map((plan) => plan.path)]).size;
      if (operationFileCount === 0) return;
      if (!claimReplaceAttempt(replaceWriteBusyRef, findTool?.replaceBusy === true)) return;
      if (!(await confirmSearchReplace(t, query, findTool.replace, matches.length, operationFileCount))) {
        releaseReplaceAttempt(replaceWriteBusyRef);
        setFindTool((current) =>
          current === null
            ? current
            : {
                ...current,
                replaceFocusRequest: (current.replaceFocusRequest ?? 0) + 1,
              },
        );
        return;
      }
      setFindTool((current) =>
        current === null
          ? current
          : {
              ...current,
              replaceBusy: true,
              error: null,
              replaceFocusRequest: (current.replaceFocusRequest ?? 0) + 1,
            },
      );
      try {
        const dirtyUndo = dirtyPlans.map((plan) => ({
          path: plan.path,
          afterContent: plan.text,
          beforeContent: plan.model.getValue(),
        }));
        const value =
          cleanTargets.size === 0
            ? null
            : await callFs({
                op: 'replaceText',
                query,
                replacement: findTool.replace,
                targets: [...cleanTargets.values()],
                caseSensitive: findTool.caseSensitive === true ? true : undefined,
                wholeWords: findTool.wholeWords === true,
                regex: findTool.regex === true,
                preserveCase: findTool.preserveCase === true,
                fileMask: normalizeFileExtensionFilter(findTool.fileMask),
                contextFilter: normalizeTextSearchContextFilter(findTool.contextFilter),
                scopeIncludePatterns: findToolScopeIncludePatterns,
                scopeExcludePatterns: findToolScopeExcludePatterns,
              });
        const dirtyCommit = commitFindToolDirtyPlans(dirtyPlans);
        const dirtyReplacements = dirtyCommit.count;
        const dirtyChanged = dirtyCommit.paths;
        if (dirtyCommit.contents.size > 0) {
          setOpenFiles((current) =>
            current.map((file) =>
              dirtyCommit.contents.has(file.path)
                ? {
                    ...file,
                    content: dirtyCommit.contents.get(file.path),
                    dirty: true,
                  }
                : file,
            ),
          );
        }
        const hostChanged = Array.isArray(value?.files) ? value.files : [];
        const changed = [...new Set([...hostChanged, ...dirtyChanged])];
        const openChanged = new Set(openFilesRef.current.map((file) => file.path));
        const dirtyChangedSet = new Set(dirtyChanged);
        for (const path of hostChanged) {
          if (openChanged.has(path) && !dirtyChangedSet.has(path)) await reloadFile(path);
        }
        await loadGit();
        rememberCurrentFindQuery(query);
        rememberCurrentReplacement(findTool.replace);
        const replacedCount = Number(value?.replacements ?? 0) + dirtyReplacements;
        const operationId = typeof value?.operationId === 'string' ? value.operationId : '';
        const operation = {
          operationId,
          clean: operationId !== '' && hostChanged.length > 0,
          dirty: dirtyUndo,
          files: changed,
          replacements: replacedCount,
        };
        setFindReplaceRedoStack([]);
        setFindReplaceUndoStack((current) => boundedReplaceHistory(current, operation));
        flashStatus(t('editor.searchReplaceDone', searchReplaceCountParams(t, replacedCount, changed.length)));
        setFindTool((current) =>
          current === null
            ? current
            : {
                ...current,
                matches: [],
                files: [],
                replaceBusy: false,
                error: null,
                searchGeneration: (current.searchGeneration ?? 0) + 1,
                loadedGeneration: -1,
              },
        );
      } catch (failure) {
        const message = failure instanceof Error ? failure.message : String(failure);
        flashStatus(message);
        setFindTool((current) => replaceFailureState(current, requestGeneration, message));
      } finally {
        releaseReplaceAttempt(replaceWriteBusyRef);
      }
    },
    [findTool, flashStatus, loadGit, reloadFile, rememberCurrentFindQuery, rememberCurrentReplacement, t],
  );
  /**
   * Replace the one Find occurrence the user is pointing at.
   *
   * Dirty occurrences are replaced in the exact live model; clean
   * occurrences continue through the host's mtime and line/column checks.
   * Keeping the current visible index after the follow-up search naturally
   * advances to the next result.
   * @param {{path?: string, mtime?: number, line?: number, column?: number, kind?: string}} match - active Find row.
   * @param {number} activeIndex - current row index in the visible result set.
   * @returns {Promise<void>} resolves after the guarded write and refresh.
   */ const replaceFindToolOccurrence = React.useCallback(
    async (match: FindToolMatch, activeIndex: number) => {
      const query = findToolContentQuery(findTool?.query);
      const requestGeneration = Math.max(0, Number(findTool?.searchGeneration) || 0);
      const line = Number(match?.line);
      const column = Number(match?.column);
      if (
        !hasFindToolContentQuery(query) ||
        match?.kind !== 'text' ||
        typeof match.path !== 'string' ||
        match.path === '' ||
        !Number.isInteger(line) ||
        line < 1 ||
        !Number.isInteger(column) ||
        column < 1
      )
        return;
      const rowKey = typeof match.rowKey === 'string' ? match.rowKey : '';
      const dirtyFile = openFilesRef.current.find((file) => file.path === match.path && file.dirty === true);
      const dirtyModel = dirtyFile === undefined ? undefined : modelsRef.current.get(match.path);
      let dirtyOffset = null;
      let dirtyRewrite: ReturnType<typeof editorReplaceAt> | null = null;
      if (dirtyFile !== undefined) {
        if (dirtyModel === undefined) {
          setFindTool((current) =>
            current === null
              ? current
              : {
                  ...current,
                  error: t('editor.searchReplaceDirty', { files: match.path }),
                  replaceFocusRequest: (current.replaceFocusRequest ?? 0) + 1,
                },
          );
          return;
        }
        dirtyOffset = textOffsetAtLineColumn(dirtyModel.getValue(), line, column);
        dirtyRewrite =
          dirtyOffset === null
            ? {
                text: dirtyModel.getValue(),
                count: 0,
                replacementText: '',
                length: 0,
                error: 'find result no longer matches',
              }
            : editorReplaceAt(dirtyModel.getValue(), query, findTool.replace, dirtyOffset, {
                caseSensitive: findTool.caseSensitive === true,
                wholeWords: findTool.wholeWords === true,
                regex: findTool.regex === true,
                preserveCase: findTool.preserveCase === true,
                path: match.path,
                contextFilter: normalizeTextSearchContextFilter(findTool.contextFilter),
              });
        if (dirtyRewrite.error !== null) {
          setFindTool((current) =>
            current === null
              ? current
              : {
                  ...current,
                  error: dirtyRewrite.error,
                  replaceFocusRequest: (current.replaceFocusRequest ?? 0) + 1,
                },
          );
          return;
        }
      }
      if (!claimReplaceAttempt(replaceWriteBusyRef, findTool?.replaceBusy === true)) return;
      setFindTool((current) =>
        current === null
          ? current
          : {
              ...current,
              replaceBusy: true,
              error: null,
              replaceFocusRequest: (current.replaceFocusRequest ?? 0) + 1,
            },
      );
      try {
        const dirtyBeforeContent = dirtyFile !== undefined && dirtyModel !== undefined ? dirtyModel.getValue() : null;
        const value =
          dirtyFile === undefined
            ? await callFs({
                op: 'replaceText',
                query,
                replacement: findTool.replace,
                targets: [{ path: match.path, mtime: match.mtime }],
                occurrence: { line: match.line, column: match.column },
                caseSensitive: findTool.caseSensitive === true ? true : undefined,
                wholeWords: findTool.wholeWords === true,
                regex: findTool.regex === true,
                preserveCase: findTool.preserveCase === true,
                fileMask: normalizeFileExtensionFilter(findTool.fileMask),
                contextFilter: normalizeTextSearchContextFilter(findTool.contextFilter),
                scopeIncludePatterns: findToolScopeIncludePatterns,
                scopeExcludePatterns: findToolScopeExcludePatterns,
              })
            : null;
        if (dirtyFile !== undefined && dirtyModel !== undefined && dirtyRewrite !== null && dirtyOffset !== null) {
          const start = dirtyModel.getPositionAt(dirtyOffset);
          const end = dirtyModel.getPositionAt(dirtyOffset + dirtyRewrite.length);
          dirtyModel.pushStackElement?.();
          dirtyModel.pushEditOperations(
            [],
            [
              {
                range: {
                  startLineNumber: start.lineNumber,
                  startColumn: start.column,
                  endLineNumber: end.lineNumber,
                  endColumn: end.column,
                },
                text: dirtyRewrite.replacementText,
                forceMoveMarkers: true,
              },
            ],
            () => null,
          );
          setOpenFiles((current) =>
            current.map((file) =>
              file.path === match.path ? { ...file, content: dirtyRewrite.text, dirty: true } : file,
            ),
          );
        }
        const changed = dirtyFile === undefined ? (Array.isArray(value?.files) ? value.files : []) : [match.path];
        const openChanged = new Set(openFilesRef.current.map((file) => file.path));
        for (const path of changed) {
          if (dirtyFile === undefined && openChanged.has(path)) await reloadFile(path);
        }
        await loadGit();
        rememberCurrentFindQuery(query);
        rememberCurrentReplacement(findTool.replace);
        const replacedCount = Number(value?.replacements ?? 0) + (dirtyFile === undefined ? 0 : 1);
        const operationId = typeof value?.operationId === 'string' ? value.operationId : '';
        const operation = {
          operationId,
          clean: operationId !== '' && dirtyFile === undefined && changed.length > 0,
          dirty:
            dirtyFile !== undefined && dirtyRewrite !== null && dirtyBeforeContent !== null
              ? [
                  {
                    path: match.path,
                    beforeContent: dirtyBeforeContent,
                    afterContent: dirtyRewrite.text,
                  },
                ]
              : [],
          files: changed,
          replacements: replacedCount,
        };
        setFindReplaceRedoStack([]);
        setFindReplaceUndoStack((current) => boundedReplaceHistory(current, operation));
        flashStatus(t('editor.searchReplaceDone', searchReplaceCountParams(t, replacedCount, changed.length)));
        setFindTool((current) =>
          current === null
            ? current
            : {
                ...current,
                replaceBusy: false,
                error: null,
                index: Math.max(0, Number(activeIndex) || 0),
                replaceFocusRequest: (current.replaceFocusRequest ?? 0) + 1,
                replaceAdvanceRowKey: rowKey,
                replaceAdvanceRevision: (current.replaceAdvanceRevision ?? 0) + 1,
                searchGeneration: (current.searchGeneration ?? 0) + 1,
                loadedGeneration: -1,
              },
        );
      } catch (failure) {
        const message = failure instanceof Error ? failure.message : String(failure);
        flashStatus(message);
        setFindTool((current) => replaceFailureState(current, requestGeneration, message));
      } finally {
        releaseReplaceAttempt(replaceWriteBusyRef);
      }
    },
    [findTool, flashStatus, loadGit, reloadFile, rememberCurrentFindQuery, rememberCurrentReplacement, t],
  );
  /**
   * Undo the latest successful Find Replace operation.
   *
   * Dirty models are validated before the host transaction, so a changed
   * buffer cannot let clean files roll back first and dirty files fail
   * afterwards.
   */ const undoFindReplace = React.useCallback(async () => {
    const operation = findReplaceUndoStack.at(-1) ?? null;
    if (operation === null) return;
    const dirtyPlans = [];
    for (const entry of operation.dirty) {
      const model = modelsRef.current.get(entry.path);
      if (model === undefined || model.getValue() !== entry.afterContent) {
        const message = t('editor.findUndoReplaceConflict', {
          path: entry.path,
        });
        setFindTool((current) => (current === null ? current : { ...current, error: message }));
        flashStatus(message);
        return;
      }
      dirtyPlans.push({
        path: entry.path,
        model,
        text: entry.beforeContent,
        count: 1,
      });
    }
    if (!claimReplaceAttempt(replaceWriteBusyRef, findTool?.replaceBusy === true)) return;
    setFindTool((current) => (current === null ? current : { ...current, replaceBusy: true, error: null }));
    try {
      const value = operation.clean
        ? await callFs({
            op: 'undoReplaceText',
            operationId: operation.operationId,
          })
        : null;
      const dirtyCommit = commitFindToolDirtyPlans(dirtyPlans);
      if (dirtyCommit.contents.size > 0) {
        setOpenFiles((current) =>
          current.map((file) =>
            dirtyCommit.contents.has(file.path)
              ? {
                  ...file,
                  content: dirtyCommit.contents.get(file.path),
                  dirty: true,
                }
              : file,
          ),
        );
      }
      const hostChanged = Array.isArray(value?.files) ? value.files : [];
      const changed = [...new Set([...hostChanged, ...dirtyCommit.paths])];
      const openChanged = new Set(openFilesRef.current.map((file) => file.path));
      const dirtyChanged = new Set(dirtyCommit.paths);
      for (const path of hostChanged) {
        if (openChanged.has(path) && !dirtyChanged.has(path)) await reloadFile(path);
      }
      await loadGit();
      const restored = Number(value?.replacements ?? 0) + dirtyCommit.count;
      setFindReplaceUndoStack((current) => current.slice(0, -1));
      setFindReplaceRedoStack((current) => boundedReplaceHistory(current, operation));
      flashStatus(t('editor.findUndoReplaceDone', searchReplaceCountParams(t, restored, changed.length)));
      setFindTool((current) =>
        current === null
          ? current
          : {
              ...current,
              replaceBusy: false,
              error: null,
              files: [],
              matches: [],
              searchGeneration: (current.searchGeneration ?? 0) + 1,
              loadedGeneration: -1,
            },
      );
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : String(failure);
      flashStatus(message);
      setFindTool((current) => (current === null ? current : { ...current, replaceBusy: false, error: message }));
    } finally {
      releaseReplaceAttempt(replaceWriteBusyRef);
    }
  }, [findReplaceUndoStack, findTool?.replaceBusy, flashStatus, loadGit, reloadFile, t]);
  /** Redo the latest Undo Last Replace operation after validating both scopes. */ const redoFindReplace =
    React.useCallback(async () => {
      const operation = findReplaceRedoStack.at(-1) ?? null;
      if (operation === null) return;
      const dirtyPlans = [];
      for (const entry of operation.dirty) {
        const model = modelsRef.current.get(entry.path);
        if (model === undefined || model.getValue() !== entry.beforeContent) {
          const message = t('editor.findRedoReplaceConflict', {
            path: entry.path,
          });
          setFindTool((current) => (current === null ? current : { ...current, error: message }));
          flashStatus(message);
          return;
        }
        dirtyPlans.push({
          path: entry.path,
          model,
          text: entry.afterContent,
          count: 1,
        });
      }
      if (!claimReplaceAttempt(replaceWriteBusyRef, findTool?.replaceBusy === true)) return;
      setFindTool((current) => (current === null ? current : { ...current, replaceBusy: true, error: null }));
      try {
        const value = operation.clean
          ? await callFs({
              op: 'redoReplaceText',
              operationId: operation.operationId,
            })
          : null;
        const dirtyCommit = commitFindToolDirtyPlans(dirtyPlans);
        if (dirtyCommit.contents.size > 0) {
          setOpenFiles((current) =>
            current.map((file) =>
              dirtyCommit.contents.has(file.path)
                ? {
                    ...file,
                    content: dirtyCommit.contents.get(file.path),
                    dirty: true,
                  }
                : file,
            ),
          );
        }
        const hostChanged = Array.isArray(value?.files) ? value.files : [];
        const changed = [...new Set([...hostChanged, ...dirtyCommit.paths])];
        const openChanged = new Set(openFilesRef.current.map((file) => file.path));
        const dirtyChanged = new Set(dirtyCommit.paths);
        for (const path of hostChanged) {
          if (openChanged.has(path) && !dirtyChanged.has(path)) await reloadFile(path);
        }
        await loadGit();
        const reapplied = Number(value?.replacements ?? 0) + dirtyCommit.count;
        setFindReplaceRedoStack((current) => current.slice(0, -1));
        setFindReplaceUndoStack((current) => boundedReplaceHistory(current, operation));
        flashStatus(t('editor.findRedoReplaceDone', searchReplaceCountParams(t, reapplied, changed.length)));
        setFindTool((current) =>
          current === null
            ? current
            : {
                ...current,
                replaceBusy: false,
                error: null,
                files: [],
                matches: [],
                searchGeneration: (current.searchGeneration ?? 0) + 1,
                loadedGeneration: -1,
              },
        );
      } catch (failure) {
        const message = failure instanceof Error ? failure.message : String(failure);
        flashStatus(message);
        setFindTool((current) => (current === null ? current : { ...current, replaceBusy: false, error: message }));
      } finally {
        releaseReplaceAttempt(replaceWriteBusyRef);
      }
    }, [findReplaceRedoStack, findTool?.replaceBusy, flashStatus, loadGit, reloadFile, t]);
  /**
   * Stop warning about one external change without touching the editor.
   *
   * Declared before `reloadActiveFromDisk` because that callback lists it as a
   * dependency: reading it later would hit the temporal dead zone.
   * @param {string} path - workspace-relative file path.
   */ const dismissExternal = React.useCallback((path: string) => {
    setExternalChanges((current) => {
      if (current[path] === undefined) return current;
      const next = { ...current };
      delete next[path];
      return next;
    });
  }, []);
  const reloadActiveFromDisk = React.useCallback(async () => {
    const path = activePathRef.current;
    if (path === null) return;
    try {
      const file = openFilesRef.current.find((entry) => entry.path === path) ?? null;
      const value = await callFs<{ content?: string; mtime?: number | null }>({
        op: workspaceReloadOperation(file),
        path,
      });
      if (file?.kind !== 'image') {
        const model = modelsRef.current.get(path);
        if (model !== undefined) {
          silentReloadRef.current.add(path);
          try {
            model.setValue(value.content);
          } finally {
            silentReloadRef.current.delete(path);
          }
        }
      }
      setOpenFiles((current) =>
        current.map((entry) => (entry.path === path ? workspaceFileAfterReload(entry, value) : entry)),
      );
      setConflict(null);
      setEditorError(null);
      dismissExternal(path);
      await loadGit();
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : String(error));
    }
  }, [dismissExternal, loadGit]);
  /**
   * Make one path visible in the tree: expand its ancestors, select it, scroll to it.
   *
   * IDEA's "Select in Project View" expands collapsed ancestors instead of
   * moving the selection to a row that may not be rendered yet.
   * Deliberately does NOT touch the tool window's activity or visibility;
   * only an explicit Project reveal action should switch to the Project panel.
   * @param {string} path - workspace-relative path to show.
   * @returns {Promise<void>} resolves once the row is on screen.
   */ const revealInProjectTree = React.useCallback(
    async (path: string) => {
      if (typeof path !== 'string' || path === '') return;
      const parts = path.split('/');
      let prefix = '';
      const nextExpanded = new Set(expandedRef.current);
      /* The root's own row is always present, so this stops before the last part. */ for (
        let index = 0;
        index < parts.length - 1;
        index += 1
      ) {
        prefix = prefix === '' ? parts[index] : `${prefix}/${parts[index]}`;
        nextExpanded.add(prefix);
        if (childrenRef.current[prefix] === undefined) {
          try {
            const value = await callFs<{ entries?: WorkspaceEntry[] }>({
              op: 'list',
              path: prefix,
              showHidden,
              sort: sortMode,
              foldersFirst,
              showExcluded: showExcludedFiles,
            });
            setChildren((current) => ({
              ...current,
              [prefix]: Array.isArray(value.entries) ? value.entries : [],
            }));
          } catch {
            /* an unreadable ancestor still leaves the target selected */
          }
        }
      }
      setExpanded(nextExpanded);
      setSelectedPath(path);
      window.setTimeout(() => {
        rowRefs.current.get(path)?.scrollIntoView({ block: 'center' });
      }, 0);
    },
    [foldersFirst, setSelectedPath, showExcludedFiles, showHidden, sortMode],
  );
  const revealPath = React.useCallback(
    async (path: string) => {
      if (typeof path !== 'string' || path === '') return;
      /* IDEA returns to the last real tree view (Project or Project Files),
           not necessarily the default Project entry, when leaving a filtered view. */ applyProjectView(
        lastProjectTreeViewRef.current,
      );
      setActivity('project');
      setPanelVisible(true);
      await revealInProjectTree(path);
    },
    [applyProjectView, revealInProjectTree],
  );
  /**
   * Locate the active tab only for explicit commands.
   *
   * The toolbar target and Alt+F1 call this. Plain tab switches must leave
   * the Project view selection, expansion and scroll position untouched.
   */ const revealActive = React.useCallback(async () => {
    const path = activePathRef.current;
    if (path === null) return;
    if (projectTreeActionsAvailable === false && rows.some((row) => row.path === path)) {
      setActivity('project');
      setPanelVisible(true);
      setSelectedPath(path);
      window.setTimeout(() => rowRefs.current.get(path)?.scrollIntoView({ block: 'nearest' }), 0);
      return;
    }
    await revealPath(path);
  }, [projectTreeActionsAvailable, revealPath, rows, setSelectedPath]);
  const revealActiveRef = React.useRef(null);
  React.useEffect(() => {
    revealActiveRef.current = revealActive;
  }, [revealActive]);
  /**
   * Return keyboard ownership to the Project tree after an Options command.
   *
   * The generic ContextMenu restores focus to the button that opened it. When
   * the action came from the overflow `»`, that button may no longer exist or
   * may have been the previous menu row, leaving arrow keys dead. IDEA keeps
   * the selected tree row alive and hands keys back to the tree.
   * @returns {void}
   */ const focusProjectAfterOption = React.useCallback(() => {
    const focusNow = () => {
      const path = selectedPathRef.current;
      const row = path === null ? null : rowRefs.current.get(path);
      /* The selected row is usually tabIndex=-1 (the tree container owns the
             0 tab stop). Calling focus() on it is a no-op that strands <body>. */ const target =
        row?.isConnected === true && row.tabIndex >= 0 ? row : treeRef.current;
      target?.focus?.();
    };
    /* Commands such as Sort/Expand All re-render or reload the tree asynchronously.
           The first write lands immediately; the second covers a host/re-render pass
           that would otherwise move focus to <body>. */ focusNow();
    window.setTimeout(focusNow, 120);
  }, []);
  /**
   * Run one Project Options command, then restore tree focus unless the command
   * intentionally opened another keyboard-owned surface (Quick Open / Recent).
   * @param {Function} action - command body.
   * @returns {void}
   */ const runProjectOption = React.useCallback(
    (action: () => void) => {
      action();
      focusProjectAfterOption();
    },
    [focusProjectAfterOption],
  );
  /**
   * Expand one or more directory subtrees, reusing one safety-bounded walk.
   * @param {string[]} startPaths - directories to expand recursively.
   * @returns {Promise<void>} resolves once the tree caches are updated.
   */ const expandSubtrees = React.useCallback(
    async (startPaths: string[]) => {
      const value = await expandDirectorySubtrees(
        startPaths,
        { expanded: expandedRef.current, children: childrenRef.current },
        async (directory) => {
          const listing = await callFs<{ entries?: WorkspaceEntry[] }>({
            op: 'list',
            path: directory,
            showHidden,
            sort: sortMode,
            foldersFirst,
            showExcluded: showExcludedFiles,
          });
          return Array.isArray(listing.entries) ? listing.entries : [];
        },
      );
      setChildren(value.children as Record<string, WorkspaceEntry[]>);
      setExpanded(value.expanded);
    },
    [foldersFirst, showExcludedFiles, showHidden, sortMode],
  );
  /**
   * IDEA ExpandRecursively: expand every selected directory and its descendants.
   *
   * A selected root intentionally traverses the whole workspace, matching
   * IDEA. File-only and empty selections stay disabled in the toolbar.
   * @returns {void}
   */ const expandSelectedTree = React.useCallback(() => {
    const starts = [...selection].flatMap((path) => {
      const row = rows.find((entry) => entry.path === path);
      return row?.kind === 'directory' ? ['', ...ancestorsOf(path), path] : [];
    });
    void expandSubtrees([...new Set(starts)]);
  }, [expandSubtrees, rows, selection]);
  /* Expand every directory under the root, bounded to keep huge repos responsive. */ const expandAll =
    React.useCallback(async () => {
      await expandSubtrees(entries.filter((entry) => entry.kind === 'directory').map((entry) => entry.path));
    }, [entries, expandSubtrees]);
  /* Clear every expansion state. */ const collapseAll = React.useCallback(() => {
    setExpanded(new Set());
  }, []);
  /**
   * Re-read the tree from disk, keeping every unchanged listing as it is.
   *
   * This is the broad path: an explicit refresh, a git operation, or a
   * structural filesystem change. `only` narrows it to the directories that
   * actually changed on disk, which is what the watcher reports.
   * @param {string[]|null} [only] - workspace-relative directories to re-read; omitted for every expanded one.
   * @returns {Promise<string[]|null>} changed directories, or null when the host could not localize the change.
   */ const refreshTree = React.useCallback(
    async (only?: string[] | null) => {
      /* A toolbar button passes its click event here; anything but an array means
           "refresh everything". */ const narrowed = Array.isArray(only) ? only : null;
      const changedDirectories = narrowed === null ? null : [...new Set(narrowed)];
      /* Re-read the root first: everything below it is keyed by paths in that
           listing, and a delete can invalidate an expanded directory outright. */ const listing = await loadRoot();
      if (
        changedDirectories !== null &&
        keepUnchangedListing(entriesRef.current, listing ?? []) !== entriesRef.current &&
        !changedDirectories.includes('')
      ) {
        changedDirectories.push('');
      }
      const nextChildren: Record<string, WorkspaceEntry[]> = {};
      /* Only expanded directories render rows, so re-reading a collapsed one buys
           nothing. `narrowed` may name collapsed directories (the watcher reports
           the disk, not the view), which this filter drops. */ for (const path of narrowed ?? [
        ...expandedRef.current,
      ]) {
        if (path === '' || !expandedRef.current.has(path)) continue;
        try {
          const value = await callFs<{ entries?: WorkspaceEntry[] }>({
            op: 'list',
            path,
            showHidden,
            sort: sortMode,
            foldersFirst,
            showExcluded: showExcludedFiles,
          });
          const rows = value.entries ?? [];
          nextChildren[path] = rows;
          if (
            changedDirectories !== null &&
            keepUnchangedListing(childrenRef.current[path], rows) !== childrenRef.current[path] &&
            !changedDirectories.includes(path)
          ) {
            changedDirectories.push(path);
          }
        } catch {
          /* a directory that disappeared stays absent */
        }
      }
      /* Merge instead of replace: a directory expanded a moment ago may not be in
           `expandedRef` yet (that ref syncs in an effect), and replacing the whole map
           would drop its freshly fetched children until the next expand. */ setChildren((current) => {
        let changed = false;
        const next = { ...current };
        for (const [path, rows] of Object.entries(nextChildren)) {
          /* An identical listing keeps the SAME array, so React skips those rows
               entirely — that is what makes a no-op refresh invisible. */ const kept = keepUnchangedListing(
            current[path],
            rows,
          );
          if (kept === current[path]) continue;
          next[path] = kept;
          changed = true;
        }
        /* A directory that disappeared leaves a cached listing behind: its rows
             stop rendering (the parent no longer lists it) but the entry keeps the
             old files, and re-creating the name would show them again for a frame.
             Prune only where the PARENT's listing was actually read this round —
             otherwise a collapsed branch's cache would be thrown away for free. */ const read = new Map([
          ['', Array.isArray(listing) ? listing : []],
          ...Object.entries(next),
        ]);
        for (const path of Object.keys(next)) {
          const parent = dirname(path);
          const siblings = read.get(parent);
          if (siblings === undefined) continue;
          if (siblings.some((entry) => entry?.path === path)) continue;
          delete next[path];
          changed = true;
        }
        return changed ? next : current;
      });
      /* Files that appeared since the last refresh are marked "new" for one cycle. */ setNewPaths((current) => {
        const known = knownPathsRef.current;
        if (known === null) {
          /* First refresh only establishes the baseline: nothing is "new" yet. */ knownPathsRef.current = new Set(
            collectFilePaths(listing ?? []),
          );
          return current;
        }
        const next = new Set(current);
        const visible = new Set(collectFilePaths(listing ?? []));
        for (const path of visible) if (!known.has(path)) next.add(path);
        /* A path that disappeared stops being "new". */ for (const path of [...next])
          if (!visible.has(path)) next.delete(path);
        knownPathsRef.current = visible;
        /* Same membership: keep the Set, so an idle refresh re-renders nothing. */ if (
          next.size === current.size &&
          [...next].every((path) => current.has(path))
        )
          return current;
        return next;
      });
      /* A tab whose file vanished outside the editor is marked, not silently kept. */ const open =
        openFilesRef.current;
      if (open.length === 0) return changedDirectories;
      try {
        const described = await callFs<Array<{ path?: string; exists?: boolean }>>({
          op: 'exists',
          paths: open.map((file) => file.path),
        });
        const vanished = new Set((described ?? []).filter((entry) => entry.exists !== true).map((entry) => entry.path));
        setDeletedPaths((current) => {
          /* Same membership: keep the Set so React skips the re-render. */ if (
            current.size === vanished.size &&
            [...vanished].every((path) => current.has(path))
          )
            return current;
          return vanished;
        });
      } catch {
        /* an unreadable workspace keeps the previous marks */
      }
      return changedDirectories;
    },
    [foldersFirst, loadRoot, showExcludedFiles, showHidden, sortMode],
  );
  /**
   * Write the editor's content back to a file that was deleted underneath it.
   *
   * "Reload from disk" cannot work here (there is nothing to read), so the
   * only sensible action is the opposite one: recreate the file from what the
   * user still has in front of them.
   * @returns {Promise<void>} resolves once the file exists again.
   */ const recreateActive = React.useCallback(async () => {
    const path = activePathRef.current;
    if (path === null) return;
    const model = modelsRef.current.get(path);
    if (model === undefined) return;
    try {
      /* `create` is required: a deleted file cannot be "overwritten", only recreated. */ const value = await callFs<{
        mtime?: number | null;
      }>({
        op: 'write',
        path,
        content: model.getValue(),
        force: true,
        create: true,
      });
      setOpenFiles((current) =>
        current.map((entry) =>
          entry.path === path
            ? {
                ...entry,
                content: model.getValue(),
                dirty: false,
                mtime: typeof value.mtime === 'number' ? value.mtime : entry.mtime,
              }
            : entry,
        ),
      );
      setExternalChanges((current) => {
        if (current[path] === undefined) return current;
        const next = { ...current };
        delete next[path];
        return next;
      });
      await refreshTree();
      await loadGit();
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : String(error));
    }
  }, [loadGit, refreshTree]);
  /**
   * Check out one local branch and bring the editor back in sync.
   *
   * IDEA asks before switching when the working tree has changes, because a
   * checkout can carry them into the other branch or refuse outright.
   * @param {string} name - local branch name.
   */ const checkoutBranch = React.useCallback(
    async (name: string) => {
      const dirty = (openFilesRef.current ?? []).some((file) => file.dirty === true);
      if (dirty && !window.confirm(t('editor.checkoutDirty'))) return;
      setCommitBusy(true);
      try {
        const value = await callGit<WorkspaceGitStatus>({
          op: 'checkout',
          branch: name,
        });
        setGit(value);
        setCommitSelection(new Set((value?.changes ?? []).map((change) => change.path)));
        setDiffTarget(null);
        setExternalChanges({});
        await refreshTree();
        /* A checkout rewrites the history the Log tab is showing; leaving the old
             rows there means acting on another branch's commits. */ setHistoryPath(null);
        await loadLog();
        setCommitNotice(t('editor.checkoutDone', { name }));
        /* A checkout can rewrite every file under the open tabs: re-read them all. */ for (const file of openFilesRef.current)
          await reloadFile(file.path);
      } catch (failure) {
        setCommitError(failure instanceof Error ? failure.message : String(failure));
      } finally {
        setCommitBusy(false);
      }
    },
    [loadLog, reloadFile, refreshTree, t],
  );
  /* Open IDEA's branch popup from a fresh local branch list. */ const openBranchMenu = React.useCallback(
    async (position: { x: number; y: number }) => {
      const requestId = ++branchMenuRequestRef.current;
      branchPromptOriginRef.current =
        typeof HTMLElement !== 'undefined' && document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setCommitBusy(true);
      setCommitError(null);
      try {
        const value = await callGit({ op: 'branches' });
        if (branchMenuRequestRef.current !== requestId) return;
        const names = Array.isArray(value?.branches) ? value.branches : [];
        const current = typeof value?.branch === 'string' ? value.branch : '';
        setMenu({
          owner: 'branch-menu',
          x: position?.x ?? 220,
          y: position?.y ?? 120,
          items: [
            {
              id: 'newBranch',
              label: t('editor.newBranchAction'),
              run: () =>
                openNamePrompt(
                  {
                    kind: 'branch',
                    title: t('editor.newBranchAction'),
                    placeholder: t('editor.newBranchPlaceholder'),
                    value: '',
                    error: '',
                  },
                  branchPromptOriginRef.current,
                ),
            },
            null,
            ...(names.length === 0
              ? [
                  {
                    id: 'none',
                    label: t('editor.noBranches'),
                    disabled: true,
                    run: () => {},
                  },
                ]
              : names.map((name) => ({
                  id: `branch:${name}`,
                  label: name,
                  shortcut: name === current ? '✓' : '',
                  run: () => {
                    if (name === current) return;
                    void checkoutBranch(name);
                  },
                }))),
          ],
        });
      } catch (failure) {
        if (branchMenuRequestRef.current !== requestId) return;
        setCommitError(failure instanceof Error ? failure.message : String(failure));
      } finally {
        if (branchMenuRequestRef.current === requestId) setCommitBusy(false);
      }
    },
    [checkoutBranch, openNamePrompt, t],
  );
  /**
   * Create the branch named in the prompt, then refresh everything a switch touches.
   *
   * Errors land back in the prompt instead of the Commit error bar: the user is
   * still looking at the field they have to fix, and a message in the panel
   * behind a modal reads as "nothing happened".
   * @returns {Promise<void>} resolves once the branch exists or the error is shown.
   */ const submitNamePrompt = React.useCallback(async () => {
    if (namePrompt === null) return;
    const name = namePrompt.value.trim();
    if (name === '') return;
    setCommitBusy(true);
    try {
      if (namePrompt.kind === 'tag') {
        /* A tag moves no HEAD and rewrites no file: only the graph's ref list
               changes, so the tree and open tabs stay untouched. */ const tagValue = await callGit({
          op: 'createTag',
          name,
          hash: namePrompt.hash,
        });
        setGit((current) => (current === null ? current : { ...current, ...tagValue }));
        finishNamePrompt();
        setCommitNotice(t('editor.tagCreated', { name: tagValue?.tag ?? name }));
        if (graph !== null) await loadGraph(graph.branch ?? '', graph.at ?? '');
        return;
      }
      const value = await callGit<WorkspaceGitStatus>({
        op: 'createBranch',
        name,
        ...(typeof namePrompt.hash === 'string' && namePrompt.hash !== '' ? { startPoint: namePrompt.hash } : {}),
      });
      setGit(value);
      setCommitSelection(new Set((value?.changes ?? []).map((change) => change.path)));
      setDiffTarget(null);
      setExternalChanges({});
      await refreshTree();
      setHistoryPath(null);
      await loadLog();
      finishNamePrompt();
      setCommitNotice(t('editor.branchCreated', { name: value?.created ?? name }));
      for (const file of openFilesRef.current) await reloadFile(file.path);
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : String(failure);
      setNamePrompt((current) => (current === null ? current : { ...current, error: message }));
    } finally {
      setCommitBusy(false);
    }
  }, [finishNamePrompt, graph, loadGraph, loadLog, namePrompt, reloadFile, refreshTree, t]);
  /**
   * Run one stash operation and bring the changes list back in sync.
   *
   * Stashing is the one action that empties the panel on purpose, so the
   * selection is rebuilt from the fresh status instead of being left stale.
   * @param {'save'|'pop'} operation - stash action.
   */ const runStash = React.useCallback(
    async (operation: 'save' | 'pop' | 'apply' | 'drop', ref?: string) => {
      if (operation === 'pop' && !window.confirm(t('editor.stashPopConfirm'))) return;
      if (operation === 'drop' && !window.confirm(t('editor.stashDropConfirm', { ref: ref ?? '' }))) return;
      setCommitBusy(true);
      setCommitError(null);
      setCommitNotice(null);
      try {
        const value = await callGit<WorkspaceGitStatus>({
          op: 'stash',
          action: operation,
          ...(ref === undefined ? {} : { ref }),
        });
        setGit(value);
        setCommitSelection(new Set((value?.changes ?? []).map((change) => change.path)));
        setDiffTarget(null);
        setCommitNotice(
          operation === 'save'
            ? t('editor.stashed')
            : operation === 'apply'
              ? t('editor.stashApplied', { ref: ref ?? '' })
              : operation === 'drop'
                ? t('editor.stashDropped', { ref: ref ?? '' })
                : t('editor.stashPopped'),
        );
        await refreshTree();
      } catch (failure) {
        setCommitError(failure instanceof Error ? failure.message : String(failure));
      } finally {
        setCommitBusy(false);
      }
    },
    [refreshTree, t],
  );
  /**
   * Run a shelf operation and refresh the same views as a stash operation.
   * @param {'save'|'apply'|'drop'} operation - shelf action.
   * @param {string} [ref] - shelf ref for apply/drop.
   * @param {string[]} [paths] - selected paths for save.
   * @returns {Promise<void>} resolves after the panel catches up.
   */ const runShelve = React.useCallback(
    async (operation: 'save' | 'apply' | 'drop', ref?: string, paths?: string[]) => {
      if (operation === 'drop' && !window.confirm(t('editor.shelveConfirmDrop', { ref: ref ?? '' }))) return;
      setCommitBusy(true);
      setCommitError(null);
      setCommitNotice(null);
      try {
        const value = await callGit<WorkspaceGitStatus>({
          op: 'shelve',
          action: operation,
          ...(Array.isArray(paths) ? { paths } : {}),
          ...(ref === undefined ? {} : { ref }),
        });
        setGit(value);
        setCommitSelection(new Set((value?.changes ?? []).map((change) => change.path)));
        setDiffTarget(null);
        setCommitNotice(
          operation === 'save'
            ? t('editor.shelved', { count: paths?.length ?? 0 })
            : operation === 'apply'
              ? t('editor.shelveApplied', { ref: ref ?? '' })
              : t('editor.shelveDropped', { ref: ref ?? '' }),
        );
        await refreshTree();
      } catch (failure) {
        setCommitError(failure instanceof Error ? failure.message : String(failure));
      } finally {
        setCommitBusy(false);
      }
    },
    [refreshTree, t],
  );
  /* Open IDEA's stash menu from the current stack. */ const openStashMenu = React.useCallback(
    async (position: { x: number; y: number }) => {
      const requestId = ++commitMenuRequestRef.current;
      setCommitBusy(true);
      setCommitError(null);
      try {
        const value = await callGit<WorkspaceGitStatus>({
          op: 'stash',
          action: 'list',
        });
        if (commitMenuRequestRef.current !== requestId) return;
        const entries = Array.isArray(value?.entries) ? value.entries : [];
        setMenu(
          stashMenu({
            t,
            position: {
              x: position?.x ?? 240,
              y: position?.y ?? 120,
            },
            entries,
            hasChanges: (git?.changes ?? []).length > 0,
            onRunStash: (operation, ref) => void runStash(operation, ref),
          }),
        );
      } catch (failure) {
        if (commitMenuRequestRef.current !== requestId) return;
        setCommitError(failure instanceof Error ? failure.message : String(failure));
      } finally {
        if (commitMenuRequestRef.current === requestId) setCommitBusy(false);
      }
    },
    [git, runStash, t],
  );
  /* Open IDEA's selected-path Shelve menu from the current shelves. */ const openShelveMenu = React.useCallback(
    async (position: { x: number; y: number }) => {
      const requestId = ++commitMenuRequestRef.current;
      setCommitBusy(true);
      setCommitError(null);
      try {
        const value = await callGit<WorkspaceGitStatus>({
          op: 'shelve',
          action: 'list',
        });
        if (commitMenuRequestRef.current !== requestId) return;
        const entries = Array.isArray(value?.entries) ? value.entries : [];
        const selected = [...commitSelection];
        setMenu(
          shelveMenu({
            t,
            position: {
              x: position?.x ?? 240,
              y: position?.y ?? 120,
            },
            entries,
            selectedPaths: selected,
            onRunShelve: (operation, ref, paths) => void runShelve(operation, ref, paths),
          }),
        );
      } catch (failure) {
        if (commitMenuRequestRef.current !== requestId) return;
        setCommitError(failure instanceof Error ? failure.message : String(failure));
      } finally {
        if (commitMenuRequestRef.current === requestId) setCommitBusy(false);
      }
    },
    [commitSelection, runShelve, t],
  );
  /* Batch delete for the Project tool window's multi-row selection. */ /**
   * Open tabs below one path that still hold unsaved edits.
   *
   * IDEA's delete dialog names them: deleting a directory silently throws away
   * the editor's copy of every dirty file under it, and "cannot be undone" does
   * not tell you WHAT is being lost.
   * @param {string} path - file or directory path being deleted.
   * @returns {string[]} workspace-relative paths with unsaved edits.
   */ const dirtyUnder = React.useCallback((path: string) => {
    if (typeof path !== 'string') return [];
    return (openFilesRef.current ?? [])
      .filter((file) => file.dirty === true && (file.path === path || file.path.startsWith(`${path}/`)))
      .map((file) => file.path);
  }, []);
  const removeEntries = React.useCallback(
    async (paths: string[]) => {
      const targets = paths.filter((path) => path !== '');
      if (targets.length === 0) return;
      if (!window.confirm(t('editor.deleteSelectedConfirm', { count: targets.length }))) return;
      /* Name the unsaved tabs first: they are what the delete actually destroys. */ const unsaved = targets.flatMap(
        (path) => dirtyUnder(path),
      );
      if (
        unsaved.length > 0 &&
        !window.confirm(
          t('editor.deleteDirty', {
            count: unsaved.length,
            files: unsaved.join(', '),
          }),
        )
      )
        return;
      setCommitBusy(true);
      try {
        for (const path of targets) {
          /* Deleting a parent first would make its children vanish from under us. */ await callFs({
            op: 'delete',
            path,
          }).catch(() => {});
        }
        await refreshTree();
        await loadGit();
        const active = activePathRef.current;
        if (active !== null && targets.some((path) => active === path || active.startsWith(`${path}/`)))
          closeFile(active);
      } catch (failure) {
        setTreeError(failure instanceof Error ? failure.message : String(failure));
      } finally {
        setCommitBusy(false);
      }
    },
    [closeFile, dirtyUnder, loadGit, refreshTree, t],
  );
  /* Delete one entry after confirmation, then refresh the tree and git status. */ const removeEntry =
    React.useCallback(
      async (row: ProjectRow) => {
        const label = row.path === '' ? projectName : row.path;
        if (!window.confirm(t('editor.deleteConfirm', { path: label }))) return;
        const unsaved = dirtyUnder(row.path);
        if (
          unsaved.length > 0 &&
          !window.confirm(
            t('editor.deleteDirty', {
              count: unsaved.length,
              files: unsaved.join(', '),
            }),
          )
        )
          return;
        try {
          await callFs({ op: 'delete', path: row.path });
          await refreshTree();
          await loadGit();
          if (
            activePathRef.current !== null &&
            (activePathRef.current === row.path || activePathRef.current.startsWith(`${row.path}/`))
          ) {
            closeFile(activePathRef.current);
          }
        } catch (failure) {
          setTreeError(failure instanceof Error ? failure.message : String(failure));
        }
      },
      [closeFile, dirtyUnder, loadGit, projectName, refreshTree, t],
    );
  /**
   * Compare each open tab's recorded mtime with the file on disk.
   *
   * IDEA reloads a clean file silently and only asks when the editor holds
   * unsaved work, so a clean tab adopts the new content and a dirty tab gets
   * the banner. A file that vanished stays listed so the banner can say so.
   * @returns {Promise<void>} resolves once every open tab has been checked.
   */ const checkExternalChanges = React.useCallback(async () => {
    const open = openFilesRef.current.filter((file) => file.mtime !== null && file.mtime !== undefined);
    if (open.length === 0) return;
    let described: Array<{ path?: string; exists?: boolean; mtime?: number | null }> | undefined;
    try {
      described = await callFs({
        op: 'exists',
        paths: open.map((file) => file.path),
      });
    } catch {
      return;
    }
    const findings: Record<string, { missing: boolean; diskMtime: number | null }> = {};
    for (const entry of described ?? []) {
      const current = open.find((file) => file.path === entry.path);
      if (current === undefined) continue;
      if (entry.exists !== true) {
        findings[current.path] = { missing: true, diskMtime: null };
        continue;
      }
      /* mtime is the cheap signal; an unchanged file costs nothing further. */ if (
        typeof entry.mtime === 'number' &&
        Math.abs(entry.mtime - current.mtime) <= 1
      )
        continue;
      findings[current.path] = {
        missing: false,
        diskMtime: entry.mtime ?? null,
      };
    }
    const paths = Object.keys(findings);
    if (paths.length === 0) {
      setExternalChanges((current) => (Object.keys(current).length === 0 ? current : {}));
      return;
    }
    /* A clean tab silently adopts the disk version; only unsaved work needs a prompt. */ const clean = paths.filter(
      (path) => openFilesRef.current.find((file) => file.path === path)?.dirty !== true,
    );
    for (const path of clean) {
      try {
        const file = openFilesRef.current.find((entry) => entry.path === path) ?? null;
        const value = await callFs<{ content?: string; mtime?: number | null }>({
          op: workspaceReloadOperation(file),
          path,
        });
        if (file?.kind !== 'image') {
          const model = modelsRef.current.get(path);
          if (model !== undefined) {
            /* Replace content without marking the model dirty. */ silentReloadRef.current.add(path);
            try {
              model.setValue(value.content);
              model.pushStackElement?.();
            } finally {
              silentReloadRef.current.delete(path);
            }
          }
        }
        setOpenFiles((list) =>
          list.map((entry) => (entry.path === path ? workspaceFileAfterReload(entry, value) : entry)),
        );
        delete findings[path];
      } catch {
        /* an unreadable file keeps its banner instead of silently vanishing */
      }
    }
    setExternalChanges(findings);
  }, []);
  /**
   * Follow the workspace's real filesystem changes (SSE from the host).
   *
   * The 4-second git-signature poll this replaces had three faults: it missed
   * changes for up to 4s, it re-read the WHOLE tree on any change (which is
   * what made the list flash), and it never fired at all outside a repository.
   * The host now watches the directory tree and reports which directories
   * changed, so only those listings are re-read; unchanged ones keep their
   * array identity and re-render nothing.
   */ React.useEffect(() => {
    if (root === '') return undefined;
    const sessionId = currentSessionId();
    if (sessionId === '' && workspaceId === '') return undefined;
    const controller = new AbortController();
    let disposed = false;
    let chain = Promise.resolve();
    const handle = (event: { type?: string; dirs?: unknown[]; message?: unknown }) => {
      if (disposed) return;
      if (event.type === 'change') {
        const changedDirectories = Array.isArray(event.dirs)
          ? event.dirs.filter((directory): directory is string => typeof directory === 'string')
          : null;
        /* Serialize: two overlapping refreshes would interleave their state
               writes and one could resurrect a listing the other just dropped. */ chain = chain
          .then(async () => {
            if (disposed) return;
            /* The watcher names the directories that changed; without that hint
                   only the root is re-read. */ const changedListings = await refreshTree(
              changedDirectories === null ? undefined : changedDirectories,
            );
            await loadGit();
            await checkExternalChanges();
            setMarkdownAssetRevisions((current) => nextMarkdownAssetRevisions(current, changedListings));
          })
          .catch(() => {
            /* a Session that went away mid-refresh just stops reporting */
          });
        return;
      }
      if (event.type === 'error') {
        /* The watcher is best-effort: keep the tree usable without it. */ console.warn(
          'dsh-editor: file watch failed',
          event.message,
        );
      }
    };
    const url = `api/dsh-editor/watch?sessionId=${encodeURIComponent(sessionId)}&workspaceId=${encodeURIComponent(workspaceId)}`;
    fetch(url, {
      signal: controller.signal,
      headers: { accept: 'text/event-stream' },
    })
      .then((response) => {
        if (!response.ok) throw new Error(`file watch HTTP ${response.status}`);
        return readEventStream(response, handle, controller.signal);
      })
      .catch((failure) => {
        if (controller.signal.aborted || disposed) return;
        console.warn(
          'dsh-editor: file watch disconnected',
          failure instanceof Error ? failure.message : String(failure),
        );
      });
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [checkExternalChanges, loadGit, refreshTree, root, workspaceId]);
  /* Notice edits made outside the editor (another window, a shell, an agent).
         A slow backstop for the watcher: it still catches what `fs.watch` misses
         (network mounts, editors that swap the inode) and keeps git status fresh
         even when the filesystem is quiet. */ const signatureRef = React.useRef('');
  React.useEffect(() => {
    return startVisibilityGatedPoll(async () => {
      const value = await callGit<{ signature?: string }>({ op: 'signature' });
      const signature = typeof value?.signature === 'string' ? value.signature : '';
      if (signature === '') return;
      if (signatureRef.current === '') {
        signatureRef.current = signature;
        return;
      }
      if (signature === signatureRef.current) return;
      signatureRef.current = signature;
      await loadGit();
      const changedListings = await refreshTree();
      await checkExternalChanges();
      setMarkdownAssetRevisions((current) => nextMarkdownAssetRevisions(current, changedListings));
    }, 8000);
  }, [checkExternalChanges, loadGit, refreshTree]);
  const applySortMode = React.useCallback((next: string) => {
    setSortMode(next);
    try {
      window.localStorage.setItem('dsh-editor.project.sort', next);
    } catch {
      /* a storage-less browser keeps the in-memory mode */
    }
  }, []);
  /* Cycle IDEA's Project sort actions in their menu order. */ const cycleSort = React.useCallback(() => {
    setSortMode((current) => {
      const order = ['name', 'type', 'modified', 'modified-asc', 'manual'];
      const next = order[(order.indexOf(current) + 1) % order.length];
      try {
        window.localStorage.setItem('dsh-editor.project.sort', next);
      } catch {
        /* a storage-less browser keeps the in-memory mode */
      }
      return next;
    });
  }, []);
  /**
   * Reorder siblings for IDEA Manual Order without touching the filesystem.
   * Cross-directory drops are intentionally ignored: manual ranks are stored
   * per parent, so accepting a foreign child would fabricate a tree edge.
   */ const reorderManualProject = React.useCallback(
    (sources: string[], target: string, edge: 'before' | 'after') => {
      if (sortMode !== 'manual' || typeof target !== 'string' || target === '') return;
      const parent = dirname(target);
      const listing = parent === '' ? entries : children[parent];
      if (!Array.isArray(listing)) return;
      const siblings = new Set(listing.map((entry) => entry.path));
      const moving = (Array.isArray(sources) ? sources : []).filter(
        (path) => siblings.has(path) && dirname(path) === parent,
      );
      if (moving.length === 0) {
        flashStatus(t('editor.manualOrderSameDirectory'));
        return;
      }
      setManualOrder((current) => {
        const ordered = orderProjectEntriesByManual(listing, current[parent]);
        const paths = reorderProjectManualPaths(
          ordered.map((entry) => entry.path),
          moving,
          target,
          edge === 'after' ? 'after' : 'before',
        );
        const next = { ...current, [parent]: paths };
        writeProjectManualOrder(root, next);
        return next;
      });
    },
    [children, entries, flashStatus, root, sortMode, t],
  );
  /**
   * Keep the selected row on screen across a re-sort.
   *
   * Changing the order re-reads the root, and the selected file lands wherever
   * the new order puts it — often below the fold. IDEA keeps the row you were
   * on visible, so the tree is scrolled back to it once the new listing has
   * rendered (the row may not exist for a frame, hence the bounded retry).
   * @returns {void}
   */ React.useEffect(() => {
    if (sortAppliedRef.current === '') {
      sortAppliedRef.current = sortMode;
      return;
    }
    if (sortAppliedRef.current === sortMode) return;
    sortAppliedRef.current = sortMode;
    const path = selectedPathRef.current;
    if (path === null || path === '') return;
    let tries = 0;
    const tick = () => {
      const row = rowRefs.current.get(path);
      if (row !== undefined) {
        row.scrollIntoView({ block: 'nearest' });
        return;
      }
      tries += 1;
      if (tries < 20) window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  }, [sortMode]);
  /**
   * Toggle IDEA's "Open Files with Single Click" Project View preference.
   *
   * The choice is application-wide, like IntelliJ's Project View option; it
   * is not keyed by workspace. Directory rows keep their own expand gesture.
   * @returns {void}
   */ const toggleSingleClickOpen = React.useCallback(() => {
    setSingleClickOpen((current) => {
      const next = !current;
      try {
        window.localStorage.setItem('dsh-editor.project.singleClickOpen', next ? '1' : '0');
        window.localStorage.removeItem('dsh-editor.project.autoscrollToSource');
      } catch {
        /* a storage-less browser keeps the in-memory choice */
      }
      return next;
    });
  }, []);
  const toggleOpenDirectoriesSingleClick = React.useCallback(() => {
    setOpenDirectoriesSingleClick((current) => {
      const next = !current;
      try {
        window.localStorage.setItem('dsh-editor.project.openDirectoriesSingleClick', next ? '1' : '0');
      } catch {
        /* a storage-less browser keeps the in-memory choice */
      }
      return next;
    });
  }, []);
  const togglePreviewTab = React.useCallback(() => {
    setPreviewTabEnabled((current) => {
      const next = !current;
      try {
        window.localStorage.setItem('dsh-editor.project.previewTab', next ? '1' : '0');
      } catch {
        /* a storage-less browser keeps the in-memory choice */
      }
      return next;
    });
  }, []);
  const toggleFoldersFirst = React.useCallback(() => {
    const next = !foldersFirstRef.current;
    foldersFirstRef.current = next;
    setFoldersFirst(next);
    try {
      window.localStorage.setItem('dsh-editor.project.foldersFirst', next ? '1' : '0');
    } catch {
      /* a storage-less browser keeps the in-memory choice */
    }
    /* Apply immediately with the explicit next value; the state effect will
           later keep handling external preference changes/dependency refreshes. */ void loadRoot(next);
  }, [loadRoot]);
  const toggleCompactDirectories = React.useCallback(() => {
    setCompactDirectories((current) => {
      const next = !current;
      try {
        window.localStorage.setItem('dsh-editor.project.compactDirectories', next ? '1' : '0');
      } catch {
        /* a storage-less browser keeps the in-memory choice */
      }
      return next;
    });
  }, []);
  const toggleShowExcludedFiles = React.useCallback(() => {
    setShowExcludedFiles((current) => {
      const next = !current;
      try {
        window.localStorage.setItem('dsh-editor.project.showExcludedFiles', next ? '1' : '0');
      } catch {
        /* a storage-less browser keeps the in-memory choice */
      }
      return next;
    });
  }, []);
  /* Start the inline create row in the selected directory. */ const startCreate = React.useCallback(
    (kind: 'file' | 'directory', explicitParent?: string) => {
      let parent = typeof explicitParent === 'string' ? explicitParent : '';
      if (typeof explicitParent !== 'string') {
        const selected = selectedPath;
        if (selected !== null && selected !== '') {
          const row = rows.find((entry) => entry.path === selected);
          parent = row?.kind === 'directory' ? selected : dirname(selected);
        }
      }
      setActivity('project');
      setPanelVisible(true);
      /* Templates are on by default, like IDEA's New-from-Template dialog. */ setCreateState({
        kind,
        parent,
        value: '',
        template: true,
      });
    },
    [rows, selectedPath],
  );
  const createEntry = React.useCallback(async () => {
    if (createState === null) return;
    const name = createState.value.trim();
    if (name === '' || name.includes('/') || name === '.' || name === '..') {
      setTreeError(t('editor.invalidNameNoSlashes'));
      return;
    }
    const path = createState.parent === '' ? name : `${createState.parent}/${name}`;
    try {
      await callFs({ op: 'create', path, kind: createState.kind });
      /* IDEA's "New from Template": a named file gets the language's skeleton
             instead of a zero-byte file. The host creates first and the content
             follows, so a template failure cannot leave no file at all. Only when
             the user kept the toggle on (it is on by default, as in IDEA). */ if (
        createState.kind === 'file' &&
        createState.template !== false
      ) {
        const skeleton = templateFor(name);
        if (skeleton !== '') {
          await callFs({
            op: 'write',
            path,
            content: skeleton,
            force: true,
            create: true,
          }).catch(() => {});
        }
      }
      const value = await callFs<{ entries?: WorkspaceEntry[] }>({
        op: 'list',
        path: createState.parent,
        showHidden,
        sort: sortMode,
        foldersFirst,
        showExcluded: showExcludedFiles,
      });
      if (createState.parent === '') setEntries(Array.isArray(value.entries) ? value.entries : []);
      else
        setChildren((current) => ({
          ...current,
          [createState.parent]: value.entries ?? [],
        }));
      setExpanded((current) => {
        const next = new Set(current);
        next.add(createState.parent);
        return next;
      });
      setSelectedPath(path);
      setCreateState(null);
      setTreeError(null);
      /* IDEA drops straight into "rename" on a freshly created entry. */ setRenameState({
        path,
        value: name,
        fresh: true,
      });
      if (createState.kind === 'file') await openFile(path);
    } catch (error) {
      setTreeError(error instanceof Error ? error.message : String(error));
    }
  }, [createState, foldersFirst, openFile, showExcludedFiles, showHidden, sortMode, t]);
  /* IDEA's "Reveal in Finder": hand the absolute path to the platform file manager. */ const revealInFinder =
    React.useCallback(async (path: string) => {
      try {
        await callFs({ op: 'reveal', path });
      } catch (failure) {
        setTreeError(failure instanceof Error ? failure.message : String(failure));
      }
    }, []);
  /**
   * IDEA's "Open in Terminal": reveal the dock and start a shell in that directory.
   *
   * The dock only knows the Session workspace, so a subdirectory is reached by
   * committing `cd <relative>` to the new shell — the same thing a user does.
   * @param {string} relativeDirectory - workspace-relative directory to enter.
   */ const openInTerminal = React.useCallback((relativeDirectory: string) => {
    pendingTerminalPath.current = relativeDirectory;
    setTerminalStartDirectory(relativeDirectory);
    setTerminalOpen(true);
    setTerminalGeneration((generation) => generation + 1);
  }, []);
  const restage = React.useCallback(async (paths: string[], staged: boolean) => {
    if (paths.length === 0) return false;
    setCommitBusy(true);
    setCommitError(null);
    try {
      const value = await callGit<WorkspaceGitStatus>({
        op: 'stage',
        paths,
        staged,
      });
      setGit(value);
      setCommitSelection((current) => {
        const next = new Set(
          [...current].filter((path) => (value?.changes ?? []).some((change) => change.path === path)),
        );
        return next;
      });
      setDiffTarget(null);
      return true;
    } catch (failure) {
      setCommitError(failure instanceof Error ? failure.message : String(failure));
      return false;
    } finally {
      setCommitBusy(false);
    }
  }, []);
  /* The ⌘⇧A/⌥⌘A handler is registered once, so it reaches the stager by ref. */ restageRef.current = restage;
  /**
   * Stage every working-side change, with an optional tracked-only scope.
   *
   * IDEA's Stage All is a deliberate "include all" action. Keep those paths
   * ticked for the next commit instead of staging them while leaving the
   * commit box empty, which would make the command appear to do nothing.
   * @param {boolean} [trackedOnly=false] - skip untracked files.
   * @returns {Promise<void>} resolves after the index and selection settle.
   */ const stageEveryChange = React.useCallback(
    async (trackedOnly = false) => {
      const paths = stageAllTargets(git?.changes ?? [], trackedOnly === true);
      if (paths.length === 0) return;
      const staged = await restage(paths, false);
      if (!staged) return;
      setCommitSelection((current) => new Set([...current, ...paths]));
    },
    [git, restage],
  );
  /**
   * Apply a Group by choice and keep the current Change row visible.
   *
   * A key collapsed in the old grouping can still fold the selected file in
   * the new tree. Clear every group/ancestor key for that file, then restore
   * keyboard focus so Show Diff and the row shortcuts keep the same target.
   * @param {'flat'|'module'|'directory'} mode - chosen grouping.
   * @param {boolean} [focusAfterApply=true] - leave focus in the menu or move it to the selected row/list.
   * @returns {void}
   */ const applyChangeGroupBy = React.useCallback(
    (mode: string, focusAfterApply = true) => {
      setGroupBy(mode);
      try {
        window.localStorage.setItem('dsh-editor.commit.groupBy', mode);
      } catch {
        /* a storage-less browser keeps the in-memory mode */
      }
      const selected = selectedChangeRef.current;
      if (selected === null) {
        if (!focusAfterApply) return;
        window.setTimeout(() => {
          const list = commitChangesRef.current;
          if (list !== null && list.isConnected !== false) {
            list.focus({ preventScroll: true });
            return;
          }
          focusWorkspaceFallback(document.querySelector<HTMLElement>('[data-dsh-editor-workspace]'));
        }, 0);
        return;
      }
      if (focusAfterApply) {
        groupByFocusRef.current = {
          path: selected.path,
          staged: selected.staged === true,
        };
      }
      revealChangeRow(selected);
    },
    [commitChangesRef, revealChangeRow],
  );
  /**
   * IDEA's Changes "View Options" entry.
   *
   * The available view preference is Group by. Reuse the same value menu as
   * Commit Options so the two entry points cannot drift.
   * @param {{x: number, y: number}} position - toolbar anchor.
   * @returns {void}
   */ const openChangesViewMenu = React.useCallback(
    (position: { x: number; y: number }) => {
      const anchor = {
        x: position?.x ?? 240,
        y: position?.y ?? 120,
      };
      const build = (mode: string): void => {
        setMenu(
          changesViewOptionsMenu({
            t,
            position: anchor,
            groupBy: mode,
            onApplyChangeGroupBy: (nextMode) => {
              applyChangeGroupBy(nextMode, false);
              build(nextMode);
            },
          }),
        );
      };
      build(groupBy);
    },
    [applyChangeGroupBy, groupBy, t],
  );
  /**
   * Open IDEA's "Move to…" picker for the current tree selection.
   *
   * Ask the host for every directory: expanded rows would hide unopened move targets.
   * @param {string|string[]} [target] - one path or a batch; defaults to the selection.
   * @returns {Promise<void>} resolves once the picker is on screen.
   */ const closeMoveTo = React.useCallback(() => {
    moveToRequestRef.current += 1;
    moveToAbortRef.current?.abort();
    moveToAbortRef.current = null;
    setMoveTo(null);
    restorePaletteFocus();
  }, [restorePaletteFocus]);
  const openMoveTo = React.useCallback(
    async (target?: string | string[]) => {
      const raw = Array.isArray(target) ? target : target === undefined ? [...selection] : [target];
      /* The root row is a directory but moving the root into itself is meaningless. */ const sources = raw.filter(
        (path) => typeof path === 'string' && path !== '',
      );
      if (sources.length === 0) return;
      const parent = sources.length === 1 ? dirname(sources[0]) : '';
      rememberPaletteOrigin();
      const requestId = ++moveToRequestRef.current;
      moveToAbortRef.current?.abort();
      const searchAbort = new AbortController();
      moveToAbortRef.current = searchAbort;
      setMoveTo({
        sources,
        parent,
        query: '',
        index: 0,
        loading: true,
        directories: [],
        rootName: projectName,
      });
      try {
        const value = await callFs<{ directories?: string[] }>({ op: 'directories' }, { signal: searchAbort.signal });
        if (moveToRequestRef.current !== requestId) return;
        const directories = (Array.isArray(value.directories) ? value.directories : []).filter(
          (path) => typeof path === 'string',
        );
        setMoveTo((current) => (current === null ? current : { ...current, loading: false, directories }));
      } catch (failure) {
        if (failure?.name === 'AbortError' || failure?.name === 'CanceledError') return;
        if (moveToRequestRef.current !== requestId) return;
        closeMoveTo();
        setTreeError(failure instanceof Error ? failure.message : String(failure));
      } finally {
        if (moveToAbortRef.current === searchAbort) moveToAbortRef.current = null;
      }
    },
    [closeMoveTo, projectName, rememberPaletteOrigin, selection],
  );
  /* IDEA's project-tree context menu: new/rename/delete/reveal/copy path. */ const buildTreeMenu = React.useCallback(
    ({ row, x, y }: { row: ProjectRow; x: number; y: number }): WorkspaceMenuModel => {
      const { isDirectory, isRoot, showDirectoryActions, showFileActions, showReveal } = projectRowMenuCapabilities(
        row,
        filteredView,
      );
      /* Where a NEW entry lands: beside the clicked entry, which is inside a
             clicked directory and next to a clicked file. Rename cannot reuse this
             — it keeps the entry in its own parent — so it derives its own
             destination (see `commitRename`). */ const createParent = isDirectory ? row.path : dirname(row.path);
      /* A right-click inside a multi-row selection acts on all selected rows. */ const selectedRows = selection.has(
        row.path,
      )
        ? rows.filter((entry) => selection.has(entry.path) && entry.path !== '')
        : [];
      const batch = selectedRows.length > 1 ? selectedRows : [];
      const splitCandidates = projectRightSplitPaths(rows, selection, row.path);
      const harnessEntries =
        batch.length > 1
          ? batch.map((entry) => ({
              path: entry.path,
              isDirectory: entry.kind === 'directory',
            }))
          : [{ path: row.path, isDirectory }];
      return {
        x,
        y,
        /* IDEA tells you how many rows a context action will touch. */ title:
          batch.length > 1 ? t('editor.selectionCount', { count: batch.length }) : null,
        items: [
          buildHarnessPathAction(harnessEntries),
          null,
          {
            id: 'newFile',
            label: t('editor.newFile'),
            shortcut: '⌥⌘N',
            ariaKeyShortcuts: 'Alt+Meta+N Control+Alt+N',
            /* Enabled on files too: the new entry goes beside the clicked
                   one. Greying it out on a file looked like "disabled because
                   something is wrong" and forced a trip through its folder. */ disabled: batch.length > 1,
            run: () => startCreate('file', createParent),
          },
          {
            id: 'newFolder',
            label: t('editor.newFolder'),
            disabled: batch.length > 1,
            run: () => startCreate('directory', createParent),
          },
          null,
          {
            id: 'rename',
            label: t('editor.rename'),
            shortcut: '⇧F6',
            ariaKeyShortcuts: 'Shift+F6',
            disabled: isRoot || batch.length > 1,
            run: () => setRenameState({ path: row.path, value: basename(row.path) }),
          },
          {
            id: 'moveTo',
            label: t('editor.moveTo'),
            shortcut: 'F6',
            ariaKeyShortcuts: 'F6',
            disabled: isRoot,
            /* A batch keeps its members' names, so the picker collects them all. */ run: () =>
              void openMoveTo(batch.length > 1 ? batch.map((entry) => entry.path) : row.path),
          },
          {
            id: 'delete',
            label: batch.length > 1 ? t('editor.deleteSelected', { count: batch.length }) : t('editor.delete'),
            shortcut: '⌫',
            ariaKeyShortcuts: 'Backspace',
            danger: true,
            disabled: isRoot,
            run: (): void =>
              void (batch.length > 1 ? removeEntries(batch.map((entry) => entry.path)) : removeEntry(row)),
          },
          null,
          {
            id: 'openRightSplit',
            label: t('editor.openInSplit'),
            disabled: isRoot || splitCandidates.length === 0,
            run: () => void openInRightSplit(splitCandidates),
          },
          ...(showReveal
            ? [
                {
                  id: 'reveal',
                  label: isDirectory ? t('editor.expandFolder') : t('editor.revealInProject'),
                  run: () => {
                    if (isDirectory) {
                      setExpanded((current) => new Set([...current, row.path]));
                    } else {
                      void revealPath(row.path);
                    }
                  },
                },
              ]
            : []),
          {
            id: 'openTerminal',
            label: t('editor.openInTerminal'),
            run: () => void openInTerminal(isDirectory ? row.path : dirname(row.path)),
          },
          {
            id: 'refresh',
            label: t('editor.refresh'),
            shortcut: '⌘R',
            ariaKeyShortcuts: 'Meta+R Control+R',
            run: (): void => void refreshTree(),
          },
          {
            id: 'revealFinder',
            label: t('editor.revealInFinder'),
            run: () => void revealInFinder(row.path),
          },
          {
            id: 'history',
            label: t('editor.showHistory'),
            disabled: isRoot,
            run: () => void showFileHistory(row.path),
          },
          ...(showFileActions
            ? [
                {
                  id: 'compareClipboard',
                  label: t('editor.compareWithClipboard'),
                  run: (): void => void compareWithClipboard(row.path),
                },
                {
                  id: 'compareRevision',
                  label: t('editor.compareWithRevision'),
                  run: (): void => void compareWithRevision(row.path),
                },
              ]
            : []),
          ...(showDirectoryActions
            ? [
                {
                  id: 'stageHere',
                  label: t('editor.stageThisDirectory'),
                  disabled: batch.length > 1 || (git?.changes ?? []).length === 0,
                  run: () => {
                    const inside = (git?.changes ?? [])
                      .filter((change) => change.path === row.path || change.path.startsWith(`${row.path}/`))
                      .map((change) => change.path);
                    if (inside.length > 0) void restage(inside, false);
                  },
                },
                {
                  id: 'unstageHere',
                  label: t('editor.unstageThisDirectory'),
                  disabled: batch.length > 1 || (git?.changes ?? []).length === 0,
                  run: () => {
                    const inside = (git?.changes ?? [])
                      .filter(
                        (change) =>
                          (change.path === row.path || change.path.startsWith(`${row.path}/`)) &&
                          change.staged === true,
                      )
                      .map((change) => change.path);
                    if (inside.length > 0) void restage(inside, true);
                  },
                },
              ]
            : []),
          null,
          {
            id: 'copyReference',
            label: t('editor.copyPathReference'),
            items: copyReferenceMenuItems({
              entries: batch.length > 1 ? batch : [{ path: row.path, isDirectory }],
              root,
              t,
              editor: currentCodeEditor(),
              editorPath: currentCodePath(),
              writeText: (value) => navigator.clipboard?.writeText(value),
            }),
          },
        ],
      };
    },
    [
      compareWithClipboard,
      compareWithRevision,
      currentCodeEditor,
      currentCodePath,
      filteredView,
      git,
      openInRightSplit,
      openInTerminal,
      openMoveTo,
      refreshTree,
      removeEntries,
      removeEntry,
      restage,
      revealInFinder,
      revealPath,
      root,
      rows,
      selection,
      showFileHistory,
      startCreate,
      t,
      toggleDirectory,
      buildHarnessPathAction,
    ],
  );
  const uploadDropBusyRef = React.useRef<ProjectUploadBusyState>({ current: false });
  const uploadDroppedEntries = React.useCallback(
    (handles: Parameters<typeof uploadWorkspaceDropToProject>[0]['handles'], targetDirectory: string) =>
      uploadWorkspaceDropToProject({
        handles,
        targetDirectory,
        callFs,
        refreshTree: async () => {
          await refreshTree();
        },
        loadGit: async () => {
          await loadGit();
        },
        uploadBusyRef: uploadDropBusyRef.current,
        setExpanded,
        setChildren: (updater) => setChildren((current) => updater(current) as Record<string, WorkspaceEntry[]>),
        setEntries: (nextEntries) => setEntries(nextEntries as WorkspaceEntry[]),
        setTreeError,
        flashStatus,
        applyTreeSelection,
        showHidden,
        sortMode,
        foldersFirst,
        showExcludedFiles,
        projectName,
        setUploadBusy,
        setUploadProgress,
        t,
      }),
    [
      applyTreeSelection,
      flashStatus,
      foldersFirst,
      loadGit,
      projectName,
      refreshTree,
      showExcludedFiles,
      showHidden,
      sortMode,
      t,
    ],
  );
  /* Move one entry into a directory by drag-and-drop, reusing the rename endpoint. */ const moveEntry =
    React.useCallback(
      async (source: string | string[], targetDirectory: string) => {
        /* A multi-row drag arrives as a list; a single row drag as one string. */ const sources = (
          Array.isArray(source) ? source : [source]
        ).filter((entry) => typeof entry === 'string' && entry !== '');
        if (sources.length === 0) return;
        /* Plan the whole selection first: a destination that already exists (or
             a batch whose members share a basename) is refused BEFORE the first
             rename, so a failed drag never leaves the tree half-moved.
             The candidate destinations are ASKED OF THE HOST, not read off the
             visible rows: a collapsed directory's children are not in `rows`, and
             a collision with one of them used to slip through and silently
             overwrite the file. */ const candidate = sources
          .filter((entry) => !(targetDirectory === entry || targetDirectory.startsWith(`${entry}/`)))
          .map((entry) => (targetDirectory === '' ? basename(entry) : `${targetDirectory}/${basename(entry)}`));
        const described: Array<{ path?: string; exists?: boolean }> =
          candidate.length === 0
            ? []
            : await callFs<Array<{ path?: string; exists?: boolean }>>({ op: 'exists', paths: candidate }).catch(
                (): Array<{ path?: string; exists?: boolean }> => [],
              );
        const taken = new Set((described ?? []).filter((entry) => entry.exists === true).map((entry) => entry.path));
        const existing = new Set([...rows.map((row) => row.path), ...taken]);
        const plan = planMoves(sources, targetDirectory, existing);
        if (plan.moves.length === 0) {
          if (plan.intoSelf.length > 0) setTreeError(t('editor.moveIntoSelf'));
          else if (plan.conflicts.length > 0) setTreeError(t('editor.moveConflict', { path: plan.conflicts[0].to }));
          return;
        }
        const moved: Record<string, string> = {};
        try {
          for (const move of plan.moves) {
            await callFs({ op: 'rename', path: move.from, to: move.to });
            moved[move.from] = move.to;
          }
          const entries = Object.entries(moved);
          if (entries.length === 0) return;
          /* The refusal sentence names what DID move; built once, shown after
               the refresh (which clears `treeError`). */ const summary = describeMoveResult({
            moved: entries.map(([, to]) => to),
            conflicts: plan.conflicts,
            target: targetDirectory,
          });
          const moveNotice =
            summary === null
              ? null
              : summary.blocked ===
                  undefined /* A clean move still needs an acknowledgement: silence reads like a no-op. */
                ? t('editor.movedCount', {
                    count: summary.done,
                    target: summary.target === '' ? t('editor.projectRoot') : summary.target,
                  })
                : describeMoved(
                    entries.map(([, to]) => to),
                    summary.blocked,
                    t,
                  );
          /* Open tabs, previews, comparisons and Models follow their files. */ remapEditorPaths(entries);
          remapProjectExpandedPathsForMoves(entries);
          remapProjectManualOrderForMoves(entries);
          const movedPaths = entries.map(([, to]) => to);
          const primary = movedPaths[movedPaths.length - 1] ?? null;
          applyTreeSelection(new Set(movedPaths), primary, primary);
          await refreshTree();
          await loadGit();
          /* After the refresh, not before: `refreshTree` reloads the root and
               that reload clears `treeError`, so a message set first was wiped
               before it could be read. */ setTreeError(moveNotice);
        } catch (failure) {
          setTreeError(failure instanceof Error ? failure.message : String(failure));
        }
      },
      [
        applyTreeSelection,
        loadGit,
        refreshTree,
        remapEditorPaths,
        remapProjectExpandedPathsForMoves,
        remapProjectManualOrderForMoves,
        rows,
        t,
      ],
    );
  /* Resolve one conflicted file by taking ours/theirs, then refresh the change list. */ const resolveConflict =
    React.useCallback(
      async (paths: string[], side: 'ours' | 'theirs') => {
        if (paths.length === 0) return;
        const resolvedPaths = new Set(paths);
        setCommitBusy(true);
        setCommitError(null);
        try {
          const value = await callGit<WorkspaceGitStatus>({
            op: 'resolve',
            paths,
            side,
          });
          setGit(value);
          const next = (value?.changes ?? []).find((change) => resolvedPaths.has(change.path));
          const staged = next !== undefined && next.status[0] !== ' ' && next.status[0] !== '?';
          if (next !== undefined && staged) {
            setSelectedChange({ path: next.path, staged });
            setSelectedChanges(new Set([`${staged ? 'staged' : 'unstaged'}:${next.path}`]));
            const key = `${staged ? 'staged' : 'unstaged'}:${next.path}`;
            selectedChangesRef.current = new Set([key]);
            changeSelectionAnchorRef.current = { key };
          }
          setDiffTarget(null);
          await refreshTree();
          if (next !== undefined && staged) {
            const key = `staged:${next.path}`;
            window.setTimeout(() => {
              const row = changeRowRefs.current.get(key);
              if (row?.isConnected !== true) return;
              row.focus?.();
            }, 0);
          }
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setCommitBusy(false);
        }
      },
      [refreshTree],
    );
  /* IDEA's change-list menu: show diff, stage/unstage, roll back the working-tree edits. */ /**
   * Apply one history rewrite action and bring the panel back in sync.
   *
   * A stopped cherry-pick or revert leaves the repository mid-operation, so
   * the failure stays visible as an error with git's own first line instead
   * of being reported as a generic success.
   * @param {'cherryPick'|'revert'} operation - git action to run.
   * @param {string} hash - commit to act on.
   *//**
   * Check out one commit (IDEA's "Checkout Revision").
   *
   * Detached HEAD is destructive-looking but reversible, so it asks once and then
   * refreshes both the tree and the graph — the working tree contents change.
   * @param {string} hash - commit to check out.
   * @returns {Promise<void>} resolves when the refresh finishes.
   */ const checkoutRevision = React.useCallback(
    async (hash: string) => {
      if (typeof hash !== 'string' || hash === '') return;
      if (!window.confirm(t('editor.checkoutRevisionConfirm', { hash: hash.slice(0, 7) }))) return;
      setCommitBusy(true);
      setCommitError(null);
      setCommitNotice(null);
      try {
        const value = await callGit<WorkspaceGitStatus>({
          op: 'checkoutRevision',
          hash,
        });
        setGit(value);
        setCommitSelection(new Set());
        setDiffTarget(null);
        setCommitNotice(t('editor.checkoutRevisionDone', { hash: hash.slice(0, 7) }));
        await refreshTree();
        await loadLog();
      } catch (failure) {
        setCommitError(failure instanceof Error ? failure.message : String(failure));
      } finally {
        setCommitBusy(false);
      }
    },
    [loadLog, refreshTree, t],
  );
  /**
   * Reset the active branch to one log row using Git's soft/mixed/hard modes.
   * Hard reset is destructive: the confirmation names the commit and the
   * number of unsaved Editor tabs whose models will be overwritten.
   * @param {string} hash - target commit.
   * @param {'soft'|'mixed'|'hard'} mode - reset mode.
   * @returns {Promise<void>} resolves after history/tree state refresh.
   */ const resetBranchHere = React.useCallback(
    async (hash: string, mode: 'soft' | 'mixed' | 'hard') => {
      if (typeof hash !== 'string' || hash === '') return;
      const shortHash = hash.slice(0, 7);
      const modeLabel =
        mode === 'soft' ? t('editor.resetSoft') : mode === 'hard' ? t('editor.resetHard') : t('editor.resetMixed');
      const dirty = openFilesRef.current.filter((file) => file.dirty === true).length;
      const confirmation =
        mode === 'hard'
          ? t('editor.resetHardConfirm', { hash: shortHash, dirty })
          : t('editor.resetConfirm', { hash: shortHash, mode: modeLabel });
      if (!window.confirm(confirmation)) return;
      setCommitBusy(true);
      setCommitError(null);
      setCommitNotice(null);
      try {
        const value = await callGit<WorkspaceGitStatus>({
          op: 'resetBranch',
          hash,
          mode,
        });
        setGit(value);
        setCommitSelection(new Set((value?.changes ?? []).map((change) => change.path)));
        setDiffTarget(null);
        setExternalChanges({});
        setHistoryPath(null);
        setCommitNotice(t('editor.resetDone', { hash: shortHash, mode: modeLabel }));
        await refreshTree();
        await loadLog();
        if (mode === 'hard') {
          for (const file of openFilesRef.current) await reloadFile(file.path);
        }
      } catch (failure) {
        setCommitError(failure instanceof Error ? failure.message : String(failure));
      } finally {
        setCommitBusy(false);
      }
    },
    [loadLog, reloadFile, refreshTree, t],
  );
  const runHistoryAction = React.useCallback(
    async (operation: 'cherryPick' | 'revert', hash: string) => {
      if (typeof hash !== 'string' || hash === '') return;
      const label = operation === 'cherryPick' ? t('editor.cherryPick') : t('editor.revertCommit');
      if (
        !window.confirm(
          t('editor.historyActionConfirm', {
            action: label,
            hash: hash.slice(0, 7),
          }),
        )
      )
        return;
      setCommitBusy(true);
      setCommitError(null);
      setCommitNotice(null);
      try {
        const value = await callGit<WorkspaceGitStatus>({ op: operation, hash });
        setGit(value);
        setCommitSelection(new Set((value?.changes ?? []).map((change) => change.path)));
        setDiffTarget(null);
        setCommitNotice(t('editor.historyActionDone', { action: label }));
        await refreshTree();
        await loadLog();
      } catch (failure) {
        setCommitError(failure instanceof Error ? failure.message : String(failure));
      } finally {
        setCommitBusy(false);
      }
    },
    [loadLog, refreshTree, t],
  );
  /* IDEA's Log row context menu: diff, history, cherry-pick and revert. */ /**
   * Open the history of the first file touched by the RIGHT-CLICKED commit.
   *
   * Reading `logDetail` would use whatever commit happened to be selected
   * before the menu opened, which is often a different row — the user then
   * sees another commit's file history.
   * @param {string} hash - commit whose first changed file to follow.
   * @returns {Promise<void>} resolves once the history is shown.
   */ const showCommitHistory = React.useCallback(
    async (hash: string) => {
      if (typeof hash !== 'string' || hash === '') return;
      try {
        const detail = await callGit<CommitLogDetail>({ op: 'show', hash });
        const first = (detail?.files ?? [])[0];
        if (first === undefined) {
          setCommitNotice(t('editor.noChangedFiles'));
          return;
        }
        void showFileHistory(first.path);
      } catch (failure) {
        setCommitError(failure instanceof Error ? failure.message : String(failure));
      }
    },
    [showFileHistory, t],
  );
  const compareCommitRevisions = React.useCallback(
    async (selectionHashes: string[]) => {
      setCommitError(null);
      setCommitNotice(null);
      const loadedEntries = [
        ...(Array.isArray(commits) ? commits : []),
        ...(Array.isArray(graph?.entries) ? graph.entries : []),
      ].filter(
        (entry, index, list) =>
          typeof entry?.hash === 'string' &&
          entry.hash !== '' &&
          list.findIndex((candidate) => candidate?.hash === entry.hash) === index,
      );
      const pair = orderedRevisionPair(selectionHashes, loadedEntries);
      if (pair === null) {
        setCommitError(t('editor.compareRevisionsNeedTwo'));
        return;
      }
      const [rightHash, leftHash] = pair;
      try {
        const [leftDetail, rightDetail] = await Promise.all([
          callGit<CommitLogDetail>({ op: 'show', hash: leftHash }),
          callGit<CommitLogDetail>({ op: 'show', hash: rightHash }),
        ]);
        const paths = [
          ...new Set(
            [
              ...(Array.isArray(leftDetail?.files) ? leftDetail.files : []).map((file) => file.path),
              ...(Array.isArray(rightDetail?.files) ? rightDetail.files : []).map((file) => file.path),
            ].filter((path) => typeof path === 'string' && path !== ''),
          ),
        ];
        if (paths.length === 0) {
          setCommitNotice(t('editor.noChangedFiles'));
          return;
        }
        const entries = paths.map((path) => ({
          path,
          originalRevision: leftHash,
          modifiedRevision: rightHash,
          heading: `${path} · ${leftHash.slice(0, 7)} → ${rightHash.slice(0, 7)}`,
        }));
        setDiffTarget({
          combined: true,
          entries,
          revisionPair: { left: leftHash, right: rightHash },
          staged: false,
        });
        setDiffActive(true);
      } catch (failure) {
        setCommitError(failure instanceof Error ? failure.message : String(failure));
      }
    },
    [commits, graph?.entries, t],
  );
  const compareCommitWithLocal = React.useCallback(
    async (hash: string) => {
      setCommitError(null);
      setCommitNotice(null);
      try {
        const detail = await callGit<CommitLogDetail>({ op: 'show', hash });
        const entries = commitLocalDiffEntries(detail, hash, t('editor.currentVersion'));
        if (entries.length === 0) {
          setCommitNotice(t('editor.noChangedFiles'));
          return;
        }
        setDiffTarget({
          combined: true,
          entries,
          commitWithLocal: hash,
          staged: false,
        });
        setDiffActive(true);
      } catch (failure) {
        setCommitError(failure instanceof Error ? failure.message : String(failure));
      }
    },
    [t],
  );
  const createCommitPatch = React.useCallback(
    async (hash: string) => {
      setCommitError(null);
      setCommitNotice(null);
      try {
        const value = await callGit<WorkspaceGitStatus>({
          op: 'commitPatch',
          hash,
        });
        if (typeof value?.patch !== 'string' || value.patch.trim() === '') throw new Error(t('editor.patchEmpty'));
        const resolvedHash = typeof value.hash === 'string' && value.hash !== '' ? value.hash : hash;
        downloadPatchBlob(value.patch, commitPatchDownloadName(resolvedHash, value.subject));
        setCommitNotice(t('editor.commitPatchCreated', { hash: resolvedHash.slice(0, 7) }));
      } catch (failure) {
        setCommitError(failure instanceof Error ? failure.message : String(failure));
      }
    },
    [t],
  );
  const openRepositoryVersion = React.useCallback(async ({ hash, path }: { hash: string; path: string }) => {
    if (typeof hash !== 'string' || hash === '' || typeof path !== 'string' || path === '') return;
    setCommitError(null);
    setCommitNotice(null);
    try {
      const value = await callGit<{
        hash?: string;
        content?: string;
        binary?: boolean;
      }>({ op: 'repositoryVersion', hash, path });
      setAnnotateTarget(null);
      setDiffTarget({
        path,
        repositoryVersion: {
          hash: typeof value.hash === 'string' ? value.hash : '',
          content: typeof value.content === 'string' ? value.content : '',
          binary: value.binary === true,
        },
        staged: false,
      });
      setDiffActive(true);
    } catch (failure) {
      setCommitError(failure instanceof Error ? failure.message : String(failure));
    }
  }, []);
  /**
   * Context menu for a file row in a commit's detail pane.
   *
   * IDEA's version of this menu starts with "Jump to Source"; the tree is
   * this plugin's source view, so the first entry selects the working copy
   * there and the second opens it in the editor.
   * @param {{path: string, x: number, y: number}} payload - clicked file.
   * @returns {object} menu descriptor for the shared popup.
   */ const buildCommitFileMenu = React.useCallback(
    ({ path, hash, localExists, localDirExists, x, y }: CommitFileMenuPayload) =>
      commitFileMenu({
        t,
        position: {
          x,
          y,
        },
        path,
        hash,
        localExists,
        localDirExists,
        absoluteClipboardPath: shellQuote(root === '' ? path : `${root}/${path}`),
        onShowDiff: (target) => showCommitDiff(target),
        onOpenRepositoryVersion: (target) => void openRepositoryVersion(target),
        onRevealPath: (target) => void revealPath(target),
        onOpenTerminal: (target) => openInTerminal(dirname(target)),
        onEditLocalVersion: (target) => void editLocalVersion(target),
        onShowFileHistory: (target) => void showFileHistory(target),
        onCopyText: (value) => void navigator.clipboard?.writeText(value).catch(() => {}),
      }),
    [showCommitDiff, editLocalVersion, openInTerminal, openRepositoryVersion, revealPath, showFileHistory, root, t],
  );
  const buildLogMenu = React.useCallback(
    ({ commit, selectionHashes: requestedSelectionHashes, x, y }: CommitGraphMenuPayload) => {
      const loaded = [...(Array.isArray(commits) ? commits : []), ...(graph?.entries ?? [])];
      const unique = [
        ...new Map(
          loaded
            .filter((entry) => typeof entry?.hash === 'string' && entry.hash !== '')
            .map((entry) => [entry.hash, entry]),
        ).values(),
      ];
      const selectionHashes = [
        ...new Set(
          [...(Array.isArray(requestedSelectionHashes) ? requestedSelectionHashes : []), commit.hash].filter(
            (hash) => typeof hash === 'string' && hash !== '',
          ),
        ),
      ];
      const relations = commitRelationTargets(unique, commit.hash);
      return commitLogMenu({
        t,
        position: {
          x,
          y,
        },
        commit,
        selectionHashes,
        parentTargets: relations.parents,
        childTargets: relations.children,
        detached: git?.detached === true,
        onShowCommit: (hash) => void showCommit(hash),
        onShowCommitHistory: (hash) => void showCommitHistory(hash),
        onCompareRevisions: (hashes) => void compareCommitRevisions(hashes),
        onCompareWithLocal: (hash) => void compareCommitWithLocal(hash),
        onRunHistoryAction: (action, hash) => void runHistoryAction(action, hash),
        onCreateTag: (hash) =>
          openNamePrompt(
            {
              kind: 'tag',
              title: t('editor.createTagAction'),
              placeholder: t('editor.createTagPlaceholder'),
              value: '',
              hash,
              error: '',
            },
            logPromptOriginRef.current,
          ),
        onCreateCommitPatch: (hash) => void createCommitPatch(hash),
        onCheckoutRevision: (hash) => void checkoutRevision(hash),
        onCreateBranch: (hash) =>
          openNamePrompt(
            {
              kind: 'branch',
              title: t('editor.newBranchFromCommitAction', {
                hash: hash.slice(0, 7),
              }),
              placeholder: t('editor.newBranchPlaceholder'),
              value: '',
              hash,
              error: '',
            },
            logPromptOriginRef.current,
          ),
        onResetBranchHere: (hash, mode) => void resetBranchHere(hash, mode),
        onCopyText: (value) => void navigator.clipboard?.writeText(value).catch(() => {}),
      });
    },
    [
      commits,
      compareCommitRevisions,
      compareCommitWithLocal,
      createCommitPatch,
      git?.detached,
      graph?.entries,
      openNamePrompt,
      resetBranchHere,
      runHistoryAction,
      showCommit,
      showCommitHistory,
      t,
    ],
  );
  /* Rollback discards edits, so it asks first — IDEA does the same for modified files. */ const rollback =
    React.useCallback(
      async (paths: string[], options: { staged?: boolean; unversioned?: boolean } = {}) => {
        if (paths.length === 0) return;
        const stagedOnly = options?.staged === true;
        const unversionedOnly = options?.unversioned === true;
        const confirmKey = stagedOnly
          ? 'editor.rollbackStagedConfirm'
          : unversionedOnly
            ? 'editor.rollbackUnversionedConfirm'
            : 'editor.rollbackConfirm';
        if (!window.confirm(t(confirmKey, { count: paths.length }))) return;
        const pickedKeys = new Set(
          chosenChanges(selectedChangeRef.current)
            .filter((entry) => (stagedOnly ? entry.staged === true : entry.staged !== true))
            .map((entry) => `${entry.staged === true ? 'staged' : 'unstaged'}:${entry.path}`),
        );
        setCommitBusy(true);
        setCommitError(null);
        try {
          const value = await callGit<WorkspaceGitStatus>({
            op: 'rollback',
            paths,
            ...(stagedOnly ? { staged: true } : {}),
          });
          setGit(value);
          /* Rollback changes the working list, not the user's commit choice:
               keep the checkbox set and only drop paths that disappeared. */ setCommitSelection((current) => {
            const existing = new Set((value?.changes ?? []).map((change) => change.path));
            return new Set([...current].filter((path) => existing.has(path)));
          });
          setDiffTarget(null);
          await refreshTree();
          reconcileChangeSelection(value?.changes ?? [], pickedKeys);
          if (activePathRef.current !== null && paths.includes(activePathRef.current)) {
            await openFile(activePathRef.current);
          }
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setCommitBusy(false);
        }
      },
      [chosenChanges, openFile, reconcileChangeSelection, refreshTree, t],
    );
  /* IDEA's "Add to .gitignore", shared by the unversioned group header and
         individual unversioned file rows. Declared before buildChangeMenu so its
         callback dependency can never enter the TDZ. */ const addToGitignore = React.useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return;
      setCommitBusy(true);
      setCommitError(null);
      try {
        const value = await callGit<{ added?: string[] }>({ op: 'ignore', paths });
        const added = Array.isArray(value?.added) ? value.added : [];
        setCommitNotice(
          added.length === 0 ? t('editor.alreadyIgnored') : t('editor.addedToGitignore', { count: added.length }),
        );
        await loadGit();
        await refreshTree();
      } catch (failure) {
        setCommitError(failure instanceof Error ? failure.message : String(failure));
      } finally {
        setCommitBusy(false);
      }
    },
    [loadGit, refreshTree, t],
  );
  /**
   * Copy IDEA's selected-changes patch without mutating the index.
   *
   * @param {Array<{path: string, staged?: boolean}>} targets - selected change identities.
   * @returns {Promise<void>} resolves after clipboard feedback is set.
   */ const requestSelectedPatch = React.useCallback(async (targets: DiffTarget[]): Promise<SelectedPatch | null> => {
    const entries = (Array.isArray(targets) ? targets : [])
      .filter((entry) => typeof entry?.path === 'string' && entry.path !== '')
      .map((entry) => ({ path: entry.path, staged: entry.staged === true }));
    if (entries.length === 0) return null;
    return callGit<SelectedPatch>({ op: 'patch', entries });
  }, []);
  const copySelectedPatch = React.useCallback(
    async (targets: DiffTarget[]) => {
      setCommitError(null);
      setCommitNotice(null);
      try {
        const value = await requestSelectedPatch(targets);
        if (value === null) return;
        if (typeof value?.patch !== 'string' || value.patch.trim() === '') throw new Error(t('editor.patchEmpty'));
        if (typeof navigator.clipboard?.writeText !== 'function') throw new Error(t('editor.clipboardWriteFailed'));
        try {
          await navigator.clipboard?.writeText(value.patch);
        } catch {
          throw new Error(t('editor.clipboardWriteFailed'));
        }
        setCommitNotice(t('editor.patchCopied', { count: value.files?.length ?? 0 }));
      } catch (failure) {
        setCommitError(failure instanceof Error ? failure.message : String(failure));
      }
    },
    [requestSelectedPatch, t],
  );
  const createSelectedPatch = React.useCallback(
    async (targets: DiffTarget[]) => {
      setCommitError(null);
      setCommitNotice(null);
      try {
        const value = await requestSelectedPatch(targets);
        if (value === null) return;
        if (typeof value?.patch !== 'string' || value.patch.trim() === '') throw new Error(t('editor.patchEmpty'));
        downloadPatchBlob(value.patch, patchDownloadName());
        setCommitNotice(t('editor.patchCreated', { count: value.files?.length ?? 0 }));
      } catch (failure) {
        setCommitError(failure instanceof Error ? failure.message : String(failure));
      }
    },
    [requestSelectedPatch, t],
  );
  /**
   * Apply one unified diff through the host's atomic Git preflight.
   *
   * IDEA saves documents before applying a patch. Dirty tabs therefore get
   * one explicit confirmation; a partial Save All aborts before any hunk is
   * applied. The returned status refreshes the tree and every open buffer.
   * @param {string} patchText - clipboard or chosen patch-file contents.
   * @returns {Promise<boolean>} true when the patch was applied.
   */ const applyPatchText = React.useCallback(
    async (patchText: string) => {
      if (commitBusy) return false;
      if (typeof patchText !== 'string' || patchText.trim() === '') {
        setCommitError(t('editor.applyPatchEmpty'));
        return false;
      }
      const dirty = openFilesRef.current.filter((file) => file.dirty === true);
      if (dirty.length > 0 && !window.confirm(t('editor.applyPatchDirty', { count: dirty.length }))) return false;
      setCommitBusy(true);
      setCommitError(null);
      setCommitNotice(null);
      try {
        if (dirty.length > 0 && (await saveAll()) < dirty.length) {
          throw new Error(t('editor.applyPatchSaveFailed'));
        }
        const value = await callGit<WorkspaceGitStatus>({
          op: 'applyPatch',
          patch: patchText,
        });
        setGit(value);
        setCommitSelection((current) => {
          const existing = new Set((value?.changes ?? []).map((change) => change.path));
          return new Set([...current].filter((path) => existing.has(path)));
        });
        setDiffTarget(null);
        setExternalChanges({});
        await refreshTree();
        for (const file of openFilesRef.current) await reloadFile(file.path);
        setCommitNotice(
          t('editor.applyPatchDone', {
            count: value?.appliedFiles?.length ?? 0,
          }),
        );
        return true;
      } catch (failure) {
        setCommitError(failure instanceof Error ? failure.message : String(failure));
        return false;
      } finally {
        setCommitBusy(false);
      }
    },
    [commitBusy, refreshTree, reloadFile, saveAll, t],
  );
  const applyPatchFile = React.useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.patch,.diff,text/plain';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('cancel', () => input.remove(), { once: true });
    input.addEventListener(
      'change',
      () => {
        const file = input.files?.[0] ?? null;
        input.remove();
        if (file === null) return;
        if (file.size > 4 * 1024 * 1024) {
          setCommitError(t('editor.applyPatchTooLarge'));
          return;
        }
        file
          .text()
          .then((text) => applyPatchText(text))
          .catch(() => setCommitError(t('editor.applyPatchReadFailed')));
      },
      { once: true },
    );
    input.click();
  }, [applyPatchText, t]);
  const applyPatchClipboard = React.useCallback(async () => {
    let text;
    try {
      if (typeof navigator.clipboard?.readText !== 'function') throw new Error(t('editor.applyPatchReadFailed'));
      text = await navigator.clipboard.readText();
    } catch {
      setCommitError(t('editor.applyPatchReadFailed'));
      return;
    }
    await applyPatchText(text);
  }, [applyPatchText, t]);
  const buildChangeMenu = React.useCallback(
    (payload: ChangeRowMenuPayload): WorkspaceMenuModel => {
      const change = payload.change;
      const staged = payload.staged;
      const range =
        payload.selectedChanges instanceof Set && payload.selectedChanges.size > 0
          ? payload.selectedChanges
          : new Set([`${staged === true ? 'staged' : 'unstaged'}:${change.path}`]);
      const parsed = [...range]
        .map((key) => {
          const separator = key.indexOf(':');
          return separator < 0
            ? null
            : {
                staged: key.slice(0, separator) === 'staged',
                path: key.slice(separator + 1),
              };
        })
        .filter((entry) => entry !== null);
      const selected = parsed.length > 0 ? parsed : [{ path: change.path, staged }];
      const paths = [...new Set(selected.map((entry) => entry.path))];
      const allStaged = selected.every((entry) => entry.staged === true);
      const allWorking = selected.every((entry) => entry.staged === false);
      const allUnversioned = allPathsUnversioned(selected, changesByPathRef.current);
      const removablePaths = pathsScheduledForRemoval(selected, changesByPathRef.current);
      const removalOnly = allWorking && removablePaths.length > 0 && removablePaths.length === selected.length;
      const batchLabel = (single: string, multiple: string): string =>
        paths.length > 1 ? t(multiple, { count: paths.length }) : t(single);
      const pick = (path: string): DiffChange => changesByPathRef.current.get(path) ?? change;
      const allConflicts = selected.every((entry) => isConflict(pick(entry.path)));
      return {
        x: payload.x,
        y: payload.y,
        title: paths.length > 1 ? t('editor.selectedChangesTitle', { count: paths.length }) : undefined,
        items: [
          {
            id: 'rollback',
            label: t('editor.rollback'),
            danger: true,
            items: [
              ...(allStaged
                ? [
                    {
                      id: 'rollbackStaged',
                      label: t('editor.rollbackStaged'),
                      danger: true,
                      run: (): void => void rollback(paths, { staged: true }),
                    },
                  ]
                : []),
              ...(allWorking
                ? [
                    {
                      id: 'rollbackWorking',
                      label: allUnversioned
                        ? batchLabel('editor.rollbackUnversioned', 'editor.rollbackUnversionedCount')
                        : batchLabel('editor.rollbackWorking', 'editor.rollbackWorkingCount'),
                      shortcut: '⌥⌘Z',
                      ariaKeyShortcuts: 'Alt+Meta+Z Control+Alt+Z',
                      danger: true,
                      run: (): void => void rollback(paths, allUnversioned ? { unversioned: true } : undefined),
                    },
                  ]
                : []),
            ],
          },
          null,
          {
            id: 'diff',
            label: t('editor.showDiff'),
            shortcut: '⌘D',
            ariaKeyShortcuts: 'Meta+D Control+D',
            run: (): void => {
              setDiffTarget({ path: change.path, staged });
              setDiffActive(true);
            },
          },
          {
            id: 'combinedDiff',
            label: t('editor.showCombinedDiff'),
            disabled: paths.length < 2,
            run: () => showCombinedDiff(selected),
          },
          {
            id: 'open',
            label: t('editor.openInEditor'),
            run: () => void openFile(change.path),
          },
          ...(allConflicts
            ? [
                {
                  id: 'resolveConflicts',
                  label: t('editor.resolveConflicts'),
                  items: [
                    {
                      id: 'acceptOurs',
                      label: t('editor.acceptOurs'),
                      run: (): void => void resolveConflict(paths, 'ours'),
                    },
                    {
                      id: 'acceptTheirs',
                      label: t('editor.acceptTheirs'),
                      run: (): void => void resolveConflict(paths, 'theirs'),
                    },
                  ],
                },
              ]
            : []),
          {
            id: 'copyReference',
            label: t('editor.copyPathReference'),
            items: copyReferenceMenuItems({
              entries: paths.map((path) => ({ path })),
              root,
              t,
              editor: currentCodeEditor(),
              editorPath: currentCodePath(),
              writeText: (value) => navigator.clipboard?.writeText(value),
            }),
          },
          null,
          {
            id: removalOnly ? 'removeDeleted' : 'stage',
            label: removalOnly
              ? t('editor.removeFromVcs')
              : allStaged
                ? batchLabel('editor.unstageAction', 'editor.unstageSelectedCount')
                : allUnversioned
                  ? batchLabel('editor.addToVcs', 'editor.addToVcsCount')
                  : batchLabel('editor.stageAction', 'editor.stageSelectedCount'),
            disabled: allStaged === false && allWorking === false,
            ...(removalOnly ? {} : { shortcut: allStaged ? '⌥⌘A' : '⌘⇧A' }),
            ariaKeyShortcuts: removalOnly
              ? undefined
              : allStaged
                ? 'Alt+Meta+A Control+Alt+A'
                : 'Meta+Shift+A Control+Shift+A',
            run: (): void => void restage(removalOnly ? removablePaths : paths, allStaged),
          },
          ...(removablePaths.length > 0 && !removalOnly
            ? [
                {
                  id: 'removeDeleted',
                  label: t('editor.removeFromVcs'),
                  run: (): void => void restage(removablePaths, false),
                },
              ]
            : []),
          ...(allUnversioned
            ? [
                {
                  id: 'gitignore',
                  label: t('editor.addToGitignore'),
                  run: (): void => void addToGitignore(paths),
                },
              ]
            : []),
          null,
          {
            id: 'createPatch',
            label: t('editor.createPatchFromChanges'),
            run: () => void createSelectedPatch(selected),
          },
          {
            id: 'copyPatch',
            label: t('editor.copyPatchToClipboard'),
            run: () => void copySelectedPatch(selected),
          },
          null,
          {
            id: 'history',
            label: t('editor.showHistory'),
            disabled: paths.length > 1,
            run: () => void showFileHistory(change.path),
          },
          {
            id: 'reveal',
            label: t('editor.revealInProject'),
            disabled: paths.length > 1,
            run: () => void revealPath(change.path),
          },
          {
            id: 'openTerminal',
            label: t('editor.openInTerminal'),
            disabled: paths.length > 1,
            run: () => openInTerminal(dirname(change.path)),
          },
          null,
          {
            id: 'compareRevision',
            label: t('editor.compareWithRevision'),
            disabled: paths.length > 1,
            run: () => void compareWithRevision(change.path),
          },
          {
            id: 'compareHead',
            label: t('editor.compareWithHead'),
            disabled: paths.length > 1 || !canCompareWithHead(pick(change.path)),
            run: () => compareWithHead(change.path),
          },
          {
            id: 'compareClipboard',
            label: t('editor.compareWithClipboard'),
            disabled: paths.length > 1,
            run: () => void compareWithClipboard(change.path),
          },
        ],
      };
    },
    [
      compareWithClipboard,
      compareWithHead,
      compareWithRevision,
      copySelectedPatch,
      createSelectedPatch,
      currentCodeEditor,
      currentCodePath,
      openFile,
      openInTerminal,
      addToGitignore,
      resolveConflict,
      restage,
      revealPath,
      rollback,
      root,
      showCombinedDiff,
      showFileHistory,
      t,
    ],
  );
  /**
   * Context menu for one directory node in the change tree.
   *
   * IDEA acts on a directory's whole subtree: stage/unstage every file below
   * it, or roll the lot back. The paths are collected by the row (it already
   * holds `row.changes`), so the menu never re-derives the tree. Declared
   * after `rollback` because its dependency array names it.
   * @param {{directory: string, changes: object[], group: string, x: number, y: number}} payload - clicked node.
   * @returns {object} menu descriptor for the shared popup.
   */ const buildChangeDirMenu = React.useCallback(
    ({ directory, changes: inside, group, x, y }: ChangeDirectoryMenuPayload): WorkspaceMenuModel => {
      const paths = (inside ?? []).map((change) => change.path);
      return {
        x,
        y,
        title: basename(directory),
        items: [
          ...(group === 'staged'
            ? [
                {
                  id: 'unstageDirectory',
                  label: t('editor.unstageThisDirectory'),
                  run: (): void => void restage(paths, true),
                },
              ]
            : [
                {
                  id: 'stageDirectory',
                  label: t('editor.stageThisDirectory'),
                  run: (): void => void restage(paths, false),
                },
              ]),
          null,
          {
            id: 'rollbackDirectory',
            label: t('editor.rollbackDirectory'),
            danger: true,
            disabled: paths.length === 0,
            run: (): void => void rollback(paths),
          },
          null,
          {
            id: 'openDirectory',
            label: t('editor.revealInProject'),
            run: () => void revealPath(directory),
          },
          {
            id: 'openTerminal',
            label: t('editor.openInTerminal'),
            run: () => openInTerminal(directory),
          },
        ],
      };
    },
    [openInTerminal, restage, revealPath, rollback, t],
  );
  /**
   * ⌥⌘Z — "revert the working copy" for the row the Commit panel is showing.
   *
   * The context menu has advertised this shortcut since the two discards were
   * split, but nothing listened for it. It acts on the change selected in the
   * panel (the one the detail pane is about), and steps aside whenever a text
   * field or the editor owns the keyboard.
   * @param {Event} event - keydown from the window capture phase.
   * @returns {void}
   */ const rollbackWorkingShortcut = React.useCallback(
    (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (!event.altKey || !meta || event.shiftKey || event.key.toLowerCase() !== 'z') return;
      const target = event.target instanceof Element ? event.target : null;
      /* A terminal, a rename field or the code editor must keep the key. */ if (
        target?.closest('.monaco-editor') != null
      )
        return;
      if (target?.closest('input, textarea, [contenteditable="true"]') != null) return;
      if (target?.closest('[data-dsh-editor-terminal]') != null) return;
      if (selectedGroupRef.current !== null) return;
      const fallback = selectedChangeRef.current ?? lastChangePathRef.current;
      const picked = chosenChanges(fallback);
      const working = picked.filter((entry) => entry.staged !== true).map((entry) => entry.path);
      if (working.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      void rollback([...new Set(working)]);
    },
    [chosenChanges, rollback],
  );
  React.useEffect(() => {
    window.addEventListener('keydown', rollbackWorkingShortcut, true);
    return () => window.removeEventListener('keydown', rollbackWorkingShortcut, true);
  }, [rollbackWorkingShortcut]);
  /**
   * ⌘⇧A — stage, ⌥⌘A — unstage the Commit panel's current change.
   *
   * IDEA's changelist is fully keyboard-driven: reaching for the row's
   * checkbox is the only way to move one file between the bands here. The
   * shortcut acts on the file the panel is showing (the diff target, the
   * annotated file, or the open tab) and stands aside for text fields.
   * @param {KeyboardEvent} event - window keydown.
   * @returns {void}
   */ const stageShortcut = React.useCallback(
    (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta || event.shiftKey === event.altKey || event.key.toLowerCase() !== 'a') return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('.monaco-editor') != null) return;
      if (target?.closest('input, textarea, [contenteditable="true"]') != null) return;
      if (target?.closest('[data-dsh-editor-terminal]') != null) return;
      /* No Commit panel on screen: the shortcut has nothing to act on. */ if (
        !panelVisibleRef.current ||
        activityRef.current !== 'commit'
      )
        return;
      if (selectedGroupRef.current !== null) return;
      const remembered = lastChangePathRef.current;
      const fallback =
        selectedChangeRef.current ?? (remembered === null || remembered === undefined ? null : remembered);
      const picked = chosenChanges(fallback);
      const single = picked.length > 0 ? picked : fallback === null ? [] : [fallback];
      if (single.length === 0) return;
      const change = (gitRef.current?.changes ?? []).find((entry) => entry.path === single[0].path);
      if (change === undefined) return;
      /* Already in the requested band: the reverse action would be a surprise. */ const staged =
        change.status[0] !== ' ' && change.status[0] !== '?';
      const eligible = single.filter((entry) => entry.staged === staged).map((entry) => entry.path);
      if (eligible.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      void restageRef.current([...new Set(eligible)], staged);
    },
    [chosenChanges],
  );
  React.useEffect(() => {
    window.addEventListener('keydown', stageShortcut, true);
    return () => window.removeEventListener('keydown', stageShortcut, true);
  }, [stageShortcut]);
  /**
   * ⌘D — open the diff of the current change, IDEA's "Show Diff" key.
   *
   * The change row menu has printed `⌘D` since the diff existed, but the key
   * did nothing unless the row was already selected and clicked. This opens (or
   * closes) the diff for whatever the Commit panel is pointing at, so a file can
   * be reviewed from the keyboard after staging it.
   * @param {KeyboardEvent} event - window keydown.
   * @returns {void}
   */ const showDiffShortcut = React.useCallback((event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'd') return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('.monaco-editor') != null) return;
    if (target?.closest('input, textarea, [contenteditable="true"]') != null) return;
    if (target?.closest('[data-dsh-editor-terminal]') != null) return;
    if (!panelVisibleRef.current || activityRef.current !== 'commit') return;
    if (selectedGroupRef.current !== null) return;
    const remembered = lastChangePathRef.current;
    const path =
      selectedChangeRef.current?.path ??
      selectedDiffPathRef.current ??
      selectedCommitPathRef.current ??
      remembered?.path ??
      activePathRef.current;
    if (path === null || path === undefined || path === '') return;
    const change = (gitRef.current?.changes ?? []).find((entry) => entry.path === path);
    if (change === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    const staged = change.status[0] !== ' ' && change.status[0] !== '?';
    setDiffTarget((current) =>
      current !== null && current.path === path && current.staged === staged ? null : { path, staged },
    );
    setDiffActive(true);
  }, []);
  React.useEffect(() => {
    window.addEventListener('keydown', showDiffShortcut, true);
    return () => window.removeEventListener('keydown', showDiffShortcut, true);
  }, [showDiffShortcut]);
  /* Apply a rename from the inline editor row. */ const commitRename = React.useCallback(async () => {
    if (renameState === null) return;
    const name = renameState.value.trim();
    if (name === '' || name.includes('/') || name === '.' || name === '..') {
      setTreeError(t('editor.invalidName'));
      return;
    }
    /* The destination is derived from the ORIGINAL path, not from a stored
           `parent`: a rename keeps the entry in its own directory, and deriving it
           here means no caller can hand in a `parent` equal to the entry itself
           (which produced `assets/assets` and an EINVAL from the host). */ const parent = dirname(renameState.path);
    const next = parent === '' ? name : `${parent}/${name}`;
    if (next === renameState.path) {
      /* A freshly created entry that keeps its name simply leaves edit mode. */ setRenameState(null);
      return;
    }
    try {
      await callFs({ op: 'rename', path: renameState.path, to: next });
      remapEditorPaths([[renameState.path, next]]);
      remapProjectExpandedPathsForMoves([[renameState.path, next]]);
      remapProjectManualOrderForMoves([[renameState.path, next]]);
      setRenameState(null);
      setSelectedPath(next);
      await refreshTree();
      await loadGit();
    } catch (failure) {
      setTreeError(failure instanceof Error ? failure.message : String(failure));
    }
  }, [
    loadGit,
    refreshTree,
    remapEditorPaths,
    remapProjectExpandedPathsForMoves,
    remapProjectManualOrderForMoves,
    renameState,
    t,
  ]);
  const focusToolWindowContent = React.useCallback(
    (next: 'project' | 'commit') => {
      cancelFocusRequestRef.current?.();
      cancelFocusRequestRef.current = focusSurfaceWhenReady(
        () => {
          if (activityRef.current !== next || panelVisibleRef.current !== true) return null;
          if (next === 'project') return treeRef.current;
          const selected = selectedChangeRef.current;
          const key = selected === null ? null : `${selected.staged === true ? 'staged' : 'unstaged'}:${selected.path}`;
          const row = key === null ? null : (changeRowRefs.current.get(key) ?? null);
          return commitMode === 'changes' ? (row ?? commitChangesRef.current) : commitLogRef.current;
        },
        {
          onExhausted: () => {
            cancelFocusRequestRef.current = null;
            if (activityRef.current !== next || panelVisibleRef.current !== true) return;
            focusWorkspaceFallback(document.querySelector<HTMLElement>('[data-dsh-editor-workspace]'));
          },
        },
      );
    },
    [commitMode],
  );
  React.useEffect(
    () => () => {
      cancelFocusRequestRef.current?.();
      cancelFocusRequestRef.current = null;
    },
    [],
  );
  const rememberActivityToolWindowOrigin = React.useCallback(
    (id: string) => {
      if (id !== 'terminal' || terminalOpen) return;
      const current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const editorNode = editorRef.current?.getDomNode?.() ?? null;
      terminalReturnFocusRef.current =
        current !== null && current.closest('[data-dsh-editor-terminal], [data-dsh-editor-activity-stripe]') === null
          ? current
          : editorNode;
    },
    [terminalOpen],
  );
  const selectActivity = React.useCallback(
    (next: 'project' | 'commit' | 'terminal', options?: { keyboard?: boolean }) => {
      if (next === 'terminal') {
        setFindTool(null);
        if (terminalOpen) {
          const previous = terminalReturnFocusRef.current;
          terminalReturnFocusRef.current = null;
          setTerminalOpen(false);
          window.setTimeout(() => {
            if (previous !== null && previous.isConnected) previous.focus();
            else focusEditorSurface();
          }, 0);
          return;
        }
        if (terminalReturnFocusRef.current === null) {
          const current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          const editorNode = editorRef.current?.getDomNode?.() ?? null;
          terminalReturnFocusRef.current =
            current !== null &&
            current.closest('[data-dsh-editor-terminal], [data-dsh-editor-activity-stripe]') === null
              ? current
              : editorNode;
        }
        setTerminalOpen(true);
        setTerminalFocusGeneration((value) => value + 1);
        return;
      }
      /* The terminal dock is PERSISTENT, matching IDEA: switching to Project or
             Commit leaves the open shells exactly where they are. Hiding the dock
             on every tool-window switch lost the user's terminal while they looked
             at a diff, and the shell's output was scrolled away when it came back. */ if (next === activity) {
        if (options?.keyboard === true) {
          const activeElement = document.activeElement instanceof Element ? document.activeElement : null;
          const focusInsideToolWindow =
            activeElement !== null &&
            (toolWindowPanelRef.current?.contains(activeElement) === true ||
              activeElement.closest('[data-dsh-editor-tool-window-resizer]') !== null);
          const focusInside = panelVisibleRef.current === true && focusInsideToolWindow;
          const action = toolWindowShortcutAction(activity, next, panelVisibleRef.current, focusInside);
          if (action === 'hide') {
            setPanelVisible(false);
            focusEditorSurface();
            return;
          }
          setPanelVisible(true);
          window.setTimeout(() => focusToolWindowContent(next), 0);
          return;
        }
        setPanelVisible((visible) => !visible);
        return;
      }
      setActivity(next);
      setPanelVisible(true);
      if (options?.keyboard === true) window.setTimeout(() => focusToolWindowContent(next), 0);
    },
    [activity, focusEditorSurface, focusToolWindowContent, terminalOpen],
  );
  /* The first Alt+F1 of IDEA's Select Opened File chord. */ const selectOpenedChordAt = React.useRef(0);
  /**
   * Alt+F12, Alt+1..3 and Ctrl+Shift+` — IDEA's tool-window keys.
   *
   * IDEA raises a tool window with `Alt+<digit>` and its terminal with
   * `Alt+F12`. The digits used to be dead here: nothing opened Project or
   * Commit without the mouse, which is the difference between "a panel" and
   * "an IDE". A key that raises the active window again hides it, exactly as
   * IDEA's toggle does; the terminal keeps its own open/close behaviour.
   * @param {KeyboardEvent} event - window keydown.
   * @returns {void}
   */ React.useEffect(() => {
    /* Remember the surface that owned the caret before the dock opened. A
           terminal shortcut pressed while the terminal is already focused must
           not replace the origin with the terminal itself. */ const rememberTerminalOrigin = () => {
      const current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const editorNode = editorRef.current?.getDomNode?.() ?? null;
      terminalReturnFocusRef.current =
        current !== null && current.closest('[data-dsh-editor-terminal]') === null ? current : editorNode;
    };
    const restoreTerminalOrigin = () => {
      const previous = terminalReturnFocusRef.current;
      terminalReturnFocusRef.current = null;
      window.setTimeout(() => {
        if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
        else editorRef.current?.focus();
      }, 0);
    };
    const toggleTerminalDock = () => {
      const current = document.activeElement instanceof Element ? document.activeElement : null;
      const action = terminalShortcutAction(terminalOpen, current?.closest('[data-dsh-editor-terminal]') !== null);
      if (action.focus) {
        setFindTool(null);
        setTerminalFocusGeneration((value) => value + 1);
        return;
      }
      if (action.open === false) {
        setTerminalOpen(false);
        if (action.restoreFocus) restoreTerminalOrigin();
        else terminalReturnFocusRef.current = null;
        return;
      }
      rememberTerminalOrigin();
      setTerminalOpen(true);
      setFindTool(null);
      setTerminalFocusGeneration((value) => value + 1);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const chordAction = selectOpenedChordAction(
        event,
        selectOpenedChordAt.current,
        Date.now(),
        activePathRef.current !== null,
      );
      if (chordAction === 'arm') {
        event.preventDefault();
        event.stopPropagation();
        selectOpenedChordAt.current = Date.now();
        return;
      }
      if (chordAction === 'reveal') {
        event.preventDefault();
        event.stopPropagation();
        selectOpenedChordAt.current = 0;
        void revealActiveRef.current?.();
        return;
      }
      if (chordAction === 'clear') selectOpenedChordAt.current = 0;
      if (event.altKey && !event.metaKey && !event.ctrlKey && event.key === 'F12') {
        event.preventDefault();
        toggleTerminalDock();
        return;
      }
      if (
        event.altKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        (event.key === '1' || event.key === '2' || event.key === '3')
      ) {
        event.preventDefault();
        if (event.key === '3') toggleTerminalDock();
        else selectActivity(event.key === '1' ? 'project' : 'commit', { keyboard: true });
        return;
      }
      if (event.ctrlKey && event.shiftKey && (event.code === 'Backquote' || event.key === '`' || event.key === '~')) {
        event.preventDefault();
        toggleTerminalDock();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [selectActivity, terminalOpen]);
  /* Keyboard navigation over the visible flattened rows. */ /* The typeahead's pending prefix, and when the last key arrived. */ const typeaheadBuffer =
    React.useRef('');
  const typeaheadAt = React.useRef(0);
  const onTreeKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      /* The inline rename field and the create row live inside the tree, so their
             keydown bubbles here. Without this guard every letter typed into a rename
             would also run the typeahead and swallow the keystroke. */ if (
        event.target instanceof Element &&
        event.target.closest('input, textarea, select') !== null
      )
        return;
      if (rows.length === 0) return;
      if (
        sortMode === 'manual' &&
        event.altKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        (event.key === 'ArrowUp' || event.key === 'ArrowDown')
      ) {
        const selected =
          selectedPath === null ? null : rows.find((row) => row.path === selectedPath && row.kind !== 'placeholder');
        if (selected === null || selected === undefined || selected.root === true) return;
        const parent = dirname(selected.path);
        const listing = parent === '' ? entries : children[parent];
        if (!Array.isArray(listing)) return;
        const ordered = orderProjectEntriesByManual(listing, manualOrder[parent]);
        const siblingPaths = new Set(ordered.map((entry) => entry.path));
        const sources = selection.has(selected.path)
          ? [...selection].filter((path) => siblingPaths.has(path) && dirname(path) === parent)
          : [selected.path];
        const boundary = manualReorderBoundary(
          ordered.map((entry) => entry.path),
          sources,
          event.key === 'ArrowUp' ? 'up' : 'down',
        );
        if (boundary === null) return;
        event.preventDefault();
        event.stopPropagation();
        reorderManualProject(sources, boundary.target, boundary.edge);
        window.setTimeout(() => rowRefs.current.get(selected.path)?.scrollIntoView?.({ block: 'nearest' }), 0);
        return;
      }
      /* IDEA's typeahead: a printable key moves the selection, and a pause of a
             second starts a new prefix. Modified keys (⌘N, ⌥…) are commands. */ if (
        event.key.length === 1 &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        const step = typeaheadStep({
          rows,
          buffer: typeaheadBuffer.current,
          path: selectedPath,
          key: event.key,
          now: Date.now(),
          lastAt: typeaheadAt.current,
        });
        typeaheadBuffer.current = step.buffer;
        typeaheadAt.current = step.at;
        if (step.hit !== null) {
          event.preventDefault();
          setSelectedPath(step.hit);
          window.setTimeout(() => rowRefs.current.get(step.hit)?.scrollIntoView({ block: 'nearest' }), 0);
        }
        /* A prefix with no hit must not swallow the key: only claim it once
               something matched, so nothing else in the tree goes dead. */ return;
      }
      /* Placeholder rows are not selectable, so arrow keys step over them. */ const selectable = rows.filter(
        (row) => row.kind !== 'placeholder',
      );
      const currentIndex = selectedPath === null ? -1 : selectable.findIndex((row) => row.path === selectedPath);
      const current = currentIndex >= 0 ? selectable[currentIndex] : null;
      /* IDEA's EditSource opens the selected tree file in the editor. F4 is
             the cross-platform key; macOS also advertises ⌘↓ in the same action. */ const editSource =
        (event.key === 'F4' && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) ||
        ((event.metaKey || event.ctrlKey) && event.key === 'ArrowDown' && !event.altKey && !event.shiftKey);
      if (editSource && current !== null && current.kind !== 'directory') {
        event.preventDefault();
        event.stopPropagation();
        /* EditSource means edit, not only reveal: unlike a tree click,
               this action hands the keyboard to Monaco once the model is open. */ void openFile(current.path).then(
          () => window.setTimeout(() => editorRef.current?.focus(), 0),
        );
        return;
      }
      const focusRow = (index: number, extend = false) => {
        const row = selectable[Math.max(0, Math.min(index, selectable.length - 1))];
        if (row === undefined) return;
        if (extend) {
          /* Shift+Arrow grows the selection from the anchor, IDEA's range behaviour. */ const anchor =
            selectionAnchor.current ?? selectedPath ?? row.path;
          const from = rows.findIndex((entry) => entry.path === anchor);
          const to = rows.findIndex((entry) => entry.path === row.path);
          if (from >= 0 && to >= 0) {
            const [start, end] = from <= to ? [from, to] : [to, from];
            applyTreeSelection(new Set(rows.slice(start, end + 1).map((entry) => entry.path)), row.path, anchor);
          }
        } else {
          setSelectedPath(row.path);
        }
        window.setTimeout(() => rowRefs.current.get(row.path)?.scrollIntoView({ block: 'nearest' }), 0);
      };
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          focusRow(currentIndex + 1, event.shiftKey);
          break;
        case 'ArrowUp':
          event.preventDefault();
          focusRow(currentIndex - 1, event.shiftKey);
          break;
        case 'ArrowRight':
          event.preventDefault();
          if (current?.kind === 'directory') {
            if (!expanded.has(current.path)) void toggleDirectory(current.path);
            else focusRow(currentIndex + 1);
          }
          break;
        case 'ArrowLeft':
          event.preventDefault();
          if (current?.kind === 'directory' && current.root !== true && expanded.has(current.path)) {
            void toggleDirectory(current.path);
          } else if (current !== null && current.depth > 0) {
            for (let index = currentIndex - 1; index >= 0; index -= 1) {
              if (rows[index].depth === current.depth - 1) {
                focusRow(index);
                break;
              }
            }
          }
          break;
        case 'Enter':
          event.preventDefault();
          if (current === null) break;
          if (current.kind === 'directory') {
            if (current.root !== true) void toggleDirectory(current.path);
          } else {
            void openFile(current.path);
          }
          break;
        case 'Home':
          event.preventDefault();
          focusRow(0);
          break;
        case 'End':
          event.preventDefault();
          focusRow(rows.length - 1);
          break;
        case 'F2':
          /* IDEA's ⇧F6 rename, reachable from the keyboard. */ event.preventDefault();
          if (current !== null && current.path !== '') {
            setRenameState({
              path: current.path,
              value: basename(current.path),
            });
          }
          break;
        case 'F6':
          /* ⇧F6 renames, F6 alone is IDEA's "Move to…". */ if (current === null || current.path === '') break;
          event.preventDefault();
          if (event.shiftKey) {
            setRenameState({
              path: current.path,
              value: basename(current.path),
            });
          } else {
            void openMoveTo(selection.size > 1 ? [...selection].filter((path) => path !== '') : current.path);
          }
          break;
        case 'Delete':
        case 'Backspace':
          event.preventDefault();
          if (selection.size > 1) void removeEntries([...selection]);
          else if (current !== null && current.path !== '') void removeEntry(current);
          break;
        case 'Escape':
          event.preventDefault();
          setRenameState(null);
          setCreateState(null);
          break;
        default:
          break;
      }
      /* ⌘/Ctrl+N opens a new file, ⌥⌘N a new directory — IDEA's Project shortcuts. */ if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'n'
      ) {
        event.preventDefault();
        startCreate(event.altKey ? 'directory' : 'file');
      }
      /* ⌘R refreshes the tree, as the row menu advertises. */ if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'r'
      ) {
        event.preventDefault();
        void refreshTree();
      }
    },
    [
      applyTreeSelection,
      children,
      entries,
      expanded,
      manualOrder,
      openFile,
      openMoveTo,
      refreshTree,
      removeEntries,
      removeEntry,
      reorderManualProject,
      rows,
      selectedPath,
      selection,
      setSelectedPath,
      sortMode,
      startCreate,
      toggleDirectory,
    ],
  );
  const toggleCommitPath = React.useCallback((path: string) => {
    setCommitSelection((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);
  const changeTypeaheadBufferRef = React.useRef('');
  const changeTypeaheadAtRef = React.useRef(0);
  /**
   * Keyboard navigation for IDEA's Changes list.
   *
   * The list is one focusable tree in visual order (staged rows, then
   * unstaged, then unversioned), including only rows the current filter has
   * not hidden. Moving the cursor selects but never opens a diff; Enter is
   * the deliberate Show Diff, and Space toggles the commit checkbox.
   * @param {KeyboardEvent} event - keydown from the changes scroller.
   * @returns {void}
   */ const onChangesKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.target instanceof Element && event.target.closest('input, textarea, select') !== null) return;
      const focused = event.currentTarget;
      const nodeCandidate = focused.closest('[data-dsh-changes-list]') ?? focused.closest('[role="tree"]');
      if (!(nodeCandidate instanceof HTMLElement)) return;
      const node = nodeCandidate;
      /* A row's keydown bubbles into the scroller. Act only for the element
           that owns the event; otherwise a row focus move re-runs the handler
           with `currentTarget=row` and walks one extra step. */ if (focused !== node && focused !== event.target)
        return;
      const rows = [
        ...node.querySelectorAll<HTMLElement>(
          '[data-dsh-change-group], [data-dsh-change-path], [data-dsh-change-directory]',
        ),
      ];
      if (rows.length === 0) return;
      const current = selectedChangeRef.current;
      const currentGroup = selectedGroupRef.current;
      const focusedRowCandidate =
        event.target instanceof Element
          ? event.target.closest('[data-dsh-change-group], [data-dsh-change-path], [data-dsh-change-directory]')
          : null;
      const focusedRow = focusedRowCandidate instanceof HTMLElement ? focusedRowCandidate : null;
      const focusedIndex = focusedRow === null ? -1 : rows.indexOf(focusedRow);
      const index =
        focusedIndex >= 0
          ? focusedIndex
          : currentGroup !== null
            ? rows.findIndex((row) => row.getAttribute('data-dsh-change-group') === currentGroup)
            : current === null
              ? -1
              : rows.findIndex(
                  (row) =>
                    row.getAttribute('data-dsh-change-path') === current.path &&
                    (row.getAttribute('data-dsh-change-staged') === 'true') === (current.staged === true),
                );
      if (event.key.length === 1 && event.key !== ' ' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const fileRows = rows.filter((row) => row.hasAttribute('data-dsh-change-path'));
        const candidates = changeTypeaheadRows(
          fileRows.map((row, order) => ({
            path: row.getAttribute('data-dsh-change-path') ?? '',
            staged: row.getAttribute('data-dsh-change-staged') === 'true',
            order,
          })),
        ).map((candidate) => ({
          ...candidate,
          row: fileRows[candidate.order],
        }));
        const step = typeaheadStep({
          rows: candidates,
          buffer: changeTypeaheadBufferRef.current,
          path: current === null ? null : `${current.staged === true ? 'staged' : 'unstaged'}:${current.path}`,
          key: event.key,
          now: Date.now(),
          lastAt: changeTypeaheadAtRef.current,
        });
        changeTypeaheadBufferRef.current = step.buffer;
        changeTypeaheadAtRef.current = step.at;
        if (step.hit !== null) {
          const hit = candidates.find((candidate) => candidate.path === step.hit);
          if (hit !== undefined) {
            event.preventDefault();
            event.stopPropagation();
            chooseChange({ path: hit.workspacePath, staged: hit.staged }, { row: hit.row });
            hit.row.focus?.({ preventScroll: true });
            hit.row.scrollIntoView?.({ block: 'nearest' });
          }
        }
        /* A dead-end prefix leaves the key to the browser instead of swallowing it. */ return;
      }
      const choose = (next: number) => {
        const row = rows[Math.max(0, Math.min(next, rows.length - 1))];
        if (row === undefined) return;
        const group = row.getAttribute('data-dsh-change-group');
        if (group === 'staged' || group === 'unstaged' || group === 'unversioned') {
          chooseGroup(group);
          row.focus?.({ preventScroll: true });
          return;
        }
        if (row.getAttribute('data-dsh-change-directory') !== null) {
          chooseGroup(null);
          row.focus?.({ preventScroll: true });
          row.scrollIntoView?.({ block: 'nearest' });
          return;
        }
        const path = row.getAttribute('data-dsh-change-path');
        if (path === null || path === '') return;
        chooseChange(
          {
            path,
            staged: row.getAttribute('data-dsh-change-staged') === 'true',
          },
          { shift: event.shiftKey, row },
        );
        row.focus?.({ preventScroll: true });
      };
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        choose(index < 0 ? 0 : index + 1);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        choose(index < 0 ? rows.length - 1 : index - 1);
        return;
      }
      if (event.key === 'Home') {
        event.preventDefault();
        event.stopPropagation();
        choose(0);
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        event.stopPropagation();
        choose(rows.length - 1);
        return;
      }
      if (current === null) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        setActivity('commit');
        setPanelVisible(true);
        const focusedRow = event.target instanceof Element ? event.target.closest('[data-dsh-change-path]') : null;
        diffReturnFocusRef.current = focusedRow instanceof HTMLElement ? focusedRow : node;
        setDiffTarget({ path: current.path, staged: current.staged === true });
        setDiffActive(true);
        return;
      }
      if (event.key === ' ') {
        event.preventDefault();
        event.stopPropagation(); /* The keyup handler performs the toggle after the default is
             blocked. Doing it here as well would toggle twice. */
      }
    },
    [chooseChange, chooseGroup, toggleCommitPath],
  );
  /**
   * Commit the Space toggle on keyup.
   *
   * Browsers dispatch the keydown first and use Space's default to scroll
   * or activate the focused row; treating keyup as the committed gesture
   * keeps one press to exactly one toggle and matches the native checkbox
   * timing. Arrow/Home/End continue to act on keydown.
   * @param {KeyboardEvent} event - keyup from the changes list or a row.
   * @returns {void}
   */ const onChangesKeyUp = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key !== ' ' && event.key !== 'Spacebar') return;
      if (event.target instanceof Element && event.target.closest('input, textarea, select') !== null) return;
      const target = event.target instanceof Element ? event.target : null;
      const active = document.activeElement instanceof Element ? document.activeElement : null;
      const row = target?.closest('[data-dsh-change-path]') ?? active?.closest('[data-dsh-change-path]');
      const current = selectedChangeRef.current;
      const path = row?.getAttribute('data-dsh-change-path') ?? current?.path ?? null;
      if (path === null) return;
      event.preventDefault();
      event.stopPropagation();
      toggleCommitPath(path);
    },
    [toggleCommitPath],
  );
  /* One group's checkbox toggles every file in it, like IDEA's changelist node. */ const toggleCommitGroup =
    React.useCallback(
      (group: ChangeGroup) => {
        const changes = git?.changes ?? [];
        const members = splitChanges(changes)[group] ?? [];
        setCommitSelection((current) => {
          const next = new Set(current);
          const all = members.length > 0 && members.every((change) => next.has(change.path));
          for (const change of members) {
            if (all) next.delete(change.path);
            else next.add(change.path);
          }
          return next;
        });
      },
      [git],
    );
  /**
   * Flip one collapse key, or a whole list of them (the ⌥-click subtree case).
   *
   * Flipping a list against the SAME starting set is what makes the gesture
   * read as one action: deciding each key from a freshly read state would
   * toggle the first level and leave the rest in place.
   * @param {string|string[]} key - one collapse key or several.
   */ const toggleCollapsedGroup = React.useCallback((key: string | string[]) => {
    const keys = Array.isArray(key) ? key : [key];
    if (keys.length === 0) return;
    setCollapsedGroups((current) => {
      const next = new Set(current);
      const collapse = !next.has(keys[0]);
      for (const entry of keys) {
        if (collapse) next.add(entry);
        else next.delete(entry);
      }
      writeCollapsedGroups(rootRef.current, next);
      return next;
    });
  }, []);
  /* Stage or unstage the ticked files without touching the rest of the index. */ /* IDEA prefills the message box with the previous message while Amend is ticked. */ /**
   * Toggle Amend, pre-filling the box from the previous commit.
   *
   * IDEA prefills subject AND body, and only when the box is empty: an amend
   * with a half-written new message must not be silently overwritten.
   */ const toggleAmend = React.useCallback(
    (next: boolean) => {
      setAmend(next);
      if (!next) {
        /* Turning amend off restores what the user had before it was turned on. */ if (
          preAmendMessage.current !== null
        ) {
          setCommitMessage(preAmendMessage.current);
          preAmendMessage.current = null;
        }
        return;
      }
      const previous = git?.lastCommit;
      if (previous === null || previous === undefined) return;
      if (commitMessage.trim() !== '') return;
      preAmendMessage.current = commitMessage;
      const body = typeof previous.body === 'string' ? previous.body.trimEnd() : '';
      setCommitMessage(body === '' ? previous.subject : `${previous.subject}\n\n${body}`);
    },
    [commitMessage, git],
  );
  /**
   * Store one message in the per-workspace history, newest first.
   *
   * IDEA keeps roughly the last 20 messages; duplicates move to the top rather
   * than being appended twice, so ↑/↓ never cycles through the same text.
   * @param {string} message - submitted commit message.
   */ const rememberMessage = React.useCallback(
    (message: string) => {
      const text = message.trim();
      if (text === '' || root === '') return;
      setMessageHistory((current) => {
        const next = [text, ...current.filter((entry) => entry !== text)].slice(0, 20);
        try {
          window.localStorage.setItem(`dsh-editor.commitHistory:${root}`, JSON.stringify(next));
        } catch {
          /* a storage-less browser keeps the in-memory history only */
        }
        return next;
      });
      setHistoryIndex(-1);
    },
    [root],
  );
  /**
   * Walk the message history with ↑/↓, returning to the draft after the oldest entry.
   * @param {number} direction - +1 older, -1 newer.
   */ const recallMessage = React.useCallback(
    (direction: number) => {
      if (messageHistory.length === 0) return;
      /* Walking back past the newest entry must restore what the user had typed,
             not blank the box: the draft is not part of the history. */ if (
        historyIndex === -1 &&
        draftBeforeRecall.current === null
      )
        draftBeforeRecall.current = commitMessage;
      setHistoryIndex((current) => {
        const next = Math.max(-1, Math.min(messageHistory.length - 1, current + direction));
        if (next < 0) setCommitMessage(draftBeforeRecall.current ?? '');
        else setCommitMessage(messageHistory[next]);
        return next;
      });
    },
    [commitMessage, historyIndex, messageHistory],
  );
  /**
   * Select one message from the visible history menu.
   *
   * The menu is a direct jump, but it keeps the same draft-protection and
   * arrow-walk position as repeated ↑/↓, so switching interaction style does
   * not lose what the user was typing.
   * @param {number} index - history entry, newest first.
   * @returns {void}
   */ const selectHistoryMessage = React.useCallback(
    (index: number) => {
      if (!Number.isInteger(index) || index < 0 || index >= messageHistory.length) return;
      if (draftBeforeRecall.current === null && historyIndex === -1) draftBeforeRecall.current = commitMessage;
      setHistoryIndex(index);
      setCommitMessage(messageHistory[index]);
    },
    [commitMessage, historyIndex, messageHistory],
  );
  /**
   * Put the just-committed message back into the box.
   *
   * IDEA's commit box has an undo for the clear; without it, a mis-click after
   * a long message means retyping it. The commit itself is never undone.
   */ const restoreClearedMessage = React.useCallback(() => {
    if (clearedMessage === '') return;
    setCommitMessage(clearedMessage);
    setClearedMessage('');
    writeCommitDraft(root, clearedMessage);
  }, [clearedMessage, root]);
  /**
   * Push the current branch on its own, IDEA's "Push" action and the retry
   * path after a commit whose push was rejected.
   *
   * Publishing (no upstream yet) is handled by the host, so the failure the
   * user sees is the real reason rather than git's "no upstream" paragraph.
   */ const pushNow = React.useCallback(async () => {
    setPushBusy(true);
    setPushError(null);
    try {
      const value = await callGit<WorkspaceGitStatus>({
        op: 'push',
      });
      setGit(value);
      setCommitNotice(
        value.published === true ? t('editor.pushedPublished', { branch: value.branch ?? '' }) : t('editor.pushed'),
      );
      setCommitError(null);
    } catch (failure) {
      setPushError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setPushBusy(false);
    }
  }, [t]);
  /**
   * Fetch every remote without touching the working tree (IDEA's Fetch).
   *
   * Only remote-tracking refs move, so open buffers stay valid; the point of
   * running it is the refreshed `behind` count in the commit toolbar.
   * @returns {Promise<void>} resolves once the status has been refreshed.
   */ const fetchNow = React.useCallback(async () => {
    setFetchBusy(true);
    setCommitError(null);
    try {
      const value = await callGit<WorkspaceGitStatus>({
        op: 'fetch',
      });
      setGit(value);
      setCommitNotice(t('editor.fetchDone', { count: (value?.remotes ?? []).length }));
      setPushError(null);
    } catch (failure) {
      setCommitError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setFetchBusy(false);
    }
  }, [t]);
  /**
   * IDEA's Update Project: fast-forward onto the upstream and re-read tabs.
   *
   * The working tree is rewritten by the update, so every open tab is read
   * again — otherwise the editor would show the pre-update text and the next
   * save would silently revert the update. Unsaved edits are confirmed first.
   * @returns {Promise<void>} resolves once the tree and tabs are refreshed.
   */ const updateNow = React.useCallback(async () => {
    if ((openFilesRef.current ?? []).some((file) => file.dirty === true) && !window.confirm(t('editor.updateDirty')))
      return;
    setUpdateBusy(true);
    setCommitError(null);
    setCommitNotice(null);
    try {
      const value = await callGit<WorkspaceGitStatus>({
        op: 'pull',
      });
      setGit(value);
      setDiffTarget(null);
      setExternalChanges({});
      await refreshTree();
      for (const file of openFilesRef.current) await reloadFile(file.path);
      /* The pull just moved HEAD: a Log tab still showing the old first page
             would hide the commits that arrived, so re-read it (and drop a file
             history filter, whose commit set the update may have rewritten). */ setHistoryPath(null);
      await loadLog();
      setCommitNotice(t('editor.updateDone', { branch: value?.branch ?? '' }));
    } catch (failure) {
      setCommitError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setUpdateBusy(false);
    }
  }, [loadLog, reloadFile, refreshTree, t]);
  /**
   * IDEA's Commit tool-window options.
   *
   * Fetch, Update, Stash, Shelve and Group by are low-frequency commands. Keeping
   * them as separate toolbar buttons crowded out Refresh/Hide at a 200px tool
   * window, so they live behind the same Settings entry IDEA uses.
   * @param {{x: number, y: number}} position - toolbar popup anchor.
   * @returns {void}
   */ const openCommitOptionsMenu = React.useCallback(
    (position: { x: number; y: number }) => {
      const stageAllPaths = stageAllTargets(git?.changes ?? [], false);
      setMenu(
        commitOptionsMenu({
          t,
          position: {
            x: position?.x ?? 240,
            y: position?.y ?? 120,
          },
          fetchBusy,
          updateBusy,
          commitBusy,
          stageAllAvailable: stageAllPaths.length > 0,
          groupBy,
          onApplyChangeGroupBy: applyChangeGroupBy,
          onFetch: () => void fetchNow(),
          onUpdate: () => void updateNow(),
          onApplyPatchFile: applyPatchFile,
          onApplyPatchClipboard: () => void applyPatchClipboard(),
          onStageAll: () => void stageEveryChange(false),
          onStash: () => void openStashMenu(position),
          onShelve: () => void openShelveMenu(position),
        }),
      );
    },
    [
      applyPatchClipboard,
      applyPatchFile,
      applyChangeGroupBy,
      commitBusy,
      fetchBusy,
      fetchNow,
      git,
      groupBy,
      openShelveMenu,
      openStashMenu,
      stageEveryChange,
      t,
      updateBusy,
      updateNow,
    ],
  );
  const commit = React.useCallback(
    async (push: boolean) => {
      const paths = [...commitSelection];
      if (commitMessage.trim() === '' || paths.length === 0) return;
      setCommitBusy(true);
      setCommitError(null);
      setCommitNotice(null);
      setPushError(null);
      try {
        const inspection = await callGit<{
          identity?: { name?: string; email?: string };
          conflicts: unknown[];
          whitespace: unknown[];
        }>({ op: 'inspect', paths });
        /* inspect also reports the identity, so the guard costs no extra round trip. */ setIdentityMissing(
          inspection.identity?.name === '' || inspection.identity?.email === '',
        );
        if (inspection.conflicts.length > 0) {
          throw new Error(t('editor.commitConflicts', { count: inspection.conflicts.length }));
        }
        if (
          inspection.whitespace.length > 0 &&
          !window.confirm(
            t('editor.commitWhitespace', {
              count: inspection.whitespace.length,
            }),
          )
        ) {
          return;
        }
        /* IDEA warns that a commit leaves untracked files behind, but never blocks it. */ const untrackedLeft = (
          git?.changes ?? []
        ).filter((change) => change.status === '??' && !paths.includes(change.path));
        if (untrackedLeft.length > 0 && !window.confirm(t('editor.commitUntracked', { count: untrackedLeft.length }))) {
          return;
        }
        const value = await callGit<WorkspaceGitStatus>({
          op: 'commit',
          message: commitMessage,
          paths,
          amend,
          push,
        });
        setGit(value);
        setCommitSelection(new Set((value?.changes ?? []).map((change) => change.path)));
        rememberMessage(commitMessage);
        /* Keep the text so the "cleared by mistake" case has a one-click undo. */ setClearedMessage(commitMessage);
        setCommitMessage('');
        writeCommitDraft(root, '');
        setAmend(false);
        setDiffTarget(null);
        /* A rejected push keeps the commit: IDEA reports both outcomes separately. */ setCommitNotice(
          t('editor.committed'),
        );
        setCommitError(null);
        /* A rejected push keeps the commit: offer a dedicated retry rather than a bare message. */ setPushError(
          value.pushError ?? null,
        );
        setTreeError(null);
        /* IDEA refreshes the Log tab after a commit so the new row is there immediately. */ await loadLog();
        /* Remember which commit we just made so the list can point at it. */ const head = value?.lastCommit?.hash;
        if (typeof head === 'string' && head !== '') {
          setHighlightedCommit(head);
          setCommitMode('log');
        }
      } catch (error) {
        setCommitError(error instanceof Error ? error.message : String(error));
      } finally {
        setCommitBusy(false);
      }
    },
    [amend, commitMessage, commitSelection, git, loadLog, root, t],
  );
  const tabs = openFiles.map((file) => {
    const fileTabActive = diffActive === false && file.path === activePath;
    const preview = file.path === previewPath;
    return (
      <EditorFileTab
        key={file.path}
        path={file.path}
        label={basename(file.path)}
        active={fileTabActive}
        dirty={file.dirty === true}
        className={`${fileTabActive ? 'dsh-editor-tab dsh-editor-tab-active' : 'dsh-editor-tab'}${file.path === previewPath ? ' dsh-editor-tab-preview' : ''}`}
        style={{
          ...styles.tab,
          ...(fileTabActive ? styles.tabActive : null),
          ...(preview ? { fontStyle: 'italic' } : null),
          ...(editorTabDrop?.group === 'left' && editorTabDrop.path === file.path
            ? {
                boxShadow: editorTabDrop.after
                  ? 'inset -2px 0 0 var(--dsw-alias-state-business-primary)'
                  : 'inset 2px 0 0 var(--dsw-alias-state-business-primary)',
              }
            : null),
          ...(editorTabDrag?.group === 'left' && editorTabDrag.path === file.path ? { opacity: 0.55 } : null),
        }}
        title={file.dirty ? `${file.path} — ${t('editor.unsavedTitle')}` : file.path}
        closeLabel={t('editor.closeTab', { name: basename(file.path) })}
        dataAttributeName='data-dsh-editor-file-tab-path'
        onFocus={() => {
          if (fileTabActive) return;
          setActivePath(file.path);
          setDiffActive(false);
        }}
        onActivate={() => {
          setActivePath(file.path);
          setDiffActive(false);
        }}
        onKeyDown={(event) => {
          if (!gotoLineShortcutMatches(event)) return;
          event.preventDefault();
          event.stopPropagation();
          gotoLine(file.path, 'left');
        }}
        onAuxClick={(event) => {
          if (event.button !== 1) return;
          event.preventDefault();
          closeFile(file.path);
        }}
        onDragStart={(event) => beginEditorTabDrag(event, 'left', file.path)}
        onDragOver={(event) => dragOverEditorTab(event, 'left', file.path)}
        onDragLeave={() =>
          setEditorTabDrop((current) => (current?.group === 'left' && current.path === file.path ? null : current))
        }
        onDrop={(event) => dropEditorTab(event, 'left', file.path)}
        onDragEnd={() => {
          editorTabDragRef.current = null;
          setEditorTabDrag(null);
          setEditorTabDrop(null);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setActivePath(file.path);
          setDiffActive(false);
          const tabIndex = allTabs.indexOf(file);
          const openIndex = openFiles.findIndex((entry) => entry.path === file.path);
          setMenu({
            x: event.clientX,
            y: event.clientY,
            items: [
              buildHarnessPathAction([{ path: file.path, isDirectory: false }]),
              null,
              ...(preview
                ? [
                    {
                      id: 'keepTabOpen',
                      label: t('editor.keepTabOpen'),
                      run: () => {
                        if (previewPathRef.current === file.path) {
                          previewPathRef.current = null;
                          setPreviewPath(null);
                        }
                      },
                    },
                    null,
                  ]
                : []),
              {
                id: 'close',
                label: t('editor.closeTab', { name: basename(file.path) }),
                shortcut: '⌘W',
                run: () => closeFile(file.path),
              },
              {
                id: 'closeOthers',
                label: t('editor.closeOtherTabs'),
                run: () => closeOtherTabs(file.path),
              },
              {
                id: 'closeLeft',
                label: t('editor.closeTabsLeft'),
                disabled: tabIndex <= 0,
                run: () => closeEditorTabs(allTabs.slice(0, tabIndex).map(tabKey)),
              },
              {
                id: 'closeRight',
                label: t('editor.closeTabsRight'),
                disabled: tabIndex < 0 || tabIndex >= allTabs.length - 1,
                run: () => closeEditorTabs(allTabs.slice(tabIndex + 1).map(tabKey)),
              },
              {
                id: 'closeAll',
                label: t('editor.closeAllTabs'),
                run: () => closeAllTabs(),
              },
              null,
              {
                id: 'moveLeft',
                label: t('editor.terminalMoveLeft'),
                disabled: openIndex <= 0,
                run: () => moveEditorTabByOffset('left', file.path, -1),
              },
              {
                id: 'moveRight',
                label: t('editor.terminalMoveRight'),
                disabled: openIndex < 0 || openIndex >= openFiles.length - 1,
                run: () => moveEditorTabByOffset('left', file.path, 1),
              },
              null,
              {
                id: 'saveAll',
                label: t('editor.saveAll'),
                shortcut: '⌥⌘S',
                run: () => void saveAll(),
              },
              null,
              {
                id: 'copyPath',
                label: t('editor.copyTabPath'),
                run: () =>
                  void navigator.clipboard?.writeText(root === '' ? file.path : `${root}/${file.path}`).catch(() => {}),
              },
              {
                id: 'reveal',
                label: t('editor.revealInProject'),
                run: () => void revealActive(),
                disabled: file.path !== activePath,
              },
            ],
          });
        }}
        onClose={() => closeFile(file.path)}
      />
    );
  });
  /**
   * The diff's own editor tab, IDEA's "Commit: <name>".
   *
   * There is exactly ONE such tab: opening another change re-uses it and
   * swaps the content, the way IDEA replaces a single diff tab instead of
   * piling up one tab per changed file. A change or a commit's file reads
   * "Commit: <name>"; clipboard / revision comparisons read "Compare:".
   */ const diffIsCompare =
    diffTarget !== null && (typeof diffTarget.clipboardText === 'string' || typeof diffTarget.revision === 'string');
  const diffTabName =
    diffTarget === null
      ? ''
      : diffTarget.repositoryVersion !== null && typeof diffTarget.repositoryVersion === 'object'
        ? t('editor.repositoryVersionTab', {
            name: basename(diffTarget.path),
            hash: String(diffTarget.repositoryVersion.hash ?? '').slice(0, 7),
          })
        : diffTarget.combined === true
          ? diffTarget.revisionPair !== null && typeof diffTarget.revisionPair === 'object'
            ? t('editor.compareRevisionsTitle', {
                count: diffTarget.entries?.length ?? 0,
              })
            : typeof diffTarget.commitWithLocal === 'string'
              ? t('editor.compareWithLocalTitle', {
                  count: diffTarget.entries?.length ?? 0,
                })
              : t('editor.combinedDiffTitle', {
                  count: diffTarget.entries?.length ?? 0,
                })
          : t(diffIsCompare ? 'editor.compareTab' : 'editor.commitTab', {
              name: basename(diffTarget.path),
            });
  const diffTab =
    diffTarget === null ? null : (
      <EditorDiffTab
        key='dsh-editor-difftab'
        label={diffTabName}
        title={
          diffTarget.combined === true ||
          (diffTarget.repositoryVersion !== null && typeof diffTarget.repositoryVersion === 'object')
            ? diffTabName
            : `${diffTabName} — ${diffTarget.path}`
        }
        active={diffActive}
        className={
          diffActive ? 'dsh-editor-tab dsh-editor-tab-active dsh-editor-diff-tab' : 'dsh-editor-tab dsh-editor-diff-tab'
        }
        style={{ ...styles.tab, ...(diffActive ? styles.tabActive : null) }}
        closeLabel={t('editor.closeTab', { name: diffTabName })}
        onActivate={() => setDiffActive(true)}
        onAuxClick={(event) => {
          if (event.button !== 1) return;
          event.preventDefault();
          closeDiff();
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDiffActive(true);
          const diffTabIndex = allTabs.indexOf(DIFF_TAB_KEY);
          setMenu({
            x: event.clientX,
            y: event.clientY,
            items: [
              buildHarnessPathAction([{ path: diffTarget.path, isDirectory: false }]),
              null,
              {
                id: 'close',
                label: t('editor.closeTab', { name: diffTabName }),
                shortcut: '⌘W',
                run: () => closeDiff(),
              },
              {
                id: 'closeOthers',
                label: t('editor.closeOtherTabs'),
                disabled: openFiles.length === 0,
                run: () => closeEditorTabs(openFiles.map((file) => file.path)),
              },
              {
                id: 'closeRight',
                label: t('editor.closeTabsRight'),
                disabled: openFiles.length === 0,
                run: () => closeEditorTabs(allTabs.slice(diffTabIndex + 1).map(tabKey)),
              },
              {
                id: 'closeAll',
                label: t('editor.closeAllTabs'),
                run: () => closeAllTabs(),
              },
              ...(diffTarget.combined === true
                ? []
                : [
                    null,
                    {
                      id: 'openFile',
                      label: t('editor.openInEditor'),
                      run: (): void => void openFile(diffTarget.path),
                    },
                  ]),
            ],
          });
        }}
        onClose={closeDiff}
      />
    );
  /* One layout for this render: which tabs fit and which go to `»`. The diff
         tab is pinned FIRST, so the one tab the user is reading never overflows. */ const allTabs =
    diffTab === null ? openFiles : [DIFF_TAB_KEY, ...openFiles];
  const tabKey = (entry: string | OpenWorkspaceFile): string => (typeof entry === 'string' ? entry : entry.path);
  const activeTabKey = diffActive ? DIFF_TAB_KEY : activePath;
  const fileTabElement = (entry: string | OpenWorkspaceFile): React.ReactElement | null =>
    typeof entry === 'string' ? diffTab : (tabs[openFiles.indexOf(entry)] ?? null);
  const fileTabLayout = overflowTabs(allTabs, visibleTabCount(tabStripWidth, allTabs.length), activeTabKey, tabKey);
  const splitTabLayout = overflowTabs(
    splitTabs,
    visibleTabCount(splitTabStripWidth, splitTabs.length),
    splitPath,
    (path) => path,
  );
  const splitTabElements = splitTabLayout.visible.map((splitTab) => {
    const splitTabFile = openFiles.find((file) => file.path === splitTab) ?? null;
    const splitTabActive = splitTab === splitFile.path;
    const splitTabIndex = splitTabs.indexOf(splitTab);
    return (
      <EditorFileTab
        key={splitTab}
        path={splitTab}
        label={basename(splitTab)}
        active={splitTabActive}
        dirty={splitTabFile?.dirty === true}
        className='dsh-editor-split-tab'
        style={{
          ...styles.editorSplitTab,
          ...(splitTabActive ? styles.editorSplitTabActive : null),
          ...(splitTabLayout.hidden.length === 0 ? null : { maxWidth: '100%', minWidth: 0, overflow: 'hidden' }),
          ...(editorTabDrop?.group === 'right' && editorTabDrop.path === splitTab
            ? {
                boxShadow: editorTabDrop.after
                  ? 'inset -2px 0 0 var(--dsw-alias-state-business-primary)'
                  : 'inset 2px 0 0 var(--dsw-alias-state-business-primary)',
              }
            : null),
          ...(editorTabDrag?.group === 'right' && editorTabDrag.path === splitTab ? { opacity: 0.55 } : null),
        }}
        title={splitTabFile?.dirty === true ? `${splitTab} — ${t('editor.unsavedTitle')}` : splitTab}
        closeLabel={t('editor.closeTab', { name: basename(splitTab) })}
        dataAttributeName='data-dsh-editor-split-path'
        onFocus={() => {
          if (splitTabActive) return;
          splitPathRef.current = splitTab;
          setSplitPath(splitTab);
        }}
        onActivate={() => {
          splitPathRef.current = splitTab;
          setSplitPath(splitTab);
          window.setTimeout(() => splitEditorRef.current?.focus?.(), 0);
        }}
        onKeyDown={(event) => {
          if (!gotoLineShortcutMatches(event)) return;
          event.preventDefault();
          event.stopPropagation();
          gotoLine(splitTab, 'right');
        }}
        onAuxClick={(event) => {
          if (event.button !== 1) return;
          event.preventDefault();
          closeSplitTab(splitTab);
        }}
        onDragStart={(event) => beginEditorTabDrag(event, 'right', splitTab)}
        onDragOver={(event) => dragOverEditorTab(event, 'right', splitTab)}
        onDragLeave={() =>
          setEditorTabDrop((current) => (current?.group === 'right' && current.path === splitTab ? null : current))
        }
        onDrop={(event) => dropEditorTab(event, 'right', splitTab)}
        onDragEnd={() => {
          editorTabDragRef.current = null;
          setEditorTabDrag(null);
          setEditorTabDrop(null);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setMenu({
            x: event.clientX,
            y: event.clientY,
            title: basename(splitTab),
            items: [
              buildHarnessPathAction([{ path: splitTab, isDirectory: false }]),
              null,
              {
                id: 'close',
                label: t('editor.closeTab', { name: basename(splitTab) }),
                shortcut: '⌘W',
                run: () => closeSplitTab(splitTab),
              },
              {
                id: 'closeOthers',
                label: t('editor.closeOtherTabs'),
                disabled: splitTabs.length <= 1,
                run: () => closeSplitTabs(splitTabs.filter((path) => path !== splitTab)),
              },
              {
                id: 'closeLeft',
                label: t('editor.closeTabsLeft'),
                disabled: splitTabIndex <= 0,
                run: () => closeSplitTabs(splitTabs.slice(0, splitTabIndex)),
              },
              {
                id: 'closeRight',
                label: t('editor.closeTabsRight'),
                disabled: splitTabIndex < 0 || splitTabIndex >= splitTabs.length - 1,
                run: () => closeSplitTabs(splitTabs.slice(splitTabIndex + 1)),
              },
              {
                id: 'closeAll',
                label: t('editor.closeAllTabs'),
                run: () => closeSplitTabs(splitTabs),
              },
              null,
              {
                id: 'moveLeft',
                label: t('editor.terminalMoveLeft'),
                disabled: splitTabIndex <= 0,
                run: () => moveEditorTabByOffset('right', splitTab, -1),
              },
              {
                id: 'moveRight',
                label: t('editor.terminalMoveRight'),
                disabled: splitTabIndex < 0 || splitTabIndex >= splitTabs.length - 1,
                run: () => moveEditorTabByOffset('right', splitTab, 1),
              },
              null,
              {
                id: 'save',
                label: t('editor.save'),
                shortcut: '⌘S',
                run: () => void savePath(splitTab),
              },
              {
                id: 'copyPath',
                label: t('editor.copyRelativePath'),
                run: () => void navigator.clipboard?.writeText(splitTab).catch(() => {}),
              },
              {
                id: 'reveal',
                label: t('editor.revealInProject'),
                run: () => void revealPath(splitTab),
              },
            ],
          });
        }}
        onClose={() => closeSplitTab(splitTab)}
      />
    );
  });
  const findToolWindowElement =
    findTool === null ? null : (
      <FindToolWindow
        t={t}
        state={findTool}
        floating={findTool.surface !== 'dock'}
        activeFilePath={activePath}
        openFilePaths={openFiles.map((file) => file.path)}
        recentFilePaths={recentFiles}
        gitAvailable={git !== null && typeof git.branch === 'string' && git.branch !== ''}
        openFilesRef={openFilesRef}
        changedFilePaths={(git?.changes ?? []).map((change) => change.path)}
        customScopes={customFindScopes}
        queryHistory={recentFindQueries}
        replaceHistory={recentReplacements}
        onQuery={(query) => {
          setFindTool((current) => (current === null ? current : findToolQueryTransition(current, query)));
        }}
        onReplace={(replace) => setFindTool((current) => (current === null ? current : { ...current, replace }))}
        onToggleCaseSensitive={() =>
          setFindTool((current) =>
            current === null
              ? current
              : {
                  ...current,
                  caseSensitive: current.caseSensitive !== true,
                  files: [],
                  matches: [],
                  index: 0,
                  error: null,
                  loadedGeneration: -1,
                  searchGeneration: (current.searchGeneration ?? 0) + 1,
                },
          )
        }
        onToggleWholeWords={() =>
          setFindTool((current) =>
            current === null
              ? current
              : {
                  ...current,
                  wholeWords: current.regex !== true && current.wholeWords !== true,
                  files: [],
                  matches: [],
                  index: 0,
                  error: null,
                  loadedGeneration: -1,
                  searchGeneration: (current.searchGeneration ?? 0) + 1,
                },
          )
        }
        onToggleRegex={() =>
          setFindTool((current) =>
            current === null
              ? current
              : {
                  ...current,
                  regex: current.regex !== true,
                  wholeWords: false,
                  files: [],
                  matches: [],
                  index: 0,
                  error: null,
                  loadedGeneration: -1,
                  searchGeneration: (current.searchGeneration ?? 0) + 1,
                },
          )
        }
        onTogglePreserveCase={() =>
          setFindTool((current) =>
            current === null ? current : { ...current, preserveCase: current.preserveCase !== true },
          )
        }
        onToggleIncludeExcluded={() =>
          setFindTool((current) =>
            current === null
              ? current
              : {
                  ...current,
                  includeExcluded: current.includeExcluded !== true,
                  files: [],
                  matches: [],
                  index: 0,
                  error: null,
                  loadedGeneration: -1,
                  searchGeneration: (current.searchGeneration ?? 0) + 1,
                },
          )
        }
        onContextFilterChange={(contextFilter) =>
          setFindTool((current) =>
            current === null
              ? current
              : {
                  ...current,
                  contextFilter: normalizeTextSearchContextFilter(contextFilter),
                  files: [],
                  matches: [],
                  index: 0,
                  error: null,
                  loadedGeneration: -1,
                  searchGeneration: (current.searchGeneration ?? 0) + 1,
                },
          )
        }
        onFileMaskChange={(fileMask) =>
          setFindTool((current) =>
            current === null
              ? current
              : {
                  ...current,
                  fileMask,
                  files: [],
                  matches: [],
                  index: 0,
                  error: null,
                  loadedGeneration: -1,
                  searchGeneration: (current.searchGeneration ?? 0) + 1,
                },
          )
        }
        onScopeChange={changeFindToolScope}
        onDirectoryRecursiveChange={changeFindDirectoryRecursive}
        onCustomScopesChange={changeCustomFindScopes}
        onMove={(direction, count, absolute = null) =>
          setFindTool((current) => {
            if (current === null) return current;
            if (count === 0) return { ...current, index: 0 };
            if (Number.isFinite(absolute))
              return {
                ...current,
                index: Math.max(0, Math.min(count - 1, absolute)),
              };
            return {
              ...current,
              index: (current.index + direction + count) % count,
            };
          })
        }
        onOpen={(result, openInNewTab = false) => {
          if (openInNewTab) {
            void openInRightSplit(
              result.path,
              result.kind === 'text'
                ? {
                    path: result.path,
                    line: result.line,
                    column: result.column,
                  }
                : null,
            );
            return;
          }
          if (result.kind === 'text') {
            openFileAtLocation(result.path, result.line, result.column);
            return;
          }
          void openFile(result.path);
        }}
        onOpenInRightSplit={(path, location) => {
          const validLocation =
            location !== null &&
            location !== undefined &&
            typeof location.line === 'number' &&
            typeof location.column === 'number'
              ? { path: location.path, line: location.line, column: location.column }
              : null;
          void openInRightSplit(path, validLocation);
        }}
        onRevealResult={(path) => void revealPath(path)}
        onNotify={(message) => flashStatus(message)}
        onReplaceMode={() => setFindTool((current) => (current === null ? current : { ...current, mode: 'replace' }))}
        onReplaceOccurrence={(match, activeIndex) => void replaceFindToolOccurrence(match, activeIndex)}
        onReplaceAll={(allowedPaths) => void replaceInFindTool(allowedPaths)}
        canUndoLastReplace={findReplaceUndoStack.length > 0}
        onUndoLastReplace={() => void undoFindReplace()}
        canRedoLastReplace={findReplaceRedoStack.length > 0}
        onRedoLastReplace={() => void redoFindReplace()}
        onOpenSettings={openFindToolSettings}
        onOpenInFindWindow={openFindToolInDock}
        onClose={closeFindToolWindow}
        minimized={findToolDockMinimized}
        onMinimize={toggleFindToolDockMinimized}
      />
    );
  return (
    <EditorWorkspaceShell
      workspaceId={workspaceId}
      editorFileDragProps={editorFileDragProps}>
      {
        /* No title/save/refresh bar: the tool-window toolbars already sit at the top,
           the breadcrumb strip names the open file, and saving belongs to ⌘/Ctrl+S
           (plus ⌥⌘S for "save all"), so a second row only cost vertical space. */ menu === null ? null : (
          <ContextMenu
            menu={menu}
            onClose={() => setMenu(null)}
            t={t}
          />
        )
      }
      {showUsages === null ? null : (
        <ShowUsagesPopup
          t={t}
          state={showUsages}
          onFilterChange={(filter) =>
            setShowUsages((current) => (current === null ? current : { ...current, filter, index: 0 }))
          }
          onMove={(index) => setShowUsages((current) => (current === null ? current : { ...current, index }))}
          onOpen={(match) => {
            closeShowUsages();
            openFileAtLocation(match.path, match.line, match.column);
          }}
          onPin={pinShowUsages}
          onOpenInRightSplit={(path, location) => {
            closeShowUsages();
            void openInRightSplit(path, location);
          }}
          onRevealResult={(path) => {
            closeShowUsages();
            void revealPath(path);
          }}
          onNotify={(message) => flashStatus(message)}
          onClose={closeShowUsages}
        />
      )}
      <FloatingToolPopup
        open={searchEverywhere !== null}
        kind='searchEverywhere'
        geometry={searchEverywherePopupGeometry}
        surfaceStyle={styles.searchEverywherePopup}
        backdrop={true}
        onBackdropMouseDown={dismissSearchEverywhere}
        onGeometryChange={setSearchEverywherePopupGeometry}
        onGeometryCommit={(geometry) =>
          writeFloatingPopupGeometry(
            SEARCH_EVERYWHERE_POPUP_GEOMETRY_STORAGE_KEY,
            geometry,
            SEARCH_EVERYWHERE_POPUP_GEOMETRY_DEFAULTS,
          )
        }>
        {searchEverywhere === null ? null : (
          <SearchEverywhere
            t={t}
            state={searchEverywhere}
            files={searchEverywhere.files ?? []}
            openFiles={openFiles}
            changes={new Map((git?.changes ?? []).map((change) => [change.path, change.status]))}
            textMatches={searchEverywhere.textMatches ?? []}
            actions={searchEverywhereActions}
            recentSearches={recentSearches}
            recentFindUsages={recentFindUsages}
            recentCommands={recentCommands}
            historyRequest={searchHistoryRequest}
            findUsagesHistoryRequest={findUsagesHistoryRequest}
            replaceHistory={recentReplacements}
            textLoading={searchEverywhere.textLoading === true}
            textTruncated={searchEverywhere.textTruncated === true}
            error={searchEverywhere.error ?? null}
            replaceBusy={searchEverywhere.replaceBusy === true}
            onQuery={(query) =>
              setSearchEverywhere((current) => (current === null ? current : { ...current, query, index: 0 }))
            }
            onTab={(tab) =>
              setSearchEverywhere((current) =>
                current === null ? current : searchEverywhereTabTransition(current, tab),
              )
            }
            onMove={(direction, count, absolute = null) =>
              setSearchEverywhere((current) => {
                if (current === null) return current;
                if (count === 0) return { ...current, index: 0 };
                if (Number.isFinite(absolute))
                  return {
                    ...current,
                    index: Math.max(0, Math.min(count - 1, absolute)),
                  };
                return {
                  ...current,
                  index: (current.index + direction + count) % count,
                };
              })
            }
            onActivate={(result) => {
              if (result.kind === 'action') {
                if (result.keepOpen !== true) setSearchEverywhere(null);
                result.run?.();
                return;
              }
              setSearchEverywhere(null);
              if (result.kind === 'text') {
                openFileAtLocation(result.path, result.line, result.column);
                return;
              }
              void openFile(result.path);
            }}
            onClose={closeSearchEverywhere}
            onDismiss={dismissSearchEverywhere}
            onReplaceChange={(replace) =>
              setSearchEverywhere((current) => (current === null ? current : { ...current, replace }))
            }
            onReplaceAll={() => void replaceInFiles()}
            onRememberQuery={rememberSearchEverywhereQuery}
            onRememberCommand={rememberSearchEverywhereCommand}
            onOpenFindUsagesHistory={openFindUsages}
            onOpenInFindToolWindow={(initial) =>
              openFindTool(
                initial?.query ?? searchEverywhere.query,
                initial?.mode === 'replace' ? 'replace' : 'find',
                initial,
                'query',
                'dock',
              )
            }
            onToggleIncludeNonProject={toggleIncludeNonProject}
            onToggleCaseSensitive={() =>
              setSearchEverywhere((current) =>
                current === null
                  ? current
                  : {
                      ...current,
                      caseSensitive: current.caseSensitive !== true,
                      textMatches: [],
                      textRevision: (current.textRevision ?? 0) + 1,
                      index: 0,
                      error: null,
                    },
              )
            }
            onToggleWholeWords={() =>
              setSearchEverywhere((current) =>
                current === null
                  ? current
                  : {
                      ...current,
                      wholeWords: current.regex !== true && current.wholeWords !== true,
                      textMatches: [],
                      textRevision: (current.textRevision ?? 0) + 1,
                      index: 0,
                      error: null,
                    },
              )
            }
            onToggleRegex={() =>
              setSearchEverywhere((current) =>
                current === null
                  ? current
                  : {
                      ...current,
                      regex: current.regex !== true,
                      wholeWords: false,
                      textMatches: [],
                      textRevision: (current.textRevision ?? 0) + 1,
                      index: 0,
                      error: null,
                    },
              )
            }
            onTogglePreserveCase={() =>
              setSearchEverywhere((current) =>
                current === null ? current : { ...current, preserveCase: current.preserveCase !== true },
              )
            }
            onFileMaskChange={(fileMask) =>
              setSearchEverywhere((current) =>
                current === null
                  ? current
                  : {
                      ...current,
                      fileMask,
                      textMatches: [],
                      textRevision: (current.textRevision ?? 0) + 1,
                      index: 0,
                      error: null,
                    },
              )
            }
            onOpenInRightSplit={(path, location) => {
              const validLocation =
                location !== null &&
                location !== undefined &&
                typeof location.line === 'number' &&
                typeof location.column === 'number'
                  ? { path: location.path, line: location.line, column: location.column }
                  : null;
              void openInRightSplit(path, validLocation);
            }}
            onRevealResult={(path) => void revealPath(path)}
            onNotify={(message) => flashStatus(message)}
          />
        )}
      </FloatingToolPopup>
      {quickOpen === null ? null : (
        <QuickOpen
          t={t}
          mode={paletteMode}
          files={quickOpen.files ?? []}
          changes={new Map((git?.changes ?? []).map((change) => [change.path, change.status]))}
          loading={quickOpen.loading === true}
          error={quickOpen.error ?? null}
          query={quickOpen.query}
          index={quickOpen.index}
          onQuery={(query) => setQuickOpen((current) => (current === null ? current : { ...current, query, index: 0 }))}
          onMove={(direction, count) =>
            setQuickOpen((current) =>
              current === null
                ? current
                : {
                    ...current,
                    index: count === 0 ? 0 : (current.index + direction + count) % count,
                  },
            )
          }
          onOpen={(path) => {
            quickOpenReturnFocusRef.current = null;
            setQuickOpen(null);
            void openFile(path);
          }}
          onClose={closeQuickOpen}
        />
      )}
      {namePrompt === null ? null : (
        <NamePrompt
          t={t}
          state={namePrompt}
          onChange={(value) =>
            setNamePrompt((current) => (current === null ? current : { ...current, value, error: '' }))
          }
          onSubmit={() => void submitNamePrompt()}
          onClose={dismissNamePrompt}
        />
      )}
      {moveTo === null ? null : (
        <MoveToPicker
          t={t}
          state={moveTo}
          onQuery={(query) => setMoveTo((current) => (current === null ? current : { ...current, query, index: 0 }))}
          onMove={(direction, count) =>
            setMoveTo((current) =>
              current === null
                ? current
                : {
                    ...current,
                    index: count === 0 ? 0 : (current.index + direction + count) % count,
                  },
            )
          }
          onPick={(directory) => {
            const sources = moveTo.sources ?? [];
            paletteReturnFocusRef.current = null;
            setMoveTo(null);
            void moveEntry(sources, directory);
          }}
          onClose={closeMoveTo}
        />
      )}
      {revisionPicker === null ? null : (
        <RevisionPicker
          t={t}
          state={revisionPicker}
          onQuery={(query) =>
            setRevisionPicker((current) => (current === null ? current : { ...current, query, index: 0 }))
          }
          onMove={(direction, count) =>
            setRevisionPicker((current) =>
              current === null
                ? current
                : {
                    ...current,
                    index: count === 0 ? 0 : (current.index + direction + count) % count,
                  },
            )
          }
          onPick={(hash) => {
            const path = revisionPicker.path;
            paletteReturnFocusRef.current = null;
            setRevisionPicker(null);
            if (typeof hash === 'string' && hash !== '') setDiffTarget({ path, revision: hash, staged: false });
          }}
          onClose={closeRevisionPicker}
        />
      )}
      <EditorWorkspaceBody>
        <ActivityStripe
          activity={activity}
          panelVisible={panelVisible}
          terminalOpen={terminalOpen}
          harnessCollapsed={harnessCollapsed}
          onSelect={selectActivity}
          onItemPointerDown={rememberActivityToolWindowOrigin}
          onToggleHarness={toggleHarness}
          onCloseEditor={onCloseEditor}
          t={t}
        />
        {panelVisible ? (
          <EditorToolWindowPanel
            activity={activity}
            widthPercent={toolWidths[activity] ?? (activity === 'project' ? 28 : 25)}
            dragging={sideDragging}
            panelRef={toolWindowPanelRef}
            toolPanelFlex={toolPanelFlex}>
            {activity === 'project' ? (
              <ProjectPanel
                t={t}
                root={root}
                home={home}
                entries={entries}
                children={children}
                expanded={expanded}
                rows={rows}
                projectRows={projectRows}
                projectView={projectView}
                onProjectViewChange={applyProjectView}
                filteredView={filteredView}
                supportsExpansion={projectTreeActionsAvailable}
                emptyMessage={
                  projectView === 'openFiles'
                    ? t('editor.noOpenFiles')
                    : projectView === 'changedFiles'
                      ? t('editor.noChangedFiles')
                      : ''
                }
                selectedPath={selectedPath}
                selection={selection}
                hasActiveFile={activePath !== null}
                git={git}
                loading={treeLoading}
                error={treeError}
                createState={createState}
                onToggle={toggleDirectory}
                onOpen={openFile}
                onOpenEditSource={editLocalVersion}
                onOpenPreview={(path) => void openFile(path, { preview: true })}
                onRevealPath={revealInProjectTree}
                onSelect={selectRow}
                onOpenCreateMenu={(event) => {
                  /* PanelToolbar's overflow menu invokes an action without a
                           DOM event. Fall back to the tree's box so keyboard Enter
                           on "New…" still opens the choice menu. */ const rect =
                    event?.currentTarget?.getBoundingClientRect?.() ?? treeRef.current?.getBoundingClientRect();
                  if (rect === undefined || rect === null) return;
                  setMenu(
                    projectCreateMenu({
                      t,
                      position: {
                        x: Math.max(4, rect.left),
                        y: rect.bottom + 4,
                      },
                      onStartCreate: startCreate,
                    }),
                  );
                }}
                optionsOpen={menu?.owner === 'project-options'}
                onOpenOptions={(event) => {
                  /* Same contract as New: Options may itself sit inside the
                           overflow menu, whose run callback has no event. */ const rect =
                    event?.currentTarget?.getBoundingClientRect?.() ?? treeRef.current?.getBoundingClientRect();
                  if (rect === undefined || rect === null) return;
                  setMenu(
                    projectOptionsMenu({
                      t,
                      position: {
                        x: Math.min(window.innerWidth - 212, Math.max(4, rect.right - 204)),
                        y: rect.bottom + 4,
                      },
                      expandAllAvailable: projectExpandAllAvailable,
                      previewTabEnabled,
                      singleClickOpen,
                      openDirectoriesSingleClick,
                      showExcludedFiles,
                      compactDirectories,
                      showHidden,
                      sortMode,
                      manualOrderEmpty: Object.keys(manualOrder).length === 0,
                      foldersFirst,
                      onRefresh: () => runProjectOption(() => void refreshTree()),
                      onGotoFile: () => void openQuickOpen(),
                      onRecentFiles: openRecent,
                      onExpandAll: () => runProjectOption(() => void expandAll()),
                      onTogglePreviewTab: () => runProjectOption(() => togglePreviewTab()),
                      onToggleSingleClickOpen: () => runProjectOption(() => toggleSingleClickOpen()),
                      onToggleOpenDirectoriesSingleClick: () =>
                        runProjectOption(() => toggleOpenDirectoriesSingleClick()),
                      onToggleShowExcludedFiles: () => runProjectOption(() => toggleShowExcludedFiles()),
                      onToggleCompactDirectories: () => runProjectOption(() => toggleCompactDirectories()),
                      onToggleHidden: () =>
                        runProjectOption(() => {
                          setShowHidden((current) => {
                            const next = !current;
                            try {
                              window.localStorage.setItem('dsh-editor.project.showHidden', next ? '1' : '0');
                            } catch {
                              /* a storage-less browser keeps the in-memory choice */
                            }
                            return next;
                          });
                        }),
                      onApplySortMode: (mode) => runProjectOption(() => applySortMode(mode)),
                      onResetManualOrder: () =>
                        runProjectOption(() => {
                          setManualOrder({});
                          writeProjectManualOrder(root, {});
                          flashStatus(t('editor.manualOrderReset'));
                        }),
                      onToggleFoldersFirst: () => runProjectOption(() => toggleFoldersFirst()),
                    }),
                  );
                }}
                onCreateChange={(value) =>
                  setCreateState((current) => (current === null ? current : { ...current, value }))
                }
                onCreateCommit={createEntry}
                onCreateCancel={() => setCreateState(null)}
                onCreateParent={(parent) =>
                  setCreateState((current) =>
                    current === null || typeof parent !== 'string' ? current : { ...current, parent },
                  )
                }
                onCreateTemplate={(template) =>
                  setCreateState((current) =>
                    current === null || typeof template !== 'boolean' ? current : { ...current, template },
                  )
                }
                onReveal={revealActive}
                onExpandSelected={() => void expandSelectedTree()}
                onExpandAll={expandAll}
                canCollapseAll={projectCanCollapseAll(expanded)}
                onCollapseAll={collapseAll}
                onNotify={(message) => flashStatus(message)}
                onRefresh={refreshTree}
                onHide={() => setPanelVisible(false)}
                rowRefs={rowRefs}
                treeRef={treeRef}
                onTreeKeyDown={onTreeKeyDown}
                onContextMenu={(payload) => setMenu(buildTreeMenu(payload))}
                onRootContextMenu={({ x, y }) =>
                  setMenu({
                    owner: 'project-root',
                    ...buildTreeMenu({
                      row: {
                        name: projectName,
                        path: '',
                        kind: 'directory',
                        root: true,
                      },
                      x,
                      y,
                    }),
                  })
                }
                rootContextMenuOpen={menu?.owner === 'project-root'}
                onDrop={(source, target) => void moveEntry(source, target)}
                onUpload={(handles, target) => void uploadDroppedEntries(handles, target)}
                onCancelUpload={() => {
                  uploadDropBusyRef.current.cancelRequested = true;
                  uploadDropBusyRef.current.cancelController?.abort();
                }}
                uploadBusy={uploadBusy}
                uploadProgress={uploadProgress}
                showHidden={showHidden}
                foldersFirst={foldersFirst}
                showExcludedFiles={showExcludedFiles}
                sortMode={sortMode}
                manualOrder={manualOrder}
                onManualReorder={reorderManualProject}
                onCycleSort={() => cycleSort()}
                onToggleHidden={() =>
                  setShowHidden((current) => {
                    const next = !current;
                    try {
                      window.localStorage.setItem('dsh-editor.project.showHidden', next ? '1' : '0');
                    } catch {
                      /* a storage-less browser keeps the in-memory choice */
                    }
                    return next;
                  })
                }
                singleClickOpen={singleClickOpen}
                onToggleSingleClickOpen={() => toggleSingleClickOpen()}
                openDirectoriesSingleClick={openDirectoriesSingleClick}
                onToggleOpenDirectoriesSingleClick={() => toggleOpenDirectoriesSingleClick()}
                compactDirectories={compactDirectories}
                renameState={renameState}
                onRenameChange={(value) =>
                  setRenameState((current) => (current === null ? current : { ...current, value }))
                }
                onRenameCommit={() => void commitRename()}
                onRenameCancel={() => setRenameState(null)}
                deletedPaths={deletedPaths}
                newPaths={newPaths}
              />
            ) : activity === 'commit' ? (
              <CommitPanel
                t={commitEnglish}
                git={git}
                selectedPaths={commitSelection}
                message={commitMessage}
                amend={amend}
                busy={commitBusy}
                error={commitError}
                onRetryStatus={() => void loadGit()}
                notice={commitNotice}
                diffTarget={diffTarget}
                selectedChange={selectedChange}
                selectedGroup={selectedGroup}
                selectedChanges={selectedChanges}
                chosenChangeList={chosenChanges(selectedChange)}
                collapsedGroups={collapsedGroups}
                monacoReady={monacoReady}
                onTogglePath={toggleCommitPath}
                onToggleGroup={toggleCommitGroup}
                onToggleDirectory={toggleCollapsedGroup}
                onSelectChange={(target) => chooseChange(target, target)}
                onSelectGroup={chooseGroup}
                onChangesKeyDown={onChangesKeyDown}
                onChangesKeyUp={onChangesKeyUp}
                changeRowRefs={changeRowRefs}
                onSelectDiff={(target) => {
                  /* Previewing from the panel always shows the diff, even
                             when the user had walked back to a file tab. A second
                             click on the same change toggles the preview off. */ setActivity('commit');
                  setPanelVisible(true);
                  const same =
                    diffTarget !== null &&
                    diffActive &&
                    diffTarget.path === target.path &&
                    diffTarget.staged === target.staged;
                  diffReturnFocusRef.current =
                    changeRowRefs.current.get(`${target.staged === true ? 'staged' : 'unstaged'}:${target.path}`) ??
                    null;
                  setDiffTarget(same ? null : target);
                  setDiffActive(true);
                }}
                onShowDiff={(target) => {
                  /* IDEA's Show Diff is a deliberate action on the selected
                             row; unlike a double click it never closes an existing
                             diff when the same row is pressed again. */ setActivity('commit');
                  setPanelVisible(true);
                  diffReturnFocusRef.current =
                    changeRowRefs.current.get(`${target.staged === true ? 'staged' : 'unstaged'}:${target.path}`) ??
                    null;
                  setDiffTarget(target);
                  setDiffActive(true);
                }}
                onShowCombinedDiff={showCombinedDiff}
                onSelectOpenedChange={() => {
                  const path = activePathRef.current;
                  if (path === null) return;
                  const candidate = (gitRef.current?.changes ?? []).find((change) => change.path === path);
                  if (candidate === undefined) {
                    setCommitNotice(t('editor.openedFileNotChanged'));
                    return;
                  }
                  const staged = candidate.status[0] !== ' ' && candidate.status[0] !== '?';
                  chooseChange({ path, staged }, {});
                  window.setTimeout(
                    () => changeRowRefs.current.get(`${staged ? 'staged' : 'unstaged'}:${path}`)?.focus(),
                    0,
                  );
                }}
                onExpandChanges={() => {
                  setCollapsedGroups(new Set());
                  writeCollapsedGroups(rootRef.current, new Set());
                }}
                onCollapseChanges={() => {
                  const all = new Set<string>();
                  const changesNow = gitRef.current?.changes ?? [];
                  const bands = splitChanges(changesNow);
                  for (const [id, entries] of Object.entries(bands)) {
                    if (entries.length === 0) continue;
                    all.add(`${id}:`);
                    for (const change of entries) {
                      for (
                        let index = change.path.indexOf('/');
                        index >= 0;
                        index = change.path.indexOf('/', index + 1)
                      ) {
                        all.add(`${id}:${change.path.slice(0, index)}`);
                      }
                    }
                  }
                  setCollapsedGroups(all);
                  writeCollapsedGroups(rootRef.current, all);
                }}
                onRollbackSelected={(picked) => {
                  const working = [
                    ...new Set(picked.filter((entry) => entry.staged !== true).map((entry) => entry.path)),
                  ];
                  if (working.length > 0) void rollback(working);
                }}
                onRollbackGroup={(group, paths) => {
                  if (paths.length === 0) return;
                  if (group === 'staged') void rollback(paths, { staged: true });
                  else if (group === 'unversioned') void rollback(paths, { unversioned: true });
                  else void rollback(paths);
                }}
                onStage={(paths) => void restage(paths, false)}
                onStageAllTracked={() => void stageEveryChange(true)}
                onUnstage={(paths) => void restage(paths, true)}
                onGitignore={(paths) => void addToGitignore(paths)}
                onCopyPatch={(targets) => void copySelectedPatch(targets)}
                onCreatePatch={(targets) => void createSelectedPatch(targets)}
                onShelve={(position) => void openShelveMenu(position)}
                onContextMenu={(payload) => {
                  if (payload.directory !== undefined) {
                    setMenu(
                      buildChangeDirMenu({
                        directory: payload.directory,
                        changes: payload.changes ?? [],
                        group: payload.group ?? '',
                        x: payload.x,
                        y: payload.y,
                      }),
                    );
                  } else if (payload.change !== undefined) {
                    setMenu(
                      buildChangeMenu({
                        change: payload.change,
                        staged: payload.staged,
                        selectedChanges: payload.selectedChanges,
                        x: payload.x,
                        y: payload.y,
                      }),
                    );
                  }
                }}
                mode={commitMode}
                scrollRefs={{ changes: commitChangesRef, log: commitLogRef }}
                onRestoreScroll={rememberCommitScroll}
                onMode={(next) => {
                  switchCommitMode(next);
                  if (next === 'log') void loadLog();
                }}
                commits={commits}
                logLoading={logLoading}
                logDetail={logDetail}
                onLoadLog={reloadVisibleLog}
                onSelectCommit={(hash) => void showCommit(hash)}
                onOpenFile={(path) => void openFile(path)}
                onEditSource={editLocalVersion}
                onShowCommitDiff={showCommitDiff}
                historyPath={historyPath}
                onClearHistory={clearFileHistory}
                logAuthor={logAuthor}
                onLogAuthor={changeLogAuthor}
                onLoadMoreLog={() => void loadMoreLog()}
                logExhausted={logExhausted}
                onLogContextMenu={(payload) => {
                  logPromptOriginRef.current =
                    typeof HTMLElement !== 'undefined' && document.activeElement instanceof HTMLElement
                      ? document.activeElement
                      : null;
                  setMenu(buildLogMenu(payload));
                }}
                highlightedCommit={highlightedCommit}
                graph={graph}
                onLoadGraph={() => void loadGraph(graph?.branch ?? '', graph?.at ?? '')}
                onGraphBranch={(branch) => void loadGraph(branch, '')}
                selected={selectedCommit}
                selectedCommits={logSelectedCommits}
                onSelectCommits={setLogSelectedCommits}
                logFailure={logError}
                onFileMenu={(payload) => setMenu(buildCommitFileMenu(payload as unknown as CommitFileMenuPayload))}
                onFindInFiles={openFindInFilesFromShortcut}
                onRetry={reloadVisibleLog}
                onGraphRef={(ref) => {
                  const scope = refScopeOf(ref, graph);
                  if (scope.branch === '' && scope.at === '') return;
                  void loadGraph(scope.branch, scope.at);
                }}
                onMessage={(value) => {
                  setCommitMessage(value);
                  setHistoryIndex(-1);
                  /* Typing is the user taking over: the saved draft is no longer relevant. */ draftBeforeRecall.current =
                    null;
                }}
                history={messageHistory}
                onRecall={(direction) => recallMessage(direction)}
                onPickHistory={(index) => selectHistoryMessage(index)}
                onAmend={toggleAmend}
                onCommit={commit}
                onRefresh={loadGit}
                onHide={() => setPanelVisible(false)}
                projectName={projectName}
                branchMenuOpen={menu?.owner === 'branch-menu'}
                onBranchMenu={(position) => void openBranchMenu(position)}
                onOptionsMenu={(position) => openCommitOptionsMenu(position)}
                viewOptionsOpen={menu?.owner === 'changes-view-options'}
                templates={COMMIT_TEMPLATES}
                onTemplate={applyCommitTemplate}
                identityMissing={identityMissing}
                pushFailure={pushError}
                onPush={() => void pushNow()}
                undoMessage={clearedMessage}
                onUndoMessage={restoreClearedMessage}
                pushing={pushBusy}
                groupBy={groupBy}
                optionsOpen={menu?.owner === 'commit-options'}
                onViewOptionsMenu={(position) => openChangesViewMenu(position)}
                pathQuery={pathQuery}
                onPathQuery={setPathQuery}
                onRevealChange={(target) => revealChangeRow(target)}
              />
            ) : null}
          </EditorToolWindowPanel>
        ) : null}
        {panelVisible ? (
          <EditorToolWindowResizer
            activity={activity}
            widthPercent={toolWidths[activity] ?? (activity === 'project' ? 28 : 25)}
            title={t('editor.resizeToolWindow')}
            onWidthChange={(value) => setToolWidths((current) => ({ ...current, [activity]: value }))}
            onDraggingChange={setSideDragging}
            onCommit={(final) => writeToolWidth(rootRef.current, activity, final)}
          />
        ) : null}
        <EditorWorkspaceMainColumn>
          <EditorWorkspaceSurface>
            <EditorTabStrip
              t={t}
              stripRef={fileTabStripRef}
              openCount={openFiles.length + (diffTab === null ? 0 : 1)}
              openList={allTabs.map((entry) => (typeof entry === 'string' ? 'commit:' : entry.path)).join('|')}
              hiddenCount={fileTabLayout.hidden.length}
              markdownAvailable={markdownAvailable}
              markdownMode={effectiveMarkdownMode}
              onMarkdownMode={setMarkdownMode}
              onOverflow={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                const hidden = fileTabLayout.hidden;
                setMenu({
                  x: Math.max(4, rect.left - 180),
                  y: rect.bottom + 4,
                  title: t('editor.tabsOverflowTitle'),
                  items: hidden.map((entry) =>
                    typeof entry === 'string'
                      ? {
                          id: 'tab:diff',
                          label: diffTabName,
                          run: () => setDiffActive(true),
                        }
                      : {
                          id: `tab:${entry.path}`,
                          label: entry.dirty ? `${entry.path} •` : entry.path,
                          run: () => {
                            setActivePath(entry.path);
                            setDiffActive(false);
                          },
                        },
                  ),
                });
              }}
              children={fileTabLayout.visible.map((entry) => fileTabElement(entry))}
            />
            <EditorGotoLinePopup
              t={t}
              state={gotoState}
              inputRef={gotoInputRef}
              onChange={(value) =>
                setGotoState((current) => (current === null ? null : { ...current, value, error: null }))
              }
              onSubmit={commitGotoLine}
              onClose={closeGotoLine}
            />
            <EditorFindBar
              t={t}
              state={replaceState}
              historyMenu={editorFindHistoryMenu}
              historyValues={
                editorFindHistoryMenu === null
                  ? []
                  : editorFindHistoryMenu.kind === 'query'
                    ? readSearchHistory(rootRef.current)
                    : readReplaceHistory(rootRef.current)
              }
              onFindChange={(value) => updateFind({ find: value })}
              onReplaceChange={(value) =>
                setReplaceState((current) => (current === null ? current : { ...current, replace: value }))
              }
              onOpenHistory={openEditorFindHistory}
              onSelectHistory={(value) => {
                if (editorFindHistoryMenu?.kind === 'query') updateFind({ find: value });
                else setReplaceState((current) => (current === null ? current : { ...current, replace: value }));
                setEditorFindHistoryMenu(null);
                window.setTimeout(() => {
                  const selector =
                    editorFindHistoryMenu?.kind === 'query'
                      ? '[data-dsh-editor-find-input]'
                      : '[data-dsh-editor-find-replace-input]';
                  document.querySelector<HTMLElement>(selector)?.focus?.();
                }, 0);
              }}
              onCloseHistory={() => setEditorFindHistoryMenu(null)}
              onJump={jumpToMatch}
              onToggleOption={toggleFindOption}
              onToggleSelectionScope={toggleFindSelectionScope}
              onReplaceCurrent={replaceCurrent}
              onReplaceAll={replaceAll}
              onClose={closeFind}
            />
            <EditorErrorBanner
              monacoError={monacoError}
              editorError={editorError}
              monacoLabel={t('editor.monacoError')}
            />
            <EditorConflictBars
              t={t}
              externalChange={activePath === null ? null : (externalChanges[activePath] ?? null)}
              conflict={conflict}
              onRecreate={() => void recreateActive()}
              onReload={() => void reloadActiveFromDisk()}
              onKeepLocal={() => {
                if (activePath !== null) dismissExternal(activePath);
              }}
              onOverwrite={() => void saveActive(true)}
              onDismiss={() => setConflict(null)}
            />
            <EditorFileSurface
              visible={fileSurfaceVisible}
              empty={
                activeFile === null &&
                splitFile === null &&
                diffOpen === false &&
                annotateTarget === null &&
                monacoError === null &&
                editorTerminals.length === 0
              }
              emptyLabel={t('editor.noFile')}>
              <EditorMainPane
                focused={leftFocused}
                splitOpen={splitFile !== null}
                splitPercent={editorSplitPercent}
                editorHidden={activeImage || effectiveMarkdownMode === 'preview'}
                containerRef={containerRef}
                preview={
                  activeImage ? (
                    workspaceImagePreviewElement(t, activePath, activeFile, activateImagePane)
                  ) : markdownAvailable ? (
                    <MarkdownPreviewPane
                      key={activePath}
                      t={t}
                      path={activePath}
                      content={activeFile?.content ?? ''}
                      workspaceRoot={root}
                      assetRevisions={markdownAssetRevisions}
                      visible={markdownPreviewVisible}
                      paneRef={markdownPreviewRef}
                      onOpenFile={(path) =>
                        path === '' ? Promise.resolve(false) : openFile(path, { silentError: true })
                      }
                    />
                  ) : null
                }
              />
              {splitFile === null ? null : (
                <EditorSplitDivider
                  percent={editorSplitPercent}
                  dragging={editorSplitDragging}
                  title={t('editor.resizeEditorSplit')}
                  clampPercent={clampEditorSplitPercent}
                  onChange={setEditorSplitPercent}
                  onDraggingChange={setEditorSplitDragging}
                  onCommit={(final) => writeStoredNumber('dsh-editor.editor.splitPercent', final)}
                />
              )}
              {splitFile === null ? null : (
                <EditorSplitPane
                  t={t}
                  focused={splitFocused}
                  tabStripRef={splitTabStripRef}
                  hiddenCount={splitTabLayout.hidden.length}
                  onOverflow={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    setMenu({
                      x: Math.max(4, rect.left - 190),
                      y: rect.bottom + 4,
                      title: t('editor.tabsOverflowTitle'),
                      items: splitTabLayout.hidden.map((path) => {
                        const file = openFiles.find((entry) => entry.path === path) ?? null;
                        return {
                          id: `split-tab:${path}`,
                          label: file?.dirty === true ? `${path} •` : path,
                          run: () => {
                            splitPathRef.current = path;
                            setSplitPath(path);
                            window.setTimeout(() => splitEditorRef.current?.focus?.(), 0);
                          },
                        };
                      }),
                    });
                  }}
                  onCloseSplit={closeRightSplit}
                  tabs={splitTabElements}
                  containerRef={splitContainerRef}
                  editorHidden={splitImage}
                  imagePreview={
                    splitImage && splitPath !== null
                      ? workspaceImagePreviewElement(t, splitPath, splitFile, activateImagePane)
                      : null
                  }
                />
              )}
            </EditorFileSurface>
            <EditorTerminalArea
              active={editorTerminals.length > 0 && diffOpen === false && annotateTarget === null}
              terminal={editorTerminals[editorTerminals.length - 1] ?? null}
              t={t}
              onError={(message) => setEditorError(message)}
              onInput={(id, data) => {
                /* Typing has to reach the PTY the dock would have written to. */ void callTerminal({
                  op: 'write',
                  id,
                  data,
                }).catch(() => {});
              }}
              onReturnToDock={(terminal) => returnEditorTerminalToDock(terminal)}
            />
            <EditorDiffArea
              active={diffOpen}
              t={t}
              target={diffTarget}
              includedInCommit={diffTarget === null ? false : commitSelection.has(diffTarget.path)}
              monacoReady={monacoReady}
              onClose={closeDiff}
              onRestored={() => {
                /* Kept as the success hook for callers that want to react;
                         the status snapshot goes through `onStatus` so adopting it
                         does not rebuild the diff. */
              }}
              onStatus={(value) => {
                if (value === null || typeof value !== 'object') return;
                const candidate = value as Partial<WorkspaceGitStatus>;
                if (
                  typeof candidate.root === 'string' &&
                  typeof candidate.branch === 'string' &&
                  typeof candidate.prefix === 'string' &&
                  Array.isArray(candidate.changes)
                ) {
                  setGit(candidate as WorkspaceGitStatus);
                }
              }}
              onNotice={(message) => flashStatus(message)}
              onNavigate={(entry) => {
                setDiffTarget({
                  path: entry.path,
                  staged: entry.staged === true,
                });
                setDiffActive(true);
              }}
              filePosition={diffFilePosition}
              onPreviousFile={() => navigateDiffFile('previous')}
              onNextFile={() => navigateDiffFile('next')}
              onOpenLocal={(path) => void openFile(path)}
              undoRef={diffUndoRef}
              redoRef={diffRedoRef}
              viewStatesRef={diffViewStatesRef}
              searchInChangesRef={diffSearchInChangesRef}
            />
            <EditorAnnotateArea
              active={annotateTarget !== null}
              t={t}
              target={annotateTarget}
              lines={annotateLines}
              loading={annotateLoading}
              truncated={annotateTruncated}
              onClose={() => setAnnotateTarget(null)}
              onOpenCommit={openCommitFromAnnotate}
              selected={selectedCommit}
            />
            <EditorStatusBar
              t={t}
              visible={statusFile !== null && diffOpen === false && annotateTarget === null}
              file={statusFile}
              caret={caret}
              fileMode={fileMode}
              lineStats={lineStats}
              statusPath={statusPath}
              statusNotice={statusNotice}
              onCopyStatusPath={() => void copyStatusPath()}
              onGotoLine={() => gotoLine()}
              onAnnotate={() => void toggleAnnotate()}
            />
          </EditorWorkspaceSurface>
          <FloatingToolPopup
            open={findTool !== null && findTool.surface !== 'dock'}
            kind='find'
            geometry={findToolPopupGeometry}
            surfaceStyle={styles.findToolPopup}
            backdrop={true}
            onGeometryChange={setFindToolPopupGeometry}
            onGeometryCommit={(geometry) => writeFindPopupGeometry(geometry)}
            children={findToolWindowElement}
          />
          <FindToolDock
            open={findTool?.surface === 'dock' && terminalOpen === false}
            height={findToolDockMinimized ? FIND_TOOL_DOCK_MIN_HEIGHT : findToolDockHeight}
            minHeight={FIND_TOOL_DOCK_MIN_HEIGHT}
            maxHeight={FIND_TOOL_DOCK_MAX_HEIGHT}
            title={t('editor.findToolDockResize')}
            clampHeight={clampFindDockHeight}
            onHeightChange={setFindToolDockHeight}
            onCommit={(final) => writeStoredNumber('dsh-editor.find.height', final)}
            resizable={!findToolDockMinimized}
            children={findToolWindowElement}
          />
          <EditorTerminalDock
            open={terminalOpen}
            height={terminalHeight}
            minHeight={TERMINAL_DOCK_MIN_HEIGHT}
            maxHeight={TERMINAL_DOCK_MAX_HEIGHT}
            dragging={dockDragging}
            title={t('editor.resizeTerminal')}
            clampHeight={clampTerminalHeight}
            onHeightChange={setTerminalHeight}
            onDraggingChange={setDockDragging}
            onCommit={(final) => writeStoredNumber('dsh-editor.terminal.height', final)}
            children={
              <TerminalPanel
                t={t}
                generation={terminalGeneration}
                startDirectory={terminalStartDirectory}
                workspaceRoot={root}
                onOpenFile={(path) => void openFile(path)}
                onStartDirectoryUsed={() => {
                  pendingTerminalPath.current = '';
                  setTerminalStartDirectory('');
                }}
                onRequestNew={() => setTerminalGeneration((value) => value + 1)}
                focusGeneration={terminalFocusGeneration}
                onRequestClose={() => {
                  setTerminalOpen(false);
                  const previous = terminalReturnFocusRef.current;
                  terminalReturnFocusRef.current = null;
                  window.setTimeout(() => {
                    if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
                    else editorRef.current?.focus();
                  }, 0);
                }}
                onEditorTerminals={(list) =>
                  setEditorTerminals(
                    list.flatMap((terminal): EditorTerminalDescriptor[] => {
                      if (typeof terminal.id !== 'string') return [];
                      return [
                        {
                          id: terminal.id,
                          title:
                            typeof terminal.title === 'string' && terminal.title !== '' ? terminal.title : terminal.id,
                          cwd: typeof terminal.cwd === 'string' ? terminal.cwd : '',
                        },
                      ];
                    }),
                  )
                }
                onSwitchFocusToEditor={focusEditorSurface}
              />
            }
          />
        </EditorWorkspaceMainColumn>
      </EditorWorkspaceBody>
    </EditorWorkspaceShell>
  );
}
/** Bounds of the chat column, in percent of the conversation area. */ const CHAT_WIDTH_MIN = 28;
const CHAT_WIDTH_MAX = 44;
/* Gufa keeps the AI pane wide enough to read while the editor stays primary.
       A quarter width made the hero and message bubbles wrap at ordinary laptop
       widths; 35% leaves the editor the majority without turning the chat into a
       decorative strip. The user can still drag it. */ export const CHAT_WIDTH_DEFAULT = 35;
/**
 * Keep a requested chat width inside the usable range.
 *
 * Below 28% the message list is unreadable; past 44% the editor is no longer
 * an editor. A non-number falls back to the default so a corrupt stored value
 * cannot leave a zero-width column.
 * @param {number} value - requested width in percent.
 * @returns {number} clamped width.
 */ export function clampChatPercent(value: number): number {
  if (!Number.isFinite(value)) return CHAT_WIDTH_DEFAULT;
  return Math.min(CHAT_WIDTH_MAX, Math.max(CHAT_WIDTH_MIN, value));
}
/**
 * Resolve the rendered chat width while preserving the saved preference.
 * Harness collapse uses a temporary 0% layout; expanding reads `chatWidth`
 * again, so no drag-selected size is overwritten by minimize/restore.
 * @param {boolean} collapsed - whether the Harness tab is minimizing chat.
 * @param {number} value - persisted chat width percentage.
 * @returns {number} width to apply to the current layout.
 */ export function chatLayoutWidth(collapsed: boolean, value: number): number {
  return collapsed === true ? 0 : clampChatPercent(value);
}
/**
 * The chat width the user last chose (percent), or the default.
 * @returns {number} width in percent.
 */ export function readChatWidth() {
  try {
    const current = window.localStorage.getItem('dsh-editor.chatWidth.v2');
    if (current !== null) return clampChatPercent(Number(current));
    /* The old key held percentages from the 25%-era layout. Preserve a user's
           deliberate width, but migrate the old untouched default once so an
           upgraded workspace actually gains the wider reading column. */ const legacy =
      window.localStorage.getItem('dsh-editor.chatWidth');
    if (legacy === null) return CHAT_WIDTH_DEFAULT;
    const value = Number(legacy);
    const migrated =
      Number.isFinite(value) && Math.abs(value - 25) > 0.01 ? clampChatPercent(value) : CHAT_WIDTH_DEFAULT;
    window.localStorage.setItem('dsh-editor.chatWidth.v2', String(migrated));
    return migrated;
  } catch {
    return CHAT_WIDTH_DEFAULT;
  }
}
/**
 * Persist the chat width so the next Editor open starts where it left off.
 * @param {number} value - width in percent.
 * @returns {void}
 */ export function writeChatWidth(value: number): void {
  try {
    window.localStorage.setItem('dsh-editor.chatWidth.v2', String(Math.round(clampChatPercent(value) * 10) / 10));
  } catch {
    /* a storage-less browser keeps the in-memory width */
  }
} /** Inject the small amount of global CSS the split layout and chrome need. */
export { EditorWorkspace };
