function FindToolWindow({
      t,
      state,
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
      onPopupDragStart,
      onPopupResizeStart,
      onClose,
      floating = true,
      activeFilePath = null,
      openFilePaths = [],
      recentFilePaths = [],
      gitAvailable = false,
      openFilesRef,
      changedFilePaths = [],
    }) {
      const listRef = React.useRef(null);
      const previewBodyRef = React.useRef(null);
      const groupButtonRefs = React.useRef(new Map());
      const occurrenceRefs = React.useRef(new Map());
      const queryInputRef = React.useRef(null);
      const replaceInputRef = React.useRef(null);
      const fileMaskInputRef = React.useRef(null);
      const scopeModeButtonRefs = React.useRef(new Map());
      const replaceFocusPendingRef = React.useRef(false);
      const handoffReadyRevisionRef = React.useRef(0);
      const replaceAdvanceReadyRef = React.useRef(0);
      const rerunSelectionRef = React.useRef(null);
      const FIND_TOOL_LISTBOX_ID = 'dsh-editor-find-tool-listbox';
      const [collapsedFiles, setCollapsedFiles] = React.useState(() => new Set());
      const [focusedGroupPath, setFocusedGroupPath] = React.useState(null);
      const [previewOpen, setPreviewOpen] = React.useState(true);
      const [previewSoftWrap, setPreviewSoftWrap] = React.useState(true);
      const [fileMaskEnabled, setFileMaskEnabled] = React.useState(() => String(state.fileMask ?? '').trim() !== '');
      const [fileMaskDraft, setFileMaskDraft] = React.useState(() => state.fileMask ?? '');
      const [fileMaskHistory, setFileMaskHistory] = React.useState(readFileMaskHistory);
      const [fileMaskMenu, setFileMaskMenu] = React.useState(null);
      const [directoryPicker, setDirectoryPicker] = React.useState(null);
      const [findGroupBy, setFindGroupBy] = React.useState(() => normalizeFindGroupBy(readStoredText('dsh-editor.find.groupBy', 'file')));
      const [groupByMenu, setGroupByMenu] = React.useState(null);
      const [searchNewLine, setSearchNewLine] = React.useState(false);
      const [replaceNewLine, setReplaceNewLine] = React.useState(false);
      const [replaceExpanded, setReplaceExpanded] = React.useState(() => floating || state.mode === 'replace');
      const [openResultsInNewTab, setOpenResultsInNewTab] = React.useState(() => readStoredText('dsh-editor.find.openInNewTab', '0') === '1');
      const [filterMenu, setFilterMenu] = React.useState(null);
      const [scopeEditorOpen, setScopeEditorOpen] = React.useState(false);
      const [pinned, setPinned] = React.useState(() => readStoredText('dsh-editor.find.pinned', '0') === '1');
      const [scopeMode, setScopeMode] = React.useState(() =>
        state.searchScopeMode === 'directory' || state.searchScopeMode === 'scope' ? state.searchScopeMode : 'project');
      const [scopePreset, setScopePreset] = React.useState(() =>
        state.searchScopePreset === 'openFiles'
        || state.searchScopePreset === 'changedFiles'
        || state.searchScopePreset === 'currentFile'
        || state.searchScopePreset === 'recentlyViewedFiles'
        || state.searchScopePreset === 'gitTrackedFiles'
        || state.searchScopePreset === 'gitNonIgnoredFiles'
        || typeof state.searchScopePreset === 'string' && /^custom:[a-z0-9][a-z0-9-]{0,63}$/u.test(state.searchScopePreset)
          ? state.searchScopePreset
          : 'projectFiles');
      const [scopeDirectoryDraft, setScopeDirectoryDraft] = React.useState(() =>
        typeof state.searchScopeDirectory === 'string' && state.searchScopeDirectory !== ''
          ? state.searchScopeDirectory
          : (activeFilePath === null ? '' : dirname(activeFilePath)));
      const [scopeRecursive, setScopeRecursive] = React.useState(() => state.searchScopeRecursive !== false);
      const [historyMenu, setHistoryMenu] = React.useState(null);
      const [resultMenu, setResultMenu] = React.useState(null);
      const [previewState, setPreviewState] = React.useState({ loading: false, path: '', content: '', line: 1, error: null });
      const query = typeof state.query === 'string' ? state.query : '';
      React.useEffect(() => {
        /* A multiline editor selection must stay visible and searchable as
           selected. Switch the query field to New Line mode before rerender. */
        if (/[\r\n]/u.test(query) && searchNewLine === false) setSearchNewLine(true);
      }, [query, searchNewLine]);
      const scopeModeOptions = [
        { id: 'project', label: `${t('editor.findScopeIn')} ${t('editor.findScopeProject')}`, disabled: false },
        { id: 'module', label: t('editor.findScopeModule'), disabled: true },
        { id: 'directory', label: t('editor.findScopeDirectory'), disabled: false },
        { id: 'scope', label: t('editor.findScopeScope'), disabled: false },
      ];
      const replaceMode = state.mode === 'replace';
      const surfaceTitle = floating
        ? t(replaceMode ? 'editor.replaceInFilesTitle' : 'editor.findInFilesTitle')
        : (query === '' ? t('editor.findToolDockEmptyTitle') : t('editor.findToolDockTitle', { query }));
      const fileResults = Array.isArray(state.files) ? state.files : [];
      const scopeDirectory = activeFilePath === null ? '' : dirname(activeFilePath);
      const effectiveScopeDirectory = scopeDirectoryDraft.trim() || scopeDirectory;
      const selectedCustomScopeId = scopePreset.startsWith('custom:') ? scopePreset.slice('custom:'.length) : '';
      const selectedCustomScope = (Array.isArray(customScopes) ? customScopes : [])
        .find((scope) => scope?.id === selectedCustomScopeId) ?? null;
      const selectedCustomScopeMissing = selectedCustomScopeId !== '' && selectedCustomScope === null;
      const selectedScopePresetAvailable = findSearchScopePresetAvailable(scopePreset, {
          gitAvailable,
          recentFileCount: recentFilePaths.length,
          openFileCount: openFilePaths.length,
          currentFileAvailable: activeFilePath !== null,
          changedFileCount: changedFilePaths.length,
        });
      const effectiveScopePreset = selectedCustomScopeMissing || selectedScopePresetAvailable !== true
        ? 'projectFiles'
        : scopePreset;
      const retainPreviousResultsWhileLoading = state.loading === true
        && state.loadedGeneration !== state.searchGeneration
        || state.error !== null;
      const scopeAllowedPaths = effectiveScopePreset === 'openFiles'
        ? new Set(openFilePaths)
        : effectiveScopePreset === 'recentlyViewedFiles'
          ? new Set(recentFilePaths)
          : effectiveScopePreset === 'currentFile'
            ? new Set(activeFilePath === null ? [] : [activeFilePath])
            : effectiveScopePreset === 'gitTrackedFiles' || effectiveScopePreset === 'gitNonIgnoredFiles'
              ? null
              : new Set(changedFilePaths);
      const scopedFileResults = retainPreviousResultsWhileLoading
        ? fileResults
        : fileResults.filter((file) => findToolPathMatchesScope(file.path, scopeMode, {
            directory: effectiveScopeDirectory,
            preset: effectiveScopePreset,
            allowedPaths: scopeAllowedPaths,
            recursive: scopeRecursive,
            customScope: selectedCustomScope,
          }));
      const scopedMatches = retainPreviousResultsWhileLoading
        ? state.matches
        : state.matches.filter((match) => findToolPathMatchesScope(match.path, scopeMode, {
            directory: effectiveScopeDirectory,
            preset: effectiveScopePreset,
            allowedPaths: scopeAllowedPaths,
            recursive: scopeRecursive,
            customScope: selectedCustomScope,
          }));
      const dockVisibleRows = findToolVisibleRows(scopedFileResults, scopedMatches, collapsedFiles, findGroupBy);
      const groups = dockVisibleRows.groups;
      const popupOccurrences = [
        ...scopedFileResults.map((file) => ({
          ...file,
          kind: 'file',
          rowKey: `file:${file.path}`,
        })),
        ...scopedMatches.map((match) => ({
          ...match,
          kind: 'text',
          rowKey: `text:${match.path}:${match.line}:${match.column}`,
        })),
      ];
      const occurrences = floating ? popupOccurrences : dockVisibleRows.rows;
      const displayGroups = findToolDisplayGroups(groups, findGroupBy);
      const fileMaskSuggestionPaths = [
        ...(activeFilePath === null ? [] : [activeFilePath]),
        ...(Array.isArray(openFilePaths) ? openFilePaths : []),
        ...(Array.isArray(recentFilePaths) ? recentFilePaths : []),
        ...(Array.isArray(changedFilePaths) ? changedFilePaths : []),
        ...(Array.isArray(state.files) ? state.files.map((file) => file?.path) : []),
        ...(Array.isArray(state.matches) ? state.matches.map((match) => match?.path) : []),
      ];
      const fileMaskSuggestions = suggestFileMasks(fileMaskSuggestionPaths, fileMaskHistory, 12);
      const rovingGroupPath = groups.some((group) => group.path === focusedGroupPath)
        ? focusedGroupPath
        : groups[0]?.path ?? null;
      const activeIndex = Math.max(0, Math.min(Number(state.index) || 0, Math.max(0, occurrences.length - 1)));
      const active = occurrences[activeIndex] ?? null;
      const replaceAllDisabledReason = state.replaceBusy === true
        ? t('editor.findReplaceBusy')
        : state.loading === true
          ? t('editor.findReplaceLoading')
          : state.error !== null
            ? t('editor.findReplaceSearchError')
            : scopedMatches.length === 0
              ? t('editor.findReplaceAllDisabled')
              : null;
      const replaceCurrentDisabledReason = state.replaceBusy === true
        ? t('editor.findReplaceBusy')
        : state.loading === true
          ? t('editor.findReplaceLoading')
          : state.error !== null
            ? t('editor.findReplaceSearchError')
            : active?.kind !== 'text'
              ? t('editor.findReplaceCurrentDisabled')
              : null;
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
      const handoffTarget = findToolHandoffTarget(scopedFileResults, scopedMatches, state.index, findGroupBy);
      const replaceAdvanceRevision = Math.max(0, Number(state.replaceAdvanceRevision) || 0);
      React.useEffect(() => {
        if (replaceMode) setReplaceExpanded(true);
      }, [replaceMode]);
      React.useEffect(() => {
        const target = rerunSelectionRef.current;
        if (target === null) return;
        if (target.generation !== state.searchGeneration) return;
        if (state.loadedGeneration !== state.searchGeneration) return;
        const targetIndex = occurrences.findIndex((entry) => entry.rowKey === target.rowKey);
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
      }, [
        collapsedFiles,
        occurrences,
        onMove,
        state.loadedGeneration,
        state.searchGeneration,
      ]);
      React.useEffect(() => {
        if (state.index !== 0) onMove(0, 0);
      }, [scopeMode, scopePreset, findGroupBy]);
      React.useEffect(() => {
        const mask = String(state.fileMask ?? '');
        if (mask.trim() !== '') {
          setFileMaskEnabled(true);
          setFileMaskDraft(mask);
        }
      }, [state.fileMask]);
      React.useEffect(() => {
        if (!floating || pinned) return undefined;
        const onMouseDown = (event) => {
          const target = event.target instanceof Element ? event.target : null;
          if (target?.closest('[data-dsh-find-tool-window], [role="menu"]') !== null) return;
          onClose();
        };
        window.addEventListener('mousedown', onMouseDown, true);
        return () => window.removeEventListener('mousedown', onMouseDown, true);
      }, [floating, onClose, pinned]);
      const resultFiles = groups.length + scopedFileResults.length;
      const resultMatches = groups.reduce((total, group) => total + group.matches.length, scopedFileResults.length);
      const resultRowCount = scopedFileResults.length + scopedMatches.length;
      const scopedReplacementPaths = new Set(scopedMatches.map((match) => match.path));
      const requestOpenInFindWindow = () => {
        if (!floating || !hasFindToolContentQuery(query)) return;
        if (
          searchEverywhereRequiresResultConfirmation(scopedFileResults, scopedMatches)
          && !window.confirm(t('editor.searchTooManyResults', { count: resultRowCount }))
        ) return;
        onOpenInFindWindow();
      };
      const openInFindWindowDisabledReason = floating !== true
        ? t('editor.findOpenInFindWindowAlreadyDocked')
        : !hasFindToolContentQuery(query)
          ? t('editor.findOpenInFindWindowEmptyQuery')
          : '';
      const findResultStatus = state.error !== null
        ? ''
        : state.loading === true
          ? t('editor.loading')
          : !hasFindToolContentQuery(query)
            ? t('editor.findToolEmptyQuery')
            : occurrences.length === 0
              ? t('editor.findToolNoMatches')
              : findToolResultSummary(t, resultMatches, resultFiles);
      const activeFindSearchOptionIds = searchEverywhereActiveOptionIds({
        caseSensitive: state.caseSensitive === true,
        wholeWords: state.wholeWords === true,
        regex: state.regex === true,
        fileMask: state.fileMask,
      });
      const activeFindSearchOptionLabels = {
        case: `${t('editor.searchMatchCase')} ⌃C`,
        words: `${t('editor.searchWholeWords')} ⌃W`,
        regex: `${t('editor.searchRegex')} ⌃X`,
        fileMask: t('editor.searchFileMaskLabel'),
      };
      const activeFindSearchOptionsText = activeFindSearchOptionIds
        .map((id) => activeFindSearchOptionLabels[id])
        .filter((label) => typeof label === 'string' && label !== '')
        .join('  ');
      const showFindSearchOptionSummary = hasFindToolContentQuery(query)
        && state.loading !== true
        && occurrences.length === 0
        && activeFindSearchOptionIds.length > 0;
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
          (kind === 'all' || kind === 'fileMask')
          && (fileMaskEnabled === true || String(state.fileMask ?? '').trim() !== '' || fileMaskDraft.trim() !== '')
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
      const handleFindSearchOptionShortcut = (event) => {
        if (showFindSearchOptionSummary !== true) return false;
        const action = findSearchOptionShortcutAction(event);
        if (action === null) return false;
        const editable = event.target instanceof HTMLElement && typeof event.target.selectionStart === 'number'
          ? event.target
          : null;
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
        const onKeyDown = (event) => {
          if (!(event.target instanceof Element)
            || event.target.closest('[data-dsh-find-tool-window]') === null) return;
          handleFindSearchOptionShortcut(event);
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
      }, [activeFindSearchOptionsText, showFindSearchOptionSummary, state.caseSensitive, state.wholeWords, state.regex, state.fileMask]);
      const replaceFocusRequest = Math.max(0, Number(state.replaceFocusRequest) || 0);
      const previewWindow = previewOpen
        ? searchEverywherePreviewWindow(previewState.content, previewState.line)
        : null;
      const previewLines = previewWindow === null || previewState.content === ''
        ? []
        : previewState.content.split(/\r?\n/u).slice(previewWindow.start - 1, previewWindow.end);
      const previewColorizedLines = useCodePreviewColorizedLines(previewLines, previewState.path);
      const previewLineStarts = findToolTextLineStarts(previewState.content);
      const previewScopeStart = previewWindow === null
        ? 0
        : (previewLineStarts[previewWindow.start - 1] ?? 0);
      const previewScopeEnd = previewWindow === null
        ? 0
        : (previewLineStarts[previewWindow.end] ?? previewState.content.length);
      const previewMatches = previewWindow === null || !hasFindToolContentQuery(query)
        ? []
        : editorFindResult(previewState.content, query, {
            caseSensitive: state.caseSensitive === true,
            wholeWords: state.wholeWords === true,
            regex: state.regex === true,
            scope: {
              start: previewScopeStart,
              end: previewScopeEnd,
            },
          }).matches;
      const openHistoryMenu = (event, kind) => {
        event.preventDefault();
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        const surfaceRect = event.currentTarget.closest('[data-dsh-find-tool-window]')?.getBoundingClientRect?.();
        const values = kind === 'query'
          ? (Array.isArray(queryHistory) ? queryHistory : [])
          : (Array.isArray(replaceHistory) ? replaceHistory : []);
        const menuTop = findToolMenuTop(
          rect.bottom + 4,
          surfaceRect?.top ?? 0,
          surfaceRect?.bottom ?? window.innerHeight,
        );
        setHistoryMenu({
          x: findToolMenuLeft(rect.left, surfaceRect?.left ?? 0, surfaceRect?.right ?? window.innerWidth),
          y: menuTop,
          maxHeight: findToolMenuMaxHeight(
            surfaceRect?.top ?? 0,
            surfaceRect?.bottom ?? window.innerHeight,
            menuTop,
          ),
          title: kind === 'query' ? t('editor.findSearchHistory') : t('editor.findReplaceHistory'),
          fallbackFocus: kind === 'query'
            ? () => queryInputRef.current?.focus?.()
            : () => (replaceInputRef.current ?? queryInputRef.current)?.focus?.(),
          items: values.length === 0
            ? [{ id: 'empty', label: t('editor.findHistoryEmpty'), disabled: true, run: () => {} }]
            : values.map((value, index) => ({
                id: `${kind}:${index}`,
                label: value,
                run: () => {
                  setHistoryMenu(null);
                  if (kind === 'query') onQuery(value);
                  else onReplace(value);
                  window.setTimeout(() => {
                    const input = kind === 'query'
                      ? queryInputRef.current
                      : replaceInputRef.current ?? queryInputRef.current;
                    input?.focus?.();
                  }, 0);
                },
              })),
        });
      };
      const acceptFileMask = (value) => {
        const next = typeof value === 'string' ? value.trim() : '';
        setFileMaskDraft(next);
        setFileMaskEnabled(next !== '');
        setFileMaskHistory(writeFileMaskHistory(next));
        onFileMaskChange(next);
      };
      const emitFindScopeChange = (mode, preset, directory) => {
        if (typeof onScopeChange !== 'function') return;
        const normalizedPreset = preset === 'openFiles'
          || preset === 'changedFiles'
          || preset === 'currentFile'
          || preset === 'recentlyViewedFiles'
          || preset === 'gitTrackedFiles'
          || preset === 'gitNonIgnoredFiles'
          || typeof preset === 'string' && /^custom:[a-z0-9][a-z0-9-]{0,63}$/u.test(preset)
          ? preset
          : 'projectFiles';
        onScopeChange({
          mode: mode === 'directory' || mode === 'scope' ? mode : 'project',
          preset: normalizedPreset,
          directory: mode === 'directory' && typeof directory === 'string' ? directory.trim() : '',
        });
      };
      const selectFindScopeMode = (mode) => {
        setScopeMode(mode);
        emitFindScopeChange(mode, effectiveScopePreset, scopeDirectoryDraft);
      };
      const moveFindScopeMode = (mode) => {
        selectFindScopeMode(mode);
        window.setTimeout(() => scopeModeButtonRefs.current.get(mode)?.focus?.(), 0);
      };
      const handleFindScopeModeKeyDown = (event, current) => {
        if (
          event.isComposing === true
          || event.metaKey === true
          || event.ctrlKey === true
          || event.altKey === true
          || event.shiftKey === true
        ) return;
        const target = findToolScopeModeTarget(current, event.key);
        if (target === null) return;
        event.preventDefault();
        event.stopPropagation();
        moveFindScopeMode(target);
      };
      const selectFindScopePreset = (preset) => {
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
        void callFs({ op: 'directories' })
          .then((value) => {
            const directories = (Array.isArray(value?.directories) ? value.directories : [])
              .filter((path) => typeof path === 'string');
            setDirectoryPicker((current) => (current === null
              ? current
              : { ...current, loading: false, directories }));
          })
          .catch((failure) => {
            setDirectoryPicker(null);
            onNotify(failure instanceof Error ? failure.message : String(failure));
          });
      };
      const openFileMaskMenu = (event) => {
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
        const menuTop = findToolMenuTop(
          rect.bottom + 4,
          surfaceRect?.top ?? 0,
          surfaceRect?.bottom ?? window.innerHeight,
        );
        setFileMaskMenu({
          x: findToolMenuLeft(rect.right - 220, surfaceRect?.left ?? 0, surfaceRect?.right ?? window.innerWidth),
          y: menuTop,
          maxHeight: findToolMenuMaxHeight(
            surfaceRect?.top ?? 0,
            surfaceRect?.bottom ?? window.innerHeight,
            menuTop,
          ),
          title: t('editor.searchFileMaskLabel'),
          fallbackFocus: () => fileMaskInputRef.current?.focus?.(),
          items: [
            ...(historyItems.length === 0 && suggestionItems.length === 0
              ? [{ id: 'empty', label: t('editor.findHistoryEmpty'), disabled: true, run: () => {} }]
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
      const openFilterMenu = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        const surfaceRect = event.currentTarget.closest('[data-dsh-find-tool-window]')?.getBoundingClientRect?.();
        const contextFilter = normalizeTextSearchContextFilter(state.contextFilter);
        const select = (value) => {
          setFilterMenu(null);
          onContextFilterChange(value);
          window.setTimeout(() => queryInputRef.current?.focus?.(), 0);
        };
        const menuTop = findToolMenuTop(
          rect.bottom + 4,
          surfaceRect?.top ?? 0,
          surfaceRect?.bottom ?? window.innerHeight,
        );
        setFilterMenu({
          x: findToolMenuLeft(rect.right - 220, surfaceRect?.left ?? 0, surfaceRect?.right ?? window.innerWidth),
          y: menuTop,
          maxHeight: findToolMenuMaxHeight(
            surfaceRect?.top ?? 0,
            surfaceRect?.bottom ?? window.innerHeight,
            menuTop,
          ),
          title: t('editor.findFilterResults'),
          items: [
            { id: 'anywhere', label: t('editor.findFilterAnywhere'), shortcut: contextFilter === 'anywhere' ? '✓' : '', run: () => select('anywhere') },
            null,
            { id: 'comments', label: t('editor.findFilterComments'), shortcut: contextFilter === 'comments' ? '✓' : '', run: () => select('comments') },
            { id: 'strings', label: t('editor.findFilterStringLiterals'), shortcut: contextFilter === 'strings' ? '✓' : '', run: () => select('strings') },
            { id: 'exceptComments', label: t('editor.findFilterExceptComments'), shortcut: contextFilter === 'exceptComments' ? '✓' : '', run: () => select('exceptComments') },
            { id: 'exceptStrings', label: t('editor.findFilterExceptStringLiterals'), shortcut: contextFilter === 'exceptStrings' ? '✓' : '', run: () => select('exceptStrings') },
            { id: 'exceptBoth', label: t('editor.findFilterExceptBoth'), shortcut: contextFilter === 'exceptBoth' ? '✓' : '', run: () => select('exceptBoth') },
          ],
        });
      };
      const selectFindGroupBy = (value) => {
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
      const openGroupByMenu = (event) => {
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
              { id: 'module', label: t('editor.findGroupByModule'), shortcut: '⌃M' },
              { id: 'flattenModules', label: t('editor.findGroupByFlattenModules'), shortcut: '⌃O' },
              { id: 'package', label: t('editor.findGroupByPackage'), shortcut: '⌃P' },
              { id: 'productionTest', label: t('editor.findGroupByProductionTest') },
              { id: 'usageType', label: t('editor.findGroupByUsageType'), shortcut: '⌃T' },
              { id: 'mergeSameLine', label: t('editor.findGroupByMergeSameLine'), shortcut: '⌃L' },
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
      const openFindResult = (result) => {
        if (result !== null && typeof result === 'object') onOpen(result, openResultsInNewTab === true);
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
      const openFindResultMenuAt = (x, y, result) => {
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
            onOpenInRightSplit: () => onOpenInRightSplit(
              result.path,
              result.kind === 'text' ? { path: result.path, line: result.line, column: result.column } : null,
            ),
            onReplace: () => focusReplaceInput(),
            onRevealResult: () => onRevealResult(result.path),
            onNotify,
          }),
        });
      };
      const toggleGroup = (path) => {
        setCollapsedFiles((current) => {
          const next = new Set(current);
          if (next.has(path)) next.delete(path);
          else next.add(path);
          return next;
        });
      };
      const focusGroupButton = (path) => {
        if (typeof path !== 'string' || path === '') return;
        setFocusedGroupPath(path);
        window.setTimeout(() => groupButtonRefs.current.get(path)?.focus?.(), 0);
      };
      const focusOccurrenceByIndex = (position) => {
        if (!Number.isFinite(position) || occurrences.length === 0) return;
        const next = Math.max(0, Math.min(occurrences.length - 1, position));
        const rowKey = occurrences[next]?.rowKey;
        if (typeof rowKey !== 'string' || rowKey === '') return;
        onMove(0, occurrences.length, next);
        window.setTimeout(() => occurrenceRefs.current.get(rowKey)?.focus?.(), 0);
      };
      const focusAdjacentOccurrence = (position, direction) => {
        if (!Number.isFinite(position) || direction === 0) return;
        focusOccurrenceByIndex(position + direction);
      };
      const handleOccurrenceKeyDown = (event, rowKey, position) => {
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
          if ((event.key === 'ArrowDown' && position < occurrences.length - 1)
            || (event.key === 'ArrowUp' && position > 0)) {
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
      const handleGroupKeyDown = (event, group) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'ArrowDown' && !collapsedFiles.has(group.path) && group.matches.length > 0) {
          const first = group.matches[0];
          const rowKey = `text:${first.path}:${first.line}:${first.column}`;
          const position = occurrences.findIndex((entry) => entry.rowKey === rowKey);
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
      const toolbarActions = [
        ...(floating ? [] : [{
          id: 'rerun',
          icon: 'refresh',
          label: t('editor.findRerun'),
          disabled: !hasFindToolContentQuery(query) || state.loading === true,
          onClick: rerunFindSearch,
          group: 'navigate',
          pinned: true,
        }]),
        {
          id: 'undoReplace',
          icon: 'undo',
          label: t('editor.findUndoLastReplace'),
          disabled: canUndoLastReplace !== true || state.replaceBusy === true,
          onClick: onUndoLastReplace,
          group: 'replace',
          pinned: floating === true,
        },
        {
          id: 'redoReplace',
          icon: 'redo',
          label: t('editor.findRedoLastReplace'),
          disabled: canRedoLastReplace !== true || state.replaceBusy === true,
          onClick: onRedoLastReplace,
          group: 'replace',
          pinned: floating === true,
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
        ...(floating ? [] : [{
          id: 'settings',
          icon: 'settings',
          label: t('editor.findSettings'),
          onClick: onOpenSettings,
          group: 'configure',
          pinned: true,
        }, {
          id: 'groupBy',
          icon: 'groupBy',
          label: t('editor.findGroupByMenu'),
          active: groupByMenu !== null,
          onClick: openGroupByMenu,
          ariaHasPopup: 'menu',
          ariaExpanded: groupByMenu !== null,
          group: 'filter',
          pinned: true,
        }]),
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
        {
          id: 'hide',
          icon: 'close',
          label: t('editor.findToolHide'),
          onClick: onClose,
          group: 'close',
        },
      ].filter((action) => floating || action.id !== 'pin');
      const popupHeaderActions = toolbarActions.filter((action) =>
        action.id === 'filterSearch' || action.id === 'pin'
        || action.id === 'undoReplace' && canUndoLastReplace === true
        || action.id === 'redoReplace' && canRedoLastReplace === true);
      React.useEffect(() => {
        if (handoffRevision === handoffReadyRevisionRef.current) return;
        if (handoffTarget === null) {
          handoffReadyRevisionRef.current = handoffRevision;
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
        const visiblePosition = occurrences.findIndex((entry) => entry.rowKey === handoffTarget.rowKey);
        if (visiblePosition < 0) return;
        if (state.index !== visiblePosition) onMove(0, occurrences.length, visiblePosition);
        handoffReadyRevisionRef.current = handoffRevision;
      }, [
        collapsedFiles,
        handoffRevision,
        handoffTarget,
        occurrences,
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
        listRef.current?.querySelector?.('[data-dsh-find-active="1"]')?.scrollIntoView?.({ block: 'nearest' });
      }, [activeIndex, query, scopeMode, scopePreset, state.matches, state.files, collapsedFiles]);
      React.useEffect(() => {
        if (handoffRevision !== handoffReadyRevisionRef.current) return;
        if (state.index !== activeIndex) onMove(0, occurrences.length, activeIndex);
      }, [handoffRevision, state.index, activeIndex, occurrences.length, onMove]);
      React.useEffect(() => {
        if (!previewOpen || active === null || typeof active.path !== 'string' || active.path === '') {
          if (previewOpen && rerunSelectionRef.current !== null && state.loading === true) {
            return undefined;
          }
          setPreviewState({ loading: false, path: '', content: '', line: 1, error: null });
          return undefined;
        }
        let cancelled = false;
        setPreviewState({ loading: true, path: active.path, content: '', line: active.line ?? 1, error: null });
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
        callFs({ op: 'read', path: active.path }, { signal: previewAbort.signal })
          .then((value) => {
            if (cancelled) return;
            setPreviewState({
              loading: false,
              path: active.path,
              content: value?.content ?? '',
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
          previewOpen !== true
          || previewState.loading === true
          || previewState.error !== null
          || active === null
          || active.kind !== 'text'
        ) return undefined;
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
        const observer = typeof ResizeObserver === 'undefined' || body === null
          ? null
          : new ResizeObserver(recenter);
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
      const handleListKeyDown = (event) => {
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
      const previewParts = (match) => highlightParts(match.preview || basename(match.path), query).map((part, index) =>
        React.createElement(
          'span',
          {
            key: `${match.rowKey}:${index}`,
            style: part.match ? styles.findToolHighlight : null,
          },
          part.text,
        ));
      const popupResizeHandleStyle = (direction) => {
        const base = {
          position: 'absolute',
          zIndex: 20,
          touchAction: 'none',
        };
        if (direction === 'n') return { ...base, left: 8, right: 8, top: 0, height: 5, cursor: 'n-resize' };
        if (direction === 's') return { ...base, left: 8, right: 8, bottom: 0, height: 5, cursor: 's-resize' };
        if (direction === 'e') return { ...base, top: 8, bottom: 8, right: 0, width: 5, cursor: 'e-resize' };
        if (direction === 'w') return { ...base, top: 8, bottom: 8, left: 0, width: 5, cursor: 'w-resize' };
        return {
          ...base,
          width: 10,
          height: 10,
          ...(direction.includes('n') ? { top: 0 } : { bottom: 0 }),
          ...(direction.includes('w') ? { left: 0 } : { right: 0 }),
          cursor: `${direction}-resize`,
        };
      };
      return React.createElement(
        'div',
        {
          style: floating ? { ...styles.findTool, position: 'relative' } : styles.findTool,
          'data-dsh-find-tool-window': '',
          'data-dsh-find-tool-surface': floating ? 'popup' : 'dock',
          role: 'region',
          'aria-label': surfaceTitle,
          onKeyDown: (event) => {
            const target = event.target instanceof Element ? event.target : null;
            if (
              event.ctrlKey === true
              && event.metaKey !== true
              && event.altKey !== true
              && event.shiftKey !== true
              && target?.closest('input, textarea, select, [role="menu"]') == null
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
          },
        },
        React.createElement(
          'div',
          {
            style: floating
              ? {
                  ...styles.findToolToolbar,
                  ...styles.findToolPopupToolbar,
                  cursor: 'move',
                  userSelect: 'none',
                  touchAction: 'none',
                }
              : styles.findToolToolbar,
            'data-dsh-find-popup-drag': floating ? '' : undefined,
            onPointerDown: floating
              ? (event) => {
                  const target = event.target instanceof Element ? event.target : null;
                  if (target !== null && target.closest('button, input, textarea, select, a, [role="menuitem"]') !== null) return;
                  onPopupDragStart?.(event);
                }
              : undefined,
          },
          floating ? null : React.createElement(Icon, { name: 'findWindow', size: 13 }),
          React.createElement(
            'span',
            { style: styles.findToolTitle, title: query },
            surfaceTitle,
          ),
          floating && !hasFindToolContentQuery(query)
            ? null
            : React.createElement(
                'span',
                { style: styles.findToolCount },
                state.loading === true
                  ? t('editor.loading')
                  : findToolResultSummary(t, resultMatches, resultFiles),
              ),
          React.createElement('span', { style: styles.findToolSpacer }),
          React.createElement(
            'label',
            { style: styles.findToolFileMaskControl },
            React.createElement('input', {
              type: 'checkbox',
              checked: fileMaskEnabled,
              'aria-label': t('editor.searchFileMaskLabel'),
              onChange: (event) => {
                const enabled = event.target.checked;
                setFileMaskEnabled(enabled);
                onFileMaskChange(enabled ? fileMaskDraft : '');
                window.setTimeout(() => {
                  (enabled ? fileMaskInputRef : queryInputRef).current?.focus?.();
                }, 0);
              },
            }),
            React.createElement('span', null, `${t('editor.searchFileMaskLabel')}:`),
            React.createElement('input', {
              ref: fileMaskInputRef,
              style: styles.findToolFileMaskInput,
              value: fileMaskDraft,
              disabled: fileMaskEnabled !== true,
              placeholder: '.ts, .md',
              'aria-label': t('editor.searchFileMask'),
              onChange: (event) => {
                const value = event.target.value;
                setFileMaskDraft(value);
                if (fileMaskEnabled) onFileMaskChange(value);
              },
              onBlur: () => {
                if (fileMaskDraft.trim() !== '') setFileMaskHistory(writeFileMaskHistory(fileMaskDraft));
              },
              onKeyDown: (event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                acceptFileMask(fileMaskDraft);
              },
            }),
            React.createElement(ToolbarButton, {
              icon: 'chevronDown',
              label: t('editor.findFileMaskHistory'),
              onClick: openFileMaskMenu,
              ariaHasPopup: 'menu',
              ariaExpanded: fileMaskMenu !== null,
            }),
          ),
          React.createElement(CompactActionBar, {
            actions: floating ? popupHeaderActions : toolbarActions,
            t,
            ariaLabel: t('editor.findInFilesAction'),
            style: {
              ...styles.findToolHeaderActions,
              ...(floating ? null : styles.findToolDockHeaderActions),
            },
          }),
        ),
        React.createElement(
          'div',
          { style: floating ? { ...styles.findToolSearchRow, ...styles.findToolPopupSearchRow } : styles.findToolSearchRow },
          React.createElement(Icon, { name: 'search', size: 13 }),
          React.createElement(searchNewLine ? 'textarea' : 'input', {
            ref: queryInputRef,
            style: {
              ...styles.findToolInput,
              ...(searchNewLine ? styles.findToolMultilineInput : null),
            },
            autoFocus: true,
            value: state.query,
            placeholder: t('editor.findToolSearchPlaceholder'),
            'aria-label': t('editor.findToolSearchPlaceholder'),
            role: 'combobox',
            'aria-autocomplete': 'list',
            'aria-expanded': occurrences.length > 0,
            'aria-controls': FIND_TOOL_LISTBOX_ID,
            'aria-activedescendant': active === null ? undefined : findToolOptionId(active.rowKey),
            onChange: (event) => onQuery(event.target.value),
            onKeyDown: (event) => {
              if (searchNewLine && event.key === 'Enter' && event.metaKey !== true && event.ctrlKey !== true) return;
              if (
                floating
                && event.key === 'Enter'
                && (event.metaKey === true || event.ctrlKey === true)
                && event.altKey !== true
                && event.shiftKey !== true
                && resultRowCount > 0
              ) {
                event.preventDefault();
                event.stopPropagation();
                requestOpenInFindWindow();
                return;
              }
              if (
                (event.key === 'ContextMenu' || (event.shiftKey === true && event.key === 'F10'))
                && active !== null
                && (active.kind === 'file' || active.kind === 'text')
              ) {
                event.preventDefault();
                event.stopPropagation();
                const rect = occurrenceRefs.current.get(active.rowKey)?.getBoundingClientRect?.();
                openFindResultMenuAt(rect?.left ?? 20, rect?.bottom ?? 20, active);
              } else if (event.altKey === true && event.key === 'ArrowDown') {
                openHistoryMenu(event, 'query');
                return;
              } else handleListKeyDown(event);
            },
          }),
          query === ''
            ? null
            : React.createElement(ToolbarButton, {
                icon: 'close',
                label: t('editor.findClearSearch'),
                style: styles.findToolClearSearch,
                onClick: () => {
                  onQuery('');
                  window.setTimeout(() => queryInputRef.current?.focus?.(), 0);
                },
              }),
          React.createElement(ToolbarButton, {
            icon: floating ? 'chevronDown' : 'history',
            label: t('editor.findSearchHistory'),
            ariaHasPopup: 'menu',
            ariaExpanded: historyMenu?.title === t('editor.findSearchHistory'),
            onClick: (event) => openHistoryMenu(event, 'query'),
          }),
          floating === false
            ? React.createElement(ToolbarButton, {
                icon: 'replace',
                label: replaceExpanded ? t('editor.findToolHideReplace') : t('editor.findToolShowReplace'),
                active: replaceExpanded,
                onClick: () => setReplaceExpanded((current) => !current),
              })
            : null,
          React.createElement('label', { style: styles.findToolNewLine },
            React.createElement('input', {
              type: 'checkbox',
              'data-dsh-find-search-new-line': '',
              'aria-label': t('editor.findNewLine'),
              checked: searchNewLine,
              onChange: (event) => setSearchNewLine(event.target.checked),
            }),
            React.createElement('span', null, t('editor.findNewLine')),
          ),
          React.createElement(
            'span',
            { style: styles.findToolFilterGroup, role: 'group', 'aria-label': t('editor.searchFilter') },
            React.createElement(ToolbarButton, {
              icon: 'matchCase',
              label: t('editor.searchMatchCase'),
              active: state.caseSensitive === true,
              onClick: onToggleCaseSensitive,
            }),
            React.createElement(ToolbarButton, {
              icon: 'wholeWords',
              label: t('editor.searchWholeWords'),
              active: state.wholeWords === true,
              disabled: state.regex === true,
              onClick: onToggleWholeWords,
            }),
            React.createElement(ToolbarButton, {
              icon: 'regex',
              label: t('editor.searchRegex'),
              active: state.regex === true,
              onClick: onToggleRegex,
            }),
          ),
        ),
        replaceExpanded
          ? React.createElement(
              'div',
              { style: styles.findToolReplaceRow },
              React.createElement(Icon, { name: 'replace', size: 13 }),
              React.createElement(replaceNewLine ? 'textarea' : 'input', {
                ref: replaceInputRef,
                'data-dsh-find-replace-input': '',
                style: {
                  ...styles.findToolInput,
                  ...(replaceNewLine ? styles.findToolMultilineInput : null),
                },
                value: state.replace,
                placeholder: t('editor.findToolReplacePlaceholder'),
                'aria-label': t('editor.findToolReplacePlaceholder'),
                onChange: (event) => onReplace(event.target.value),
                onKeyDown: (event) => {
                  if (
                    replaceNewLine
                    && event.key === 'Enter'
                    && event.metaKey !== true
                    && event.ctrlKey !== true
                    && !(event.altKey === true && event.shiftKey === true)
                  ) return;
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
                },
              }),
              React.createElement(ToolbarButton, {
                icon: floating ? 'chevronDown' : 'history',
                label: t('editor.findReplaceHistory'),
                ariaHasPopup: 'menu',
                ariaExpanded: historyMenu?.title === t('editor.findReplaceHistory'),
                onClick: (event) => openHistoryMenu(event, 'replace'),
              }),
              React.createElement('label', { style: styles.findToolNewLine },
                React.createElement('input', {
                  type: 'checkbox',
                  'data-dsh-find-replace-new-line': '',
                  'aria-label': t('editor.findNewLine'),
                  checked: replaceNewLine,
                  onChange: (event) => setReplaceNewLine(event.target.checked),
                }),
                React.createElement('span', null, t('editor.findNewLine')),
              ),
              React.createElement(ToolbarButton, {
                id: 'preserveCase',
                icon: 'preserveCase',
                label: t('editor.searchPreserveCase'),
                active: state.preserveCase === true,
                onClick: onTogglePreserveCase,
              }),
            )
          : null,
        React.createElement(
          'div',
          {
            style: floating
              ? { ...styles.findToolScopeRow, ...styles.findToolPopupScopeRow }
              : styles.findToolScopeRow,
            'data-dsh-find-scope': '',
          },
          React.createElement(
            'div',
            {
              role: 'group',
              'aria-label': t('editor.findScopeModeGroup'),
              style: styles.findToolScopeModeGroup,
            },
            ...scopeModeOptions.map((scope) => React.createElement(
              'button',
              {
                key: scope.id,
                ref: (node) => {
                  if (node === null) scopeModeButtonRefs.current.delete(scope.id);
                  else scopeModeButtonRefs.current.set(scope.id, node);
                },
                type: 'button',
                disabled: scope.disabled,
                tabIndex: scopeMode === scope.id ? 0 : -1,
                'data-dsh-find-scope-mode': scope.id,
                'aria-pressed': scopeMode === scope.id,
                style: {
                  ...styles.findToolScopeButton,
                  ...(scopeMode === scope.id ? styles.findToolScopeButtonActive : null),
                },
                onClick: () => {
                  selectFindScopeMode(scope.id);
                  window.setTimeout(() => queryInputRef.current?.focus?.(), 0);
                },
                onKeyDown: (event) => handleFindScopeModeKeyDown(event, scope.id),
              },
              scope.label,
            )),
          ),
          scopeMode === 'directory'
            ? React.createElement(
                React.Fragment,
                null,
                React.createElement('input', {
                  style: styles.findToolScopeDirectoryInput,
                  value: scopeDirectoryDraft,
                  placeholder: t('editor.findScopeDirectoryPlaceholder'),
                  'aria-label': t('editor.findScopeDirectory'),
                  onChange: (event) => {
                    const value = event.target.value;
                    setScopeDirectoryDraft(value);
                    emitFindScopeChange('directory', effectiveScopePreset, value);
                  },
                  onKeyDown: (event) => {
                    if (event.shiftKey === true && event.key === 'Enter') {
                      event.preventDefault();
                      openFindDirectoryPicker();
                    }
                  },
                }),
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    style: styles.findToolScopeMore,
                    title: `${t('editor.findSelectDirectory')} (⇧⏎)`,
                    'aria-label': t('editor.findSelectDirectory'),
                    'aria-keyshortcuts': 'Shift+Enter',
                    onClick: openFindDirectoryPicker,
                  },
                  '…',
                ),
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    style: {
                      ...styles.findToolScopeMore,
                      ...(scopeRecursive === true ? styles.findToolScopeButtonActive : null),
                    },
                    title: t('editor.findScopeSearchRecursively'),
                    'aria-label': t('editor.findScopeSearchRecursively'),
                    'aria-pressed': scopeRecursive === true,
                    onClick: toggleFindDirectoryRecursive,
                  },
                  React.createElement(Icon, { name: 'project', size: 12 }),
                ),
              )
            : scopeMode === 'scope'
              ? React.createElement(
                  React.Fragment,
                  null,
                  React.createElement(
                    'select',
                    {
                      style: styles.findToolScopeSelect,
                      value: effectiveScopePreset,
                      'aria-label': t('editor.findScopeScope'),
                      onChange: (event) => selectFindScopePreset(event.target.value),
                    },
                    React.createElement('option', { value: 'projectFiles' }, t('editor.findScopeProjectFiles')),
                    React.createElement('option', { value: 'gitNonIgnoredFiles', disabled: gitAvailable !== true }, t('editor.findScopeGitNonIgnoredFiles')),
                    React.createElement('option', { value: 'gitTrackedFiles', disabled: gitAvailable !== true }, t('editor.findScopeGitTrackedFiles')),
                    React.createElement('option', { value: 'recentlyViewedFiles', disabled: recentFilePaths.length === 0 }, t('editor.findScopeRecentlyViewedFiles')),
                    React.createElement('option', { value: 'openFiles', disabled: openFilePaths.length === 0 }, t('editor.findScopeOpenFiles')),
                    React.createElement('option', { value: 'currentFile', disabled: activeFilePath === null }, t('editor.findScopeCurrentFile')),
                    React.createElement('option', { value: 'changedFiles', disabled: changedFilePaths.length === 0 }, t('editor.findScopeChangedFiles')),
                    ...(Array.isArray(customScopes) ? customScopes : []).map((scope) =>
                      React.createElement('option', { key: scope.id, value: `custom:${scope.id}` }, scope.name)),
                  ),
                  React.createElement(
                    'button',
                    {
                      type: 'button',
                      style: styles.findToolScopeMore,
                      title: t('editor.findEditScopes'),
                      'aria-label': t('editor.findEditScopes'),
                      onClick: () => setScopeEditorOpen(true),
                    },
                    '…',
                  ),
                )
            : null,
        ),
        state.error !== null
          ? React.createElement(
              'div',
              { style: styles.searchEverywhereError, role: 'alert' },
              t('editor.findSearchFailed', { message: state.error }),
            )
          : null,
        React.createElement(
          'div',
          {
            role: 'status',
            'aria-live': 'polite',
            'aria-atomic': 'true',
            style: styles.screenReaderOnly,
          },
          findResultStatus,
        ),
        React.createElement(
          'div',
          {
            style: floating ? styles.findToolResultsStack : styles.findToolDockSplit,
            'data-dsh-find-results-layout': floating ? 'stack' : 'split',
          },
          React.createElement(
            'div',
            {
              style: floating ? styles.findToolResultsStack : styles.findToolDockResultsPane,
              'data-dsh-find-results-pane': '',
            },
            React.createElement(
              'div',
              {
                ref: listRef,
                id: FIND_TOOL_LISTBOX_ID,
                style: styles.findToolList,
                role: 'listbox',
                'aria-label': t('editor.findInFilesAction'),
                'aria-activedescendant': active === null ? undefined : findToolOptionId(active.rowKey),
                tabIndex: 0,
                onKeyDown: handleListKeyDown,
              },
              state.loading === true && occurrences.length === 0
            ? React.createElement(
                'div',
                { style: floating ? styles.findToolPopupMessage : styles.findToolMessage },
                t('editor.loading'),
              )
            : null,
          state.loading !== true && !hasFindToolContentQuery(query)
            ? React.createElement(
                'div',
                { style: floating ? styles.findToolPopupMessage : styles.findToolMessage },
                t('editor.findToolEmptyQuery'),
              )
            : null,
          state.loading !== true && hasFindToolContentQuery(query) && occurrences.length === 0
            ? React.createElement(
                'div',
                { style: floating ? styles.findToolPopupMessage : styles.findToolMessage },
                floating ? t('editor.findToolNothingFound') : t('editor.findToolNoMatches'),
                showFindSearchOptionSummary
                  ? React.createElement(
                      'div',
                      {
                        style: styles.searchEverywhereUsedOptions,
                        'data-dsh-find-used-options': '',
                      },
                      `${t(activeFindSearchOptionIds.length === 1 ? 'editor.searchOptionUsed' : 'editor.searchOptionsUsed')} ${activeFindSearchOptionsText}`,
                    )
                  : null,
                showFindSearchOptionSummary
                  ? React.createElement(
                      'button',
                      {
                        type: 'button',
                        className: 'dsh-editor-search-clear-options',
                        style: styles.searchEverywhereInlineAction,
                        'data-dsh-find-clear-options': '',
                        'aria-keyshortcuts': 'Alt+Shift+Backspace',
                        title: `${t(activeFindSearchOptionIds.length === 1 ? 'editor.searchClearOption' : 'editor.searchClearAllOptions')} (⌥⇧⌫)`,
                        onClick: () => clearFindSearchOptions('all'),
                      },
                      `${t(activeFindSearchOptionIds.length === 1 ? 'editor.searchClearOption' : 'editor.searchClearAllOptions')} ⌥⇧⌫`,
                    )
                  : null,
              )
            : null,
          floating
            ? occurrences.map((result, position) => {
                const isText = result.kind === 'text';
                const rowKey = result.rowKey;
                return React.createElement(
                  'div',
                  {
                    key: rowKey,
                    ref: (node) => {
                      if (node === null) occurrenceRefs.current.delete(rowKey);
                      else occurrenceRefs.current.set(rowKey, node);
                    },
                    id: findToolOptionId(rowKey),
                    role: 'option',
                    'aria-selected': position === activeIndex,
                    tabIndex: position === activeIndex ? 0 : -1,
                    'data-dsh-find-active': position === activeIndex ? '1' : '0',
                    'data-dsh-find-popup-result': isText ? 'text' : 'file',
                    title: isText
                      ? `${result.path}:${result.line}:${result.column} ${result.preview ?? ''}`
                      : result.path,
                    style: {
                      ...styles.findToolPopupResult,
                      ...(position === activeIndex ? styles.findToolPopupResultActive : null),
                    },
                    onFocus: () => onMove(0, occurrences.length, position),
                    onKeyDown: (event) => handleOccurrenceKeyDown(event, rowKey, position),
                    onContextMenu: (event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onMove(0, occurrences.length, position);
                      openFindResultMenuAt(event.clientX, event.clientY, occurrences[position]);
                    },
                    onMouseDown: (event) => {
                      event.preventDefault();
                      onMove(0, occurrences.length, position);
                      event.currentTarget.focus?.();
                    },
                    onDoubleClick: () => openFindResult(result),
                  },
                  React.createElement(
                    'span',
                    { style: styles.findToolPopupResultPreview },
                    isText
                      ? previewParts(result)
                      : React.createElement(React.Fragment, null,
                          React.createElement(EntryIcon, { entry: { path: result.path, kind: 'file' }, expanded: false }),
                          React.createElement('span', { style: { marginLeft: 6 } }, result.path)),
                  ),
                  React.createElement(
                    'span',
                    {
                      style: {
                        ...styles.findToolPopupResultPath,
                        ...(position === activeIndex ? styles.findToolPopupResultPathActive : null),
                      },
                    },
                    isText ? `${basename(result.path)} ${result.line}` : basename(result.path),
                  ),
                );
              })
            : React.createElement(
                React.Fragment,
                null,
                scopedFileResults.length === 0
                  ? null
                  : React.createElement(
                      React.Fragment,
                      null,
                      React.createElement('div', { style: styles.findToolFileRow }, t('editor.searchTabFiles')),
                      scopedFileResults.map((file) => {
                        const rowKey = `file:${file.path}`;
                        const position = occurrences.findIndex((entry) => entry.rowKey === rowKey);
                        return React.createElement(
                          'div',
                          {
                            key: `file-result:${file.path}`,
                            ref: (node) => {
                              if (node === null) occurrenceRefs.current.delete(rowKey);
                              else occurrenceRefs.current.set(rowKey, node);
                            },
                            id: findToolOptionId(rowKey),
                            role: 'option',
                            'aria-selected': position === activeIndex,
                            tabIndex: position === activeIndex ? 0 : -1,
                            'data-dsh-find-active': position === activeIndex ? '1' : '0',
                            style: {
                              ...styles.findToolOccurrence,
                              ...(position === activeIndex ? styles.findToolOccurrenceActive : null),
                            },
                            onFocus: () => onMove(0, occurrences.length, position),
                            onKeyDown: (event) => handleOccurrenceKeyDown(event, rowKey, position),
                            onContextMenu: (event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              onMove(0, occurrences.length, position);
                              openFindResultMenuAt(event.clientX, event.clientY, occurrences[position]);
                            },
                            onMouseDown: (event) => {
                              event.preventDefault();
                              onMove(0, occurrences.length, position);
                              event.currentTarget.focus?.();
                            },
                            onDoubleClick: () => openFindResult({ ...file, kind: 'file' }),
                          },
                          React.createElement(EntryIcon, { entry: { path: file.path, kind: 'file' }, expanded: false }),
                          React.createElement('span', { style: styles.findToolPreview }, file.path),
                        );
                      }),
                    ),
                displayGroups.map((group) =>
            group.kind === 'directory'
              ? React.createElement(
                  'div',
                  {
                    key: `directory:${group.path}`,
                    'data-dsh-find-directory': group.path,
                    style: styles.findToolDirectoryRow,
                  },
                  React.createElement(Icon, { name: 'project', size: 12 }),
                  React.createElement(
                    'span',
                    { style: styles.findToolDirectoryPath },
                    group.path === '' ? t('editor.findDirectoryRoot') : group.path,
                  ),
                  React.createElement(
                    'span',
                    { style: styles.findToolFileCount },
                    group.count === 1
                      ? t('editor.findToolFileGroupOne')
                      : t('editor.findToolFileGroup', { count: group.count }),
                  ),
                )
              : React.createElement(
              'div',
              {
                key: `group:${group.path}`,
                id: findToolGroupId(group.path),
                role: 'group',
                'aria-label': group.path,
                'data-dsh-find-group': group.path,
              },
              React.createElement(
                'div',
                { style: styles.findToolFileRow, title: group.path },
                React.createElement(
                  'button',
                  {
                    ref: (node) => {
                      if (node === null) groupButtonRefs.current.delete(group.path);
                      else groupButtonRefs.current.set(group.path, node);
                    },
                    type: 'button',
                    style: styles.findToolGroupButton,
                    tabIndex: rovingGroupPath === group.path ? 0 : -1,
                    'data-dsh-find-group-path': group.path,
                    'aria-label': collapsedFiles.has(group.path)
                      ? t('editor.findToolExpandFile')
                      : t('editor.findToolCollapseFile'),
                    'aria-expanded': collapsedFiles.has(group.path) === false,
                    'aria-controls': findToolGroupId(group.path),
                    onFocus: () => setFocusedGroupPath(group.path),
                    onClick: (event) => {
                      setFocusedGroupPath(group.path);
                      event.currentTarget.focus?.();
                      toggleGroup(group.path);
                    },
                    onKeyDown: (event) => handleGroupKeyDown(event, group),
                  },
                  React.createElement(Icon, { name: collapsedFiles.has(group.path) ? 'chevronRight' : 'chevronDown', size: 12 }),
                ),
                React.createElement(EntryIcon, { entry: { path: group.path, kind: 'file' }, expanded: false }),
                React.createElement('span', { style: styles.findToolFilePath }, group.path),
                React.createElement(
                  'span',
                  { style: styles.findToolFileCount },
                  group.matches.length === 1
                    ? t('editor.findToolFileGroupOne')
                    : t('editor.findToolFileGroup', { count: group.matches.length }),
                ),
              ),
              collapsedFiles.has(group.path)
                ? null
                : group.matches.map((match) => {
                    const rowKey = `text:${match.path}:${match.line}:${match.column}`;
                    const position = occurrences.findIndex((entry) => entry.rowKey === rowKey);
                    return React.createElement(
                      'div',
                      {
                        key: rowKey,
                        ref: (node) => {
                          if (node === null) occurrenceRefs.current.delete(rowKey);
                          else occurrenceRefs.current.set(rowKey, node);
                        },
                        id: findToolOptionId(rowKey),
                        role: 'option',
                        'aria-selected': position === activeIndex,
                        tabIndex: position === activeIndex ? 0 : -1,
                        'data-dsh-find-active': position === activeIndex ? '1' : '0',
                        title: `${match.path}:${match.line}:${match.column} ${match.preview ?? ''}`,
                        style: {
                          ...styles.findToolOccurrence,
                          ...(position === activeIndex ? styles.findToolOccurrenceActive : null),
                        },
                        onFocus: () => onMove(0, occurrences.length, position),
                        onKeyDown: (event) => handleOccurrenceKeyDown(event, rowKey, position),
                        onContextMenu: (event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onMove(0, occurrences.length, position);
                          openFindResultMenuAt(event.clientX, event.clientY, occurrences[position]);
                        },
                        onMouseDown: (event) => {
                          event.preventDefault();
                          onMove(0, occurrences.length, position);
                          event.currentTarget.focus?.();
                        },
                        onDoubleClick: () => openFindResult({ ...match, kind: 'text' }),
                      },
                      React.createElement('span', { style: styles.findToolLocation }, `${match.line}:${match.column}`),
                      React.createElement('span', { style: styles.findToolPreview }, previewParts({ ...match, rowKey })),
                    );
                  }),
                ),
              ),
          ),
          state.truncated === true
            ? React.createElement('div', { style: styles.searchEverywhereMessage }, t('editor.searchTextTruncated'))
            : null,
            ),
          ),
        previewOpen && (floating ? active !== null && hasFindToolContentQuery(query) : true)
          ? React.createElement(
              'div',
              {
                style: floating
                  ? styles.findToolPreviewPane
                  : { ...styles.findToolPreviewPane, ...styles.findToolDockPreviewPane },
                'data-dsh-find-preview': '',
                'data-dsh-find-preview-layout': floating ? 'bottom' : 'right',
              },
              React.createElement(
                'div',
                { style: styles.searchEverywherePreviewToolbar },
                React.createElement(Icon, { name: 'file', size: 12 }),
                React.createElement(
                  'span',
                  { style: styles.searchEverywherePreviewPath, title: previewState.path },
                  previewState.path || t('editor.findToolPreviewSource'),
                ),
                React.createElement(ToolbarButton, {
                  icon: 'wrap',
                  label: t('editor.searchPreviewSoftWrap'),
                  active: previewSoftWrap,
                  onClick: () => setPreviewSoftWrap((value) => !value),
                }),
              ),
              React.createElement(
                'div',
                {
                  ref: previewBodyRef,
                  style: styles.searchEverywherePreviewBody,
                  className: 'dsh-editor-code-preview',
                  'data-dsh-code-preview': '',
                },
                active === null
                  ? React.createElement(
                      'div',
                      { style: styles.searchEverywhereMessage },
                      t('editor.findToolPreviewSelectResult'),
                    )
                  : null,
                previewState.loading
                  ? React.createElement('div', { style: styles.searchEverywhereMessage }, t('editor.loading'))
                  : null,
                previewState.error !== null
                  ? React.createElement('div', { style: styles.searchEverywhereError, role: 'alert' }, previewState.error)
                  : null,
                active !== null && !previewState.loading && previewState.error === null
                  ? React.createElement(
                      React.Fragment,
                      null,
                      previewWindow?.truncatedBefore
                        ? React.createElement('div', { style: styles.searchEverywhereMessage }, '…')
                        : null,
                      previewLines.length === 0
                        ? React.createElement('div', { style: styles.searchEverywhereMessage }, t('editor.searchPreviewEmpty'))
                        : previewLines.map((code, index) => {
                            const previewLineStart = previewLineStarts[previewWindow.start - 1 + index] ?? 0;
                            const previewSegments = findToolPreviewLineParts(code, previewLineStart, previewMatches);
                            return React.createElement(
                              'div',
                              {
                                key: previewWindow.start + index,
                                'data-dsh-preview-line': previewWindow.start + index,
                                className: 'dsh-editor-code-preview-line',
                                style: {
                                  ...styles.searchEverywherePreviewLine,
                                  ...(previewWindow.start + index === previewState.line
                                    ? styles.searchEverywherePreviewLineActive
                                    : null),
                                },
                              },
                              React.createElement(
                                'span',
                                {
                                  className: 'dsh-editor-code-preview-gutter',
                                  style: styles.searchEverywherePreviewNumber,
                                },
                                String(previewWindow.start + index),
                              ),
                              React.createElement(
                                CodePreviewCode,
                                {
                                  text: previewSegments.map((part) => part.text).join(''),
                                  html: previewColorizedLines?.[index] ?? null,
                                  segments: previewSegments,
                                  style: {
                                    ...styles.searchEverywherePreviewCode,
                                    whiteSpace: previewSoftWrap ? 'pre-wrap' : 'pre',
                                    overflowWrap: previewSoftWrap ? 'anywhere' : 'normal',
                                  },
                                },
                              ),
                            );
                          }),
                      previewWindow?.truncatedAfter
                        ? React.createElement('div', { style: styles.searchEverywhereMessage }, '…')
                        : null,
                    )
                  : null,
              ),
            )
          : null,
        ),
        floating || replaceExpanded
          ? React.createElement(
          'div',
          { style: styles.findToolBottomBar, 'data-dsh-find-bottom-bar': '' },
          floating
            ? React.createElement(
                React.Fragment,
                null,
                React.createElement('label', { style: styles.findToolNewLine },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: openResultsInNewTab,
                    onChange: toggleOpenResultsInNewTab,
                  }),
                  React.createElement('span', null, t('editor.findOpenResultsInNewTab')),
                ),
              )
            : null,
          React.createElement('span', { style: styles.findToolSpacer }),
          floating
            ? React.createElement('span', { style: styles.findToolShortcut }, '⌘⏎')
            : null,
          floating
            ? React.createElement(
                'button',
                {
                  type: 'button',
                  style: {
                    ...styles.conflictAction,
                    ...styles.findToolBottomAction,
                    opacity: hasFindToolContentQuery(query) ? 1 : 0.45,
                  },
                  'data-dsh-find-bottom-action': 'open-in-find-window',
                  disabled: !hasFindToolContentQuery(query),
                  title: openInFindWindowDisabledReason || `${t('editor.findOpenInFindWindow')} (⌘⏎)`,
                  'aria-description': openInFindWindowDisabledReason || undefined,
                  'aria-keyshortcuts': 'Meta+Enter Control+Enter',
                  onClick: requestOpenInFindWindow,
                },
                t('editor.findOpenInFindWindow'),
              )
            : null,
          replaceExpanded
            ? React.createElement(
                React.Fragment,
                null,
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    style: {
                      ...styles.conflictAction,
                      ...styles.findToolBottomAction,
                      opacity: state.replaceBusy || state.loading || state.error !== null || scopedMatches.length === 0 ? 0.45 : 1,
                    },
                    'data-dsh-find-bottom-action': 'replace-all',
                    disabled: state.replaceBusy === true || state.loading === true || state.error !== null || scopedMatches.length === 0,
                    title: replaceAllDisabledReason || `${t('editor.searchReplaceAll')} (⌥⇧⏎)`,
                    'aria-description': replaceAllDisabledReason || undefined,
                    'aria-keyshortcuts': 'Alt+Shift+Enter',
                    onClick: () => onReplaceAll(scopedReplacementPaths),
                  },
                  state.replaceBusy ? t('editor.loading') : t('editor.searchReplaceAll'),
                ),
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    style: {
                      ...styles.conflictAction,
                      ...styles.findToolBottomAction,
                      opacity: state.replaceBusy || state.loading || state.error !== null || active?.kind !== 'text' ? 0.45 : 1,
                    },
                    'data-dsh-find-bottom-action': 'replace',
                    disabled: state.replaceBusy === true || state.loading === true || state.error !== null || active?.kind !== 'text',
                    title: replaceCurrentDisabledReason || `${t('editor.replaceCurrent')} (Enter)`,
                    'aria-description': replaceCurrentDisabledReason || undefined,
                    'aria-keyshortcuts': 'Enter',
                    onClick: () => onReplaceOccurrence(active, activeIndex),
                  },
                  t('editor.replaceCurrent'),
                ),
              )
            : null,
          )
          : null,
        directoryPicker === null
          ? null
          : React.createElement(MoveToPicker, {
              t,
              state: directoryPicker,
              title: t('editor.findSelectDirectory'),
              placeholder: t('editor.findSelectDirectoryPlaceholder'),
              currentLabel: t('editor.findSelectDirectoryCurrent'),
              onQuery: (value) => setDirectoryPicker((current) => (current === null
                ? current
                : { ...current, query: value, index: 0 })),
              onMove: (direction, count) => setDirectoryPicker((current) => {
                if (current === null) return current;
                if (count === 0) return { ...current, index: 0 };
                return { ...current, index: (current.index + direction + count) % count };
              }),
              onPick: (directory) => {
                setScopeDirectoryDraft(directory);
                setScopeMode('directory');
                emitFindScopeChange('directory', effectiveScopePreset, directory);
                setDirectoryPicker(null);
                window.setTimeout(() => queryInputRef.current?.focus?.(), 0);
              },
              onClose: () => setDirectoryPicker(null),
            }),
        scopeEditorOpen
          ? React.createElement(FindScopeEditor, {
              t,
              scopes: customScopes,
              initialId: selectedCustomScope?.id ?? null,
              onSave: (nextScopes, nextSelectedId) => {
                const normalized = typeof onCustomScopesChange === 'function'
                  ? onCustomScopesChange(nextScopes)
                  : normalizeCustomFindScopes(nextScopes);
                const savedId = normalized.some((scope) => scope.id === nextSelectedId)
                  ? nextSelectedId
                  : normalized[0]?.id ?? '';
                const nextPreset = savedId === '' ? 'projectFiles' : `custom:${savedId}`;
                setScopePreset(nextPreset);
                emitFindScopeChange('scope', nextPreset, scopeDirectoryDraft);
              },
              onClose: () => setScopeEditorOpen(false),
            })
          : null,
        groupByMenu === null
          ? null
          : React.createElement(ContextMenu, {
              t,
              menu: groupByMenu,
              onClose: () => setGroupByMenu(null),
            }),
        filterMenu === null
          ? null
          : React.createElement(ContextMenu, {
              t,
              menu: filterMenu,
              onClose: () => setFilterMenu(null),
            }),
        fileMaskMenu === null
          ? null
          : React.createElement(ContextMenu, {
              t,
              menu: fileMaskMenu,
              onClose: () => setFileMaskMenu(null),
            }),
        resultMenu === null
          ? null
          : React.createElement(ContextMenu, {
              t,
              menu: resultMenu,
              onClose: () => setResultMenu(null),
            }),
        historyMenu === null
          ? null
          : React.createElement(
              'div',
              { 'data-dsh-find-history-menu': '' },
              React.createElement(ContextMenu, {
                t,
                menu: historyMenu,
                onClose: () => setHistoryMenu(null),
              }),
            ),
        floating
          ? FIND_POPUP_RESIZE_DIRECTIONS.map((direction) =>
              React.createElement('div', {
                key: `find-popup-resize:${direction}`,
                'data-dsh-find-popup-resize': direction,
                'aria-hidden': true,
                style: popupResizeHandleStyle(direction),
                onPointerDown: (event) => onPopupResizeStart?.(event, direction),
              }))
          : null,
      );
    }

    /**
     * IDEA's "Go to File": a fuzzy list of workspace files, opened with ⌘⇧O.
     *
     * The palette lists what the tree has already loaded first and asks the host
     * for a recursive walk (bounded) so deeply nested files are reachable too.
     */

    /* QUICK_OPEN_BOUNDARY */
function QuickOpen({ t, files, changes, query, loading, index, mode = 'files', onQuery, onMove, onOpen, onClose }) {
      const listRef = React.useRef(null);
      React.useEffect(() => {
        listRef.current?.scrollIntoView({ block: 'nearest' });
      }, [index]);
      const recent = mode === 'recent';
      const matches = (recent
        /* Recent Files keeps the order it is given: the list IS "most recent
           first", so sorting by score would destroy the only thing it says.
           A query still filters, but never reorders. */
        ? files.map((path) => ({ path, score: query === '' ? 0 : fuzzyScore(path, query) })).filter((entry) => entry.score >= 0)
        : files
          .map((path) => ({ path, score: fuzzyScore(path, query) }))
          .filter((entry) => entry.score >= 0)
          .sort((left, right) => right.score - left.score || left.path.length - right.path.length)
      ).slice(0, 60);
      return React.createElement(
        'div',
        { style: styles.paletteBackdrop, onMouseDown: onClose },
        React.createElement(
          'div',
          {
            style: styles.palette,
            role: 'dialog',
            'aria-label': recent ? t('editor.recentFiles') : t('editor.gotoFile'),
            onMouseDown: (event) => event.stopPropagation(),
          },
          React.createElement('input', {
            style: styles.paletteInput,
            autoFocus: true,
            placeholder: recent ? t('editor.recentFilesPlaceholder') : t('editor.gotoFilePlaceholder'),
            value: query,
            onChange: (event) => onQuery(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                onMove(1, matches.length);
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                onMove(-1, matches.length);
              } else if (event.key === 'Enter') {
                event.preventDefault();
                if (matches[index] !== undefined) onOpen(matches[index].path);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              }
            },
          }),
          React.createElement(
            'div',
            { style: styles.paletteList },
            loading && files.length === 0 ? React.createElement('div', { style: styles.treeMessage }, t('editor.loading')) : null,
            /* Recent Files with nothing in it is not "no matches": the list is
               simply empty because nothing has been opened in this workspace. */
            matches.length === 0 && !loading
              ? React.createElement('div', { style: styles.treeMessage }, recent && query === '' ? t('editor.recentEmpty') : t('editor.noMatches'))
              : null,
            matches.map((entry, position) => {
              /* Declared per row so the badge reads from the live status map. */
              const badge = badgeFor(entry.path, changes);
              return React.createElement(
                'div',
                {
                  key: entry.path,
                  ref: position === index ? listRef : null,
                  className: 'dsh-editor-palette-row',
                  style: { ...styles.paletteRow, ...(position === index ? styles.paletteRowActive : null) },
                  onMouseDown: (event) => {
                    event.preventDefault();
                    onOpen(entry.path);
                  },
                },
                React.createElement(EntryIcon, { entry: { path: entry.path, kind: 'file' }, expanded: false }),
                /* IDEA marks changed files in its search popups too: without this the
                   modified file you were looking for looks like the clean one. */
                React.createElement(GitStatusBadge, { selected: false, info: badge }),
                React.createElement('span', { style: styles.paletteName }, basename(entry.path)),
                React.createElement('span', { style: styles.paletteDir }, dirname(entry.path)),
              );
            }),
          ),
        ),
      );
    }

    function fuzzyScore(path, query, options) {
      options = options ?? {};
      if (query === '') return 0;
      const caseSensitive = options?.caseSensitive === true;
      const haystack = caseSensitive ? path : path.toLowerCase();
      const needle = caseSensitive ? query : query.toLowerCase();
      if (options?.wholeWords === true) {
        const boundary = wholeWordIndex(haystack, needle, true);
        return boundary < 0 ? -1 : 1000 + boundary - haystack.length;
      }
      const direct = haystack.lastIndexOf(needle);
      if (direct >= 0) return 1000 + direct - haystack.length;
      let position = -1;
      let score = 0;
      for (const character of needle) {
        const found = haystack.indexOf(character, position + 1);
        if (found < 0) return -1;
        score += found === position + 1 ? 2 : 1;
        position = found;
      }
      return score;
    }
