/* search-everywhere.js SearchEverywhere legacy oracle. */

    function SearchEverywhere({
      t,
      state,
      files,
      openFiles,
      changes,
      textMatches,
      actions,
      recentSearches,
      recentFindUsages,
      recentCommands,
      historyRequest,
      findUsagesHistoryRequest,
      replaceHistory,
      textLoading,
      textTruncated,
      error,
      replaceBusy,
      onQuery,
      onTab,
      onMove,
      onActivate,
      onClose,
      onReplaceChange,
      onReplaceAll,
      onRememberQuery,
      onRememberCommand,
      onOpenFindUsagesHistory,
      onOpenInFindToolWindow,
      onToggleIncludeNonProject,
      onToggleCaseSensitive,
      onToggleWholeWords,
      onToggleRegex,
      onTogglePreserveCase,
      onFileMaskChange,
      onOpenInRightSplit,
      onRevealResult,
      onNotify,
    }) {
      const listRef = React.useRef(null);
      const previewBodyRef = React.useRef(null);
      const searchInputRef = React.useRef(null);
      const replaceInputRef = React.useRef(null);
      const fileMaskInputRef = React.useRef(null);
      const searchTabListRef = React.useRef(null);
      const resultTooltipTimerRef = React.useRef(null);
      const resultInfoCloseRef = React.useRef(null);
      const SEARCH_EVERYWHERE_LISTBOX_ID = 'dsh-editor-search-everywhere-listbox';
      const [resultTooltip, setResultTooltip] = React.useState(null);
      const [resultMenu, setResultMenu] = React.useState(null);
      const [resultInfo, setResultInfo] = React.useState(null);
      const [previewOpen, setPreviewOpen] = React.useState(false);
      const [previewSoftWrap, setPreviewSoftWrap] = React.useState(true);
      const [previewState, setPreviewState] = React.useState({
        loading: false,
        kind: null,
        path: '',
        content: '',
        line: 1,
        error: null,
      });
      const [searchFilters, setSearchFilters] = React.useState(defaultSearchEverywhereFilters);
      const [fileMaskOpen, setFileMaskOpen] = React.useState(false);
      const [filterMenu, setFilterMenu] = React.useState(null);
      const [queryHistoryMenu, setQueryHistoryMenu] = React.useState(null);
      const [findUsagesHistoryMenu, setFindUsagesHistoryMenu] = React.useState(null);
      const [replaceHistoryMenu, setReplaceHistoryMenu] = React.useState(null);
      const closeFilterMenu = React.useCallback(() => {
        setFilterMenu(null);
        window.setTimeout(() => searchInputRef.current?.focus(), 0);
      }, []);
      const resetSearchFilters = React.useCallback(() => {
        setSearchFilters(defaultSearchEverywhereFilters());
        setFilterMenu(null);
        window.setTimeout(() => searchInputRef.current?.focus?.(), 0);
      }, []);
      const clearResultTooltip = React.useCallback(() => {
        if (resultTooltipTimerRef.current !== null) {
          window.clearTimeout(resultTooltipTimerRef.current);
          resultTooltipTimerRef.current = null;
        }
        setResultTooltip(null);
      }, []);
      const closeResultInfo = React.useCallback(() => {
        setResultInfo(null);
        window.setTimeout(() => searchInputRef.current?.focus?.(), 0);
      }, []);
      const scheduleResultTooltip = React.useCallback((event, result) => {
        if (result?.kind !== 'action') return;
        const text = searchEverywhereResultTooltip(result);
        if (text === '') return;
        if (resultTooltipTimerRef.current !== null) window.clearTimeout(resultTooltipTimerRef.current);
        const rect = event.currentTarget.getBoundingClientRect();
        resultTooltipTimerRef.current = window.setTimeout(() => {
          const position = searchEverywhereTooltipPosition(
            rect.left,
            rect.bottom,
            window.innerWidth,
            window.innerHeight,
          );
          setResultTooltip({ ...position, text });
          resultTooltipTimerRef.current = null;
        }, 450);
      }, []);
      React.useEffect(() => () => {
        if (resultTooltipTimerRef.current !== null) window.clearTimeout(resultTooltipTimerRef.current);
      }, []);
      React.useEffect(() => {
        setResultInfo(null);
      }, [state.query, state.tab]);
      React.useEffect(() => {
        if (resultInfo === null) return;
        window.setTimeout(() => resultInfoCloseRef.current?.focus?.(), 0);
      }, [resultInfo]);
      const query = state.query.trim();
      const replaceFocusRequest = Math.max(0, Number(state.replaceFocusRequest) || 0);
      React.useEffect(() => {
        if (state.withReplace !== true || replaceFocusRequest === 0) return;
        window.setTimeout(() => replaceInputRef.current?.focus?.(), 0);
      }, [replaceFocusRequest, state.withReplace]);
      /* Basic tab ownership: the selected tab alone decides the provider.
         Query text is ordinary content, never an implicit category/provider
         language, so `/actions` stays a literal query instead of switching tab. */
      const effectiveTab = state.tab;
      const effectiveQuery = query;
      const canResetSearchFilters = effectiveTab === 'all' && searchEverywhereFiltersNeedReset(searchFilters);
      const tabs = [
        { id: 'all', label: t('editor.searchTabAll') },
        { id: 'files', label: t('editor.searchTabFiles') },
        { id: 'text', label: t('editor.searchTabText') },
        { id: 'actions', label: t('editor.searchTabActions') },
      ];
      const actionMatches = rankSearchActions(actions, effectiveQuery, recentCommands, {
        caseSensitive: state.caseSensitive === true,
        wholeWords: state.wholeWords === true,
      })
        .map((action) => ({
          ...action,
          kind: 'action',
          rowKey: `action:${action.id}`,
          subtitle: action.description ?? t('editor.searchActionHint'),
          category: searchEverywhereActionCategory(action.id, t),
          ariaKeyShortcuts: searchEverywhereAriaKeyShortcuts(action.shortcut),
        }));
      const fileMatches = files
        .filter((path) => fileExtensionFilterMatches(path, state.fileMask))
        .map((path) => ({
          path,
          score: fuzzyScore(path, effectiveQuery, {
            caseSensitive: state.caseSensitive === true,
            wholeWords: state.wholeWords === true,
          }),
        }))
        .filter((entry) => entry.score >= 0)
        .sort((left, right) => right.score - left.score || left.path.length - right.path.length)
        .slice(0, 80)
        .map((entry) => ({
          kind: 'file',
          rowKey: `file:${entry.path}`,
          path: entry.path,
          title: basename(entry.path),
          subtitle: dirname(entry.path),
          icon: 'file',
        }));
      const textResults = textMatches.map((match) => ({
        kind: 'text',
        rowKey: `text:${match.path}:${match.line}:${match.column}`,
        path: match.path,
        line: match.line,
        column: match.column,
        mtime: match.mtime,
        dirty: match.dirty === true,
        preview: match.preview ?? '',
        title: match.preview || basename(match.path),
        subtitle: `${match.path}:${match.line}:${match.column}`,
        icon: 'search',
      }));
      const historyResults = (Array.isArray(recentSearches) ? recentSearches : []).map((entry) => ({
        kind: 'action',
        history: true,
        rowKey: `history:${entry}`,
        label: entry,
        title: entry,
        subtitle: t('editor.searchRecentQuery'),
        icon: 'history',
        run: () => onQuery(entry),
      }));
      let results;
      if (effectiveTab === 'files') results = fileMatches;
      else if (effectiveTab === 'text') results = textResults;
      else if (effectiveTab === 'actions') results = actionMatches;
      else if (effectiveQuery === '') results = [
        ...historyResults.slice(0, 8),
        ...(searchFilters.actions ? actionMatches.slice(0, 12) : []),
      ];
      else results = [
        ...(searchFilters.actions ? actionMatches.slice(0, 8) : []),
        ...(searchFilters.files ? fileMatches.slice(0, 24) : []),
        ...(searchFilters.text ? textResults.slice(0, 40) : []),
      ];
      const activeIndex = normalizeSearchResultIndex(results, state.index);
      const activeResult = results[activeIndex] ?? null;
      const searchResultStatus = error !== null
        ? ''
        : textLoading
          ? t('editor.loading')
          : results.length === 0
            ? (effectiveTab === 'text' && effectiveQuery.length < 2 ? t('editor.searchTextHint') : t('editor.searchNoMatches'))
            : t('editor.searchResultCount', { count: results.length });
      const showFindInFilesFallback = searchEverywhereOffersFindInFiles({
        tab: effectiveTab,
        query: effectiveQuery,
        resultCount: results.length,
        loading: textLoading,
      });
      const showClearOptionsFallback = searchEverywhereOffersClearOptions({
        tab: effectiveTab,
        query: effectiveQuery,
        resultCount: results.length,
        loading: textLoading,
        caseSensitive: state.caseSensitive,
        wholeWords: state.wholeWords,
        regex: state.regex,
        fileMask: state.fileMask,
      });
      const showScopeExpansionFallback = searchEverywhereOffersScopeExpansion({
        tab: effectiveTab,
        query: effectiveQuery,
        resultCount: results.length,
        loading: textLoading,
        includeNonProject: state.includeNonProject,
      });
      const activeSearchOptionIds = searchEverywhereActiveOptionIds({
        caseSensitive: state.caseSensitive,
        wholeWords: state.wholeWords,
        regex: state.regex,
        fileMask: state.fileMask,
      });
      const activeSearchOptionLabels = {
        case: t('editor.searchMatchCase'),
        words: t('editor.searchWholeWords'),
        regex: t('editor.searchRegex'),
        fileMask: t('editor.searchFileMaskLabel'),
      };
      const activeSearchOptionsText = activeSearchOptionIds
        .map((id) => activeSearchOptionLabels[id])
        .filter((label) => typeof label === 'string' && label !== '')
        .join(' · ');
      const clearSearchOptions = () => {
        if (state.caseSensitive === true) onToggleCaseSensitive();
        if (state.wholeWords === true) onToggleWholeWords();
        if (state.regex === true) onToggleRegex();
        if (String(state.fileMask ?? '').trim() !== '') onFileMaskChange('');
        window.setTimeout(() => searchInputRef.current?.focus?.(), 0);
      };
      const expandSearchScope = () => {
        if (state.includeNonProject !== true) onToggleIncludeNonProject();
        window.setTimeout(() => searchInputRef.current?.focus?.(), 0);
      };
      const previewWindow = previewOpen
        ? searchEverywherePreviewWindow(previewState.content, previewState.line)
        : null;
      const previewLines = previewWindow === null || previewState.content === ''
        ? []
        : previewState.content.split(/\r?\n/u).slice(previewWindow.start - 1, previewWindow.end);
      const previewColorizedLines = useCodePreviewColorizedLines(previewLines, previewState.path);
      React.useEffect(() => {
        if (!previewOpen) {
          setPreviewState({ loading: false, kind: null, path: '', content: '', line: 1, error: null });
          return undefined;
        }
        if (activeResult === null) {
          setPreviewState({ loading: false, kind: null, path: '', content: '', line: 1, error: null });
          return undefined;
        }
        if (activeResult.kind === 'action') {
          setPreviewState({
            loading: false,
            kind: 'action',
            path: '',
            content: activeResult.description ?? '',
            line: 1,
            error: null,
          });
          return undefined;
        }
        if (activeResult.kind === 'text' && activeResult.dirty === true) {
          const liveFile = (Array.isArray(openFiles) ? openFiles : [])
            .find((file) => file?.path === activeResult.path) ?? null;
          setPreviewState({
            loading: false,
            kind: activeResult.kind,
            path: activeResult.path,
            content: typeof liveFile?.content === 'string' ? liveFile.content : '',
            line: activeResult.line ?? 1,
            error: null,
          });
          return undefined;
        }
        let cancelled = false;
        const previewAbort = new AbortController();
        setPreviewState({
          loading: true,
          kind: activeResult.kind,
          path: activeResult.path,
          content: '',
          line: activeResult.line ?? 1,
          error: null,
        });
        callFs({ op: 'read', path: activeResult.path }, { signal: previewAbort.signal })
          .then((value) => {
            if (cancelled) return;
            setPreviewState({
              loading: false,
              kind: activeResult.kind,
              path: activeResult.path,
              content: value?.content ?? '',
              line: activeResult.line ?? 1,
              error: null,
            });
          })
          .catch((failure) => {
            if (cancelled) return;
            if (failure?.name === 'AbortError' || failure?.name === 'CanceledError') return;
            setPreviewState({
              loading: false,
              kind: activeResult.kind,
              path: activeResult.path,
              content: '',
              line: activeResult.line ?? 1,
              error: failure instanceof Error ? failure.message : String(failure),
            });
          });
        return () => {
          cancelled = true;
          previewAbort.abort();
        };
      }, [previewOpen, activeResult?.rowKey, activeResult?.dirty, openFiles]);
      React.useLayoutEffect(() => {
        if (
          previewOpen !== true
          || previewState.loading === true
          || previewState.error !== null
          || previewState.kind === null
          || previewState.kind === 'action'
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
          /* Layout effect centers before paint; the next frame rechecks metrics
             after ResizeObserver and soft-wrap layout settle. */
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
        previewState.kind,
        previewState.path,
        previewState.line,
        previewState.content,
        previewSoftWrap,
      ]);
      React.useEffect(() => {
        const active = listRef.current?.querySelector?.('[data-search-everywhere-active="1"]');
        active?.scrollIntoView?.({ block: 'nearest' });
      }, [activeIndex, effectiveTab, effectiveQuery]);
      React.useEffect(() => {
        if (state.index !== activeIndex) onMove(0, results.length, activeIndex);
      }, [state.index, activeIndex, results.length]);
      const cycleTab = (direction) => {
        const targetId = searchEverywhereTabTarget(
          tabs,
          effectiveTab,
          direction < 0 ? 'ArrowLeft' : 'ArrowRight',
        );
        if (targetId !== null) onTab(targetId);
      };
      const focusSearchTab = (tabId) => {
        const tab = [...(searchTabListRef.current?.querySelectorAll?.('[data-dsh-search-tab-id]') ?? [])]
          .find((candidate) => candidate.getAttribute('data-dsh-search-tab-id') === tabId);
        tab?.focus?.();
      };
      const handleSearchTabKeyDown = (event, tab) => {
        if (event.target !== event.currentTarget) return;
        const targetId = searchEverywhereTabTarget(tabs, effectiveTab, event.key);
        if (targetId === null) return;
        event.preventDefault();
        event.stopPropagation();
        onTab(targetId);
        window.setTimeout(() => focusSearchTab(targetId), 0);
      };
      const moveSearchSelection = (direction) => {
        const next = nextEnabledSearchResultIndex(results, activeIndex, direction);
        if (next !== null) onMove(0, results.length, next);
      };
      const activateResult = (result) => {
        if (result === null || result.disabled === true) return;
        if (result !== null && result.history !== true && result.rememberQuery !== false && effectiveQuery !== '') onRememberQuery(effectiveQuery);
        if (result.kind === 'action' && typeof result.id === 'string' && result.rememberCommand !== false) onRememberCommand(result.id);
        onActivate(result);
      };
      const openResultInfo = (result) => {
        const info = searchEverywhereItemInfo(result, t);
        if (info === null) return;
        clearResultTooltip();
        setResultMenu(null);
        setResultInfo(info);
      };
      const openResultMenuAt = (x, y, result) => {
        clearResultTooltip();
        if (result.kind === 'action') {
          setResultMenu({
            x,
            y,
            title: result.label ?? result.title,
            items: [{
              id: 'showInfo',
              label: t('editor.searchShowItemInfo'),
              run: () => openResultInfo(result),
            }],
          });
          return;
        }
        if (result.kind !== 'file' && result.kind !== 'text') return;
        setResultMenu({
          x,
          y,
          title: basename(result.path),
          items: searchResultContextItems({
            t,
            result,
            onCloseMenu: () => setResultMenu(null),
            onOpenEditor: () => activateResult(result),
            onOpenInRightSplit: () => {
              onClose();
              onOpenInRightSplit(
                result.path,
                result.kind === 'text' ? { path: result.path, line: result.line, column: result.column } : null,
              );
            },
            onReplace: () => openSearchResultsInFind('replace', result),
            onRevealResult: () => {
              onClose();
              onRevealResult(result.path);
            },
            onNotify,
            onShowInfo: () => openResultInfo(result),
          }),
        });
      };
      const openResultMenu = (event, result) => {
        if (result === null || typeof result !== 'object') return;
        event.preventDefault();
        event.stopPropagation();
        openResultMenuAt(event.clientX, event.clientY, result);
      };
      const openFilterAt = (event) => {
        const rect = event?.currentTarget?.getBoundingClientRect?.()
          ?? searchInputRef.current?.getBoundingClientRect?.();
        const right = rect?.right ?? Math.min(window.innerWidth - 4, 240);
        const bottom = rect?.bottom ?? 120;
        setFilterMenu((current) => (current === null
          ? { x: Math.max(4, right - 180), y: bottom + 4 }
          : null));
      };
      const openQueryHistoryMenuAt = React.useCallback((rect) => {
        const values = Array.isArray(recentSearches) ? recentSearches : [];
        setQueryHistoryMenu({
          x: rect.left,
          y: rect.bottom + 4,
          title: t('editor.findSearchHistory'),
          items: values.length === 0
            ? [{ id: 'empty', label: t('editor.findHistoryEmpty'), disabled: true, run: () => {} }]
            : values.map((value, index) => ({
                id: `query-history:${index}`,
                label: value,
                run: () => {
                  onQuery(value);
                  window.setTimeout(() => searchInputRef.current?.focus?.(), 0);
                },
              })),
        });
      }, [onQuery, recentSearches, t]);
      const openQueryHistoryMenu = (event) => {
        event.preventDefault();
        event.stopPropagation();
        openQueryHistoryMenuAt(event.currentTarget.getBoundingClientRect());
      };
      const openSearchHistoryShortcut = (event) => {
        if (!searchHistoryShortcutMatches(event)) return;
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('[data-dsh-search-query], [data-dsh-search-replace-input]') != null) return;
        event.preventDefault();
        event.stopPropagation();
        const rect = searchInputRef.current?.getBoundingClientRect?.();
        if (rect !== undefined && rect !== null) openQueryHistoryMenuAt(rect);
      };
      const trapSearchEverywhereFocus = (event) => {
        if (event.key !== 'Tab') return false;
        const root = event.currentTarget instanceof Element ? event.currentTarget : null;
        if (root === null) return false;
        const selector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), '
          + 'textarea:not([disabled]), [tabindex="0"]:not([disabled])';
        const focusables = [...new Set(root.querySelectorAll(selector))]
          .filter((element) => element.tabIndex >= 0 && (element.getClientRects?.().length ?? 0) > 0);
        const currentIndex = focusables.indexOf(document.activeElement);
        if (currentIndex < 0) return false;
        const nextIndex = searchEverywhereNextFocusIndex(
          focusables.length,
          currentIndex,
          event.shiftKey === true,
        );
        if (nextIndex === null) return false;
        event.preventDefault();
        event.stopPropagation();
        focusables[nextIndex]?.focus?.();
        return true;
      };
      const handleSearchEverywhereDialogKeyDown = (event) => {
        if (trapSearchEverywhereFocus(event)) return;
        if (event.key === 'Escape' && resultInfo !== null) {
          event.preventDefault();
          event.stopPropagation();
          closeResultInfo();
          return;
        }
        openSearchHistoryShortcut(event);
      };
      const handledHistoryRequestRef = React.useRef(0);
      React.useEffect(() => {
        const request = Number(historyRequest) || 0;
        if (request <= handledHistoryRequestRef.current) return;
        handledHistoryRequestRef.current = request;
        const rect = searchInputRef.current?.getBoundingClientRect?.();
        if (rect !== undefined && rect !== null) openQueryHistoryMenuAt(rect);
      }, [historyRequest, openQueryHistoryMenuAt]);
      const openFindUsagesHistoryMenuAt = React.useCallback((rect) => {
        const values = Array.isArray(recentFindUsages) ? recentFindUsages : [];
        setFindUsagesHistoryMenu({
          x: rect.left,
          y: rect.bottom + 4,
          title: t('editor.recentFindUsagesAction'),
          items: values.length === 0
            ? [{ id: 'empty', label: t('editor.recentFindUsagesEmpty'), disabled: true, run: () => {} }]
            : values.map((value, index) => ({
                id: `find-usages-history:${index}`,
                label: value,
                run: () => onOpenFindUsagesHistory(value),
              })),
        });
      }, [onOpenFindUsagesHistory, recentFindUsages, t]);
      const handledFindUsagesHistoryRequestRef = React.useRef(0);
      React.useEffect(() => {
        const request = Number(findUsagesHistoryRequest) || 0;
        if (request <= handledFindUsagesHistoryRequestRef.current) return;
        handledFindUsagesHistoryRequestRef.current = request;
        const rect = searchInputRef.current?.getBoundingClientRect?.();
        if (rect !== undefined && rect !== null) openFindUsagesHistoryMenuAt(rect);
      }, [findUsagesHistoryRequest, openFindUsagesHistoryMenuAt]);
      const openReplaceHistoryMenu = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        const values = Array.isArray(replaceHistory) ? replaceHistory : [];
        setReplaceHistoryMenu({
          x: rect.left,
          y: rect.bottom + 4,
          title: t('editor.findReplaceHistory'),
          items: values.length === 0
            ? [{ id: 'empty', label: t('editor.findHistoryEmpty'), disabled: true, run: () => {} }]
            : values.map((value, index) => ({
                id: `replace-history:${index}`,
                label: value,
                run: () => {
                  onReplaceChange(value);
                  window.setTimeout(() => replaceInputRef.current?.focus?.(), 0);
                },
              })),
        });
      };
      const handleSearchResultKeyDown = (event) => {
        if (event.key === 'Escape' && resultInfo !== null) {
          event.preventDefault();
          event.stopPropagation();
          closeResultInfo();
          return;
        }
        const macPlatform = isMacPlatform(navigator.userAgentData?.platform ?? navigator.platform);
        const groupDirection = searchEverywhereGroupNavigationDirection(event, macPlatform);
        if (groupDirection !== 0) {
          const nextGroup = searchEverywhereGroupTargetIndex(results, activeIndex, groupDirection);
          event.preventDefault();
          event.stopPropagation();
          if (nextGroup !== null) onMove(0, results.length, nextGroup);
          return;
        }
        if (
          (event.key === 'ContextMenu' || (event.shiftKey === true && event.key === 'F10'))
          && activeResult !== null
        ) {
          event.preventDefault();
          event.stopPropagation();
          const activeRow = listRef.current?.querySelector?.('[data-search-everywhere-active="1"]');
          const rect = activeRow?.getBoundingClientRect?.();
          openResultMenuAt(rect?.left ?? 20, rect?.bottom ?? 20, activeResult);
        } else if (event.key === 'ArrowDown') {
          event.preventDefault();
          moveSearchSelection(1);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          moveSearchSelection(-1);
        } else if (event.key === 'Enter') {
          event.preventDefault();
          if (activeResult !== null) activateResult(activeResult);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      };
      const openSearchResultsInFind = (mode = null, result = null, { refresh = false } = {}) => {
        const request = searchFindHandoff({
          query: effectiveQuery,
          files: fileMatches,
          matches: textResults,
          activeRowKey: (result ?? activeResult)?.rowKey,
          truncated: textTruncated,
          mode,
          withReplace: state.withReplace === true,
          caseSensitive: state.caseSensitive === true,
          wholeWords: state.wholeWords === true,
          regex: state.regex === true,
          preserveCase: state.preserveCase === true,
          includeExcluded: state.includeNonProject === true,
          fileMask: normalizeFileExtensionFilter(state.fileMask),
        });
        if (request.needsConfirmation && !window.confirm(t('editor.searchTooManyResults', {
          count: request.total,
        }))) return false;
        onOpenInFindToolWindow(refresh === true ? { ...request.request, refresh: true } : request.request);
        return true;
      };
      const openBlankReplaceInFiles = () => {
        onOpenInFindToolWindow({
          query: '',
          mode: 'replace',
          files: [],
          matches: [],
          index: 0,
          truncated: false,
          caseSensitive: state.caseSensitive === true,
          wholeWords: state.regex === true ? false : state.wholeWords === true,
          regex: state.regex === true,
          preserveCase: state.preserveCase === true,
          includeExcluded: state.includeNonProject === true,
          fileMask: normalizeFileExtensionFilter(state.fileMask),
        });
      };
      const replaceShortcut = (event) => {
        const meta = event?.metaKey === true || event?.ctrlKey === true;
        if (!meta || event?.altKey === true || event?.key?.toLowerCase?.() !== 'r') return;
        event.preventDefault();
        event.stopPropagation();
        if (event?.shiftKey === true) {
          openBlankReplaceInFiles();
          return;
        }
        if (fileMatches.length > 0 || textResults.length > 0) {
          openSearchResultsInFind('replace', activeResult);
          return;
        }
        openBlankReplaceInFiles();
      };
      const findActionShortcut = (event) => {
        const macPlatform = isMacPlatform(navigator.userAgentData?.platform ?? navigator.platform);
        if (!findActionShortcutMatches(event, macPlatform)) return;
        const host = document.querySelector('[data-dsh-editor-workspace]');
        if (host === null || !host.contains(document.activeElement)) return;
        event.preventDefault();
        event.stopPropagation();
        onQuery('');
        onTab('actions');
        window.setTimeout(() => searchInputRef.current?.focus?.(), 0);
      };
      React.useEffect(() => {
        const onKeyDown = (event) => replaceShortcut(event);
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
      }, [
        activeResult?.rowKey,
        fileMatches.length,
        state.caseSensitive,
        state.fileMask,
        state.preserveCase,
        state.regex,
        state.wholeWords,
        textResults.length,
      ]);
      React.useEffect(() => {
        const onKeyDown = (event) => findActionShortcut(event);
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
      }, [onQuery, onTab]);
      const headerActions = [
        {
          id: 'include',
          icon: 'project',
          label: t('editor.includeNonProjectItems'),
          active: state.includeNonProject === true,
          onClick: onToggleIncludeNonProject,
          group: 'scope',
        },
        {
          id: 'regex',
          icon: 'regex',
          label: t('editor.searchRegex'),
          active: state.regex === true,
          disabled: effectiveTab !== 'all' && effectiveTab !== 'text',
          onClick: onToggleRegex,
          group: 'filter',
        },
        ...(state.withReplace === true
          ? [{
              id: 'preserveCase',
              icon: 'preserveCase',
              label: t('editor.searchPreserveCase'),
              active: state.preserveCase === true,
              disabled: effectiveTab !== 'all' && effectiveTab !== 'text',
              onClick: onTogglePreserveCase,
              group: 'filter',
            }]
          : []),
        {
          id: 'preview',
          icon: 'preview',
          label: t('editor.searchPreview'),
          active: previewOpen,
          onClick: () => setPreviewOpen((value) => !value),
          group: 'view',
        },
        {
          id: 'filter',
          icon: 'filter',
          label: t('editor.searchFilter'),
          active: filterMenu !== null,
          onClick: openFilterAt,
          ariaHasPopup: 'menu',
          ariaExpanded: filterMenu !== null,
          group: 'view',
          pinned: true,
        },
        {
          id: 'openFind',
          icon: 'findWindow',
          label: t('editor.openInFindToolWindow'),
          disabled: effectiveQuery === '',
          onClick: () => openSearchResultsInFind(null, activeResult),
          group: 'view',
          pinned: true,
        },
        {
          id: 'case',
          icon: 'matchCase',
          label: t('editor.searchMatchCase'),
          active: state.caseSensitive === true,
          onClick: onToggleCaseSensitive,
          group: 'filter',
        },
        {
          id: 'words',
          icon: 'wholeWords',
          label: t('editor.searchWholeWords'),
          active: state.wholeWords === true,
          disabled: state.regex === true,
          onClick: onToggleWholeWords,
          group: 'filter',
        },
        {
          id: 'extension',
          icon: 'file',
          label: String(state.fileMask ?? '').trim() === ''
            ? t('editor.searchFileSuffixFilter')
            : `${t('editor.searchFileSuffixFilter')}: ${state.fileMask}`,
          active: String(state.fileMask ?? '').trim() !== '',
          disabled: effectiveTab === 'actions',
          onClick: () => {
            setFileMaskOpen((open) => !open);
            window.setTimeout(() => fileMaskInputRef.current?.focus?.(), 0);
          },
          group: 'filter',
        },
      ];
      return React.createElement(
        'div',
        {
          style: { ...styles.paletteBackdrop, paddingTop: '7vh' },
          onMouseDown: onClose,
          onKeyDown: handleSearchEverywhereDialogKeyDown,
          'data-dsh-search-everywhere': '',
        },
        React.createElement(
          'div',
          {
            style: { ...styles.palette, ...styles.searchEverywhere },
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': t('editor.searchEverywhere'),
            onMouseDown: (event) => event.stopPropagation(),
          },
          React.createElement(
            'div',
            { style: styles.searchEverywhereTabs },
            React.createElement(
              'div',
              {
                ref: searchTabListRef,
                role: 'tablist',
                className: 'dsh-editor-search-everywhere-tablist',
                'aria-label': t('editor.searchEverywhere'),
                style: {
                  display: 'flex',
                  alignItems: 'stretch',
                  gap: 22,
                  flex: '1 1 auto',
                  minWidth: 0,
                  height: '100%',
                  overflowX: 'auto',
                  scrollbarWidth: 'none',
                },
              },
              tabs.map((tab) => React.createElement(
                'button',
                {
                  key: tab.id,
                  type: 'button',
                  role: 'tab',
                  'aria-selected': effectiveTab === tab.id,
                  tabIndex: effectiveTab === tab.id ? 0 : -1,
                  'data-dsh-search-tab-id': tab.id,
                  className: 'dsh-editor-search-everywhere-tab',
                  style: {
                    ...styles.searchEverywhereTab,
                    ...(effectiveTab === tab.id ? styles.searchEverywhereTabActive : null),
                  },
                  onClick: (event) => {
                    event.currentTarget.focus?.();
                    onTab(tab.id);
                  },
                  onKeyDown: (event) => handleSearchTabKeyDown(event, tab),
                },
                tab.label,
              )),
            ),
          ),
          React.createElement(
            'div',
            { 'data-dsh-search-open-find-tool-window': '' },
            React.createElement(CompactActionBar, {
              actions: headerActions,
              t,
              ariaLabel: t('editor.searchEverywhere'),
              style: styles.searchEverywhereActionBar,
              slotWidth: 30,
            }),
          ),
          React.createElement(
            'div',
            { style: styles.searchEverywhereSearchRow },
            React.createElement(Icon, { name: 'search', size: 14 }),
            React.createElement('input', {
              ref: searchInputRef,
              style: styles.searchEverywhereInput,
              autoFocus: true,
              value: state.query,
              'data-dsh-search-query': '',
              placeholder: t('editor.searchEverywherePlaceholder'),
              'aria-label': t('editor.searchEverywherePlaceholder'),
              role: 'combobox',
              'aria-autocomplete': 'list',
              'aria-expanded': results.length > 0,
              'aria-controls': SEARCH_EVERYWHERE_LISTBOX_ID,
              'aria-activedescendant': activeResult === null ? undefined : searchEverywhereOptionId(activeResult.rowKey),
              onChange: (event) => {
                clearResultTooltip();
                onQuery(event.target.value);
              },
              onKeyDown: (event) => {
                if (event.altKey === true && event.key === 'ArrowDown') {
                  openQueryHistoryMenu(event);
                } else if (event.key === 'Tab') {
                  event.preventDefault();
                  event.stopPropagation();
                  cycleTab(event.shiftKey ? -1 : 1);
                } else handleSearchResultKeyDown(event);
              },
            }),
            React.createElement(ToolbarButton, {
              icon: 'history',
              label: t('editor.findSearchHistory'),
              ariaHasPopup: 'menu',
              ariaExpanded: queryHistoryMenu !== null,
              onClick: (event) => openQueryHistoryMenu(event),
            }),
            effectiveQuery === '' ? React.createElement('span', { style: styles.searchEverywhereHint }, t('editor.searchEverywhereHint')) : null,
          ),
          (effectiveTab === 'text' || effectiveTab === 'all')
            && (fileMaskOpen || String(state.fileMask ?? '').trim() !== '')
            ? React.createElement(
                'div',
                { style: styles.searchEverywhereSearchRow, 'data-search-file-mask': '' },
                React.createElement(Icon, { name: 'file', size: 13 }),
                React.createElement('input', {
                  ref: fileMaskInputRef,
                  'data-dsh-search-file-mask': '',
                  style: styles.searchEverywhereInput,
                  value: state.fileMask ?? '',
                  placeholder: t('editor.searchFileMask'),
                  'aria-label': t('editor.searchFileMask'),
                  onChange: (event) => onFileMaskChange(event.target.value),
                  onKeyDown: (event) => {
                    if (event.key !== 'Escape') return;
                    event.preventDefault();
                    event.stopPropagation();
                    if (String(state.fileMask ?? '').trim() === '') setFileMaskOpen(false);
                    searchInputRef.current?.focus?.();
                  },
                }),
              )
            : null,
          state.withReplace === true && (effectiveTab === 'text' || effectiveTab === 'all')
            ? React.createElement(
                'div',
                { style: styles.searchEverywhereReplaceRow },
                React.createElement(Icon, { name: 'code', size: 13 }),
                React.createElement('input', {
                  ref: replaceInputRef,
                  'data-dsh-search-replace-input': '',
                  style: styles.searchEverywhereInput,
                  value: state.replace,
                  placeholder: t('editor.searchReplacePlaceholder'),
                  'aria-label': t('editor.searchReplacePlaceholder'),
                  onChange: (event) => onReplaceChange(event.target.value),
                  onKeyDown: (event) => {
                    if (event.altKey === true && event.key === 'ArrowDown') {
                      openReplaceHistoryMenu(event);
                    } else if (event.key === 'Escape') {
                      event.preventDefault();
                      onClose();
                  } else if (
                    replaceInputAction(event, 'all') === 'all'
                    && !replaceBusy
                    && textResults.length > 0
                  ) {
                      event.preventDefault();
                      onReplaceAll();
                    }
                  },
                }),
                React.createElement(ToolbarButton, {
                  icon: 'history',
                  label: t('editor.findReplaceHistory'),
                  ariaHasPopup: 'menu',
                  ariaExpanded: replaceHistoryMenu !== null,
                  onClick: (event) => openReplaceHistoryMenu(event),
                }),
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    style: {
                      ...styles.conflictAction,
                      opacity: replaceBusy || textResults.length === 0 ? 0.45 : 1,
                    },
                    disabled: replaceBusy || textResults.length === 0,
                    onClick: onReplaceAll,
                  },
                  replaceBusy ? t('editor.loading') : t('editor.searchReplaceAll'),
                ),
              )
            : null,
          error !== null
            ? React.createElement('div', { style: styles.searchEverywhereError, role: 'alert' }, error)
            : null,
          resultInfo !== null
            ? React.createElement(
                'div',
                {
                  style: styles.searchEverywhereItemInfo,
                  role: 'status',
                  'aria-live': 'polite',
                  'data-dsh-search-item-info': '',
                },
                React.createElement(
                  'div',
                  { style: styles.searchEverywhereItemInfoHeader },
                  React.createElement('span', { style: styles.searchEverywhereItemInfoKind }, resultInfo.kind),
                  React.createElement('strong', { style: styles.searchEverywhereItemInfoTitle }, resultInfo.title),
                  React.createElement(
                    'button',
                    {
                      type: 'button',
                      ref: resultInfoCloseRef,
                      style: styles.searchEverywhereItemInfoClose,
                      'aria-label': t('editor.searchItemClose'),
                      onClick: closeResultInfo,
                    },
                    '×',
                  ),
                ),
                resultInfo.detail === ''
                  ? null
                  : React.createElement('div', { style: styles.searchEverywhereItemInfoDetail }, resultInfo.detail),
                resultInfo.meta === ''
                  ? null
                  : React.createElement('div', { style: styles.searchEverywhereItemInfoMeta }, resultInfo.meta),
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
            searchResultStatus,
          ),
          React.createElement(
            'div',
            {
              ref: listRef,
              id: SEARCH_EVERYWHERE_LISTBOX_ID,
              style: styles.searchEverywhereList,
              role: 'listbox',
              'aria-label': t('editor.searchEverywhere'),
              'aria-activedescendant': activeResult === null ? undefined : searchEverywhereOptionId(activeResult.rowKey),
              tabIndex: 0,
              onKeyDown: handleSearchResultKeyDown,
              onScroll: clearResultTooltip,
            },
            textLoading && effectiveTab !== 'actions'
              ? React.createElement('div', { style: styles.searchEverywhereMessage }, t('editor.loading'))
              : null,
            !textLoading && effectiveTab === 'text' && effectiveQuery.length > 0 && effectiveQuery.length < 2
              ? React.createElement('div', { style: styles.searchEverywhereMessage }, t('editor.searchTextHint'))
              : null,
            results.length === 0 && !textLoading && error === null
              ? React.createElement(
                  'div',
                  { style: styles.searchEverywhereMessage },
                  effectiveTab === 'text' && effectiveQuery.length < 2 ? t('editor.searchTextHint') : t('editor.searchNoMatches'),
                  showClearOptionsFallback ? React.createElement(
                    'div',
                    {
                      style: styles.searchEverywhereUsedOptions,
                      'data-dsh-search-used-options': '',
                    },
                    `${t('editor.searchOptionsUsed')} ${activeSearchOptionsText}`,
                  ) : null,
                  showScopeExpansionFallback ? React.createElement(
                    'button',
                    {
                      type: 'button',
                      className: 'dsh-editor-search-expand-scope',
                      style: styles.searchEverywhereInlineAction,
                      'data-dsh-search-expand-scope': '',
                      onClick: expandSearchScope,
                      onKeyDown: (event) => {
                        if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
                      },
                    },
                    t('editor.searchExpandScope'),
                  ) : null,
                  canResetSearchFilters ? React.createElement(
                    'button',
                    {
                      type: 'button',
                      className: 'dsh-editor-search-reset-filter',
                      style: styles.searchEverywhereInlineAction,
                      'data-dsh-search-reset-filter': '',
                      onClick: resetSearchFilters,
                      onKeyDown: (event) => {
                        if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
                      },
                    },
                    t('editor.searchResetFilters'),
                  ) : null,
                  showFindInFilesFallback ? React.createElement(
                    'button',
                    {
                      type: 'button',
                      className: 'dsh-editor-search-find-in-files',
                      style: styles.searchEverywhereInlineAction,
                      'data-dsh-search-find-in-files': '',
                      onClick: () => openSearchResultsInFind(null, null, { refresh: true }),
                      onKeyDown: (event) => {
                        if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
                      },
                    },
                    t('editor.searchFindInFilesFallback'),
                  ) : null,
                  showClearOptionsFallback ? React.createElement(
                    'button',
                    {
                      type: 'button',
                      className: 'dsh-editor-search-clear-options',
                      style: styles.searchEverywhereInlineAction,
                      'data-dsh-search-clear-options': '',
                      onClick: clearSearchOptions,
                      onKeyDown: (event) => {
                        if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
                      },
                    },
                    t('editor.searchClearAllOptions'),
                  ) : null,
                )
              : null,
            results.map((result, position) => {
              const isFile = result.kind === 'file' || result.kind === 'text';
              const badge = isFile ? badgeFor(result.path, changes) : null;
              const section = searchEverywhereSection(
                result,
                results[position - 1],
                effectiveQuery,
                effectiveTab,
                false,
              );
              const row = React.createElement(
                'div',
                {
                  key: result.rowKey,
                  id: searchEverywhereOptionId(result.rowKey),
                  role: 'option',
                  'aria-selected': position === activeIndex,
                  'aria-disabled': result.disabled === true,
                  'aria-description': result.kind === 'action' ? searchEverywhereResultTooltip(result) : undefined,
                  'aria-keyshortcuts': result.ariaKeyShortcuts,
                  'data-search-everywhere-active': position === activeIndex ? '1' : '0',
                  className: 'dsh-editor-search-everywhere-row',
                  style: {
                    ...styles.paletteRow,
                    ...styles.searchEverywhereRow,
                    ...(position === activeIndex ? styles.paletteRowActive : null),
                    ...(result.disabled === true ? { opacity: 0.45 } : null),
                  },
                  onMouseEnter: (event) => {
                    onMove(position - activeIndex, results.length, position);
                    scheduleResultTooltip(event, result);
                  },
                  onMouseLeave: clearResultTooltip,
                  onMouseDown: (event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    clearResultTooltip();
                    activateResult(result);
                  },
                  onContextMenu: (event) => openResultMenu(event, result),
                },
                React.createElement(Icon, { name: result.icon ?? 'settings', size: 13 }),
                isFile ? React.createElement(GitStatusBadge, { selected: false, info: badge }) : null,
                React.createElement(
                  'span',
                  { style: { ...styles.paletteName, flex: '1 1 auto' } },
                  result.title ?? result.label,
                ),
                React.createElement('span', { style: styles.searchEverywhereMeta }, result.subtitle ?? ''),
                result.category ? React.createElement(
                  'span',
                  {
                    className: 'dsh-editor-search-everywhere-category',
                    style: styles.searchEverywhereCategory,
                    title: result.category,
                    'data-dsh-search-category': '',
                  },
                  result.category,
                ) : null,
                result.shortcut ? React.createElement('span', { style: styles.searchEverywhereShortcut }, result.shortcut) : null,
              );
              return section === null
                ? row
                : React.createElement(
                    React.Fragment,
                    { key: `section:${section}:${result.rowKey}` },
                    React.createElement(
                      'div',
                      {
                        style: styles.searchEverywhereSection,
                        'data-search-everywhere-section': section,
                      },
                      section === 'recent'
                        ? t('editor.searchSectionRecent')
                        : t('editor.searchSectionActions'),
                    ),
                    row,
                  );
            }),
            textTruncated && effectiveTab !== 'actions'
              ? React.createElement(
                  'div',
                  {
                    style: styles.searchEverywhereMessage,
                    role: 'status',
                    'aria-live': 'polite',
                  },
                  t('editor.searchTextTruncated'),
                )
              : null,
          ),
          previewOpen
            ? React.createElement(
                'div',
                {
                  style: styles.searchEverywherePreview,
                  className: 'dsh-editor-search-preview',
                  'data-dsh-search-preview': '',
                },
                React.createElement(
                  'div',
                  { style: styles.searchEverywherePreviewToolbar },
                  React.createElement(Icon, { name: previewState.kind === 'action' ? 'settings' : 'file', size: 12 }),
                  React.createElement(
                    'span',
                    { style: styles.searchEverywherePreviewPath, title: previewState.path },
                    previewState.path || activeResult?.label || t('editor.searchPreview'),
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
                  previewState.loading
                    ? React.createElement('div', { style: styles.searchEverywhereMessage }, t('editor.loading'))
                    : null,
                  previewState.error !== null
                    ? React.createElement('div', { style: styles.searchEverywhereError, role: 'alert' }, previewState.error)
                    : null,
                  !previewState.loading && previewState.error === null && previewState.kind === 'action'
                    ? React.createElement('div', { style: { padding: '8px 12px' } }, previewState.content)
                    : null,
                  !previewState.loading && previewState.error === null && previewState.kind !== 'action'
                    ? React.createElement(
                        React.Fragment,
                        null,
                        previewWindow?.truncatedBefore
                          ? React.createElement('div', { style: styles.searchEverywhereMessage }, '…')
                          : null,
                        previewLines.length === 0
                          ? React.createElement('div', { style: styles.searchEverywhereMessage }, t('editor.searchPreviewEmpty'))
                          : previewLines.map((code, index) =>
                              React.createElement(
                                'div',
                                {
                                  key: previewWindow.start + index,
                                  'data-dsh-preview-line': previewWindow.start + index,
                                  className: 'dsh-editor-code-preview-line',
                                  style: {
                                    ...styles.searchEverywherePreviewLine,
                                    ...(previewState.kind === 'text' && previewWindow.start + index === previewState.line
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
                                    text: code,
                                    html: previewColorizedLines?.[index] ?? null,
                                    segments: null,
                                    style: {
                                      ...styles.searchEverywherePreviewCode,
                                      whiteSpace: previewSoftWrap ? 'pre-wrap' : 'pre',
                                      overflowWrap: previewSoftWrap ? 'anywhere' : 'normal',
                                    },
                                  },
                                ),
                              ),
                            ),
                        previewWindow?.truncatedAfter
                          ? React.createElement('div', { style: styles.searchEverywhereMessage }, '…')
                          : null,
                      )
                    : null,
                ),
              )
            : null,
          filterMenu === null
            ? null
            : React.createElement(ContextMenu, {
                t,
                onClose: closeFilterMenu,
                menu: {
                  ...filterMenu,
                  fallbackFocus: () => searchInputRef.current?.focus?.(),
                  title: t('editor.searchFilter'),
                  items: [
                    {
                      id: 'search-filter-files',
                      label: t('editor.searchTabFiles'),
                      active: searchFilters.files,
                      shortcut: searchFilters.files ? '✓' : '',
                      keepOpen: true,
                      run: () => setSearchFilters((current) => ({ ...current, files: !current.files })),
                    },
                    {
                      id: 'search-filter-text',
                      label: t('editor.searchTabText'),
                      active: searchFilters.text,
                      shortcut: searchFilters.text ? '✓' : '',
                      keepOpen: true,
                      run: () => setSearchFilters((current) => ({ ...current, text: !current.text })),
                    },
                    {
                      id: 'search-filter-actions',
                      label: t('editor.searchTabActions'),
                      active: searchFilters.actions,
                      shortcut: searchFilters.actions ? '✓' : '',
                      keepOpen: true,
                      run: () => setSearchFilters((current) => ({ ...current, actions: !current.actions })),
                    },
                  ],
                },
              }),
          queryHistoryMenu === null
            ? null
            : React.createElement(ContextMenu, {
                t,
                onClose: () => setQueryHistoryMenu(null),
                menu: {
                  ...queryHistoryMenu,
                  fallbackFocus: () => searchInputRef.current?.focus?.(),
                },
              }),
          findUsagesHistoryMenu === null
            ? null
            : React.createElement(ContextMenu, {
                t,
                onClose: () => setFindUsagesHistoryMenu(null),
                menu: {
                  ...findUsagesHistoryMenu,
                  fallbackFocus: () => searchInputRef.current?.focus?.(),
                },
              }),
          replaceHistoryMenu === null
            ? null
            : React.createElement(ContextMenu, {
                t,
                onClose: () => setReplaceHistoryMenu(null),
                menu: {
                  ...replaceHistoryMenu,
                  fallbackFocus: () => searchInputRef.current?.focus?.(),
                },
              }),
          resultMenu === null
            ? null
            : React.createElement(ContextMenu, {
                t,
                menu: {
                  ...resultMenu,
                  fallbackFocus: () => searchInputRef.current?.focus?.(),
                },
                onClose: () => setResultMenu(null),
              }),
          resultTooltip === null
            ? null
            : React.createElement(
                'div',
                {
                  role: 'tooltip',
                  'data-search-everywhere-tooltip': '',
                  style: {
                    ...styles.searchEverywhereTooltip,
                    left: resultTooltip.left,
                    top: resultTooltip.top,
                  },
                },
                resultTooltip.text,
              ),
        ),
      );
    }

