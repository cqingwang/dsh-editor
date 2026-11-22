import React from 'react';
import { styles } from '../../ui/styles';
import { EDITOR_TEXT_STYLE } from '../editor/editor-style-model';
import { Icon, POPUP_ICON_SIZE } from '../ui/Icon';
import { ContextMenu, type MenuEntry } from '../ui/Menu';
import { PanelToolbar } from '../ui/PanelToolbar';
import { ToolbarButton } from '../ui/ToolbarButton';
import { TreeMessage } from '../ui/TreeMessage';
import { FileTreeView, type FileTreeViewRowDecoration, type FileTreeViewRowState } from './FileTreeView';
import { searchIndexProgressPercent } from './project-search-index';
import {
  projectContextMenuRowAfterKeyboard,
  projectPrimaryHiddenByCollapse,
  projectSelectionAfterDirectoryCollapse,
  type ProjectTreeSelectionModifiers,
} from './project-selection-model';
import {
  copySearchResultText,
  searchDirectoryEffectiveState,
  searchDirectoryExcludedWithIncludedDescendant,
  type SearchDirectoryRules,
} from '../../commit';
import { basename, callFs, searchTextFailureMessage, splitRootLabel } from '../../editor-core';
import { bindShiftWheelScroll, shouldShowTreeLoading } from '../../injected-css';
import {
  captureDroppedWorkspaceHandles,
  dataTransferIncludesFiles,
  dataTransferIncludesProjectTreePaths,
  formatUploadBytes,
  PROJECT_TREE_DRAG_MIME,
  projectExternalDropDirectory,
  projectToolbarDropDirectory,
  readProjectTreeDragPaths,
  uploadProgressPercent,
} from '../../project';
import {
  branchLabel,
  directoryTint,
  filterProjectSpeedSearchRows,
  highlightParts,
  indexChangesByDirectory,
  projectSpeedSearchKeyAction,
  projectTreePositions,
  projectViewDefinitions,
  revealInTree,
  searchEntryRows,
  speedSearchHitRows,
  speedSearchTarget,
  treeNameColor,
  treeSearchMiss,
} from '../../terminal';
import type { ProjectDropHandles } from '../../project';

