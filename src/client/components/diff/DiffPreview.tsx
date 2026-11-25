import React from 'react';
import type * as Monaco from 'monaco-editor';
import { styles } from '../../ui/styles';
import { EDITOR_CODE_FONT_SIZE, EDITOR_CODE_LINE_HEIGHT, EDITOR_UI_FONT } from '../editor/editor-style-model';
import { ContextMenu } from '../ui/Menu';
import { diffViewStateKey, transferDiffLine } from '../ui/diff-model';
import { DiffViewModeControl } from '../ui/DiffViewModeControl';
import { PathLabel } from '../ui/PathLabel';
import { ToolbarButton } from '../ui/ToolbarButton';
import { toolbarActionActive } from '../ui/toolbar-model';
import {
  combinedFileHiddenRange,
  combinedFileIndexAtLine,
  diffDirectActionCountForWidth,
  diffEditingEnabled,
  diffFileNavModeForWidth,
  diffIncludedSummaryState,
  diffRollbackIncludeLabelVisibleForWidth,
  diffSummaryVisibleForWidth,
  diffViewModeControlForWidth,
  groupDiffToolbarActions,
  isCombinedFileCollapseShortcut,
  isDiffCloseShortcut,
} from '../../diff';
import { callFs, callGit, ensureDiffTheme, nextDiffLoadSerial, safeLanguage } from '../../editor-core';
import { hunkAt, lineChangeRangeMappings, readStoredText, restoreUndoStack, selectedCharChanges } from '../../terminal';
import { startVisibilityGatedPoll } from '../../foundation';
import {
  combinedDiffBodyLines,
  combinedDiffDecorationSpecs,
  createCombinedDiffColorBudget,
  takeCombinedDiffColorBudget,
  type CombinedDiffColorFile,
} from './combined-diff-color-model';
import { conflictMarkerLineNumbers } from './conflict-marker-model';

type Translate = (key: string, params?: Record<string, unknown>) => string;
type DiffCallback = (value: unknown) => void;
type DiffNoticeCallback = (message: string) => void;

interface DiffCombinedFile {
  path: string;
  line?: number;
  endLine?: number;
  originalLine?: number;
  originalEndLine?: number;
  status?: string;
  [key: string]: unknown;
}

interface DiffLoadResponse {
  binary?: boolean;
  missing?: boolean;
  original?: string;
  modified?: string;
  files?: DiffCombinedFile[];
}

interface DiffRestoreEntry {
  path: string;
  side: string;
  text: string;
  after: string;
  [key: string]: unknown;
}

type DiffTextModel = Monaco.editor.ITextModel & {
  __dshRestoreListener?: { dispose: () => void };
  __dshFallbackUndo?: { dispose: () => void };
};

export interface DiffTextPosition {
  path?: string;
  line?: number;
  column?: number;
  index?: number;
  total?: number;
}

export interface DiffTarget {
  path?: string;
  staged?: boolean;
  navigationEntries?: Array<{ path?: string; staged?: boolean }>;
  combined?: boolean;
  entries?: Array<{ path?: string; staged?: boolean; status?: string }>;
  commit?: string;
  commitWithLocal?: string;
  revision?: string;
  revisionPair?: { left?: string; right?: string } | null;
  clipboardText?: string;
  label?: string;
  shift?: boolean;
  toggle?: boolean;
  row?: HTMLElement;
  repositoryVersion?: {
    hash?: string;
    path?: string;
    localExists?: boolean;
    localDirExists?: boolean;
    content?: string;
    binary?: boolean;
  } | null;
  [key: string]: unknown;
}

export interface DiffPreviewProps {
  t: Translate;
  target: DiffTarget;
  monacoReady: boolean;
  includedInCommit?: boolean;
  rollbackInclusion?: { included: boolean; onToggle: (included: boolean) => void };
  focusMode?: boolean;
  onToggleFocus?: () => void;
  onClose: () => void;
  onRestored?: DiffCallback;
  onStatus?: DiffCallback;
  onNotice?: DiffNoticeCallback;
  onNavigate?: (target: DiffTarget) => void;
  undoRef?: React.MutableRefObject<unknown[]>;
  redoRef?: React.MutableRefObject<unknown[]>;
  viewStatesRef?: React.MutableRefObject<Map<string, Record<string, unknown>>>;
  searchInChangesRef?: React.MutableRefObject<(() => void) | null> | null;
  filePosition?: DiffTextPosition | null;
  onPreviousFile?: () => void;
  onNextFile?: () => void;
  onOpenLocal?: (path: string) => void;
}

