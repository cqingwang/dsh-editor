import React from 'react';
import { styles } from '../../ui/styles';
import { commitRetryControlState } from '../../commit';
import { selectionStateOf, subtotalOf } from '../ui/commit-model';
import { CompactActionBar } from '../ui/CompactActionBar';
import { ContextMenu } from '../ui/Menu';
import { EntryIcon } from '../ui/EntryIcon';
import { focusSurfaceWhenReady } from '../ui/focus-surface';
import { pathsScheduledForRemoval } from '../ui/git-change-model';
import { Icon } from '../ui/Icon';
import { LineCounts } from '../ui/LineCounts';
import { PanelToolbar } from '../ui/PanelToolbar';
import { ToolbarButton } from '../ui/ToolbarButton';
import {
  changeFilterTargets,
  changeTreeOf,
  collapseKeysOf,
  cycleChangeTarget,
  diffNavigationEntries,
  type DiffChange,
  type DiffRow,
  type DiffTreeNode,
  filterChanges,
  flattenChangeTree,
  groupingDepth,
  isConflict,
  splitChanges,
  stageAllTargets,
} from '../../diff';
import type { DiffTarget } from '../diff/DiffPreview';
import { parentDirLabel } from '../../editor-core';
import { bindShiftWheelScroll } from '../../injected-css';
import { branchLabel } from '../../terminal';
import { CommitLog } from './CommitLog';
import type { CommitLogSearchController } from './use-commit-log-search';

type Translate = (key: string, params?: Record<string, unknown>) => string;
type CommitLogComponentProps = React.ComponentProps<typeof CommitLog>;
type CommitMode = 'changes' | 'log';
interface CommitGroup {
  id: string;
  label: string;
  changes: DiffChange[];
}

/**
 * IDEA disables Shelve when there is no selected change to shelve.
 * @param changeCount - selected changes available to the action.
 * @param busy - whether the Commit tool window is already writing.
 * @param onShelve - shelf menu opener supplied by the workspace.
 * @returns whether the toolbar action must stay disabled.
 */
export function commitShelveActionDisabled(changeCount: number, busy: boolean, onShelve: unknown): boolean {
  return changeCount === 0 || busy === true || typeof onShelve !== 'function';
}

/** Muted parent path shared by directory and file rows in the Change tree. */
function CommitSecondaryPath({ text }: { text?: string }) {
  const value = typeof text === 'string' ? text : '';
  return (
    <span
      className='dsh-editor-commit-path-suffix'
      style={styles.commitFileDir}
      title={value === '' ? undefined : value}>
      <span
        className='dsh-editor-commit-path-suffix-text'
        style={styles.commitFileDirText}>
        {value}
      </span>
    </span>
  );
}

export interface CommitPanelProps {
  t: Translate;
  git:
    | {
        changes?: DiffChange[];
        isRepo?: boolean;
        detached?: boolean;
        ahead?: number;
        behind?: number;
        operation?: string;
        lastCommit?: { subject?: string } | null;
      }
    | null
    | undefined;
  selectedPaths: Set<string>;
  message: string;
  amend: boolean;
  busy: boolean;
  networkBusy?: boolean;
  workingTreeBusy?: boolean;
  error: string | null;
  onRetryStatus?: () => void;
  notice: string | null;
  diffTarget: DiffTarget | null;
  selectedChange: DiffTarget | null;
  selectedGroup: string | null;
  selectedChanges: Set<string>;
  chosenChangeList?: DiffTarget[];
  collapsedGroups: Set<string>;
  monacoReady: boolean;
  onTogglePath: (path: string) => void;
  onToggleGroup: (group: string) => void;
  onToggleDirectory: (path: string | string[] | undefined) => void;
  onSelectChange: (target: DiffTarget | null) => void;
  onSelectGroup: (group: string | null) => void;
  onSelectDiff: (target: DiffTarget) => void;
  onShowDiff: (target: DiffTarget) => void;
  onShowCombinedDiff?: (targets: DiffTarget[]) => void;
  onRollbackSelected?: (targets: DiffTarget[]) => void;
  onRollbackGroup?: (group: string, paths: string[]) => void;
  onSelectOpenedChange?: () => void;
  onExpandChanges?: () => void;
  onCollapseChanges?: () => void;
  onChangesKeyDown?: (event: React.KeyboardEvent<HTMLElement>) => void;
  onChangesKeyUp?: (event: React.KeyboardEvent<HTMLElement>) => void;
  changeRowRefs: React.RefObject<Map<string, HTMLElement>>;
  onStage: (paths: string[]) => void;
  onStageAllTracked?: () => void;
  onUnstage: (paths: string[]) => void;
  onGitignore: (paths: string[]) => void;
  onCopyPatch?: (targets: DiffTarget[]) => void;
  onCreatePatch?: (targets: DiffTarget[]) => void;
  onShelve?: (position: { x: number; y: number }) => void;
  onContextMenu?: (payload: {
    directory?: string;
    change?: DiffChange;
    staged?: boolean;
    selectedChanges?: Set<string>;
    changes?: DiffChange[];
    group?: string;
    x: number;
    y: number;
  }) => void;
  mode: 'changes' | 'log';
  onMode: (mode: 'changes' | 'log') => void;
  scrollRefs?: {
    changes?: React.RefObject<HTMLDivElement | null>;
    log?: React.RefObject<HTMLDivElement | null>;
  };
  onRestoreScroll?: (...args: unknown[]) => void;
  commits: CommitLogComponentProps['commits'];
  logLoading: boolean;
  logDetail: CommitLogComponentProps['detail'];
  onLoadLog: () => void;
  onSelectCommit: (hash: string) => void;
  onOpenFile?: CommitLogComponentProps['onOpenFile'];
  onEditSource?: CommitLogComponentProps['onEditSource'];
  historyPath: string | null;
  onShowCommitDiff?: CommitLogComponentProps['onShowCommitDiff'];
  onClearHistory?: () => void;
  logAuthor: string;
  onLogAuthor: (value: string) => void;
  logSearch?: CommitLogSearchController;
  onLoadMoreLog?: () => void;
  logExhausted: boolean;
  onLogContextMenu?: CommitLogComponentProps['onContextMenu'];
  onDirectoryMenu?: CommitLogComponentProps['onDirectoryMenu'];
  highlightedCommit: string | null;
  graph: CommitLogComponentProps['graph'];
  onLoadGraph?: CommitLogComponentProps['onLoadGraph'];
  onGraphBranch?: CommitLogComponentProps['onGraphBranch'];
  onGraphRef?: CommitLogComponentProps['onGraphRef'];
  selected: string | null;
  selectedCommits: string[];
  onSelectCommits: (hashes: string[]) => void;
  logFailure: string | null;
  onRetry?: () => void;
  onFileMenu?: CommitLogComponentProps['onFileMenu'];
  onFindInFiles?: () => void;
  onMessage: (value: string) => void;
  history: string[];
  onRecall: (delta: number) => void;
  onPickHistory: (index: number) => void;
  onAmend: (value: boolean) => void;
  onCommit: (push: boolean) => void;
  onRefresh: () => void;
  onHide: () => void;
  projectName: string;
  onBranchMenu?: (position?: { x: number; y: number }) => void;
  branchMenuOpen?: boolean;
  templates?: string[];
  onTemplate?: (prefix: string) => void;
  identityMissing?: boolean;
  pushFailure?: string | null;
  onPush?: () => void;
  retryingStatus?: boolean;
  undoMessage?: string;
  onUndoMessage?: () => void;
  pushing?: boolean;
  groupBy: string;
  onOptionsMenu?: (position: { x: number; y: number }) => void;
  optionsOpen?: boolean;
  onViewOptionsMenu?: (position: { x: number; y: number }) => void;
  viewOptionsOpen?: boolean;
  pathQuery: string;
  onPathQuery: (value: string) => void;
  onRevealChange: (target: DiffTarget) => void;
}