type Translate = (key: string, params?: Record<string, unknown>) => string;
export type ProjectRow = Record<string, unknown> & {
  path: string;
  name?: string;
  kind?: string;
  depth?: number;
  root?: boolean;
  searchOpen?: boolean;
  continues?: boolean[];
};
type ProjectCallback = (...args: unknown[]) => void;
interface ProjectPanelGit {
  changes?: Array<{ path?: string; status?: string; staged?: boolean }>;
  [key: string]: unknown;
}
interface UploadProgress {
  name: string;
  index: number;
  count: number;
  loaded: number;
  total: number;
}
interface SearchIndexProgress {
  processedFiles: number;
  totalFiles: number;
  contentBytes: number;
}
interface CreateState {
  kind?: 'file' | 'directory';
  parent?: string;
  value?: string;
  template?: boolean;
}
interface RenameState {
  path: string;
  value: string;
}
export interface ProjectTreeContextMenuPayload {
  row: ProjectRow;
  x: number;
  y: number;
  selectionRows?: ProjectRow[];
}
export interface ProjectPanelProps {
  t: Translate;
  root: string;
  home: string;
  entries: ProjectRow[];
  children: Record<string, ProjectRow[]>;
  expanded: Set<string>;
  rows: ProjectRow[];
  projectRows: ProjectRow[];
  projectView: string;
  onProjectViewChange: (view: string) => void;
  filteredView?: boolean;
  supportsExpansion?: boolean;
  emptyMessage?: string | null;
  selectedPath: string | null;
  selection: Set<string>;
  hasActiveFile: boolean;
  git: ProjectPanelGit | null;
  loading: boolean;
  error: string | null;
  createState: CreateState | null;
  onToggle: ProjectCallback;
  onOpen: ProjectCallback;
  onOpenEditSource: ProjectCallback;
  onOpenPreview: (path: string) => void;
  onRevealPath: ProjectCallback;
  onSelect: (row: ProjectRow, event: ProjectTreeSelectionModifiers, selectionRows?: ProjectRow[]) => void;
  onApplySelection?: (selection: Set<string>, primary: string, anchor?: string) => void;
  projectMenuItems: MenuEntry[];
  onCreateChange: (value: string) => void;
  onCreateCommit: ProjectCallback;
  onCreateCancel: () => void;
  onReveal: ProjectCallback;
  canCollapseAll: boolean;
  onCollapseAll: () => void;
  onNotify: (message: string) => void;
  onRefresh: () => void;
  onHide: () => void;
  rowRefs: React.RefObject<Map<string, HTMLElement>>;
  treeRef: React.RefObject<HTMLDivElement | null>;
  onTreeKeyDown: React.KeyboardEventHandler<HTMLDivElement>;
  onContextMenu: (payload: ProjectTreeContextMenuPayload) => void;
  onRootContextMenu: (payload: { x: number; y: number }) => void;
  rootContextMenuOpen: boolean;
  onDrop: (sources: string[], destination: string) => void;
  onUpload: (handles: ProjectDropHandles, targetDirectory: string) => void;
  onCancelUpload: () => void;
  uploadBusy: boolean;
  uploadProgress: UploadProgress | null;
  searchIndexRebuilding: boolean;
  searchIndexClearing: boolean;
  searchIndexProgress: SearchIndexProgress;
  onCancelSearchIndex: () => void;
  showHidden: boolean;
  searchDirectoryRules: SearchDirectoryRules;
  searchRevision: number;
  sortMode: string;
  manualOrder: Record<string, string[]>;
  onManualReorder: (sources: string[], destination: string, edge: 'before' | 'after') => void;
  foldersFirst: boolean;
  showExcludedFiles: boolean;
  onCycleSort: () => void;
  onToggleHidden: () => void;
  singleClickOpen: boolean;
  onToggleSingleClickOpen: () => void;
  openDirectoriesSingleClick: boolean;
  onToggleOpenDirectoriesSingleClick: () => void;
  compactDirectories: boolean;
  onCreateParent: ProjectCallback;
  onCreateTemplate: ProjectCallback;
  renameState: RenameState | null;
  onRenameChange: (value: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  deletedPaths: Set<string>;
  newPaths: Set<string>;
}
function ProjectPanel({
  t,
  root,
  home,
  expanded,
  rows,
  projectRows,
  projectView,
  onProjectViewChange,
  filteredView,
  supportsExpansion,
  emptyMessage,
  selectedPath,
  selection,
  hasActiveFile,
  git,
  loading,
  error,
  createState,
  onToggle,
  onOpen,
  onOpenEditSource,
  onOpenPreview,
  onRevealPath,
  onSelect,
  onApplySelection,
  projectMenuItems,
  onCreateChange,
  onCreateCommit,
  onCreateCancel,
  onReveal,
  canCollapseAll,
  onCollapseAll,
  onNotify,
  onRefresh,
  onHide,
  rowRefs,
  treeRef,
  onTreeKeyDown,
  onContextMenu,
  onRootContextMenu,
  rootContextMenuOpen,
  onDrop,
  onUpload,
  onCancelUpload,
  uploadBusy,
  uploadProgress,
  searchIndexRebuilding,
  searchIndexClearing,
  searchIndexProgress,
  onCancelSearchIndex,
  showHidden,
  searchDirectoryRules,
  searchRevision,
  sortMode,
  manualOrder,
  onManualReorder,
  foldersFirst,
  showExcludedFiles,
  singleClickOpen,
  openDirectoriesSingleClick,
  compactDirectories,
  onCreateParent,
  onCreateTemplate,
  renameState,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  deletedPaths,
  newPaths,
}: ProjectPanelProps) {
  const projectName = basename(root) || 'Workspace';
  const progressPercent =
    uploadProgress === null || uploadProgress === undefined
      ? 0
      : uploadProgressPercent(uploadProgress.loaded, uploadProgress.total);
  const searchIndexHasKnownTotal = searchIndexProgress.totalFiles > 0;
  const searchIndexPercent = searchIndexProgressPercent(
    searchIndexProgress.processedFiles,
    searchIndexProgress.totalFiles,
  );
  const searchIndexLabel = searchIndexClearing
    ? t('editor.searchIndexClearing')
    : searchIndexHasKnownTotal
      ? t('editor.searchIndexPrebuildProgress', {
          processed: searchIndexProgress.processedFiles,
          total: searchIndexProgress.totalFiles,
          bytes: formatUploadBytes(searchIndexProgress.contentBytes),
        })
      : t('editor.searchIndexPrebuilding');
  const searchIndexVisibleLabel = searchIndexClearing
    ? t('editor.searchIndexClearing')
    : searchIndexHasKnownTotal
      ? t('editor.searchIndexProgressShort', {
          processed: searchIndexProgress.processedFiles,
          total: searchIndexProgress.totalFiles,
        })
      : t('editor.searchIndexPrebuildingShort');
  const [search, setSearch] = React.useState('');
  const [viewMenu, setViewMenu] = React.useState(null);
  /* IDEA highlights the tree when a dragged row would land on the root. */
  const [rootDropActive, setRootDropActive] = React.useState(false);
  const [externalDropPath, setExternalDropPath] = React.useState(null);
  const [toolbarDropActive, setToolbarDropActive] = React.useState(false);
  const [manualDrop, setManualDrop] = React.useState(null);
  const uploadExternalWorkspaceDrop = (event: React.DragEvent<HTMLElement>, targetDirectory: string): void => {
    const handles = captureDroppedWorkspaceHandles(event.dataTransfer);
    if (typeof onUpload === 'function') onUpload(handles, targetDirectory);
  };
  const toolbarDropDirectory = React.useMemo(
    () => projectToolbarDropDirectory(projectRows, selectedPath),
    [projectRows, selectedPath],
  );
  const handleToolbarDragOver = (event: React.DragEvent<HTMLElement>): void => {
    if (!dataTransferIncludesFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    setToolbarDropActive(true);
  };
  const handleToolbarDragLeave = (event: React.DragEvent<HTMLElement>): void => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    setToolbarDropActive(false);
  };
  const handleToolbarDrop = (event: React.DragEvent<HTMLElement>): void => {
    if (!dataTransferIncludesFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    setToolbarDropActive(false);
    if (typeof onUpload === 'function') {
      onUpload(captureDroppedWorkspaceHandles(event.dataTransfer), toolbarDropDirectory);
    }
  };
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchEntries, setSearchEntries] = React.useState(null);
  const [searchPending, setSearchPending] = React.useState(false);
  const [searchError, setSearchError] = React.useState(null);
  const [searchTruncated, setSearchTruncated] = React.useState(false);
  const searchRef = React.useRef(null);
  const directSpeedSearchRef = React.useRef('');
  const searchRequestRef = React.useRef(0);
  const searchReturnSelectionRef = React.useRef<{ selection: Set<string>; primary: string | null } | null>(null);
  const closeProjectViewMenu = React.useCallback(() => {
    setViewMenu(null);
    window.setTimeout(() => {
      if (searchOpen) {
        searchRef.current?.focus();
        return;
      }
      treeRef.current?.focus();
    }, 0);
  }, [searchOpen, treeRef]);
  React.useEffect(() => {
    if (!searchOpen || searchReturnSelectionRef.current !== null) return;
    searchReturnSelectionRef.current = { selection: new Set(selection), primary: selectedPath };
  }, [searchOpen, selection, selectedPath]);
  React.useEffect(() => bindShiftWheelScroll(treeRef.current), []);
  /* ⌘/Ctrl+F inside the tool window filters the tree in place, like IDEA. */
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      /* Shift+Cmd/Ctrl+F is IDEA's Find in Files. The Project speed search
         owns only the unshifted chord, even when focus is outside Monaco. */
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'f')
        return;
      const host = event.target instanceof Element ? event.target.closest('[data-dsh-editor-workspace]') : null;
      if (host === null) return;
      /* The editor owns ⌘F when its textarea has focus. */
      if (document.activeElement?.closest('.monaco-editor') != null) return;
      /* The terminal owns its own Find bar. Its handler runs after this one,
         so this surface must yield before either handler prevents the event. */
      if (document.activeElement?.closest('[data-dsh-terminal-pane]') != null) return;
      event.preventDefault();
      event.stopPropagation();
      directSpeedSearchRef.current = '';
      setSearchOpen(true);
      window.setTimeout(() => searchRef.current?.focus(), 0);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);
  React.useEffect(() => {
    if (!searchOpen) return undefined;
    /* Project Options closes through ContextMenu, whose return-focus lands
       on the tree. If speed search was the surface being used, keep it as
       the active keyboard surface after the setting is applied. */
    /* Project Options restores tree focus immediately and again after
       120ms. Reclaim search focus after that second write. */
    const timer = window.setTimeout(() => searchRef.current?.focus(), 160);
    return () => window.clearTimeout(timer);
  }, [compactDirectories, searchOpen, showExcludedFiles, showHidden, sortMode]);
  const localRows = React.useMemo(() => filterProjectSpeedSearchRows(rows, search), [rows, search]);
  const visibleRows = React.useMemo(
    () =>
      search.trim() === '' || searchEntries === null
        ? localRows
        : searchEntryRows(searchEntries, projectName, compactDirectories, sortMode, manualOrder),
    [compactDirectories, localRows, manualOrder, projectName, search, searchEntries, sortMode],
  );
  React.useEffect(() => {
    const query = search.trim();
    const requestId = ++searchRequestRef.current;
    if (query === '') {
      setSearchEntries(null);
      setSearchPending(false);
      setSearchError(null);
      setSearchTruncated(false);
      return undefined;
    }
    if (filteredView === true) {
      /* Open Files / All Changed Files are already bounded filters. Searching
         them must not escape into a recursive project walk and show files
         that the selected view intentionally excludes. */
      setSearchEntries(null);
      setSearchPending(false);
      setSearchError(null);
      setSearchTruncated(false);
      return undefined;
    }
    setSearchEntries(null);
    setSearchPending(true);
    setSearchError(null);
    setSearchTruncated(false);
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      callFs(
        {
          op: 'search',
          query,
          showHidden,
          showExcluded: showExcludedFiles,
          sort: sortMode,
          foldersFirst,
          respectGitIgnore: true,
          searchDirectoryRules,
        },
        { signal: controller.signal },
      )
        .then((value) => {
          if (searchRequestRef.current !== requestId) return;
          setSearchEntries(Array.isArray(value?.entries) ? value.entries : []);
          setSearchTruncated(value?.truncated === true);
          setSearchPending(false);
        })
        .catch((failure) => {
          if (searchRequestRef.current !== requestId) return;
          if (controller.signal.aborted) return;
          /* Keep the local filtered rows when the recursive walk fails; a
           transient host error must not blank a tree that is still usable. */
          setSearchEntries(null);
          setSearchPending(false);
          setSearchError(searchTextFailureMessage(failure, t));
          setSearchTruncated(false);
        });
    }, 160);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    filteredView,
    foldersFirst,
    search,
    searchDirectoryRules,
    searchRevision,
    showExcludedFiles,
    showHidden,
    sortMode,
    t,
  ]);
  const hits = React.useMemo(() => speedSearchHitRows(visibleRows, search), [search, visibleRows]);
  const selectVisibleRow = React.useCallback(
    (row: ProjectRow, event: ProjectTreeSelectionModifiers): void => {
      const selectionRows = search.trim() === '' ? undefined : visibleRows;
      onSelect(row, event, selectionRows);
    },
    [onSelect, search, visibleRows],
  );
  const projectNamePartsByPath = React.useMemo(() => {
    const partsByPath = new Map<string, ReturnType<typeof highlightParts>>();
    if (search.trim() === '') return partsByPath;
    for (const row of visibleRows) {
      if (typeof row.name === 'string') partsByPath.set(row.path, highlightParts(row.name, search));
    }
    return partsByPath;
  }, [search, visibleRows]);
  const projectRowPositions = React.useMemo(() => projectTreePositions(visibleRows), [visibleRows]);
  const selectSearchHit = React.useCallback(
    (row: ProjectRow) => {
      if (row === null || row === undefined) return;
      selectVisibleRow(row, {});
      window.setTimeout(
        () =>
          rowRefs.current?.get(row.path)?.scrollIntoView?.({
            block: 'nearest',
          }),
        0,
      );
    },
    [rowRefs, selectVisibleRow],
  );
  /* IDEA's speed search moves the current row as soon as the query narrows
     to a hit; Enter then opens that row rather than some other first match. */
  React.useEffect(() => {
    if (search.trim() === '' || hits.length === 0) return;
    if (hits.some((row) => row.path === selectedPath)) return;
    selectSearchHit(hits[0]);
  }, [hits, search, selectedPath, selectSearchHit]);
  const clearTreeSearchState = React.useCallback((): void => {
    searchRequestRef.current += 1;
    setSearch('');
    setSearchEntries(null);
    setSearchPending(false);
    setSearchError(null);
    setSearchTruncated(false);
  }, []);
  const closeTreeSearch = React.useCallback(() => {
    const previous = searchReturnSelectionRef.current;
    searchReturnSelectionRef.current = null;
    directSpeedSearchRef.current = '';
    clearTreeSearchState();
    setSearchOpen(false);
    if (previous !== null && previous.primary !== null && onApplySelection !== undefined) {
      onApplySelection(previous.selection, previous.primary, previous.primary);
    }
    window.setTimeout(() => treeRef.current?.focus(), 0);
  }, [clearTreeSearchState, onApplySelection, treeRef]);
  React.useEffect(() => {
    if (!searchOpen || (createState === null && renameState === null)) return undefined;
    /* IDEA closes speed search when inline New/Rename takes over. Keeping the
       filter visible while the tree no longer owns the keyboard leaves a stale
       query that can unexpectedly replace itself on the next direct keystroke. */
    closeTreeSearch();
    return undefined;
  }, [closeTreeSearch, createState, renameState, searchOpen]);
  const openSelectedContextMenuFromKeyboard = () => {
    const selected = projectContextMenuRowAfterKeyboard(visibleRows, selectedPath);
    const treeRect = treeRef.current?.getBoundingClientRect?.();
    const rowRect = selected === null ? null : rowRefs.current?.get(selected.path)?.getBoundingClientRect?.();
    const anchor = rowRect ?? treeRect;
    const x = anchor?.left ?? 4;
    const y = anchor === undefined || anchor === null ? 4 : anchor.bottom + 4;
    if (selected === null) {
      onRootContextMenu({ x, y });
      return;
    }
    if (!selection.has(selected.path)) selectVisibleRow(selected, {});
    onContextMenu({
      row: selected,
      x,
      y,
      selectionRows: search.trim() === '' ? undefined : visibleRows,
    });
  };
  const gitChanges = React.useMemo(
    () => new Map((git?.changes ?? []).map((change) => [change.path, change.status])),
    [git?.changes],
  );
  const changesByDirectory = React.useMemo(() => indexChangesByDirectory(git?.changes), [git?.changes]);
  const projectRowPresentationByPath = React.useMemo(() => {
    const presentations = new Map<
      string,
      {
        directoryTintState: { color: string } | null;
        open: boolean;
        projectRowPosition: (typeof projectRowPositions)[number];
        statusColor: string | null;
      }
    >();
    visibleRows.forEach((row, rowIndex) => {
      if (row.kind === 'placeholder') return;
      const status = gitChanges.get(row.path);
      const directoryRow = row.kind === 'directory';
      presentations.set(row.path, {
        directoryTintState:
          directoryRow && status === undefined ? directoryTint(changesByDirectory.get(row.path)) : null,
        open: row.searchOpen === true || expanded.has(row.path),
        projectRowPosition: projectRowPositions[rowIndex],
        statusColor: treeNameColor({
          status,
          selected: false,
        }),
      });
    });
    return presentations;
  }, [changesByDirectory, expanded, gitChanges, projectRowPositions, visibleRows]);
  const createParent = createState === null ? '' : createState.parent;
  const createInputRef = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => {
    if (createState === null) return undefined;
    const timer = window.setTimeout(() => createInputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [createState?.kind, createState?.parent]);
  const renameInputRef = React.useRef<HTMLInputElement | null>(null);
  const renameReadyRef = React.useRef(false);
  React.useEffect(() => {
    renameReadyRef.current = false;
    if (renameState === null) return undefined;
    const timer = window.setTimeout(() => {
      renameInputRef.current?.focus();
      renameReadyRef.current = true;
    }, 40);
    return () => window.clearTimeout(timer);
  }, [renameState?.path]);
  /* Every directory the tree currently knows about, root first. */
  const directoryChoices = React.useMemo(() => {
    const seen = new Set(['']);
    const choices = [
      {
        path: '',
        name: projectName,
      },
    ];
    for (const row of projectRows) {
      if (row.kind !== 'directory' || seen.has(row.path)) continue;
      seen.add(row.path);
      choices.push({
        path: row.path,
        name: row.path,
      });
    }
    return choices;
  }, [projectName, projectRows]);
  const viewDefinitions = React.useMemo(() => projectViewDefinitions(t), [t]);
  const currentViewLabel =
    viewDefinitions.find((definition) => definition.id === projectView)?.label ?? t('editor.projectViewProjectFiles');
  const openProjectViewMenu = (button: HTMLElement, includeProjectActions = false): void => {
    const rect = button.getBoundingClientRect();
    const viewItems: MenuEntry[] = viewDefinitions.map((definition) => ({
      id: `project-view:${definition.id}`,
      label: definition.label,
      active: definition.id === projectView,
      shortcut: definition.id === projectView ? '✓' : '',
      disabled: definition.available !== true,
      run: () => onProjectViewChange(definition.id),
    }));
    setViewMenu({
      x: Math.max(4, rect.left - 4),
      y: rect.bottom + 4,
      title: includeProjectActions ? t('editor.project') : t('editor.projectViewMenu'),
      items:
        includeProjectActions && projectMenuItems.length > 0 ? [...viewItems, null, ...projectMenuItems] : viewItems,
    });
  };
  const positionForProjectRow = (row: ProjectRow) =>
    projectRowPresentationByPath.get(row.path)?.projectRowPosition ?? {
      level: (row.depth ?? 0) + 1,
      posinset: 1,
      setsize: visibleRows.length,
    };
  const openProjectRow = (row: ProjectRow): boolean =>
    projectRowPresentationByPath.get(row.path)?.open ?? (row.searchOpen === true || expanded.has(row.path));
  const decorateProjectRow = (state: FileTreeViewRowState<ProjectRow>): FileTreeViewRowDecoration => {
    const { row } = state;
    const searchExcluded = searchDirectoryEffectiveState(row.path, searchDirectoryRules) === 'excluded';
    const searchExcludedWithIncludedDescendant =
      searchExcluded && searchDirectoryExcludedWithIncludedDescendant(row.path, searchDirectoryRules);
    const searchExcludedDescription = searchExcluded
      ? state.isDirectory
        ? t(
            searchExcludedWithIncludedDescendant
              ? 'editor.directoryExcludedFromSearchWithIncludedChildren'
              : 'editor.directoryExcludedFromSearch',
          )
        : t('editor.pathExcludedFromSearch')
      : '';
    return {
      style: {
        ...(externalDropPath === row.path
          ? {
              position: 'relative',
            }
          : null),
        ...(manualDrop?.path === row.path
          ? manualDrop.edge === 'after'
            ? {
                boxShadow: 'inset 0 -2px 0 var(--dsw-alias-state-business-primary)',
              }
            : {
                boxShadow: 'inset 0 2px 0 var(--dsw-alias-state-business-primary)',
              }
          : null),
      },
      iconClassName: searchExcluded ? 'dsh-editor-tree-icon-search-excluded' : undefined,
      title:
        row.path === ''
          ? root
          : searchExcludedDescription === ''
            ? row.path
            : `${row.path}\n${searchExcludedDescription}`,
      ariaDescription: searchExcludedDescription === '' ? undefined : searchExcludedDescription,
      draggable: !row.root,
      onDragStart: (event) => {
        const payload =
          selection.has(row.path) && selection.size > 1
            ? rows.filter((entry) => selection.has(entry.path) && entry.path !== '').map((entry) => entry.path)
            : [row.path];
        const text = payload.join('\n');
        event.dataTransfer?.setData(PROJECT_TREE_DRAG_MIME, text);
        event.dataTransfer?.setData('text/plain', text);
        event.dataTransfer.effectAllowed = 'move';
      },
      onDragEnd: () => {
        setManualDrop(null);
        setRootDropActive(false);
        setExternalDropPath(null);
      },
      onDragOver: (event) => {
        if (dataTransferIncludesFiles(event.dataTransfer)) {
          event.preventDefault();
          event.stopPropagation();
          const targetDirectory = projectExternalDropDirectory(row);
          event.dataTransfer.dropEffect = 'copy';
          setManualDrop(null);
          setExternalDropPath(targetDirectory);
          return;
        }
        if (!dataTransferIncludesProjectTreePaths(event.dataTransfer)) return;
        if (sortMode === 'manual') {
          event.preventDefault();
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          const edge = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
          event.dataTransfer.dropEffect = 'move';
          setManualDrop({
            path: row.path,
            edge,
          });
          return;
        }
        if (!state.isDirectory) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      },
      onDragLeave: (event) => {
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
        if (manualDrop?.path === row.path) setManualDrop(null);
        if (externalDropPath !== null) setExternalDropPath(null);
      },
      onDrop: (event) => {
        if (dataTransferIncludesFiles(event.dataTransfer)) {
          event.preventDefault();
          event.stopPropagation();
          setExternalDropPath(null);
          const targetDirectory = projectExternalDropDirectory(row);
          const handles = captureDroppedWorkspaceHandles(event.dataTransfer);
          if (typeof onUpload === 'function') onUpload(handles, targetDirectory);
          return;
        }
        if (sortMode === 'manual') {
          event.preventDefault();
          event.stopPropagation();
          const sources = readProjectTreeDragPaths(event.dataTransfer);
          const edge = manualDrop?.path === row.path ? manualDrop.edge : 'before';
          setManualDrop(null);
          if (sources.length > 0) onManualReorder(sources, row.path, edge);
          return;
        }
        if (!state.isDirectory) return;
        event.preventDefault();
        const sources = readProjectTreeDragPaths(event.dataTransfer);
        if (sources.length === 0 || sources.includes(row.path)) return;
        onDrop(sources, row.path);
      },
    };
  };
  const renderProjectRowName = (state: FileTreeViewRowState<ProjectRow>): React.ReactNode => {
    const { row, selected } = state;
    const projectRowPresentation = projectRowPresentationByPath.get(row.path);
    if (projectRowPresentation === undefined) return null;
    const { directoryTintState, statusColor } = projectRowPresentation;
    const searchExcluded = searchDirectoryEffectiveState(row.path, searchDirectoryRules) === 'excluded';
    return (
      <span
        style={{
          ...styles.treeName,
          ...(row.root ? styles.treeRootName : null),
          ...(row.root ? styles.treeRootLabel : null),
          ...(selected ? { color: '#fff' } : null),
          ...(!selected && statusColor !== null ? { color: statusColor } : null),
          ...(!selected && directoryTintState !== null ? { color: directoryTintState.color } : null),
          ...(!selected && searchExcluded ? { color: 'var(--dsw-alias-label-tertiary)', opacity: 0.68 } : null),
          ...(deletedPaths?.has?.(row.path)
            ? {
                textDecoration: 'line-through',
                opacity: 0.6,
              }
            : null),
          ...(newPaths?.has?.(row.path)
            ? {
                color: '#1a7f37',
              }
            : null),
        }}>
        {search.trim() === ''
          ? row.name
          : (projectNamePartsByPath.get(row.path) ?? []).map((part, index) =>
              part.match ? (
                <span
                  key={index}
                  style={styles.treeNameMatch}>
                  {part.text}
                </span>
              ) : (
                <span key={index}>{part.text}</span>
              ),
            )}
      </span>
    );
  };
  const renderProjectRowInlineEditor = (row: ProjectRow): React.ReactNode | null => {
    if (renameState === null || renameState.path !== row.path) return null;
    return (
      <input
        ref={renameInputRef}
        data-dsh-project-rename=''
        style={styles.renameInput}
        value={renameState.value}
        autoFocus={true}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => onRenameChange(event.target.value)}
        onBlur={() => {
          if (!renameReadyRef.current) return;
          renameReadyRef.current = false;
          onRenameCommit();
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing === true) return;
          if (event.key === 'Enter') {
            event.preventDefault();
            renameReadyRef.current = false;
            onRenameCommit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            renameReadyRef.current = false;
            onRenameCancel();
            window.setTimeout(() => treeRef.current?.focus(), 0);
          }
        }}
      />
    );
  };
  const renderProjectRowTrailing = (state: FileTreeViewRowState<ProjectRow>): React.ReactNode => {
    const { row, selected } = state;
    return (
      <React.Fragment>
        {row.root ? (
          <React.Fragment>
            {branchLabel(git) !== '' ? (
              <span
                style={{
                  ...styles.branchChip,
                  marginLeft: 6,
                }}>
                {branchLabel(git)}
              </span>
            ) : null}
            <span
              style={{
                ...styles.treeRootPath,
                color: selected ? 'rgba(255,255,255,0.72)' : undefined,
              }}
              title={root}>
              {splitRootLabel(root, home).path}
            </span>
          </React.Fragment>
        ) : null}
        {externalDropPath === row.path ? (
          <span
            data-dsh-project-file-drop-line={row.path}
            aria-hidden={true}
            style={{
              position: 'absolute',
              left: 8 + (row.depth ?? 0) * 14 + 18,
              right: 8,
              bottom: 0,
              height: 2,
              borderRadius: 2,
              background: 'var(--dsw-alias-state-business-primary)',
              pointerEvents: 'none',
            }}
          />
        ) : null}
      </React.Fragment>
    );
  };
  const treeStatusContent = (
    <React.Fragment>
      {shouldShowTreeLoading({
        loading,
        rowCount: visibleRows.length,
      }) ? (
        <TreeMessage
          state='loading'
          busy={true}>
          {t('editor.loading')}
        </TreeMessage>
      ) : null}
      {loading !== true &&
      error === null &&
      search.trim() === '' &&
      visibleRows.length === 0 &&
      typeof emptyMessage === 'string' &&
      emptyMessage !== '' ? (
        <TreeMessage state='empty'>{emptyMessage}</TreeMessage>
      ) : null}
      {error !== null ? (
        <TreeMessage
          state='error'
          role='alert'
          live='assertive'>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              minWidth: 0,
            }}>
            <span
              style={{
                minWidth: 0,
                overflowWrap: 'anywhere',
              }}>
              {error}
            </span>
            <button
              type='button'
              style={styles.conflictAction}
              onClick={() => {
                onRefresh();
                window.setTimeout(() => treeRef.current?.focus(), 0);
              }}>
              {t('editor.refresh')}
            </button>
          </span>
        </TreeMessage>
      ) : null}
      {searchError !== null && search.trim() !== '' ? (
        <TreeMessage
          state='search-error'
          role='alert'
          live='assertive'>
          {`${t('editor.treeSearchFailed')}: ${searchError}`}
        </TreeMessage>
      ) : null}
      {searchOpen && search.trim() !== '' && searchError === null && searchPending !== true && hits.length > 0 ? (
        <TreeMessage
          state='search-results'
          visuallyHidden={true}>
          {t(hits.length === 1 ? 'editor.treeSearchResultCountOne' : 'editor.treeSearchResultCount', {
            count: hits.length,
          })}
        </TreeMessage>
      ) : null}
      {treeSearchMiss({
        error: searchError,
        query: search,
        rows: visibleRows,
        loading: searchPending,
      }) ? (
        <TreeMessage state='no-matches'>{t('editor.noMatches')}</TreeMessage>
      ) : null}
      {searchTruncated ? <TreeMessage state='truncated'>{t('editor.treeSearchTruncated')}</TreeMessage> : null}
    </React.Fragment>
  );
  return (
    <React.Fragment>
      {viewMenu === null ? null : (
        <ContextMenu
          menu={viewMenu}
          onClose={closeProjectViewMenu}
          t={t}
        />
      )}
      <PanelToolbar
        dense
        t={t}
        ariaLabel={t('editor.project')}
        icon='project'
        title={t('editor.project')}
        titleFlexible
        titleAction={
          <span style={styles.projectViewTitle}>
            <button
              type='button'
              className='dsh-editor-project-root-button'
              style={{
                ...styles.projectRootButton,
                ...(rootContextMenuOpen
                  ? {
                      background: 'var(--dsw-alias-state-business-primary)',
                      color: '#fff',
                    }
                  : null),
              }}
              title={`${t('editor.copyProjectPath')}: ${root}`}
              aria-label={`${t('editor.copyProjectPath')}: ${projectName}`}
              data-dsh-project-root-context-active={rootContextMenuOpen ? 'true' : undefined}
              onClick={() => copySearchResultText(root, onNotify, t)}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                event.currentTarget.focus();
                onRootContextMenu({
                  x: event.clientX,
                  y: event.clientY,
                });
              }}
              onKeyDown={(event) => {
                if (event.key !== 'ContextMenu' && !(event.shiftKey === true && event.key === 'F10')) return;
                event.preventDefault();
                event.stopPropagation();
                const rect = event.currentTarget.getBoundingClientRect();
                onRootContextMenu({
                  x: rect.left,
                  y: rect.bottom + 4,
                });
              }}>
              {projectName}
            </button>
            <button
              type='button'
              className='dsh-editor-project-view-button'
              style={styles.projectViewButton}
              title={`${t('editor.projectViewMenu')}: ${currentViewLabel}`}
              aria-label={`${t('editor.projectViewMenu')}: ${currentViewLabel}`}
              aria-haspopup='menu'
              aria-expanded={viewMenu !== null}
              onClick={(event) => openProjectViewMenu(event.currentTarget)}
              onKeyDown={(event) => {
                if (event.key !== 'ContextMenu' && !(event.shiftKey === true && event.key === 'F10')) return;
                event.preventDefault();
                event.stopPropagation();
                openProjectViewMenu(event.currentTarget, true);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openProjectViewMenu(event.currentTarget, true);
              }}>
              <Icon
                name='chevronDown'
                size={10}
              />
            </button>
          </span>
        }
        right={[
          {
            id: 'reveal',
            group: 'navigation',
            icon: 'target',
            label: t('editor.reveal'),
            disabled: hasActiveFile !== true,
            ariaKeyShortcuts: 'Alt+F1 1',
            onClick: onReveal,
          },
          {
            id: 'collapse',
            group: 'navigation',
            icon: 'collapse',
            label: t('editor.collapseAll'),
            disabled: !canCollapseAll || supportsExpansion !== true,
            onClick: onCollapseAll,
          },
        ]}
        trailingRight={[
          {
            id: 'hide',
            group: 'window',
            icon: 'hide',
            label: t('editor.hide'),
            onClick: onHide,
          },
        ]}
        dropActive={toolbarDropActive}
        onDragEnter={handleToolbarDragOver}
        onDragLeave={handleToolbarDragLeave}
        onDragOver={handleToolbarDragOver}
        onDrop={handleToolbarDrop}
      />
      {searchIndexRebuilding || searchIndexClearing ? (
        <div
          data-dsh-project-index-progress=''
          style={{
            padding: '5px 8px',
            borderBottom: '1px solid var(--dsw-alias-separator-secondary, rgba(127,127,127,0.22))',
          }}>
          <div
            role='status'
            aria-label={searchIndexLabel}
            style={{
              color: 'var(--dsw-alias-label-secondary)',
              ...EDITOR_TEXT_STYLE.label,
              lineHeight: '16px',
              display: 'flex',
              gap: 6,
            }}>
            <span
              title={searchIndexLabel}
              style={{
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
              {searchIndexVisibleLabel}
            </span>
            {searchIndexRebuilding && searchIndexHasKnownTotal ? (
              <span
                style={{
                  flex: '0 0 auto',
                }}>{`${searchIndexPercent}%`}</span>
            ) : null}
            {searchIndexRebuilding ? (
              <button
                type='button'
                data-dsh-index-cancel=''
                aria-label={t('editor.searchIndexCancelRebuild')}
                title={t('editor.searchIndexCancelRebuild')}
                onClick={onCancelSearchIndex}
                style={{
                  flex: '0 0 auto',
                  border: '1px solid var(--dsw-alias-separator-secondary, rgba(127,127,127,0.35))',
                  background: 'transparent',
                  color: 'inherit',
                  borderRadius: 4,
                  padding: '0 6px',
                  font: 'inherit',
                  cursor: 'pointer',
                }}>
                {t('editor.searchIndexCancelShort')}
              </button>
            ) : null}
          </div>
          <div
            role='progressbar'
            aria-label={searchIndexLabel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={searchIndexRebuilding && searchIndexHasKnownTotal ? searchIndexPercent : undefined}
            aria-valuetext={searchIndexLabel}
            data-indeterminate={searchIndexHasKnownTotal ? undefined : 'true'}
            style={{
              height: 2,
              marginTop: 3,
              background: 'var(--dsw-alias-bg-hover, rgba(127,127,127,0.18))',
              borderRadius: 2,
              overflow: 'hidden',
              position: 'relative',
            }}>
            <div
              className={searchIndexHasKnownTotal ? undefined : 'dsh-editor-project-index-progress-indeterminate'}
              style={{
                width: searchIndexHasKnownTotal ? `${searchIndexPercent}%` : '36%',
                height: '100%',
                background: 'var(--dsw-alias-state-business-primary)',
                transition: searchIndexHasKnownTotal ? 'width 120ms linear' : undefined,
              }}
            />
          </div>
        </div>
      ) : null}
      {uploadProgress === null || uploadProgress === undefined ? null : (
        <div
          style={{
            padding: '5px 8px',
            borderBottom: '1px solid var(--dsw-alias-separator-secondary, rgba(127,127,127,0.22))',
          }}>
          <div
            role='status'
            style={{
              color: 'var(--dsw-alias-label-secondary)',
              ...EDITOR_TEXT_STYLE.label,
              lineHeight: '16px',
              display: 'flex',
              gap: 6,
            }}>
            <span
              style={{
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
              {t('editor.uploadProgressCurrent', {
                name: uploadProgress.name,
                index: uploadProgress.index,
                count: uploadProgress.count,
                loaded: formatUploadBytes(uploadProgress.loaded),
                total: formatUploadBytes(uploadProgress.total),
              })}
            </span>
            <span
              style={{
                flex: '0 0 auto',
              }}>{`${progressPercent}%`}</span>
            <button
              type='button'
              data-dsh-upload-cancel=''
              aria-label={t('editor.uploadCancel')}
              title={t('editor.uploadCancel')}
              onClick={onCancelUpload}
              style={{
                flex: '0 0 auto',
                border: '1px solid var(--dsw-alias-separator-secondary, rgba(127,127,127,0.35))',
                background: 'transparent',
                color: 'inherit',
                borderRadius: 4,
                padding: '0 6px',
                font: 'inherit',
                cursor: 'pointer',
              }}>
              {t('editor.uploadCancel')}
            </button>
          </div>
          <div
            role='progressbar'
            aria-label={t('editor.uploadingItems', {
              count: uploadProgress.count,
            })}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
            style={{
              height: 2,
              marginTop: 3,
              background: 'var(--dsw-alias-bg-hover, rgba(127,127,127,0.18))',
              borderRadius: 2,
              overflow: 'hidden',
            }}>
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: 'var(--dsw-alias-state-business-primary)',
                transition: 'width 120ms linear',
              }}
            />
          </div>
        </div>
      )}
      {searchOpen ? (
        <div style={styles.treeSearchRow}>
          <Icon
            name='search'
            size={POPUP_ICON_SIZE}
          />
          <input
            ref={searchRef}
            style={{
              ...styles.findInput,
              flex: '1 1 auto',
              width: 'auto',
            }}
            placeholder={t('editor.treeSearchPlaceholder')}
            value={search}
            aria-label={t('editor.treeSearch')}
            onFocus={() => {
              directSpeedSearchRef.current = '';
            }}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing === true) return;
              const keyAction = projectSpeedSearchKeyAction(event, hits.length);
              if (keyAction === null) return;
              event.preventDefault();
              if (keyAction === 'close') {
                closeTreeSearch();
              } else if (keyAction === 'next' || keyAction === 'previous') {
                const direction = keyAction;
                const targetPath = speedSearchTarget(visibleRows, search, selectedPath, direction);
                selectSearchHit(hits.find((row) => row.path === targetPath));
              } else {
                /* Enter opens the current hit, IDEA's speed-search behaviour —
             and "jumps" means opens it: selecting a row leaves the
             editor showing the previous file. */
                const hit = hits.find((row) => row.path === selectedPath) ?? hits[0];
                if (hit === undefined) return;
                selectVisibleRow(hit, {});
                /* Close the box so the opened file (or folder) owns the keyboard. */
                searchReturnSelectionRef.current = null;
                directSpeedSearchRef.current = '';
                clearTreeSearchState();
                setSearchOpen(false);
                /* Expand a CLOSED folder; an open one stays open (toggling would
             close it, the opposite of "jump to this directory"). */
                const action = revealInTree({
                  ...hit,
                  open: expanded.has(hit.path),
                });
                if (action === 'expand') onToggle(hit.path);
                else if (action === 'open') {
                  onOpen(hit.path);
                  /* Search rows synthesize their ancestor chain. Once the box
                     closes that chain disappears, so reveal the real file or the
                     tree would fall back to its nearest collapsed ancestor. */
                  onRevealPath?.(hit.path);
                }
                /* Hand the keyboard back to the tree: the search box is gone, and
             leaving focus on a detached input strands the arrow keys. */
                window.setTimeout(() => treeRef.current?.focus(), 0);
              }
            }}
          />
          <ToolbarButton
            icon='close'
            label={t('editor.treeSearchClose')}
            onClick={closeTreeSearch}
          />
        </div>
      ) : null}
      {createState !== null ? (
        <div style={styles.createRow}>
          <Icon
            name={createState.kind === 'directory' ? 'newFolder' : 'newFile'}
            size={14}
          />
          <input
            ref={createInputRef}
            style={styles.createInput}
            value={createState.value}
            placeholder={createState.kind === 'directory' ? t('editor.newFolder') : t('editor.newFile')}
            autoFocus={true}
            onChange={(event) => onCreateChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing === true) return;
              if (event.key === 'Enter') {
                event.preventDefault();
                onCreateCommit();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                onCreateCancel();
                window.setTimeout(() => treeRef.current?.focus(), 0);
              }
            }}
          />
          <select
            style={styles.createParentSelect}
            value={createParent}
            aria-label={t('editor.createIn')}
            title={t('editor.createIn')}
            onChange={(event) => onCreateParent(event.target.value)}>
            {directoryChoices.map((directory) => (
              <option
                key={directory.path === '' ? 'root' : directory.path}
                value={directory.path}>
                {directory.path === '' ? projectName : directory.path}
              </option>
            ))}
          </select>
          {
            /* IDEA asks WHICH template before it creates a file; a checkbox is
         the cheapest honest version of that choice: on = the extension's
         skeleton, off = an empty file. Hidden for directories, which have
         no content to template. */
            createState.kind === 'file' && onCreateTemplate !== undefined ? (
              <button
                type='button'
                style={{
                  ...styles.createTemplateToggle,
                  ...(createState.template === false ? null : styles.createTemplateToggleOn),
                }}
                title={createState.template === false ? t('editor.templateOn') : t('editor.templateOff')}
                aria-pressed={createState.template !== false}
                onClick={() => onCreateTemplate(createState.template === false)}>
                {}
              </button>
            ) : null
          }
        </div>
      ) : null}
      <FileTreeView
        t={t}
        ariaLabel={t('editor.project')}
        rows={visibleRows}
        expanded={expanded}
        selection={selection}
        primaryPath={selectedPath}
        treeRef={treeRef}
        rowRefs={rowRefs}
        ariaBusy={uploadBusy || searchIndexRebuilding || searchIndexClearing || loading || searchPending}
        treeStyle={rootDropActive ? styles.treeRootDrop : undefined}
        treeDataAttributes={{
          'data-dsh-project-tree': '',
        }}
        statusContent={treeStatusContent}
        positionForRow={positionForProjectRow}
        openForRow={openProjectRow}
        decorateRow={decorateProjectRow}
        renderName={renderProjectRowName}
        renderInlineEditor={renderProjectRowInlineEditor}
        renderTrailing={renderProjectRowTrailing}
        onTreeKeyDown={(event) => {
          const editing = event.target instanceof Element && event.target.closest('input, textarea, select') !== null;
          if (
            editing === false &&
            event.nativeEvent.isComposing !== true &&
            event.key.length === 1 &&
            !event.metaKey &&
            !event.ctrlKey &&
            !event.altKey
          ) {
            event.preventDefault();
            event.stopPropagation();
            const nextSearch = directSpeedSearchRef.current + event.key;
            directSpeedSearchRef.current = nextSearch;
            setSearch(nextSearch);
            setSearchOpen(true);
            window.setTimeout(() => {
              searchRef.current?.focus();
              const input = searchRef.current;
              input?.setSelectionRange(input.value.length, input.value.length);
            }, 0);
            return;
          }
          if (event.key === 'ContextMenu' || (event.shiftKey === true && event.key === 'F10')) {
            event.preventDefault();
            event.stopPropagation();
            openSelectedContextMenuFromKeyboard();
            return;
          }
          onTreeKeyDown(event);
        }}
        onTreeContextMenu={(event) => {
          if (event.target instanceof Element && event.target.closest('.dsh-editor-tree-row') !== null) return;
          event.preventDefault();
          event.stopPropagation();
          treeRef.current?.focus();
          onRootContextMenu({
            x: event.clientX,
            y: event.clientY,
          });
        }}
        onTreeDragOver={(event) => {
          const externalFiles = dataTransferIncludesFiles(event.dataTransfer);
          const projectPaths = dataTransferIncludesProjectTreePaths(event.dataTransfer);
          if (!externalFiles && !projectPaths) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = externalFiles ? 'copy' : 'move';
          if (externalFiles) {
            setExternalDropPath('');
            setRootDropActive(true);
          } else if (sortMode !== 'manual') setRootDropActive(true);
        }}
        onTreeDragLeave={(event) => {
          if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
          setRootDropActive(false);
          setExternalDropPath(null);
        }}
        onTreeDrop={(event) => {
          const externalFiles = dataTransferIncludesFiles(event.dataTransfer);
          const sources = externalFiles ? [] : readProjectTreeDragPaths(event.dataTransfer);
          const overRow =
            event.target instanceof Element ? event.target.closest('.dsh-editor-tree-row') !== null : false;
          setRootDropActive(false);
          if (overRow) return;
          event.preventDefault();
          if (sources.length === 0) {
            setExternalDropPath(null);
            if (externalFiles) uploadExternalWorkspaceDrop(event, '');
            return;
          }
          if (sortMode !== 'manual') onDrop(sources, '');
        }}
        onRowPointerDown={(state, event) => {
          const { row } = state;
          if (event.button !== 0) return;
          if (event.target instanceof Element && event.target.closest('input') !== null) return;
          treeRef.current?.focus();
          selectVisibleRow(row, event);
        }}
        onRowClick={(state, event) => {
          const { row, isDirectory } = state;
          if (event.metaKey || event.ctrlKey || event.shiftKey) return;
          if (isDirectory) {
            if (row.root !== true && openDirectoriesSingleClick === true) onToggle(row.path);
          } else if (singleClickOpen === true) onOpenPreview(row.path);
        }}
        onRowDoubleClick={(state, event) => {
          const { row, isDirectory } = state;
          if (row.root) return;
          if (isDirectory && openDirectoriesSingleClick !== true) onToggle(row.path);
          else if (!isDirectory && singleClickOpen !== true) onOpenEditSource(row.path);
          event.stopPropagation();
        }}
        onRowContextMenu={(state, event) => {
          const { row } = state;
          event.preventDefault();
          event.stopPropagation();
          if (!selection.has(row.path)) selectVisibleRow(row, {});
          onContextMenu({
            row,
            x: event.clientX,
            y: event.clientY,
            selectionRows: search.trim() === '' ? undefined : visibleRows,
          });
        }}
        onToggleRow={(row) => {
          if (expanded.has(row.path)) {
            const primaryHidden = projectPrimaryHiddenByCollapse(row.path, selectedPath);
            const hiddenSelected = [...selection].some((path) => projectPrimaryHiddenByCollapse(row.path, path));
            if (primaryHidden || hiddenSelected) {
              const nextSelection = projectSelectionAfterDirectoryCollapse(selection, row.path, primaryHidden);
              const nextPrimary = primaryHidden || selectedPath === null ? row.path : selectedPath;
              if (onApplySelection !== undefined) onApplySelection(nextSelection, nextPrimary, nextPrimary);
              else if (primaryHidden) selectVisibleRow(row, {});
            }
          }
          onToggle(row.path);
        }}
      />
    </React.Fragment>
  );
}
export { ProjectPanel };
