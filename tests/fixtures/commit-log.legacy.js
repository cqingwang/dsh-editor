/* find-tool.js CommitLog legacy oracle. */

    function CommitLog({
      t,
      scrollRefs,
      commits,
      loading,
      detail,
      onRefresh,
      onShow,
      onOpenFile,
      onEditSource,
      onShowCommitDiff,
      historyPath,
      onClearHistory,
      author,
      onAuthor,
      onLoadMore,
      exhausted,
      onContextMenu,
      onDirectoryMenu,
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
    }) {
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
      const listRef = React.useRef(null);
      const logScrollRef = scrollRefs?.log ?? null;
      const setLogListRef = React.useCallback((node) => {
        listRef.current = node;
        if (logScrollRef !== null) logScrollRef.current = node;
      }, [logScrollRef]);
      const logFilterInputRef = React.useRef(null);
      /* IDEA's Vcs.Log.FocusTextFilter owns ⌘F inside the Log tab. The filter is
         created lazily, so focus waits for the next render instead of landing on
         a detached node. */
      React.useEffect(() => {
        const onKeyDown = (event) => {
          if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== 'f') return;
          const target = event.target instanceof Element ? event.target : null;
          const active = document.activeElement instanceof Element ? document.activeElement : null;
          const panel = target?.closest('[data-dsh-log-panel]') ?? active?.closest('[data-dsh-log-panel]');
          if (panel === null || panel === undefined) return;
          event.preventDefault();
          event.stopPropagation();
          setShowFilter(true);
          window.setTimeout(() => {
            logFilterInputRef.current?.focus();
            logFilterInputRef.current?.select();
          }, 0);
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
      }, []);
      const [localFileAvailability, setLocalFileAvailability] = React.useState(() => new Map());
      const detailPathKey = detail?.files?.map((file) => file.path).join('\0') ?? '';
      const detailScrollRef = React.useRef(null);
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
        const cleanups = [
          bindShiftWheelScroll(listRef.current),
          bindShiftWheelScroll(detailScrollRef.current),
        ];
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
          callFs({ op: 'exists', paths: localQueryPaths })
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
      const needle = filter.trim().toLowerCase();
      const visible = needle === ''
        ? commits
        : commits.filter((commit) =>
            [commit.subject, commit.author, commit.hash].some((value) => typeof value === 'string' && value.toLowerCase().includes(needle)),
          );
      const graphEntries = graph?.entries ?? [];
      const graphRows = graphDisplayEntries(graphEntries, graphFolded);
      const graphIndex = graphCursor === null ? -1 : graphRows.findIndex((entry) => entry.hash === graphCursor);
      const selectCommitRow = (order, hash, event) => {
        const result = commitSelectionAfterClick(
          order,
          selectedCommits,
          hash,
          { meta: event?.metaKey === true || event?.ctrlKey === true, shift: event?.shiftKey === true },
          selectionAnchorRef.current,
        );
        selectionAnchorRef.current = result.anchor;
        onSelectCommits?.(result.selected);
        onShow?.(hash);
      };
      const selectGraphCommitRow = (entry, event, options) => {
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
          { meta: event?.metaKey === true || event?.ctrlKey === true, shift: event?.shiftKey === true },
          selectionAnchorRef.current,
        );
        selectionAnchorRef.current = result.anchor;
        onSelectCommits?.(result.selected);
        setGraphHover(null);
        setGraphCursor(entry.hash);
        onShow?.(entry.hash);
      };
      const contextSelectionFor = (hash) =>
        selectedCommits.includes(hash) ? selectedCommits : [hash];
      React.useEffect(() => {
        if (!graphMode || typeof selected !== 'string' || selected === '') return;
        if (!graphRows.some((entry) => entry.hash === selected)) return;
        if (graphCursor !== selected) setGraphCursor(selected);
      }, [graphCursor, graph?.entries, graphFolded, graphMode, selected]);
      React.useEffect(() => {
        if (graphRows.length === 0) {
          if (graphCursor !== null) setGraphCursor(null);
          return;
        }
        if (graphCursor !== null && !graphRows.some((entry) => entry.hash === graphCursor)) {
          setGraphCursor(graphRows[0].hash);
        }
      }, [graphCursor, graphFolded, graph?.entries]);
      /**
       * Move the graph cursor by one row, clamped to the loaded page.
       *
       * First ↓ from "no cursor" lands on the first row, which is where the eye
       * already is when the graph opens.
       * @param {number} delta - -1 to go up, 1 to go down.
       * @returns {void}
       */
      const moveGraphCursor = (delta, shiftKey = false) => {
        if (graphRows.length === 0) return;
        /* Start from wherever the user last was — the pointer counts too, so the
           first ↓ after hovering continues from that row instead of jumping home. */
        const hoverIndex = graphHover === null ? -1 : graphRows.findIndex((entry) => entry.hash === graphHover);
        const base = graphIndex >= 0 ? graphIndex : hoverIndex;
        const next = base < 0 ? (delta > 0 ? 0 : graphRows.length - 1) : base + delta;
        const clamped = Math.max(0, Math.min(next, graphRows.length - 1));
        /* The pointer is not where the user is looking any more: drop the hover so
           the keyboard cursor is what the highlight follows. */
        setGraphHover(null);
        setGraphCursor(graphRows[clamped].hash);
        const nextSelection = commitSelectionAfterClick(
          graphRows.map((entry) => entry.hash),
          selectedCommits,
          graphRows[clamped].hash,
          { shift: shiftKey },
          selectionAnchorRef.current,
        );
        selectionAnchorRef.current = nextSelection.anchor;
        onSelectCommits?.(nextSelection.selected);
        /* IDEA's log selects as you walk it: the details pane follows the arrow
           keys, so the commit you are looking at is the one shown below. */
        onShow?.(graphRows[clamped].hash);
      };
      /* IDEA's Log tab stacks the commit table over the details: the tool window is
         narrow, so two side-by-side panes would each be too thin to read. */
      return React.createElement(
        'div',
        { style: styles.commitLogBody, 'data-dsh-log-panel': '' },
        React.createElement(
          'div',
          { style: styles.commitLogList },
          React.createElement(
            'div',
            { style: styles.logToolbar },
            React.createElement('span', { style: styles.panelTitle }, t('editor.tabLog')),
            showFilter
              ? React.createElement('input', {
                  ref: logFilterInputRef,
                  style: styles.findInput,
                  autoFocus: true,
                  title: t('editor.logFilterHint'),
                  placeholder: t('editor.logFilterPlaceholder'),
                  value: filter,
                  onChange: (event) => setFilter(event.target.value),
                  onKeyDown: (event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setFilter('');
                      setShowFilter(false);
                    }
                  },
                })
              : null,
            graphMode
              ? React.createElement(
                  'select',
                  {
                    style: styles.graphBranchSelect,
                    /* A tag-filtered graph has no branch selected; the empty value
                       would otherwise scroll the picker back to "All branches"
                       while the list shows one tag's history. */
                    value: graph?.branch ?? '',
                    'aria-label': t('editor.graphBranch'),
                    title: t('editor.graphBranch'),
                    onChange: (event) => onGraphBranch?.(event.target.value),
                  },
                  React.createElement('option', { value: '' }, t('editor.graphAllBranches')),
                  (graph?.branchList ?? []).map((name) => React.createElement('option', { key: name, value: name }, name)),
                )
              : null,
            graphMode && typeof graph?.at === 'string' && graph.at !== ''
              ? React.createElement(
                  'span',
                  { style: styles.graphScopeChip, title: graph.at },
                  t('editor.graphAtChip', { hash: graph.at.slice(0, 7) }),
                  React.createElement(
                    'button',
                    {
                      type: 'button',
                      style: styles.historyChipClear,
                      'aria-label': t('editor.graphClearScope'),
                      onClick: () => onGraphBranch?.(''),
                    },
                    '×',
                  ),
                )
              : null,
            React.createElement('span', { style: styles.toolbarSpacer }),
            React.createElement('input', {
              style: { ...styles.findInput, width: 96 },
              placeholder: t('editor.logAuthorPlaceholder'),
              value: author ?? '',
              'aria-label': t('editor.logAuthor'),
              onChange: (event) => onAuthor?.(event.target.value),
            }),
            React.createElement(ToolbarButton, {
              icon: 'search',
              label: t('editor.logFilter'),
              onClick: () => {
                const next = !showFilter;
                setShowFilter(next);
                if (next) {
                  window.setTimeout(() => {
                    logFilterInputRef.current?.focus();
                    logFilterInputRef.current?.select();
                  }, 0);
                } else {
                  /* Hiding the field must not leave an invisible filter active. */
                  setFilter('');
                }
              },
            }),
            React.createElement(ToolbarButton, { icon: 'graph', label: t('editor.logGraph'), onClick: () => {
              const next = !graphMode;
              setGraphMode(next);
              if (next) {
                onLoadGraph?.(graph?.branch ?? '', graph?.at ?? '');
                /* IDEA's log takes the keyboard when it opens: ↑/↓ must work
                   without first clicking a row. The list owns the key handler,
                   so it needs focus even before the first page arrives. */
                window.setTimeout(() => listRef.current?.focus?.(), 0);
              }
            } }),
            React.createElement(ToolbarButton, { icon: 'refresh', label: t('editor.refresh'), onClick: () => onRefresh() }),
          ),
          React.createElement(
            'div',
            {
              /* Keyboard focus must not paint a bright ring around the whole log;
                 IDEA marks the selected row, not the list container. */
              style: graphMode ? { ...styles.commitScroll, outline: 'none' } : styles.commitScroll,
              className: 'dsh-editor-tool-scroll',
              ref: setLogListRef,
              tabIndex: 0,
              role: 'listbox',
              'aria-label': t('editor.tabLog'),
              /* IDEA pages the log in as you reach the end of the list. */
              onScroll: (event) => {
                const node = event.currentTarget;
                if (node.scrollHeight - node.scrollTop - node.clientHeight > 48) return;
                onLoadMore?.();
              },
              onKeyDown: graphMode
                ? (event) => {
                    if (event.key === 'ContextMenu' || (event.shiftKey === true && event.key === 'F10')) {
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
                    const keys = graphRows;
                    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                      const target = commitRelationTarget(
                        keys,
                        graphCursor ?? selected,
                        event.key === 'ArrowRight' ? 'parents' : 'children',
                      );
                      if (target === null) return;
                      event.preventDefault();
                      event.stopPropagation();
                      setGraphHover(null);
                      setGraphCursor(target.hash);
                      const next = commitSelectionAfterClick(
                        keys.map((entry) => entry.hash),
                        selectedCommits,
                        target.hash,
                        { shift: event.shiftKey === true },
                        selectionAnchorRef.current,
                      );
                      selectionAnchorRef.current = next.anchor;
                      onSelectCommits?.(next.selected);
                      onShow?.(target.hash);
                      return;
                    }
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                      event.preventDefault();
                      moveGraphCursor(event.key === 'ArrowDown' ? 1 : -1, event.shiftKey === true);
                    } else if (event.key === 'Enter') {
                      if (graphIndex < 0) return;
                      event.preventDefault();
                      onShow?.(graphRows[graphIndex].hash);
                    } else if (event.key === 'Home' || event.key === 'End') {
                      if (graphRows.length === 0) return;
                      event.preventDefault();
                      setGraphCursor(graphRows[event.key === 'Home' ? 0 : graphRows.length - 1].hash);
                      onSelectCommits?.([graphRows[event.key === 'Home' ? 0 : graphRows.length - 1].hash]);
                      onShow?.(graphRows[event.key === 'Home' ? 0 : graphRows.length - 1].hash);
                    }
                  }
                : (event) => {
                    if (event.key === 'ContextMenu' || (event.shiftKey === true && event.key === 'F10')) {
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
                    if ((event.metaKey === true || event.ctrlKey === true) && event.key.toLowerCase() === 'a') {
                      event.preventDefault();
                      event.stopPropagation();
                      const hashes = visible.map((commit) => commit.hash);
                      selectionAnchorRef.current = hashes[0] ?? '';
                      onSelectCommits?.(hashes);
                      return;
                    }
                    const keys = visible;
                    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                      const target = commitRelationTarget(
                        keys,
                        selected,
                        event.key === 'ArrowRight' ? 'parents' : 'children',
                      );
                      if (target === null) return;
                      event.preventDefault();
                      event.stopPropagation();
                      onShow?.(target.hash);
                      return;
                    }
                    const action = event.key === 'ArrowDown'
                      ? 'next'
                      : event.key === 'ArrowUp'
                        ? 'previous'
                        : event.key === 'Home'
                          ? 'first'
                          : event.key === 'End'
                            ? 'last'
                            : event.key === 'Enter'
                              ? 'current'
                              : null;
                    if (action === null) return;
                    event.preventDefault();
                    event.stopPropagation();
                    const target = flatLogTarget(visible, selected, action);
                    if (target !== null) {
                      const commit = visible.find((entry) => entry.hash === target) ?? null;
                      if (commit !== null) {
                        const next = commitSelectionAfterClick(
                          visible.map((entry) => entry.hash),
                          selectedCommits,
                          target,
                          { shift: event.shiftKey === true },
                          selectionAnchorRef.current,
                        );
                        selectionAnchorRef.current = next.anchor;
                        onSelectCommits?.(next.selected);
                      }
                      onShow?.(target);
                    }
                  },
            },
            loading ? React.createElement('div', { style: styles.treeMessage }, t('editor.loading')) : null,
            /* A failed request must not look like an empty history: IDEA keeps the
               error in the log's status line and offers a retry. */
            logFailure !== null && !loading
              ? React.createElement(
                  'div',
                  { style: styles.logErrorRow, role: 'alert' },
                  React.createElement('span', { style: styles.logErrorText }, t('editor.logFailed', { message: logFailure })),
                  React.createElement(
                    'button',
                    { type: 'button', style: styles.conflictAction, onClick: () => onRetry?.() },
                    t('editor.logRetry'),
                  ),
                )
              : null,
            graphMode
              ? React.createElement(CommitGraph, {
                  t,
                  graph,
                  onShow,
                  selected: graphHover ?? graphCursor ?? selected,
                  selectionHashes: selectedCommits,
                  onRowClick: selectGraphCommitRow,
                  onSelect: setGraphHover,
                  folded: graphFolded,
                  onToggleFolded: () => {
                    setGraphFolded((current) => !current);
                    setGraphHover(null);
                  },
                  onPickRef: onGraphRef,
                  onContextMenu: (payload) => {
                    setGraphCursor(payload.commit.hash);
                    setGraphHover(null);
                    onContextMenu?.(payload);
                  },
                })
              : null,
            graphMode ? null : commits.length > 0 && visible.length === 0 ? React.createElement('div', { style: styles.treeMessage }, t('editor.noMatches')) : null,
            /* The empty log only claims "no commits" when the request succeeded;
               otherwise the banner above already says what went wrong. */
            graphMode ? null : commits.length === 0 && !loading && logFailure === null ? React.createElement('div', { style: styles.treeMessage }, t('editor.noCommits')) : null,
            graphMode ? null : visible.map((commit) =>
              React.createElement(
                'div',
                {
                  key: commit.hash,
                  className: 'dsh-editor-commit-row',
                  /* The tooltip is the only place the log can advertise its right-click
                     actions; a bare hash tells the user nothing about what is available. */
                  title: `${commit.hash}\n${t('editor.logRowHint')}`,
                  ref: selected === commit.hash ? scrollGraphRowIntoView : null,
                  role: 'option',
                  'data-dsh-log-hash': commit.hash,
                  'aria-haspopup': 'menu',
                  'aria-selected': selectedCommits.includes(commit.hash),
                  onMouseDown: () => listRef.current?.focus?.({ preventScroll: true }),
                  onClick: (event) => selectCommitRow(visible.map((entry) => entry.hash), commit.hash, event),
                  /* The detail pane says which commit it belongs to; without this the
                     list and the pane can disagree and the user cannot tell which
                     row is showing below. */
                  style: {
                    ...styles.commitFileRow,
                    paddingLeft: 10,
                    alignItems: 'flex-start',
                    height: 'auto',
                    paddingTop: 5,
                    paddingBottom: 5,
                    ...(selectedCommits.includes(commit.hash) ? styles.commitGraphRowActive : null),
                  },
                  /* The row we just committed stays tinted until another commit happens. */
                  ...(highlighted === commit.hash ? { 'data-dsh-log-new': '' } : null),
                  onContextMenu: (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const selectionHashes = contextSelectionFor(commit.hash);
                    if (!selectedCommits.includes(commit.hash)) {
                      selectionAnchorRef.current = commit.hash;
                      onSelectCommits?.([commit.hash]);
                    }
                    onShow(commit.hash);
                    onContextMenu?.({ commit, selectionHashes, x: event.clientX, y: event.clientY });
                  },
                },
                React.createElement('span', { style: styles.logHash }, commit.hash.slice(0, 7)),
                React.createElement(
                  'span',
                  { style: { minWidth: 0, flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: 2 } },
                  React.createElement('span', { style: styles.logSubject }, commit.subject),
                  React.createElement('span', { style: styles.logMeta }, `${commit.author} · ${formatCommitDate(commit.date)}`),
                ),
              ),
            ),
            exhausted === true && visible.length > 0
              ? React.createElement('div', { style: styles.treeMessage }, t('editor.logEnd'))
              : null,
          ),
        ),
        React.createElement(
          'div',
          { style: styles.commitLogDetail },
          React.createElement(
            'div',
            { style: styles.logToolbar },
            React.createElement('span', { style: styles.panelTitle }, t('editor.commitDetails')),
            historyPath === null
              ? null
              : React.createElement(
                  'span',
                  { style: styles.historyChip, title: historyPath },
                  `${t('editor.fileHistory')}: ${basename(historyPath)}`,
                  /* IDEA's Log tab spells the way out: a `×` alone reads as "close the
                     chip", not "go back to the whole history". */
                  React.createElement(
                    'button',
                    {
                      type: 'button',
                      style: styles.historyChipShowAll,
                      title: t('editor.historyShowAll'),
                      onClick: () => onClearHistory?.(),
                    },
                    t('editor.historyShowAll'),
                  ),
                  React.createElement(
                    'button',
                    {
                      type: 'button',
                      style: styles.historyChipClear,
                      'aria-label': t('editor.clearHistory'),
                      title: t('editor.clearHistory'),
                      onClick: () => onClearHistory?.(),
                    },
                    '×',
                  ),
                ),
          ),
          React.createElement(
            'div',
            {
              ref: detailScrollRef,
              style: styles.commitScroll,
              className: 'dsh-editor-tool-scroll',
              tabIndex: 0,
              role: 'region',
              'aria-label': t('editor.commitDetails'),
            },
            detail === null
              ? React.createElement('div', { style: styles.treeMessage }, t('editor.selectCommit'))
              : React.createElement(
                  'div',
                  { style: styles.logDetail },
                  React.createElement('div', { style: styles.logSubject }, detail.subject),
                  React.createElement('div', { style: styles.logMeta }, `${detail.author} · ${formatCommitDate(detail.date)}`),
                  detail.body === '' ? null : React.createElement('pre', { style: styles.logBody }, detail.body),
                  React.createElement(
                    'div',
                    { style: styles.logFiles },
                    detail.files.map((file) =>
                      (() => {
                        const localExists = localFileAvailability.get(file.path) !== false;
                        const localDirExists = localFileAvailability.get(dirname(file.path)) !== false;
                        return React.createElement(
                        'div',
                        {
                          key: `${file.status}:${file.path}`,
                          style: styles.logFileRow,
                          className: 'dsh-editor-commit-row',
                          tabIndex: 0,
                          title: `${file.path} — ${t('editor.openAtRevision')}`,
                          /* IDEA opens the commit's diff on click; double-click opens the working copy. */
                          onClick: () => onShowCommitDiff?.({ hash: detail.hash, path: file.path }),
                          onDoubleClick: () => {
                            if (localExists) onEditSource?.(file.path);
                          },
                          onKeyDown: (event) => {
                            if (
                              event.key === 'F4'
                              && !event.metaKey
                              && !event.ctrlKey
                              && !event.altKey
                              && !event.shiftKey
                            ) {
                              if (!localExists) return;
                              event.preventDefault();
                              event.stopPropagation();
                              onEditSource?.(file.path);
                              return;
                            }
                            if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
                            event.preventDefault();
                            event.stopPropagation();
                            event.currentTarget.focus?.();
                            const rect = event.currentTarget.getBoundingClientRect();
                            onFileMenu?.({ path: file.path, hash: detail.hash, localExists, localDirExists, x: rect.left + 12, y: rect.bottom });
                          },
                          /* Right-click offers "Select in Project View": the working copy
                             is what the tree can show, not the revision's version. */
                          onContextMenu: (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            event.currentTarget.focus?.();
                            onFileMenu?.({ path: file.path, hash: detail.hash, localExists, localDirExists, x: event.clientX, y: event.clientY });
                          },
                        },
                        React.createElement('span', { style: { ...styles.statusBadge, color: gitStatusInfo(file.status)?.color ?? 'inherit' } }, file.status),
                        React.createElement('span', { style: styles.logFilePath }, file.path),
                        );
                      })(),
                    ),
                  ),
                ),
          ),
        ),
      );
    }

/* COMMIT_LOG_BOUNDARY */

    /** Compact absolute time for the log rows. */
    function formatCommitDate(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      const pad = (number) => String(number).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }
