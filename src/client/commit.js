/* commit.js: dsh-editor client module. Generated into lib/client.js by scripts/build-client.mjs. */
    function CommitPanel({
      t,
      git,
      selectedPaths,
      message,
      amend,
      busy,
      error,
      onRetryStatus,
      notice,
      diffTarget,
      selectedChange,
      selectedGroup,
      selectedChanges,
      chosenChangeList = [],
      collapsedGroups,
      monacoReady,
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
      onRestoreScroll,
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
    }) {
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
        const onKeyDown = (event) => {
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
      const changes = git?.changes ?? [];
      const changesByPath = new Map(changes.map((change) => [change.path, change]));
      const stageAllTrackedPaths = stageAllTargets(changes, true);
      const { staged, unstaged, unversioned } = splitChanges(changes);
      const groups = [
        { id: 'staged', label: t('editor.stagedGroup'), changes: staged },
        { id: 'unstaged', label: t('editor.unstagedGroup'), changes: unstaged },
        { id: 'unversioned', label: t('editor.unversionedGroup'), changes: unversioned },
      ].filter((group) => group.changes.length > 0 || group.id !== 'unversioned');
      /* IDEA's change-list search narrows what is SHOWN, never what is ticked:
         filtering the selection too would quietly change what gets committed. */
      const visibleGroups = groups
        .map((group) => ({ ...group, changes: filterChanges(group.changes, pathQuery) }))
        .filter((group) => group.changes.length > 0 || pathQuery === '');
      const filteredTargets = React.useMemo(
        () => changeFilterTargets(visibleGroups),
        [git, groupBy, pathQuery],
      );
      /* Typing in the Changes filter must move the current row onto a visible
         target. Leaving it on a filtered-out row made Show Diff, Stage and
         Rollback act on an item the user could no longer see. */
      React.useEffect(() => {
        if (pathQuery.trim() === '') return;
        if (filteredTargets.length === 0) {
          if (selectedGroup !== null) onSelectGroup?.(null);
          return;
        }
        const selectedVisible = filteredTargets.some((target) =>
          target.path === selectedChange?.path && target.staged === (selectedChange?.staged === true),
        );
        if (selectedVisible) return;
        onRevealChange?.(filteredTargets[0]);
        onSelectChange?.({ path: filteredTargets[0].path, staged: filteredTargets[0].staged });
      }, [filteredTargets, onRevealChange, onSelectChange, onSelectGroup, pathQuery, selectedChange, selectedGroup]);
      const allSelected = changes.length > 0 && changes.every((change) => selectedPaths.has(change.path));
      const branchText = branchLabel(git);
      const fileCountText = (count) => count === 1 ? '1 file' : t('editor.filesCount', { count });
      /* A detached HEAD cannot be pushed or updated; say why in the toolbar too. */
      const detached = git?.detached === true;
      const ahead = git?.ahead ?? 0;
      const behind = git?.behind ?? 0;

      /**
       * Sum one band's line counts for the group header, IDEA's `+12 −3`.
       *
       * Binary rows contribute nothing (they have no numbers), and a band with
       * no readings at all stays blank rather than claiming zero changes.
       * @param {{id: string, changes: object[]}} group - band being rendered.
       * @returns {object|undefined} summed counts, or undefined when unknown.
       */
      const groupTotals = (group) => subtotalOf(group.changes, group.id);

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
        const key = selectedChange === null
          ? null
          : `${selectedChange.staged === true ? 'staged' : 'unstaged'}:${selectedChange.path}`;
        const row = key === null ? null : changeRowRefs?.current?.get(key) ?? null;
        const tree = scrollRefs?.changes?.current ?? null;
        window.setTimeout(() => {
          const target = row !== null && row.isConnected ? row : tree;
          target?.focus?.();
        }, 0);
      };

      const renderGroup = (group, groupIndex) => {
        const tree = changeTreeOf(group.changes, groupingDepth(groupBy));
        /* A group folds as a whole, keyed by the bare group id: IDEA's root row
           ("Changes 5 files") is a tree node with its own chevron, and folding it
           leaves just that row. Directory keys stay `<group>:<path>`, so a group
           key can never collide with one of its own children. */
        const groupKey = `${group.id}:`;
        const groupOpen = !collapsedGroups.has(groupKey);
        const rows = groupOpen ? flattenChangeTree(tree, collapsedGroups, group.id) : [];
        const selectedInGroup = group.changes.filter((change) => selectedPaths.has(change.path)).map((change) => change.path);
        const groupState = selectionStateOf(group.changes.map((change) => change.path), selectedPaths);
        const removableInGroup = group.id === 'unstaged'
          ? pathsScheduledForRemoval(
              selectedInGroup.map((path) => ({ path, staged: false })),
              changesByPath,
            )
          : [];
        const removalOnlyInGroup = selectedInGroup.length > 0 && removableInGroup.length === selectedInGroup.length;
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
            ? [{
                id: `removeDeleted:${group.id}`,
                icon: 'remove',
                label: t('editor.removeFromVcs'),
                disabled: false,
                run: () => onStage(removableInGroup),
              }]
            : []),
          {
            id: 'copyPatchToClipboard',
            icon: 'file',
            label: t('editor.copyPatchToClipboard'),
            disabled: selectedInGroup.length === 0,
            run: () => onCopyPatch?.(selectedInGroup.map((path) => ({ path, staged: group.id === 'staged' }))),
          },
          {
            id: 'createPatchFromChanges',
            icon: 'file',
            label: t('editor.createPatchFromChanges'),
            disabled: selectedInGroup.length === 0,
            run: () => onCreatePatch?.(selectedInGroup.map((path) => ({ path, staged: group.id === 'staged' }))),
          },
          ...(group.id === 'unversioned'
            ? [{
                id: 'gitignore',
                icon: 'ignore',
                label: t('editor.addToGitignore'),
                disabled: selectedInGroup.length === 0,
                run: () => onGitignore(selectedInGroup),
              }]
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
            label: group.id === 'staged'
              ? t('editor.rollbackStaged')
              : group.id === 'unversioned'
                ? selectedInGroup.length > 1
                  ? t('editor.rollbackUnversionedCount', { count: selectedInGroup.length })
                  : t('editor.rollbackUnversioned')
                : selectedInGroup.length > 1
                  ? t('editor.rollbackWorkingCount', { count: selectedInGroup.length })
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
        return React.createElement(
          React.Fragment,
          { key: group.id },
          React.createElement(
            'div',
            {
              className: 'dsh-editor-change-tree-row',
              style: {
                ...styles.commitGroupHeader,
                ...(selectedGroup === group.id ? styles.commitFileRowSelected : null),
              },
              role: 'treeitem',
              tabIndex: selectedGroup === group.id ? 0 : -1,
              'aria-selected': selectedGroup === group.id,
              'aria-expanded': groupOpen,
              'aria-level': 1,
              'aria-posinset': groupIndex + 1,
              'aria-setsize': visibleGroups.length,
              'data-dsh-change-group': group.id,
              onClick: (event) => {
                if (event.target instanceof Element && event.target.closest('input, button, [role="button"]') !== null) return;
                onSelectGroup?.(group.id);
              },
              onKeyDown: (event) => {
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
                }
              },
              onContextMenu: (event) => {
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
              },
            },
            /* IDEA's chevron sits BEFORE the checkbox on every tree node; the
               header is a node, not a caption. Clicking the chevron folds the
               group, clicking anywhere else on the row selects the group. */
            React.createElement(
              'span',
              {
                style: styles.commitChevron,
                role: 'button',
                tabIndex: -1,
                'aria-label': groupOpen
                  ? t('editor.collapseGroupNamed', { group: group.label })
                  : t('editor.expandGroupNamed', { group: group.label }),
                'aria-expanded': groupOpen,
                onClick: (event) => {
                  event.stopPropagation();
                  onToggleDirectory(groupKey);
                },
              },
              React.createElement(Icon, { name: groupOpen ? 'chevronDown' : 'chevronRight', size: 10 }),
            ),
            React.createElement('input', {
              type: 'checkbox',
              className: 'dsh-editor-checkbox',
              style: styles.checkbox,
              checked: groupState === 'all',
              ref: (element) => {
                if (element !== null) element.indeterminate = groupState === 'some';
              },
              disabled: group.changes.length === 0,
              onChange: () => onToggleGroup(group.id),
              'aria-label': t('editor.selectGroupFiles', { group: group.label }),
            }),
            React.createElement('span', { style: styles.commitGroupLabel }, group.label),
            /* IDEA words the count ("5 files"), not a bare `5`: a digit alone next
               to a bold title reads as part of the title. */
            React.createElement(
              'span',
              {
                className: groupActions.length > 1 ? 'dsh-editor-commit-group-header-count' : undefined,
                style: styles.commitGroupFiles,
              },
              fileCountText(group.changes.length),
            ),
            React.createElement(LineCounts, { counts: groupTotals(group) }),
            React.createElement('span', { style: styles.toolbarSpacer }),
            groupActions.length > 1
              ? React.createElement(
                  React.Fragment,
                  null,
                  groupActions.map((action) =>
                    React.createElement(
                      'span',
                      {
                        key: action.id,
                        className: 'dsh-editor-commit-group-actions-wide',
                        style: { display: 'contents' },
                      },
                      React.createElement(ToolbarButton, {
                        icon: action.icon,
                        label: action.label,
                        disabled: action.disabled,
                        onClick: action.run,
                      }),
                    ),
                  ),
                  React.createElement(
                    'span',
                    {
                      className: 'dsh-editor-commit-group-actions-narrow',
                      style: { display: 'none' },
                    },
                    React.createElement(ToolbarButton, {
                      icon: 'more',
                      label: t('editor.moreActionsFor', { group: group.label }),
                      ariaHasPopup: 'menu',
                      ariaExpanded: groupActionMenu?.owner === `group-actions:${group.id}`,
                      onClick: (event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        setGroupActionMenu({
                          x: Math.max(4, rect.right - 188),
                          y: rect.bottom + 4,
                          title: group.label,
                          items: groupMenuItems,
                          owner: `group-actions:${group.id}`,
                        });
                      },
                    }),
                  ),
                )
              : React.createElement(ToolbarButton, {
                  key: groupActions[0].id,
                  icon: groupActions[0].icon,
                  label: groupActions[0].label,
                  disabled: groupActions[0].disabled,
                  onClick: groupActions[0].run,
                }),
          ),
          rows.length === 0
            ? (groupOpen ? React.createElement('div', { style: styles.commitGroupEmpty }, t('editor.emptyGroup')) : null)
            : rows.map((row, rowIndex) => {
                if (row.kind === 'directory') {
                  const inside = (row.changes ?? []).map((change) => change.path);
                  const state = selectionStateOf(inside, selectedPaths);
                  return React.createElement(
                    'div',
                    {
                      key: `${group.id}:${row.path}`,
                      className: 'dsh-editor-change-tree-row',
                      /* Files and folders share one grid. IDEA's change tree reads
                         as columns (disclosure, checkbox, icon, name, parent,
                         counts), so a long name in one row must not move the
                         count column in another. */
                      style: { ...styles.commitTreeNode, paddingLeft: 22 + row.depth * 14 },
                      role: 'treeitem',
                      'aria-expanded': row.open,
                      'data-dsh-change-directory': row.path,
                      'aria-level': row.depth + 2,
                      'aria-posinset': rowIndex + 1,
                      'aria-setsize': rows.length,
                      tabIndex: -1,
                      /* ⌥-click flips the whole subtree, IDEA's tree gesture; a plain
                         click keeps toggling just this level. */
                      onClick: (event) => {
                        if (event.altKey === true) onToggleDirectory(collapseKeysOf(tree, group.id, row.path));
                        else onToggleDirectory(row.collapseKey);
                      },
                      /* IDEA acts on a directory's whole subtree from its context menu. */
                      onContextMenu: (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        /* `row.changes` holds the change OBJECTS; `inside` is only their
                           paths, and the menu needs the objects to collect paths itself. */
                        onContextMenu?.({ directory: row.path, changes: row.changes ?? [], group: group.id, x: event.clientX, y: event.clientY });
                      },
                      onKeyDown: (event) => {
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
                      },
                    },
                    /* Chevron FIRST, then checkbox: IDEA indents its tree with the
                       disclosure arrow in the leading gutter, so a directory's box
                       lines up with the boxes of the files below it only when the
                       arrow owns the left edge. */
                    React.createElement(
                      'span',
                      { style: styles.commitChevron },
                      React.createElement(Icon, { name: row.open ? 'chevronDown' : 'chevronRight', size: 10 }),
                    ),
                    React.createElement('input', {
                      type: 'checkbox',
                      className: 'dsh-editor-checkbox',
                  style: styles.checkbox,
                      checked: state === 'all',
                      /* Only a partially ticked directory gets the dash; `indeterminate`
                         is a DOM property, so it has to be set through a ref. */
                      ref: (element) => {
                        if (element !== null) element.indeterminate = state === 'some';
                      },
                      'aria-label': group.id === 'staged'
                        ? t('editor.unstageDirectoryFiles', { path: row.path })
                        : group.id === 'unversioned'
                          ? t('editor.addDirectoryToVcs', { path: row.path })
                          : t('editor.stageDirectoryFiles', { path: row.path }),
                      onClick: (event) => event.stopPropagation(),
                      onChange: () => {
                        /* A full (or partial) directory clears; an empty one fills — IDEA's
                           checkbox toggles the whole subtree, never a single file. */
                        if (group.id === 'staged') onUnstage(inside);
                        else onStage(inside);
                      },
                    }),
                    React.createElement(EntryIcon, {
                      entry: { path: row.path, kind: 'directory', root: false },
                      expanded: row.open,
                    }),
                    React.createElement(
                      'span',
                      { style: styles.commitNodeName },
                      React.createElement('span', { style: styles.commitDirName }, row.name),
                      React.createElement(
                        'span',
                        { style: styles.commitGroupFiles },
                        fileCountText(inside.length),
                      ),
                    ),
                    /* IDEA puts the parent path after the name ("spark  doc"),
                       which is how two same-named folders are told apart. */
                    row.parent === ''
                      ? null
                      : React.createElement('span', { style: styles.commitFileDir }, row.parent),
                    /* IDEA's directory node carries the same +N −M subtotal as the group header. */
                    React.createElement(LineCounts, { counts: subtotalOf(row.changes, group.id) }),
                  );
                }
                const change = row.change;
                const checked = selectedPaths.has(change.path);
                const conflict = isConflict(change);
                const selectedForDiff = diffTarget !== null && diffTarget.path === change.path && diffTarget.staged === (group.id === 'staged');
                const selectedForChange = selectedChange !== null && selectedChange.path === change.path
                  && selectedChange.staged === (group.id === 'staged');
                const changeKey = `${group.id === 'staged' ? 'staged' : 'unstaged'}:${change.path}`;
                const selectedInRange = selectedChanges instanceof Set && selectedChanges.has(changeKey);
                return React.createElement(
                  'div',
                  {
                    key: `${group.id}:${change.path}`,
                    ref: (element) => {
                      const key = `${group.id}:${change.path}`;
                      if (element === null) changeRowRefs.current.delete(key);
                      else changeRowRefs.current.set(key, element);
                    },
                    className: [
                      'dsh-editor-change-tree-row',
                      'dsh-editor-commit-row',
                      conflict ? 'dsh-editor-commit-row-conflict' : '',
                      selectedForChange ? 'dsh-editor-commit-row-selected' : '',
                      selectedInRange ? 'dsh-editor-commit-row-range' : '',
                      selectedForDiff ? 'dsh-editor-commit-row-active' : '',
                    ].filter(Boolean).join(' '),
                    role: 'treeitem',
                    'aria-level': row.depth + 2,
                    'aria-posinset': rowIndex + 1,
                    'aria-setsize': rows.length,
                    'aria-selected': selectedForChange,
                    style: {
                      ...styles.commitTreeNode,
                      ...styles.commitFileRow,
                      /* IDEA indents nested files below their expanded folder;
                         the disclosure gutter still owns the leading column. */
                      paddingLeft: 22 + row.depth * 14,
                      ...(conflict ? styles.commitFileRowConflict : null),
                      ...(selectedForChange ? styles.commitFileRowSelected : null),
                      ...(selectedInRange && !selectedForChange ? styles.commitFileRowRange : null),
                      ...(selectedForDiff ? styles.commitFileRowActive : null),
                    },
                    /* The name is never ellipsized, so a pathologically long name in
                       a very narrow tool window is the one case where the row can be
                       wider than the pane; the tooltip still spells the full path
                       out. */
                    ref: (element) => {
                      const key = `${group.id}:${change.path}`;
                      if (element === null) changeRowRefs.current.delete(key);
                      else changeRowRefs.current.set(key, element);
                    },
                    title: change.path,
                    'data-dsh-change-path': change.path,
                    'data-dsh-change-staged': group.id === 'staged',
                    tabIndex: selectedForChange ? 0 : -1,
                    onKeyDown: (event) => {
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
                    },
                    onKeyUp: (event) => onChangesKeyUp?.(event),
                    onClick: (event) => onSelectChange?.({
                      path: change.path,
                      staged: group.id === 'staged',
                      shift: event.shiftKey,
                      toggle: event.metaKey || event.ctrlKey,
                      row: event.currentTarget,
                    }),
                    onDoubleClick: (event) => {
                      if (event.target instanceof Element && event.target.closest('input, button, a, [role="checkbox"]') !== null) return;
                      onSelectDiff?.({ path: change.path, staged: group.id === 'staged' });
                    },
                    onContextMenu: (event) => {
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
                      onContextMenu({
                        change,
                        staged: group.id === 'staged',
                        selectedChanges: insideSelection
                          ? selectedChanges
                          : new Set([changeKey]),
                        x: event.clientX,
                        y: event.clientY,
                      });
                    },
                  },
                  React.createElement('span', { style: styles.commitChevron }),
                  React.createElement('input', {
                    type: 'checkbox',
                    className: 'dsh-editor-checkbox',
                    style: styles.checkbox,
                    checked,
                    onChange: () => onTogglePath(change.path),
                    onClick: (event) => event.stopPropagation(),
                    'aria-label': t('editor.includeFileInCommit', { path: change.path, group: group.label }),
                  }),
                  React.createElement(EntryIcon, { entry: { path: change.path, kind: 'file' }, expanded: false }),
                  React.createElement(
                    'span',
                    { style: styles.commitNodeName },
                    React.createElement('span', { style: styles.commitFileName }, row.name),
                    conflict
                      ? React.createElement(
                          'span',
                          { style: styles.conflictChip, title: t('editor.conflictHint') },
                          t('editor.conflictBadge'),
                        )
                      : null,
                  ),
                  /* The parent path sits right after the name, the way IDEA prints
                     `engineering-memory.md  doc/spark`: it identifies the row, so it
                     belongs next to the name rather than across a gap. `01` is the
                     *dir* form, not `dirname()`: a row that already shows `r147nest`
                     under `deep/inner` looked like it lived in the parent of its
                     own folder. `/` is what IDEA prints for a root-level file. */
                  React.createElement('span', { style: styles.commitFileDir }, parentDirLabel(change.path) || projectName),
                  /* The band decides which side of the numstat reading this row shows. */
                  React.createElement(LineCounts, {
                    counts: group.id === 'staged' ? change.stagedLines : group.id === 'unstaged' ? change.unstagedLines : undefined,
                  }),
                );
              }),
        );
      };

      /* IDEA tool-window tabs use one roving tab stop: the selected mode owns
         Tab focus, while arrow/Home/End keys move both selection and focus. */
      const commitModeOrder = ['changes', 'log'];
      const focusCommitModeTab = (nextMode) => {
        const target = commitModeTabsRef.current?.querySelector(`[data-dsh-commit-mode="${nextMode}"]`);
        onMode(nextMode);
        target?.focus?.();
      };
      const moveCommitModeFocus = (currentMode, delta) => {
        const index = commitModeOrder.indexOf(currentMode);
        if (index < 0) return;
        const nextIndex = Math.max(0, Math.min(commitModeOrder.length - 1, index + delta));
        if (nextIndex === index) return;
        focusCommitModeTab(commitModeOrder[nextIndex]);
      };
      const focusBoundaryCommitMode = (edge) => {
        focusCommitModeTab(commitModeOrder[edge === 'first' ? 0 : commitModeOrder.length - 1]);
      };
      const onCommitModeKeyDown = (event, currentMode) => {
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

      const commitModeTabs = React.createElement(
        'div',
        {
          ref: commitModeTabsRef,
          style: styles.commitToolbarTabs,
          role: 'tablist',
          'aria-label': t('editor.commit'),
        },
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'dsh-editor-commit-mode-tab',
            role: 'tab',
            'aria-selected': mode === 'changes',
            tabIndex: mode === 'changes' ? 0 : -1,
            'data-dsh-commit-mode': 'changes',
            style: { ...styles.commitTab, ...(mode === 'changes' ? styles.commitTabActive : null) },
            onClick: (event) => {
              event.currentTarget.focus?.();
              onMode('changes');
            },
            onKeyDown: (event) => onCommitModeKeyDown(event, 'changes'),
          },
          t('editor.tabChanges'),
          React.createElement('span', { style: styles.commitGroupCount }, String(changes.length)),
        ),
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'dsh-editor-commit-mode-tab',
            role: 'tab',
            'aria-selected': mode === 'log',
            tabIndex: mode === 'log' ? 0 : -1,
            'data-dsh-commit-mode': 'log',
            style: { ...styles.commitTab, ...(mode === 'log' ? styles.commitTabActive : null) },
            onClick: (event) => {
              event.currentTarget.focus?.();
              onMode('log');
            },
            onKeyDown: (event) => onCommitModeKeyDown(event, 'log'),
          },
          t('editor.tabLog'),
        ),
      );

      return React.createElement(
        React.Fragment,
        null,
        React.createElement(PanelToolbar, {
          t,
          ariaLabel: t('editor.commit'),
          titleAction: commitModeTabs,
          titleActionStyle: styles.commitToolbarTitleAction,
          /* IDEA shows the current branch in the commit toolbar; ahead/behind ride along. */
          /* Detached HEAD cannot be pushed or updated; the badge says so rather than
             showing a branch name that would make the buttons look usable. */
          badge: branchText.length === 0
            ? null
            /* The chip already says "detached HEAD"; the badge adds only the hint. */
            : `${branchText}${detached ? ` · ${t('editor.detachedHeadHint')}` : ''}${ahead > 0 || behind > 0 ? ` ↑${ahead} ↓${behind}` : ''}`,
          /* The branch chip doubles as IDEA's branch popup trigger. */
          onBadge: onBranchMenu,
          badgeHasPopup: 'menu',
          badgeExpanded: branchMenuOpen === true,
          right: [
            {
              id: 'options',
              icon: 'settings',
              label: t('editor.options'),
              ariaHasPopup: 'menu',
              ariaExpanded: optionsOpen === true,
              onClick: (event) => {
                const rect = event?.currentTarget?.getBoundingClientRect?.();
                onOptionsMenu?.(rect === undefined ? { x: 240, y: 120 } : { x: rect.left, y: rect.bottom + 4 });
              },
            },
            { id: 'refresh', icon: 'refresh', label: t('editor.refresh'), onClick: onRefresh },
            { id: 'hide', icon: 'hide', label: t('editor.hide'), onClick: onHide },
          ],
        }),
        historyMenu === null
          ? null
          : React.createElement(ContextMenu, { menu: historyMenu, onClose: () => setHistoryMenu(null), t }),
        groupActionMenu === null
          ? null
          : React.createElement(ContextMenu, { menu: groupActionMenu, onClose: () => setGroupActionMenu(null), t }),
        /* Errors and notices belong to the tool window, not to one of its tabs: a failed
           cherry-pick from the Log tab used to produce no feedback at all. */
        error !== null || notice !== null || (pushFailure !== null && pushFailure !== undefined)
          ? React.createElement(
              'div',
              { style: styles.commitStatusStack },
              error !== null
                ? React.createElement(
                    'div',
                    { style: { ...styles.commitError, display: 'flex', alignItems: 'center', gap: 6 } },
                    React.createElement('span', { style: { flex: '1 1 auto', minWidth: 0 } }, error),
                    onRetryStatus === undefined
                      ? null
                      : React.createElement(
                          'button',
                          { type: 'button', style: styles.conflictAction, onClick: () => onRetryStatus?.() },
                          t('editor.logRetry'),
                        ),
                  )
                : null,
              notice !== null
                ? React.createElement(
                    'div',
                    { style: styles.commitNotice },
                    notice,
                    undoMessage === ''
                      ? null
                      : React.createElement(
                          'button',
                          { type: 'button', style: { ...styles.conflictAction, marginLeft: 6 }, onClick: () => onUndoMessage?.() },
                          t('editor.undoClearedMessage'),
                        ),
                  )
                : null,
              pushFailure === null || pushFailure === undefined
                ? null
                : React.createElement(
                    'div',
                    { style: styles.commitError },
                    React.createElement('span', { style: { flex: '1 1 auto', minWidth: 0 } }, t('editor.pushedFailed', { message: pushFailure })),
                    React.createElement(
                      'button',
                      { type: 'button', style: styles.conflictAction, onClick: () => onPush?.(), disabled: busy || pushing },
                      pushing ? t('editor.pushing') : t('editor.retryPush'),
                    ),
                  ),
            )
          : null,
        mode === 'log'
          ? React.createElement(CommitLog, {
              t,
              scrollRefs,
              commits,
              loading: logLoading,
              detail: logDetail,
              onRefresh: onLoadLog,
              onShow: onSelectCommit,
              onOpenFile: onOpenFile,
              onEditSource,
              onShowCommitDiff: onShowCommitDiff,
              historyPath: historyPath ?? null,
              onClearHistory: onClearHistory,
              author: logAuthor,
              onAuthor: onLogAuthor,
              onLoadMore: onLoadMoreLog,
              exhausted: logExhausted === true,
              onContextMenu: onLogContextMenu,
              onDirectoryMenu,
              highlighted: highlightedCommit,
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
            })
          : React.createElement(
          'div',
          { style: styles.commitBody },
          React.createElement(
            'div',
            { style: styles.commitChangesPane, 'data-dsh-changes-panel': '' },
            React.createElement(CompactActionBar, {
              t,
              ariaLabel: t('editor.changesActions'),
              /* IDEA's action priority starts with Refresh and Rollback, then the
                 inspection actions. Keep this as the single order used by both
                 the direct toolbar and its overflow menu. */
              actions: [
                { id: 'refresh', group: 'refresh', icon: 'refresh', label: t('editor.refresh'), pinned: true, onClick: onRefresh },
                {
                  id: 'rollback',
                  group: 'local',
                  icon: 'undo',
                  label: chosenChangeList.filter((entry) => entry.staged !== true).length > 1
                    ? t('editor.rollbackWorkingCount', { count: chosenChangeList.filter((entry) => entry.staged !== true).length })
                    : t('editor.rollbackSelected'),
                  disabled: chosenChangeList.filter((entry) => entry.staged !== true).length === 0,
                  onClick: () => {
                    if (chosenChangeList.length > 0) onRollbackSelected?.(chosenChangeList);
                  },
                },
                {
                  id: 'showDiff',
                  group: 'diff',
                  icon: 'diff',
                  label: t('editor.showDiff'),
                  disabled: selectedChange === null,
                  active: diffTarget !== null
                    && selectedChange !== null
                    && diffTarget.path === selectedChange.path
                    && diffTarget.staged === selectedChange.staged,
                  onClick: () => {
                    if (selectedChange !== null) onShowDiff?.(selectedChange);
                  },
                },
                {
                  id: 'shelve',
                  group: 'shelve',
                  icon: 'stash',
                  label: t('editor.shelve'),
                  disabled: busy || onShelve === undefined,
                  onClick: (event) => {
                    const rect = event?.currentTarget?.getBoundingClientRect?.();
                    onShelve?.(rect === undefined ? { x: 240, y: 120 } : { x: rect.left, y: rect.bottom + 4 });
                  },
                },
                {
                  id: 'combinedDiff',
                  group: 'diff',
                  icon: 'combinedDiff',
                  label: t('editor.showCombinedDiff'),
                  disabled: chosenChangeList.length < 2,
                  onClick: () => onShowCombinedDiff?.(chosenChangeList),
                },
                {
                  id: 'copyPatch',
                  group: 'patch',
                  icon: 'clipboard',
                  label: t('editor.copyPatchToClipboard'),
                  disabled: chosenChangeList.length === 0,
                  onClick: () => onCopyPatch?.(chosenChangeList),
                },
                {
                  id: 'createPatch',
                  group: 'patch',
                  icon: 'patchExport',
                  label: t('editor.createPatchFromChanges'),
                  disabled: chosenChangeList.length === 0,
                  onClick: () => onCreatePatch?.(chosenChangeList),
                },
                {
                  id: 'stageAllTracked',
                  group: 'local',
                  icon: 'check',
                  label: t('editor.stageAllTracked'),
                  disabled: busy || stageAllTrackedPaths.length === 0,
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
                    onViewOptionsMenu?.(rect === undefined ? { x: 240, y: 120 } : { x: rect.left, y: rect.bottom + 4 });
                  },
                },
                {
                  id: 'selectOpened',
                  group: 'view',
                  icon: 'target',
                  label: t('editor.selectOpenedChange'),
                  disabled: onSelectOpenedChange === undefined,
                  onClick: () => onSelectOpenedChange?.(),
                },
                { id: 'expandChanges', group: 'view', icon: 'expand', label: t('editor.expandChanges'), onClick: () => onExpandChanges?.() },
                { id: 'collapseChanges', group: 'view', icon: 'collapse', label: t('editor.collapseChanges'), onClick: () => onCollapseChanges?.() },
              ],
            }),
            /* IDEA's change list has its own filter box; the Log tab's filter does
               not cover it, and a 300-file change set is unreadable without one.
               Escape clears it, like the tree's speed search. */
            React.createElement(
              'div',
              { style: styles.treeSearchRow },
              React.createElement(Icon, { name: 'search', size: 12 }),
              React.createElement('input', {
                ref: changeFilterRef,
                style: { ...styles.findInput, flex: '1 1 auto', width: 'auto' },
                placeholder: t('editor.changeFilterPlaceholder'),
                title: t('editor.changeFilterHint'),
                value: pathQuery,
                'aria-label': t('editor.changeFilter'),
                onChange: (event) => onPathQuery?.(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    clearChangeFilter();
                  } else if (
                    filteredTargets.length > 0
                    && (event.key === 'ArrowDown' || event.key === 'ArrowUp')
                  ) {
                    event.preventDefault();
                    const direction = event.key === 'ArrowDown' ? 'next' : 'previous';
                    const target = cycleChangeTarget(filteredTargets, selectedChange, direction);
                    if (target !== null) onSelectChange?.({ path: target.path, staged: target.staged });
                  }
                },
              }),
              pathQuery === ''
                ? null
                : React.createElement(
                    'button',
                    {
                      type: 'button',
                      style: styles.conflictAction,
                      title: t('editor.clearChangeFilter'),
                      'aria-label': t('editor.clearChangeFilter'),
                      onClick: () => clearChangeFilter(),
                    },
                    '×',
                  ),
            ),
            React.createElement(
              'div',
              {
                style: styles.commitScroll,
                className: 'dsh-editor-tool-scroll',
                ref: scrollRefs?.changes ?? null,
                tabIndex: 0,
                role: 'tree',
                'data-dsh-changes-list': '',
                'aria-label': t('editor.changes'),
                onKeyDown: (event) => onChangesKeyDown?.(event),
                onKeyUp: (event) => onChangesKeyUp?.(event),
                /* Restore on mount: switching tabs remounts this list. */
              },
              changes.length === 0
                ? React.createElement('div', { style: styles.treeMessage }, t('editor.noChanges'))
                : visibleGroups.length === 0
                  ? React.createElement('div', { style: styles.treeMessage }, t('editor.noMatches'))
                  : visibleGroups.map((group, groupIndex) => renderGroup(group, groupIndex)),
            ),
            React.createElement(
              'div',
              { style: styles.commitMessageArea },
              React.createElement(
                'div',
                { style: styles.amendRow },
                React.createElement(
                  'label',
                  { style: { display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, flex: '1 1 auto', cursor: 'pointer' } },
                  React.createElement('input', {
                    type: 'checkbox',
                    className: 'dsh-editor-checkbox',
                    style: styles.checkbox,
                    checked: amend,
                    onChange: (event) => onAmend(event.target.checked),
                    'aria-label': t('editor.amend'),
                  }),
                  t('editor.amend'),
                  git?.lastCommit?.subject
                    ? React.createElement('span', { style: styles.amendSubject, title: git.lastCommit.subject }, git.lastCommit.subject)
                    : null,
                ),
                React.createElement(ToolbarButton, {
                  icon: 'history',
                  label: t('editor.commitMessageHistory'),
                  disabled: history.length === 0,
                  onClick: (event) => {
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
                  },
                }),
              ),
              React.createElement('textarea', {
                ref: commitMessageRef,
                style: styles.commitTextarea,
                value: message,
                placeholder: t('editor.commitMessagePlaceholder'),
                spellCheck: false,
                onChange: (event) => onMessage(event.target.value),
                onKeyDown: (event) => {
                  /* ⌘/Ctrl+Enter commits without reaching for the mouse. */
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.preventDefault();
                    if (!busy && selectedPaths.size > 0 && message.trim() !== '') onCommit(false);
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
                },
              }),
              templates.length === 0
                ? null
                : React.createElement(
                    'div',
                    { style: styles.commitTemplateRow },
                    templates.map((prefix) =>
                      React.createElement(
                        'button',
                        {
                          key: prefix,
                          type: 'button',
                          className: 'dsh-editor-template-chip',
                          style: styles.commitTemplateChip,
                          title: t('editor.commitTemplateHint', { prefix }),
                          onClick: () => onTemplate?.(prefix),
                        },
                        prefix,
                      ),
                    ),
                  ),
              identityMissing
                ? React.createElement('div', { style: styles.commitError }, t('editor.identityMissing'))
                : null,
              typeof git?.operation === 'string' && git.operation !== ''
                ? React.createElement('div', { style: styles.commitNotice }, t('editor.operationInProgress', { operation: git.operation }))
                : null,
              React.createElement(
                'div',
                { style: styles.commitButtonRow },
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    style: styles.commitPrimary,
                    disabled: busy || selectedPaths.size === 0 || message.trim() === '',
                    onClick: () => onCommit(false),
                  },
                  busy ? t('editor.committing') : selectedPaths.size === 0 ? t('editor.commitAction') : `${t('editor.commitAction')} ${selectedPaths.size}`,
                ),
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'dsh-editor-commit-secondary',
                    style: styles.commitSecondary,
                    disabled: busy || selectedPaths.size === 0 || message.trim() === '',
                    onClick: () => onCommit(true),
                    title: t('editor.commitAndPush'),
                    'aria-label': t('editor.commitAndPush'),
                  },
                  /* IDEA labels BOTH buttons ("Commit" / "Commit and Push…"): an
                     icon-only second button does not say what it will do, and the
                     two actions differ irreversibly (push is remote). */
                  t('editor.commitAndPush'),
                ),
              ),
              React.createElement('div', { style: styles.commitNotice }, allSelected ? t('editor.allSelected') : t('editor.partialSelected', { count: selectedPaths.size })),
            ),
          ),
        ),
      );
    }

    /**
     * IDEA's one-line name prompt (New Branch, New Tag).
     *
     * A `window.prompt` cannot show a live validation message and renders as a
     * browser chrome dialog; IDEA keeps it inside the tool window, with the error
     * under the field and Enter/Esc as the only exits.
     * @param {object} props - prompt state and callbacks.
     * @returns {object} React element tree.
     */
    function NamePrompt({ t, state, onSubmit, onChange, onClose }) {
      const error = typeof state.error === 'string' && state.error !== '' ? state.error : null;
      return React.createElement(
        'div',
        { style: styles.paletteBackdrop, onMouseDown: onClose },
        React.createElement(
          'div',
          {
            style: styles.namePrompt,
            role: 'dialog',
            'aria-label': state.title,
            onMouseDown: (event) => event.stopPropagation(),
          },
          React.createElement('div', { style: styles.namePromptTitle }, state.title),
          React.createElement('input', {
            style: styles.namePromptInput,
            autoFocus: true,
            value: state.value,
            placeholder: state.placeholder,
            'aria-label': state.title,
            onChange: (event) => onChange(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onSubmit();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              }
            },
          }),
          error === null ? null : React.createElement('div', { style: styles.namePromptError, role: 'alert' }, error),
          React.createElement(
            'div',
            { style: styles.namePromptButtons },
            React.createElement('button', { type: 'button', style: styles.commitSecondary, onClick: onClose }, t('editor.cancel')),
            React.createElement(
              'button',
              { type: 'button', style: styles.commitPrimary, onClick: () => onSubmit(), disabled: state.value.trim() === '' },
              t('editor.ok'),
            ),
          ),
        ),
      );
    }

    /**
     * Score one commit against a typed query (IDEA's revision picker search).
     *
     * The three things a user knows about a commit are its hash, its subject and
     * its author, so all three are searched; a hash PREFIX ranks first because
     * it identifies exactly one commit. `-1` means "no match", the same
     * convention as {@link fuzzyScore}.
     * @param {object} commit - log entry.
     * @param {string} query - typed text, any case.
     * @returns {number} score, higher is better; -1 when nothing matched.
     */
    function commitSearchScore(commit, query) {
      const needle = typeof query === 'string' ? query.trim().toLowerCase() : '';
      if (needle === '') return 0;
      const hash = typeof commit?.hash === 'string' ? commit.hash.toLowerCase() : '';
      if (hash.startsWith(needle)) return 1000;
      const subject = typeof commit?.subject === 'string' ? commit.subject.toLowerCase() : '';
      const author = typeof commit?.author === 'string' ? commit.author.toLowerCase() : '';
      let score = 0;
      if (subject.includes(needle)) score += 100;
      if (author.includes(needle)) score += 50;
      return score === 0 ? -1 : score;
    }

    /**
     * IDEA's revision picker: a searchable list of commits for "Compare with Revision".
     *
     * The old implementation reused the context menu, which put a hard 20-row cap
     * on the choice and gave no way to reach an older commit. This is a real
     * dialog with a filter box and ↑/↓/Enter, matching Go to File's keyboard model.
     * @param {object} props - picker state and callbacks.
     * @returns {object} React element tree.
     */
    function RevisionPicker({ t, state, onQuery, onMove, onPick, onClose }) {
      const commits = state.commits ?? [];
      const query = state.query ?? '';
      const needle = query.trim().toLowerCase();
      const visible = needle === '' ? commits : commits.filter((commit) => commitSearchScore(commit, needle) >= 0);
      const index = Math.max(0, Math.min(state.index ?? 0, Math.max(0, visible.length - 1)));
      const listRef = React.useRef(null);
      React.useEffect(() => {
        const node = listRef.current;
        const active = node?.querySelector?.('[data-dsh-active="true"]');
        active?.scrollIntoView?.({ block: 'nearest' });
        /* A new query replaces the row set, which starts at the top. */
      }, [index, needle, visible.length]);
      return React.createElement(
        'div',
        { style: styles.paletteBackdrop, onMouseDown: onClose },
        React.createElement(
          'div',
          {
            style: styles.palette,
            role: 'dialog',
            'aria-label': t('editor.compareWithRevision'),
            onMouseDown: (event) => event.stopPropagation(),
          },
          React.createElement('input', {
            style: styles.paletteInput,
            autoFocus: true,
            placeholder: t('editor.compareRevisionPlaceholder'),
            value: query,
            onChange: (event) => onQuery(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                onMove(1, visible.length);
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                onMove(-1, visible.length);
              } else if (event.key === 'Enter') {
                event.preventDefault();
                if (visible[index] !== undefined) onPick(visible[index].hash);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              }
            },
          }),
          React.createElement(
            'div',
            { ref: listRef, style: styles.paletteList },
            state.loading === true && commits.length === 0
              ? React.createElement('div', { style: styles.treeMessage }, t('editor.loading'))
              : null,
            state.loading !== true && visible.length === 0
              ? React.createElement('div', { style: styles.treeMessage }, t('editor.noMatches'))
              : null,
            visible.map((commit, position) =>
              React.createElement(
                'div',
                {
                  key: commit.hash,
                  'data-dsh-active': position === index ? 'true' : 'false',
                  className: 'dsh-editor-palette-row',
                  style: { ...styles.paletteRow, ...(position === index ? styles.paletteRowActive : null) },
                  onMouseDown: (event) => {
                    event.preventDefault();
                    onPick(commit.hash);
                  },
                },
                React.createElement('span', { style: styles.logHash }, commit.hash.slice(0, 7)),
                React.createElement('span', { style: styles.paletteName }, commit.subject),
                React.createElement('span', { style: styles.paletteDir }, commit.author),
              ),
            ),
          ),
        ),
      );
    }

    /**
     * IDEA's "Move to…" dialog: pick a destination directory for the selection.
     *
     * Dragging a file into a collapsed folder means expanding it first, and a
     * destination outside the visible tree means scrolling to it. IDEA offers F6
     * instead: a searchable list of every directory, with the current parent
     * marked so "move it where it already is" is obvious before pressing Enter.
     * @param {object} props - picker state and callbacks.
     * @returns {object} React element tree.
     */
    function MoveToPicker({
      t,
      state,
      onQuery,
      onMove,
      onPick,
      onClose,
      title = t('editor.moveTo'),
      placeholder = t('editor.moveToPlaceholder'),
      currentLabel = t('editor.moveToCurrent'),
    }) {
      const directories = state.directories ?? [];
      const query = state.query ?? '';
      const needle = query.trim().toLowerCase();
      const visible = needle === '' ? directories : directories.filter((entry) => entry.toLowerCase().includes(needle));
      const index = Math.max(0, Math.min(state.index ?? 0, Math.max(0, visible.length - 1)));
      const listRef = React.useRef(null);
      React.useEffect(() => {
        const node = listRef.current;
        node?.querySelector?.('[data-dsh-active="true"]')?.scrollIntoView?.({ block: 'nearest' });
      }, [index, needle, visible.length]);
      return React.createElement(
        'div',
        { style: styles.paletteBackdrop, onMouseDown: onClose },
        React.createElement(
          'div',
          { style: styles.palette, role: 'dialog', 'aria-label': title, onMouseDown: (event) => event.stopPropagation() },
          React.createElement('input', {
            style: styles.paletteInput,
            autoFocus: true,
            placeholder,
            value: query,
            onChange: (event) => onQuery(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                onMove(1, visible.length);
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                onMove(-1, visible.length);
              } else if (event.key === 'Enter') {
                event.preventDefault();
                if (visible[index] !== undefined) onPick(visible[index]);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              }
            },
          }),
          React.createElement(
            'div',
            { ref: listRef, style: styles.paletteList },
            state.loading === true && directories.length === 0
              ? React.createElement('div', { style: styles.treeMessage }, t('editor.loading'))
              : null,
            state.loading !== true && visible.length === 0
              ? React.createElement('div', { style: styles.treeMessage }, t('editor.noMatches'))
              : null,
            visible.map((directory, position) =>
              React.createElement(
                'div',
                {
                  key: directory === '' ? '__root__' : directory,
                  'data-dsh-active': position === index ? 'true' : 'false',
                  className: 'dsh-editor-palette-row',
                  style: { ...styles.paletteRow, ...(position === index ? styles.paletteRowActive : null) },
                  onMouseDown: (event) => {
                    event.preventDefault();
                    onPick(directory);
                  },
                },
                React.createElement(Icon, { name: 'folder', size: 14 }),
                React.createElement('span', { style: styles.paletteName }, directory === '' ? state.rootName ?? '/' : directory),
                /* The current parent is marked, so Enter on it reads as "already there". */
                directory === (state.parent ?? '')
                  ? React.createElement('span', { style: styles.paletteDir }, currentLabel)
                  : null,
              ),
            ),
          ),
        ),
      );
    }

    /**
     * Bounded line window for Search Everywhere's lightweight preview.
     *
     * IDEA previews the full file, but rendering a multi-thousand-line document in
     * the modal would duplicate Monaco's editor cost. Keep a fixed maximum and
     * centre it on the selected text hit.
     * @param {string} content - file contents.
     * @param {number} line - one-based focus line.
     * @param {number} [maximum=401] - maximum rendered lines.
     * @returns {{start: number, end: number, truncatedBefore: boolean, truncatedAfter: boolean}} window.
     */
    function searchEverywherePreviewWindow(content, line, maximum = 401) {
      const lines = String(content ?? '').split(/\r?\n/u);
      const total = lines.length;
      const limit = Math.max(1, Math.floor(Number(maximum) || 401));
      const focus = Math.max(1, Math.min(total, Math.floor(Number(line) || 1)));
      if (total <= limit) {
        return { start: 1, end: total, truncatedBefore: false, truncatedAfter: false };
      }
      const half = Math.floor((limit - 1) / 2);
      let start = Math.max(1, focus - half);
      let end = Math.min(total, start + limit - 1);
      start = Math.max(1, end - limit + 1);
      return {
        start,
        end,
        truncatedBefore: start > 1,
        truncatedAfter: end < total,
      };
    }

    /**
     * Scroll offset that places one preview line at the vertical centre.
     *
     * The rendered window may contain the complete short file, but the scroll
     * container still starts at zero. This helper converts absolute viewport
     * boxes into a clamped scrollTop so both short and truncated previews focus
     * the active match instead of the first physical line.
     * @param {{containerTop:number, containerHeight:number, scrollTop:number, scrollHeight:number, lineTop:number, lineHeight:number}} metrics - layout boxes.
     * @returns {number} clamped scrollTop.
     */
    function previewLineScrollTop(metrics = {}) {
      const containerTop = Number(metrics.containerTop);
      const containerHeight = Math.max(0, Number(metrics.containerHeight) || 0);
      const current = Math.max(0, Number(metrics.scrollTop) || 0);
      const scrollHeight = Math.max(containerHeight, Number(metrics.scrollHeight) || containerHeight);
      const lineTop = Number(metrics.lineTop);
      const lineHeight = Math.max(0, Number(metrics.lineHeight) || 0);
      if (![containerTop, lineTop].every(Number.isFinite)) return current;
      const centred = current + lineTop - containerTop - (containerHeight - lineHeight) / 2;
      return Math.max(0, Math.min(scrollHeight - containerHeight, centred));
    }

    /**
     * Centre one rendered preview line inside its own scroll container.
     * @param {HTMLElement|null} container - preview scroll body.
     * @param {HTMLElement|null} lineNode - active preview line.
     * @returns {boolean} whether the container was scrolled.
     */
    function centerPreviewLineInContainer(container, lineNode) {
      if (container === null || lineNode === null) return false;
      if (typeof container.getBoundingClientRect !== 'function' || typeof lineNode.getBoundingClientRect !== 'function') return false;
      const containerRect = container.getBoundingClientRect();
      const lineRect = lineNode.getBoundingClientRect();
      container.scrollTop = previewLineScrollTop({
        containerTop: containerRect.top,
        containerHeight: container.clientHeight,
        scrollTop: container.scrollTop,
        scrollHeight: container.scrollHeight,
        lineTop: lineRect.top,
        lineHeight: lineRect.height,
      });
      return true;
    }

    /**
     * Record the absolute offset where every physical text line starts.
     * @param {string} content - complete text.
     * @returns {number[]} zero-based line-start offsets.
     */
    function findToolTextLineStarts(content) {
      const text = typeof content === 'string' ? content : '';
      const starts = [0];
      for (let index = 0; index < text.length; index += 1) {
        if (text[index] === '\n') starts.push(index + 1);
      }
      return starts;
    }

    /**
     * Clip Find match ranges to the visible characters of one preview line.
     *
     * A query may contain newlines and therefore span several lines. Each line
     * receives only its own intersection, while overlapping matches are merged
     * so adjacent visual spans do not stack the same highlight repeatedly.
     * @param {string} lineText - one preview line without its newline.
     * @param {number} lineStart - absolute offset of this line.
     * @param {Array<{offset: number, length: number}>} matches - Find matches.
     * @returns {Array<{text: string, match: boolean}>} ordered line parts.
     */
    function findToolPreviewLineParts(lineText, lineStart, matches) {
      const text = typeof lineText === 'string' ? lineText : '';
      if (text === '') return [];
      const startOffset = Math.max(0, Math.floor(Number(lineStart) || 0));
      const endOffset = startOffset + text.length;
      const ranges = [];
      for (const match of Array.isArray(matches) ? matches : []) {
        const offset = Number(match?.offset);
        const length = Number(match?.length);
        if (!Number.isFinite(offset) || !Number.isFinite(length) || length <= 0) continue;
        const start = Math.max(startOffset, offset);
        const end = Math.min(endOffset, offset + length);
        if (end <= start) continue;
        ranges.push({ start: start - startOffset, end: end - startOffset });
      }
      ranges.sort((left, right) => left.start - right.start || right.end - left.end);
      const merged = [];
      for (const range of ranges) {
        const previous = merged[merged.length - 1];
        if (previous !== undefined && range.start <= previous.end) {
          previous.end = Math.max(previous.end, range.end);
        } else {
          merged.push({ ...range });
        }
      }
      if (merged.length === 0) return [{ text, match: false }];
      const parts = [];
      let cursor = 0;
      for (const range of merged) {
        if (range.start > cursor) parts.push({ text: text.slice(cursor, range.start), match: false });
        parts.push({ text: text.slice(range.start, range.end), match: true });
        cursor = range.end;
      }
      if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });
      return parts;
    }

    /**
     * Resolve the language used by Monaco's standalone colorizer for a preview.
     * @param {object|null} monaco - Monaco namespace, when loaded.
     * @param {string} path - previewed file path.
     * @returns {string} registered Monaco language id or plaintext.
     */
    function codePreviewLanguage(monaco, path) {
      if (monaco?.languages === undefined || typeof monaco.languages.getLanguages !== 'function') return 'plaintext';
      return safeLanguage(monaco, path);
    }

    /**
     * Color one bounded preview window with Monaco's own tokenizer.
     *
     * Search Everywhere and Find render lightweight DOM previews instead of
     * creating another editor. Reusing Monaco's colorizer keeps syntax colours
     * aligned with the real editor without duplicating language grammars.
     * @param {string[]} lines - visible preview lines.
     * @param {string} path - previewed file path.
     * @returns {string[]|null} one sanitized HTML fragment per line, or null while unavailable.
     */
    function useCodePreviewColorizedLines(lines, path) {
      const text = Array.isArray(lines) ? lines.join('\n') : '';
      const key = `${path ?? ''}\u0000${text}`;
      const [entry, setEntry] = React.useState({ key: '', lines: null });
      React.useEffect(() => {
        let cancelled = false;
        const monaco = window.monaco;
        if (text === '' || typeof monaco?.editor?.colorize !== 'function') {
          setEntry({ key, lines: null });
          return () => {
            cancelled = true;
          };
        }
        monaco.editor.colorize(text, codePreviewLanguage(monaco, path), { tabSize: 2 })
          .then((html) => {
            if (cancelled) return;
            const fragments = String(html).split('<br/>');
            setEntry({
              key,
              lines: fragments.length >= lines.length ? fragments.slice(0, lines.length) : null,
            });
          })
          .catch(() => {
            if (!cancelled) setEntry({ key, lines: null });
          });
        return () => {
          cancelled = true;
        };
      }, [key, lines.length, path, text]);
      return entry.key === key ? entry.lines : null;
    }

    /**
     * Convert visible line parts into character ranges for DOM highlighting.
     * @param {Array<{text: string, match: boolean}>|null} parts - line parts.
     * @returns {Array<{start: number, end: number}>} non-overlapping ranges.
     */
    function codePreviewMatchRanges(parts) {
      const ranges = [];
      let offset = 0;
      for (const part of Array.isArray(parts) ? parts : []) {
        const text = typeof part?.text === 'string' ? part.text : '';
        if (part?.match === true && text !== '') ranges.push({ start: offset, end: offset + text.length });
        offset += text.length;
      }
      return ranges;
    }

    /**
     * Wrap text intersections with Find's match highlight after colorization.
     * Processing text nodes in reverse keeps earlier offsets stable.
     * @param {HTMLElement} root - colorized code element.
     * @param {Array<{start: number, end: number}>} ranges - character ranges.
     * @returns {void}
     */
    function markCodePreviewMatches(root, ranges) {
      for (const range of ranges) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        let offset = 0;
        for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
          const length = node.nodeValue?.length ?? 0;
          nodes.push({ node, start: offset, end: offset + length });
          offset += length;
        }
        for (let index = nodes.length - 1; index >= 0; index -= 1) {
          const entry = nodes[index];
          const start = Math.max(range.start, entry.start);
          const end = Math.min(range.end, entry.end);
          if (end <= start) continue;
          let target = entry.node;
          const localStart = start - entry.start;
          const localEnd = end - entry.start;
          if (localStart > 0) target = target.splitText(localStart);
          if (localEnd - localStart < target.length) target.splitText(localEnd - localStart);
          const mark = document.createElement('span');
          mark.className = 'dsh-editor-code-preview-match';
          mark.setAttribute('data-dsh-find-preview-match', '1');
          target.parentNode?.insertBefore(mark, target);
          mark.appendChild(target);
        }
      }
    }

    /**
     * One syntax-colorized preview line with the shared editor-preview classes.
     * @param {{text: string, html: string|null, segments: object[]|null, style: object}} props - line content.
     * @returns {object} code span.
     */
    function CodePreviewCode({ text, html, segments, style }) {
      const ref = React.useRef(null);
      const segmentKey = Array.isArray(segments)
        ? segments.map((part) => `${part.match === true ? '1' : '0'}:${part.text}`).join('\u0000')
        : '';
      React.useEffect(() => {
        const node = ref.current;
        if (node === null || typeof html !== 'string') return;
        node.innerHTML = html;
        const ranges = codePreviewMatchRanges(segments);
        if (ranges.length > 0) markCodePreviewMatches(node, ranges);
      }, [html, segmentKey, text]);
      if (typeof html === 'string') {
        return React.createElement('span', {
          ref,
          className: 'dsh-editor-code-preview-code',
          style,
          dangerouslySetInnerHTML: { __html: html },
        });
      }
      return React.createElement(
        'span',
        { ref, className: 'dsh-editor-code-preview-code', style },
        Array.isArray(segments) && segments.length > 0
          ? segments.map((part, index) => React.createElement(
              'span',
              {
                key: index,
                style: part.match ? styles.findToolHighlight : null,
                'data-dsh-find-preview-match': part.match ? '1' : undefined,
              },
              part.text,
            ))
          : text,
      );
    }

    /**
     * Group Find-tool occurrences by file while preserving search order.
     *
     * IDEA's Find tool window is a tree: one file row owns each of its
     * occurrences. The host returns flat path/line records, so grouping is a
     * pure projection and must not reorder files or occurrences.
     * @param {object[]} matches - flat text-search hits.
     * @returns {Array<{path: string, matches: object[]}>} stable file groups.
     */
    function groupFindMatches(matches) {
      const groups = [];
      const byPath = new Map();
      for (const match of Array.isArray(matches) ? matches : []) {
        if (typeof match?.path !== 'string' || match.path === '') continue;
        let group = byPath.get(match.path);
        if (group === undefined) {
          group = { path: match.path, matches: [] };
          byPath.set(match.path, group);
          groups.push(group);
        }
        group.matches.push(match);
      }
      return groups;
    }

    /** Normalize the two grouping structures DSH can truthfully provide. */
    function normalizeFindGroupBy(value) {
      return value === 'directory' ? 'directory' : 'file';
    }

    /**
     * Sort file groups according to IDEA's File / Directory Structure modes.
     * Occurrences inside each file keep the host's search order.
     */
    function orderFindToolGroups(groups, groupBy) {
      const ordered = Array.isArray(groups) ? [...groups] : [];
      if (normalizeFindGroupBy(groupBy) !== 'directory') return ordered;
      return ordered.sort((left, right) => {
        const leftDirectory = dirname(left.path);
        const rightDirectory = dirname(right.path);
        return leftDirectory.localeCompare(rightDirectory, undefined, { sensitivity: 'base' })
          || left.path.localeCompare(right.path, undefined, { sensitivity: 'base' });
      });
    }

    /**
     * Insert display-only directory headers before file groups. The headers do
     * not enter the keyboard occurrence sequence; file rows keep ownership of
     * every occurrence and replacement target.
     */
    function findToolDisplayGroups(groups, groupBy) {
      const ordered = orderFindToolGroups(groups, groupBy);
      if (normalizeFindGroupBy(groupBy) !== 'directory') {
        return ordered.map((group) => ({ ...group, kind: 'file' }));
      }
      const display = [];
      let currentDirectory = null;
      let currentDirectoryEntry = null;
      for (const group of ordered) {
        const directory = dirname(group.path);
        if (directory !== currentDirectory) {
          currentDirectory = directory;
          currentDirectoryEntry = {
            kind: 'directory',
            path: directory,
            count: 0,
          };
          display.push(currentDirectoryEntry);
        }
        currentDirectoryEntry.count += Array.isArray(group.matches) ? group.matches.length : 0;
        display.push({ ...group, kind: 'file' });
      }
      return display;
    }

    /**
     * Project file/text search results into the rows currently visible in Find.
     *
     * Collapsing a file removes only its occurrence rows; file-name results are
     * leaves and remain visible. Keeping this projection pure lets keyboard
     * traversal and rendering share exactly the same row order.
     * @param {object[]} files - file-name search results.
     * @param {object[]} matches - flat text-search occurrences.
     * @param {Set<string>} collapsedPaths - text files whose rows are folded.
     * @returns {{groups: object[], rows: object[]}} grouped results and visible rows.
     */
    function findToolVisibleRows(files, matches, collapsedPaths, groupBy = 'file') {
      const groups = orderFindToolGroups(groupFindMatches(matches), groupBy);
      const collapsed = collapsedPaths instanceof Set ? collapsedPaths : new Set();
      const fileRows = (Array.isArray(files) ? files : []).map((file) => ({
        ...file,
        kind: 'file',
        rowKey: `file:${file.path}`,
      }));
      const textRows = groups
        .filter((group) => !collapsed.has(group.path))
        .flatMap((group) => group.matches.map((match) => ({
          ...match,
          kind: 'text',
          rowKey: `text:${match.path}:${match.line}:${match.column}`,
        })));
      return { groups, rows: [...fileRows, ...textRows] };
    }

    /**
     * Resolve a Search Everywhere handoff index before any Find groups collapse.
     *
     * The handoff index addresses the complete Files + Text option sequence.
     * Find's visible index is narrower after users collapse groups, so reveal
     * must recover the target row identity first instead of clamping the
     * handoff against the currently visible rows.
     * @param {object[]} files - file-name search results.
     * @param {object[]} matches - flat text-search occurrences.
     * @param {number} index - request index in the complete option sequence.
     * @returns {{kind: 'file'|'text', path: string, rowKey: string, index: number}|null} target.
     */
    function findToolHandoffTarget(files, matches, index, groupBy = 'file') {
      const rows = findToolVisibleRows(files, matches, new Set(), groupBy).rows;
      if (rows.length === 0) return null;
      const position = Math.max(0, Math.min(rows.length - 1, Number(index) || 0));
      const target = rows[position];
      if (typeof target?.path !== 'string' || typeof target?.rowKey !== 'string') return null;
      return {
        kind: target.kind === 'file' ? 'file' : 'text',
        path: target.path,
        rowKey: target.rowKey,
        index: position,
      };
    }

    /**
     * Build a collision-safe DOM id for one persistent Find row.
     * @param {string} rowKey - file/text result identity.
     * @returns {string} id used by aria-activedescendant.
     */
    function findToolOptionId(rowKey) {
      return `dsh-editor-find-option-${encodeURIComponent(String(rowKey ?? ''))}`;
    }

    /**
     * Build the stable container id for one Find file group.
     * @param {string} path - workspace file path.
     * @returns {string} group container id.
     */
    function findToolGroupId(path) {
      return `dsh-editor-find-group-${encodeURIComponent(String(path ?? ''))}`;
    }

    /**
     * Resolve keyboard movement between Find file-group headers.
     * @param {object[]} groups - visible file groups.
     * @param {string|null} currentPath - currently focused group.
     * @param {string} key - keyboard key.
     * @returns {string|null} target group path, or null when unavailable.
     */
    function findToolGroupTarget(groups, currentPath, key) {
      const paths = (Array.isArray(groups) ? groups : [])
        .map((group) => group?.path)
        .filter((path) => typeof path === 'string' && path !== '');
      if (paths.length === 0) return null;
      if (key === 'Home') return paths[0];
      if (key === 'End') return paths[paths.length - 1];
      const current = Math.max(0, paths.indexOf(currentPath));
      if (key === 'ArrowDown') return paths[Math.min(paths.length - 1, current + 1)];
      if (key === 'ArrowUp') return paths[Math.max(0, current - 1)];
      return null;
    }

    /**
     * Route an occurrence boundary back into the flattened Find hierarchy.
     * @param {object[]} groups - visible text groups.
     * @param {string} rowKey - focused text occurrence.
     * @param {'ArrowUp'|'ArrowDown'} key - movement direction.
     * @returns {{kind: 'group', path: string}|null} owning/next group or null.
     */
    function findToolGroupBoundaryTarget(groups, rowKey, key) {
      const list = Array.isArray(groups) ? groups : [];
      for (let groupIndex = 0; groupIndex < list.length; groupIndex += 1) {
        const group = list[groupIndex];
        const matches = Array.isArray(group?.matches) ? group.matches : [];
        const matchIndex = matches.findIndex((match) =>
          `text:${match.path}:${match.line}:${match.column}` === rowKey);
        if (matchIndex < 0) continue;
        if (key === 'ArrowUp' && matchIndex === 0) return { kind: 'group', path: group.path };
        if (key === 'ArrowDown' && matchIndex === matches.length - 1) {
          const next = list[groupIndex + 1];
          return next === undefined ? null : { kind: 'group', path: next.path };
        }
        return null;
      }
      return null;
    }

    /**
     * Detect the first text-group header after file-name result rows.
     * @param {object[]} occurrences - flattened visible Find result rows.
     * @param {number} position - focused row index.
     * @returns {string|null} next text group path, or null.
     */
    function findToolNextTextGroupPath(occurrences, position) {
      if (!Array.isArray(occurrences) || !Number.isFinite(position)) return null;
      const next = occurrences[position + 1];
      if (next?.kind !== 'text' || typeof next.path !== 'string' || next.path === '') return null;
      return next.path;
    }

    /**
     * Apply IDEA's Find in Files scope row without inventing modules.
     * Project searches everything; Directory uses the active file's directory;
     * Scope narrows to the selected truthful preset.
     * @param {string} path - workspace-relative path.
     * @param {'project'|'directory'|'scope'} mode - selected scope family.
     * @param {{directory?: string, recursive?: boolean, preset?: 'projectFiles'|'openFiles'|'changedFiles'|'currentFile'|'recentlyViewedFiles'|'gitTrackedFiles'|'gitNonIgnoredFiles', allowedPaths?: Set<string>|string[]}} options - scope data.
     * @returns {boolean} whether the path participates.
     */
    function findToolPathMatchesScope(path, mode, options = {}) {
      if (typeof path !== 'string' || path === '') return false;
      if (mode === 'directory') {
        const rawDirectory = typeof options.directory === 'string' ? options.directory.trim() : '';
        const directory = rawDirectory === '.' || rawDirectory === '/'
          ? ''
          : rawDirectory.replace(/^\.\/+/u, '').replace(/\/+$/u, '');
        if (options.recursive === false) {
          const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
          return parent === directory;
        }
        if (directory === '') return true;
        return path === directory || path.startsWith(`${directory}/`);
      }
      if (mode === 'scope') {
        if (options.customScope !== null && typeof options.customScope === 'object') {
          return findScopePatternsMatch(
            path,
            options.customScope.includePatterns,
            options.customScope.excludePatterns,
          );
        }
        if (
          options.preset === 'projectFiles'
          || options.preset === 'gitTrackedFiles'
          || options.preset === 'gitNonIgnoredFiles'
        ) return true;
        const allowed = options.allowedPaths instanceof Set
          ? options.allowedPaths
          : new Set(Array.isArray(options.allowedPaths) ? options.allowedPaths : []);
        return allowed.has(path);
      }
      return true;
    }

    /**
     * Whether one Find Scope preset has the data it needs to be actionable.
     * The option remains visible but disabled when unavailable, matching IDEA's
     * "present but not currently selectable" behavior for context-bound scopes.
     * @param {string} preset - normalized Scope preset.
     * @param {{gitAvailable?: boolean, recentFileCount?: number, openFileCount?: number, currentFileAvailable?: boolean, changedFileCount?: number}} context - availability.
     * @returns {boolean} true when the preset can produce a real result set.
     */
    function findSearchScopePresetAvailable(preset, context = {}) {
      if (preset === 'gitTrackedFiles' || preset === 'gitNonIgnoredFiles') {
        return context?.gitAvailable === true;
      }
      if (preset === 'recentlyViewedFiles') {
        return Math.max(0, Number(context?.recentFileCount) || 0) > 0;
      }
      if (preset === 'openFiles') {
        return Math.max(0, Number(context?.openFileCount) || 0) > 0;
      }
      if (preset === 'currentFile') {
        return context?.currentFileAvailable === true;
      }
      if (preset === 'changedFiles') {
        return Math.max(0, Number(context?.changedFileCount) || 0) > 0;
      }
      return true;
    }

    /**
     * Normalize one recent-search entry. Search Everywhere now treats query text
     * literally and leaves provider choice to tabs, so slash text must survive
     * history replay unchanged.
     * @param {unknown} entry - stored query.
     * @returns {string} trimmed replayable query.
     */
    function normalizeRecentSearchEntry(entry) {
      return typeof entry === 'string' ? entry.trim() : '';
    }

    /**
     * Normalize and deduplicate recent Search Everywhere queries.
     * @param {unknown[]} history - stored newest-first queries.
     * @param {string} [query=''] - newly executed query.
     * @param {number} [limit=20] - maximum retained entries.
     * @returns {string[]} normalized newest-first history.
     */
    function rememberRecentSearchHistory(history, query = '', limit = 20) {
      const entries = Array.isArray(history)
        ? history.map((entry) => normalizeRecentSearchEntry(entry)).filter((entry) => entry !== '')
        : [];
      return rememberSearchHistory(entries, normalizeRecentSearchEntry(query), limit);
    }

    /**
     * Preserve one exact Find query, including newline and surrounding space.
     * @param {unknown} entry - stored or newly entered query.
     * @returns {string} exact query, including IDEA's replayable empty entry.
     */
    function normalizeFindQueryHistoryEntry(entry) {
      return typeof entry === 'string' ? entry : '';
    }

    /**
     * Keep bounded, exact, newest-first Find query history.
     * @param {unknown[]} history - stored entries.
     * @param {string|undefined} query - newly executed exact query; undefined
     *   when only normalizing stored entries.
     * @param {number} [limit=20] - maximum retained queries.
     * @returns {string[]} exact query history.
     */
    function rememberFindQueryHistory(history, query, limit = 20) {
      const entries = (Array.isArray(history) ? history : [])
        .filter((entry) => typeof entry === 'string');
      if (typeof query !== 'string') {
        return [...new Set(entries)].filter((entry, index, list) => list.indexOf(entry) === index).slice(0, limit);
      }
      return [query, ...entries.filter((entry) => entry !== query)]
        .filter((entry, index, list) => list.indexOf(entry) === index)
        .slice(0, limit);
    }

    /**
     * IDEA asks before materializing a very large Search Everywhere result set.
     * DSH's bounded search tops out below that, but persisted Files/Text results
     * can still be large enough to make an accidental tool-window handoff noisy.
     * @param {unknown[]} files - file-name results.
     * @param {unknown[]} matches - text occurrence results.
     * @param {number} [limit=200] - confirmation threshold.
     * @returns {boolean} whether the user should confirm before opening Find.
     */
    function searchEverywhereRequiresResultConfirmation(files, matches, limit = 200) {
      const total = (Array.isArray(files) ? files.length : 0) + (Array.isArray(matches) ? matches.length : 0);
      return total > Math.max(0, Number(limit) || 200);
    }

    /**
     * Resolve IDEA Find Usages' search text from the active editor.
     *
     * A selected phrase is already an explicit user choice. Otherwise Monaco's
     * word API supplies the identifier under the caret. The caller reuses the
     * existing workspace Find path instead of introducing a second search
     * surface or a language-service dependency.
     * @param {object|null} editor - active Monaco editor.
     * @returns {{query: string, reason: 'editor'|'symbol'|null}} search request.
     */
    function findUsagesSearchTarget(editor) {
      const model = editor?.getModel?.() ?? null;
      if (model === null) return { query: '', reason: 'editor' };
      const normalize = (value) => {
        const raw = typeof value === 'string' ? value : '';
        if (/[\r\n]/u.test(raw)) return '';
        const text = raw.trim();
        if (text === '' || text.length > 200) return '';
        return text;
      };
      const selection = editor?.getSelection?.() ?? null;
      if (selection !== null && selection.isEmpty?.() === false) {
        const selected = normalize(model.getValueInRange?.(selection));
        if (selected !== '') return { query: selected, reason: null };
      }
      const position = selection?.getPosition?.()
        ?? selection?.getStartPosition?.()
        ?? editor?.getPosition?.()
        ?? null;
      const word = position === null ? null : model.getWordAtPosition?.(position) ?? null;
      const query = normalize(word?.word);
      return query === ''
        ? { query: '', reason: 'symbol' }
        : { query, reason: null };
    }

    /**
     * Build the single Search Everywhere to Find handoff contract.
     * @param {object} options - query, result sets, mode and persisted search options.
     * @returns {{needsConfirmation: boolean, total: number, request: object}} handoff request.
     */
    function searchFindHandoff({
      query,
      files,
      matches,
      activeRowKey = '',
      truncated = false,
      mode = 'find',
      withReplace = false,
      caseSensitive = false,
      wholeWords = false,
      regex = false,
      preserveCase = false,
      includeExcluded = false,
      fileMask = '',
      limit = 200,
    }) {
      const fileList = Array.isArray(files) ? files : [];
      const matchList = Array.isArray(matches) ? matches : [];
      const total = fileList.length + matchList.length;
      const boundedLimit = Math.max(0, Number(limit) || 200);
      const rowKeys = [
        ...fileList.map((file) => typeof file?.rowKey === 'string' ? file.rowKey : `file:${file?.path ?? ''}`),
        ...matchList.map((match) =>
          typeof match?.rowKey === 'string'
            ? match.rowKey
            : `text:${match?.path ?? ''}:${match?.line ?? 1}:${match?.column ?? 1}`),
      ];
      const activeIndex = rowKeys.indexOf(activeRowKey);
      return {
        needsConfirmation: searchEverywhereRequiresResultConfirmation(fileList, matchList, boundedLimit),
        total,
        request: {
          query: typeof query === 'string' ? query : '',
          files: fileList,
          matches: matchList,
          index: activeIndex < 0 ? 0 : activeIndex,
          truncated: truncated === true,
          mode: mode === 'replace' || withReplace === true ? 'replace' : 'find',
          caseSensitive: caseSensitive === true,
          wholeWords: regex === true ? false : wholeWords === true,
          regex: regex === true,
          preserveCase: preserveCase === true,
          includeExcluded: includeExcluded === true,
          fileMask: typeof fileMask === 'string' ? fileMask : '',
        },
      };
    }

    /**
     * Reserve one replace write before React can commit its busy state.
     *
     * Two keyboard events can run in the same task while `replaceBusy` is still
     * false. The ref closes that gap; state continues to drive disabled UI.
     * @param {{current: boolean}|null} guard - synchronous write guard.
     * @param {boolean} stateBusy - current React busy state.
     * @returns {boolean} whether this caller owns the next write.
     */
    /**
     * Preserve Find in Files query text exactly, including New Line whitespace.
     *
     * Whitespace is user data here: trimming it changes the literal searched or
     * replaced bytes and makes a textarea query disagree with its visible value.
     * @param {unknown} query - raw Find query.
     * @returns {string} exact query string.
     */
    function findToolContentQuery(query) {
      return typeof query === 'string' ? query : '';
    }

    /**
     * Decide whether Find has a representable content query.
     *
     * Empty strings are the only empty state. A space or newline is a valid
     * one-character literal query, matching IDEA's Find in Files field.
     * @param {unknown} query - raw Find query.
     * @returns {boolean} whether the query has at least one character.
     */
    function hasFindToolContentQuery(query) {
      return findToolContentQuery(query).length > 0;
    }

    /**
     * Enter a new Find query generation without claiming a completed search.
     *
     * IDEA clears the old query's rows as soon as the text changes. DSH keeps
     * the same row-clearing semantics, but its 180 ms host debounce means the
     * new result cannot be known yet: report Loading immediately rather than a
     * false "No matches" state.
     * @param {object|null} current - current Find state.
     * @param {unknown} query - next raw query text.
     * @returns {object|null} next Find state.
     */
    function findToolQueryTransition(current, query) {
      if (current === null || typeof current !== 'object') return current;
      const nextQuery = findToolContentQuery(query);
      return {
        ...current,
        query: nextQuery,
        files: [],
        matches: [],
        truncated: false,
        index: 0,
        loading: hasFindToolContentQuery(nextQuery),
        error: null,
        loadedGeneration: -1,
        searchGeneration: (current.searchGeneration ?? 0) + 1,
      };
    }

    /**
     * Move Search Everywhere to another provider tab without leaking text state.
     *
     * A text-search error belongs only to All/Text. Leaving those providers
     * must clear it immediately, and Actions/Files cannot inherit a hanging
     * textLoading flag. All and Text both own the text request, so switching
     * between them keeps an in-flight text search alive.
     * @param {object|null} current - current Search Everywhere state.
     * @param {unknown} tab - requested provider tab.
     * @returns {object|null} next state.
     */
    function searchEverywhereTabTransition(current, tab) {
      if (current === null || typeof current !== 'object') return current;
      const nextTab = tab === 'files' || tab === 'text' || tab === 'actions' ? tab : 'all';
      const textCapable = nextTab === 'all' || nextTab === 'text';
      return {
        ...current,
        tab: nextTab,
        index: 0,
        error: null,
        textLoading: textCapable ? current.textLoading === true : false,
      };
    }

    /**
     * Format the bounded Find result count with correct file singular/plural.
     * @param {Function} t - locale translator.
     * @param {number} matches - visible occurrence count.
     * @param {number} files - visible file group count.
     * @returns {string} localized result summary.
     */
    function findToolResultSummary(t, matches, files) {
      if (matches === 1 && files === 1) return t('editor.findToolSummaryOne');
      if (files === 1) return t('editor.findToolSummaryOneFile', { matches });
      return t('editor.findToolSummary', { matches, files });
    }

    /**
     * Decide whether one asynchronous Find response may still mutate state.
     *
     * Matching requestId alone is insufficient after a workspace switch: the
     * old response can otherwise record its query into the new workspace's
     * history even though the Find surface has already been closed.
     * @param {number} requestId - request generation captured before I/O.
     * @param {string} requestRoot - workspace root captured before I/O.
     * @param {number} currentRequestId - latest request generation.
     * @param {string} currentRoot - current workspace root.
     * @returns {boolean} whether the response still belongs to the live surface.
     */
    function findToolRequestIsCurrent(requestId, requestRoot, currentRequestId, currentRoot) {
      return requestId === currentRequestId && requestRoot === currentRoot;
    }

    /**
     * Resolve the next enabled Find scope mode for keyboard navigation.
     *
     * Module is intentionally excluded while the text workspace has no module
     * search model. Arrow keys therefore cycle the visible usable modes instead
     * of trapping focus on a disabled button.
     * @param {string} current - active scope mode.
     * @param {string} key - keyboard event key.
     * @returns {'project'|'directory'|'scope'|null} next mode, or null.
     */
    function findToolScopeModeTarget(current, key) {
      const modes = ['project', 'directory', 'scope'];
      if (key === 'Home') return modes[0];
      if (key === 'End') return modes[modes.length - 1];
      const currentIndex = modes.indexOf(current);
      if (currentIndex < 0) return modes[0];
      if (key === 'ArrowRight') return modes[(currentIndex + 1) % modes.length];
      if (key === 'ArrowLeft') return modes[(currentIndex - 1 + modes.length) % modes.length];
      return null;
    }

    /**
     * Apply preflighted dirty-buffer replacement plans as one undoable group.
     *
     * Each model retains its own Monaco undo boundary. If a later model fails,
     * earlier successful model edits are restored before the primary error is
     * rethrown, so Replace All cannot leave a partial dirty commit.
     * @param {Array<{path: string, model: object, text: string, count: number}>} plans - dirty plans.
     * @returns {{contents: Map<string, string>, paths: string[], count: number}} committed state.
     */
    function commitFindToolDirtyPlans(plans) {
      const attempted = [];
      const contents = new Map();
      const paths = [];
      let count = 0;
      try {
        for (const plan of Array.isArray(plans) ? plans : []) {
          const model = plan?.model;
          if (model === null || typeof model !== 'object' || typeof model.getValue !== 'function') {
            throw new Error(`dirty buffer is unavailable: ${plan?.path ?? '<unknown>'}`);
          }
          const original = model.getValue();
          if (plan.text === original) continue;
          attempted.push({ path: plan.path, model, original });
          model.pushStackElement?.();
          model.pushEditOperations([], [{
            range: model.getFullModelRange(),
            text: plan.text,
            forceMoveMarkers: true,
          }], () => null);
          contents.set(plan.path, plan.text);
          paths.push(plan.path);
          count += Math.max(0, Number(plan.count) || 0);
        }
      } catch (failure) {
        const primary = failure instanceof Error ? failure : new Error(String(failure));
        const rollbackFailures = [];
        for (const entry of [...attempted].reverse()) {
          if (entry.model.getValue?.() === entry.original) continue;
          try {
            entry.model.pushStackElement?.();
            entry.model.pushEditOperations([], [{
              range: entry.model.getFullModelRange(),
              text: entry.original,
              forceMoveMarkers: true,
            }], () => null);
          } catch (rollbackFailure) {
            rollbackFailures.push({
              path: entry.path,
              message: rollbackFailure instanceof Error ? rollbackFailure.message : String(rollbackFailure),
            });
          }
        }
        if (rollbackFailures.length > 0) {
          primary.message += `; dirty rollback failed for ${rollbackFailures.map((item) => item.path).join(', ')}`;
          primary.rollbackFailures = rollbackFailures;
        }
        throw primary;
      }
      return { contents, paths, count };
    }

    /**
     * Split workspace replacement hits into clean host targets and dirty model
     * plans using one shared preflight for Search Everywhere and Find.
     *
     * No model is mutated here. The caller first completes any clean host write,
     * then passes the returned dirty plans to `commitFindToolDirtyPlans()`.
     * @param {object[]} matches - bounded text occurrences.
     * @param {object[]} openFiles - current editor files.
     * @param {Map<string, object>} models - live Monaco models by workspace path.
     * @param {string} query - exact search query.
     * @param {string} replacement - exact replacement template.
     * @param {object} options - search and replacement options.
     * @returns {{
     *   dirtyMatches: object[],
     *   cleanMatches: object[],
     *   cleanTargets: Map<string, object>,
     *   dirtyPlans: object[],
     *   errorPath: string|null,
     *   errorMessage: string|null
     * }} replacement plan.
     */
    function planWorkspaceReplacements(matches, openFiles, models, query, replacement, options) {
      const dirtyFiles = new Map(
        (Array.isArray(openFiles) ? openFiles : [])
          .filter((file) => file?.dirty === true && typeof file.path === 'string')
          .map((file) => [file.path, file]),
      );
      const hitList = Array.isArray(matches) ? matches : [];
      const dirtyMatches = hitList.filter((match) => dirtyFiles.has(match.path));
      const cleanMatches = hitList.filter((match) => !dirtyFiles.has(match.path));
      const cleanTargets = new Map();
      for (const match of cleanMatches) {
        if (typeof match?.path === 'string' && match.path !== '' && !cleanTargets.has(match.path)) {
          cleanTargets.set(match.path, { path: match.path, mtime: match.mtime });
        }
      }
      const dirtyPlans = [];
      const dirtyPaths = [...new Set(dirtyMatches.map((match) => match.path))];
      for (const path of dirtyPaths) {
        const model = models instanceof Map ? models.get(path) : undefined;
        if (model === undefined) {
          return {
            dirtyMatches,
            cleanMatches,
            cleanTargets,
            dirtyPlans: [],
            errorPath: path,
            errorMessage: null,
          };
        }
        const rewritten = editorReplaceAll(model.getValue(), query, replacement, { ...options, path });
        if (rewritten.error !== null) {
          return {
            dirtyMatches,
            cleanMatches,
            cleanTargets,
            dirtyPlans: [],
            errorPath: null,
            errorMessage: rewritten.error,
          };
        }
        if (rewritten.count > 0) {
          dirtyPlans.push({ path, model, text: rewritten.text, count: rewritten.count });
        }
      }
      return {
        dirtyMatches,
        cleanMatches,
        cleanTargets,
        dirtyPlans,
        errorPath: null,
        errorMessage: null,
      };
    }

    function claimReplaceAttempt(guard, stateBusy = false) {
      if (stateBusy === true || guard === null || typeof guard !== 'object') return false;
      if (guard.current === true) return false;
      guard.current = true;
      return true;
    }

    /**
     * Release a replace write reserved by {@link claimReplaceAttempt}.
     * @param {{current: boolean}|null} guard - synchronous write guard.
     * @returns {void}
     */
    function releaseReplaceAttempt(guard) {
      if (guard !== null && typeof guard === 'object') guard.current = false;
    }

    /**
     * 解析替换输入框的 Enter 意图，避免无关修饰键触发写入。
     * Find 使用 Enter 替换一处、Alt+Shift+Enter 全部替换，并保留
     * Cmd/Ctrl+Enter 兼容；Search Everywhere 仍使用 Enter=全部替换。
     * @param {KeyboardEvent|object} event - replacement input key event.
     * @param {'single'|'all'} plainEnter - action for unmodified Enter.
     * @returns {'single'|'all'|null} resolved replace intent.
     */
    function replaceInputAction(event, plainEnter) {
      if (event === null || typeof event !== 'object' || event.key !== 'Enter') return null;
      if (event.isComposing === true) return null;
      const accelerated = event.metaKey === true || event.ctrlKey === true;
      const replaceAllChord = event.altKey === true && event.shiftKey === true && !accelerated;
      if (replaceAllChord || accelerated) return 'all';
      if (event.shiftKey === true || event.altKey === true) return null;
      return plainEnter === 'all' ? 'all' : 'single';
    }

    /**
     * Settle one failed replacement without attaching a stale error to a newer query.
     *
     * Query and option changes increment searchGeneration immediately. If that
     * generation no longer matches the request, the user has moved to another
     * result set; the failure must not replace that newer context with an error
     * or steal focus back to the old replacement.
     * @param {object|null} current - current Find state.
     * @param {number} requestGeneration - search generation captured before I/O.
     * @param {string} message - replacement failure text.
     * @returns {object|null} settled Find state.
     */
    function replaceFailureState(current, requestGeneration, message) {
      if (current === null) return current;
      const currentGeneration = Number(current.searchGeneration) || 0;
      const currentRequest = Number(requestGeneration) || 0;
      const isCurrent = currentGeneration === currentRequest;
      return {
        ...current,
        replaceBusy: false,
        error: isCurrent ? message : null,
        replaceFocusRequest: isCurrent
          ? (current.replaceFocusRequest ?? 0) + 1
          : current.replaceFocusRequest ?? 0,
      };
    }

    /**
     * Count UTF-8 bytes without depending on Node's Buffer in the browser.
     * @param {unknown} value - text retained by a replace snapshot.
     * @returns {number} encoded byte length.
     */
    function replaceHistoryTextBytes(value) {
      const text = String(value ?? '');
      if (typeof TextEncoder === 'function') return new TextEncoder().encode(text).byteLength;
      return text.length * 2;
    }

    /**
     * Append one Find replace operation to a bounded client history stack.
     * The host applies the same 20-operation / 16 MiB limits to clean content;
     * this budget covers dirty buffer payload retained by the browser.
     * History stays contiguous: once the budget is exceeded, that operation
     * and every older operation are discarded instead of keeping an undoable
     * newest item over budget.
     */
    function boundedReplaceHistory(history, operation, limit = 20, maxBytes = 16 * 1024 * 1024) {
      const next = [...(Array.isArray(history) ? history : []), operation].slice(-Math.max(1, limit));
      const byteLimit = Math.max(0, Number(maxBytes) || 0);
      let totalBytes = 0;
      const retained = [];
      for (let index = next.length - 1; index >= 0; index -= 1) {
        const entry = next[index];
        const dirtyBytes = (Array.isArray(entry?.dirty) ? entry.dirty : [])
          .reduce((total, item) => total
            + replaceHistoryTextBytes(item?.beforeContent)
            + replaceHistoryTextBytes(item?.afterContent), 0);
        if (totalBytes + dirtyBytes > byteLimit) break;
        totalBytes += dirtyBytes;
        retained.push(entry);
      }
      return retained.reverse();
    }

    /**
     * Add one query to the bounded recent-search list.
     * @param {string[]} history - existing newest-first queries.
     * @param {string} query - query that produced a result the user opened.
     * @param {number} [limit=20] - maximum retained entries.
     * @returns {string[]} normalized newest-first history.
     */
    function rememberSearchHistory(history, query, limit = 20) {
      const entries = Array.isArray(history)
        ? history.filter((entry) => typeof entry === 'string' && entry.trim() !== '').map((entry) => entry.trim())
        : [];
      const next = typeof query === 'string' ? query.trim() : '';
      if (next === '') return [...new Set(entries)].slice(0, limit);
      return [next, ...entries.filter((entry) => entry !== next)].filter((entry, index, list) => list.indexOf(entry) === index).slice(0, limit);
    }

    /**
     * Preserve one exact replacement, including whitespace-only and multiline
     * text. IDEA stores the replacement that was actually executed, so trimming
     * it here would make History replay a different operation.
     * @param {unknown} entry - stored or newly entered replacement.
     * @returns {string} exact replacement, including the empty deletion value.
     */
    function normalizeReplacementHistoryEntry(entry) {
      return typeof entry === 'string' ? entry : '';
    }

    /**
     * Add one replacement to its bounded history.
     * @param {string[]} history - existing newest-first replacements.
     * @param {string|undefined} replacement - executed replacement text;
     *   undefined when only normalizing stored entries.
     * @param {number} [limit=20] - maximum retained entries.
     * @returns {string[]} exact newest-first history.
     */
    function rememberReplacementHistory(history, replacement, limit = 20) {
      const entries = (Array.isArray(history) ? history : [])
        .filter((entry) => typeof entry === 'string');
      if (typeof replacement !== 'string') return [...new Set(entries)].slice(0, limit);
      return [replacement, ...entries.filter((entry) => entry !== replacement)]
        .filter((entry, index, list) => list.indexOf(entry) === index)
        .slice(0, limit);
    }

    /**
     * Remember one executed Search Everywhere action.
     * @param {string[]} history - existing newest-first action IDs.
     * @param {string} id - executed action ID.
     * @param {number} [limit=12] - maximum retained IDs.
     * @returns {string[]} normalized newest-first action IDs.
     */
    function rememberCommandHistory(history, id, limit = 12) {
      const entries = Array.isArray(history)
        ? history.filter((entry) => typeof entry === 'string' && entry.trim() !== '').map((entry) => entry.trim())
        : [];
      const next = typeof id === 'string' ? id.trim() : '';
      if (next === '') return [...new Set(entries)].slice(0, limit);
      return [next, ...entries.filter((entry) => entry !== next)]
        .filter((entry, index, list) => list.indexOf(entry) === index)
        .slice(0, limit);
    }

    /** Global command-recency key for Search Everywhere Actions. */
    const COMMAND_HISTORY_KEY = 'dsh-editor.search.commandHistory';

    /** Read recent executed action IDs. */
    function readCommandHistory() {
      try {
        return rememberCommandHistory(JSON.parse(window.localStorage.getItem(COMMAND_HISTORY_KEY) ?? '[]'), '', 12);
      } catch {
        return [];
      }
    }

    /** Persist recent executed action IDs. */
    function writeCommandHistory(history) {
      try {
        window.localStorage.setItem(COMMAND_HISTORY_KEY, JSON.stringify(rememberCommandHistory(history, '', 12)));
      } catch {
        /* storage-less browsers keep the in-memory order */
      }
    }

    /**
     * Explicit IDEA category inventory for the Actions exposed by this plugin.
     * Null means IDEA Search Everywhere renders the action without a category.
     * This is presentation metadata only: tabs and ordinary text matching own
     * action filtering, never the category value.
     */
    const SEARCH_EVERYWHERE_ACTION_CATEGORY_KEYS = new Map([
      ['searchEverywhere', 'editor.searchCategoryNavigate'],
      ['goToFile', 'editor.searchCategoryNavigate'],
      ['recentFiles', 'editor.searchCategoryNavigate'],
      ['textSearch', 'editor.searchCategoryNavigate'],
      ['findAction', 'editor.searchCategoryNavigate'],
      ['showSearchHistory', 'editor.searchCategoryNavigate'],
      ['recentFindUsages', 'editor.searchCategoryEditFindUsages'],
      ['find', 'editor.searchCategoryEditFind'],
      ['findToolWindow', null],
      ['replace', 'editor.searchCategoryEditFind'],
      ['structuralSearch', 'editor.searchCategoryEditFind'],
      ['structuralReplace', 'editor.searchCategoryEditFind'],
      ['incrementalSearch', null],
      ['searchInSelectionOnly', 'editor.searchCategoryEditFind'],
      ['replaceInSelectionOnly', 'editor.searchCategoryEditFind'],
      ['findSelectionInFiles', 'editor.searchCategoryEditFind'],
      ['replaceSelectionInFiles', 'editor.searchCategoryEditFind'],
      ['findUsages', 'editor.searchCategoryEditFindUsages'],
      ['showUsages', 'editor.searchCategoryEditFindUsages'],
      ['findUsagesSettings', 'editor.searchCategoryEditFindUsages'],
      ['findUsagesInFile', 'editor.searchCategoryEditFindUsages'],
      ['highlightUsagesInFile', 'editor.searchCategoryEditFindUsages'],
      ['searchWeb', null],
      ['findNextWordOccurrence', 'editor.searchCategoryEditFind'],
      ['findPreviousWordOccurrence', 'editor.searchCategoryEditFind'],
      ['selectAllOccurrences', 'editor.searchCategoryEditFind'],
      ['selectNextOccurrence', 'editor.searchCategoryEditFind'],
      ['unselectPreviousOccurrence', 'editor.searchCategoryEditFind'],
      ['findNext', 'editor.searchCategoryEditFind'],
      ['findPrevious', 'editor.searchCategoryEditFind'],
      ['searchInChanges', 'editor.searchCategoryEditFind'],
      ['findInFiles', 'editor.searchCategoryEditFind'],
      ['replaceInFiles', 'editor.searchCategoryEditFind'],
    ]);

    /**
     * Return the truthful IDEA category for one exposed search Action.
     * @param {string} id - Search Everywhere action id.
     * @param {Function} t - locale translator.
     * @returns {string} localized category.
     */
    function searchEverywhereActionCategory(id, t) {
      const key = SEARCH_EVERYWHERE_ACTION_CATEGORY_KEYS.get(id);
      return typeof key === 'string' ? t(key) : null;
    }

    /**
     * Rank Search Everywhere actions by match quality, then command recency.
     * Empty queries therefore show recently executed commands first, while a
     * typed query still prefers an exact/strong textual match.
     * @param {object[]} actions - registered actions.
     * @param {string} query - action query (slash already removed).
     * @param {string[]} recentCommands - newest-first action IDs.
     * @param {{caseSensitive?: boolean, wholeWords?: boolean}} [options] - shared search filters.
     * @returns {object[]} ranked actions.
     */
    function rankSearchActions(actions, query, recentCommands, options) {
      options = options ?? {};
      const needle = typeof query === 'string' ? query.trim() : '';
      const caseSensitive = options?.caseSensitive === true;
      const wholeWords = options?.wholeWords === true;
      const normalizedNeedle = (caseSensitive ? needle : needle.toLowerCase())
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
      const recent = Array.isArray(recentCommands) ? recentCommands : [];
      return (Array.isArray(actions) ? actions : [])
        .map((action, index) => {
          const keywords = Array.isArray(action.keywords)
            ? action.keywords.join(' ')
            : action.keywords ?? '';
          const labelScore = fuzzyScore(action.label, needle, { caseSensitive, wholeWords });
          const normalizedLabel = typeof action.label === 'string'
            ? (caseSensitive ? action.label : action.label.toLowerCase())
            : '';
          const needleText = caseSensitive ? needle : needle.toLowerCase();
          const labelDirect = needle === ''
            ? -1
            : wholeWords === true
              ? wholeWordIndex(normalizedLabel, needleText, true)
              : normalizedLabel.indexOf(needleText);
          const labelRank = labelDirect === 0 ? 3 : labelDirect > 0 ? 2 : labelScore >= 0 ? 1 : 0;
          const descriptionText = `${action.description ?? ''} ${keywords}`
            .normalize('NFC');
          const descriptionHaystack = caseSensitive ? descriptionText : descriptionText.toLowerCase();
          const normalizedDescription = descriptionHaystack
            .replace(/[^\p{L}\p{N}]+/gu, ' ')
            .trim();
          const descriptionWords = normalizedDescription === '' ? [] : normalizedDescription.split(' ');
          const queryWords = normalizedNeedle === '' ? [] : normalizedNeedle.split(' ');
          const descriptionMatches = queryWords.length > 0 && queryWords.every((word) =>
            descriptionWords.some((candidate) => wholeWords ? candidate === word : candidate.startsWith(word)));
          const firstDescriptionWord = descriptionMatches
            ? Math.max(0, descriptionWords.findIndex((candidate) => candidate.startsWith(queryWords[0])))
            : -1;
          return {
            action,
            index,
            /* The command label is the primary identity. A description may
               mention both directions ("next or previous"), so relying on the
               combined fuzzy string can rank unrelated actions by scattered
               letters. Labels stay fuzzy-capable; description and keywords
               require a normalized contiguous match, like IDEA's filtered
               Search Everywhere Actions list. */
            score: needle === ''
              ? 0
              : labelRank > 0
                ? labelRank * 2000 + labelScore
                : descriptionMatches
                  ? 500 - Math.min(firstDescriptionWord, 100)
                  : -1,
            recentIndex: recent.indexOf(action.id),
          };
        })
        .filter((entry) => entry.score >= 0)
        .sort((left, right) => {
          if (left.score !== right.score) return right.score - left.score;
          if (left.recentIndex >= 0 || right.recentIndex >= 0) {
            if (left.recentIndex < 0) return 1;
            if (right.recentIndex < 0) return -1;
            if (left.recentIndex !== right.recentIndex) return left.recentIndex - right.recentIndex;
          }
          return left.index - right.index;
        })
        .map((entry) => entry.action);
    }

    /**
     * Move by one result while skipping disabled actions.
     *
     * IDEA keeps disabled actions visible, but keyboard traversal must not land
     * on a row where Enter is guaranteed to do nothing. Wrapping is retained so
     * the search list remains a closed keyboard loop.
     * @param {object[]} results - visible Search Everywhere rows.
     * @param {number} current - current active index.
     * @param {number} direction - +1 next, -1 previous.
     * @returns {number|null} next enabled index, or null when all rows are disabled.
     */
    function nextEnabledSearchResultIndex(results, current, direction) {
      const rows = Array.isArray(results) ? results : [];
      if (rows.length === 0) return null;
      const step = Number(direction) < 0 ? -1 : 1;
      const start = Math.max(0, Math.min(rows.length - 1, Math.floor(Number(current) || 0)));
      for (let offset = 1; offset <= rows.length; offset += 1) {
        const index = ((start + step * offset) % rows.length + rows.length) % rows.length;
        if (rows[index]?.disabled !== true) return index;
      }
      return null;
    }

    /**
     * Search Everywhere rows are grouped by recent history and provider kind.
     * @param {object|null} result - visible row.
     * @returns {'recent'|'action'|'file'|'text'|'other'} stable group key.
     */
    function searchEverywhereResultGroupKey(result) {
      if (result?.history === true) return 'recent';
      if (result?.kind === 'action' || result?.kind === 'file' || result?.kind === 'text') return result.kind;
      return 'other';
    }

    /**
     * Resolve IDEA's Search Everywhere group-navigation chord for this platform.
     *
     * The built-in macOS keymap uses Meta+Up/Down, while the generic keymap uses
     * Control+Up/Down. Page Up/Down is shared. Additional modifiers must not be
     * swallowed because those combinations belong to text navigation or the OS.
     * @param {KeyboardEvent|object} event - Search Everywhere query keydown.
     * @param {boolean} mac - whether IDEA's macOS keymap applies.
     * @returns {1|-1|0} next group, previous group, or no group action.
     */
    function searchEverywhereGroupNavigationDirection(event, mac) {
      if (event?.altKey === true || event?.shiftKey === true) return 0;
      if (event?.key === 'PageDown') return 1;
      if (event?.key === 'PageUp') return -1;
      const platformModifier = mac === true
        ? event?.metaKey === true && event?.ctrlKey !== true
        : event?.ctrlKey === true && event?.metaKey !== true;
      if (!platformModifier) return 0;
      if (event?.key === 'ArrowDown') return 1;
      if (event?.key === 'ArrowUp') return -1;
      return 0;
    }

    /**
     * IDEA's NavigateToNextGroup/PrevGroup acts on the provider groups, not on
     * individual disabled rows. Entering either direction targets the first
     * enabled row of the adjacent group and never wraps past the list bounds.
     * @param {object[]} results - visible Search Everywhere rows.
     * @param {number} current - current active index.
     * @param {number} direction - +1 next group, -1 previous group.
     * @returns {number|null} first enabled row in the adjacent group.
     */
    function searchEverywhereGroupTargetIndex(results, current, direction) {
      const rows = Array.isArray(results) ? results : [];
      if (rows.length === 0) return null;
      const active = Math.max(0, Math.min(rows.length - 1, Math.floor(Number(current) || 0)));
      const group = searchEverywhereResultGroupKey(rows[active]);
      if (Number(direction) < 0) {
        let boundary = active;
        while (boundary > 0 && searchEverywhereResultGroupKey(rows[boundary - 1]) === group) boundary -= 1;
        if (boundary === 0) return null;
        let start = boundary - 1;
        while (start > 0 && searchEverywhereResultGroupKey(rows[start - 1]) === searchEverywhereResultGroupKey(rows[start])) start -= 1;
        for (let index = start; index < boundary; index += 1) {
          if (rows[index]?.disabled !== true) return index;
        }
        return null;
      }

      let boundary = active;
      while (boundary < rows.length - 1 && searchEverywhereResultGroupKey(rows[boundary + 1]) === group) boundary += 1;
      if (boundary === rows.length - 1) return null;
      const nextGroup = searchEverywhereResultGroupKey(rows[boundary + 1]);
      for (let index = boundary + 1; index < rows.length; index += 1) {
        if (searchEverywhereResultGroupKey(rows[index]) !== nextGroup) break;
        if (rows[index]?.disabled !== true) return index;
      }
      return null;
    }

    /**
     * Clamp a stale active index and move it off a disabled row when possible.
     * Filtering can remove the previously active result or leave a disabled
     * action at the same numeric position; the visible list must converge before
     * mouse/Enter or the next keyboard step uses it.
     * @param {object[]} results - visible rows after query/filter changes.
     * @param {unknown} index - state index from the previous row set.
     * @returns {number} valid visible index.
     */
    function normalizeSearchResultIndex(results, index) {
      const rows = Array.isArray(results) ? results : [];
      if (rows.length === 0) return 0;
      const clamped = Math.max(0, Math.min(rows.length - 1, Math.floor(Number(index) || 0)));
      if (rows[clamped]?.disabled !== true) return clamped;
      return nextEnabledSearchResultIndex(rows, clamped, 1) ?? clamped;
    }

    /**
     * Stable option identity for one textual usage result.
     * @param {{path?: string, line?: number, column?: number}} match - text match.
     * @returns {string} listbox option key.
     */
    function usageMatchRowKey(match) {
      return `usage:${match?.path ?? ''}:${match?.line ?? 1}:${match?.column ?? 1}`;
    }

    /**
     * Filter loaded Show Usages rows without issuing another workspace search.
     * IDEA's transient popup filters its current usage table locally.
     * @param {object[]} matches - loaded text matches.
     * @param {unknown} value - local filter text.
     * @returns {object[]} matching rows.
     */
    function filterUsageMatches(matches, value) {
      const rows = Array.isArray(matches) ? matches : [];
      const query = typeof value === 'string' ? value.trim().toLowerCase() : '';
      if (query === '') return rows;
      return rows.filter((match) =>
        String(match?.path ?? '').toLowerCase().includes(query)
        || String(match?.preview ?? '').toLowerCase().includes(query));
    }

    /**
     * Clamp a usage selection to the currently filtered rows.
     * @param {object[]} matches - filtered rows.
     * @param {unknown} index - previous selection.
     * @returns {number} valid zero-based index, or zero for an empty list.
     */
    function normalizeUsageMatchIndex(matches, index) {
      const rows = Array.isArray(matches) ? matches : [];
      if (rows.length === 0) return 0;
      return Math.max(0, Math.min(rows.length - 1, Math.floor(Number(index) || 0)));
    }

    /**
     * Section label for the empty/command Search Everywhere list.
     * @param {object} result - current row.
     * @param {object|undefined} previous - preceding row.
     * @param {string} query - trimmed query.
     * @param {'all'|'files'|'text'|'actions'} tab - active page.
     * @param {boolean} commandMode - whether slash command mode is active.
     * @returns {'recent'|'actions'|null} section to render before this row.
     */
    function searchEverywhereSection(result, previous, query, tab, commandMode) {
      if (!commandMode && !(tab === 'all' && query === '')) return null;
      const current = result?.history === true ? 'recent' : 'actions';
      const prior = previous === undefined || previous === null
        ? null
        : previous?.history === true ? 'recent' : 'actions';
      return current === prior ? null : current;
    }

    /**
     * Human-readable tooltip for one Search Everywhere action.
     * @param {object} result - action row.
     * @returns {string} disabled reason or action metadata.
     */
    function searchEverywhereResultTooltip(result) {
      if (result?.disabled === true) return result.disabledReason ?? '';
      return [result?.label, result?.description, result?.category, result?.shortcut]
        .filter((part) => typeof part === 'string' && part.trim() !== '')
        .join(' — ');
    }

    /**
     * Describe one Search Everywhere result using only data DSH actually owns.
     * @param {object|null} result - action, file or text result.
     * @param {Function} t - locale translator.
     * @returns {{kind: string, title: string, detail: string, meta: string}|null} item info.
     */
    function searchEverywhereItemInfo(result, t) {
      if (result === null || typeof result !== 'object') return null;
      if (result.kind === 'action') {
        return {
          kind: t('editor.searchItemKindAction'),
          title: typeof result.label === 'string' ? result.label : String(result.title ?? ''),
          detail: typeof result.description === 'string' ? result.description : String(result.subtitle ?? ''),
          meta: result.disabled === true
            ? [result.category, result.disabledReason]
              .filter((part) => typeof part === 'string' && part.trim() !== '')
              .join(' · ')
            : [result.category, result.shortcut]
              .filter((part) => typeof part === 'string' && part.trim() !== '')
              .join(' · '),
        };
      }
      if (result.kind === 'file' || result.kind === 'text') {
        const path = typeof result.path === 'string' ? result.path : '';
        const location = result.kind === 'text' ? `${path}:${Number(result.line) || 1}:${Number(result.column) || 1}` : path;
        return {
          kind: t(result.kind === 'text' ? 'editor.searchItemKindText' : 'editor.searchItemKindFile'),
          title: basename(path),
          detail: location,
          meta: result.kind === 'text' && typeof result.preview === 'string' ? result.preview : '',
        };
      }
      return null;
    }

    /**
     * Convert IDEA's visible shortcut glyphs into the ARIA key syntax.
     * @param {unknown} shortcut - shortcut such as `⌘⇧O`.
     * @returns {string|undefined} normalized `aria-keyshortcuts` value.
     */
    function searchEverywhereAriaKeyShortcuts(shortcut) {
      const text = typeof shortcut === 'string' ? shortcut.trim() : '';
      if (text === '') return undefined;
      const modifiers = [];
      const modifierNames = { '⌃': 'Control', '⌥': 'Alt', '⇧': 'Shift', '⌘': 'Meta' };
      for (const character of text) {
        const modifier = modifierNames[character];
        if (modifier !== undefined && !modifiers.includes(modifier)) modifiers.push(modifier);
      }
      const keyGlyphs = {
        '↑': 'ArrowUp',
        '↓': 'ArrowDown',
        '←': 'ArrowLeft',
        '→': 'ArrowRight',
        '⏎': 'Enter',
        '↵': 'Enter',
        '⇥': 'Tab',
        '⎋': 'Escape',
      };
      const key = text.replace(/[⌃⌥⇧⌘]/gu, '').trim();
      if (key === '') return undefined;
      const ariaKey = keyGlyphs[key] ?? (key.length === 1 ? key.toUpperCase() : key);
      if (modifiers.length === 0) return ariaKey;
      return [...modifiers, ariaKey].join('+');
    }

    /**
     * Place a hover tooltip beside a result without crossing the viewport.
     * @param {number} x - row left edge.
     * @param {number} y - row bottom edge.
     * @param {number} viewportWidth - viewport width.
     * @param {number} viewportHeight - viewport height.
     * @param {number} [width=320] - tooltip width.
     * @param {number} [height=80] - tooltip height.
     * @returns {{left: number, top: number}} fixed position.
     */
    function searchEverywhereTooltipPosition(x, y, viewportWidth, viewportHeight, width = 320, height = 80) {
      const left = Math.max(4, Math.min(Number(x) || 0, viewportWidth - width - 4));
      const preferredTop = (Number(y) || 0) + 4;
      const top = preferredTop + height > viewportHeight ? (Number(y) || 0) - height : preferredTop;
      return { left, top: Math.max(4, top) };
    }

    /**
     * Copy one Search/Find result value through the browser clipboard.
     * @param {string} text - text to copy.
     * @param {Function} onNotify - status-line notification callback.
     * @param {Function} t - locale lookup.
     * @returns {void}
     */
    function copySearchResultText(text, onNotify, t) {
      let pending;
      try {
        pending = navigator.clipboard?.writeText(text);
      } catch {
        onNotify(t('editor.clipboardWriteFailed'));
        return;
      }
      if (pending === undefined) {
        onNotify(t('editor.clipboardWriteFailed'));
        return;
      }
      void pending
        .then(() => onNotify(t('editor.copiedToClipboard')))
        .catch(() => onNotify(t('editor.clipboardWriteFailed')));
    }

    /**
     * Build the shared Search Everywhere / Find result context menu.
     * @param {object} options - localized labels and surface callbacks.
     * @returns {Array<object|null>} menu items with separators.
     */
    function searchResultContextItems({
      t,
      result,
      onCloseMenu,
      onOpenEditor,
      onOpenInRightSplit,
      onReplace,
      onRevealResult,
      onNotify,
      onShowInfo,
    }) {
      if (result?.kind !== 'file' && result?.kind !== 'text') return [];
      const copyLocation = result.kind === 'text' ? `${result.path}:${result.line}:${result.column}` : result.path;
      return [
        {
          id: 'openRight',
          label: t('editor.openInRightSplit'),
          run: () => {
            onCloseMenu();
            onOpenInRightSplit();
          },
        },
        {
          id: 'openEditor',
          label: t('editor.openInEditor'),
          run: () => {
            onCloseMenu();
            onOpenEditor();
          },
        },
        ...(result.kind === 'text' && typeof onReplace === 'function'
          ? [{
              id: 'replace',
              label: t('editor.replaceAction'),
              run: () => {
                onCloseMenu();
                onReplace();
              },
            }]
          : []),
        ...(typeof onShowInfo === 'function'
          ? [{
              id: 'showInfo',
              label: t('editor.searchShowItemInfo'),
              run: () => {
                onCloseMenu();
                onShowInfo();
              },
            }]
          : []),
        null,
        {
          id: 'copyRelative',
          label: t('editor.copyRelativePath'),
          run: () => {
            onCloseMenu();
            copySearchResultText(result.path, onNotify, t);
          },
        },
        {
          id: 'copyLocation',
          label: t('editor.copyPathWithLineIdea'),
          run: () => {
            onCloseMenu();
            copySearchResultText(copyLocation, onNotify, t);
          },
        },
        null,
        {
          id: 'reveal',
          label: t('editor.revealInProject'),
          run: () => {
            onCloseMenu();
            onRevealResult();
          },
        },
      ];
    }

    /**
     * Resolve an accessible option id without letting path punctuation collide.
     * @param {string} rowKey - Search Everywhere's stable result identity.
     * @returns {string} DOM id suitable for aria-activedescendant.
     */
    function searchEverywhereOptionId(rowKey) {
      return `dsh-editor-search-option-${encodeURIComponent(String(rowKey ?? ''))}`;
    }

    /**
     * Return the tab IDEA's arrow/Home/End navigation should select.
     * @param {{id: string}[]} tabs - visible search tabs.
     * @param {string} currentId - currently selected tab id.
     * @param {string} key - keyboard key.
     * @returns {string|null} target tab id, or null when the key is unrelated.
     */
    function searchEverywhereTabTarget(tabs, currentId, key) {
      if (!Array.isArray(tabs) || tabs.length === 0) return null;
      if (key === 'Home') return tabs[0].id;
      if (key === 'End') return tabs[tabs.length - 1].id;
      const current = Math.max(0, tabs.findIndex((tab) => tab.id === currentId));
      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const direction = key === 'ArrowLeft' ? -1 : 1;
        return tabs[(current + direction + tabs.length) % tabs.length].id;
      }
      if (key === 'Enter' || key === ' ') return tabs[current].id;
      return null;
    }

    /** Per-workspace search history key. */
    function searchHistoryStorageKey(root) {
      return `dsh-editor.search.history:${root}`;
    }

    /** Per-workspace exact Find query history key. */
    function findQueryHistoryStorageKey(root) {
      return `dsh-editor.find.query.history:${typeof root === 'string' ? root : ''}`;
    }

    /** Browser-local search option key shared by Search Everywhere and Find. */
    const SEARCH_OPTIONS_STORAGE_KEY = 'dsh-editor.search.options.v1';
    /** Browser-local recent File extension masks for Find in Files. */
    const FILE_MASK_HISTORY_STORAGE_KEY = 'dsh-editor.find.fileMasks';

    /**
     * Normalize the bounded File extension/mask history.
     * @param {unknown[]} history - stored newest-first masks.
     * @param {string} [value=''] - newly accepted mask.
     * @param {number} [limit=10] - maximum retained masks.
     * @returns {string[]} normalized newest-first history.
     */
    function rememberFileMaskHistory(history, value = '', limit = 10) {
      const entries = (Array.isArray(history) ? history : [])
        .filter((entry) => typeof entry === 'string' && entry.trim() !== '' && entry.length <= 512)
        .map((entry) => entry.trim());
      const next = typeof value === 'string' ? value.trim() : '';
      if (next === '' || next.length > 512) return [...new Set(entries)].slice(0, limit);
      return [next, ...entries.filter((entry) => entry !== next)]
        .filter((entry, index, list) => list.indexOf(entry) === index)
        .slice(0, limit);
    }

    /**
     * Suggest File masks from paths the Find surface already knows about.
     *
     * IDEA's mask dropdown offers project file types in addition to recent
     * input. DSH must not start a second workspace walk merely to open this
     * menu, so active/open/recent/changed/result paths are the bounded source.
     * More frequent extensions come first; accepted history is not repeated.
     * @param {unknown[]} paths - known workspace-relative paths.
     * @param {string[]} [history=[]] - accepted masks, newest first.
     * @param {number} [limit=12] - maximum suggestions.
     * @returns {string[]} IDEA-style `*.ext` suggestions.
     */
    function suggestFileMasks(paths, history = [], limit = 12) {
      const counts = new Map();
      for (const value of Array.isArray(paths) ? paths : []) {
        if (typeof value !== 'string' || value === '') continue;
        const path = value.replaceAll('\\', '/');
        const name = path.slice(path.lastIndexOf('/') + 1);
        const dot = name.lastIndexOf('.');
        if (dot <= 0 || dot === name.length - 1) continue;
        const extension = name.slice(dot + 1).toLowerCase();
        if (!/^[a-z0-9][a-z0-9_+-]{0,15}$/u.test(extension)) continue;
        counts.set(extension, (counts.get(extension) ?? 0) + 1);
      }
      const excluded = new Set((Array.isArray(history) ? history : [])
        .filter((entry) => typeof entry === 'string')
        .map((entry) => entry.trim().toLowerCase()));
      return [...counts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([extension]) => `*.${extension}`)
        .filter((mask) => !excluded.has(mask))
        .slice(0, Math.max(0, Math.floor(Number(limit) || 0)));
    }

    /**
     * Keep a Find popup menu inside its owning dialog.
     *
     * The menu is fixed-positioned but remains in the dialog's overflow clip.
     * Viewport-only clamping can therefore paint a row over the dialog edge
     * while pointer hit-testing falls through to the page behind it.
     * @param {number} preferredLeft - desired viewport left coordinate.
     * @param {number} surfaceLeft - owning dialog's left edge.
     * @param {number} surfaceRight - owning dialog's right edge.
     * @param {number} [width=220] - reserved menu width.
     * @returns {number} clamped dialog-local left coordinate.
     */
    function findToolMenuLeft(preferredLeft, surfaceLeft, surfaceRight, width = 220) {
      const left = Number(preferredLeft);
      const boundaryLeft = Number(surfaceLeft);
      const right = Number(surfaceRight);
      const reserved = Math.max(120, Number(width) || 220);
      if (!Number.isFinite(left)) return 4;
      if (!Number.isFinite(boundaryLeft) || !Number.isFinite(right)) return Math.max(4, left);
      const localLeft = left - boundaryLeft;
      const maxLeft = Math.max(4, right - boundaryLeft - reserved - 4);
      return Math.max(4, Math.min(localLeft, maxLeft));
    }

    /**
     * Convert a viewport anchor into the transformed dialog's local Y space.
     * Reserve enough room for a usable menu instead of letting it fall below
     * the dialog's clipped hit-testing surface.
     * @param {number} preferredTop - desired viewport top.
     * @param {number} surfaceTop - owning dialog's top edge.
     * @param {number} surfaceBottom - owning dialog's bottom edge.
     * @returns {number} clamped dialog-local top.
     */
    function findToolMenuTop(preferredTop, surfaceTop, surfaceBottom) {
      const top = Number(preferredTop);
      const boundaryTop = Number(surfaceTop);
      const boundaryBottom = Number(surfaceBottom);
      if (!Number.isFinite(top)) return 4;
      if (!Number.isFinite(boundaryTop) || !Number.isFinite(boundaryBottom)) return Math.max(4, top);
      const localTop = top - boundaryTop;
      const maxTop = Math.max(4, boundaryBottom - boundaryTop - 164);
      return Math.max(4, Math.min(localTop, maxTop));
    }

    /**
     * Bound a Find menu to the remaining dialog height so long histories scroll.
     * @param {number} surfaceTop - owning dialog's top edge.
     * @param {number} surfaceBottom - owning dialog's bottom edge.
     * @param {number} localTop - menu's dialog-local top.
     * @returns {number} maximum rendered height.
     */
    function findToolMenuMaxHeight(surfaceTop, surfaceBottom, localTop) {
      const top = Number(surfaceTop);
      const bottom = Number(surfaceBottom);
      const y = Number(localTop);
      if (!Number.isFinite(top) || !Number.isFinite(bottom) || !Number.isFinite(y)) return 320;
      /* The menu's own padding and border are outside its content-box
         max-height, so reserve that chrome as well as the edge gutter. */
      return Math.max(120, bottom - top - y - 20);
    }

    /** Read recent File extension masks from browser storage. */
    function readFileMaskHistory() {
      try {
        return rememberFileMaskHistory(JSON.parse(window.localStorage.getItem(FILE_MASK_HISTORY_STORAGE_KEY) ?? '[]'), '', 10);
      } catch {
        return [];
      }
    }

    /** Persist one File extension mask after it is accepted by the user. */
    function writeFileMaskHistory(value) {
      const next = rememberFileMaskHistory(readFileMaskHistory(), value, 10);
      try {
        window.localStorage.setItem(FILE_MASK_HISTORY_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage-less browsers keep the current field value */
      }
      return next;
    }

    /**
     * Keep persisted search options within the values the UI can represent.
     * @param {unknown} value - parsed storage value or option-bearing state.
     * @returns {{caseSensitive: boolean, wholeWords: boolean, regex: boolean, preserveCase: boolean, includeExcluded: boolean, fileMask: string, contextFilter?: string}} normalized options.
     */
    function normalizeSearchOptions(value) {
      const source = value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
      const regex = source.regex === true;
      const includeExcluded = typeof source.includeNonProject === 'boolean'
        ? source.includeNonProject === true
        : source.includeExcluded === true;
      const contextFilter = ['comments', 'strings', 'exceptComments', 'exceptStrings', 'exceptBoth'].includes(source.contextFilter)
        ? source.contextFilter
        : 'anywhere';
      return {
        caseSensitive: source.caseSensitive === true,
        wholeWords: regex ? false : source.wholeWords === true,
        regex,
        preserveCase: source.preserveCase === true,
        includeExcluded,
        fileMask: typeof source.fileMask === 'string' && source.fileMask.length <= 512 ? source.fileMask : '',
        ...(contextFilter === 'anywhere' ? {} : { contextFilter }),
      };
    }

    /**
     * Read the last valid search options for this browser.
     * @returns {{caseSensitive: boolean, wholeWords: boolean, regex: boolean, preserveCase: boolean, includeExcluded: boolean, fileMask: string, contextFilter?: string}} stored or default options.
     */
    function readSearchOptions() {
      try {
        return normalizeSearchOptions(JSON.parse(window.localStorage.getItem(SEARCH_OPTIONS_STORAGE_KEY) ?? '{}'));
      } catch {
        return normalizeSearchOptions(null);
      }
    }

    /**
     * Persist only the search option subset; queries and results stay transient.
     * @param {object} options - Search Everywhere or Find state.
     * @returns {void}
     */
    function writeSearchOptions(options) {
      try {
        window.localStorage.setItem(SEARCH_OPTIONS_STORAGE_KEY, JSON.stringify(normalizeSearchOptions(options)));
      } catch {
        /* storage-less browsers keep the current in-memory options */
      }
    }

    /**
     * Normalize the last IDEA Find scope into values the UI can restore.
     * Invalid Directory paths fall back to Project rather than the workspace root.
     * @param {unknown} value - parsed storage value or scope request.
     * @returns {{mode: 'project'|'directory'|'scope', preset: string, directory: string}} normalized scope.
     */
    function normalizeFindSearchScope(value) {
      const source = value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
      const requestedMode = source.mode;
      const mode = requestedMode === 'directory' || requestedMode === 'scope' ? requestedMode : 'project';
      const customPreset = typeof source.preset === 'string'
        && /^custom:[a-z0-9][a-z0-9-]{0,63}$/u.test(source.preset)
        ? source.preset
        : null;
      const preset = source.preset === 'openFiles'
        || source.preset === 'changedFiles'
        || source.preset === 'currentFile'
        || source.preset === 'recentlyViewedFiles'
        || source.preset === 'gitTrackedFiles'
        || source.preset === 'gitNonIgnoredFiles'
        ? source.preset
        : customPreset ?? 'projectFiles';
      if (mode !== 'directory') return { mode, preset, directory: '' };
      const raw = typeof source.directory === 'string' ? source.directory.trim().replaceAll('\\', '/') : '';
      const directory = raw.replace(/^\.\/+/u, '').replace(/\/+$/u, '');
      if (
        directory.length > 512
        || directory.startsWith('/')
        || directory.split('/').some((segment) => segment === '' || segment === '..')
      ) {
        return { mode: 'project', preset, directory: '' };
      }
      return { mode, preset, directory };
    }

    /**
     * Scope storage is per workspace: a directory from one project must not
     * silently constrain another project's Find tool.
     * @param {string} root - workspace root.
     * @returns {string} browser-local storage key.
     */
    function findScopeStorageKey(root) {
      return `dsh-editor.find.scope.v1:${typeof root === 'string' ? root : ''}`;
    }

    /** Browser-local geometry for the movable Find in Files popup. */
    const FIND_POPUP_GEOMETRY_STORAGE_KEY = 'dsh-editor.find.popup.geometry.v1';

    /**
     * Keep the movable Find popup inside the current viewport.
     * @param {unknown} value - saved or requested geometry.
     * @param {number} viewportWidth - current viewport width.
     * @param {number} viewportHeight - current viewport height.
     * @returns {{x: number, y: number, width: number, height: number}} safe geometry.
     */
    function clampFindPopupGeometry(value, viewportWidth, viewportHeight) {
      const source = value !== null && typeof value === 'object' ? value : {};
      const viewportW = Math.max(1, Number(viewportWidth) || 1);
      const viewportH = Math.max(1, Number(viewportHeight) || 1);
      const margin = viewportW >= 32 && viewportH >= 32 ? 8 : 0;
      const availableWidth = Math.max(1, viewportW - margin * 2);
      const availableHeight = Math.max(1, viewportH - margin * 2);
      const minimumWidth = Math.min(360, availableWidth);
      const minimumHeight = Math.min(260, availableHeight);
      const requestedWidth = Number(source.width);
      const requestedHeight = Number(source.height);
      const width = Math.round(Math.max(minimumWidth, Math.min(availableWidth, Number.isFinite(requestedWidth) ? requestedWidth : 580)));
      const height = Math.round(Math.max(minimumHeight, Math.min(availableHeight, Number.isFinite(requestedHeight) ? requestedHeight : 536)));
      const requestedX = Number(source.x);
      const requestedY = Number(source.y);
      const maximumX = Math.max(margin, viewportW - margin - width);
      const maximumY = Math.max(margin, viewportH - margin - height);
      const x = Math.round(Math.max(margin, Math.min(maximumX, Number.isFinite(requestedX) ? requestedX : (viewportW - width) / 2)));
      const y = Math.round(Math.max(margin, Math.min(maximumY, Number.isFinite(requestedY) ? requestedY : (viewportH - height) / 2)));
      return { x, y, width, height };
    }

    /** Move the Find popup by a pointer delta and clamp it to the viewport. */
    function moveFindPopupGeometry(start, deltaX, deltaY, viewportWidth, viewportHeight) {
      const geometry = clampFindPopupGeometry(start, viewportWidth, viewportHeight);
      return clampFindPopupGeometry({
        ...geometry,
        x: geometry.x + (Number(deltaX) || 0),
        y: geometry.y + (Number(deltaY) || 0),
      }, viewportWidth, viewportHeight);
    }

    /** Resize the Find popup from one edge/corner without crossing minimum size. */
    function resizeFindPopupGeometry(start, deltaX, deltaY, direction, viewportWidth, viewportHeight) {
      const geometry = clampFindPopupGeometry(start, viewportWidth, viewportHeight);
      const viewportW = Math.max(1, Number(viewportWidth) || 1);
      const viewportH = Math.max(1, Number(viewportHeight) || 1);
      const margin = viewportW >= 32 && viewportH >= 32 ? 8 : 0;
      const minimumWidth = Math.min(360, Math.max(1, viewportW - margin * 2));
      const minimumHeight = Math.min(260, Math.max(1, viewportH - margin * 2));
      const horizontal = String(direction ?? '');
      let left = geometry.x;
      let top = geometry.y;
      let right = geometry.x + geometry.width;
      let bottom = geometry.y + geometry.height;
      if (horizontal.includes('w')) left = Math.max(margin, Math.min(right - minimumWidth, left + (Number(deltaX) || 0)));
      if (horizontal.includes('e')) right = Math.min(viewportW - margin, Math.max(left + minimumWidth, right + (Number(deltaX) || 0)));
      if (horizontal.includes('n')) top = Math.max(margin, Math.min(bottom - minimumHeight, top + (Number(deltaY) || 0)));
      if (horizontal.includes('s')) bottom = Math.min(viewportH - margin, Math.max(top + minimumHeight, bottom + (Number(deltaY) || 0)));
      return clampFindPopupGeometry({
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
      }, viewportW, viewportH);
    }

    /** Read the last movable Find popup geometry. */
    function readFindPopupGeometry(viewportWidth = window.innerWidth, viewportHeight = window.innerHeight) {
      try {
        return clampFindPopupGeometry(
          JSON.parse(window.localStorage.getItem(FIND_POPUP_GEOMETRY_STORAGE_KEY) ?? '{}'),
          viewportWidth,
          viewportHeight,
        );
      } catch {
        return clampFindPopupGeometry({}, viewportWidth, viewportHeight);
      }
    }

    /** Persist the completed movable Find popup geometry. */
    function writeFindPopupGeometry(geometry) {
      try {
        window.localStorage.setItem(
          FIND_POPUP_GEOMETRY_STORAGE_KEY,
          JSON.stringify(clampFindPopupGeometry(geometry, window.innerWidth, window.innerHeight)),
        );
      } catch {
        /* storage-less browsers keep the in-memory geometry */
      }
    }

    /** Per-workspace Directory scope recursion preference. */
    function findDirectoryRecursiveStorageKey(root) {
      return `dsh-editor.find.directoryRecursive:${typeof root === 'string' ? root : ''}`;
    }

    /**
     * Read IDEA's Directory recursion toggle.
     * @param {string} root - workspace root.
     * @returns {boolean} true unless this workspace explicitly disabled it.
     */
    function readFindDirectoryRecursive(root) {
      try {
        return window.localStorage.getItem(findDirectoryRecursiveStorageKey(root)) !== '0';
      } catch {
        return true;
      }
    }

    /**
     * Persist IDEA's Directory recursion toggle.
     * @param {string} root - workspace root.
     * @param {unknown} recursive - requested toggle value.
     * @returns {boolean} normalized value.
     */
    function writeFindDirectoryRecursive(root, recursive) {
      const normalized = recursive !== false;
      try {
        window.localStorage.setItem(findDirectoryRecursiveStorageKey(root), normalized ? '1' : '0');
      } catch {
        /* storage-less browsers keep the in-memory toggle */
      }
      return normalized;
    }

    /**
     * Read the last valid scope for one workspace.
     * @param {string} root - workspace root.
     * @returns {{mode: 'project'|'directory'|'scope', preset: 'projectFiles'|'openFiles'|'changedFiles'|'currentFile', directory: string}} stored scope.
     */
    function readFindScope(root) {
      try {
        return normalizeFindSearchScope(JSON.parse(window.localStorage.getItem(findScopeStorageKey(root)) ?? '{}'));
      } catch {
        return normalizeFindSearchScope(null);
      }
    }

    /**
     * Persist one normalized Find scope for the current workspace.
     * @param {string} root - workspace root.
     * @param {object} scope - scope request.
     * @returns {object} normalized persisted scope.
     */
    function writeFindScope(root, scope) {
      const normalized = normalizeFindSearchScope(scope);
      try {
        window.localStorage.setItem(findScopeStorageKey(root), JSON.stringify(normalized));
      } catch {
        /* storage-less browsers keep the current in-memory scope */
      }
      return normalized;
    }

    /**
     * Normalize a local named Scope's glob patterns.
     * Patterns are entered one per line, bounded so malformed localStorage
     * cannot turn every Find request into an unbounded matcher.
     * @param {unknown} value - array or newline/comma separated text.
     * @returns {string[]} unique trimmed patterns.
     */
    function normalizeFindScopePatterns(value) {
      const entries = Array.isArray(value)
        ? value
        : typeof value === 'string'
          ? value.split(/[\n,]/u)
          : [];
      return [...new Set(entries
        .filter((entry) => typeof entry === 'string')
        .map((entry) => entry.trim().replaceAll('\\', '/'))
        .filter((entry) => entry !== '' && entry.length <= 512))]
        .slice(0, 40);
    }

    /**
     * Normalize local custom Scopes read from browser storage.
     * @param {unknown} value - stored scope list.
     * @returns {Array<{id: string, name: string, includePatterns: string[], excludePatterns: string[]}>} bounded scopes.
     */
    function normalizeCustomFindScopes(value) {
      const source = Array.isArray(value) ? value : [];
      const seen = new Set();
      const scopes = [];
      for (let index = 0; index < source.length && scopes.length < 30; index += 1) {
        const entry = source[index];
        if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue;
        const name = typeof entry.name === 'string' ? entry.name.trim().slice(0, 80) : '';
        const requestedId = typeof entry.id === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/u.test(entry.id)
          ? entry.id
          : `scope-${index + 1}`;
        const id = entry.shared === true
          ? sharedFindScopeId(name === '' ? `Scope ${index + 1}` : name)
          : requestedId;
        if (seen.has(id)) continue;
        seen.add(id);
        scopes.push({
          id,
          name: name === '' ? `Scope ${index + 1}` : name,
          includePatterns: normalizeFindScopePatterns(entry.includePatterns ?? entry.include),
          excludePatterns: normalizeFindScopePatterns(entry.excludePatterns ?? entry.exclude),
          shared: entry.shared === true,
        });
      }
      return scopes;
    }

    /** Per-workspace storage key for custom local Find Scopes. */
    function customFindScopesStorageKey(root) {
      return `dsh-editor.find.customScopes.v1:${typeof root === 'string' ? root : ''}`;
    }

    /** Read bounded local custom Scopes for one workspace. */
    function readCustomFindScopes(root) {
      try {
        return normalizeCustomFindScopes(JSON.parse(window.localStorage.getItem(customFindScopesStorageKey(root)) ?? '[]'))
          .filter((scope) => scope.shared !== true);
      } catch {
        return [];
      }
    }

    /** Persist bounded local custom Scopes for one workspace. */
    function writeCustomFindScopes(root, value) {
      const normalized = normalizeCustomFindScopes(value);
      try {
        window.localStorage.setItem(
          customFindScopesStorageKey(root),
          JSON.stringify(normalized.filter((scope) => scope.shared !== true)),
        );
      } catch {
        /* storage-less browsers keep the in-memory scope list */
      }
      return normalized;
    }

    /** Stable id for one shared Scope imported from IDEA XML. */
    function sharedFindScopeId(name) {
      let hash = 2166136261;
      for (const character of String(name ?? '')) {
        hash ^= character.codePointAt(0);
        hash = Math.imul(hash, 16777619);
      }
      return `shared-${(hash >>> 0).toString(36)}`;
    }

    /** Decode the five XML entities IDEA writes in scope attributes. */
    function decodeScopeXmlText(value) {
      return String(value ?? '')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&apos;', "'")
        .replaceAll('&amp;', '&');
    }

    /** Encode one IDEA scope attribute value. */
    function encodeScopeXmlText(value) {
      return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
    }

    /** Convert one simple IDEA file-scope term into the editor's glob form. */
    function ideaScopeTermToPattern(term) {
      let pattern = String(term ?? '').trim().replace(/^!/u, '');
      if (pattern === '') return '';
      const fileMatch = /^file(?:\[[^\]]+\])?:(.*)$/u.exec(pattern);
      if (fileMatch !== null) pattern = fileMatch[1];
      else if (pattern.includes(':') || pattern.includes('(') || pattern.includes(')')) return null;
      pattern = pattern.replace(/^\.\/+/u, '').replace(/\/+$/u, '');
      pattern = pattern.replace(/\/\/\*$/u, '/**');
      return pattern;
    }

    /**
     * Parse bounded IDEA scope XML files.
     *
     * Only the common `file:path//*` and `&& !file:...` shape is imported.
     * Unsupported package/language expressions are skipped instead of being
     * silently reinterpreted as different file scopes.
     */
    function parseIdeaScopeXml(text) {
      const source = typeof text === 'string' ? text.slice(0, 256 * 1024) : '';
      const scopes = [];
      for (const tag of source.matchAll(/<scope\b([^>]*)\/?>/giu)) {
        const attributes = tag[1];
        const nameMatch = /\bname\s*=\s*"([^"]*)"/iu.exec(attributes);
        const patternMatch = /\bpattern\s*=\s*"([^"]*)"/iu.exec(attributes);
        if (nameMatch === null || patternMatch === null) continue;
        const name = decodeScopeXmlText(nameMatch[1]).trim().slice(0, 80);
        if (name === '') continue;
        const expression = decodeScopeXmlText(patternMatch[1]);
        if (/[()]/u.test(expression)) continue;
        const positive = [];
        const negative = [];
        let supported = true;
        for (const rawTerm of expression.split(/\s*(?:&&|\|\|)\s*/u)) {
          if (rawTerm === '') continue;
          const pattern = ideaScopeTermToPattern(rawTerm);
          if (pattern === null) {
            supported = false;
            break;
          }
          (rawTerm.startsWith('!') ? negative : positive).push(pattern);
        }
        if (!supported) continue;
        scopes.push({
          id: sharedFindScopeId(name),
          name,
          includePatterns: normalizeFindScopePatterns(positive),
          excludePatterns: normalizeFindScopePatterns(negative),
          shared: true,
        });
      }
      return normalizeCustomFindScopes(scopes).slice(0, 30);
    }

    /** Serialize shared Scopes to the simple IDEA file-scope XML subset we import. */
    function serializeIdeaScopeXml(value) {
      const scopes = normalizeCustomFindScopes(value).filter((scope) => scope.shared === true);
      const lines = ['<component name="DependencyValidationManager">'];
      for (const scope of scopes) {
        const positives = scope.includePatterns.map((pattern) => `file:${pattern}`);
        const negatives = scope.excludePatterns.map((pattern) => `!file:${pattern}`);
        let expression = [...positives, ...negatives].join('&&');
        if (positives.length === 0 && negatives.length === 0) expression = 'file:*';
        if (positives.length > 1) {
          expression = `${positives.join('||')}${negatives.length > 0 ? `&&${negatives.join('&&')}` : ''}`;
        }
        lines.push(`  <scope name="${encodeScopeXmlText(scope.name)}" pattern="${encodeScopeXmlText(expression)}" />`);
      }
      lines.push('</component>', '');
      return lines.join('\n');
    }

    /** Normalize one explicit workspace-relative IDEA scope XML transfer path. */
    function normalizeScopeXmlTransferPath(value) {
      const raw = typeof value === 'string' ? value.trim().replaceAll('\\', '/') : '';
      const path = raw.replace(/^\.\/+/u, '').replace(/\/+$/u, '');
      if (
        path === ''
        || path.length > 512
        || path.startsWith('/')
        || !path.toLowerCase().endsWith('.xml')
        || path.split('/').some((segment) => segment === '' || segment === '..')
      ) return '';
      return path;
    }

    /** Parse one scope XML file and report how many scope tags were unsupported. */
    function inspectIdeaScopeXml(value) {
      const source = typeof value === 'string' ? value.slice(0, 256 * 1024) : '';
      const total = [...source.matchAll(/<scope\b/giu)].length;
      const scopes = parseIdeaScopeXml(source);
      return {
        scopes,
        total,
        skipped: Math.max(0, total - scopes.length),
      };
    }

    /**
     * Read recent Search Everywhere queries for one workspace.
     * @param {string} root - workspace root.
     * @returns {string[]} recent queries, newest first.
     */
    function readSearchHistory(root) {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(searchHistoryStorageKey(root)) ?? '[]');
        return rememberRecentSearchHistory(parsed, '', 20);
      } catch {
        return [];
      }
    }

    /**
     * Persist recent Search Everywhere queries.
     * @param {string} root - workspace root.
     * @param {string[]} history - recent queries.
     * @returns {void}
     */
    function writeSearchHistory(root, history) {
      try {
        window.localStorage.setItem(searchHistoryStorageKey(root), JSON.stringify(rememberRecentSearchHistory(history, '', 20)));
      } catch {
        /* a storage-less browser keeps the in-memory list */
      }
    }

    /**
     * Read exact Find query history for one workspace.
     * @param {string} root - workspace root.
     * @returns {string[]} exact recent queries.
     */
    function readFindQueryHistory(root) {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(findQueryHistoryStorageKey(root)) ?? '[]');
        return rememberFindQueryHistory(parsed, undefined, 20);
      } catch {
        return [];
      }
    }

    /**
     * Persist exact Find query history for one workspace.
     * @param {string} root - workspace root.
     * @param {string[]} history - exact recent queries.
     * @returns {void}
     */
    function writeFindQueryHistory(root, history) {
      try {
        window.localStorage.setItem(findQueryHistoryStorageKey(root), JSON.stringify(rememberFindQueryHistory(history, undefined, 20)));
      } catch {
        /* a storage-less browser keeps the in-memory list */
      }
    }

    /** Per-workspace Find Usages history key. */
    function findUsagesHistoryStorageKey(root) {
      return `dsh-editor.findUsages.history:${root}`;
    }

    /** Read recent Find Usages queries for one workspace. */
    function readFindUsagesHistory(root) {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(findUsagesHistoryStorageKey(root)) ?? '[]');
        return rememberSearchHistory(parsed, '', 20);
      } catch {
        return [];
      }
    }

    /** Persist recent Find Usages queries for one workspace. */
    function writeFindUsagesHistory(root, history) {
      try {
        window.localStorage.setItem(findUsagesHistoryStorageKey(root), JSON.stringify(rememberSearchHistory(history, '', 20)));
      } catch {
        /* storage-less browsers keep the in-memory list */
      }
    }

    /** Record one successful Find Usages query. */
    function rememberWorkspaceFindUsagesQuery(root, query) {
      if (typeof root !== 'string' || root === '' || typeof query !== 'string' || query.trim() === '') return null;
      const next = rememberSearchHistory(readFindUsagesHistory(root), query, 20);
      writeFindUsagesHistory(root, next);
      return next;
    }

    /** Per-workspace replacement history key. */
    function replaceHistoryStorageKey(root) {
      return `dsh-editor.replace.history:${root}`;
    }

    /**
     * Read recently executed replacement strings.
     * @param {string} root - workspace root.
     * @returns {string[]} recent replacements, newest first.
     */
    function readReplaceHistory(root) {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(replaceHistoryStorageKey(root)) ?? '[]');
        return rememberReplacementHistory(parsed, undefined, 20);
      } catch {
        return [];
      }
    }

    /**
     * Persist recently executed replacement strings.
     * @param {string} root - workspace root.
     * @param {string[]} history - recent replacements.
     * @returns {void}
     */
    function writeReplaceHistory(root, history) {
      try {
        window.localStorage.setItem(replaceHistoryStorageKey(root), JSON.stringify(rememberReplacementHistory(history, undefined, 20)));
      } catch {
        /* storage-less browsers keep the in-memory list */
      }
    }

    /**
     * Record one successful query for a workspace.
     * @param {string} root - workspace root.
     * @param {string} query - search query.
     * @returns {string[]|null} normalized history, or null without workspace/query.
     */
    function rememberWorkspaceSearchQuery(root, query) {
      if (typeof root !== 'string' || root === '' || typeof query !== 'string' || query.trim() === '') return null;
      const normalizedQuery = normalizeRecentSearchEntry(query);
      if (normalizedQuery === '') return null;
      const next = rememberSearchHistory(readSearchHistory(root), normalizedQuery, 20);
      writeSearchHistory(root, next);
      return next;
    }

    /**
     * Record one exact Find query for a workspace.
     * @param {string} root - workspace root.
     * @param {string} query - exact query text.
     * @returns {string[]|null} exact history, or null without workspace/query.
     */
    function rememberWorkspaceFindQuery(root, query) {
      if (typeof root !== 'string' || root === '' || typeof query !== 'string') return null;
      const next = rememberFindQueryHistory(readFindQueryHistory(root), query, 20);
      writeFindQueryHistory(root, next);
      return next;
    }

    /**
     * Record one executed replacement for a workspace.
     * @param {string} root - workspace root.
     * @param {string} replacement - replacement text.
     * @returns {string[]|null} exact history, or null without workspace/replacement.
     */
    function rememberWorkspaceReplacement(root, replacement) {
      if (typeof root !== 'string' || root === '' || typeof replacement !== 'string') return null;
      const next = rememberReplacementHistory(readReplaceHistory(root), replacement, 20);
      writeReplaceHistory(root, next);
      return next;
    }

    /**
     * IDEA's empty Search Everywhere state resets only the provider filter.
     * @returns {{files: boolean, text: boolean, actions: boolean}} all providers enabled.
     */
    function defaultSearchEverywhereFilters() {
      return { files: true, text: true, actions: true };
    }

    /**
     * @param {object|null} filters - current provider visibility filters.
     * @returns {boolean} whether at least one provider is hidden.
     */
    function searchEverywhereFiltersNeedReset(filters) {
      return filters?.files === false
        || filters?.text === false
        || filters?.actions === false;
    }

    /**
     * IDEA's Files empty state hands a real name query to full-text Find.
     * @param {object} options - active tab, query, result count and loading state.
     * @returns {boolean} whether the Find in Files fallback is actionable.
     */
    function searchEverywhereOffersFindInFiles({
      tab,
      query,
      resultCount,
      loading,
    }) {
      return tab === 'files'
        && typeof query === 'string'
        && query.trim() !== ''
        && resultCount === 0
        && loading !== true;
    }

    /**
     * Report the Text options that actually affected the current search.
     * @param {object} options - current text-search options.
     * @returns {string[]} stable IDEA-order option ids.
     */
    function searchEverywhereActiveOptionIds({
      caseSensitive,
      wholeWords,
      regex,
      fileMask,
    }) {
      const ids = [];
      if (caseSensitive === true) ids.push('case');
      if (wholeWords === true) ids.push('words');
      if (regex === true) ids.push('regex');
      if (typeof fileMask === 'string' && fileMask.trim() !== '') ids.push('fileMask');
      return ids;
    }

    /**
     * IDEA's Text empty state can clear the search options that produced it.
     * @param {object} options - tab, query state and active text-search options.
     * @returns {boolean} whether Clear all options is actionable.
     */
    function searchEverywhereOffersClearOptions({
      tab,
      query,
      resultCount,
      loading,
      caseSensitive,
      wholeWords,
      regex,
      fileMask,
    }) {
      const normalizedQuery = typeof query === 'string' ? query.trim() : '';
      const activeOptionIds = searchEverywhereActiveOptionIds({
        caseSensitive,
        wholeWords,
        regex,
        fileMask,
      });
      return tab === 'text'
        && normalizedQuery.length >= 2
        && resultCount === 0
        && loading !== true
        && activeOptionIds.length > 0;
    }

    /**
     * IDEA's empty All/Text state can widen a project scope to all places.
     * DSH widens to the workspace's normally excluded directories.
     * @param {object} options - tab, query state and current scope.
     * @returns {boolean} whether the scope-expansion action is actionable.
     */
    function searchEverywhereOffersScopeExpansion({
      tab,
      query,
      resultCount,
      loading,
      includeNonProject,
    }) {
      const normalizedQuery = typeof query === 'string' ? query.trim() : '';
      const minimumQueryLength = tab === 'text' ? 2 : 1;
      return (tab === 'all' || tab === 'text')
        && normalizedQuery.length >= minimumQueryLength
        && resultCount === 0
        && loading !== true
        && includeNonProject !== true;
    }

    /**
     * IDEA's Search Everywhere dialog.
     *
     * All/Files/Text/Actions share one query, one active row and one keyboard
     * loop. Classes and Symbols are intentionally absent: this plugin has no
     * language index to answer them truthfully.
     * @param {object} props - dialog state, candidates and callbacks.
     * @returns {object} modal palette.
     */
