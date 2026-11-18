import React from 'react';
import { styles } from '../../ui/styles';
import { EntryIcon } from '../ui/EntryIcon';
import { Icon } from '../ui/Icon';
import { ContextMenu } from '../ui/Menu';
import { PanelToolbar } from '../ui/PanelToolbar';
import { TreeMessage } from '../ui/TreeMessage';
import { projectContextMenuRowAfterKeyboard } from './project-selection-model';
import { copySearchResultText } from '../../commit';
import { basename, callFs, splitRootLabel } from '../../editor-core';
import { bindShiftWheelScroll, shouldShowTreeLoading } from '../../injected-css';
import {
  captureDroppedWorkspaceHandles,
  dataTransferIncludesFiles,
  formatUploadBytes,
  projectExternalDropDirectory,
  projectToolbarDropDirectory,
  uploadProgressPercent,
} from '../../project';
import {
  branchLabel,
  directoryTint,
  filterTreeRows,
  guideKind,
  highlightParts,
  projectCanExpandSelection,
  projectTreePosition,
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
type ProjectRow = Record<string, unknown> & {
  path: string;
  kind?: string;
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
  onSelect: ProjectCallback;
  onOpenCreateMenu: (event?: React.MouseEvent<HTMLElement>) => void;
  onOpenOptions: (event?: React.MouseEvent<HTMLElement>) => void;
  optionsOpen: boolean;
  onCreateChange: (value: string) => void;
  onCreateCommit: ProjectCallback;
  onCreateCancel: () => void;
  onReveal: ProjectCallback;
  onExpandSelected: () => void;
  onExpandAll: () => void;
  canCollapseAll: boolean;
  onCollapseAll: () => void;
  onNotify: (message: string) => void;
  onRefresh: () => void;
  onHide: () => void;
  rowRefs: React.RefObject<Map<string, HTMLElement>>;
  treeRef: React.RefObject<HTMLDivElement | null>;
  onTreeKeyDown: React.KeyboardEventHandler<HTMLDivElement>;
  onContextMenu: (payload: { row: ProjectRow; x: number; y: number }) => void;
  onRootContextMenu: (payload: { x: number; y: number }) => void;
  rootContextMenuOpen: boolean;
  onDrop: (sources: string[], destination: string) => void;
  onUpload: (handles: ProjectDropHandles, targetDirectory: string) => void;
  onCancelUpload: () => void;
  uploadBusy: boolean;
  uploadProgress: UploadProgress | null;
  showHidden: boolean;
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
  onSelect,
  onOpenCreateMenu,
  onOpenOptions,
  optionsOpen,
  onCreateChange,
  onCreateCommit,
  onCreateCancel,
  onReveal,
  onExpandSelected,
  canCollapseAll,
  onCollapseAll,
  onNotify,
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
  showHidden,
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
  const [search, setSearch] = React.useState('');
  const [viewMenu, setViewMenu] = React.useState(null);
  /* IDEA highlights the tree when a dragged row would land on the root. */
  const [rootDropActive, setRootDropActive] = React.useState(false);
  const [externalDropPath, setExternalDropPath] = React.useState(null);
  const [toolbarDropActive, setToolbarDropActive] = React.useState(false);
  const [manualDrop, setManualDrop] = React.useState(null);
  const uploadExternalWorkspaceDrop = (event, targetDirectory) => {
    const handles = captureDroppedWorkspaceHandles(event.dataTransfer);
    if (typeof onUpload === 'function') onUpload(handles, targetDirectory);
  };
  const toolbarDropDirectory = projectToolbarDropDirectory(projectRows, selectedPath);
  const handleToolbarDragOver = (event) => {
    if (!dataTransferIncludesFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    setToolbarDropActive(true);
  };
  const handleToolbarDragLeave = (event) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setToolbarDropActive(false);
  };
  const handleToolbarDrop = (event) => {
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
  const searchRequestRef = React.useRef(0);
  React.useEffect(() => bindShiftWheelScroll(treeRef.current), []);
  /* ⌘/Ctrl+F inside the tool window filters the tree in place, like IDEA. */
  React.useEffect(() => {
    const onKeyDown = (event) => {
      /* Shift+Cmd/Ctrl+F is IDEA's Find in Files. The Project speed search
         owns only the unshifted chord, even when focus is outside Monaco. */
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'f')
        return;
      const host = event.target instanceof Element ? event.target.closest('[data-dsh-editor-workspace]') : null;
      if (host === null) return;
      /* The editor owns ⌘F when its textarea has focus. */
      if (document.activeElement?.closest('.monaco-editor') != null) return;
      event.preventDefault();
      event.stopPropagation();
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
  const localRows = React.useMemo(() => filterTreeRows(rows, search), [rows, search]);
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
    const timer = window.setTimeout(() => {
      callFs({
        op: 'search',
        query,
        showHidden,
        showExcluded: showExcludedFiles,
        sort: sortMode,
        foldersFirst,
      })
        .then((value) => {
          if (searchRequestRef.current !== requestId) return;
          setSearchEntries(Array.isArray(value?.entries) ? value.entries : []);
          setSearchTruncated(value?.truncated === true);
          setSearchPending(false);
        })
        .catch((failure) => {
          if (searchRequestRef.current !== requestId) return;
          /* Keep the local filtered rows when the recursive walk fails; a
           transient host error must not blank a tree that is still usable. */
          setSearchEntries(null);
          setSearchPending(false);
          setSearchError(failure instanceof Error ? failure.message : String(failure));
          setSearchTruncated(false);
        });
    }, 160);
    return () => window.clearTimeout(timer);
  }, [filteredView, foldersFirst, search, showExcludedFiles, showHidden, sortMode]);
  const hits = React.useMemo(() => speedSearchHitRows(visibleRows, search), [search, visibleRows]);
  const selectSearchHit = React.useCallback(
    (row) => {
      if (row === null || row === undefined) return;
      onSelect(row, {});
      window.setTimeout(
        () =>
          rowRefs.current?.get(row.path)?.scrollIntoView?.({
            block: 'nearest',
          }),
        0,
      );
    },
    [onSelect, rowRefs],
  );
  /* IDEA's speed search moves the current row as soon as the query narrows
     to a hit; Enter then opens that row rather than some other first match. */
  React.useEffect(() => {
    if (search.trim() === '' || hits.length === 0) return;
    if (hits.some((row) => row.path === selectedPath)) return;
    selectSearchHit(hits[0]);
  }, [hits, search, selectedPath, selectSearchHit]);
  const closeTreeSearch = () => {
    setSearch('');
    setSearchOpen(false);
    window.setTimeout(() => treeRef.current?.focus(), 0);
  };
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
    onSelect(selected, {});
    onContextMenu({
      row: selected,
      x,
      y,
    });
  };
  const gitChanges = new Map((git?.changes ?? []).map((change) => [change.path, change.status]));
  /**
   * Aggregate one directory's git state from everything below it.
   *
   * The order is IDEA's precedence: a conflict outranks a deletion, which
   * outranks an addition, which outranks a rename, which outranks a plain
   * modification. The row shows a badge even while the directory is
   * collapsed — that is the only place the state is visible then.
   * @param {string} path - workspace-relative directory path.
   * @returns {{label: string, color: string}|null} badge, or null when clean.
   */
  const directoryStatus = (path) =>
    directoryTint((git?.changes ?? []).filter((change) => change.path.startsWith(`${path}/`)));
  const createParent = createState === null ? '' : createState.parent;
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
  const viewDefinitions = projectViewDefinitions(t);
  const currentViewLabel =
    viewDefinitions.find((definition) => definition.id === projectView)?.label ?? t('editor.projectViewProjectFiles');
  return (
    <React.Fragment>
      {viewMenu === null ? null : (
        <ContextMenu
          menu={viewMenu}
          onClose={() => setViewMenu(null)}
          t={t}
        />
      )}
      <PanelToolbar
        t={t}
        ariaLabel={t('editor.project')}
        icon='project'
        title={t('editor.project')}
        titleActionStyle={{
          maxWidth: '68%',
        }}
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
              title={root}
              aria-label={t('editor.copyProjectPath')}
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
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                setViewMenu({
                  x: Math.max(4, rect.left - 4),
                  y: rect.bottom + 4,
                  title: t('editor.projectViewMenu'),
                  items: viewDefinitions.map((definition) => ({
                    id: `project-view:${definition.id}`,
                    label: definition.label,
                    shortcut: definition.id === projectView ? '✓' : '',
                    disabled: definition.available !== true,
                    run: () => onProjectViewChange(definition.id),
                  })),
                });
              }}>
              <Icon
                name='chevronDown'
                size={10}
              />
            </button>
          </span>
        }
        left={[
          /* IDEA keeps the creation entry and "Select Opened File" visible.
       Navigation popups remain reachable from Options below. */
          {
            id: 'newEntry',
            group: 'create',
            icon: 'newFile',
            label: t('editor.newFileOrDirectory'),
            onClick: onOpenCreateMenu,
          },
          {
            id: 'reveal',
            group: 'navigation',
            icon: 'target',
            label: t('editor.reveal'),
            /* IDEA keeps Select Opened File in the direct Project toolbar;
         unlike New/Expand/Collapse it must not disappear first when the
         tool window narrows. */
            pinned: true,
            disabled: hasActiveFile !== true,
            ariaKeyShortcuts: 'Alt+F1 1',
            onClick: onReveal,
          },
        ]}
        right={[
          {
            id: 'expandSelected',
            group: 'navigation',
            icon: 'expand',
            label: t('editor.revealSelected'),
            disabled: !projectCanExpandSelection(rows, selection) || supportsExpansion !== true,
            onClick: onExpandSelected,
          },
          {
            id: 'collapse',
            group: 'navigation',
            icon: 'collapse',
            label: t('editor.collapseAll'),
            disabled: !canCollapseAll || supportsExpansion !== true,
            onClick: onCollapseAll,
          },
          {
            id: 'options',
            group: 'window',
            icon: 'settings',
            label: t('editor.options'),
            ariaHasPopup: 'menu',
            ariaExpanded: optionsOpen === true,
            onClick: onOpenOptions,
          },
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
              fontSize: 11,
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
            size={12}
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
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                closeTreeSearch();
              } else if (hits.length > 0 && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
                event.preventDefault();
                const direction = event.key === 'ArrowDown' ? 'next' : 'previous';
                const targetPath = speedSearchTarget(visibleRows, search, selectedPath, direction);
                selectSearchHit(hits.find((row) => row.path === targetPath));
              } else if (event.key === 'Enter') {
                /* Enter opens the current hit, IDEA's speed-search behaviour —
             and "jumps" means opens it: selecting a row leaves the
             editor showing the previous file. */
                event.preventDefault();
                const hit = hits.find((row) => row.path === selectedPath) ?? hits[0];
                if (hit === undefined) return;
                onSelect(hit, {});
                /* Close the box so the opened file (or folder) owns the keyboard. */
                setSearch('');
                setSearchOpen(false);
                /* Expand a CLOSED folder; an open one stays open (toggling would
             close it, the opposite of "jump to this directory"). */
                const action = revealInTree({
                  ...hit,
                  open: expanded.has(hit.path),
                });
                if (action === 'expand') onToggle(hit.path);
                else if (action === 'open') onOpen(hit.path);
                /* Hand the keyboard back to the tree: the search box is gone, and
             leaving focus on a detached input strands the arrow keys. */
                window.setTimeout(() => treeRef.current?.focus(), 0);
              }
            }}
          />
          <button
            type='button'
            style={styles.conflictAction}
            onClick={closeTreeSearch}>
            ×
          </button>
        </div>
      ) : null}
      {createState !== null ? (
        <div style={styles.createRow}>
          <Icon
            name={createState.kind === 'directory' ? 'newFolder' : 'newFile'}
            size={14}
          />
          <input
            style={styles.createInput}
            value={createState.value}
            placeholder={createState.kind === 'directory' ? t('editor.newFolder') : t('editor.newFile')}
            autoFocus={true}
            onChange={(event) => onCreateChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onCreateCommit();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                onCreateCancel();
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
      <div
        className='dsh-editor-tool-scroll'
        ref={treeRef}
        tabIndex={0}
        style={{
          ...styles.treeScroll,
          ...(rootDropActive ? styles.treeRootDrop : null),
        }}
        onKeyDown={(event) => {
          if (event.key === 'ContextMenu' || (event.shiftKey === true && event.key === 'F10')) {
            event.preventDefault();
            event.stopPropagation();
            openSelectedContextMenuFromKeyboard();
            return;
          }
          onTreeKeyDown(event);
        }}
        onContextMenu={(event) => {
          if (event.target instanceof Element && event.target.closest('.dsh-editor-tree-row') !== null) return;
          event.preventDefault();
          event.stopPropagation();
          treeRef.current?.focus();
          onRootContextMenu({
            x: event.clientX,
            y: event.clientY,
          });
        }}
        role='tree'
        aria-label={t('editor.project')}
        aria-busy={uploadBusy ? 'true' : undefined}
        onDragOver={(event) => {
          const externalFiles = dataTransferIncludesFiles(event.dataTransfer);
          if (!externalFiles && !event.dataTransfer?.types?.includes('text/plain')) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = externalFiles ? 'copy' : 'move';
          if (externalFiles) {
            setExternalDropPath('');
            setRootDropActive(true);
          } else if (sortMode !== 'manual') setRootDropActive(true);
        }}
        onDragLeave={(event) => {
          if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
          setRootDropActive(false);
          setExternalDropPath(null);
        }}
        onDrop={(event) => {
          const externalFiles = dataTransferIncludesFiles(event.dataTransfer);
          const raw = externalFiles ? '' : (event.dataTransfer?.getData('text/plain') ?? '');
          const sources = raw.split('\n').filter((entry) => entry !== '');
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
        }}>
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
            {error}
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
        {treeSearchMiss({
          query: search,
          rows: visibleRows,
          loading: searchPending,
        }) ? (
          <TreeMessage state='no-matches'>{t('editor.noMatches')}</TreeMessage>
        ) : null}
        {searchTruncated ? <TreeMessage state='truncated'>{t('editor.treeSearchTruncated')}</TreeMessage> : null}
        {visibleRows.map((row, rowIndex) => {
          if (row.kind === 'placeholder') {
            return (
              <div
                key={row.path}
                className='dsh-editor-tree-row dsh-editor-tree-row-placeholder'
                data-dsh-placeholder={row.path}
                style={{
                  ...styles.treeRow,
                  paddingLeft: 8 + row.depth * 14,
                  color: 'var(--dsw-alias-label-tertiary)',
                  fontStyle: 'italic',
                  cursor: 'default',
                }}>
                {t('editor.emptyDirectory')}
              </div>
            );
          }
          const selected = selection.has(row.path);
          const primary = row.path === selectedPath;
          const status = gitChanges.get(row.path);
          const isDirectory = row.kind === 'directory';
          const open = row.searchOpen === true || expanded.has(row.path);
          const projectRowPosition = projectTreePosition(visibleRows, rowIndex);
          return (
            <div
              key={row.path === '' ? '__root__' : row.path}
              ref={(element) => {
                if (element !== null) rowRefs.current.set(row.path, element);
                else rowRefs.current.delete(row.path);
              }}
              className={
                selected
                  ? primary
                    ? 'dsh-editor-tree-row dsh-editor-tree-row-selected'
                    : 'dsh-editor-tree-row dsh-editor-tree-row-selected dsh-editor-tree-row-extended'
                  : 'dsh-editor-tree-row'
              }
              style={{
                ...styles.treeRow,
                ...(selected ? (primary ? styles.treeRowSelected : styles.treeRowSelectedSoft) : null),
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
              }}
              title={row.path === '' ? root : row.path}
              role='treeitem'
              aria-level={projectRowPosition.level}
              aria-posinset={projectRowPosition.posinset}
              aria-setsize={projectRowPosition.setsize}
              aria-expanded={isDirectory ? open : undefined}
              aria-selected={selected}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey) return;
                if (isDirectory) {
                  if (row.root !== true && openDirectoriesSingleClick === true) onToggle(row.path);
                } else if (singleClickOpen === true) onOpenPreview(row.path);
              }}
              onMouseDown={(event) => {
                if (event.button !== 0) return;
                if (event.target instanceof Element && event.target.closest('input') !== null) return;
                treeRef.current?.focus();
                onSelect(row, event);
              }}
              onDoubleClick={(event) => {
                if (row.root) return;
                if (isDirectory && openDirectoriesSingleClick !== true) onToggle(row.path);
                else if (!isDirectory && singleClickOpen !== true) onOpenEditSource(row.path);
                /* Keep the second click from toggling the directory back. */
                event.stopPropagation();
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                /* Right-clicking outside the selection moves it; inside it acts on all rows. */
                if (!selection.has(row.path)) onSelect(row, {});
                onContextMenu({
                  row,
                  x: event.clientX,
                  y: event.clientY,
                });
              }}
              draggable={!row.root}
              onDragStart={(event) => {
                /* Dragging a row inside a multi-row selection moves the whole selection. */
                const payload =
                  selection.has(row.path) && selection.size > 1
                    ? rows.filter((entry) => selection.has(entry.path) && entry.path !== '').map((entry) => entry.path)
                    : [row.path];
                event.dataTransfer?.setData('text/plain', payload.join('\n'));
                event.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => {
                setManualDrop(null);
                setRootDropActive(false);
                setExternalDropPath(null);
              }}
              onDragOver={(event) => {
                if (dataTransferIncludesFiles(event.dataTransfer)) {
                  event.preventDefault();
                  event.stopPropagation();
                  const targetDirectory = projectExternalDropDirectory(row);
                  event.dataTransfer.dropEffect = 'copy';
                  setManualDrop(null);
                  setExternalDropPath(targetDirectory);
                  return;
                }
                if (!event.dataTransfer?.types?.includes('text/plain')) return;
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
                if (!isDirectory) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
              }}
              onDragLeave={(event) => {
                if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
                if (manualDrop?.path === row.path) setManualDrop(null);
                if (externalDropPath !== null) setExternalDropPath(null);
              }}
              onDrop={(event) => {
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
                  const sources = (event.dataTransfer?.getData('text/plain') ?? '')
                    .split('\n')
                    .filter((entry) => entry !== '');
                  const edge = manualDrop?.path === row.path ? manualDrop.edge : 'before';
                  setManualDrop(null);
                  if (sources.length > 0) onManualReorder(sources, row.path, edge);
                  return;
                }
                if (!isDirectory) return;
                event.preventDefault();
                /* One path per line: the drop handler moves each of them. */
                const sources = (event.dataTransfer?.getData('text/plain') ?? '')
                  .split('\n')
                  .filter((entry) => entry !== '');
                if (sources.length === 0 || sources.includes(row.path)) return;
                onDrop(sources, row.path);
              }}>
              {
                /* Indentation FIRST, then the chevron: with the guides after it every
             row's arrow sat at the same left edge, so a nested folder looked like a
             sibling and the hierarchy only showed as trailing whitespace. */
                row.depth > 0
                  ? Array.from(
                      {
                        length: row.depth,
                      },
                      (_, index) => {
                        const kind = guideKind({
                          continues: row.continues,
                          index,
                          depth: row.depth,
                        });
                        return (
                          <span
                            key={index}
                            style={kind === 'line' ? styles.indentGuide : styles.indentGuideStop}
                          />
                        );
                      },
                    )
                  : null
              }
              {row.root ? null : isDirectory ? (
                <span
                  style={{
                    ...styles.chevron,
                    color: selected ? '#fff' : 'var(--dsw-alias-label-tertiary)',
                  }}
                  role='button'
                  tabIndex={-1}
                  aria-label={open ? t('editor.collapseFolder') : t('editor.expandFolder')}
                  title={open ? t('editor.collapseFolder') : t('editor.expandFolder')}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggle(row.path);
                  }}>
                  <Icon
                    name={open ? 'chevronDown' : 'chevronRight'}
                    size={10}
                  />
                </span> /* Files keep the column so their icon lines up with sibling folders. */
              ) : (
                <span
                  style={{
                    ...styles.chevron,
                    opacity: 0,
                  }}
                />
              )}
              <EntryIcon
                entry={row}
                expanded={open}
              />
              {renameState !== null && renameState.path === row.path ? (
                <input
                  style={styles.renameInput}
                  value={renameState.value}
                  autoFocus={true}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => onRenameChange(event.target.value)}
                  onBlur={() => onRenameCommit()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      onRenameCommit();
                    } else if (event.key === 'Escape') {
                      event.preventDefault();
                      onRenameCancel();
                    }
                  }}
                />
              ) : (
                <span
                  style={{
                    ...styles.treeName,
                    ...(row.root ? styles.treeRootName : null),
                    /* The root's folder name is the part that identifies the
               project; only the path beside it may be truncated. */
                    ...(row.root ? styles.treeRootLabel : null),
                    ...(selected
                      ? {
                          color: '#fff',
                        }
                      : null),
                    /* Files and folders alike: a change tints the name, never a letter. */
                    ...(treeNameColor({
                      status,
                      selected,
                    }) === null
                      ? null
                      : {
                          color: treeNameColor({
                            status,
                            selected,
                          }),
                        }),
                    ...(isDirectory && !selected && status === undefined && directoryStatus(row.path) !== null
                      ? {
                          color: directoryStatus(row.path).color,
                        }
                      : null),
                    /* IDEA strikes through a file that vanished from disk. */
                    ...(deletedPaths?.has?.(row.path)
                      ? {
                          textDecoration: 'line-through',
                          opacity: 0.6,
                        }
                      : null),
                    /* A file created outside the editor is tinted once, like IDEA's "new" hint. */
                    ...(newPaths?.has?.(row.path)
                      ? {
                          color: '#1a7f37',
                        }
                      : null),
                  }}>
                  {
                    /* Speed search underlines what matched; the rest keeps its colour. */
                    search.trim() === ''
                      ? row.name
                      : highlightParts(row.name, search).map((part, index) =>
                          part.match ? (
                            <span
                              key={index}
                              style={styles.treeNameMatch}>
                              {part.text}
                            </span>
                          ) : (
                            <span key={index}>{part.text}</span>
                          ),
                        )
                  }
                </span>
              )}
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
                    left: 8 + row.depth * 14 + 18,
                    right: 8,
                    bottom: 0,
                    height: 2,
                    borderRadius: 2,
                    background: 'var(--dsw-alias-state-business-primary)',
                    pointerEvents: 'none',
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </React.Fragment>
  );
}
export { ProjectPanel };