/* search-everywhere.js: dsh-editor client module. Generated into lib/client.js by scripts/build-client.mjs. */

    function ShowUsagesPopup({
      t,
      state,
      onFilterChange,
      onMove,
      onOpen,
      onPin,
      onOpenInRightSplit,
      onRevealResult,
      onNotify,
      onClose,
    }) {
      const inputRef = React.useRef(null);
      const listRef = React.useRef(null);
      const [resultMenu, setResultMenu] = React.useState(null);
      const LISTBOX_ID = 'dsh-editor-show-usages-listbox';
      const matches = filterUsageMatches(state.matches, state.filter);
      const activeIndex = normalizeUsageMatchIndex(matches, state.index);
      const active = matches[activeIndex] ?? null;
      const status = state.loading === true
        ? t('editor.loading')
        : state.error !== null
          ? state.error
          : matches.length === 0
            ? t('editor.showUsagesEmpty')
            : t('editor.searchResultCount', { count: matches.length });
      React.useEffect(() => {
        inputRef.current?.focus?.();
      }, []);
      React.useEffect(() => {
        listRef.current
          ?.querySelector?.('[data-show-usages-active="1"]')
          ?.scrollIntoView?.({ block: 'nearest' });
      }, [activeIndex, state.filter, state.matches]);
      const move = (direction) => {
        if (matches.length === 0) return;
        onMove((activeIndex + direction + matches.length) % matches.length);
      };
      const openUsageMenuAt = (x, y, match) => {
        if (match === null || match === undefined) return;
        setResultMenu({
          x,
          y,
          title: basename(match.path),
          items: searchResultContextItems({
            t,
            result: { ...match, kind: 'text' },
            onCloseMenu: () => setResultMenu(null),
            onOpenEditor: () => onOpen(match),
            onOpenInRightSplit: () => {
              onClose();
              onOpenInRightSplit(match.path, {
                path: match.path,
                line: match.line,
                column: match.column,
              });
            },
            onRevealResult: () => {
              onClose();
              onRevealResult(match.path);
            },
            onNotify,
          }),
        });
      };
      const openUsageMenu = (event, match) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget?.focus?.();
        onMove(matches.indexOf(match));
        openUsageMenuAt(event.clientX, event.clientY, match);
      };
      const openActiveUsageMenu = () => {
        if (active === null) return;
        const rect = listRef.current
          ?.querySelector?.('[data-show-usages-active="1"]')
          ?.getBoundingClientRect?.();
        openUsageMenuAt(rect?.left ?? 20, rect?.bottom ?? 20, active);
      };
      const handleUsageKeyDown = (event) => {
        if (event.key === 'ContextMenu' || (event.shiftKey === true && event.key === 'F10')) {
          event.preventDefault();
          event.stopPropagation();
          openActiveUsageMenu();
          return;
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          move(1);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          move(-1);
        } else if (event.key === 'Enter') {
          event.preventDefault();
          if (active !== null) onOpen(active);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      };
      return React.createElement(
        'div',
        {
          style: { ...styles.paletteBackdrop, paddingTop: '8vh' },
          onMouseDown: onClose,
          'data-dsh-show-usages': '',
        },
        React.createElement(
          'div',
          {
            style: { ...styles.palette, ...styles.searchEverywhere },
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': t('editor.showUsagesTitle', { query: state.query }),
            onMouseDown: (event) => event.stopPropagation(),
          },
          React.createElement(
            'div',
            { style: styles.searchEverywhereSearchRow },
            React.createElement(Icon, { name: 'search', size: 13 }),
            React.createElement('input', {
              ref: inputRef,
              style: styles.searchEverywhereInput,
              value: state.filter,
              placeholder: t('editor.showUsagesFilterPlaceholder'),
              'aria-label': t('editor.showUsagesFilterPlaceholder'),
              role: 'combobox',
              'aria-autocomplete': 'list',
              'aria-controls': LISTBOX_ID,
              'aria-activedescendant': active === null ? undefined : searchEverywhereOptionId(usageMatchRowKey(active)),
              onChange: (event) => onFilterChange(event.target.value),
              onKeyDown: handleUsageKeyDown,
            }),
            React.createElement(ToolbarButton, {
              icon: 'findWindow',
              label: t('editor.openInFindToolWindow'),
              disabled: state.loading === true || state.matches.length === 0,
              onClick: onPin,
            }),
          ),
          React.createElement(
            'div',
            {
              role: 'status',
              'aria-live': 'polite',
              'aria-atomic': 'true',
              style: styles.screenReaderOnly,
            },
            status,
          ),
          state.loading === true
            ? React.createElement('div', { style: styles.findToolMessage }, t('editor.loading'))
            : state.error !== null
              ? React.createElement('div', { style: styles.searchEverywhereError, role: 'alert' }, state.error)
              : matches.length === 0
                ? React.createElement('div', { style: styles.findToolMessage }, t('editor.showUsagesEmpty'))
                : null,
          React.createElement(
            'div',
            {
              ref: listRef,
              id: LISTBOX_ID,
              role: 'listbox',
              'aria-label': t('editor.showUsagesTitle', { query: state.query }),
              'aria-activedescendant': active === null ? undefined : searchEverywhereOptionId(usageMatchRowKey(active)),
              style: styles.searchEverywhereList,
              tabIndex: 0,
              onKeyDown: handleUsageKeyDown,
            },
            matches.map((match, position) => React.createElement(
              'div',
              {
                key: usageMatchRowKey(match),
                id: searchEverywhereOptionId(usageMatchRowKey(match)),
                role: 'option',
                'aria-selected': position === activeIndex,
                'data-dsh-show-usages-option': '',
                'data-show-usages-active': position === activeIndex ? '1' : '0',
                style: {
                  ...styles.searchEverywhereRow,
                  background: position === activeIndex ? 'var(--dsw-alias-state-business-primary)' : 'transparent',
                  cursor: 'pointer',
                },
                tabIndex: position === activeIndex ? 0 : -1,
                onMouseEnter: () => onMove(position),
                onContextMenu: (event) => openUsageMenu(event, match),
                onClick: () => onOpen(match),
              },
              React.createElement(Icon, { name: 'file', size: 12 }),
              React.createElement(
                'span',
                {
                  style: {
                    flexShrink: 0,
                    maxWidth: '45%',
                    overflow: 'hidden',
                    color: 'var(--dsw-alias-label-primary)',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 11,
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
                },
                `${match.path}:${match.line}:${match.column}`,
              ),
              React.createElement(
                'span',
                {
                  style: {
                    minWidth: 0,
                    overflow: 'hidden',
                    color: 'var(--dsw-alias-label-secondary)',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
                },
                match.preview ?? '',
              ),
            )),
          ),
          resultMenu === null
            ? null
            : React.createElement(ContextMenu, {
                t,
                menu: resultMenu,
                onClose: () => setResultMenu(null),
              }),
        ),
      );
    }

    /**
     * IDEA's persistent Find tool window.
     *
     * Search Everywhere is a transient chooser. Once the user asks to keep the
     * result set, IDEA moves it into a tool window where occurrences can be
     * walked and opened without reopening the modal. This component follows the
     * same model using the host's existing bounded text-search results.
     * @param {object} props - query state, results and callbacks.
     * @returns {object} persistent bottom tool window.
     */