function CommitPanel({
  t,
  git,
  selectedPaths,
  message,
  amend,
  busy,
  networkBusy = false,
  workingTreeBusy = false,
  error,
  onRetryStatus,
  notice,
  diffTarget,
  selectedChange,
  selectedGroup,
  selectedChanges,
  chosenChangeList = [],
  collapsedGroups,
  onTogglePath,
  onToggleGroup,
  onToggleDirectory,
  onSelectChange,
  onSelectGroup,
  onSelectDiff,
  onShowDiff,
  onShowCombinedDiff,
  onRollbackSelected,
  onRollbackGroup,
  onSelectOpenedChange,
  onExpandChanges,
  onCollapseChanges,
  onChangesKeyDown,
  onChangesKeyUp,
  changeRowRefs,
  onStage,
  onStageAllTracked,
  onUnstage,
  onGitignore,
  onCopyPatch,
  onCreatePatch,
  onShelve,
  onContextMenu,
  mode,
  onMode,
  scrollRefs,
  commits,
  logLoading,
  logDetail,
  onLoadLog,
  onSelectCommit,
  onOpenFile,
  onEditSource,
  historyPath,
  onShowCommitDiff,
  onClearHistory,
  logAuthor,
  onLogAuthor,
  logSearch,
  onLoadMoreLog,
  logExhausted,
  onLogContextMenu,
  onDirectoryMenu,
  highlightedCommit,
  graph,
  onLoadGraph,
  onGraphBranch,
  onGraphRef,
  selected,
  selectedCommits,
  onSelectCommits,
  logFailure,
  onRetry,
  onFileMenu,
  onFindInFiles,
  onMessage,
  history,
  onRecall,
  onPickHistory,
  onAmend,
  onCommit,
  onRefresh,
  onHide,
  projectName,
  onBranchMenu,
  branchMenuOpen,
  templates = [],
  onTemplate,
  identityMissing = false,
  pushFailure = null,
  onPush,
  retryingStatus = false,
  undoMessage = '',
  onUndoMessage,
  pushing = false,
  groupBy = 'directory',
  onOptionsMenu,
  optionsOpen,
  onViewOptionsMenu,
  viewOptionsOpen,
  pathQuery = '',
  onPathQuery,
  onRevealChange,
}: CommitPanelProps) {
  const [historyMenu, setHistoryMenu] = React.useState(null);
  const [groupActionMenu, setGroupActionMenu] = React.useState(null);
  const commitMessageRef = React.useRef(null);
  const changeFilterRef = React.useRef(null);
  const commitModeTabsRef = React.useRef(null);
  React.useEffect(() => {
    if (mode !== 'changes') return undefined;
    return bindShiftWheelScroll(scrollRefs?.changes?.current);
  }, [mode]);
  /* IDEA's tool window owns ⌘F while its Changes pane has focus. The editor
     find listener yields this subtree so the key cannot open a Monaco find
     bar behind the diff/tool window. */
  React.useEffect(() => {
    if (mode !== 'changes') return undefined;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== 'f') return;
      const target = event.target instanceof Element ? event.target : null;
      const active = document.activeElement instanceof Element ? document.activeElement : null;
      const panel = target?.closest('[data-dsh-changes-panel]') ?? active?.closest('[data-dsh-changes-panel]');
      if (panel === null || panel === undefined) return;
      event.preventDefault();
      event.stopPropagation();
      changeFilterRef.current?.focus();
      changeFilterRef.current?.select();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [mode]);
  const changes = React.useMemo(() => (Array.isArray(git?.changes) ? git.changes : []), [git?.changes]);
  const gitNotManaged = git?.isRepo === false;
  const statusRetryControl = commitRetryControlState(false, retryingStatus);
  const pushRetryControl = commitRetryControlState(busy === true || networkBusy === true || gitNotManaged, pushing);
  const changesByPath = React.useMemo(() => new Map(changes.map((change) => [change.path, change])), [changes]);
  const stageAllTrackedPaths = React.useMemo(() => stageAllTargets(changes, true), [changes]);
  const changeSplit = React.useMemo(() => splitChanges(changes), [changes]);
  const { staged, unstaged, unversioned } = changeSplit;
  const groups = React.useMemo(
    () =>
      [
        {
          id: 'staged',
          label: t('editor.stagedGroup'),
          changes: staged,
        },
        {
          id: 'unstaged',
          label: t('editor.unstagedGroup'),
          changes: unstaged,
        },
        {
          id: 'unversioned',
          label: t('editor.unversionedGroup'),
          changes: unversioned,
        },
      ].filter((group) => group.changes.length > 0 || group.id !== 'unversioned'),
    [staged, t, unversioned, unstaged],
  );
  /* IDEA's change-list search narrows what is SHOWN, never what is ticked:
     filtering the selection too would quietly change what gets committed. */
  const visibleGroups = React.useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          changes: filterChanges(group.changes, pathQuery),
        }))
        .filter((group) => group.changes.length > 0 || pathQuery === ''),
    [groups, pathQuery],
  );
  const filteredTargets = React.useMemo(() => changeFilterTargets(visibleGroups), [visibleGroups]);
  /**
   * Sum one band's line counts for the group header, IDEA's `+12 −3`.
   *
   * Binary rows contribute nothing (they have no numbers), and a band with
   * no readings at all stays blank rather than claiming zero changes.
   * @param {{id: string, changes: object[]}} group - band being rendered.
   * @returns {object|undefined} summed counts, or undefined when unknown.
   */
  const groupTotals = (group: CommitGroup): ReturnType<typeof subtotalOf> => subtotalOf(group.changes, group.id);
  const groupTrees = React.useMemo(() => {
    const trees = new Map<string, DiffTreeNode>();
    visibleGroups.forEach((group) => {
      trees.set(group.id, changeTreeOf(group.changes, groupingDepth(groupBy)));
    });
    return trees;
  }, [groupBy, visibleGroups]);
  const groupRows = React.useMemo(() => {
    const views = new Map<
      string,
      {
        groupOpen: boolean;
        rows: DiffRow[];
        total: ReturnType<typeof subtotalOf>;
      }
    >();
    visibleGroups.forEach((group) => {
      const tree = groupTrees.get(group.id);
      if (tree === undefined) return;
      const groupOpen = !collapsedGroups.has(`${group.id}:`);
      views.set(group.id, {
        groupOpen,
        rows: groupOpen ? flattenChangeTree(tree, collapsedGroups, group.id) : [],
        total: groupTotals(group),
      });
    });
    return views;
  }, [collapsedGroups, groupTrees, visibleGroups]);
  const groupSelectionViews = React.useMemo(() => {
    const views = new Map<
      string,
      {
        selectedInGroup: string[];
        groupState: ReturnType<typeof selectionStateOf>;
        removableInGroup: string[];
        removalOnlyInGroup: boolean;
      }
    >();
    visibleGroups.forEach((group) => {
      const selectedInGroup = group.changes
        .filter((change) => selectedPaths.has(change.path))
        .map((change) => change.path);
      const groupState = selectionStateOf(
        group.changes.map((change) => change.path),
        selectedPaths,
      );
      const removableInGroup =
        group.id === 'unstaged'
          ? pathsScheduledForRemoval(
              selectedInGroup.map((path) => ({
                path,
                staged: false,
              })),
              changesByPath,
            )
          : [];
      views.set(group.id, {
        selectedInGroup,
        groupState,
        removableInGroup,
        removalOnlyInGroup: selectedInGroup.length > 0 && removableInGroup.length === selectedInGroup.length,
      });
    });
    return views;
  }, [changesByPath, selectedPaths, visibleGroups]);
  /* Typing in the Changes filter must move the current row onto a visible
     target. Leaving it on a filtered-out row made Show Diff, Stage and
     Rollback act on an item the user could no longer see. */
  React.useEffect(() => {
    if (pathQuery.trim() === '') return;
    if (filteredTargets.length === 0) {
      if (selectedGroup !== null) onSelectGroup?.(null);
      return;
    }
    const selectedVisible = filteredTargets.some(
      (target) => target.path === selectedChange?.path && target.staged === (selectedChange?.staged === true),
    );
    if (selectedVisible) return;
    onRevealChange?.(filteredTargets[0]);
    onSelectChange?.({
      path: filteredTargets[0].path,
      staged: filteredTargets[0].staged,
    });
  }, [filteredTargets, onRevealChange, onSelectChange, onSelectGroup, pathQuery, selectedChange, selectedGroup]);
  const allSelected = React.useMemo(
    () => changes.length > 0 && changes.every((change) => selectedPaths.has(change.path)),
    [changes, selectedPaths],
  );
  const branchText = branchLabel(git);
  const fileCountText = (count: number): string =>
    count === 1
      ? '1 file'
      : t('editor.filesCount', {
          count,
        });
  /* A detached HEAD cannot be pushed or updated; say why in the toolbar too. */
  const detached = git?.detached === true;
  const ahead = git?.ahead ?? 0;
  const behind = git?.behind ?? 0;

  /**
   * Clear the Changes path filter and return keyboard ownership to the tree.
   *
   * Clearing a focused filter leaves focus on an input that no longer has a
   * useful role. Prefer the selected change row; if filtering removed it,
   * fall back to the Changes tree container.
   * @returns {void}
   */
  const clearChangeFilter = () => {
    onPathQuery?.('');
    const key =
      selectedChange === null
        ? null
        : `${selectedChange.staged === true ? 'staged' : 'unstaged'}:${selectedChange.path}`;
    const tree = scrollRefs?.changes?.current ?? null;
    focusSurfaceWhenReady(() => (key === null ? null : (changeRowRefs?.current?.get(key) ?? null)), {
      maxAttempts: 60,
      fallbackSurface: () => tree,
    });
  };
  const renderGroup = (group: CommitGroup, groupIndex: number): React.ReactNode => {
    const tree = groupTrees.get(group.id);
    if (tree === undefined) return null;
    /* A group folds as a whole, keyed by the bare group id: IDEA's root row
       ("Changes 5 files") is a tree node with its own chevron, and folding it
       leaves just that row. Directory keys stay `<group>:<path>`, so a group
       key can never collide with one of its own children. */
    const groupKey = `${group.id}:`;
    const groupView = groupRows.get(group.id);
    const groupOpen = groupView?.groupOpen ?? !collapsedGroups.has(groupKey);
    const rows = groupView?.rows ?? [];
    const groupSelection = groupSelectionViews.get(group.id);
    if (groupSelection === undefined) return null;
    const { selectedInGroup, groupState, removableInGroup, removalOnlyInGroup } = groupSelection;
    const groupActions = [
      {
        id: removalOnlyInGroup ? `removeDeleted:${group.id}` : `stage:${group.id}`,
        icon: removalOnlyInGroup ? 'remove' : group.id === 'staged' ? 'collapse' : 'check',
        label: removalOnlyInGroup
          ? t('editor.removeFromVcs')
          : group.id === 'staged'
            ? t('editor.unstageAction')
            : group.id === 'unversioned'
              ? t('editor.addToVcs')
              : t('editor.stageAction'),
        disabled: selectedInGroup.length === 0,
        run: () => {
          if (removalOnlyInGroup) onStage(removableInGroup);
          else if (group.id === 'staged') onUnstage(selectedInGroup);
          else onStage(selectedInGroup);
        },
      },
      ...(removableInGroup.length > 0 && !removalOnlyInGroup
        ? [
            {
              id: `removeDeleted:${group.id}`,
              icon: 'remove',
              label: t('editor.removeFromVcs'),
              disabled: false,
              run: () => onStage(removableInGroup),
            },
          ]
        : []),
      {
        id: 'copyPatchToClipboard',
        icon: 'file',
        label: t('editor.copyPatchToClipboard'),
        disabled: selectedInGroup.length === 0,
        run: () =>
          onCopyPatch?.(
            selectedInGroup.map((path) => ({
              path,
              staged: group.id === 'staged',
            })),
          ),
      },
      {
        id: 'createPatchFromChanges',
        icon: 'file',
        label: t('editor.createPatchFromChanges'),
        disabled: selectedInGroup.length === 0,
        run: () =>
          onCreatePatch?.(
            selectedInGroup.map((path) => ({
              path,
              staged: group.id === 'staged',
            })),
          ),
      },
      ...(group.id === 'unversioned'
        ? [
            {
              id: 'gitignore',
              icon: 'ignore',
              label: t('editor.addToGitignore'),
              disabled: selectedInGroup.length === 0,
              run: () => onGitignore(selectedInGroup),
            },
          ]
        : []),
    ];
    const groupMenuItems = [
      ...groupActions.map((action) => ({
        id: action.id,
        label: action.label,
        disabled: action.disabled,
        run: action.run,
      })),
      null,
      {
        id: 'rollbackGroup',
        label:
          group.id === 'staged'
            ? t('editor.rollbackStaged')
            : group.id === 'unversioned'
              ? selectedInGroup.length > 1
                ? t('editor.rollbackUnversionedCount', {
                    count: selectedInGroup.length,
                  })
                : t('editor.rollbackUnversioned')
              : selectedInGroup.length > 1
                ? t('editor.rollbackWorkingCount', {
                    count: selectedInGroup.length,
                  })
                : t('editor.rollbackWorking'),
        danger: true,
        disabled: selectedInGroup.length === 0,
        run: () => onRollbackGroup?.(group.id, selectedInGroup),
      },
      null,
      {
        id: `toggle:${group.id}`,
        label: groupOpen ? t('editor.collapseGroup') : t('editor.expandGroup'),
        run: () => onToggleDirectory(groupKey),
      },
    ];
    return (
      <React.Fragment key={group.id}>
        <div
          className='dsh-editor-change-tree-row'
          style={{
            ...styles.commitGroupHeader,
            ...(selectedGroup === group.id ? styles.commitFileRowSelected : null),
          }}
          role='treeitem'
          tabIndex={selectedGroup === group.id ? 0 : -1}
          aria-selected={selectedGroup === group.id}
          aria-expanded={groupOpen}
          aria-level={1}
          aria-posinset={groupIndex + 1}
          aria-setsize={visibleGroups.length}
          data-dsh-change-group={group.id}
          onClick={(event) => {
            if (event.target instanceof Element && event.target.closest('input, button, [role="button"]') !== null)
              return;
            onSelectGroup?.(group.id);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight' && !groupOpen) {
              event.preventDefault();
              event.stopPropagation();
              onToggleDirectory(groupKey);
            } else if (event.key === 'ArrowLeft' && groupOpen) {
              event.preventDefault();
              event.stopPropagation();
              onToggleDirectory(groupKey);
            } else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
              event.preventDefault();
              event.stopPropagation();
              onSelectGroup?.(group.id);
              const rect = event.currentTarget.getBoundingClientRect();
              setGroupActionMenu({
                x: rect.left + 12,
                y: rect.bottom,
                title: group.label,
                items: groupMenuItems,
                owner: `group-actions:${group.id}`,
              });
            } else onChangesKeyDown?.(event);
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.focus?.();
            onSelectGroup?.(group.id);
            setGroupActionMenu({
              x: event.clientX,
              y: event.clientY,
              title: group.label,
              items: groupMenuItems,
              owner: `group-actions:${group.id}`,
            });
          }}>
          <span
            style={styles.commitChevron}
            role='button'
            tabIndex={-1}
            aria-label={
              groupOpen
                ? t('editor.collapseGroupNamed', {
                    group: group.label,
                  })
                : t('editor.expandGroupNamed', {
                    group: group.label,
                  })
            }
            aria-expanded={groupOpen}
            onClick={(event) => {
              event.stopPropagation();
              onToggleDirectory(groupKey);
            }}>
            <Icon
              name={groupOpen ? 'chevronDown' : 'chevronRight'}
              size={10}
            />
          </span>
          <input
            type='checkbox'
            className='dsh-editor-checkbox'
            style={styles.checkbox}
            checked={groupState === 'all'}
            ref={(element) => {
              if (element !== null) element.indeterminate = groupState === 'some';
            }}
            disabled={group.changes.length === 0}
            onChange={() => onToggleGroup(group.id)}
            aria-label={t('editor.selectGroupFiles', {
              group: group.label,
            })}
          />
          <span style={styles.commitGroupLabel}>{group.label}</span>
          <span
            className={groupActions.length > 1 ? 'dsh-editor-commit-group-header-count' : undefined}
            style={styles.commitGroupFiles}>
            {fileCountText(group.changes.length)}
          </span>
          <LineCounts counts={groupView?.total} />
          <span style={styles.toolbarSpacer} />
          {groupActions.length > 1 ? (
            <React.Fragment>
              {groupActions.map((action) => (
                <span
                  key={action.id}
                  className='dsh-editor-commit-group-actions-wide'
                  style={{
                    display: 'contents',
                  }}>
                  <ToolbarButton
                    icon={action.icon}
                    label={action.label}
                    disabled={action.disabled}
                    onClick={action.run}
                  />
                </span>
              ))}
              <span
                className='dsh-editor-commit-group-actions-narrow'
                style={{
                  display: 'none',
                }}>
                <ToolbarButton
                  icon='more'
                  label={t('editor.moreActionsFor', {
                    group: group.label,
                  })}
                  ariaHasPopup='menu'
                  ariaExpanded={groupActionMenu?.owner === `group-actions:${group.id}`}
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    setGroupActionMenu({
                      x: Math.max(4, rect.right - 188),
                      y: rect.bottom + 4,
                      title: group.label,
                      items: groupMenuItems,
                      owner: `group-actions:${group.id}`,
                    });
                  }}
                />
              </span>
            </React.Fragment>
          ) : (
            <ToolbarButton
              key={groupActions[0].id}
              icon={groupActions[0].icon}
              label={groupActions[0].label}
              disabled={groupActions[0].disabled}
              onClick={groupActions[0].run}
            />
          )}
        </div>
        {rows.length === 0 ? (
          groupOpen ? (
            <div style={styles.commitGroupEmpty}>{t('editor.emptyGroup')}</div>
          ) : null
        ) : (
          rows.map((row, rowIndex) => {
            if (row.kind === 'directory') {
              const inside = (row.changes ?? []).map((change) => change.path);
              const state = selectionStateOf(inside, selectedPaths);
              return (
                <div
                  key={`${group.id}:${row.path}`}
                  className='dsh-editor-change-tree-row'
                  style={{
                    ...styles.commitTreeNode,
                    paddingLeft: 22 + row.depth * 14,
                  }}
                  role='treeitem'
                  aria-expanded={row.open}
                  data-dsh-change-directory={row.path}
                  aria-level={row.depth + 2}
                  aria-posinset={rowIndex + 1}
                  aria-setsize={rows.length}
                  tabIndex={-1}
                  onClick={(event) => {
                    if (event.altKey === true) onToggleDirectory(collapseKeysOf(tree, group.id, row.path));
                    else onToggleDirectory(row.collapseKey);
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    event.currentTarget.focus?.();
                    /* `row.changes` holds the change OBJECTS; `inside` is only their
               paths, and the menu needs the objects to collect paths itself. */
                    onContextMenu?.({
                      directory: row.path,
                      changes: row.changes ?? [],
                      group: group.id,
                      x: event.clientX,
                      y: event.clientY,
                    });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'ContextMenu' || (event.shiftKey === true && event.key === 'F10')) {
                      event.preventDefault();
                      event.stopPropagation();
                      event.currentTarget.focus?.();
                      const rect = event.currentTarget.getBoundingClientRect();
                      onContextMenu?.({
                        directory: row.path,
                        changes: row.changes ?? [],
                        group: group.id,
                        x: rect.left + 12,
                        y: rect.bottom,
                      });
                      return;
                    }
                    if (event.key === 'ArrowRight' && !row.open) {
                      event.preventDefault();
                      event.stopPropagation();
                      onToggleDirectory(row.collapseKey);
                      return;
                    }
                    if (event.key === 'ArrowLeft' && row.open) {
                      event.preventDefault();
                      event.stopPropagation();
                      onToggleDirectory(row.collapseKey);
                      return;
                    }
                    onChangesKeyDown?.(event);
                  }}>
                  <span style={styles.commitChevron}>
                    <Icon
                      name={row.open ? 'chevronDown' : 'chevronRight'}
                      size={10}
                    />
                  </span>
                  <input
                    type='checkbox'
                    className='dsh-editor-checkbox'
                    style={styles.checkbox}
                    checked={state === 'all'}
                    ref={(element) => {
                      if (element !== null) element.indeterminate = state === 'some';
                    }}
                    aria-label={
                      group.id === 'staged'
                        ? t('editor.unstageDirectoryFiles', {
                            path: row.path,
                          })
                        : group.id === 'unversioned'
                          ? t('editor.addDirectoryToVcs', {
                              path: row.path,
                            })
                          : t('editor.stageDirectoryFiles', {
                              path: row.path,
                            })
                    }
                    onClick={(event) => event.stopPropagation()}
                    onChange={() => {
                      /* A full (or partial) directory clears; an empty one fills — IDEA's
                 checkbox toggles the whole subtree, never a single file. */
                      if (group.id === 'staged') onUnstage(inside);
                      else onStage(inside);
                    }}
                  />
                  <EntryIcon
                    entry={{
                      path: row.path,
                      kind: 'directory',
                      root: false,
                    }}
                    expanded={row.open}
                  />
                  <span style={styles.commitNodeName}>
                    <span style={styles.commitDirName}>{row.name}</span>
                    <span style={styles.commitGroupFiles}>{fileCountText(inside.length)}</span>
                  </span>
                  {
                    /* IDEA puts the parent path after the name ("spark  doc"),
               which is how two same-named folders are told apart. */
                    <CommitSecondaryPath text={row.parent} />
                  }
                  <LineCounts counts={subtotalOf(row.changes, group.id)} />
                </div>
              );
            }
            const change = row.change;
            const checked = selectedPaths.has(change.path);
            const conflict = isConflict(change);
            const selectedForDiff =
              diffTarget !== null && diffTarget.path === change.path && diffTarget.staged === (group.id === 'staged');
            const selectedForChange =
              selectedChange !== null &&
              selectedChange.path === change.path &&
              selectedChange.staged === (group.id === 'staged');
            const changeKey = `${group.id === 'staged' ? 'staged' : 'unstaged'}:${change.path}`;
            const selectedInRange = selectedChanges instanceof Set && selectedChanges.has(changeKey);
            return (
              <div
                key={`${group.id}:${change.path}`}
                ref={(element) => {
                  const key = changeKey;
                  if (element === null) changeRowRefs.current.delete(key);
                  else changeRowRefs.current.set(key, element);
                }}
                className={[
                  'dsh-editor-change-tree-row',
                  'dsh-editor-commit-row',
                  conflict ? 'dsh-editor-commit-row-conflict' : '',
                  selectedForChange ? 'dsh-editor-commit-row-selected' : '',
                  selectedInRange ? 'dsh-editor-commit-row-range' : '',
                  selectedForDiff ? 'dsh-editor-commit-row-active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                role='treeitem'
                aria-level={row.depth + 2}
                aria-posinset={rowIndex + 1}
                aria-setsize={rows.length}
                aria-selected={selectedInRange || selectedForChange}
                style={{
                  ...styles.commitTreeNode,
                  ...styles.commitFileRow,
                  /* IDEA indents nested files below their expanded folder;
             the disclosure gutter still owns the leading column. */
                  paddingLeft: 22 + row.depth * 14,
                  ...(conflict ? styles.commitFileRowConflict : null),
                  ...(selectedForChange ? styles.commitFileRowSelected : null),
                  ...(selectedInRange && !selectedForChange ? styles.commitFileRowRange : null),
                  ...(selectedForDiff ? styles.commitFileRowActive : null),
                }}
                title={change.path}
                data-dsh-change-path={change.path}
                data-dsh-change-staged={group.id === 'staged'}
                tabIndex={selectedForChange ? 0 : -1}
                onKeyDown={(event) => {
                  if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                    event.preventDefault();
                    event.stopPropagation();
                    const insideSelection = selectedInRange;
                    if (!insideSelection) {
                      onSelectChange?.({
                        path: change.path,
                        staged: group.id === 'staged',
                        replaceSelection: true,
                      });
                    }
                    const rect = event.currentTarget.getBoundingClientRect();
                    onContextMenu({
                      change,
                      staged: group.id === 'staged',
                      selectedChanges: insideSelection ? selectedChanges : new Set([changeKey]),
                      x: rect.left + 12,
                      y: rect.bottom,
                    });
                    return;
                  }
                  onChangesKeyDown?.(event);
                }}
                onKeyUp={(event) => onChangesKeyUp?.(event)}
                onClick={(event) =>
                  onSelectChange?.({
                    path: change.path,
                    staged: group.id === 'staged',
                    shift: event.shiftKey,
                    toggle: event.metaKey || event.ctrlKey,
                    row: event.currentTarget,
                  })
                }
                onDoubleClick={(event) => {
                  if (
                    event.target instanceof Element &&
                    event.target.closest('input, button, a, [role="checkbox"]') !== null
                  )
                    return;
                  onSelectDiff?.({
                    path: change.path,
                    staged: group.id === 'staged',
                  });
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  event.currentTarget.focus?.();
                  const insideSelection = selectedInRange;
                  if (!insideSelection) {
                    onSelectChange?.({
                      path: change.path,
                      staged: group.id === 'staged',
                      replaceSelection: true,
                    });
                  }
                  onContextMenu({
                    change,
                    staged: group.id === 'staged',
                    selectedChanges: insideSelection ? selectedChanges : new Set([changeKey]),
                    x: event.clientX,
                    y: event.clientY,
                  });
                }}>
                <span style={styles.commitChevron} />
                <input
                  type='checkbox'
                  className='dsh-editor-checkbox'
                  style={styles.checkbox}
                  checked={checked}
                  onChange={() => onTogglePath(change.path)}
                  onClick={(event) => event.stopPropagation()}
                  aria-label={t('editor.includeFileInCommit', {
                    path: change.path,
                    group: group.label,
                  })}
                />
                <EntryIcon
                  entry={{
                    path: change.path,
                    kind: 'file',
                  }}
                  expanded={false}
                />
                <span style={styles.commitNodeName}>
                  <span style={styles.commitFileName}>{row.name}</span>
                  {conflict ? (
                    <span
                      style={styles.conflictChip}
                      title={t('editor.conflictHint')}>
                      {t('editor.conflictBadge')}
                    </span>
                  ) : null}
                </span>
                <CommitSecondaryPath text={parentDirLabel(change.path) || projectName} />
                <LineCounts
                  counts={
                    group.id === 'staged'
                      ? change.stagedLines
                      : group.id === 'unstaged'
                        ? change.unstagedLines
                        : undefined
                  }
                />
              </div>
            );
          })
        )}
      </React.Fragment>
    );
  };

  /* IDEA tool-window tabs use one roving tab stop: the selected mode owns
     Tab focus, while arrow/Home/End keys move both selection and focus. */
  const commitModeOrder: CommitMode[] = ['changes', 'log'];
  const focusCommitModeTab = (nextMode: CommitMode): void => {
    const target = commitModeTabsRef.current?.querySelector(`[data-dsh-commit-mode="${nextMode}"]`);
    onMode(nextMode);
    target?.focus?.();
  };
  const moveCommitModeFocus = (currentMode: CommitMode, delta: number): void => {
    const index = commitModeOrder.indexOf(currentMode);
    if (index < 0) return;
    const nextIndex = Math.max(0, Math.min(commitModeOrder.length - 1, index + delta));
    if (nextIndex === index) return;
    focusCommitModeTab(commitModeOrder[nextIndex]);
  };
  const focusBoundaryCommitMode = (edge: 'first' | 'last'): void => {
    focusCommitModeTab(commitModeOrder[edge === 'first' ? 0 : commitModeOrder.length - 1]);
  };
  const onCommitModeKeyDown = (event: React.KeyboardEvent<HTMLElement>, currentMode: CommitMode): void => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      event.stopPropagation();
      moveCommitModeFocus(currentMode, event.key === 'ArrowLeft' ? -1 : 1);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      event.stopPropagation();
      focusBoundaryCommitMode(event.key === 'Home' ? 'first' : 'last');
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      onMode(currentMode);
    }
  };
  const commitModeTabs = (
    <div
      ref={commitModeTabsRef}
      style={styles.commitToolbarTabs}
      role='tablist'
      aria-label={t('editor.commit')}>
      <button
        type='button'
        className='dsh-editor-commit-mode-tab'
        role='tab'
        aria-selected={mode === 'changes'}
        tabIndex={mode === 'changes' ? 0 : -1}
        data-dsh-commit-mode='changes'
        style={{
          ...styles.commitTab,
          ...(mode === 'changes' ? styles.commitTabActive : null),
        }}
        onClick={(event) => {
          event.currentTarget.focus?.();
          onMode('changes');
        }}
        onKeyDown={(event) => onCommitModeKeyDown(event, 'changes')}>
        {t('editor.tabChanges')}
        <span style={styles.commitGroupCount}>{String(changes.length)}</span>
      </button>
      <button
        type='button'
        className='dsh-editor-commit-mode-tab'
        role='tab'
        aria-selected={mode === 'log'}
        tabIndex={mode === 'log' ? 0 : -1}
        data-dsh-commit-mode='log'
        style={{
          ...styles.commitTab,
          ...(mode === 'log' ? styles.commitTabActive : null),
        }}
        onClick={(event) => {
          event.currentTarget.focus?.();
          onMode('log');
        }}
        onKeyDown={(event) => onCommitModeKeyDown(event, 'log')}>
        {t('editor.tabLog')}
      </button>
    </div>
  );
  return (
    <React.Fragment>
      <PanelToolbar
        t={t}
        ariaLabel={t('editor.commit')}
        titleAction={commitModeTabs}
        titleActionStyle={styles.commitToolbarTitleAction}
        badge={
          branchText.length === 0
            ? null
            : /* The chip already says "detached HEAD"; the badge adds only the hint. */ `${branchText}${detached ? ` · ${t('editor.detachedHeadHint')}` : ''}${ahead > 0 || behind > 0 ? ` ↑${ahead} ↓${behind}` : ''}`
        }
        onBadge={onBranchMenu}
        badgeHasPopup='menu'
        badgeExpanded={branchMenuOpen === true}
        right={[
          {
            id: 'options',
            icon: 'settings',
            label: t('editor.options'),
            ariaHasPopup: 'menu',
            ariaExpanded: optionsOpen === true,
            onClick: (event) => {
              const rect = event?.currentTarget?.getBoundingClientRect?.();
              onOptionsMenu?.(
                rect === undefined
                  ? {
                      x: 240,
                      y: 120,
                    }
                  : {
                      x: rect.left,
                      y: rect.bottom + 4,
                    },
              );
            },
          },
          {
            id: 'refresh',
            icon: 'refresh',
            label: t('editor.refresh'),
            onClick: onRefresh,
          },
          {
            id: 'hide',
            icon: 'hide',
            label: t('editor.hide'),
            onClick: onHide,
          },
        ]}
      />
      {historyMenu === null ? null : (
        <ContextMenu
          menu={historyMenu}
          onClose={() => setHistoryMenu(null)}
          t={t}
        />
      )}
      {groupActionMenu === null ? null : (
        <ContextMenu
          menu={groupActionMenu}
          onClose={() => setGroupActionMenu(null)}
          t={t}
        />
      )}
      {
        /* Errors and notices belong to the tool window, not to one of its tabs: a failed
       cherry-pick from the Log tab used to produce no feedback at all. */
        error !== null || notice !== null || gitNotManaged || (pushFailure !== null && pushFailure !== undefined) ? (
          <div style={styles.commitStatusStack}>
            {gitNotManaged ? (
              <div
                style={styles.commitNotice}
                role='status'
                aria-atomic='true'>
                {t('editor.gitNotManaged')}
              </div>
            ) : null}
            {error !== null ? (
              <div
                role='alert'
                aria-atomic='true'
                style={{
                  ...styles.commitError,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                <span
                  style={{
                    flex: '1 1 auto',
                    minWidth: 0,
                  }}>
                  {error}
                </span>
                {onRetryStatus === undefined ? null : (
                  <button
                    type='button'
                    style={styles.conflictAction}
                    disabled={statusRetryControl.disabled}
                    aria-disabled={statusRetryControl.ariaDisabled || undefined}
                    aria-busy={statusRetryControl.busy || undefined}
                    onClick={() => onRetryStatus?.()}>
                    {statusRetryControl.busy ? t('editor.loading') : t('editor.logRetry')}
                  </button>
                )}
              </div>
            ) : null}
            {notice !== null ? (
              <div
                style={styles.commitNotice}
                role='status'
                aria-atomic='true'>
                {notice}
                {undoMessage === '' ? null : (
                  <button
                    type='button'
                    style={{
                      ...styles.conflictAction,
                      marginLeft: 6,
                    }}
                    onClick={() => onUndoMessage?.()}>
                    {t('editor.undoClearedMessage')}
                  </button>
                )}
              </div>
            ) : null}
            {pushFailure === null || pushFailure === undefined ? null : (
              <div
                style={styles.commitError}
                role='alert'
                aria-atomic='true'>
                <span
                  style={{
                    flex: '1 1 auto',
                    minWidth: 0,
                  }}>
                  {t('editor.pushedFailed', {
                    message: pushFailure,
                  })}
                </span>
                <button
                  type='button'
                  style={styles.conflictAction}
                  onClick={() => onPush?.()}
                  disabled={pushRetryControl.disabled}
                  aria-disabled={pushRetryControl.ariaDisabled || undefined}
                  aria-busy={pushRetryControl.busy || undefined}>
                  {pushRetryControl.busy ? t('editor.pushing') : t('editor.retryPush')}
                </button>
              </div>
            )}
          </div>
        ) : null
      }
      <CommitLog
        hidden={mode !== 'log'}
        disabled={gitNotManaged}
        t={t}
        scrollRefs={scrollRefs}
        commits={commits}
        loading={logLoading}
        detail={logDetail}
        onRefresh={onLoadLog}
        onShow={onSelectCommit}
        onOpenFile={onOpenFile}
        onEditSource={onEditSource}
        onShowCommitDiff={onShowCommitDiff}
        historyPath={historyPath ?? null}
        onClearHistory={onClearHistory}
        author={logAuthor}
        onAuthor={onLogAuthor}
        search={logSearch}
        onLoadMore={onLoadMoreLog}
        exhausted={logExhausted === true}
        onContextMenu={onLogContextMenu}
        onDirectoryMenu={onDirectoryMenu}
        highlighted={highlightedCommit}
        graph={graph}
        onLoadGraph={onLoadGraph}
        onGraphBranch={onGraphBranch}
        onGraphRef={onGraphRef}
        selected={selected}
        selectedCommits={selectedCommits}
        onSelectCommits={onSelectCommits}
        logFailure={logFailure}
        onRetry={onRetry}
        onFileMenu={onFileMenu}
        onFindInFiles={onFindInFiles}
      />
      {mode === 'log' ? null : (
        <div style={styles.commitBody}>
          <div
            style={styles.commitChangesPane}
            data-dsh-changes-panel=''>
            <CompactActionBar
              t={t}
              ariaLabel={t('editor.changesActions')}
              actions={[
                {
                  id: 'refresh',
                  group: 'refresh',
                  icon: 'refresh',
                  label: t('editor.refresh'),
                  pinned: true,
                  onClick: onRefresh,
                },
                {
                  id: 'rollback',
                  group: 'local',
                  icon: 'undo',
                  label:
                    chosenChangeList.length > 1
                      ? t('editor.rollbackSelectedCount', {
                          count: chosenChangeList.length,
                        })
                      : t('editor.rollbackSelected'),
                  disabled: gitNotManaged || chosenChangeList.length === 0,
                  onClick: () => {
                    if (chosenChangeList.length > 0) onRollbackSelected?.(chosenChangeList);
                  },
                },
                {
                  id: 'showDiff',
                  group: 'diff',
                  icon: 'diff',
                  label: t('editor.showDiff'),
                  disabled: gitNotManaged || chosenChangeList.length === 0,
                  active:
                    diffTarget !== null &&
                    selectedChange !== null &&
                    diffTarget.path === selectedChange.path &&
                    diffTarget.staged === selectedChange.staged,
                  onClick: () => {
                    const navigationEntries = diffNavigationEntries(chosenChangeList);
                    const primary = selectedChange ?? chosenChangeList[0];
                    if (primary !== null && navigationEntries.length > 0)
                      onShowDiff?.({ ...primary, navigationEntries });
                  },
                },
                {
                  id: 'shelve',
                  group: 'shelve',
                  icon: 'stash',
                  label: t('editor.shelve'),
                  disabled:
                    gitNotManaged ||
                    commitShelveActionDisabled(chosenChangeList.length, busy || workingTreeBusy, onShelve),
                  onClick: (event) => {
                    const rect = event?.currentTarget?.getBoundingClientRect?.();
                    onShelve?.(
                      rect === undefined
                        ? {
                            x: 240,
                            y: 120,
                          }
                        : {
                            x: rect.left,
                            y: rect.bottom + 4,
                          },
                    );
                  },
                },
                {
                  id: 'combinedDiff',
                  group: 'diff',
                  icon: 'combinedDiff',
                  label: t('editor.showCombinedDiff'),
                  disabled: gitNotManaged || chosenChangeList.length < 2,
                  onClick: () => onShowCombinedDiff?.(chosenChangeList),
                },
                {
                  id: 'copyPatch',
                  group: 'patch',
                  icon: 'clipboard',
                  label: t('editor.copyPatchToClipboard'),
                  disabled: gitNotManaged || chosenChangeList.length === 0,
                  onClick: () => onCopyPatch?.(chosenChangeList),
                },
                {
                  id: 'createPatch',
                  group: 'patch',
                  icon: 'patchExport',
                  label: t('editor.createPatchFromChanges'),
                  disabled: gitNotManaged || chosenChangeList.length === 0,
                  onClick: () => onCreatePatch?.(chosenChangeList),
                },
                {
                  id: 'stageAllTracked',
                  group: 'local',
                  icon: 'check',
                  label: t('editor.stageAllTracked'),
                  disabled: busy || workingTreeBusy || gitNotManaged || stageAllTrackedPaths.length === 0,
                  onClick: () => onStageAllTracked?.(),
                },
                {
                  id: 'viewOptions',
                  group: 'view',
                  icon: 'settings',
                  label: t('editor.viewOptions'),
                  pinned: true,
                  disabled: onViewOptionsMenu === undefined,
                  ariaHasPopup: 'menu',
                  ariaExpanded: viewOptionsOpen === true,
                  onClick: (event) => {
                    const rect = event?.currentTarget?.getBoundingClientRect?.();
                    onViewOptionsMenu?.(
                      rect === undefined
                        ? {
                            x: 240,
                            y: 120,
                          }
                        : {
                            x: rect.left,
                            y: rect.bottom + 4,
                          },
                    );
                  },
                },
                {
                  id: 'selectOpened',
                  group: 'view',
                  icon: 'target',
                  label: t('editor.selectOpenedChange'),
                  disabled: gitNotManaged || onSelectOpenedChange === undefined,
                  onClick: () => onSelectOpenedChange?.(),
                },
                {
                  id: 'expandChanges',
                  group: 'view',
                  icon: 'expand',
                  label: t('editor.expandChanges'),
                  disabled: changes.length === 0,
                  onClick: () => onExpandChanges?.(),
                },
                {
                  id: 'collapseChanges',
                  group: 'view',
                  icon: 'collapse',
                  label: t('editor.collapseChanges'),
                  disabled: changes.length === 0,
                  onClick: () => onCollapseChanges?.(),
                },
              ]}
            />
            <div style={styles.treeSearchRow}>
              <Icon
                name='search'
                size={12}
              />
              <input
                ref={changeFilterRef}
                style={{
                  ...styles.findInput,
                  flex: '1 1 auto',
                  width: 'auto',
                }}
                placeholder={t('editor.changeFilterPlaceholder')}
                title={t('editor.changeFilterHint')}
                value={pathQuery}
                aria-label={t('editor.changeFilter')}
                data-dsh-changes-filter=''
                onChange={(event) => onPathQuery?.(event.target.value)}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing === true) return;
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    clearChangeFilter();
                  } else if (filteredTargets.length > 0 && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
                    event.preventDefault();
                    const direction = event.key === 'ArrowDown' ? 'next' : 'previous';
                    const currentTarget =
                      typeof selectedChange?.path === 'string'
                        ? { path: selectedChange.path, staged: selectedChange.staged === true }
                        : null;
                    const target = cycleChangeTarget(filteredTargets, currentTarget, direction);
                    if (target !== null)
                      onSelectChange?.({
                        path: target.path,
                        staged: target.staged,
                      });
                  }
                }}
              />
              {pathQuery === '' ? null : (
                <button
                  type='button'
                  style={styles.conflictAction}
                  title={t('editor.clearChangeFilter')}
                  aria-label={t('editor.clearChangeFilter')}
                  onClick={() => clearChangeFilter()}>
                  ×
                </button>
              )}
            </div>
            <div
              style={styles.commitScroll}
              className='dsh-editor-tool-scroll'
              ref={scrollRefs?.changes ?? null}
              tabIndex={0}
              role='tree'
              aria-multiselectable={true}
              aria-busy={busy ? 'true' : undefined}
              data-dsh-changes-list=''
              aria-label={t('editor.changes')}
              onKeyDown={(event) => onChangesKeyDown?.(event)}
              onKeyUp={(event) => onChangesKeyUp?.(event)}>
              {changes.length === 0 ? (
                <div style={styles.treeMessage}>{t('editor.noChanges')}</div>
              ) : visibleGroups.length === 0 ? (
                <div style={styles.treeMessage}>{t('editor.noMatches')}</div>
              ) : (
                visibleGroups.map((group, groupIndex) => renderGroup(group, groupIndex))
              )}
            </div>
            <div style={styles.commitMessageArea}>
              <div style={styles.amendRow}>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    minWidth: 0,
                    flex: '1 1 auto',
                    cursor: busy || workingTreeBusy || gitNotManaged ? 'default' : 'pointer',
                  }}>
                  <input
                    type='checkbox'
                    className='dsh-editor-checkbox'
                    style={styles.checkbox}
                    checked={amend}
                    disabled={busy || workingTreeBusy || gitNotManaged}
                    onChange={(event) => onAmend(event.target.checked)}
                    aria-label={t('editor.amend')}
                  />
                  <span style={styles.amendLabel}>{t('editor.amend')}</span>
                  {git?.lastCommit?.subject ? (
                    <span
                      style={styles.amendSubject}
                      title={git.lastCommit.subject}>
                      {git.lastCommit.subject}
                    </span>
                  ) : null}
                </label>
                <ToolbarButton
                  icon='history'
                  label={t('editor.commitMessageHistory')}
                  disabled={history.length === 0}
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    setHistoryMenu({
                      x: Math.max(4, rect.right - 240),
                      y: rect.bottom + 4,
                      title: t('editor.commitMessageHistory'),
                      items: history.map((entry, index) => ({
                        id: `messageHistory:${index}`,
                        label: entry.split('\n')[0] || t('editor.commitMessagePlaceholder'),
                        restoreFocus: false,
                        run: () => {
                          onPickHistory?.(index);
                          window.setTimeout(() => commitMessageRef.current?.focus(), 0);
                        },
                      })),
                    });
                  }}
                />
              </div>
              <textarea
                ref={commitMessageRef}
                style={styles.commitTextarea}
                value={message}
                aria-label={t('editor.commitMessage')}
                placeholder={t('editor.commitMessagePlaceholder')}
                spellCheck={false}
                onChange={(event) => onMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing === true) return;
                  /* ⌘/Ctrl+Enter commits without reaching for the mouse. */
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.preventDefault();
                    if (!busy && !workingTreeBusy && !gitNotManaged && selectedPaths.size > 0 && message.trim() !== '')
                      onCommit(false);
                    return;
                  }
                  /* ↑/↓ walk the message history only when the caret sits on the first/last line. */
                  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                  if (history.length === 0) return;
                  const caret = event.currentTarget.selectionStart;
                  const value = event.currentTarget.value;
                  const atStart = value.lastIndexOf('\n', caret - 1) < 0;
                  const atEnd = value.indexOf('\n', caret) < 0;
                  if (event.key === 'ArrowUp' && !atStart) return;
                  if (event.key === 'ArrowDown' && !atEnd) return;
                  event.preventDefault();
                  onRecall(event.key === 'ArrowUp' ? 1 : -1);
                }}
              />
              {templates.length === 0 ? null : (
                <div style={styles.commitTemplateRow}>
                  {templates.map((prefix) => (
                    <button
                      key={prefix}
                      type='button'
                      className='dsh-editor-template-chip'
                      style={styles.commitTemplateChip}
                      aria-label={t('editor.commitTemplateHint', {
                        prefix,
                      })}
                      title={t('editor.commitTemplateHint', {
                        prefix,
                      })}
                      onClick={() => onTemplate?.(prefix)}>
                      {prefix}
                    </button>
                  ))}
                </div>
              )}
              {identityMissing ? <div style={styles.commitError}>{t('editor.identityMissing')}</div> : null}
              {typeof git?.operation === 'string' && git.operation !== '' ? (
                <div style={styles.commitNotice}>
                  {t('editor.operationInProgress', {
                    operation: git.operation,
                  })}
                </div>
              ) : null}
              <div style={styles.commitButtonRow}>
                <button
                  type='button'
                  style={styles.commitPrimary}
                  disabled={
                    busy || workingTreeBusy || gitNotManaged || selectedPaths.size === 0 || message.trim() === ''
                  }
                  onClick={() => onCommit(false)}>
                  {busy
                    ? t('editor.committing')
                    : selectedPaths.size === 0
                      ? t('editor.commitAction')
                      : `${t('editor.commitAction')} ${selectedPaths.size}`}
                </button>
                <button
                  type='button'
                  className='dsh-editor-commit-secondary'
                  style={styles.commitSecondary}
                  disabled={
                    busy || workingTreeBusy || gitNotManaged || selectedPaths.size === 0 || message.trim() === ''
                  }
                  onClick={() => onCommit(true)}
                  title={t('editor.commitAndPush')}
                  aria-label={t('editor.commitAndPush')}>
                  {
                    /* IDEA labels BOTH buttons ("Commit" / "Commit and Push…"): an
                 icon-only second button does not say what it will do, and the
                 two actions differ irreversibly (push is remote). */
                    t('editor.commitAndPush')
                  }
                </button>
              </div>
              <div style={styles.commitNotice}>
                {allSelected
                  ? t('editor.allSelected')
                  : selectedPaths.size === 0
                    ? t('editor.noneSelected')
                    : t(selectedPaths.size === 1 ? 'editor.partialSelectedOne' : 'editor.partialSelected', {
                        count: selectedPaths.size,
                      })}
              </div>
            </div>
          </div>
        </div>
      )}
    </React.Fragment>
  );
}

export { CommitPanel };