function DiffPreview({
  t,
  target,
  monacoReady,
  includedInCommit = false,
  rollbackInclusion,
  focusMode = false,
  onToggleFocus,
  onClose,
  onRestored,
  onStatus,
  onNotice,
  onNavigate,
  undoRef,
  redoRef,
  viewStatesRef,
  searchInChangesRef = null,
  filePosition = null,
  onPreviousFile,
  onNextFile,
  onOpenLocal,
}: DiffPreviewProps) {
  const hostRef = React.useRef(null);
  const diffRef = React.useRef(null);
  const diffModelsRef = React.useRef(null);
  const lastFocusedDiffSideRef = React.useRef('modified');
  const fallbackViewStatesRef = React.useRef(new Map());
  const viewStatesMapRef = viewStatesRef ?? fallbackViewStatesRef;
  const diffViewKeyRef = React.useRef('');
  const diffTargetRef = React.useRef(target);
  diffTargetRef.current = target;
  /* The last loaded sides and the text currently being persisted. Declared
     before render-time availability checks: reading a later hook here is a
     temporal-dead-zone error, which unmounts the whole editor workspace. */
  const diffLoadedRef = React.useRef(null);
  /* IDEA moves the keyboard into the comparison when Show Diff opens it.
     The widget is reused across targets, so the request belongs to each
     successful model swap rather than to the one-time mount. */
  const focusDiffRef = React.useRef(null);
  const [state, setState] = React.useState({
    binary: false,
    error: null,
    missing: false,
  });
  /* EditSource only makes sense while the working copy still exists. */
  const [localPathAvailable, setLocalPathAvailable] = React.useState(null);
  const [sideBySide, setSideBySide] = React.useState(() => readStoredText('dsh-editor.diff.sideBySide', '1') !== '0');
  const [swapSides, setSwapSides] = React.useState(false);
  const swapSidesRef = React.useRef(false);
  /* IDEA starts with unchanged regions folded, then lets the user reveal
     them. Monaco's native diff view-zone implementation is preferable to a
     second fold engine: it keeps both editors' scroll geometry aligned. */
  const [collapseUnchanged, setCollapseUnchanged] = React.useState(
    () => readStoredText('dsh-editor.diff.collapseUnchanged', '1') !== '0',
  );
  const [ignoreWhitespace, setIgnoreWhitespace] = React.useState(
    () => readStoredText('dsh-editor.diff.ignoreWhitespace', '0') === '1',
  );
  const [showWhitespaces, setShowWhitespaces] = React.useState(
    () => readStoredText('dsh-editor.diff.showWhitespaces', '0') === '1',
  );
  const [showLineNumbers, setShowLineNumbers] = React.useState(
    () => readStoredText('dsh-editor.diff.showLineNumbers', '1') !== '0',
  );
  const [softWrap, setSoftWrap] = React.useState(() => readStoredText('dsh-editor.diff.softWrap', '0') === '1');
  const [showIndentGuides, setShowIndentGuides] = React.useState(
    () => readStoredText('dsh-editor.diff.showIndentGuides', '0') === '1',
  );
  const [editLocked, setEditLocked] = React.useState(false);
  const editLockedRef = React.useRef(false);
  editLockedRef.current = editLocked;
  /* IDEA's diff toolbar walks hunks and shows which one you are on. */
  const [hunks, setHunks] = React.useState({
    index: 0,
    total: 0,
  });
  const [combinedFiles, setCombinedFiles] = React.useState<DiffCombinedFile[]>([]);
  const [combinedPosition, setCombinedPosition] = React.useState({
    index: 0,
    total: 0,
  });
  const [collapsedCombinedFiles, setCollapsedCombinedFiles] = React.useState<Set<number>>(() => new Set());
  const combinedFilesRef = React.useRef<DiffCombinedFile[]>([]);
  const combinedColorCollectionsRef = React.useRef<Monaco.editor.IEditorDecorationsCollection[]>([]);
  const conflictMarkerCollectionsRef = React.useRef<Monaco.editor.IEditorDecorationsCollection[]>([]);
  const clearCombinedColorDecorations = React.useCallback(() => {
    for (const collection of combinedColorCollectionsRef.current) collection.clear();
    combinedColorCollectionsRef.current = [];
  }, []);
  const clearConflictMarkerDecorations = React.useCallback(() => {
    for (const collection of conflictMarkerCollectionsRef.current) collection.clear();
    conflictMarkerCollectionsRef.current = [];
  }, []);
  const [reloadGeneration, setReloadGeneration] = React.useState(0);
  /* When the modified side has a real selection Monaco also offers a native
     "Revert Selection" gutter button. Mirror that state in the toolbar so a
     narrow diff does not require hitting the glyph margin. */
  const [selectionRange, setSelectionRange] = React.useState(null);
  const diffReadOnly =
    typeof target?.commit === 'string' ||
    typeof target?.revision === 'string' ||
    typeof target?.clipboardText === 'string' ||
    target?.combined === true;
  const diffUnavailable = target === null || state.binary || state.missing || diffLoadedRef.current === null;
  /* The keyboard handler below lists actionableSelection as a dependency;
     it therefore has to be initialised before that effect runs. */
  const actionableSelection =
    selectionRange !== null &&
    !diffReadOnly &&
    !swapSides &&
    !editLocked &&
    !diffUnavailable &&
    selectedCharChanges(diffRef.current?.getLineChanges?.() ?? [], selectionRange).length > 0;
  const searchInChanges = React.useCallback(() => {
    const editor = diffRef.current?.getModifiedEditor?.();
    if (editor === null || editor === undefined) return;
    editor.focus();
    editor.trigger('dsh-editor', 'actions.find', null);
  }, []);
  React.useEffect(() => {
    if (searchInChangesRef === null) return undefined;
    searchInChangesRef.current = searchInChanges;
    return () => {
      if (searchInChangesRef.current === searchInChanges) searchInChangesRef.current = null;
    };
  }, [searchInChanges, searchInChangesRef]);
  /* IDEA's Diff.FocusOppositePane moves the keyboard between the compared
     sides without changing either model or caret. */
  const focusOppositeDiffPane = React.useCallback(() => {
    const original = diffRef.current?.getOriginalEditor?.();
    const modified = diffRef.current?.getModifiedEditor?.();
    if (original === null || original === undefined || modified === null || modified === undefined) return;
    const active = document.activeElement;
    const originalNode = original.getDomNode?.();
    const modifiedNode = modified.getDomNode?.();
    const activeIsOriginal = originalNode?.contains?.(active) === true;
    const activeIsModified = modifiedNode?.contains?.(active) === true;
    const sourceIsOriginal = activeIsOriginal || (!activeIsModified && lastFocusedDiffSideRef.current === 'original');
    if (sourceIsOriginal) modified.focus();
    else original.focus();
  }, []);
  /**
   * IDEA's Select Position in Opposite Diff Pane.
   *
   * Unlike Focus Opposite Pane, this action moves the caret to the
   * corresponding line on the other side and scrolls it into view. The
   * mapping uses Monaco's live line changes, so inserted/deleted blocks do
   * not leave the destination caret on an unrelated row.
   * @returns {void}
   */
  const selectPositionInOppositeDiffPane = React.useCallback(() => {
    const diff = diffRef.current;
    const original = diff?.getOriginalEditor?.();
    const modified = diff?.getModifiedEditor?.();
    if (
      diff === null ||
      diff === undefined ||
      original === null ||
      original === undefined ||
      modified === null ||
      modified === undefined
    )
      return;
    const active = document.activeElement;
    const activeIsOriginal = original.getDomNode?.()?.contains?.(active) === true;
    const activeIsModified = modified.getDomNode?.()?.contains?.(active) === true;
    const sourceIsOriginal = activeIsOriginal || (!activeIsModified && lastFocusedDiffSideRef.current === 'original');
    const source = sourceIsOriginal ? original : modified;
    const target = sourceIsOriginal ? modified : original;
    const position = source.getPosition?.();
    if (position === null || position === undefined) return;
    const targetLine = transferDiffLine(
      position.lineNumber,
      sourceIsOriginal ? 'original' : 'modified',
      diff.getLineChanges?.() ?? [],
    );
    const targetModel = target.getModel?.();
    const line = Math.max(1, Math.min(targetModel?.getLineCount?.() ?? targetLine, targetLine));
    const maxColumn = targetModel?.getLineMaxColumn?.(line) ?? position.column;
    const next = {
      lineNumber: line,
      column: Math.max(1, Math.min(position.column, maxColumn)),
    };
    target.setPosition?.(next);
    target.revealPositionInCenterIfOutsideViewport?.(next);
    target.focus?.();
  }, []);
  /* Terminal "Switch Focus To Editor" asks the visible diff to own focus. */
  React.useEffect(() => {
    const host = hostRef.current?.closest?.('[data-dsh-editor-workspace]') ?? null;
    if (host === null) return undefined;
    const onFocus = () => focusDiffRef.current?.();
    host.addEventListener('dsh-editor-focus-diff', onFocus);
    return () => host.removeEventListener('dsh-editor-focus-diff', onFocus);
  }, []);
  React.useEffect(() => {
    if (typeof target?.path !== 'string' || target.path === '') {
      setLocalPathAvailable(null);
      return undefined;
    }
    let cancelled = false;
    setLocalPathAvailable(null);
    callFs({
      op: 'exists',
      paths: [target.path],
    })
      .then((value) => {
        if (cancelled) return;
        const entry = Array.isArray(value)
          ? value.find((candidate) => candidate?.requested === target.path || candidate?.path === target.path)
          : null;
        setLocalPathAvailable(entry?.exists === true);
      })
      .catch(() => {
        if (!cancelled) setLocalPathAvailable(null);
      });
    return () => {
      cancelled = true;
    };
  }, [target?.path]);
  /* The working copy can appear or disappear while its diff is still open.
     Revalidate in both directions: missing files are retried quickly, while
     existing files use a slower guard so EditSource cannot go stale. */
  React.useEffect(() => {
    if (typeof target?.path !== 'string' || target.path === '') return undefined;
    let cancelled = false;
    const checkLocalPath = () =>
      callFs({
        op: 'exists',
        paths: [target.path],
      })
        .then((value) => {
          if (cancelled) return;
          const entry = Array.isArray(value)
            ? value.find((candidate) => candidate?.requested === target.path || candidate?.path === target.path)
            : null;
          setLocalPathAvailable(entry?.exists === true);
        })
        .catch(() => {});
    const delay = localPathAvailable === false ? 1500 : 3000;
    void checkLocalPath();
    const stopPolling = startVisibilityGatedPoll(checkLocalPath, delay);
    window.addEventListener('focus', checkLocalPath);
    return () => {
      cancelled = true;
      stopPolling();
      window.removeEventListener('focus', checkLocalPath);
    };
  }, [localPathAvailable, target?.path]);
  const diffToolbarRef = React.useRef(null);
  const [diffDirectActionCount, setDiffDirectActionCount] = React.useState(null);
  const [diffToolbarWidth, setDiffToolbarWidth] = React.useState(Number.POSITIVE_INFINITY);
  const diffIsLocalCommitChange =
    target !== null &&
    typeof target.path === 'string' &&
    target.path !== '' &&
    typeof target?.commit !== 'string' &&
    typeof target?.revision !== 'string' &&
    typeof target?.clipboardText !== 'string' &&
    target.combined !== true;
  const includedState = diffIsLocalCommitChange ? diffIncludedSummaryState(hunks.total, includedInCommit) : null;
  const showIncludedSummary = includedState !== null && diffSummaryVisibleForWidth(diffToolbarWidth);
  const [diffActionMenu, setDiffActionMenu] = React.useState(null);
  const [hunkMenu, setHunkMenu] = React.useState(null);
  const openDiffActionSubmenu = React.useCallback(
    (
      event: React.SyntheticEvent<HTMLElement> | null | undefined,
      title: string,
      items: unknown[],
      actionId: string | null = null,
    ): void => {
      const rect = event?.currentTarget?.getBoundingClientRect?.() ?? diffToolbarRef.current?.getBoundingClientRect?.();
      if (rect === undefined || rect === null) return;
      setDiffActionMenu({
        x: Math.min(window.innerWidth - 212, Math.max(4, rect.right - 210)),
        y: rect.bottom + 4,
        title,
        actionId,
        items,
      });
    },
    [],
  );
  React.useEffect(() => {
    setHunkMenu(null);
  }, [target, hunks.total]);
  React.useEffect(() => {
    combinedFilesRef.current = [];
    setCombinedFiles([]);
    setCombinedPosition({
      index: 0,
      total: 0,
    });
    setCollapsedCombinedFiles(new Set());
    diffRef.current?.getModifiedEditor?.().setHiddenAreas?.([]);
    diffRef.current?.getOriginalEditor?.().setHiddenAreas?.([]);
  }, [target, reloadGeneration]);
  /* IDEA's diff has a header per pane, not one ambiguous "workspace
     change" label: the left is the compared revision and the right names
     what is on screen. Both are derived from the target, so a staged and
     an unstaged file cannot be mislabelled by the other one. */
  const sideLabels =
    target?.combined === true
      ? target?.revisionPair !== null && typeof target?.revisionPair === 'object'
        ? {
            left: String(target.revisionPair.left ?? '').slice(0, 7),
            right: String(target.revisionPair.right ?? '').slice(0, 7),
          }
        : typeof target?.commitWithLocal === 'string'
          ? {
              left: target.commitWithLocal.slice(0, 7),
              right: t('editor.currentVersion'),
            }
          : {
              left: t('editor.indexVersion'),
              right: t('editor.currentVersion'),
            }
      : typeof target?.commit === 'string'
        ? {
            left: target.commit.slice(0, 7),
            right: t('editor.commitVersion'),
          }
        : typeof target?.revision === 'string'
          ? {
              left: target.revision.slice(0, 7),
              right: t('editor.currentVersion'),
            }
          : typeof target?.clipboardText === 'string'
            ? {
                left: t('editor.clipboardVersion'),
                right: t('editor.currentVersion'),
              }
            : target?.staged === true
              ? {
                  left: 'HEAD',
                  right: t('editor.indexVersion'),
                }
              : {
                  left: 'HEAD',
                  right: t('editor.currentVersion'),
                };
  const displayedSideLabels = swapSides
    ? {
        left: sideLabels.right,
        right: sideLabels.left,
      }
    : sideLabels;
  /* One promise chain per diff. Monaco can emit several model edits for a
     single block restore (and the user's ⌘Z is another edit); dropping an
     edit while an earlier write is in flight leaves the model and the file
     disagreeing. Each update therefore quotes the PREVIOUS expected text
     and waits for the preceding write. */
  const writeChainRef = React.useRef(Promise.resolve());
  /* A block restore clears Monaco's own undo stack on this model. IDEA still
     lets ⌘Z take the block back, so keep the inverse explicitly: newest
     restore first, scoped to this diff view. */
  /* Supplied by the workspace: IDEA's undo/redo crosses diff tabs. */
  const restoreUndoRef = undoRef ?? React.useRef([]);
  const restoreRedoRef = redoRef ?? React.useRef([]);
  /* The refs are the source of truth for cross-tab history, but mutating them
     does not re-render the toolbar. Mirror their depth into state so IDEA's
     Undo/Redo actions are disabled exactly when there is nothing to restore. */
  const [historyDepth, setHistoryDepth] = React.useState(() => ({
    undo: restoreUndoRef.current.length,
    redo: restoreRedoRef.current.length,
  }));
  const syncHistoryDepth = React.useCallback(() => {
    setHistoryDepth({
      undo: restoreUndoRef.current.length,
      redo: restoreRedoRef.current.length,
    });
  }, [restoreRedoRef, restoreUndoRef]);
  const canUndo = historyDepth.undo > 0;
  const canRedo = historyDepth.redo > 0;
  React.useEffect(() => {
    syncHistoryDepth();
  }, [syncHistoryDepth, target?.path, target?.staged]);
  /* Parent callbacks are inline functions; keeping them in refs stops a
     status-triggered parent render from re-running the model effect and
     wiping the undo history. */
  const onRestoredRef = React.useRef(onRestored);
  const onStatusRef = React.useRef(onStatus);
  const onNoticeRef = React.useRef(onNotice);
  const onNavigateRef = React.useRef(onNavigate);
  /* The editor status bar is hidden while a diff owns the code area, so the
     undo acknowledgement belongs to the diff's own hint row. */
  const [undoNotice, setUndoNotice] = React.useState(null);
  const loadingRef = React.useRef(false);
  /* A restore is a programmatic model edit: it must trigger one write, not
     one per keystroke the user makes in this read-only surface. */
  const restorePendingRef = React.useRef(false);
  /* One model restoration emits several content events (replace + undo
     bookkeeping). Attribute them to ONE restore record. */
  const activeRestoreRef = React.useRef(null);
  /* Declared before the model effect uses it: the sync runs from async
     callbacks, and a `const` declared later would still be in its TDZ then. */
  const syncHunksRef = React.useRef(null);
  /* IDEA opens a diff AT the first difference: its gutter reads `1/7`, not
     `0/7`, and the user can immediately see what changed. Monaco's
     `revealFirstDiff()` scrolls, but this version does not guarantee that
     the modified caret moved. Put it on the first modified range once the
     comparison settles. */
  const focusFirstHunkRef = React.useRef(null);
  /* View states are stored in the workspace, so closing the diff and
     reopening the same comparison still lands where the user left it. */
  const captureDiffViewState = React.useCallback(
    (key = diffViewKeyRef.current) => {
      const diff = diffRef.current;
      if (diff === null || typeof key !== 'string' || key === '') return null;
      const originalEditor = diff.getOriginalEditor?.() ?? null;
      const modifiedEditor = diff.getModifiedEditor?.() ?? null;
      const original = originalEditor?.saveViewState?.() ?? null;
      const modified = modifiedEditor?.saveViewState?.() ?? null;
      if (original === null && modified === null) return null;
      const state = {
        original,
        modified,
        originalPosition: originalEditor?.getPosition?.() ?? null,
        modifiedPosition: modifiedEditor?.getPosition?.() ?? null,
        originalScrollTop: originalEditor?.getScrollTop?.() ?? null,
        modifiedScrollTop: modifiedEditor?.getScrollTop?.() ?? null,
      };
      viewStatesMapRef.current.set(key, state);
      return state;
    },
    [viewStatesMapRef],
  );
  const restoreDiffViewState = React.useCallback(
    (key: unknown, fallback: Record<string, unknown> | null = null): boolean => {
      const state = (typeof key === 'string' && key !== '' ? viewStatesMapRef.current.get(key) : null) ?? fallback;
      const diff = diffRef.current;
      if (diff === null || state === null) return false;
      const original = diff.getOriginalEditor?.() ?? null;
      const modified = diff.getModifiedEditor?.() ?? null;
      let restored = false;
      if (original !== null && state.original !== null && state.original !== undefined) {
        original?.restoreViewState?.(state.original);
        restored = true;
      }
      if (modified !== null && state.modified !== null && state.modified !== undefined) {
        modified?.restoreViewState?.(state.modified);
        restored = true;
      }
      const clampPosition = (
        editor: Monaco.editor.IStandaloneCodeEditor | null,
        position: { lineNumber?: number; column?: number } | null | undefined,
      ): { lineNumber: number; column: number } | null => {
        if (position === null || position === undefined) return null;
        const lines = editor?.getModel?.()?.getLineCount?.() ?? position.lineNumber;
        return {
          lineNumber: Math.max(1, Math.min(Number(position.lineNumber) || 1, lines)),
          column: Math.max(1, Number(position.column) || 1),
        };
      };
      const originalPosition = clampPosition(original, state.originalPosition);
      if (originalPosition !== null) {
        original?.setPosition?.(originalPosition);
        restored = true;
      }
      const modifiedPosition = clampPosition(modified, state.modifiedPosition);
      if (modifiedPosition !== null) {
        modified?.setPosition?.(modifiedPosition);
        restored = true;
      }
      if (Number.isFinite(state.originalScrollTop)) original?.setScrollTop?.(state.originalScrollTop);
      if (Number.isFinite(state.modifiedScrollTop)) modified?.setScrollTop?.(state.modifiedScrollTop);
      return restored;
    },
    [viewStatesMapRef],
  );

  /**
   * Give Monaco's native restore gutter the same discoverable semantics as
   * the rest of the diff surface. Monaco only supplies an English title on
   * an unfocusable div; keyboard users otherwise cannot reach the action.
   * @returns {void}
   */
  const localizeRevertButtons = React.useCallback(() => {
    const node = hostRef.current;
    if (node === null) return;
    for (const button of node.querySelectorAll('.revertButton')) {
      if (!(button instanceof HTMLElement)) continue;
      if (button.getAttribute('data-dsh-monaco-revert-title') === null) {
        button.setAttribute('data-dsh-monaco-revert-title', button.title);
      }
      const monacoTitle = button.getAttribute('data-dsh-monaco-revert-title') ?? '';
      const label = monacoTitle.toLowerCase().includes('selected')
        ? t('editor.diffSelectionRestore')
        : t('editor.diffRestoreChange');
      button.title = label;
      button.setAttribute('role', 'button');
      button.setAttribute('aria-label', label);
      button.tabIndex = 0;
    }
  }, [t]);
  React.useEffect(() => {
    const node = hostRef.current;
    if (node === null) return undefined;
    const observer = new MutationObserver(() => localizeRevertButtons());
    observer.observe(node, {
      childList: true,
      subtree: true,
    });
    localizeRevertButtons();
    return () => observer.disconnect();
  }, [localizeRevertButtons]);
  React.useEffect(() => {
    onRestoredRef.current = onRestored;
    onStatusRef.current = onStatus;
    onNoticeRef.current = onNotice;
    onNavigateRef.current = onNavigate;
  }, [onNavigate, onNotice, onRestored, onStatus]);
  const persistRestored = React.useCallback(() => {
    const loaded = diffLoadedRef.current;
    const diff = diffRef.current;
    if (loaded === null || loaded.side === null || diff === null) return;
    const modified = diff.getModifiedEditor()?.getModel();
    if (modified === null || modified === undefined) return;
    setState((current) => ({
      ...current,
      error: null,
    }));
    restorePendingRef.current = false;
    const content = modified.getValue();
    const before = loaded.modified;
    const restoreRecord = {
      path: loaded.path,
      side: loaded.side,
      staged: target?.staged === true,
      original: loaded.original,
      text: before,
      after: content,
    };
    activeRestoreRef.current = restoreRecord;
    writeChainRef.current = writeChainRef.current
      .then(() => {
        const current = diffLoadedRef.current;
        if (current === null || current.side === null) return null;
        return callGit({
          op: 'applyChunk',
          path: current.path,
          side: current.side,
          expected: current.modified,
          content,
        }).then((value) => {
          diffLoadedRef.current = {
            ...current,
            modified: content,
          };
          return value;
        });
      })
      .then((value) => {
        if (value === null) {
          activeRestoreRef.current = null;
          return;
        }
        if (before !== content) {
          restoreUndoRef.current.push(restoreRecord);
          restoreRedoRef.current = [];
          syncHistoryDepth();
        }
        onRestoredRef.current?.(value);
        onStatusRef.current?.(value);
        activeRestoreRef.current = null;
        /* Monaco has already consumed the model's undo entry for this
         restore, so keep an explicit inverse here. IDEA's diff undoes a
         block restore with ⌘Z; the file has to follow, not just the
         screen. */
        /* The onDidUpdateDiff subscription will settle the counter after
         Monaco finishes recomputing; an immediate read can still expose
         the pre-restore hunk list. */
        window.setTimeout(() => syncHunksRef.current?.(), 0);
      })
      .catch((failure) => {
        const message = failure instanceof Error ? failure.message : String(failure);
        setState((current) => ({
          ...current,
          error: /changed since the diff was loaded/u.test(message)
            ? t('editor.diffRestoreConflict')
            : t('editor.diffRestoreFailed', {
                message,
              }),
        }));
        /* Put the model back when the host refused the write, so the screen
         never claims a change that is not on disk. */
        const current = diff.getModel();
        if (current !== null) {
          loadingRef.current = true;
          try {
            current.modified.setValue(diffLoadedRef.current?.modified ?? loaded.modified);
          } finally {
            loadingRef.current = false;
          }
        }
      });
  }, []);
  const applyHistoryEntry = React.useCallback(
    (entry: DiffRestoreEntry, redo: boolean): void => {
      setState((current) => ({
        ...current,
        error: null,
      }));
      restorePendingRef.current = false;
      const content = redo ? entry.after : entry.text;
      activeRestoreRef.current = entry;
      writeChainRef.current = writeChainRef.current
        .then(() =>
          callGit({
            op: 'applyChunk',
            path: entry.path,
            side: entry.side,
            expected: redo ? entry.text : entry.after,
            content,
          }),
        )
        .then((value) => {
          onStatusRef.current?.(value);
          if (redo) {
            restoreUndoRef.current.push(entry);
            setUndoNotice(t('editor.diffRedoDone'));
          } else {
            restoreRedoRef.current.push(entry);
            setUndoNotice(t('editor.diffUndoDone'));
          }
          syncHistoryDepth();
          /* The record belongs to a file, not to whichever diff happens to be
         mounted. Make the visible diff match the file that was just
         restored, the way IDEA's global undo does. */
          const active = diffLoadedRef.current;
          if (active === null || active.path !== entry.path || active.side !== entry.side) {
            diffLoadedRef.current = {
              path: entry.path,
              side: entry.side,
              staged: entry.staged === true,
              original: entry.original ?? '',
              modified: redo ? entry.after : entry.text,
            };
            onNavigateRef.current?.(entry);
          }
          activeRestoreRef.current = null;
          window.setTimeout(() => syncHunksRef.current?.(), 0);
        })
        .catch((failure) => {
          if (redo) restoreRedoRef.current.push(entry);
          else restoreUndoRef.current.push(entry);
          syncHistoryDepth();
          setUndoNotice(null);
          const message = failure instanceof Error ? failure.message : String(failure);
          setState((current) => ({
            ...current,
            error: /changed since the diff was loaded/u.test(message)
              ? t('editor.diffRestoreConflict')
              : t('editor.diffRestoreFailed', {
                  message,
                }),
          }));
        });
    },
    [syncHistoryDepth, t],
  );
  const undoRestore = React.useCallback(() => {
    restoreUndoRef.current = restoreUndoStack(activeRestoreRef.current, restoreUndoRef.current);
    const entry = restoreUndoRef.current.pop();
    syncHistoryDepth();
    if (entry === undefined) {
      setState((current) => ({
        ...current,
        error: t('editor.diffUndoEmpty'),
      }));
      return;
    }
    const loaded = diffLoadedRef.current;
    const modified = diffRef.current?.getModifiedEditor()?.getModel();
    if (loaded !== null && loaded.path === entry.path && modified !== undefined && modified !== null) {
      loadingRef.current = true;
      try {
        modified.setValue(entry.text);
      } finally {
        loadingRef.current = false;
      }
      loadingRef.current = true;
      try {
        applyHistoryEntry(entry, false);
      } finally {
        loadingRef.current = false;
      }
      return;
    }
    applyHistoryEntry(entry, false);
  }, [applyHistoryEntry, syncHistoryDepth, t]);
  const restoreSelection = React.useCallback(() => {
    const diff = diffRef.current;
    if (diff === null || diffLoadedRef.current?.side === null) return;
    const ranges = selectedCharChanges(diff.getLineChanges(), selectionRange);
    if (ranges.length === 0) {
      setState((current) => ({
        ...current,
        error: t('editor.diffSelectionEmpty'),
      }));
      return;
    }
    setState((current) => ({
      ...current,
      error: null,
    }));
    diff.revertRangeMappings(ranges);
  }, [selectionRange, t]);

  /**
   * Apply the focused-side change to the editable side.
   *
   * With a changed selection this behaves like IDEA's selected-changes
   * action; without one it applies the change under the current hunk
   * counter. Writable diffs only, so read-only history and Swap Sides do
   * not expose a misleading action.
   * @returns {void}
   */
  const applyLeftSide = React.useCallback(() => {
    const diff = diffRef.current;
    if (diff === null || diffLoadedRef.current?.side === null) return;
    if (diffReadOnly || swapSides || editLocked || diffUnavailable) return;
    const changes = diff.getLineChanges?.() ?? [];
    const ranges = actionableSelection
      ? selectedCharChanges(changes, selectionRange)
      : lineChangeRangeMappings(changes[Math.max(0, hunks.index - 1)]);
    if (ranges.length === 0) return;
    setState((current) => ({
      ...current,
      error: null,
    }));
    diff.revertRangeMappings(ranges);
  }, [actionableSelection, diffReadOnly, diffUnavailable, editLocked, hunks.index, selectionRange, swapSides]);
  const redoRestore = React.useCallback(() => {
    const entry = restoreRedoRef.current.pop();
    syncHistoryDepth();
    if (entry === undefined) {
      setState((current) => ({
        ...current,
        error: t('editor.diffRedoEmpty'),
      }));
      return;
    }
    const loaded = diffLoadedRef.current;
    const modified = diffRef.current?.getModifiedEditor()?.getModel();
    if (loaded !== null && loaded.path === entry.path && modified !== undefined && modified !== null) {
      loadingRef.current = true;
      try {
        modified.setValue(entry.after);
      } finally {
        loadingRef.current = false;
      }
      loadingRef.current = true;
      try {
        applyHistoryEntry(entry, true);
      } finally {
        loadingRef.current = false;
      }
      return;
    }
    applyHistoryEntry(entry, true);
  }, [applyHistoryEntry, syncHistoryDepth, t]);
  React.useEffect(() => {
    const node = hostRef.current;
    const monaco = window.monaco;
    if (!monacoReady || node === null || monaco?.editor === undefined) return;
    const diff = monaco.editor.createDiffEditor(node, {
      theme: ensureDiffTheme(monaco),
      automaticLayout: true,
      /* IDEA opens a change side by side by default. The right pane has to
         be writable for Monaco's native hunk-restore arrows to appear. */
      readOnly: false,
      renderSideBySide: readStoredText('dsh-editor.diff.sideBySide', '1') !== '0',
      useInlineViewWhenSpaceIsLimited: false,
      renderSideBySideInlineBreakpoint: 0,
      renderMarginRevertIcon: true,
      renderGutterMenu: false,
      hideUnchangedRegions: {
        enabled: readStoredText('dsh-editor.diff.collapseUnchanged', '1') !== '0',
        minimumLineCount: 4,
        contextLineCount: 2,
        revealLineCount: 10,
      },
      ignoreTrimWhitespace: readStoredText('dsh-editor.diff.ignoreWhitespace', '0') === '1',
      renderWhitespace: readStoredText('dsh-editor.diff.showWhitespaces', '0') === '1' ? 'all' : 'none',
      lineNumbers: readStoredText('dsh-editor.diff.showLineNumbers', '1') !== '0' ? 'on' : 'off',
      wordWrap: readStoredText('dsh-editor.diff.softWrap', '0') === '1' ? 'on' : 'off',
      guides: {
        indentation: readStoredText('dsh-editor.diff.showIndentGuides', '0') === '1',
      },
      /* The diff pane is a split inside a tool window, so its inner editor
         can be narrower than the media queries that hide Monaco's glyph
         margin. IDEA keeps the per-block restore affordance visible anyway. */
      glyphMargin: true,
      /* A quarter-width tool window leaves each diff side around 200px. The
         default 36px number column plus 10px decoration gutter spent almost
         a quarter of that on chrome; three digits are enough for ordinary
         files and the gutter is where the restore arrow must stay. */
      lineNumbersMinChars: 2,
      lineDecorationsWidth: 4,
      originalEditable: false,
      fontSize: EDITOR_CODE_FONT_SIZE,
      lineHeight: EDITOR_CODE_LINE_HEIGHT,
      minimap: {
        enabled: false,
      },
      scrollBeyondLastLine: false,
      renderOverviewRuler: false,
      fontFamily: EDITOR_UI_FONT,
    });
    const semanticLightOptions = {
      'semanticHighlighting.enabled': true,
    } as unknown as Monaco.editor.IEditorOptions;
    diff.getOriginalEditor?.()?.updateOptions(semanticLightOptions);
    diff.getModifiedEditor?.()?.updateOptions(semanticLightOptions);
    diffRef.current = diff;
    const focusDisposables = [
      diff.getOriginalEditor?.()?.onDidFocusEditorText?.(() => {
        lastFocusedDiffSideRef.current = 'original';
      }),
      diff.getModifiedEditor?.()?.onDidFocusEditorText?.(() => {
        lastFocusedDiffSideRef.current = 'modified';
      }),
    ].filter((disposable) => disposable !== null && disposable !== undefined);
    return () => {
      focusDisposables.forEach((disposable) => disposable.dispose?.());
      captureDiffViewState(diffViewKeyRef.current);
      const models = diff.getModel() as { original: DiffTextModel | null; modified: DiffTextModel | null } | null;
      /* Same ordering rule as the swap below: the widget must let go of the
         models before they are disposed, or Monaco logs a warning per model. */
      diff.setModel(null);
      if (models?.modified?.__dshRestoreListener != null) {
        models.modified.__dshRestoreListener.dispose?.();
        models.modified.__dshRestoreListener = undefined;
      }
      if (models?.modified?.__dshFallbackUndo != null) {
        models.modified.__dshFallbackUndo.dispose?.();
        models.modified.__dshFallbackUndo = undefined;
      }
      models?.original?.dispose?.();
      models?.modified?.dispose?.();
      diff.dispose();
      diffRef.current = null;
    };
  }, [captureDiffViewState, monacoReady]);
  React.useEffect(() => {
    const diff = diffRef.current;
    if (diff === null) return;
    const savedView = captureDiffViewState(diffViewKeyRef.current);
    diff.updateOptions({
      renderSideBySide: sideBySide,
    });
    restoreDiffViewState(diffViewKeyRef.current, savedView);
    try {
      window.localStorage.setItem('dsh-editor.diff.sideBySide', sideBySide ? '1' : '0');
    } catch {
      /* a storage-less browser still gets the in-memory choice */
    }
  }, [captureDiffViewState, restoreDiffViewState, sideBySide]);
  React.useEffect(() => {
    const diff = diffRef.current;
    if (diff === null) return;
    diff.updateOptions({
      hideUnchangedRegions: {
        enabled: collapseUnchanged,
        minimumLineCount: 4,
        contextLineCount: 2,
        revealLineCount: 10,
      },
    });
    try {
      window.localStorage.setItem('dsh-editor.diff.collapseUnchanged', collapseUnchanged ? '1' : '0');
    } catch {
      /* a storage-less browser still gets the in-memory choice */
    }
  }, [collapseUnchanged]);
  React.useEffect(() => {
    const diff = diffRef.current;
    if (diff === null) return;
    diff.updateOptions({
      ignoreTrimWhitespace: ignoreWhitespace,
    });
    try {
      window.localStorage.setItem('dsh-editor.diff.ignoreWhitespace', ignoreWhitespace ? '1' : '0');
    } catch {
      /* a storage-less browser still gets the in-memory choice */
    }
  }, [ignoreWhitespace]);
  React.useEffect(() => {
    const diff = diffRef.current;
    if (diff === null) return;
    const renderWhitespace = showWhitespaces ? 'all' : 'none';
    const original = diff.getOriginalEditor?.();
    const modified = diff.getModifiedEditor?.();
    original?.updateOptions({
      renderWhitespace,
    });
    modified?.updateOptions({
      renderWhitespace,
    });
    try {
      window.localStorage.setItem('dsh-editor.diff.showWhitespaces', showWhitespaces ? '1' : '0');
    } catch {
      /* a storage-less browser still gets the in-memory choice */
    }
  }, [showWhitespaces]);
  React.useEffect(() => {
    const diff = diffRef.current;
    if (diff === null) return;
    diff.updateOptions({
      lineNumbers: showLineNumbers ? 'on' : 'off',
    });
    try {
      window.localStorage.setItem('dsh-editor.diff.showLineNumbers', showLineNumbers ? '1' : '0');
    } catch {
      /* a storage-less browser still gets the in-memory choice */
    }
  }, [showLineNumbers]);
  React.useEffect(() => {
    const diff = diffRef.current;
    if (diff === null) return;
    const original = diff.getOriginalEditor?.();
    const modified = diff.getModifiedEditor?.();
    original?.updateOptions({
      wordWrap: softWrap ? 'on' : 'off',
    });
    modified?.updateOptions({
      wordWrap: softWrap ? 'on' : 'off',
    });
    try {
      window.localStorage.setItem('dsh-editor.diff.softWrap', softWrap ? '1' : '0');
    } catch {
      /* a storage-less browser still gets the in-memory choice */
    }
  }, [softWrap]);
  React.useEffect(() => {
    const diff = diffRef.current;
    if (diff === null) return;
    const original = diff.getOriginalEditor?.();
    const modified = diff.getModifiedEditor?.();
    original?.updateOptions({
      guides: {
        indentation: showIndentGuides,
      },
    });
    modified?.updateOptions({
      guides: {
        indentation: showIndentGuides,
      },
    });
    try {
      window.localStorage.setItem('dsh-editor.diff.showIndentGuides', showIndentGuides ? '1' : '0');
    } catch {
      /* a storage-less browser still gets the in-memory choice */
    }
  }, [showIndentGuides]);
  React.useEffect(() => {
    const diff = diffRef.current;
    const monaco = window.monaco;
    if (target === null || diff === null || monaco?.editor === undefined) return;
    clearCombinedColorDecorations();
    clearConflictMarkerDecorations();
    const previousViewKey = diffViewKeyRef.current;
    if (previousViewKey !== '') captureDiffViewState(previousViewKey);
    diffViewKeyRef.current = diffViewStateKey(target, swapSidesRef.current);
    const writable =
      typeof target.clipboardText !== 'string' &&
      typeof target.revision !== 'string' &&
      typeof target.commit !== 'string';
    const canEdit = diffEditingEnabled({
      writable,
      swapped: swapSidesRef.current,
      locked: editLockedRef.current,
    });
    diff.updateOptions({
      readOnly: canEdit === false,
      renderMarginRevertIcon: canEdit,
      glyphMargin: canEdit || readStoredText('dsh-editor.diff.sideBySide', '1') !== '0',
      lineNumbersMinChars: 2,
      lineDecorationsWidth: 4,
    });
    let cancelled = false;
    /* A clipboard target sends its text; commit and change targets read from git. */
    const request =
      typeof target.clipboardText === 'string'
        ? {
            op: 'compareText',
            path: target.path,
            text: target.clipboardText,
            label: target.label,
          }
        : typeof target.revision === 'string'
          ? /* Compare the file NOW against how it looked at that revision. */ {
              op: 'diffWithRevision',
              hash: target.revision,
              path: target.path,
            }
          : typeof target.commit === 'string'
            ? {
                op: 'commitDiff',
                hash: target.commit,
                path: target.path,
              }
            : target.combined === true
              ? {
                  op: 'combinedDiff',
                  entries: target.entries,
                }
              : {
                  op: 'diff',
                  path: target.path,
                  staged: target.staged,
                };
    const diffAbort = new AbortController();
    callGit<DiffLoadResponse>(request, {
      signal: diffAbort.signal,
    })
      .then((value) => {
        if (cancelled || diffRef.current !== diff) return;
        if (value.binary) {
          diff.setModel(null);
          diffLoadedRef.current = null;
          setState({
            binary: true,
            error: null,
            missing: value.missing === true,
          });
          return;
        }
        let loadedCombinedFiles: DiffCombinedFile[] = [];
        if (target.combined === true) {
          const files = (Array.isArray(value.files) ? value.files : [])
            .filter((file) => Number.isFinite(Number(file?.line)))
            .map((file) => ({
              ...file,
              line: Number(file.line),
            }));
          loadedCombinedFiles = files as DiffCombinedFile[];
          combinedFilesRef.current = files as DiffCombinedFile[];
          setCombinedFiles(files);
          setCombinedPosition(
            files.length === 0
              ? {
                  index: 0,
                  total: 0,
                }
              : {
                  index: 1,
                  total: files.length,
                },
          );
        }
        const tag =
          typeof target.clipboardText === 'string'
            ? 'clipboard'
            : typeof target.commit === 'string'
              ? `commit=${target.commit}`
              : typeof target.revision === 'string'
                ? `revision=${target.revision}`
                : target.combined === true
                  ? `combined=${(target.entries ?? []).length}`
                  : `staged=${target.staged}`;
        /* A unique fragment per load: reusing the exact URI while an older
         model is still being disposed makes Monaco reject the SECOND model
         (`ModelService: Cannot add model because it already exists`). */
        const modelPath = target.combined === true ? 'combined-diff.txt' : target.path;
        const base = `file:///${modelPath.split('/').map(encodeURIComponent).join('/')}?load=${String(nextDiffLoadSerial())}`;
        const original = monaco.editor.createModel(
          typeof value.original === 'string' ? value.original : '',
          safeLanguage(monaco, modelPath),
          monaco.Uri.parse(`${base}?side=original&${tag}`),
        );
        const modified = monaco.editor.createModel(
          typeof value.modified === 'string' ? value.modified : '',
          safeLanguage(monaco, modelPath),
          monaco.Uri.parse(`${base}?side=modified&${tag}`),
        ) as DiffTextModel;
        diffModelsRef.current = {
          original,
          modified,
        };
        diffLoadedRef.current = {
          path: modelPath,
          /* History and clipboard comparisons are read-only; only a working
           change can be restored a block at a time. */
          side:
            typeof target.commit === 'string' ||
            typeof target.revision === 'string' ||
            typeof target.clipboardText === 'string' ||
            target.combined === true
              ? null
              : target.staged === true
                ? 'index'
                : 'worktree',
          original: typeof value.original === 'string' ? value.original : '',
          modified: typeof value.modified === 'string' ? value.modified : '',
        };
        const previous = diff.getModel();
        /* Detach BEFORE disposing: a model the widget still holds logs
         "TextModel got disposed before DiffEditorWidget model got reset". */
        diff.setModel(null);
        if (previous?.modified?.__dshRestoreListener != null) {
          previous.modified.__dshRestoreListener.dispose?.();
          previous.modified.__dshRestoreListener = undefined;
        }
        if (previous?.modified?.__dshFallbackUndo != null) {
          previous.modified.__dshFallbackUndo.dispose?.();
          previous.modified.__dshFallbackUndo = undefined;
        }
        previous?.original?.dispose?.();
        previous?.modified?.dispose?.();
        const loadedModels = diffModelsRef.current;
        diff.setModel(
          swapSidesRef.current === true
            ? {
                original: loadedModels.modified,
                modified: loadedModels.original,
              }
            : loadedModels,
        );
        {
          const collections: Monaco.editor.IEditorDecorationsCollection[] = [];
          const sides = [
            { editor: diff.getOriginalEditor?.(), model: loadedModels.original },
            { editor: diff.getModifiedEditor?.(), model: loadedModels.modified },
          ];
          for (const entry of sides) {
            if (entry.editor === undefined || entry.model === null || entry.model === undefined) continue;
            const markers = conflictMarkerLineNumbers(entry.model.getValue());
            if (markers.length === 0) continue;
            collections.push(
              entry.editor.createDecorationsCollection(
                markers.map((line) => ({
                  range: new monaco.Range(line, 1, line, 1),
                  options: {
                    isWholeLine: true,
                    className: 'dsh-editor-conflict-marker-line',
                  },
                })),
              ),
            );
          }
          conflictMarkerCollectionsRef.current = collections;
        }
        if (target.combined === true && loadedCombinedFiles.length > 0) {
          void (async () => {
            const collections: Monaco.editor.IEditorDecorationsCollection[] = [];
            const colorBudget = createCombinedDiffColorBudget();
            try {
              const sides: Array<{
                editor: Monaco.editor.ICodeEditor | undefined;
                side: 'original' | 'modified';
              }> = [
                {
                  editor: diff.getOriginalEditor?.(),
                  side: swapSidesRef.current ? 'modified' : 'original',
                },
                {
                  editor: diff.getModifiedEditor?.(),
                  side: swapSidesRef.current ? 'original' : 'modified',
                },
              ];
              for (const entry of sides) {
                const editor = entry.editor;
                const model = editor?.getModel?.();
                if (editor === undefined || model === null || model === undefined) continue;
                const lines = model.getLinesContent();
                const decorations: Monaco.editor.IModelDeltaDecoration[] = [];
                for (const file of loadedCombinedFiles) {
                  if (cancelled) break;
                  const body = combinedDiffBodyLines(lines, file as CombinedDiffColorFile, entry.side);
                  if (body === null) continue;
                  const bodyText = body.lines.join('\n');
                  if (!takeCombinedDiffColorBudget(colorBudget, bodyText)) continue;
                  const specs = await combinedDiffDecorationSpecs(monaco, file.path, bodyText);
                  if (cancelled) break;
                  for (const spec of specs) {
                    decorations.push({
                      range: new monaco.Range(
                        spec.startLineNumber + body.firstLineNumber - 1,
                        spec.startColumn,
                        spec.endLineNumber + body.firstLineNumber - 1,
                        spec.endColumn,
                      ),
                      options: {
                        inlineClassName: spec.inlineClassName,
                      },
                    });
                  }
                }
                collections.push(editor.createDecorationsCollection(decorations));
              }
              if (cancelled) {
                for (const collection of collections) collection.clear();
                return;
              }
              combinedColorCollectionsRef.current = collections;
            } catch {
              for (const collection of collections) collection.clear();
            }
          })();
        }
        /* Monaco's per-hunk arrow writes through `executeEdits`; listen on the
         model so both the arrow and the selection toolbar persist. */
        if (modified.__dshRestoreListener != null) modified.__dshRestoreListener.dispose?.();
        setSelectionRange(null);
        if (diffLoadedRef.current.side !== null) {
          modified.__dshRestoreListener = modified.onDidChangeContent(() => {
            if (loadingRef.current) return;
            restorePendingRef.current = true;
            window.setTimeout(() => {
              if (restorePendingRef.current) persistRestored();
            }, 0);
          });
        }
        setState({
          binary: false,
          error: null,
          missing: value.missing === true,
        });
        /* The widget computes the hunks asynchronously; `revealFirstDiff` waits
         for that pass, so reading `getLineChanges()` after it is safe. The
         first diff can also carry a blank line (it did for a long
         translation table), which made a bare sync still read the old
         counter. Await the computation and then settle the toolbar once. */
        diff.revealFirstDiff();
        void diff.waitForDiff().then(() => {
          const restoredView = restoreDiffViewState(diffViewKeyRef.current);
          if (restoredView === false) focusFirstHunkRef.current?.();
          /* The diff now owns the active editor tab; arrows and F7 must work
           without making the user click a pane first. */
          focusDiffRef.current?.();
          syncHunksRef.current?.();
        });
        syncHunksRef.current?.();
      })
      .catch((failure) => {
        if (failure?.name === 'AbortError' || failure?.name === 'CanceledError') return;
        if (!cancelled) {
          diffLoadedRef.current = null;
          setState({
            binary: false,
            error: failure instanceof Error ? failure.message : String(failure),
            missing: false,
          });
        }
      });
    return () => {
      cancelled = true;
      diffAbort.abort();
      clearCombinedColorDecorations();
      clearConflictMarkerDecorations();
    };
  }, [
    captureDiffViewState,
    clearCombinedColorDecorations,
    clearConflictMarkerDecorations,
    persistRestored,
    reloadGeneration,
    restoreDiffViewState,
    target,
  ]);
  React.useEffect(() => {
    const diff = diffRef.current;
    if (diff === null) return;
    const canEdit = diffEditingEnabled({
      writable: diffReadOnly === false,
      swapped: swapSides,
      locked: editLocked,
    });
    diff.updateOptions({
      readOnly: canEdit === false,
      renderMarginRevertIcon: canEdit,
      glyphMargin: canEdit || sideBySide,
    });
  }, [diffReadOnly, editLocked, sideBySide, swapSides]);
  React.useEffect(() => {
    swapSidesRef.current = false;
    setSwapSides(false);
  }, [target]);

  /**
   * Rebind the same two loaded documents in the requested visual order.
   *
   * Swap Sides is a view operation in IDEA, not a new comparison. Keeping
   * both models means switching back is instant and no diff request or
   * undo history is lost. The revision side must not accept block restores,
   * so the swapped orientation is read-only.
   * @param {boolean} swapped - whether the working/current side should be left.
   * @returns {void}
   */
  const applyDiffSideOrder = React.useCallback(
    (swapped: boolean): void => {
      const diff = diffRef.current;
      const pair = diffModelsRef.current;
      if (diff === null || pair === null) return;
      const next = swapped
        ? {
            original: pair.modified,
            modified: pair.original,
          }
        : pair;
      diff.setModel(next);
      const canEdit = diffEditingEnabled({
        writable: diffReadOnly === false && diffLoadedRef.current?.side !== null,
        swapped,
        locked: editLockedRef.current,
      });
      diff.updateOptions({
        readOnly: canEdit === false,
        renderMarginRevertIcon: canEdit,
        glyphMargin: canEdit || sideBySide,
      });
    },
    [diffReadOnly, sideBySide],
  );
  React.useEffect(() => {
    const previousState = captureDiffViewState(diffViewKeyRef.current);
    swapSidesRef.current = swapSides;
    const nextKey = diffViewStateKey(diffTargetRef.current, swapSides);
    diffViewKeyRef.current = nextKey;
    applyDiffSideOrder(swapSides);
    restoreDiffViewState(nextKey, previousState);
  }, [applyDiffSideOrder, captureDiffViewState, restoreDiffViewState, swapSides]);

  /* Track which hunk the modified pane's caret sits in, for the `n/total` label. */
  syncHunksRef.current = () => {
    const diff = diffRef.current;
    if (diff === null) return;
    const changes = diff.getLineChanges() ?? [];
    /* `getLineChanges()` can briefly return null while the widget recomputes
       after a restore; `hunkAt` already normalises non-arrays, but the null
       must not leave the old `1/1` counter on an empty diff. */
    const line = diff.getModifiedEditor()?.getPosition()?.lineNumber ?? 1;
    const next = hunkAt(changes, line);
    setHunks((current) => (current.index === next.index && current.total === next.total ? current : next));
  };
  focusFirstHunkRef.current = () => {
    const diff = diffRef.current;
    if (diff === null) return;
    const changes = diff.getLineChanges() ?? [];
    const first = changes[0];
    if (first === undefined) return;
    const editor = diff.getModifiedEditor();
    if (editor === null) return;
    editor.setPosition({
      lineNumber: Math.max(1, Number(first.modifiedStartLineNumber) || 1),
      column: 1,
    });
    editor.revealPositionInCenterIfOutsideViewport(editor.getPosition());
  };
  focusDiffRef.current = () => {
    const editor = diffRef.current?.getModifiedEditor?.();
    if (editor === null || editor === undefined) return;
    editor.focus();
  };

  /**
   * Activate Monaco's native restore arrow from the keyboard.
   *
   * The gutter button is created outside React, so the diff host delegates
   * Enter/Space to its existing click handler instead of maintaining a
   * second restore implementation.
   * @param {KeyboardEvent} event - keydown from the diff host subtree.
   * @returns {void}
   */
  const onDiffHostKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const revertTarget = event.target instanceof Element ? event.target.closest('.revertButton') : null;
    if (!(revertTarget instanceof HTMLElement)) return;
    event.preventDefault();
    event.stopPropagation();
    revertTarget.click();
  }, []);
  React.useEffect(() => {
    const diff = diffRef.current;
    if (diff === null) return;
    const subscription = diff.onDidUpdateDiff(() => syncHunksRef.current?.());
    return () => subscription.dispose();
  }, [monacoReady]);
  React.useEffect(() => {
    const diff = diffRef.current;
    if (diff === null) return;
    const editor = diff.getModifiedEditor();
    const subscription = editor.onDidChangeCursorSelection((event: Monaco.editor.ICursorSelectionChangedEvent) => {
      const selection = event.selection;
      const empty =
        selection === null ||
        selection === undefined ||
        (selection.startLineNumber === selection.endLineNumber && selection.startColumn === selection.endColumn);
      setSelectionRange(
        empty
          ? null
          : {
              startLineNumber: selection.startLineNumber,
              startColumn: selection.startColumn,
              endLineNumber: selection.endLineNumber,
              endColumn: selection.endColumn,
            },
      );
      const files = combinedFilesRef.current;
      if (files.length > 0) {
        const line = editor.getPosition()?.lineNumber ?? 1;
        const index = combinedFileIndexAtLine(combinedFilesRef.current, line) + 1;
        setCombinedPosition((current) =>
          current.index === index && current.total === files.length
            ? current
            : {
                index,
                total: files.length,
              },
        );
      }
    });
    return () => subscription.dispose();
  }, [monacoReady]);

  /** Walk to the next or previous hunk, IDEA's diff toolbar arrows. */
  const walkHunk = React.useCallback((direction: 'previous' | 'next'): void => {
    const diff = diffRef.current;
    if (diff === null) return;
    diff.goToDiff(direction === 'previous' ? 'previous' : 'next');
    /* `goToDiff` moves the modified pane's selection, so the caret is current. */
    window.setTimeout(() => syncHunksRef.current?.(), 0);
  }, []);

  /**
   * Jump directly to one of Monaco's existing line changes.
   *
   * IDEA's Go To Change popup lists every difference and moves the caret to
   * the chosen one. Reuse the diff widget's current hunk array instead of
   * recalculating the comparison in another component.
   * @param {number} index - zero-based hunk index.
   * @returns {void}
   */
  const jumpToDiffHunk = React.useCallback((index: number): void => {
    const changes = diffRef.current?.getLineChanges?.() ?? [];
    const change = changes[index];
    if (change === undefined) return;
    const editor = diffRef.current?.getModifiedEditor?.();
    if (editor === null || editor === undefined) return;
    const position = {
      lineNumber: Math.max(1, Number(change.modifiedStartLineNumber) || 1),
      column: 1,
    };
    editor.setPosition(position);
    editor.revealPositionInCenterIfOutsideViewport(position);
    editor.focus();
    window.setTimeout(() => syncHunksRef.current?.(), 0);
  }, []);

  /**
   * Move to one file heading inside a combined diff.
   *
   * @param {number} index - zero-based combined file index.
   * @returns {void}
   */
  const jumpToCombinedFile = React.useCallback((index: number): void => {
    const files = combinedFilesRef.current;
    if (files.length === 0) return;
    const next = Math.max(0, Math.min(files.length - 1, Number(index) || 0));
    const file = files[next];
    const editor = diffRef.current?.getModifiedEditor?.();
    if (editor === null || editor === undefined || !Number.isFinite(Number(file?.line))) return;
    const position = {
      lineNumber: Number(file.line),
      column: 1,
    };
    editor.setPosition(position);
    editor.revealPositionInCenterIfOutsideViewport(position);
    editor.focus();
    setCombinedPosition({
      index: next + 1,
      total: files.length,
    });
  }, []);
  const navigationPosition = target?.combined === true ? combinedPosition : filePosition;
  const previousFileAction =
    target?.combined === true ? () => jumpToCombinedFile((combinedPosition.index || 1) - 2) : onPreviousFile;
  const nextFileAction = target?.combined === true ? () => jumpToCombinedFile(combinedPosition.index || 0) : onNextFile;
  const currentCombinedIndex = Math.max(0, (combinedPosition.index || 1) - 1);
  const currentCombinedCollapsed = target?.combined === true && collapsedCombinedFiles.has(currentCombinedIndex);
  const allCombinedCollapsed = combinedFiles.length > 0 && collapsedCombinedFiles.size === combinedFiles.length;
  const toggleCombinedFileCollapse = React.useCallback(() => {
    if (target?.combined !== true) return;
    const index = combinedPosition.index - 1;
    if (index < 0 || index >= combinedFilesRef.current.length) return;
    setCollapsedCombinedFiles((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, [combinedPosition.index, target?.combined]);
  const toggleAllCombinedFiles = React.useCallback(() => {
    if (target?.combined !== true || combinedFilesRef.current.length === 0) return;
    setCollapsedCombinedFiles((current) =>
      current.size === combinedFilesRef.current.length
        ? new Set()
        : new Set(combinedFilesRef.current.map((_, index) => index)),
    );
  }, [target?.combined]);
  React.useEffect(() => {
    const diff = diffRef.current;
    if (diff === null || target?.combined !== true || combinedFiles.length === 0) return;
    const collapsed = [...collapsedCombinedFiles].filter(
      (index) => Number.isInteger(index) && index >= 0 && index < combinedFiles.length,
    );
    const originalRanges = collapsed
      .map((index) => combinedFileHiddenRange(combinedFiles[index], 'original'))
      .filter(Boolean);
    const modifiedRanges = collapsed
      .map((index) => combinedFileHiddenRange(combinedFiles[index], 'modified'))
      .filter(Boolean);
    diff.getModifiedEditor().setHiddenAreas(modifiedRanges);
    diff.getOriginalEditor().setHiddenAreas(originalRanges);
  }, [collapsedCombinedFiles, combinedFiles, monacoReady, target?.combined]);

  /**
   * Open IDEA's Go To Change popup anchored to the hunk counter.
   * @param {MouseEvent} [event] - counter or overflow-button event.
   * @returns {void}
   */
  const openHunkMenu = React.useCallback(
    (event?: React.SyntheticEvent<HTMLElement>) => {
      const changes = diffRef.current?.getLineChanges?.() ?? [];
      if (changes.length === 0) return;
      const rect = event?.currentTarget?.getBoundingClientRect?.();
      setHunkMenu({
        x: rect === undefined ? 240 : Math.max(4, rect.right - 220),
        y: rect === undefined ? 120 : rect.bottom + 4,
        title: t('editor.goToChange'),
        items: changes.map((change: Monaco.editor.ILineChange, index: number) => ({
          id: `change:${index + 1}`,
          label: t('editor.changeAtLine', {
            index: index + 1,
            total: changes.length,
            line: Math.max(1, Number(change.modifiedStartLineNumber) || 1),
          }),
          shortcut: index === hunks.index - 1 ? '✓' : '',
          restoreFocus: false,
          run: () => jumpToDiffHunk(index),
        })),
      });
    },
    [hunks.index, jumpToDiffHunk, t],
  );

  /* F7 / ⇧F7 are IDEA's "next / previous difference". They only act while a
     diff is open, so they cannot collide with the editor's own bindings. */
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      /* The diff owns these keys only while it owns the keyboard. Terminal
         emulators, the Project/Change trees and ordinary form controls must
         receive F7, ⌘W, undo and redo themselves. */
      const shortcutTarget = event.target instanceof Element ? event.target : null;
      const insideDiffSurface = shortcutTarget?.closest('[data-dsh-editor-diff-surface]') !== null;
      const insideDiffPane = shortcutTarget?.closest('.dsh-editor-diff-pane') !== null;
      const foreignKeyboardSurface =
        shortcutTarget?.closest(
          '[data-dsh-editor-terminal], [role="tree"], input, textarea, select, [contenteditable="true"]',
        ) !== null;
      if (!insideDiffPane && foreignKeyboardSurface) return;
      const meta = event.metaKey || event.ctrlKey;
      const editableHistory = diffReadOnly === false && editLocked === false;
      if (insideDiffPane && event.ctrlKey && event.shiftKey && !event.metaKey && !event.altKey && event.key === 'Tab') {
        event.preventDefault();
        event.stopPropagation();
        focusOppositeDiffPane();
        return;
      }
      /* IDEA's Combined Diff action uses literal Control+Escape and
         toggles only the file that owns the current caret. */
      if (isCombinedFileCollapseShortcut(event, insideDiffPane, target?.combined === true)) {
        event.preventDefault();
        event.stopPropagation();
        toggleCombinedFileCollapse();
        return;
      }
      /* IDEA closes the comparison with plain Escape. A context menu or
         Monaco's own find/suggest popup consumes Escape first, so opening
         one does not unexpectedly dismiss the whole diff. */
      const popupOwnsEscape =
        document.querySelector('[role="menu"]') !== null ||
        hostRef.current?.querySelector('.monaco-editor .find-widget.visible, .monaco-editor .suggest-widget.visible') !=
          null;
      if (isDiffCloseShortcut(event, insideDiffPane, popupOwnsEscape)) {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      /* IDEA's Rollback Lines shares the Commit view's ⌥⌘Z habit. The
         global row-rollback handler already yields inside Monaco. */
      if (meta && event.altKey && !event.shiftKey && event.key.toLowerCase() === 'z') {
        if (!insideDiffPane || !actionableSelection) return;
        event.preventDefault();
        event.stopPropagation();
        restoreSelection();
        return;
      }
      if (meta && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'f') {
        if (!insideDiffSurface) return;
        event.preventDefault();
        event.stopPropagation();
        searchInChanges();
        return;
      }
      if (
        insideDiffPane &&
        event.ctrlKey &&
        event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        event.key === 'ArrowRight'
      ) {
        event.preventDefault();
        event.stopPropagation();
        applyLeftSide();
        return;
      }
      /* IDEA's diff viewer uses Control+Shift+Left/Right for the changed-file
         sequence whenever one exists. F7/Shift+F7 remain the hunk gestures;
         a single-file comparison without a sequence keeps the hunk fallback. */
      if (
        insideDiffPane &&
        event.ctrlKey &&
        event.shiftKey &&
        !event.altKey &&
        !event.metaKey &&
        (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
      ) {
        event.preventDefault();
        event.stopPropagation();
        if (navigationPosition !== null) {
          if (event.key === 'ArrowLeft') previousFileAction?.();
          else nextFileAction?.();
        } else {
          if (event.key === 'ArrowLeft') walkHunk('previous');
          else walkHunk('next');
        }
        return;
      }
      /* Monaco's Close Tab action lives on the normal editor, not on the
         diff widget. Bind the same IDEA gesture here so the comparison can
         be closed and focus handed back to the next active tab. */
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'w') {
        if (shortcutTarget?.closest('input, textarea[data-dsh-diff-find], [contenteditable="true"]') === null) {
          event.preventDefault();
          event.stopPropagation();
          onClose();
          return;
        }
      }
      /* IDEA's EditSource is F4. On a comparison it opens the local file;
         the diff itself must not become the editor when the user wants to
         make the fix rather than only inspect it. */
      if (
        event.key === 'F4' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        insideDiffPane &&
        typeof target?.path === 'string' &&
        typeof onOpenLocal === 'function' &&
        localPathAvailable !== false
      ) {
        event.preventDefault();
        event.stopPropagation();
        onOpenLocal(target.path);
        return;
      }
      /* ⌘Z is IDEA's "take the block restore back". The diff surface owns
         the key while it is showing, unless the user is typing in a real
         field (find / rename). */
      if (
        editableHistory &&
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'z'
      ) {
        if (shortcutTarget?.closest('input, textarea[data-dsh-diff-find], [contenteditable="true"]') === null) {
          event.preventDefault();
          event.stopPropagation();
          undoRestore();
          return;
        }
      }
      /* IDEA's redo is ⇧⌘Z; Windows editors also accept Ctrl+Y. */
      if (
        editableHistory &&
        (((event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === 'z') ||
          (event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'y'))
      ) {
        if (shortcutTarget?.closest('input, textarea[data-dsh-diff-find], [contenteditable="true"]') === null) {
          event.preventDefault();
          event.stopPropagation();
          redoRestore();
          return;
        }
      }
      if (event.key !== 'F7') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      walkHunk(event.shiftKey ? 'previous' : 'next');
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [
    actionableSelection,
    applyLeftSide,
    editLocked,
    focusOppositeDiffPane,
    localPathAvailable,
    navigationPosition,
    nextFileAction,
    onClose,
    onOpenLocal,
    previousFileAction,
    redoRestore,
    restoreSelection,
    searchInChanges,
    target,
    toggleCombinedFileCollapse,
    undoRestore,
    walkHunk,
  ]);
  const editorSettingsItems = [
    {
      id: 'whitespace',
      icon: 'ignore',
      label: t('editor.diffIgnoreWhitespace'),
      shortcut: ignoreWhitespace ? '✓' : '',
      active: ignoreWhitespace,
      run: () => setIgnoreWhitespace((value) => !value),
    },
    null,
    {
      id: 'showWhitespaces',
      icon: 'whitespace',
      label: t('editor.diffShowWhitespaces'),
      shortcut: showWhitespaces ? '✓' : '',
      active: showWhitespaces,
      run: () => setShowWhitespaces((value) => !value),
    },
    {
      id: 'lineNumbers',
      icon: 'lineNumbers',
      label: t('editor.diffLineNumbers'),
      shortcut: showLineNumbers ? '✓' : '',
      active: showLineNumbers,
      run: () => setShowLineNumbers((value) => !value),
    },
    {
      id: 'indentGuides',
      icon: 'indentGuides',
      label: t('editor.diffIndentGuides'),
      shortcut: showIndentGuides ? '✓' : '',
      active: showIndentGuides,
      run: () => setShowIndentGuides((value) => !value),
    },
    {
      id: 'softWrap',
      icon: 'wrap',
      label: t('editor.diffSoftWrap'),
      shortcut: softWrap ? '✓' : '',
      active: softWrap,
      run: () => setSoftWrap((value) => !value),
    },
  ];
  const diffToolbarActions = [
    ...(typeof onToggleFocus === 'function'
      ? [
          {
            id: 'focusDiff',
            icon: focusMode ? 'collapse' : 'expand',
            label: focusMode ? t('editor.diffExitFocus') : t('editor.diffFocus'),
            group: 'view',
            active: focusMode,
            disabled: diffUnavailable,
            run: onToggleFocus,
          },
        ]
      : []),
    {
      id: 'applyLeftSide',
      icon: 'applyLeft',
      label: t('editor.diffApplyLeftSide'),
      group: 'mode',
      shortcut: '⌃⌘→',
      disabled: diffUnavailable || diffReadOnly || swapSides || editLocked,
      run: applyLeftSide,
    },
    {
      id: 'swapSides',
      icon: 'swap',
      label: t('editor.diffSwapSides'),
      group: 'mode',
      active: swapSides,
      disabled: diffUnavailable,
      run: () => setSwapSides((value) => !value),
    },
    ...(diffReadOnly === false
      ? [
          {
            id: 'disableEditing',
            icon: editLocked ? 'lock' : 'unlock',
            label: t('editor.diffDisableEditing'),
            group: 'mode',
            active: editLocked,
            disabled: swapSides || diffUnavailable,
            run: () => setEditLocked((value) => !value),
          },
        ]
      : []),
    ...(sideBySide
      ? [
          {
            id: 'focusOppositePane',
            icon: 'switchPane',
            label: t('editor.diffFocusOppositePane'),
            group: 'selection',
            shortcut: '⌃⇧⇥',
            disabled: diffUnavailable,
            restoreFocus: false,
            run: focusOppositeDiffPane,
          },
          {
            id: 'selectPositionInOppositePane',
            icon: 'target',
            label: t('editor.diffSelectOppositePosition'),
            group: 'selection',
            disabled: diffUnavailable,
            restoreFocus: false,
            run: selectPositionInOppositeDiffPane,
          },
        ]
      : []),
    {
      id: 'reloadDiff',
      icon: 'refresh',
      label: t('editor.diffReload'),
      group: 'inspect',
      run: () => setReloadGeneration((current) => current + 1),
    },
    {
      id: 'find',
      icon: 'search',
      label: t('editor.searchInChanges'),
      group: 'inspect',
      shortcut: '⌘F',
      disabled: diffUnavailable,
      run: searchInChanges,
    },
    {
      id: 'collapse',
      icon: collapseUnchanged ? 'expand' : 'collapse',
      label: t('editor.diffShowUnchanged'),
      group: 'inspect',
      active: !collapseUnchanged,
      disabled: diffUnavailable,
      run: () => setCollapseUnchanged((value) => !value),
    },
    ...(target?.combined === true && combinedFiles.length > 0
      ? [
          {
            id: 'collapseAllCombinedFiles',
            icon: allCombinedCollapsed ? 'expand' : 'collapse',
            label: allCombinedCollapsed ? t('editor.expandAllCombinedFiles') : t('editor.collapseAllCombinedFiles'),
            group: 'inspect',
            active: allCombinedCollapsed,
            disabled: diffUnavailable,
            run: toggleAllCombinedFiles,
          },
          {
            id: 'collapseCombinedFile',
            icon: currentCombinedCollapsed ? 'expand' : 'collapse',
            label: currentCombinedCollapsed ? t('editor.expandCombinedFile') : t('editor.collapseCombinedFile'),
            group: 'inspect',
            shortcut: '⌃Esc',
            active: currentCombinedCollapsed,
            disabled: diffUnavailable,
            run: toggleCombinedFileCollapse,
          },
        ]
      : []),
    ...(hunks.total === 0
      ? []
      : [
          {
            id: 'goToChange',
            icon: 'target',
            label: t('editor.goToChange'),
            group: 'inspect',
            run: () => openHunkMenu(),
          },
        ]),
    {
      id: 'settings',
      icon: 'settings',
      label: t('editor.settings'),
      group: 'inspect',
      disabled: diffUnavailable,
      items: editorSettingsItems,
      run: (event: React.MouseEvent<HTMLElement>) =>
        openDiffActionSubmenu(event, t('editor.settings'), editorSettingsItems, 'settings'),
    },
    ...(typeof target?.path === 'string' && typeof onOpenLocal === 'function'
      ? [
          {
            id: 'openLocalVersion',
            icon: 'file',
            label: t('editor.openLocalVersion'),
            group: 'open',
            shortcut: 'F4',
            disabled: localPathAvailable === false,
            run: () => {
              if (localPathAvailable !== false) onOpenLocal(target.path);
            },
          },
        ]
      : []),
    ...(diffReadOnly === false && swapSides === false
      ? [
          {
            id: 'undo',
            icon: 'undo',
            label: t('editor.diffUndoRestore'),
            group: 'history',
            shortcut: '⌘Z',
            disabled: editLocked || diffUnavailable || !canUndo,
            run: undoRestore,
          },
          {
            id: 'redo',
            icon: 'redo',
            label: t('editor.diffRedoRestore'),
            group: 'history',
            shortcut: '⇧⌘Z',
            disabled: editLocked || diffUnavailable || !canRedo,
            run: redoRestore,
          },
        ]
      : []),
    ...(actionableSelection
      ? [
          {
            id: 'selection',
            icon: 'target',
            label: t('editor.diffSelectionRestore'),
            group: 'history',
            shortcut: '⌥⌘Z',
            run: restoreSelection,
          },
        ]
      : []),
  ];
  /* Binary and missing targets have no Monaco model to show. Keep their
     message row visible while hiding the empty diff host. */
  const hidden = target === null || state.binary;
  const fileNavMode = diffFileNavModeForWidth(diffToolbarWidth);
  const diffViewModeControl = diffViewModeControlForWidth(diffToolbarWidth);
  const rollbackIncludeLabelVisible = diffRollbackIncludeLabelVisibleForWidth(diffToolbarWidth);
  const diffActionsKey = diffToolbarActions.map((action) => action.id).join('|');
  const resolvedDirectActionCount =
    diffDirectActionCount === null
      ? diffToolbarActions.length
      : Math.max(0, Math.min(diffDirectActionCount, diffToolbarActions.length));
  const directDiffActions = diffToolbarActions.slice(0, resolvedDirectActionCount);
  const hiddenDiffActions = diffToolbarActions.slice(resolvedDirectActionCount);
  const directDiffActionEntries = groupDiffToolbarActions(directDiffActions);
  const hiddenDiffActionEntries = groupDiffToolbarActions(hiddenDiffActions);
  const diffActionsCompact = hiddenDiffActions.length > 0;
  const openDiffActionMenu = (rect: DOMRect): void => {
    setDiffActionMenu({
      x: Math.max(4, rect.right - 210),
      y: rect.bottom + 4,
      items: hiddenDiffActionEntries.map((action) =>
        action === null
          ? null
          : {
              id: action.id,
              label: action.label,
              shortcut: action.shortcut ?? (action.active === true ? '✓' : ''),
              active: typeof action.active === 'boolean' ? action.active : undefined,
              disabled: action.disabled === true,
              restoreFocus: action.restoreFocus === false ? false : undefined,
              run: action.run,
              items: action.items,
            },
      ),
    });
  };
  const diffFixedLayoutKey = [
    target?.path ?? '',
    target?.staged === true ? '1' : '0',
    target?.revision ?? '',
    target?.clipboardText ?? '',
    target?.combined === true ? '1' : '0',
    includedInCommit === true ? '1' : '0',
    rollbackInclusion === undefined ? '0' : '1',
    rollbackIncludeLabelVisible === true ? '1' : '0',
    filePosition?.index ?? '',
    filePosition?.total ?? '',
    navigationPosition?.index ?? '',
    navigationPosition?.total ?? '',
    fileNavMode,
    showIncludedSummary === true ? '1' : '0',
  ].join('|');
  React.useLayoutEffect(() => {
    const node = diffToolbarRef.current;
    if (node === null) return undefined;
    const measure = () => {
      const width = node.clientWidth;
      const fixedWidth = [...node.querySelectorAll('[data-dsh-diff-fixed]')].reduce(
        (sum, control) => sum + control.getBoundingClientRect().width,
        0,
      );
      const next = diffDirectActionCountForWidth(width, fixedWidth, diffToolbarActions);
      setDiffDirectActionCount((current: number | null) => (current === next ? current : next));
      if (!Number.isFinite(width)) return;
      setDiffToolbarWidth((current: number) => (Math.abs(current - width) < 0.5 ? current : width));
    };
    let timer = 0;
    const scheduleMeasure = () => {
      if (timer !== 0) return;
      timer = window.setTimeout(() => {
        timer = 0;
        measure();
      }, 16);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(node);
    /* ResizeObserver is not delivered in every embedded webview while a
       splitter is being dragged; pointer/resize events are the fallback. */
    window.addEventListener('mousemove', scheduleMeasure, {
      passive: true,
    });
    window.addEventListener('resize', scheduleMeasure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('mousemove', scheduleMeasure);
      window.removeEventListener('resize', scheduleMeasure);
      if (timer !== 0) window.clearTimeout(timer);
    };
  }, [diffActionsKey, diffFixedLayoutKey]);
  React.useEffect(() => {
    if (!diffActionsCompact) setDiffActionMenu(null);
  }, [diffActionsCompact]);
  return (
    <div
      style={styles.diffPane}
      className='dsh-editor-diff-pane'>
      <div
        ref={diffToolbarRef}
        style={styles.diffToolbar}
        className='dsh-editor-diff-toolbar'
        role='toolbar'
        aria-label={t('editor.diffToolbar')}>
        {target?.combined === true ? (
          <span
            style={styles.diffTitle}
            className='dsh-editor-diff-title'>
            {target.revisionPair !== null && typeof target.revisionPair === 'object'
              ? t('editor.compareRevisionsTitle', {
                  count: target.entries?.length ?? 0,
                })
              : typeof target.commitWithLocal === 'string'
                ? t('editor.compareWithLocalTitle', {
                    count: target.entries?.length ?? 0,
                  })
                : t('editor.combinedDiffTitle', {
                    count: target.entries?.length ?? 0,
                  })}
          </span>
        ) : (
          <PathLabel
            path={target?.path ?? ''}
            style={styles.diffTitle}
          />
        )}
        <span
          style={styles.diffHint}
          className='dsh-editor-diff-hint'
          data-dsh-diff-fixed=''>
          {target?.combined === true
            ? target.revisionPair !== null && typeof target.revisionPair === 'object'
              ? t('editor.compareRevisionsMode', {
                  left: String(target.revisionPair.left ?? '').slice(0, 7),
                  right: String(target.revisionPair.right ?? '').slice(0, 7),
                })
              : typeof target.commitWithLocal === 'string'
                ? t('editor.compareWithLocalMode', {
                    hash: target.commitWithLocal.slice(0, 7),
                  })
                : t('editor.combinedDiffMode', {
                    count: target.entries?.length ?? 0,
                  })
            : typeof target?.clipboardText === 'string'
              ? t('editor.compareClipboardMode')
              : typeof target?.revision === 'string'
                ? t('editor.compareRevisionMode', {
                    hash: target.revision.slice(0, 7),
                  })
                : typeof target?.commit === 'string'
                  ? t('editor.commitDiffMode', {
                      hash: target.commit.slice(0, 7),
                    })
                  : target?.staged === true
                    ? t('editor.stagedMode')
                    : t('editor.unstagedMode')}
        </span>
        {filePosition === null && navigationPosition === null ? null : fileNavMode === 'hidden' ? null : fileNavMode ===
          'compact' ? (
          <span
            style={styles.fileNavCapsule}
            className='dsh-editor-file-nav dsh-editor-file-nav-capsule'
            data-dsh-diff-fixed=''
            role='button'
            tabIndex={0}
            title={t('editor.fileNavCapsuleHint', {
              index: navigationPosition.index,
              total: navigationPosition.total,
            })}
            aria-label={t('editor.fileNavCapsuleHint', {
              index: navigationPosition.index,
              total: navigationPosition.total,
            })}
            onClick={(event) => (event.shiftKey ? previousFileAction : nextFileAction)?.()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                (event.shiftKey ? previousFileAction : nextFileAction)?.();
              } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                previousFileAction?.();
              } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                nextFileAction?.();
              }
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              previousFileAction?.();
            }}>{`${navigationPosition.index}/${navigationPosition.total}`}</span>
        ) : (
          <span
            style={styles.fileNav}
            className='dsh-editor-file-nav'
            data-dsh-diff-fixed=''
            title={t('editor.filePositionHint', {
              index: navigationPosition.index,
              total: navigationPosition.total,
            })}>
            <ToolbarButton
              icon='chevronLeft'
              label={t('editor.previousFile')}
              disabled={navigationPosition.index <= 1 || previousFileAction === undefined}
              onClick={() => previousFileAction?.()}
            />
            <span
              style={styles.fileNavCounter}
              aria-label={t('editor.filePositionHint', {
                index: navigationPosition.index,
                total: navigationPosition.total,
              })}>{`${navigationPosition.index}/${navigationPosition.total}`}</span>
            <ToolbarButton
              icon='chevronRight'
              label={t('editor.nextFile')}
              disabled={navigationPosition.index >= navigationPosition.total || nextFileAction === undefined}
              onClick={() => nextFileAction?.()}
            />
          </span>
        )}
        {rollbackInclusion === undefined ? null : (
          <label
            style={styles.diffRollbackInclude}
            className='dsh-editor-diff-rollback-include'
            data-dsh-diff-fixed=''>
            <input
              type='checkbox'
              checked={rollbackInclusion.included}
              aria-label={t('editor.diffIncludeInRollback')}
              onChange={(event) => rollbackInclusion.onToggle(event.target.checked)}
            />
            {rollbackIncludeLabelVisible ? <span>{t('editor.diffIncludeInRollback')}</span> : null}
          </label>
        )}
        <span
          style={styles.diffToolbarActions}
          className='dsh-editor-diff-toolbar-actions'>
          {showIncludedSummary ? (
            <span
              style={styles.diffSummary}
              className='dsh-editor-diff-summary'
              data-dsh-diff-fixed=''
              title={includedState === 'all' ? t('editor.diffSummaryAllHint') : t('editor.diffSummaryNoneHint')}
              aria-label={includedState === 'all' ? t('editor.diffSummaryAllHint') : t('editor.diffSummaryNoneHint')}>
              {includedState === 'all'
                ? t(hunks.total === 1 ? 'editor.diffSummaryAllOne' : 'editor.diffSummaryAll', {
                    count: hunks.total,
                  })
                : includedState === 'none'
                  ? t(hunks.total === 1 ? 'editor.diffSummaryNoneOne' : 'editor.diffSummaryNone', {
                      count: hunks.total,
                    })
                  : null}
            </span>
          ) : null}
          {directDiffActionEntries.map((action, index) =>
            action === null ? (
              <span
                key={`diff-separator-${index}`}
                className='dsh-editor-diff-toolbar-separator'
                style={styles.diffToolbarSeparator}
                role='separator'
                aria-orientation='vertical'
              />
            ) : (
              <ToolbarButton
                key={action.id}
                icon={action.icon}
                label={action.label}
                active={toolbarActionActive(action)}
                disabled={action.disabled === true}
                onClick={action.run}
                ariaHasPopup={Array.isArray(action.items) ? 'menu' : undefined}
                ariaExpanded={Array.isArray(action.items) ? diffActionMenu?.actionId === action.id : undefined}
              />
            ),
          )}
          {diffActionsCompact ? (
            <ToolbarButton
              icon='more'
              label={t('editor.moreActions')}
              onClick={(event) => {
                openDiffActionMenu(event.currentTarget.getBoundingClientRect());
              }}
              onKeyDown={(event) => {
                if (event.key === 'ContextMenu' || (event.shiftKey === true && event.key === 'F10')) {
                  event.preventDefault();
                  event.stopPropagation();
                  openDiffActionMenu(event.currentTarget.getBoundingClientRect());
                }
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openDiffActionMenu(event.currentTarget.getBoundingClientRect());
              }}
              ariaHasPopup='menu'
              ariaExpanded={diffActionMenu !== null}
            />
          ) : null}
          <DiffViewModeControl
            t={t}
            mode={diffViewModeControl}
            sideBySide={sideBySide}
            disabled={diffUnavailable}
            onChange={setSideBySide}
          />
          {
            /* IDEA's diff toolbar: walk hunks, and say which one you are on. Hidden for
           an unchanged file — `0/0` next to two arrows that do nothing is noise. */
            hunks.total === 0 ? null : (
              <React.Fragment>
                <span
                  style={styles.hunkNav}
                  className='dsh-editor-hunk-nav'
                  data-dsh-diff-fixed=''>
                  <ToolbarButton
                    icon='chevronUp'
                    label={t('editor.previousChange')}
                    onClick={() => walkHunk('previous')}
                  />
                  <span
                    style={styles.hunkCounter}
                    className='dsh-editor-hunk-counter'
                    role='button'
                    tabIndex={0}
                    title={t('editor.goToChangeHint', {
                      index: hunks.index,
                      total: hunks.total,
                    })}
                    aria-label={t('editor.goToChangeHint', {
                      index: hunks.index,
                      total: hunks.total,
                    })}
                    onClick={(event) => openHunkMenu(event)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openHunkMenu(event);
                      } else if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        walkHunk('previous');
                      } else if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        walkHunk('next');
                      }
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      openHunkMenu(event);
                    }}>{`${hunks.index}/${hunks.total}`}</span>
                  <ToolbarButton
                    icon='chevronDown'
                    label={t('editor.nextChange')}
                    onClick={() => walkHunk('next')}
                  />
                </span>
                <span
                  style={styles.hunkCapsule}
                  className='dsh-editor-hunk-nav dsh-editor-hunk-capsule'
                  data-dsh-diff-fixed=''
                  role='button'
                  tabIndex={0}
                  title={t('editor.hunkCapsuleHint', {
                    index: hunks.index,
                    total: hunks.total,
                  })}
                  aria-label={t('editor.hunkCapsuleHint', {
                    index: hunks.index,
                    total: hunks.total,
                  })}
                  onClick={(event) => walkHunk(event.shiftKey ? 'previous' : 'next')}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      walkHunk(event.shiftKey ? 'previous' : 'next');
                    } else if (event.key === 'ArrowLeft') {
                      event.preventDefault();
                      walkHunk('previous');
                    } else if (event.key === 'ArrowRight') {
                      event.preventDefault();
                      walkHunk('next');
                    }
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    walkHunk('previous');
                  }}>{`${hunks.index}/${hunks.total}`}</span>
              </React.Fragment>
            )
          }
          <span
            data-dsh-diff-fixed=''
            style={{
              display: 'inline-flex',
              flex: 'none',
            }}>
            <ToolbarButton
              icon='hide'
              label={t('editor.closeDiff')}
              onClick={onClose}
            />
          </span>
        </span>
      </div>
      {diffActionMenu === null ? null : (
        <ContextMenu
          menu={diffActionMenu}
          onClose={() => setDiffActionMenu(null)}
          t={t}
        />
      )}
      {hunkMenu === null ? null : (
        <ContextMenu
          menu={hunkMenu}
          onClose={() => setHunkMenu(null)}
          t={t}
        />
      )}
      {typeof target?.commit === 'string' ||
      typeof target?.revision === 'string' ||
      typeof target?.clipboardText === 'string' ||
      target?.combined === true ? null : (
        <div
          style={styles.diffRestoreHint}
          role={undoNotice === null ? undefined : 'status'}>
          {undoNotice ?? t(target?.staged === true ? 'editor.diffRestoreHintStaged' : 'editor.diffRestoreHint')}
        </div>
      )}
      {sideBySide ? (
        <div
          style={styles.diffSideHeaders}
          className='dsh-editor-diff-side-headers'>
          <span style={styles.diffSideHeader}>{displayedSideLabels.left}</span>
          <span
            style={{
              ...styles.diffSideHeader,
              ...styles.diffSideHeaderDivider,
            }}>
            {displayedSideLabels.right}
          </span>
        </div>
      ) : null}
      {state.error !== null ? <div style={styles.error}>{state.error}</div> : null}
      {state.binary ? <div style={styles.empty}>{t('editor.binaryDiff')}</div> : null}
      <div
        ref={hostRef}
        style={{
          ...styles.diffHost,
          display: hidden ? 'none' : 'block',
        }}
        onKeyDown={onDiffHostKeyDown}
        data-dsh-editor-diff-surface=''
      />
    </div>
  );
}

export { DiffPreview };
