import React from 'react';
import { styles } from '../../ui/styles';
import { dirname } from '../editor/editor-path-model';
import type { CommitGraphMenuPayload, CommitGraphPayload } from './CommitGraph';
import { CommitGraph } from './CommitGraph';
import { commitLogFlatKeyIntent } from './commit-log-flat-controller';
import { commitLogGraphCursor, commitLogGraphKeyIntent, commitLogGraphMove } from './commit-log-graph-controller';
import { commitLogFlatListCommand, commitLogGraphListCommand } from './commit-log-list-command-model';
import { commitLogContextSelection, commitSelectionAfterClick } from './commit-log-selection-model';
import { commitLogShortcutAction } from './commit-log-shortcut-model';
import { commitLogFilterCommits } from './commit-log-view-model';
import { commitLogGraphFoldToggle, commitLogGraphToggle } from './commit-log-view-preferences';
import { CommitLogDetailPane } from './CommitLogDetailPane';
import { CommitLogFlatRow } from './CommitLogFlatRow';
import { CommitLogListState } from './CommitLogListState';
import { CommitLogToolbar } from './CommitLogToolbar';
import { callFs } from '../../editor-core';
import {
  commitRelationTarget,
  flatLogTarget,
  graphDisplayEntries,
  graphLogMenuTarget,
  scrollGraphRowIntoView,
} from '../../find-tool';
import { bindShiftWheelScroll } from '../../injected-css';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface CommitLogEntry {
  hash: string;
  parents: string[];
  refs: string[];
  subject: string;
  author: string;
  date: string;
  [key: string]: unknown;
}

export interface CommitLogDetail {
  hash: string;
  subject: string;
  author: string;
  date: string;
  body: string;
  files: CommitLogFile[];
  [key: string]: unknown;
}

export interface CommitLogFile {
  path: string;
  status: string;
}

interface CommitLogScrollRefs {
  [key: string]: React.MutableRefObject<HTMLElement | null> | undefined;
}

type CommitLogCallback = (...args: unknown[]) => void;

export interface CommitLogProps {
  t: Translate;
  scrollRefs?: CommitLogScrollRefs;
  commits: CommitLogEntry[];
  loading: boolean;
  detail: CommitLogDetail | null;
  onRefresh: () => void;
  onShow: (hash: string) => void;
  onOpenFile?: (path: string) => void;
  onEditSource?: (path: string) => void;
  onShowCommitDiff?: (target: { hash: string; path: string }) => void;
  historyPath?: string | null;
  onClearHistory?: () => void;
  author?: string;
  onAuthor?: (value: string) => void;
  onLoadMore?: () => void;
  exhausted?: boolean;
  onContextMenu?: (payload: CommitGraphMenuPayload) => void;
  onDirectoryMenu?: CommitLogCallback;
  highlighted?: string | null;
  graph?: CommitGraphPayload | null;
  onLoadGraph?: (branch: string, at: string) => void;
  onGraphBranch?: (branch: string) => void;
  onGraphRef?: (ref: string) => void;
  selected?: string | null;
  selectedCommits?: string[];
  onSelectCommits?: (hashes: string[]) => void;
  logFailure?: string | null;
  onRetry?: () => void;
  onFileMenu?: (payload: Record<string, unknown>) => void;
  onFindInFiles?: () => void;
}

