/* find-tool.js: dsh-editor client module. Generated into lib/client.js by scripts/build-client.mjs. */
    /**
     * Choose the row to select after one occurrence was replaced.
     *
     * If the replacement still matches the query, the replaced row remains in
     * the refreshed list at the same identity. Skip that row once and continue
     * to the following occurrence. If it no longer matches, the fallback index
     * already points at the next original occurrence.
     * @param {object[]} occurrences - current visible result rows.
     * @param {string} replacedRowKey - row identity captured before replacement.
     * @param {number} fallbackIndex - prior active row index.
     * @returns {number} row index to select.
     */
    function findToolReplaceAdvanceIndex(occurrences, replacedRowKey, fallbackIndex) {
      const rows = Array.isArray(occurrences) ? occurrences : [];
      if (rows.length === 0) return 0;
      const replacedIndex = typeof replacedRowKey === 'string'
        ? rows.findIndex((row) => row?.rowKey === replacedRowKey)
        : -1;
      if (replacedIndex >= 0) return (replacedIndex + 1) % rows.length;
      const requested = Math.trunc(Number(fallbackIndex) || 0);
      return Math.max(0, Math.min(rows.length - 1, requested));
    }

    /**
     * Resolve IDEA's empty-result search-option clearing shortcuts.
     *
     * IDEA offers Ctrl+C/W/X for the three boolean filters and
     * Alt+Shift+Backspace for all used options. The caller additionally
     * requires an idle query caret so normal text copying is never stolen.
     * @param {KeyboardEvent|object} event - current keydown.
     * @returns {'case'|'words'|'regex'|'clear'|null} action to clear.
     */
    function findSearchOptionShortcutAction(event) {
      if (event === null || typeof event !== 'object' || event.isComposing === true) return null;
      if (event.altKey === true && event.shiftKey === true
        && event.metaKey !== true && event.ctrlKey !== true
        && event.key === 'Backspace') return 'clear';
      if (event.ctrlKey !== true || event.metaKey === true || event.altKey === true || event.shiftKey === true) return null;
      const key = String(event.key ?? '').toLowerCase();
      if (key === 'c') return 'case';
      if (key === 'w') return 'words';
      if (key === 'x') return 'regex';
      return null;
    }

    /** Create one browser-local Scope identity without requiring crypto.randomUUID. */
    function newFindScopeId() {
      return `scope-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }

    /**
     * IDEA's Edit Scopes dialog, bounded to local named scopes.
     *
     * Includes/excludes are workspace-relative globs. The component edits a
     * detached copy so Cancel cannot mutate the active Find scope list.
     */
    function FindScopeEditor({ t, scopes, initialId, onSave, onClose }) {
      const initialDrafts = React.useMemo(() => {
        const normalized = normalizeCustomFindScopes(scopes);
        return normalized.length === 0
          ? [{ id: newFindScopeId(), name: t('editor.findScopeNewName'), includePatterns: [], excludePatterns: [], shared: false }]
          : normalized;
      }, [scopes, t]);
      const [drafts, setDrafts] = React.useState(initialDrafts);
      const [selectedId, setSelectedId] = React.useState(() =>
        initialDrafts.some((scope) => scope.id === initialId) ? initialId : initialDrafts[0]?.id ?? null);
      const [error, setError] = React.useState(null);
      const [transfer, setTransfer] = React.useState(null);
      const selectedIndex = drafts.findIndex((scope) => scope.id === selectedId);
      const selected = selectedIndex < 0 ? null : drafts[selectedIndex];
      const updateSelected = (patch) => {
        setDrafts((current) => current.map((scope) => scope.id === selectedId ? { ...scope, ...patch } : scope));
        setError(null);
      };
      const addScope = () => {
        const scope = {
          id: newFindScopeId(),
          name: t('editor.findScopeNewName'),
          includePatterns: [],
          excludePatterns: [],
          shared: false,
        };
        setDrafts((current) => [...current, scope]);
        setSelectedId(scope.id);
        setError(null);
      };
      const duplicateSelected = () => {
        if (selected === null) return;
        const copy = {
          ...selected,
          id: newFindScopeId(),
          name: t('editor.findScopeCopyName', { name: selected.name }),
          includePatterns: [...selected.includePatterns],
          excludePatterns: [...selected.excludePatterns],
        };
        setDrafts((current) => [...current, copy]);
        setSelectedId(copy.id);
      };
      const removeSelected = () => {
        if (selected === null) return;
        const next = drafts.filter((scope) => scope.id !== selected.id);
        setDrafts(next);
        setSelectedId(next[Math.max(0, selectedIndex - 1)]?.id ?? null);
      };
      const moveSelected = (delta) => {
        if (selected === null) return;
        const targetIndex = selectedIndex + delta;
        if (targetIndex < 0 || targetIndex >= drafts.length) return;
        const next = [...drafts];
        [next[selectedIndex], next[targetIndex]] = [next[targetIndex], next[selectedIndex]];
        setDrafts(next);
      };
      const commit = () => {
        const normalized = normalizeCustomFindScopes(drafts);
        if (normalized.some((scope) => scope.name.trim() === '')) {
          setError(t('editor.findScopeNameRequired'));
          return;
        }
        const names = normalized.map((scope) => scope.name.toLocaleLowerCase());
        if (new Set(names).size !== names.length) {
          setError(t('editor.findScopeDuplicateName'));
          return;
        }
        onSave(normalized, selectedId);
        onClose();
      };
      const openTransfer = (mode) => {
        setTransfer({
          mode,
          path: '.idea/scopes/dsh-editor.xml',
          loading: false,
          error: null,
          scopes: null,
          skipped: 0,
          conflicts: 0,
          xml: '',
        });
      };
      const previewTransfer = async () => {
        if (transfer === null || transfer.loading === true) return;
        const path = normalizeScopeXmlTransferPath(transfer.path);
        if (path === '') {
          setTransfer((current) => current === null ? current : { ...current, error: t('editor.findScopeXmlInvalidPath') });
          return;
        }
        setTransfer((current) => current === null ? current : { ...current, loading: true, error: null });
        if (transfer.mode === 'import') {
          try {
            const value = await callFs({ op: 'read', path });
            if (typeof value?.content !== 'string' || value.content.length > 256 * 1024) {
              throw new Error(t('editor.findScopeXmlTooLarge'));
            }
            const report = inspectIdeaScopeXml(value.content);
            const existingNames = new Set(drafts.map((scope) => scope.name.toLocaleLowerCase()));
            const conflicts = report.scopes.filter((scope) => existingNames.has(scope.name.toLocaleLowerCase())).length;
            setTransfer((current) => current === null ? current : {
              ...current,
              path,
              loading: false,
              error: null,
              scopes: report.scopes,
              skipped: report.skipped,
              conflicts,
            });
          } catch (failure) {
            setTransfer((current) => current === null ? current : {
              ...current,
              loading: false,
              error: failure instanceof Error ? failure.message : String(failure),
            });
          }
          return;
        }
        const sharedScopes = drafts.filter((scope) => scope.shared === true);
        if (sharedScopes.length === 0) {
          setTransfer((current) => current === null ? current : {
            ...current,
            loading: false,
            error: t('editor.findScopeXmlNoShared'),
          });
          return;
        }
        setTransfer((current) => current === null ? current : {
          ...current,
          path,
          loading: false,
          error: null,
          scopes: sharedScopes,
          skipped: 0,
          conflicts: 0,
          xml: serializeIdeaScopeXml(sharedScopes),
        });
      };
      const applyTransfer = async () => {
        if (transfer === null || Array.isArray(transfer.scopes) === false) return;
        if (transfer.mode === 'import') {
          const imported = transfer.scopes;
          const next = [...drafts];
          for (const scope of imported) {
            const index = next.findIndex((entry) => entry.name.toLocaleLowerCase() === scope.name.toLocaleLowerCase());
            if (index >= 0) next[index] = scope;
            else next.push(scope);
          }
          const normalized = normalizeCustomFindScopes(next);
          setDrafts(normalized);
          setSelectedId(imported[0]?.id ?? selectedId);
          setTransfer(null);
          setError(null);
          return;
        }
        const path = normalizeScopeXmlTransferPath(transfer.path);
        if (path === '') {
          setTransfer((current) => current === null ? current : { ...current, error: t('editor.findScopeXmlInvalidPath') });
          return;
        }
        setTransfer((current) => current === null ? current : { ...current, loading: true, error: null });
        try {
          await callFs({ op: 'write', path, content: transfer.xml, force: true, create: true });
          setTransfer(null);
        } catch (failure) {
          setTransfer((current) => current === null ? current : {
            ...current,
            loading: false,
            error: failure instanceof Error ? failure.message : String(failure),
          });
        }
      };
      const transferPanel = transfer === null
        ? null
        : React.createElement(
            'div',
            { style: { display: 'grid', gap: 10 }, 'data-dsh-find-scope-transfer': transfer.mode },
            React.createElement('div', { style: { fontWeight: 600 } }, t(transfer.mode === 'import' ? 'editor.findScopeImportTitle' : 'editor.findScopeExportTitle')),
            React.createElement('label', { style: { display: 'grid', gap: 4 } },
              React.createElement('span', null, t('editor.findScopeXmlPath')),
              React.createElement('input', {
                style: styles.findInput,
                value: transfer.path,
                placeholder: '.idea/scopes/dsh-editor.xml',
                'aria-label': t('editor.findScopeXmlPath'),
                onChange: (event) => setTransfer((current) => current === null ? current : {
                  ...current,
                  path: event.target.value,
                  scopes: null,
                  xml: '',
                  error: null,
                }),
              }),
            ),
            transfer.scopes === null
              ? null
              : React.createElement('div', { style: { color: 'var(--dsw-alias-label-secondary)' } },
                  t('editor.findScopeXmlPreview', {
                    count: transfer.scopes.length,
                    skipped: transfer.skipped,
                    conflicts: transfer.conflicts,
                  })),
            transfer.mode === 'export' && transfer.xml !== ''
              ? React.createElement('pre', {
                  style: {
                    maxHeight: 150,
                    overflow: 'auto',
                    margin: 0,
                    padding: 8,
                    background: 'var(--dsw-alias-bg-l2)',
                    borderRadius: 3,
                    fontSize: 11,
                  },
                }, transfer.xml)
              : null,
            transfer.error === null ? null : React.createElement('div', { role: 'alert', style: styles.searchEverywhereError }, transfer.error),
            React.createElement('div', { style: { display: 'flex', gap: 8 } },
              React.createElement('button', {
                type: 'button',
                style: styles.conflictAction,
                disabled: transfer.loading === true,
                onClick: () => void previewTransfer(),
              }, t('editor.findScopeXmlPreviewAction')),
              transfer.scopes === null
                ? null
                : React.createElement('button', {
                    type: 'button',
                    style: { ...styles.conflictAction, fontWeight: 600 },
                    disabled: transfer.loading === true || transfer.scopes.length === 0,
                    onClick: () => void applyTransfer(),
                  }, t(transfer.mode === 'import' ? 'editor.findScopeImportAction' : 'editor.findScopeExportAction')),
              React.createElement('button', {
                type: 'button',
                style: styles.conflictAction,
                onClick: () => setTransfer(null),
              }, t('editor.cancel')),
            ),
          );
      return React.createElement(
        'div',
        {
          style: {
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(0,0,0,0.28)',
          },
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) onClose();
          },
          'data-dsh-find-scope-editor': '',
        },
        React.createElement(
          'div',
          {
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': t('editor.findEditScopes'),
            style: {
              width: 'min(720px, calc(100vw - 32px))',
              height: 'min(520px, calc(100vh - 32px))',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--dsw-alias-bg-l1)',
              color: 'var(--dsw-alias-label-primary)',
              border: '1px solid var(--dsw-alias-border-l2)',
              borderRadius: 6,
              boxShadow: '0 18px 50px rgba(0,0,0,0.28)',
              overflow: 'hidden',
            },
            onKeyDown: (event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              }
            },
          },
          React.createElement(
            'div',
            { style: { padding: '10px 12px', borderBottom: '1px solid var(--dsw-alias-border-l2)', fontWeight: 600 } },
            t('editor.findScopesTitle'),
          ),
          React.createElement(
            'div',
            { style: { display: 'flex', minHeight: 0, flex: '1 1 auto' } },
            React.createElement(
              'div',
              {
                style: {
                  width: 230,
                  flex: '0 0 auto',
                  borderRight: '1px solid var(--dsw-alias-border-l2)',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                },
              },
              React.createElement(
                'div',
                { style: { display: 'flex', gap: 2, padding: 6, borderBottom: '1px solid var(--dsw-alias-border-l2)' } },
                React.createElement(ToolbarButton, { icon: 'newFolder', label: t('editor.findAddScope'), onClick: addScope }),
                React.createElement(ToolbarButton, { icon: 'file', label: t('editor.findCopyScope'), disabled: selected === null, onClick: duplicateSelected }),
                React.createElement(ToolbarButton, { icon: 'close', label: t('editor.findDeleteScope'), disabled: selected === null, onClick: removeSelected }),
                React.createElement(ToolbarButton, { icon: 'chevronUp', label: t('editor.findScopeMoveUp'), disabled: selectedIndex <= 0, onClick: () => moveSelected(-1) }),
                React.createElement(ToolbarButton, { icon: 'chevronDown', label: t('editor.findScopeMoveDown'), disabled: selectedIndex < 0 || selectedIndex >= drafts.length - 1, onClick: () => moveSelected(1) }),
              ),
              React.createElement(
                'div',
                { style: { display: 'flex', gap: 2, padding: '2px 6px 6px', borderBottom: '1px solid var(--dsw-alias-border-l2)' } },
                React.createElement(ToolbarButton, { icon: 'file', label: t('editor.findScopeImport'), onClick: () => openTransfer('import') }),
                React.createElement(ToolbarButton, { icon: 'patchExport', label: t('editor.findScopeExport'), onClick: () => openTransfer('export') }),
              ),
              React.createElement(
                'div',
                { role: 'listbox', 'aria-label': t('editor.findScopesTitle'), style: { overflow: 'auto', padding: 4 } },
                drafts.map((scope) => React.createElement(
                  'button',
                  {
                    key: scope.id,
                    type: 'button',
                    role: 'option',
                    'aria-selected': scope.id === selectedId,
                    style: {
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 7px',
                      border: 'none',
                      borderRadius: 3,
                      background: scope.id === selectedId ? 'var(--dsw-alias-state-business-primary)' : 'transparent',
                      color: scope.id === selectedId ? '#fff' : 'inherit',
                      textAlign: 'left',
                      cursor: 'pointer',
                    },
                    onClick: () => setSelectedId(scope.id),
                  },
                  React.createElement(Icon, { name: 'folder', size: 13 }),
                  React.createElement('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, scope.name),
                  scope.shared === true
                    ? React.createElement('span', { style: { marginLeft: 'auto', fontSize: 10, opacity: 0.8 } }, t('editor.findScopeSharedBadge'))
                    : null,
                )),
              ),
            ),
            React.createElement(
              'div',
              { style: { flex: '1 1 auto', minWidth: 0, overflow: 'auto', padding: 12 } },
              transfer !== null
                ? transferPanel
                : selected === null
                ? React.createElement('div', { style: styles.treeMessage }, t('editor.findScopeSelectPrompt'))
                : React.createElement(
                    React.Fragment,
                    null,
                    React.createElement('label', { style: { display: 'grid', gap: 4, marginBottom: 12 } },
                      React.createElement('span', null, t('editor.findScopeName')),
                      React.createElement('input', {
                        style: styles.findInput,
                        value: selected.name,
                        maxLength: 80,
                        autoFocus: true,
                        'aria-label': t('editor.findScopeName'),
                        onChange: (event) => updateSelected({ name: event.target.value }),
                      }),
                    ),
                    React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 } },
                      React.createElement('input', {
                        type: 'checkbox',
                        checked: selected.shared === true,
                        onChange: (event) => updateSelected({ shared: event.target.checked }),
                      }),
                      React.createElement('span', null, t('editor.findScopeShare')),
                    ),
                    React.createElement('label', { style: { display: 'grid', gap: 4, marginBottom: 12 } },
                      React.createElement('span', null, t('editor.findScopeInclude')),
                      React.createElement('textarea', {
                        style: { ...styles.findInput, minHeight: 96, resize: 'vertical', fontFamily: 'monospace' },
                        value: selected.includePatterns.join('\n'),
                        placeholder: t('editor.findScopePatternPlaceholder'),
                        'aria-label': t('editor.findScopeInclude'),
                        onChange: (event) => updateSelected({ includePatterns: event.target.value.split('\n') }),
                      }),
                    ),
                    React.createElement('label', { style: { display: 'grid', gap: 4, marginBottom: 8 } },
                      React.createElement('span', null, t('editor.findScopeExclude')),
                      React.createElement('textarea', {
                        style: { ...styles.findInput, minHeight: 96, resize: 'vertical', fontFamily: 'monospace' },
                        value: selected.excludePatterns.join('\n'),
                        placeholder: t('editor.findScopePatternPlaceholder'),
                        'aria-label': t('editor.findScopeExclude'),
                        onChange: (event) => updateSelected({ excludePatterns: event.target.value.split('\n') }),
                      }),
                    ),
                    React.createElement('div', { style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 11 } }, t('editor.findScopePatternsHelp')),
                  ),
              error === null ? null : React.createElement('div', { role: 'alert', style: { ...styles.searchEverywhereError, marginTop: 8 } }, error),
            ),
          ),
          React.createElement(
            'div',
            { style: { display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '8px 12px', borderTop: '1px solid var(--dsw-alias-border-l2)' } },
            React.createElement('button', { type: 'button', style: styles.conflictAction, onClick: onClose }, t('editor.cancel')),
            React.createElement('button', { type: 'button', style: { ...styles.conflictAction, fontWeight: 600 }, onClick: commit }, t('editor.ok')),
          ),
        ),
      );
    }

    const FIND_POPUP_RESIZE_DIRECTIONS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

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
        callFs({ op: 'read', path: active.path })
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

    /**
     * Locate a whole-word occurrence using Unicode letter/number boundaries.
     * @param {string} value - candidate text.
     * @param {string} needle - query.
     * @param {boolean} [caseSensitive=false] - preserve case.
     * @returns {number} zero-based offset, or -1.
     */
    function wholeWordIndex(value, needle, caseSensitive = false) {
      if (typeof value !== 'string' || typeof needle !== 'string' || needle === '') return -1;
      const escaped = needle.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
      const expression = new RegExp(`(?:^|[^\\p{L}\\p{N}_])(${escaped})(?=$|[^\\p{L}\\p{N}_])`, caseSensitive ? 'u' : 'iu');
      const match = expression.exec(value);
      if (match === null) return -1;
      return match.index + match[0].lastIndexOf(match[1]);
    }

    /**
     * Normalize a user extension filter into IDEA-compatible file masks.
     * `ts, .md` becomes `*.ts,*.md`; explicit glob/path masks are preserved.
     * @param {unknown} value - extension-list input.
     * @returns {string} canonical comma-separated masks.
     */
    function normalizeFileExtensionFilter(value) {
      const text = typeof value === 'string' ? value.trim() : '';
      if (text === '') return '';
      return text.split(',').map((part) => {
        const token = part.trim();
        if (token === '') return '';
        const negative = token.startsWith('!');
        const body = (negative ? token.slice(1) : token).trim();
        if (body === '') return '';
        const explicitMask = body.includes('/') || body.includes('*') || body.includes('?');
        const normalized = explicitMask ? body : `*.${body.replace(/^\./u, '')}`;
        return `${negative ? '!' : ''}${normalized}`;
      }).filter(Boolean).join(',');
    }

    /**
     * Match one path against the simple extension/mask list shown by Search
     * Everywhere. Negative masks win; positive masks form an allow-list.
     * @param {string} path - workspace-relative path.
     * @param {unknown} filter - extension/mask list.
     * @returns {boolean} whether the path participates in the search.
     */
    function fileExtensionFilterMatches(path, filter) {
      const masks = normalizeFileExtensionFilter(filter).split(',').filter(Boolean);
      if (masks.length === 0) return true;
      let hasPositive = false;
      let positiveMatch = false;
      for (const raw of masks) {
        const negative = raw.startsWith('!');
        const pattern = negative ? raw.slice(1) : raw;
        const target = pattern.includes('/') ? path : basename(path);
        let source = '';
        for (let index = 0; index < pattern.length; index += 1) {
          const character = pattern[index];
          if (character === '*') {
            if (pattern[index + 1] === '*') {
              source += '.*';
              index += 1;
            } else {
              source += '[^/]*';
            }
          } else if (character === '?') {
            source += '[^/]';
          } else {
            source += character.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
          }
        }
        const matched = new RegExp(`^${source}$`, 'iu').test(target);
        if (negative && matched) return false;
        if (!negative) {
          hasPositive = true;
          if (matched) positiveMatch = true;
        }
      }
      return hasPositive ? positiveMatch : true;
    }

    /** Match one workspace path against one custom Scope glob. */
    function findScopeGlobMatches(path, rawPattern) {
      let pattern = typeof rawPattern === 'string' ? rawPattern.trim().replaceAll('\\', '/') : '';
      if (pattern === '') return false;
      pattern = pattern.replace(/^file:/u, '').replace(/^\.\/+/u, '').replace(/\/+$/u, '');
      pattern = pattern.replace(/\/\/\*$/u, '/**');
      if (pattern === '') return true;
      const name = path.slice(path.lastIndexOf('/') + 1);
      const hasGlob = pattern.includes('*') || pattern.includes('?');
      if (!hasGlob && !pattern.includes('/')) {
        return path === pattern || path.startsWith(`${pattern}/`) || name === pattern;
      }
      const target = pattern.includes('/') ? path : name;
      let source = '';
      for (let index = 0; index < pattern.length; index += 1) {
        const character = pattern[index];
        if (character === '*') {
          if (pattern[index + 1] === '*') {
            source += '.*';
            index += 1;
          } else {
            source += '[^/]*';
          }
        } else if (character === '?') {
          source += '[^/]';
        } else {
          source += character.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
        }
      }
      return new RegExp(`^${source}$`, 'iu').test(target);
    }

    /** Include globs are ORed; any exclude glob wins. */
    function findScopePatternsMatch(path, includePatterns, excludePatterns) {
      if (typeof path !== 'string' || path === '') return false;
      const includes = normalizeFindScopePatterns(includePatterns);
      const excludes = normalizeFindScopePatterns(excludePatterns);
      if (includes.length > 0 && !includes.some((pattern) => findScopeGlobMatches(path, pattern))) return false;
      return !excludes.some((pattern) => findScopeGlobMatches(path, pattern));
    }

    /**
     * Subsequence match score, higher is better; -1 means no match.
     * @param {string} path - candidate path.
     * @param {string} query - typed query.
     * @param {{caseSensitive?: boolean, wholeWords?: boolean}} [options] - match options.
     * @returns {number} score.
     */
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

    /**
     * Assign one lane per commit by walking parents, so lines actually connect.
     *
     * A commit inherits the lane of the child that first references it; when a
     * commit has several children the lane stays with the newest child and extra
     * parents open fresh lanes. This is the layout step (pure, testable); drawing
     * is separate so the geometry can be asserted without a DOM.
     * @param {Array<{hash: string, parents: string[]}>} entries - commits, newest first.
     * @returns {{laneOf: Map<string, number>, laneCount: number}} lane assignment.
     */
    /**
     * Group consecutive commits that share one lane and no branch point.
     *
     * IDEA's graph can squeeze "nothing else is alive here" stretches into a
     * single row. The unit is a RUN, not a lane: a run ends at a merge or where
     * another lane starts, so folding never hides a fork or a branch tip.
     * @param {object[]} entries - commits in walk order.
     * @param {Map<string, number>} laneOf - lane per commit from assignGraphLanes.
     * @returns {Array<{hashes: string[], lane: number, merge: boolean, first: object}>} runs.
     */
    function linearRun(entries, laneOf) {
      const runs = [];
      for (const entry of entries) {
        const lane = laneOf.get(entry.hash) ?? 0;
        const merge = (entry.parents?.length ?? 0) > 1;
        const previous = runs[runs.length - 1];
        /* A run continues only while the lane is unchanged and neither row merges. */
        if (previous !== undefined && previous.lane === lane && previous.merge === false && merge === false) {
          previous.hashes.push(entry.hash);
          continue;
        }
        runs.push({ hashes: [entry.hash], lane, merge, first: entry });
      }
      return runs;
    }

    function assignGraphLanes(entries) {
      const laneOf = new Map();
      let laneCount = 0;
      /* Pass 1: every commit inherits its lane from its first child, so a branch's
         own history stays on one line. Tips get a lane as they are encountered. */
      for (const entry of entries) {
        if (!laneOf.has(entry.hash)) laneOf.set(entry.hash, laneCount++);
        const lane = laneOf.get(entry.hash);
        const first = entry.parents[0];
        if (first !== undefined && !laneOf.has(first)) laneOf.set(first, lane);
      }
      /* Pass 2: merge parents that pass 1 never reached open a forked lane. */
      for (const entry of entries) {
        for (const parent of entry.parents.slice(1)) {
          if (!laneOf.has(parent)) laneOf.set(parent, laneCount++);
        }
      }
      return { laneOf, laneCount };
    }

    /**
     * Commits represented by the graph rows currently on screen.
     *
     * Expanded mode renders every commit. Folded mode renders one representative
     * per run, so keyboard cursor and context-menu navigation must use this list
     * rather than the full graph payload.
     * @param {object[]|null} entries - graph commits.
     * @param {boolean} folded - whether linear runs are collapsed.
     * @returns {object[]} entries represented by visible graph rows.
     */
    function graphDisplayEntries(entries, folded) {
      const list = Array.isArray(entries) ? entries : [];
      if (folded !== true) return list;
      return linearRun(list, assignGraphLanes(list).laneOf).map((run) => run.first);
    }

    /**
     * IDEA's commit graph: lanes that connect parent to child, plus ref badges.
     *
     * Each row draws its own lane marker and connector stubs for every parent it
     * has, so a fork reads as a fork instead of mere indentation.
     * @param {{t: Function, graph: object|null, onShow: Function, selected: string|null, onSelect: Function, folded: boolean, onToggleFolded: Function, onContextMenu?: Function}} props - graph data.
     * @returns {object} the graph rows.
     */
    function CommitGraph({ t, graph, onShow, selected, selectionHashes = [], onRowClick, onSelect, folded, onToggleFolded, onPickRef, onContextMenu }) {
      const entries = graph?.entries ?? [];
      if (graph === null) return React.createElement('div', { style: styles.treeMessage }, t('editor.loading'));
      if (entries.length === 0) {
        /* An empty page means three different things: no commits at all, a branch
           filter that matched nothing, and a tag pointing outside the walk. */
        return React.createElement(
          'div',
          { style: styles.treeMessage },
          typeof graph?.branch === 'string' && graph.branch !== ''
            ? t('editor.graphNoCommitsOnBranch')
            : typeof graph?.at === 'string' && graph.at !== ''
              ? t('editor.graphNoCommitsOnRef')
              : t('editor.noCommits'),
        );
      }
      const lanes = assignGraphLanes(entries);
      const laneOf = lanes.laneOf;
      const head = typeof graph?.head === 'string' ? graph.head : null;
      /* Folding is opt-in: IDEA keeps the full graph by default too, and a folded
         row that hid a branch point would be worse than a long list. */
      const runs = linearRun(entries, laneOf);
      const rowsToDraw = folded ? runs : entries.map((entry) => ({ hashes: [entry.hash], lane: laneOf.get(entry.hash) ?? 0, merge: entry.parents.length > 1, first: entry }));
      return React.createElement(
        'div',
        {
          style: styles.commitGraph,
          role: 'listbox',
          'aria-label': t('editor.logGraph'),
          /* Leaving the list clears the hover, otherwise the last row the pointer
             crossed stays tinted while the keyboard cursor is somewhere else. */
          onMouseLeave: () => onSelect?.(null),
        },
        React.createElement(
          'div',
          { style: styles.graphFoldRow },
          React.createElement(
            'button',
            {
              type: 'button',
              style: { ...styles.graphFoldToggle, ...(folded ? styles.graphFoldToggleOn : null) },
              'aria-pressed': folded,
              title: t('editor.graphFoldChains'),
              onClick: onToggleFolded,
            },
            t('editor.graphFoldChains'),
          ),
          folded
            ? React.createElement('span', { style: styles.graphFoldCount }, t('editor.graphFoldedCount', { count: rowsToDraw.length }))
            : null,
        ),
        rowsToDraw.map((run) => {
          const entry = run.first;
          const collapsed = run.hashes.length > 1;
          const lane = laneOf.get(entry.hash) ?? 0;
          const isMerge = entry.parents.length > 1;
          const active = selected === entry.hash || selectionHashes.includes(entry.hash);
          /* IDEA marks the checked-out commit with a HEAD badge: without it a row
             with a branch badge looks identical to the row you are standing on. */
          const isHead = head !== null && head === entry.hash;
          return React.createElement(
            'div',
            {
              key: entry.hash,
              ref: active ? scrollGraphRowIntoView : null,
              className: 'dsh-editor-commit-row dsh-editor-graph-row',
              role: 'option',
              'data-dsh-graph-hash': entry.hash,
              'aria-haspopup': 'menu',
              'aria-selected': active,
              style: { ...styles.commitGraphRow, ...(active ? styles.commitGraphRowActive : null) },
              title: entry.hash,
              onClick: (event) => {
                if (onRowClick !== undefined) onRowClick(entry, event);
                else onShow?.(entry.hash);
              },
              onMouseEnter: () => onSelect?.(entry.hash),
              onContextMenu: (event) => {
                event.preventDefault();
                event.stopPropagation();
                const contextSelection = selectionHashes.includes(entry.hash) ? selectionHashes : [entry.hash];
                if (onRowClick !== undefined && !selectionHashes.includes(entry.hash)) {
                  onRowClick(entry, event, { contextMenu: true });
                } else {
                  onShow?.(entry.hash);
                }
                onContextMenu?.({ commit: entry, selectionHashes: contextSelection, x: event.clientX, y: event.clientY });
              },
            },
            React.createElement(
              'span',
              { style: { ...styles.commitGraphLane, width: Math.max(12, (lane + 1) * 10) } },
              /* Only the columns up to this commit's lane: the rest would be empty gutters
                 that push the subject off a narrow tool window. */
              Array.from({ length: lane + 1 }, (_, index) =>
                React.createElement('span', {
                  key: index,
                  style: index === lane ? styles.commitGraphTrackActive : styles.commitGraphTrack,
                }),
              ),
              React.createElement('span', { style: styles.commitGraphNode },
                React.createElement(Icon, { name: isMerge ? 'graphMerge' : 'graphNode', size: 11 }),
              ),
            ),
            React.createElement('span', { style: styles.logHash }, entry.hash.slice(0, 7)),
            React.createElement(
              'span',
              { style: { minWidth: 0, flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: 1 } },
              React.createElement('span', { style: styles.logSubject }, entry.subject),
              /* A folded row must say how many commits it stands for; otherwise the
                 list looks like it lost history. */
              collapsed
                ? React.createElement('span', { style: styles.graphFoldBadge }, t('editor.graphFoldedRun', { count: run.hashes.length - 1 }))
                : null,
              React.createElement(
                'span',
                { style: { display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' } },
                isHead ? React.createElement('span', { style: styles.commitGraphHead, key: 'HEAD' }, 'HEAD') : null,
                /* IDEA's graph filters by clicking a ref badge; the badge names the
                   scope it applies, so clicking `main` shows main's history. */
                entry.refs.map((ref) => React.createElement(
                  'button',
                  {
                    key: ref,
                    type: 'button',
                    style: styles.commitGraphRef,
                    className: 'dsh-editor-graph-ref',
                    title: t('editor.graphFilterByRef', { ref }),
                    onClick: (event) => {
                      /* The row underneath opens the commit; the badge must not. */
                      event.stopPropagation();
                      onPickRef?.(ref);
                    },
                  },
                  ref,
                )),
                React.createElement('span', { style: styles.logMeta }, `${entry.author} · ${formatCommitDate(entry.date)}`),
              ),
            ),
          );
        }),
      );
    }

    /**
     * Turn a clicked ref badge into a graph scope (IDEA's "filter by ref").
     *
     * A branch badge means "walk that branch". A tag badge means "walk the
     * commit that tag points at" — tags have no line of their own, so the graph
     * shows the history *introduced by* the tag, which is what IDEA's
     * "Introduce tag" action does.
     * @param {string} ref - badge text (`main`, `origin/main`, `tag: v1`).
     * @param {object|null} graph - the loaded graph payload.
     * @returns {{branch: string, at: string}} scope for the next request.
     */
    function refScopeOf(ref, graph) {
      const value = typeof ref === 'string' ? ref.trim() : '';
      if (value === '') return { branch: '', at: '' };
      if (value.startsWith('tag: ')) {
        const name = value.slice(5).trim();
        const tag = (graph?.tagList ?? []).find((entry) => entry.name === name);
        /* An unknown tag is not a scope: better to stay put than to walk "" and
           look like the filter did nothing. */
        return tag === undefined ? { branch: '', at: '' } : { branch: '', at: tag.hash };
      }
      const known = (graph?.branchList ?? []).includes(value);
      return known ? { branch: value, at: '' } : { branch: '', at: '' };
    }

    /**
     * Keep the keyboard-selected graph row inside the scrolling list.
     *
     * Scrolls the list, not the page, so the surrounding tool window stays put.
     * @param {HTMLElement|null} node - the active row.
     * @returns {void}
     */
    function scrollGraphRowIntoView(node) {
      node?.scrollIntoView?.({ block: 'nearest' });
    }

    /**
     * Resolve keyboard movement in the flat commit table.
     *
     * The candidate list is already filtered by the visible text query, so
     * navigation cannot jump into a hidden commit. Unknown selections enter at
     * the corresponding edge, matching IDEA's table cursor behaviour.
     * @param {object[]|null} commits - visible commits.
     * @param {string|null} selected - selected hash.
     * @param {'next'|'previous'|'first'|'last'|'current'} action - movement.
     * @returns {string|null} hash to select.
     */
    function flatLogTarget(commits, selected, action) {
      const list = (Array.isArray(commits) ? commits : []).filter((commit) => typeof commit?.hash === 'string' && commit.hash !== '');
      if (list.length === 0) return null;
      const index = list.findIndex((commit) => commit.hash === selected);
      if (action === 'first') return list[0].hash;
      if (action === 'last') return list[list.length - 1].hash;
      if (action === 'current') return list[index < 0 ? 0 : index].hash;
      const delta = action === 'previous' ? -1 : 1;
      const base = index < 0 ? (delta > 0 ? -1 : list.length) : index;
      return list[Math.max(0, Math.min(base + delta, list.length - 1))].hash;
    }

    /**
     * Resolve the commit under IDEA's graph keyboard cursor.
     *
     * Hover is intentionally ignored: `Shift+F10` acts on the row the keyboard
     * selected. If the cursor is absent or no longer present after a refresh,
     * the currently displayed commit is the fallback.
     * @param {object[]|null} entries - graph commits.
     * @param {string|null} cursor - current keyboard cursor hash.
     * @param {string|null} selected - commit currently shown in details.
     * @returns {object|null} commit for the context menu.
     */
    function graphLogMenuTarget(entries, cursor, selected) {
      const list = (Array.isArray(entries) ? entries : []).filter((entry) => typeof entry?.hash === 'string' && entry.hash !== '');
      if (list.length === 0) return null;
      const preferred = typeof cursor === 'string' && cursor !== '' ? cursor : selected;
      return list.find((entry) => entry.hash === preferred) ?? (typeof selected === 'string' ? list.find((entry) => entry.hash === selected) ?? null : null);
    }

    /**
     * Resolve parent and child commits inside the currently loaded log entries.
     *
     * IDEA navigates the visible commit graph; it does not silently start a
     * repository-wide walk. Using only loaded rows keeps the action predictable
     * and prevents a menu item from selecting a commit the user cannot see.
     *
     * @param {object[]} entries - loaded flat or graph commits.
     * @param {string} hash - commit whose relations are requested.
     * @returns {{parents: object[], children: object[]}} loaded relation targets.
     */
    function commitRelationTargets(entries, hash) {
      const list = (Array.isArray(entries) ? entries : [])
        .filter((entry) => typeof entry?.hash === 'string' && entry.hash !== '');
      const byHash = new Map(list.map((entry) => [entry.hash, entry]));
      const current = byHash.get(hash);
      const seen = new Set();
      const parents = [];
      for (const parentHash of Array.isArray(current?.parents) ? current.parents : []) {
        if (typeof parentHash !== 'string' || parentHash === '' || seen.has(parentHash)) continue;
        const parent = byHash.get(parentHash);
        if (parent === undefined) continue;
        seen.add(parentHash);
        parents.push(parent);
      }
      const children = list.filter((entry) =>
        Array.isArray(entry.parents)
        && entry.parents.some((parentHash) => parentHash === hash),
      );
      return { parents, children };
    }

    /**
     * Pick the first loaded relation target for an IDEA arrow-key navigation.
     *
     * @param {object[]} entries - loaded commits.
     * @param {string|null} hash - starting commit.
     * @param {'parents'|'children'} relation - direction to follow.
     * @returns {object|null} target commit, if one is currently loaded.
     */
    function commitRelationTarget(entries, hash, relation) {
      const targets = commitRelationTargets(entries, hash);
      return (relation === 'parents' ? targets.parents : targets.children)[0] ?? null;
    }

    /**
     * Apply IDEA's Log row click behavior to the commit selection.
     *
     * A plain click replaces the selection, Meta/Ctrl toggles one commit, and
     * Shift selects the inclusive visible range from the previous anchor.
     * Selection is resolved from visible order, never from hash sorting.
     *
     * @param {string[]} order - visible commit hashes in display order.
     * @param {string[]} selected - currently selected hashes.
     * @param {string} hash - clicked commit.
     * @param {{meta?: boolean, shift?: boolean}} [modifiers] - click modifiers.
     * @param {string} [anchorHash] - range anchor from the previous click.
     * @returns {{selected: string[], anchor: string}} next selection and anchor.
     */
    function commitSelectionAfterClick(order, selected, hash, modifiers, anchorHash = '') {
      const hashes = [...new Set((Array.isArray(order) ? order : []).filter((value) => typeof value === 'string' && value !== ''))];
      const flags = modifiers ?? {};
      if (!hashes.includes(hash)) {
        const valid = [...new Set((Array.isArray(selected) ? selected : []).filter((value) => hashes.includes(value)))];
        return { selected: valid, anchor: hashes.includes(anchorHash) ? anchorHash : (valid[0] ?? '') };
      }
      const current = [...new Set((Array.isArray(selected) ? selected : []).filter((value) => hashes.includes(value)))];
      if (flags.shift === true) {
        const anchor = hashes.includes(anchorHash) ? anchorHash : hash;
        const from = hashes.indexOf(anchor);
        const to = hashes.indexOf(hash);
        const range = hashes.slice(Math.min(from, to), Math.max(from, to) + 1);
        return { selected: range.length === 0 ? [hash] : range, anchor };
      }
      if (flags.meta === true) {
        const next = current.includes(hash)
          ? current.filter((value) => value !== hash)
          : [...current, hash];
        return { selected: next.length === 0 ? [hash] : next, anchor: hash };
      }
      return { selected: [hash], anchor: hash };
    }

    /**
     * Keep the two revisions in visible Log order.
     *
     * IDEA displays the older selected commit on the left and the newer one on
     * the right. Looking up both hashes in the current log preserves that
     * direction even when the user selected them in the opposite order.
     *
     * @param {string[]} selected - exactly two selected hashes.
     * @param {object[]} entries - loaded commits in display order.
     * @returns {string[]|null} newer, older; or null when not exactly two loaded commits.
     */
    function orderedRevisionPair(selected, entries) {
      const selectedSet = new Set((Array.isArray(selected) ? selected : []).filter((value) => typeof value === 'string' && value !== ''));
      if (selectedSet.size !== 2) return null;
      const order = [...new Set((Array.isArray(entries) ? entries : [])
        .map((entry) => entry?.hash)
        .filter((hash) => typeof hash === 'string' && hash !== ''))];
      const pair = order.filter((hash) => selectedSet.has(hash));
      return pair.length === 2 ? pair : null;
    }

    /**
     * Build aggregate-diff entries for the paths affected by one commit.
     *
     * IDEA's Compare with Local passes exactly the selected commit's affected
     * paths to the diff handler. Building the same identities here keeps
     * unrelated working-tree edits out of the comparison.
     *
     * @param {{files?: object[]}|null} detail - `gitShowCommit` payload.
     * @param {string} hash - resolved commit hash.
     * @param {string} [localLabel='local'] - label for the right side.
     * @returns {Array<{path: string, revision: string, heading: string}>} diff entries.
     */
    function commitLocalDiffEntries(detail, hash, localLabel = 'local') {
      const revision = typeof hash === 'string' ? hash.trim() : '';
      if (revision === '') return [];
      return (Array.isArray(detail?.files) ? detail.files : [])
        .filter((file) => typeof file?.path === 'string' && file.path !== '')
        .map((file) => ({
          path: file.path,
          revision,
          heading: `${file.path} · ${revision.slice(0, 7)} → ${localLabel}`,
        }));
    }

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

    /** Compact absolute time for the log rows. */
    function formatCommitDate(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      const pad = (number) => String(number).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    /**
     * Load xterm.js and its fit addon once per page.
     *
     * The ESM builds are imported dynamically because Monaco installs a global
     * AMD `define`, which would otherwise capture a UMD xterm bundle.
     * @returns {Promise<{Terminal: Function, FitAddon: Function}>} constructors.
     */
    function loadXterm() {
      if (xtermPromise !== null) return xtermPromise;
      xtermPromise = (async () => {
        injectStylesheet('/api/dsh-editor/xterm/xterm.css', 'dsh-editor-xterm-css');
        const [xterm, fitAddon] = await Promise.all([
          import('/api/dsh-editor/xterm/xterm.mjs'),
          import('/api/dsh-editor/xterm/addon-fit.mjs'),
        ]);
        return { Terminal: xterm.Terminal, FitAddon: fitAddon.FitAddon };
      })();
      return xtermPromise;
    }

    /** Reuse a shared `<link>` for terminal styling. */
    function injectStylesheet(href, id) {
      if (document.getElementById(id) !== null) return;
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }

    /** Contract of one running terminal view returned by the host terminal API. */
    const TERMINAL_POLL_MS = 16;

    /**
     * Read one SSE response body in chunks and hand each frame to a parser.
     * @param {Response} response - streaming response.
     * @param {(event: object) => void} onEvent - decoded event consumer.
     * @param {AbortSignal} signal - request lifetime.
     * @returns {Promise<void>} resolves when the stream ends.
     */
    async function readEventStream(response, onEvent, signal) {
      if (response.body === null) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const abort = () => {
        reader.cancel().catch(() => {});
      };
      signal.addEventListener('abort', abort, { once: true });
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let boundary = buffer.indexOf('\n\n');
          while (boundary >= 0) {
            const frame = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const payload = frame.startsWith('data: ') ? frame.slice(6) : frame;
            if (payload !== '') {
              try {
                onEvent(JSON.parse(payload));
              } catch {
                /* one malformed frame must not kill the terminal */
              }
            }
            boundary = buffer.indexOf('\n\n');
          }
        }
      } finally {
        signal.removeEventListener('abort', abort);
      }
    }

    /**
     * Terminal link grammar, loaded once from the module the test suite also imports.
     *
     * It ships as ESM and is imported dynamically for the same reason as xterm:
     * Monaco claims the global AMD `define`, so a static script tag would be captured.
     */
    let linkParserPromise = null;
    function loadLinkParser() {
      if (linkParserPromise === null) {
        linkParserPromise = import('/api/dsh-editor/shared/link-parser.mjs').catch(() => null);
      }
      return linkParserPromise;
    }

    /**
     * Build xterm's link provider for one emulator.
     *
     * The provider only shapes candidates locally; whether a path really exists is
     * asked from the host, so a missing file never becomes a dead underlined link.
     * @param {object} emulator - xterm Terminal instance.
     * @param {() => string} getCwd - current shell working directory.
     * @returns {{provideLinks: Function, dispose: Function}} provider handle.
     */
    function createTerminalLinkProvider(emulator, getCwd) {
      /* Existence cache: terminal lines are re-scanned while scrolling. */
      const cache = new Map();
      const pending = new Set();
      let disposed = false;

      /**
       * Ask the host which candidate paths exist, in one round trip.
       * @param {string[]} candidates - workspace-relative or absolute paths.
       * @returns {Promise<Map<string, object>>} verdicts keyed by candidate.
       */
      const resolveExistence = async (candidates) => {
        const unknown = candidates.filter((candidate) => !cache.has(candidate) && !pending.has(candidate));
        if (unknown.length > 0) {
          for (const candidate of unknown) pending.add(candidate);
          try {
            const value = await callFs({ op: 'exists', paths: unknown });
            for (const entry of value ?? []) cache.set(entry.requested, entry);
          } catch {
            /* an unreachable host simply leaves the link unconfirmed */
          } finally {
            for (const candidate of unknown) pending.delete(candidate);
          }
        }
        const verdicts = new Map();
        for (const candidate of candidates) {
          const entry = cache.get(candidate);
          if (entry !== undefined) verdicts.set(candidate, entry);
        }
        return verdicts;
      };

      return {
        provideLinks(bufferLineNumber, callback) {
          if (disposed) {
            callback(undefined);
            return;
          }
          const line = emulator.buffer.active.getLine(bufferLineNumber - 1);
          if (line === undefined) {
            callback(undefined);
            return;
          }
          void loadLinkParser().then((parser) => {
            if (disposed || parser === null) {
              callback(undefined);
              return;
            }
            const links = parser.parseTerminalLinks(line.translateToString(true));
            if (links.length === 0) {
              callback(undefined);
              return;
            }
            const pathLinks = links.filter((link) => link.kind === 'path');
            const candidates = pathLinks.map((link) => parser.resolveTerminalPath(getCwd(), link.path));
            void resolveExistence(candidates).then((verdicts) => {
              if (disposed) return;
              const decorated = [];
              for (const link of links) {
                /* xterm ranges are 1-based on both axes. */
                const range = { start: { x: link.start + 1, y: bufferLineNumber }, end: { x: link.end + 1, y: bufferLineNumber } };
                if (link.kind === 'url') {
                  decorated.push({
                    range,
                    text: link.text,
                    decorations: { pointerCursor: true, underline: true },
                    activate: () => window.open(link.text, '_blank', 'noopener,noreferrer'),
                  });
                  continue;
                }
                const candidate = parser.resolveTerminalPath(getCwd(), link.path);
                const verdict = verdicts.get(candidate);
                if (verdict === undefined || verdict.exists !== true || verdict.kind !== 'file') continue;
                decorated.push({
                  range,
                  text: link.text,
                  decorations: { pointerCursor: true, underline: true },
                  activate: () => openTerminalTarget({ path: verdict.path, line: link.line, column: link.column }),
                });
              }
              callback(decorated.length === 0 ? undefined : decorated);
            });
          });
        },
        dispose() {
          disposed = true;
          cache.clear();
          pending.clear();
        },
      };
    }

    /**
     * Open one terminal link target in the editor, optionally revealing a line.
     * Reaches the workspace React tree through a custom DOM event: the terminal
     * dock is a sibling of the editor surface, not a descendant.
     * @param {{path: string, line: number|null, column: number|null}} target - resolved target.
     */
    function openTerminalTarget(target) {
      if (typeof target.path !== 'string' || target.path === '') return;
      const host = document.querySelector('[data-dsh-editor-workspace]');
      host?.dispatchEvent(new CustomEvent('dsh-editor-open-file', { detail: target }));
    }

    /**
     * Every occurrence of one query inside the terminal's retained buffer.
     *
     * xterm exposes the scrollback as 0-based lines from the top of `buffer.active`;
     * trimming trailing blanks keeps the column offsets aligned with the printed text.
     * @param {object} emulator - xterm instance.
     * @param {string} needle - query.
     * @param {number} limit - safety ceiling for huge scrollbacks.
     * @returns {Array<{row: number, column: number}>} hits in buffer order.
     */
    function terminalMatches(emulator, needle, limit = 2000) {
      if (needle === '') return [];
      const buffer = emulator.buffer.active;
      const hits = [];
      for (let row = 0; row < buffer.length && hits.length < limit; row += 1) {
        const line = buffer.getLine(row);
        if (line === undefined) continue;
        const text = line.translateToString(true);
        let column = text.indexOf(needle);
        while (column >= 0) {
          hits.push({ row, column });
          column = text.indexOf(needle, column + Math.max(1, needle.length));
        }
      }
      return hits;
    }

    /**
     * Match count for the terminal find bar.
     * @param {object} emulator - xterm instance.
     * @param {string} needle - query.
     * @returns {number} occurrences.
     */
    function countTerminalMatches(emulator, needle) {
      return terminalMatches(emulator, needle).length;
    }

    /**
     * Select the next/previous occurrence of the find query inside the terminal buffer.
     *
     * xterm has no search API of its own, so the buffer is scanned line by line and
     * the hit is turned into a buffer selection; the count is kept in component state
     * so the bar can show `n/total` the way the editor find bar does.
     * @param {object|null} emulator - xterm instance.
     * @param {{query: string, index: number, total: number}} find - current find state.
     * @param {Function} setFind - state setter.
     * @param {number} direction - +1 next, -1 previous.
     * @returns {void}
     */
    function moveTerminalSelection(emulator, find, setFind, direction) {
      if (emulator === null || find.query === '') return;
      const needle = find.query;
      const hits = terminalMatches(emulator, needle);
      if (hits.length === 0) {
        setFind({ ...find, total: 0, index: 0 });
        return;
      }
      const index = ((find.index + direction) % hits.length + hits.length) % hits.length;
      const hit = hits[index];
      emulator.select(hit.column, hit.row, needle.length);
      emulator.scrollToLine(hit.row - Math.floor(emulator.rows / 2));
      setFind({ ...find, index, total: hits.length });
    }

    /**
     * IDEA's macOS terminal shortcuts that should never be forwarded to the
     * shell. Ctrl+C is deliberately excluded: without Meta it remains SIGINT.
     * @param {KeyboardEvent|object} event - key event.
     * @param {boolean} hasSelection - whether the focused terminal has text selected.
     * @returns {'newTab'|'copy'|'paste'|null} direct terminal action.
     */
    function directTerminalShortcut(event, hasSelection) {
      if (!event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return null;
      const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
      if (key === 't') return 'newTab';
      if (key === 'c') return hasSelection ? 'copy' : 'copyBlock';
      if (key === 'v') return 'paste';
      return null;
    }

    /**
     * xterm marks continuation rows with isWrapped. IDEA's Select Prompt covers
     * the whole logical prompt, not only the final wrapped visual row.
     * @param {object|null} buffer - xterm active buffer.
     * @param {number} [cursorY] - current cursor row.
     * @returns {number|null} first visual row occupied by the prompt.
     */
    function terminalPromptStartRow(buffer, cursorY = buffer?.cursorY) {
      if (buffer === null || buffer === undefined || !Number.isInteger(cursorY)) return null;
      let row = cursorY;
      while (row > 0 && buffer.getLine?.(row)?.isWrapped === true) row -= 1;
      return row;
    }

    /**
     * IDEA's Select Prompt selects from the current prompt row's first column to
     * the caret. xterm already exposes the authoritative cursor coordinates, so
     * this intentionally avoids guessing prompt boundaries from shell text.
     * @param {object|null} buffer - xterm active buffer.
     * @param {number} [cursorY] - current cursor row.
     * @param {number} [cursorX] - current cursor column.
     * @returns {{row: number, column: number, length: number}|null} xterm range.
     */
    function terminalPromptSelection(buffer, cursorY = buffer?.cursorY, cursorX = buffer?.cursorX) {
      if (buffer === null || buffer === undefined) return null;
      if (!Number.isInteger(cursorY) || !Number.isInteger(cursorX) || cursorX < 0) return null;
      return { row: cursorY, column: 0, length: cursorX };
    }

    /**
     * IDEA's block actions use shell-integration metadata that a plain PTY does
     * not provide. The closest lossless xterm mapping is the contiguous non-empty
     * output range immediately above the current prompt row.
     * @param {object|null} buffer - xterm active buffer.
     * @param {number} [cursorY] - current cursor row.
     * @returns {{start: number, end: number}|null} inclusive buffer rows.
     */
    function terminalLastBlockSelection(buffer, cursorY = buffer?.cursorY) {
      if (buffer === null || buffer === undefined || !Number.isInteger(cursorY)) return null;
      const rowText = (row) => {
        const line = buffer.getLine?.(row);
        return typeof line?.translateToString === 'function' ? line.translateToString(true) : null;
      };

      /* Skip the complete current prompt, including its wrapped visual rows;
         otherwise the first prompt row looks like a one-line output block. */
      let promptRow = cursorY;
      while (promptRow > 0 && buffer.getLine?.(promptRow)?.isWrapped === true) promptRow -= 1;
      let row = promptRow - 1;
      while (row >= 0 && rowText(row)?.trim() === '') row -= 1;
      if (row < 0 || rowText(row) === null) return null;

      const end = row;
      while (row >= 0) {
        const text = rowText(row);
        if (text === null || text.trim() === '') break;
        row -= 1;
      }
      return { start: row + 1, end };
    }

    /**
     * Expand one terminal row to its contiguous non-empty block.
     * @param {object|null} buffer - xterm active buffer.
     * @param {number} row - buffer row.
     * @returns {{start: number, end: number}|null} inclusive block range.
     */
    function terminalBlockRangeAt(buffer, row) {
      if (buffer === null || buffer === undefined || !Number.isInteger(row) || row < 0) return null;
      const textAt = (candidate) => {
        const line = buffer.getLine?.(candidate);
        return typeof line?.translateToString === 'function' ? line.translateToString(true) : null;
      };
      if (textAt(row)?.trim() === '') return null;
      let start = row;
      let end = row;
      const lastRow = Math.max(0, Number.isInteger(buffer.length) ? buffer.length - 1 : row);
      while (start > 0) {
        const previous = textAt(start - 1);
        if (previous === null || previous.trim() === '') break;
        start -= 1;
      }
      while (end < lastRow) {
        const next = textAt(end + 1);
        if (next === null || next.trim() === '') break;
        end += 1;
      }
      return { start, end };
    }

    /**
     * Map the current xterm text selection to its logical non-empty block range.
     * @param {object|null} buffer - xterm active buffer.
     * @param {{start?: {y?: number}, end?: {y?: number}}|null} position - xterm selection.
     * @returns {{start: number, end: number}|null} selected block span.
     */
    function terminalSelectionBlockRange(buffer, position) {
      const startRow = position?.start?.y;
      const endRow = position?.end?.y;
      if (!Number.isInteger(startRow) || !Number.isInteger(endRow)) return null;
      const first = Math.min(startRow, endRow);
      const last = Math.max(startRow, endRow);
      const firstBlock = terminalBlockRangeAt(buffer, first);
      const lastBlock = terminalBlockRangeAt(buffer, last);
      if (firstBlock === null && lastBlock === null) return null;
      if (firstBlock === null) return lastBlock;
      if (lastBlock === null) return firstBlock;
      return { start: Math.min(firstBlock.start, lastBlock.start), end: Math.max(firstBlock.end, lastBlock.end) };
    }

    /**
     * Find the next non-empty block in one direction without crossing a caller's
     * upper bound (normally the row before the current prompt).
     * @param {object|null} buffer - xterm active buffer.
     * @param {{start: number, end: number}|null} range - current block.
     * @param {number} direction - -1 above, +1 below.
     * @param {number} [maxRow] - inclusive final searchable row.
     * @returns {{start: number, end: number}|null} adjacent block.
     */
    function terminalAdjacentBlockRange(buffer, range, direction, maxRow = Number.isInteger(buffer?.length) ? buffer.length - 1 : -1) {
      if (buffer === null || buffer === undefined || range === null || range === undefined) return null;
      if (!Number.isInteger(range.start) || !Number.isInteger(range.end) || !Number.isInteger(maxRow)) return null;
      const step = Number(direction) < 0 ? -1 : 1;
      let row = step < 0 ? range.start - 1 : range.end + 1;
      const textAt = (candidate) => {
        const line = buffer.getLine?.(candidate);
        return typeof line?.translateToString === 'function' ? line.translateToString(true) : null;
      };
      while (row >= 0 && row <= maxRow) {
        const text = textAt(row);
        if (text === null || text.trim() !== '') break;
        row += step;
      }
      if (row < 0 || row > maxRow || textAt(row) === null) return null;
      const block = terminalBlockRangeAt(buffer, row);
      if (block === null) return null;
      return { start: block.start, end: Math.min(block.end, maxRow) };
    }

    /**
     * Merge the current block with its adjacent block in one direction.
     * @param {object|null} buffer - xterm active buffer.
     * @param {{start: number, end: number}|null} range - current block.
     * @param {number} direction - -1 above, +1 below.
     * @param {number} [maxRow] - inclusive final searchable row.
     * @returns {{start: number, end: number}|null} expanded range.
     */
    function terminalExpandBlockRange(buffer, range, direction, maxRow) {
      const adjacent = terminalAdjacentBlockRange(buffer, range, direction, maxRow);
      if (adjacent === null) return null;
      return Number(direction) < 0
        ? { start: adjacent.start, end: range.end }
        : { start: range.start, end: adjacent.end };
    }

    /**
     * Resolve IDEA block-mode arrow keys without stealing normal shell history.
     * Arrows belong to blocks only when a block selection already exists and the
     * terminal Find surface is closed.
     * @param {KeyboardEvent|object} event - terminal keydown.
     * @param {boolean} hasSelection - whether the focused pane has a selection.
     * @param {boolean} findOpen - whether Terminal Find owns the current context.
     * @returns {'selectAbove'|'selectBelow'|'expandAbove'|'expandBelow'|null} action.
     */
    function terminalBlockKeyboardAction(event, hasSelection, findOpen) {
      if (hasSelection !== true || findOpen === true) return null;
      if (event?.metaKey === true || event?.ctrlKey === true || event?.altKey === true) return null;
      if (event?.key !== 'ArrowUp' && event?.key !== 'ArrowDown') return null;
      const direction = event.key === 'ArrowUp' ? 'Above' : 'Below';
      return `${event.shiftKey === true ? 'expand' : 'select'}${direction}`;
    }

    /**
     * IDEA-style terminal actions shared by the screen context menu and the tab menu.
     * @param {object} input - menu context.
     * @param {object} input.t - translator.
     * @param {object|null} input.emulator - xterm instance.
     * @param {object|null} input.active - active terminal description.
     * @param {Function} input.onSelectAll - select the whole buffer.
     * @param {Function} input.onClear - clear the screen.
     * @param {Function} input.onCreate - open a new terminal.
     * @returns {object|null} menu model.
     */
    function terminalMenuModel({ t, emulator, active, onSelectAll, onFind, onClose, onClear, onClearBuffer, onCreate, onSplitRight, onMoveToEditor, onSwitchFocusToEditor, onClipboardError, onPastedText, pasteHistory = [], onPasteHistory, selectionPosition: initialSelectionPosition = null }) {
      if (emulator === null) return null;
      const selection = typeof emulator.getSelection === 'function' ? emulator.getSelection() : '';
      const buffer = emulator.buffer?.active;
      /* Some existing contract tests extract this function without its helper
         closure. Safe aliases keep production behavior while allowing those
         narrow fixtures to instantiate unrelated menu items. */
      const promptStartRowOf = typeof terminalPromptStartRow === 'function' ? terminalPromptStartRow : () => null;
      const lastBlockSelectionOf = typeof terminalLastBlockSelection === 'function' ? terminalLastBlockSelection : () => null;
      const selectionBlockRangeOf = typeof terminalSelectionBlockRange === 'function' ? terminalSelectionBlockRange : () => null;
      const adjacentBlockRangeOf = typeof terminalAdjacentBlockRange === 'function' ? terminalAdjacentBlockRange : () => null;
      const expandBlockRangeOf = typeof terminalExpandBlockRange === 'function' ? terminalExpandBlockRange : () => null;
      const selectionPosition = initialSelectionPosition
        ?? (typeof emulator.getSelectionPosition === 'function' ? emulator.getSelectionPosition() : null);
      const selectedBlock = selectionBlockRangeOf(buffer, selectionPosition);
      const promptRow = promptStartRowOf(buffer);
      const maxBlockRow = promptRow === null
        ? (Number.isInteger(buffer?.length) ? buffer.length - 1 : -1)
        : promptRow - 1;
      const lastBlock = lastBlockSelectionOf(buffer);
      const blockAbove = selectedBlock === null
        ? lastBlock
        : adjacentBlockRangeOf(buffer, selectedBlock, -1, maxBlockRow);
      const blockBelow = selectedBlock === null
        ? null
        : adjacentBlockRangeOf(buffer, selectedBlock, 1, maxBlockRow);
      const expandedAbove = selectedBlock === null
        ? null
        : expandBlockRangeOf(buffer, selectedBlock, -1, maxBlockRow);
      const expandedBelow = selectedBlock === null
        ? null
        : expandBlockRangeOf(buffer, selectedBlock, 1, maxBlockRow);
      const selectBlockRange = (range) => {
        if (range === null || typeof emulator.selectLines !== 'function') return;
        emulator.selectLines(range.start, range.end);
        emulator.focus?.();
      };
      const paneActions = [
        ...(onSplitRight === null || onSplitRight === undefined
          ? []
          : [{ id: 'splitRight', label: t('editor.terminalSplitRight'), run: onSplitRight }]),
        ...(onMoveToEditor === null || onMoveToEditor === undefined
          ? []
          : [{ id: 'moveToEditor', label: t('editor.terminalMoveToEditor'), run: onMoveToEditor }]),
        ...(onSwitchFocusToEditor === null || onSwitchFocusToEditor === undefined
          ? []
          : [{
              id: 'switchFocusToEditor',
              label: t('editor.terminalSwitchFocusToEditor'),
              restoreFocus: false,
              run: onSwitchFocusToEditor,
            }]),
      ];
      return {
        items: [
          { id: 'find', label: t('editor.find'), shortcut: '⌘F', run: onFind },
          {
            id: 'searchHistory',
            label: t('editor.terminalSearchHistory'),
            shortcut: '⌃R',
            disabled: active === null || active.state === 'exited',
            restoreFocus: false,
            /* IDEA sends Control+R to the shell's readline; unlike find, this
               searches the shell command history and must keep input ownership
               in the terminal rather than in a dock-owned overlay. */
            run: () => {
              emulator.input('\u0012', true);
              emulator.focus?.();
            },
          },
          {
            id: 'interruptCommand',
            label: t('editor.terminalInterruptCommand'),
            disabled: active === null || active.state === 'exited',
            restoreFocus: false,
            run: () => {
              emulator.input('\u0003', true);
              emulator.focus?.();
            },
          },
          {
            id: 'clearPrompt',
            label: t('editor.terminalClearPrompt'),
            disabled: active === null || active.state === 'exited',
            restoreFocus: false,
            run: () => {
              emulator.input('\u0015', true);
              emulator.focus?.();
            },
          },
          { id: 'new', label: t('editor.terminalNew'), shortcut: '⌘T', run: onCreate },
          onClose === null || onClose === undefined
            ? null
            : {
                id: 'close',
                label: t('editor.terminalClose'),
                shortcut: '⌘W',
                disabled: active === null,
                run: onClose,
              },
          null,
          {
            id: 'copy',
            label: t('editor.terminalCopy'),
            shortcut: '⌘C',
            disabled: selection === '',
            run: () => {
              if (selection !== '') void navigator.clipboard?.writeText(selection).catch(() => {});
            },
          },
          {
            id: 'copyBlock',
            label: t('editor.terminalCopyBlock'),
            disabled: !Number.isInteger(buffer?.cursorY) || typeof emulator.selectLines !== 'function',
            run: () => {
              const range = lastBlockSelectionOf(emulator.buffer?.active);
              if (range === null) return;
              emulator.selectLines(range.start, range.end);
              emulator.focus?.();
              const text = typeof emulator.getSelection === 'function' ? emulator.getSelection() : '';
              if (text !== '') {
                void Promise.resolve(navigator.clipboard?.writeText(text)).catch(() => {
                  onClipboardError?.(t('editor.clipboardWriteFailed'));
                });
              }
            },
          },
          {
            id: 'paste',
            label: t('editor.terminalPaste'),
            shortcut: '⌘V',
            disabled: active === null || active.state === 'exited',
            run: () => void pasteIntoTerminal(emulator, active, t, onClipboardError, onPastedText),
          },
          {
            id: 'pasteHistory',
            label: t('editor.terminalPasteHistory'),
            disabled: pasteHistory.length === 0,
            items: pasteHistory.map((text, index) => ({
              id: `pasteHistory:${index}`,
              label: pasteHistoryPreview(text),
              run: () => onPasteHistory?.(text),
            })),
          },
          { id: 'selectAll', label: t('editor.terminalSelectAll'), shortcut: '⌘A', run: onSelectAll },
          {
            id: 'selectLastBlock',
            label: t('editor.terminalSelectLastBlock'),
            shortcut: '⌘↑',
            disabled: !Number.isInteger(buffer?.cursorY) || buffer.cursorY <= 0 || typeof emulator.selectLines !== 'function',
            run: () => {
              const range = lastBlockSelectionOf(emulator.buffer?.active);
              if (range === null) return;
              emulator.selectLines(range.start, range.end);
              emulator.focus?.();
            },
          },
          {
            id: 'selectPrompt',
            label: t('editor.terminalSelectPrompt'),
            shortcut: '⌘↓',
            disabled: !Number.isInteger(buffer?.cursorY) || !Number.isInteger(buffer?.cursorX) || typeof emulator.select !== 'function',
            run: () => {
              const range = terminalPromptSelection(emulator.buffer?.active);
              if (range === null) return;
              const startRow = promptStartRowOf(emulator.buffer?.active, range.row);
              if (startRow !== null && startRow < range.row && typeof emulator.selectLines === 'function') {
                emulator.selectLines(startRow, range.row);
              } else {
                emulator.select(range.column, range.row, range.length);
              }
              emulator.focus?.();
            },
          },
          {
            id: 'selectBlockAbove',
            label: t('editor.terminalSelectBlockAbove'),
            disabled: blockAbove === null || typeof emulator.selectLines !== 'function',
            run: () => selectBlockRange(blockAbove),
          },
          {
            id: 'selectBlockBelow',
            label: t('editor.terminalSelectBlockBelow'),
            disabled: blockBelow === null || typeof emulator.selectLines !== 'function',
            run: () => selectBlockRange(blockBelow),
          },
          {
            id: 'expandBlockSelectionAbove',
            label: t('editor.terminalExpandBlockSelectionAbove'),
            disabled: expandedAbove === null || typeof emulator.selectLines !== 'function',
            run: () => selectBlockRange(expandedAbove),
          },
          {
            id: 'expandBlockSelectionBelow',
            label: t('editor.terminalExpandBlockSelectionBelow'),
            disabled: expandedBelow === null || typeof emulator.selectLines !== 'function',
            run: () => selectBlockRange(expandedBelow),
          },
          null,
          /* Two different clears, spelled out: ⌘K wipes the visible screen but keeps
             the scrollback, while this one throws the retained history away. The old
             labels ("清屏" vs "清除滚动缓冲") left the difference to the parenthetical. */
          { id: 'clear', label: t('editor.terminalClear'), shortcut: '⌘K', run: onClear },
          { id: 'clearBuffer', label: t('editor.terminalClearBuffer'), danger: true, run: onClearBuffer },
          { id: 'pageUp', label: t('editor.terminalPageUp'), shortcut: '⇧PageUp', disabled: typeof emulator.scrollPages !== 'function', run: () => {
            emulator.scrollPages?.(-1);
            emulator.focus?.();
          } },
          { id: 'pageDown', label: t('editor.terminalPageDown'), shortcut: '⇧PageDown', disabled: typeof emulator.scrollPages !== 'function', run: () => {
            emulator.scrollPages?.(1);
            emulator.focus?.();
          } },
          null,
          { id: 'lineUp', label: t('editor.terminalLineUp'), disabled: typeof emulator.scrollLines !== 'function', run: () => {
            emulator.scrollLines?.(-1);
            emulator.focus?.();
          } },
          { id: 'lineDown', label: t('editor.terminalLineDown'), disabled: typeof emulator.scrollLines !== 'function', run: () => {
            emulator.scrollLines?.(1);
            emulator.focus?.();
          } },
          ...(paneActions.length === 0 ? [] : [null, ...paneActions]),
        ],
      };
    }

    /**
     * Neighbour targeted by IDEA's Move Tab Left/Right action.
     * @param {object[]} terminals - tabs in current display order.
     * @param {string} id - tab being moved.
     * @param {'left'|'right'} direction - movement direction.
     * @returns {string|null} neighbour id, or null at the strip boundary.
     */
    function terminalMoveTarget(terminals, id, direction) {
      const list = Array.isArray(terminals) ? terminals : [];
      const index = list.findIndex((terminal) => terminal?.id === id);
      if (index < 0) return null;
      const targetIndex = index + (direction === 'left' ? -1 : 1);
      if (targetIndex < 0 || targetIndex >= list.length) return null;
      return list[targetIndex]?.id ?? null;
    }

    /**
     * Resolve which pane owns a terminal tab context-menu gesture.
     *
     * The split's own tab belongs to the right pane. Re-activating it through
     * the left pane would make both panes reference one PTY, and the split guard
     * would immediately collapse the split.
     * @param {string} terminalId - tab under the pointer.
     * @param {string|null} _activeId - terminal shown in the left pane.
     * @param {string|null} splitId - terminal shown in the right pane.
     * @returns {{pane: 'left'|'right', activate: boolean}} pane focus decision.
     */
    function terminalTabContextFocus(terminalId, _activeId, splitId) {
      const splitTerminal = splitId !== null && terminalId === splitId;
      return {
        pane: splitTerminal ? 'right' : 'left',
        activate: splitTerminal === false,
      };
    }

    /**
     * Context menu for one terminal tab, matching IDEA's tab actions.
     * @param {object} t - translator.
     * @param {object} terminal - terminal description.
     * @param {{rename: Function, close: Function, closeOthers: Function, duplicate: Function}} actions - callbacks.
     * @returns {object[]} menu items.
     */
    function terminalTabMenu(t, terminal, actions) {
      return [
        { id: 'rename', label: t('editor.terminalRename'), shortcut: '⇧F6', run: actions.rename },
        { id: 'color', label: t('editor.terminalColor'), run: actions.cycleColor },
        { id: 'duplicate', label: t('editor.terminalDuplicate'), disabled: actions.canDuplicate !== true, run: actions.duplicate },
        { id: 'moveLeft', label: t('editor.terminalMoveLeft'), disabled: actions.canMoveLeft !== true, run: actions.moveLeft },
        { id: 'moveRight', label: t('editor.terminalMoveRight'), disabled: actions.canMoveRight !== true, run: actions.moveRight },
        { id: 'copyPath', label: t('editor.copyDirectoryPath'), run: () => void navigator.clipboard?.writeText(actions.cwd ?? terminal.cwd).catch(() => {}) },
        /* IDEA's terminal menu opens the directory's README, so a shell `cd`-ed into
           another package does not force a trip back to the tree. Disabled (not
           hidden) when the directory has none: the user can see it exists. */
        {
          id: 'openReadme',
          label: t('editor.openReadme'),
          /* Enabled until a resolve proves there is none: a first open must not
             require a pre-flight listing, and `''` is the "checked, missing" marker. */
          disabled: actions.readmePath === '',
          run: () => actions.openReadme?.(),
        },
        /* IDEA's tab menu opens the shell's directory in the system file manager;
           without it the only way to find it is to read the path off the title. */
        { id: 'revealCwd', label: t('editor.revealInFinder'), run: () => actions.revealCwd?.() },
        null,
        actions.splitRight === null
          ? null
          : { id: 'splitRight', label: t('editor.terminalSplitRight'), run: actions.splitRight },
        { id: 'reopen', label: t('editor.terminalReopen'), disabled: actions.reopen === null || actions.reopen === undefined, run: actions.reopen },
        actions.moveToEditor === null || actions.moveToEditor === undefined
          ? null
          : { id: 'moveToEditor', label: t('editor.terminalMoveToEditor'), run: actions.moveToEditor },
        actions.switchFocusToEditor === null || actions.switchFocusToEditor === undefined
          ? null
          : {
              id: 'switchFocusToEditor',
              label: t('editor.terminalSwitchFocusToEditor'),
              restoreFocus: false,
              run: actions.switchFocusToEditor,
            },
        { id: 'close', label: t('editor.terminalClose'), run: actions.close },
        { id: 'closeOthers', label: t('editor.terminalCloseOthers'), disabled: actions.canCloseOthers !== true, run: actions.closeOthers },
      ].filter((item, index, list) => item !== null || (index > 0 && list[index - 1] !== null));
    }

    /**
     * Read the clipboard and hand the text to the active PTY.
     *
     * IDEA pastes multi-line text after a confirmation; a bracketed paste keeps
     * the shell from executing a pasted block line by line.
     * @param {object} emulator - xterm instance.
     * @param {object|null} active - active terminal.
     * @returns {Promise<void>} resolves once the text reached the PTY or was refused.
     */
    function pushPasteHistory(history, text) {
      const value = typeof text === 'string' ? text : '';
      const current = Array.isArray(history) ? history : [];
      if (value === '') return current;
      return [value, ...current.filter((entry) => entry !== value)].slice(0, 10);
    }

    function pasteHistoryPreview(text, limit = 60) {
      const normalized = (typeof text === 'string' ? text : '').replace(/\r\n?/g, '\n').replace(/\n/g, '↵');
      if (normalized.length <= limit) return normalized;
      return `${normalized.slice(0, Math.max(0, limit - 1))}…`;
    }

    async function writeTerminalText(emulator, active, text, t) {
      if (active === null || active.state === 'exited') return;
      if (typeof text !== 'string' || text === '') return false;
      const lines = text.trimEnd().split('\n').length;
      /* IDEA's wording: say how much is about to be pasted before it runs. */
      if (lines > 1 && !window.confirm(t('editor.terminalPasteConfirm', { count: lines }))) return false;
      await callTerminal({ op: 'write', id: active.id, data: text }).catch(() => {});
      emulator.focus();
      return true;
    }

    async function pasteIntoTerminal(emulator, active, t, onRefused, onPasted) {
      if (active === null || active.state === 'exited') return;
      let text = '';
      try {
        text = (await navigator.clipboard?.readText()) ?? '';
      } catch {
        /* Refused or empty: tell the user instead of pretending the paste worked. */
        onRefused?.(t('editor.clipboardReadFailed'));
        return;
      }
      if (await writeTerminalText(emulator, active, text, t)) onPasted?.(text);
    }

    /**
     * How many terminal tabs fit in the strip at IDEA's minimum tab width.
     *
     * The dock is narrow and the tab strip does not wrap, so past a handful of
     * shells every label is squeezed to an unreadable stub. Measuring the strip
     * against a fixed minimum lets the tab bar collapse the overflow into IDEA's
     * `»` dropdown instead of shrinking every tab.
     * @param {number} width - strip width in pixels, 0 when unmeasured.
     * @param {number} count - how many tabs exist.
     * @param {number} [reserve=30] - width kept for the `»` button itself.
     * @returns {number} how many leading tabs to render; `count` when all fit.
     */
    function visibleTabCount(width, count, reserve = 30) {
      if (!Number.isFinite(width) || width <= 0) return count;
      if (!Number.isFinite(count) || count <= 0) return 0;
      /* 92px is IDEA's practical minimum for a legible "zsh — project" label. */
      const perTab = 92;
      const fits = Math.max(0, Math.floor((width - reserve) / perTab));
      if (fits >= count) return count;
      return Math.max(1, fits);
    }

    /**
     * Split the dock's tabs into the visible strip and IDEA's `»` overflow list.
     *
     * The active tab always stays in the strip — a selected terminal whose tab
     * lives only in a dropdown looks like the click did nothing — so it displaces
     * the last plain tab of the visible run.
     * @param {object[]} terminals - tabs in their user-ordered sequence.
     * @param {number} visibleCount - how many fit (see {@link visibleTabCount}).
     * @param {string|null} activeId - the currently focused terminal's id.
     * @returns {{visible: object[], hidden: object[]}} strip and overflow tabs.
     */
    function overflowTabs(items, visibleCount, activeId, idOf = (item) => item?.id) {
      const list = Array.isArray(items) ? items : [];
      const keep = Math.max(0, Math.min(visibleCount, list.length));
      const visible = list.slice(0, keep);
      const active = list.find((item) => idOf(item) === activeId);
      if (active !== undefined && !visible.includes(active) && visible.length > 0) {
        visible[visible.length - 1] = active;
      }
      const shown = new Set(visible.map((item) => idOf(item)));
      /* Identity comes from `idOf`, NOT `.id`: file tabs carry `path` instead, and
         reading `.id` made every file look identical (`undefined`), so the overflow
         list came back empty and no `»` was ever rendered. */
      return { visible, hidden: list.filter((item) => !shown.has(idOf(item))) };
    }

    /**
     * Move one tab to the before/after slot of another tab.
     *
     * React gets the original array for invalid or no-op drops, so a missed
     * drag does not trigger a full tab-strip render. The target index is
     * recalculated after removing the source, which makes left-to-right moves
     * land on the side the insertion hint showed.
     * @param {object[]|string[]} items - ordered tabs.
     * @param {string} sourceId - dragged tab identity.
     * @param {string} targetId - tab under the pointer.
     * @param {boolean} after - insert after the target instead of before.
     * @param {(item: object|string) => string} [idOf] - tab identity.
     * @returns {object[]|string[]} reordered list, or the same list for a no-op.
     */
    function reorderTabPaths(items, sourceId, targetId, after = false, idOf = (item) => item?.id) {
      const list = Array.isArray(items) ? items : [];
      if (typeof sourceId !== 'string' || typeof targetId !== 'string' || sourceId === targetId) return list;
      const from = list.findIndex((item) => idOf(item) === sourceId);
      if (from < 0 || !list.some((item) => idOf(item) === targetId)) return list;
      const next = [...list];
      const [moved] = next.splice(from, 1);
      const targetIndex = next.findIndex((item) => idOf(item) === targetId);
      if (targetIndex < 0) return list;
      next.splice(targetIndex + (after === true ? 1 : 0), 0, moved);
      return next;
    }

    /**
     * An invisible xterm that only measures the dock's grid.
     *
     * Before the first shell exists there is no PTY and therefore no `cols`/`rows`
     * to spawn with — the old code guessed 80×24. zsh's PROMPT_SP pads its `%`
     * marker to the PTY width and erases it with a backspacing space, so a PTY
     * wider than the screen leaves that `%` wrapped onto the row above the
     * prompt. Fitting a real emulator to the real box gives the honest number.
     * @param {{fontSize: number, onGrid: Function}} props - font size and grid sink.
     * @returns {object} a zero-opacity xterm host.
     */
    function MeasuringScreen({ fontSize, onGrid }) {
      const hostRef = React.useRef(null);
      const handlersRef = React.useRef({ onGrid });
      handlersRef.current = { onGrid };
      React.useEffect(() => {
        const node = hostRef.current;
        if (node === null) return undefined;
        let disposed = false;
        let emulator = null;
        let observer = null;
        loadXterm().then(
          ({ Terminal, FitAddon }) => {
            if (disposed || node === null) return;
            emulator = new Terminal({
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize,
              lineHeight: 1.25,
              scrollback: 1,
            });
            const fit = new FitAddon();
            emulator.loadAddon(fit);
            emulator.open(node);
            const measure = () => {
              if (node.clientWidth === 0 || node.clientHeight === 0) return;
              fit.fit();
              handlersRef.current.onGrid?.({ cols: Math.max(2, Math.min(500, emulator.cols)), rows: Math.max(1, Math.min(200, emulator.rows)) });
            };
            measure();
            if (typeof ResizeObserver !== 'undefined') {
              observer = new ResizeObserver(measure);
              observer.observe(node);
            }
          },
          () => {
            /* Measuring is an optimisation: a failure keeps the 80×24 fallback. */
          },
        );
        return () => {
          disposed = true;
          observer?.disconnect();
          emulator?.dispose();
        };
      }, [fontSize]);
      return React.createElement('div', {
        ref: hostRef,
        style: styles.terminalMeasure,
        'aria-hidden': 'true',
        'data-dsh-terminal-measure': '',
      });
    }

    /**
     * One xterm screen bound to a host terminal id.
     *
     * Used once for the dock and twice when the dock is split, so the effects that
     * own the emulator, the output stream, the PTY grid and the find highlight are
     * shared by both panes instead of being duplicated.
     */
