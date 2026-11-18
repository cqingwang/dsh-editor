/* commit.js CommitPanel legacy oracle. */

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