function CommitLogView({
  t,
  scrollRefs,
  commits,
  loading,
  detail,
  onRefresh,
  onShow,
  onEditSource,
  onShowCommitDiff,
  historyPath,
  onClearHistory,
  author,
  onAuthor,
  onLoadMore,
  exhausted,
  onContextMenu,
  highlighted,
  graph,
  onLoadGraph,
  onGraphBranch,
  onGraphRef,
  selected,
  selectedCommits = [],
  onSelectCommits,
  logFailure = null,
  onRetry,
  onFileMenu,
  onFindInFiles,
}: CommitLogProps) {
  /* Graph mode is a view preference: the flat list stays the default. */
  const [graphMode, setGraphMode] = React.useState(false);
  /* The row under the pointer; the graph highlights it so its lane is traceable. */
  const [graphHover, setGraphHover] = React.useState(null);
  /* IDEA walks the graph with ↑/↓: hovering changes the highlight, and Enter
     opens the detail, so the whole log is reachable without the mouse. */
  const [graphCursor, setGraphCursor] = React.useState(null);
  const [graphFolded, setGraphFolded] = React.useState(false);
  const selectionAnchorRef = React.useRef('');
  const [filter, setFilter] = React.useState('');
  const [showFilter, setShowFilter] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const logScrollRef = scrollRefs?.log ?? null;
  const setLogListRef = React.useCallback(
    (node: HTMLDivElement | null): void => {
      listRef.current = node;
      if (logScrollRef !== null) logScrollRef.current = node;
    },
    [logScrollRef],
  );
  const logFilterInputRef = React.useRef<HTMLInputElement | null>(null);
  /* IDEA's Git Log owns ⌘L for its text filter. ⌘F belongs to Find in Files,
     so the log must not keep the editor-wide Find shortcut for itself. */
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const action = commitLogShortcutAction(
        event.key,
        event.metaKey === true,
        event.ctrlKey === true,
        event.altKey === true,
        event.shiftKey === true,
      );
      if (action === null) return;
      const target = event.target instanceof Element ? event.target : null;
      const active = document.activeElement instanceof Element ? document.activeElement : null;
      const panel = target?.closest('[data-dsh-log-panel]') ?? active?.closest('[data-dsh-log-panel]');
      if (panel === null || panel === undefined) return;
      event.preventDefault();
      event.stopPropagation();
      if (action === 'findInFiles') {
        onFindInFiles?.();
        return;
      }
      setShowFilter(true);
      window.setTimeout(() => {
        logFilterInputRef.current?.focus();
        logFilterInputRef.current?.select();
      }, 0);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onFindInFiles]);
  const [localFileAvailability, setLocalFileAvailability] = React.useState<Map<string, boolean>>(() => new Map());
  const logFailedRef = React.useRef(logFailure !== null);
  React.useEffect(() => {
    const failed = logFailure !== null;
    const recovered = logFailedRef.current && !failed;
    logFailedRef.current = failed;
    if (recovered) {
      window.setTimeout(() => listRef.current?.focus?.({ preventScroll: true }), 0);
    }
  }, [logFailure]);
  const detailPathKey = detail?.files?.map((file) => file.path).join('\0') ?? '';
  const detailScrollRef = React.useRef<HTMLDivElement | null>(null);
  /* IDEA shows a newly selected commit from its title, not at the previous
     commit's reading offset. Same-hash local refreshes keep the user's
     position because only identity changes are in this dependency. */
  React.useEffect(() => {
    const node = detailScrollRef.current;
    if (node !== null) {
      node.scrollTop = 0;
      node.scrollLeft = 0;
    }
  }, [detail?.hash]);
  React.useEffect(() => {
    const cleanups = [bindShiftWheelScroll(listRef.current), bindShiftWheelScroll(detailScrollRef.current)];
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [detail?.hash]);
  React.useEffect(() => {
    if (detail === null || detail?.files?.length === 0) {
      setLocalFileAvailability(new Map());
      return undefined;
    }
    let cancelled = false;
    const localQueryPaths = [...new Set(detail.files.flatMap((file) => [file.path, dirname(file.path)]))];
    const checkLocalFiles = () => {
      callFs({
        op: 'exists',
        paths: localQueryPaths,
      })
        .then((value) => {
          if (cancelled || !Array.isArray(value)) return;
          const next = new Map();
          for (const entry of value) {
            const path = entry?.requested ?? entry?.path;
            if (typeof path === 'string') next.set(path, entry?.exists === true);
          }
          setLocalFileAvailability((current) => {
            if (current.size !== next.size) return next;
            for (const [path, exists] of next) {
              if (current.get(path) !== exists) return next;
            }
            return current;
          });
        })
        .catch(() => {});
    };
    checkLocalFiles();
    const timer = window.setInterval(checkLocalFiles, 3000);
    window.addEventListener('focus', checkLocalFiles);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', checkLocalFiles);
    };
  }, [detail?.hash, detailPathKey]);
  /* One query filters by subject, author and short hash; matches IDEA's log search box. */
  const visible = commitLogFilterCommits(commits, filter);
  const graphEntries = graph?.entries ?? [];
  const graphRows = graphDisplayEntries(graphEntries, graphFolded);
  const selectCommitRow = (order: string[], hash: string, event: React.MouseEvent<HTMLElement> | null): void => {
    const result = commitSelectionAfterClick(
      order,
      selectedCommits,
      hash,
      {
        meta: event?.metaKey === true || event?.ctrlKey === true,
        shift: event?.shiftKey === true,
      },
      selectionAnchorRef.current,
    );
    selectionAnchorRef.current = result.anchor;
    onSelectCommits?.(result.selected);
    onShow?.(hash);
  };
  const selectGraphCommitRow = (
    entry: { hash: string },
    event: React.MouseEvent<HTMLElement> | null,
    options: { contextMenu?: boolean } | null | undefined,
  ): void => {
    if (options?.contextMenu === true && selectedCommits.includes(entry.hash)) {
      setGraphHover(null);
      setGraphCursor(entry.hash);
      onShow?.(entry.hash);
      return;
    }
    const result = commitSelectionAfterClick(
      graphRows.map((row) => row.hash),
      selectedCommits,
      entry.hash,
      {
        meta: event?.metaKey === true || event?.ctrlKey === true,
        shift: event?.shiftKey === true,
      },
      selectionAnchorRef.current,
    );
    selectionAnchorRef.current = result.anchor;
    onSelectCommits?.(result.selected);
    setGraphHover(null);
    setGraphCursor(entry.hash);
    onShow?.(entry.hash);
  };
  const contextSelectionFor = (hash: string): string[] =>
    commitLogContextSelection(selectedCommits, hash).selectionHashes;
  const retryList = () => {
    if (graphMode && onLoadGraph !== undefined) {
      onLoadGraph(graph?.branch ?? '', graph?.at ?? '');
      return;
    }
    onRetry?.();
  };
  React.useEffect(() => {
    if (!graphMode || typeof selected !== 'string' || selected === '') return;
    if (!graphRows.some((entry) => entry.hash === selected)) return;
    if (graphCursor !== selected) setGraphCursor(selected);
  }, [graphCursor, graph?.entries, graphFolded, graphMode, selected]);
  React.useEffect(() => {
    const next = commitLogGraphCursor(graphRows, graphCursor);
    if (next !== graphCursor) setGraphCursor(next);
  }, [graphCursor, graphFolded, graph?.entries]);
  /**
   * Move the graph cursor by one row, clamped to the loaded page.
   *
   * First ↓ from "no cursor" lands on the first row, which is where the eye
   * already is when the graph opens.
   * @param {number} delta - -1 to go up, 1 to go down.
   * @returns {void}
   */
  const moveGraphCursor = (delta: 1 | -1, shiftKey = false): void => {
    const next = commitLogGraphMove(graphRows, graphCursor, graphHover, delta);
    if (next === null) return;
    /* Start from wherever the user last was — the pointer counts too, so the
       first ↓ after hovering continues from that row instead of jumping home. */
    /* The pointer is not where the user is looking any more: drop the hover so
       the keyboard cursor is what the highlight follows. */
    setGraphHover(null);
    setGraphCursor(next.hash);
    const nextSelection = commitSelectionAfterClick(
      graphRows.map((entry) => entry.hash),
      selectedCommits,
      next.hash,
      {
        shift: shiftKey,
      },
      selectionAnchorRef.current,
    );
    selectionAnchorRef.current = nextSelection.anchor;
    onSelectCommits?.(nextSelection.selected);
    /* IDEA's log selects as you walk it: the details pane follows the arrow
       keys, so the commit you are looking at is the one shown below. */
    onShow?.(next.hash);
  };
  const toggleGraphMode = () => {
    const next = commitLogGraphToggle(graphMode);
    setGraphMode(next.enabled);
    if (next.loadGraph) {
      onLoadGraph?.(graph?.branch ?? '', graph?.at ?? '');
    }
    if (next.focusList) {
      /* IDEA's log takes the keyboard when it opens: ↑/↓ must work
         without first clicking a row. The list owns the key handler,
         so it needs focus even before the first page arrives. */
      window.setTimeout(() => listRef.current?.focus?.(), 0);
    }
  };
  /* IDEA's Log tab stacks the commit table over the details: the tool window is
     narrow, so two side-by-side panes would each be too thin to read. */
  return (
    <div
      style={styles.commitLogBody}
      data-dsh-log-panel=''>
      <div style={styles.commitLogList}>
        <CommitLogToolbar
          t={t}
          filter={filter}
          filterVisible={showFilter}
          filterInputRef={logFilterInputRef}
          author={author}
          graphMode={graphMode}
          graph={graph}
          onFilterChange={setFilter}
          onFilterVisibleChange={setShowFilter}
          onAuthorChange={(value) => onAuthor?.(value)}
          onGraphBranch={(branch) => {
            onGraphBranch?.(branch);
            if (branch === '') {
              window.setTimeout(() => listRef.current?.focus?.({ preventScroll: true }), 0);
            }
          }}
          onToggleGraph={toggleGraphMode}
          onRefresh={() => onRefresh()}
        />
        <div
          style={
            graphMode
              ? {
                  ...styles.commitScroll,
                  outline: 'none',
                }
              : styles.commitScroll
          }
          className='dsh-editor-tool-scroll'
          ref={setLogListRef}
          tabIndex={0}
          role='listbox'
          aria-label={t('editor.tabLog')}
          onScroll={(event) => {
            const node = event.currentTarget;
            if (node.scrollHeight - node.scrollTop - node.clientHeight > 48) return;
            onLoadMore?.();
          }}
          onKeyDown={
            graphMode
              ? (event) => {
                  /* Graph rows wrap native buttons and selects. Let those controls
                     receive Enter/Space themselves instead of treating the key as
                     graph navigation. */
                  if (
                    event.target instanceof Element &&
                    event.target.closest(
                      'button, input, textarea, select, a, [role="button"], [contenteditable="true"]',
                    ) !== null
                  )
                    return;
                  const command = commitLogGraphListCommand(
                    commitLogGraphKeyIntent(event.key, event.shiftKey === true),
                    graphRows,
                    graphCursor,
                  );
                  if (command?.type === 'context') {
                    const target = graphLogMenuTarget(graphRows, graphCursor, selected);
                    if (target === null) return;
                    event.preventDefault();
                    event.stopPropagation();
                    const row = listRef.current?.querySelector?.(`[data-dsh-graph-hash="${target.hash}"]`);
                    const rowRect = row?.getBoundingClientRect?.();
                    const listRect = listRef.current?.getBoundingClientRect?.();
                    onContextMenu?.({
                      commit: target,
                      selectionHashes: contextSelectionFor(target.hash),
                      x: Math.max(4, rowRect?.left ?? listRect?.left ?? 4),
                      y: rowRect?.bottom ?? listRect?.top ?? 0,
                    });
                    return;
                  }
                  if (command?.type === 'relation') {
                    const target = commitRelationTarget(graphRows, graphCursor ?? selected, command.direction);
                    if (target === null) return;
                    event.preventDefault();
                    event.stopPropagation();
                    setGraphHover(null);
                    setGraphCursor(target.hash);
                    const next = commitSelectionAfterClick(
                      graphRows.map((entry) => entry.hash),
                      selectedCommits,
                      target.hash,
                      {
                        shift: event.shiftKey === true,
                      },
                      selectionAnchorRef.current,
                    );
                    selectionAnchorRef.current = next.anchor;
                    onSelectCommits?.(next.selected);
                    onShow?.(target.hash);
                    return;
                  }
                  if (command?.type === 'move') {
                    event.preventDefault();
                    moveGraphCursor(command.delta, event.shiftKey === true);
                  } else if (command?.type === 'show') {
                    event.preventDefault();
                    onShow?.(command.hash);
                  } else if (command?.type === 'select') {
                    event.preventDefault();
                    setGraphCursor(command.hash);
                    onSelectCommits?.([command.hash]);
                    onShow?.(command.hash);
                  }
                }
              : (event) => {
                  const command = commitLogFlatListCommand(
                    commitLogFlatKeyIntent(
                      event.key,
                      event.metaKey === true,
                      event.ctrlKey === true,
                      event.shiftKey === true,
                    ),
                    visible,
                  );
                  if (command?.type === 'context') {
                    const targetHash = flatLogTarget(visible, selected, 'current');
                    const target = visible.find((commit) => commit.hash === targetHash);
                    if (target === undefined) return;
                    event.preventDefault();
                    event.stopPropagation();
                    const row = listRef.current?.querySelector?.(`[data-dsh-log-hash="${target.hash}"]`);
                    const rowRect = row?.getBoundingClientRect?.();
                    const listRect = listRef.current?.getBoundingClientRect?.();
                    onContextMenu?.({
                      commit: target,
                      selectionHashes: contextSelectionFor(target.hash),
                      x: Math.max(4, rowRect?.left ?? listRect?.left ?? 4),
                      y: rowRect?.bottom ?? listRect?.top ?? 0,
                    });
                    return;
                  }
                  if (command?.type === 'selectAll') {
                    event.preventDefault();
                    event.stopPropagation();
                    selectionAnchorRef.current = command.hashes[0] ?? '';
                    onSelectCommits?.(command.hashes);
                    return;
                  }
                  if (command?.type === 'relation') {
                    const target = commitRelationTarget(visible, selected, command.direction);
                    if (target === null) return;
                    event.preventDefault();
                    event.stopPropagation();
                    onShow?.(target.hash);
                    return;
                  }
                  if (command?.type !== 'row') return;
                  event.preventDefault();
                  event.stopPropagation();
                  const target = flatLogTarget(visible, selected, command.action);
                  if (target !== null) {
                    const commit = visible.find((entry) => entry.hash === target) ?? null;
                    if (commit !== null) {
                      const next = commitSelectionAfterClick(
                        visible.map((entry) => entry.hash),
                        selectedCommits,
                        target,
                        {
                          shift: event.shiftKey === true,
                        },
                        selectionAnchorRef.current,
                      );
                      selectionAnchorRef.current = next.anchor;
                      onSelectCommits?.(next.selected);
                    }
                    onShow?.(target);
                  }
                }
          }>
          <CommitLogListState
            section='status'
            t={t}
            loading={loading}
            logFailure={logFailure}
            graphMode={graphMode}
            commitCount={commits.length}
            visibleCount={visible.length}
            exhausted={exhausted === true}
            onRetry={retryList}
          />
          {graphMode ? (
            <CommitGraph
              t={t}
              graph={graph}
              error={logFailure}
              onShow={onShow}
              selected={graphHover ?? graphCursor ?? selected}
              selectionHashes={selectedCommits}
              onRowClick={selectGraphCommitRow}
              onSelect={setGraphHover}
              folded={graphFolded}
              onToggleFolded={() => {
                const next = commitLogGraphFoldToggle(graphFolded);
                setGraphFolded(next.folded);
                if (next.clearHover) setGraphHover(null);
              }}
              onPickRef={(ref) => {
                onGraphRef?.(ref);
                window.setTimeout(() => listRef.current?.focus?.({ preventScroll: true }), 0);
              }}
              onContextMenu={(payload) => {
                listRef.current?.focus?.({
                  preventScroll: true,
                });
                setGraphCursor(payload.commit.hash);
                setGraphHover(null);
                onContextMenu?.(payload);
              }}
            />
          ) : null}
          {graphMode
            ? null
            : visible.map((commit) => (
                <CommitLogFlatRow
                  key={commit.hash}
                  t={t}
                  commit={commit}
                  selectionIncluded={selectedCommits.includes(commit.hash)}
                  highlighted={highlighted === commit.hash}
                  rowRef={selected === commit.hash ? scrollGraphRowIntoView : undefined}
                  onMouseDown={() =>
                    listRef.current?.focus?.({
                      preventScroll: true,
                    })
                  }
                  onClick={(event) =>
                    selectCommitRow(
                      visible.map((entry) => entry.hash),
                      commit.hash,
                      event,
                    )
                  }
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    listRef.current?.focus?.({
                      preventScroll: true,
                    });
                    const context = commitLogContextSelection(selectedCommits, commit.hash);
                    if (context.selectClicked) {
                      selectionAnchorRef.current = context.anchor;
                      onSelectCommits?.(context.selectionHashes);
                    }
                    onShow(commit.hash);
                    onContextMenu?.({
                      commit,
                      selectionHashes: context.selectionHashes,
                      x: event.clientX,
                      y: event.clientY,
                    });
                  }}
                />
              ))}
          <CommitLogListState
            section='footer'
            t={t}
            loading={loading}
            logFailure={logFailure}
            graphMode={graphMode}
            commitCount={commits.length}
            visibleCount={visible.length}
            exhausted={exhausted === true}
            onRetry={retryList}
          />
        </div>
      </div>
      <CommitLogDetailPane
        t={t}
        detail={detail}
        historyPath={historyPath ?? null}
        onClearHistory={onClearHistory}
        localFileAvailability={localFileAvailability}
        detailScrollRef={detailScrollRef}
        onShowCommitDiff={onShowCommitDiff}
        onEditSource={onEditSource}
        onFileMenu={onFileMenu}
      />
    </div>
  );
}

const CommitLog = CommitLogView;

export { CommitLog };
