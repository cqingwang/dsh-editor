/* editor-core.js: dsh-editor client module. Generated into lib/client.js by scripts/build-client.mjs. */
    function translate(bind, dictionaries) {
      const zhFlat = flattenDictionary(dictionaries.zh);
      const enFlat = flattenDictionary(dictionaries.en);
      return (key, params) => {
        let text = bind(key);
        if (text === key) {
          const preferred = (navigator.language ?? '').toLowerCase().startsWith('zh') ? zhFlat : enFlat;
          text = preferred[key] ?? zhFlat[key] ?? enFlat[key] ?? key;
        }
        return interpolateMessage(text, params);
      };
    }

    /** Read the current Session id from the conversation body. */
    function currentSessionId() {
      const body = document.querySelector('[data-conversation-region="chat"]');
      return body?.getAttribute('data-conversation-session') ?? '';
    }

    /**
     * Read the workspace chosen by the Project/Commit entry point.
     *
     * The session body is absent or belongs to another workspace when the user
     * enters from a workspace `... → Editor` item before opening a conversation.
     * The Editor's own root carries that entry scope, so file and git requests
     * can stay bound to the clicked workspace instead of falling back to an
     * empty "Workspace" tree.
     * @returns {string} workspace id, or an empty string for session scope.
     */
    function currentEditorWorkspaceId() {
      const activeHost = document.querySelector('[data-dsh-editor-host]:not([data-dsh-editor-host-idle]) [data-dsh-editor-workspace]');
      const host = activeHost ?? document.querySelector('[data-dsh-editor-workspace]');
      return host?.getAttribute('data-dsh-workspace-id') ?? '';
    }

    /**
     * Read the exact live editor selection for Find/Replace in Files.
     *
     * The query is not trimmed: IDEA preserves selected whitespace and
     * multiline text in the content field. An empty/collapsed selection
     * returns an empty string so callers keep their existing query.
     * @param {object|null} editor - Monaco editor instance.
     * @returns {string} selected text, or an empty string.
     */
    function selectedEditorFindQuery(editor) {
      const model = editor?.getModel?.() ?? null;
      const selection = editor?.getSelection?.() ?? null;
      if (model === null || selection === null || typeof selection.isEmpty !== 'function' || selection.isEmpty()) return '';
      return String(model.getValueInRange(selection) ?? '');
    }

    /**
     * Convert a Monaco editor's live selection into a Harness reference range.
     * @param {object|null} editor - Monaco editor instance.
     * @returns {{path: string, line: number, column: number, endLine: number|null, endColumn: number|null}|null} reference location.
     */
    function harnessEditorLocation(editor) {
      const model = editor?.getModel?.() ?? null;
      const path = navigationPathForModel(model);
      if (path === '') return null;
      const selection = editor?.getSelection?.() ?? null;
      const empty = selection === null || typeof selection.isEmpty !== 'function' || selection.isEmpty();
      if (empty === false) {
        let startLine = Math.max(1, Math.floor(Number(selection.startLineNumber) || 1));
        let startColumn = Math.max(1, Math.floor(Number(selection.startColumn) || 1));
        let endLine = Math.max(1, Math.floor(Number(selection.endLineNumber) || startLine));
        let endColumn = Math.max(1, Math.floor(Number(selection.endColumn) || startColumn));
        if (endLine < startLine || (endLine === startLine && endColumn < startColumn)) {
          [startLine, endLine] = [endLine, startLine];
          [startColumn, endColumn] = [endColumn, startColumn];
        }
        return { path, line: startLine, column: startColumn, endLine, endColumn };
      }
      const position = editor?.getPosition?.() ?? null;
      return {
        path,
        line: Math.max(1, Math.floor(Number(position?.lineNumber) || 1)),
        column: Math.max(1, Math.floor(Number(position?.column) || 1)),
        endLine: null,
        endColumn: null,
      };
    }

    /**
     * Build the authenticated same-origin URL for one workspace image.
     * @param {string} path - workspace-relative image path.
     * @param {number|null|undefined} version - file mtime used to invalidate the image cache.
     * @returns {string} browser image source.
     */
    function imagePreviewUrl(path, version) {
      const query = new URLSearchParams({
        sessionId: currentSessionId(),
        workspaceId: currentEditorWorkspaceId(),
        path,
        version: String(version ?? ''),
      });
      return `api/dsh-editor/image?${query}`;
    }

    /**
     * Resolve the cache revision owned by one image's containing directory.
     * @param {string} path - workspace-relative image path.
     * @param {{global?: number, directories?: object}} revisions - workspace revisions.
     * @returns {number} monotonic cache key component.
     */
    function markdownAssetRevisionForPath(path, revisions) {
      const directory = dirname(path);
      const global = Math.max(0, Math.floor(Number(revisions?.global) || 0));
      const local = Math.max(0, Math.floor(Number(revisions?.directories?.[directory]) || 0));
      return global + local;
    }

    /**
     * Advance the revision for directories whose file listing or contents changed.
     *
     * A null directory hint means the host could not localize the change, so all
     * Markdown images must be invalidated. An empty list is a confirmed no-op.
     * @param {{global?: number, directories?: object}} current - workspace revisions.
     * @param {string[]|null} changedListings - changed workspace-relative directories.
     * @returns {{global: number, directories: object}} next revisions.
     */
    function nextMarkdownAssetRevisions(current, changedListings) {
      const directories = { ...(current?.directories ?? {}) };
      if (changedListings === null) {
        return {
          global: Math.max(0, Math.floor(Number(current?.global) || 0)) + 1,
          directories,
        };
      }
      for (const directory of new Set(Array.isArray(changedListings) ? changedListings : [])) {
        if (typeof directory !== 'string') continue;
        directories[directory] = Math.max(0, Math.floor(Number(directories[directory]) || 0)) + 1;
      }
      return {
        global: Math.max(0, Math.floor(Number(current?.global) || 0)),
        directories,
      };
    }

    /**
     * Resolve one authored Markdown image destination beside the open document.
     *
     * The host Markdown primitive calls this only for image nodes. Keeping the
     * workspace boundary in resolveMarkdownLink prevents authored `../` paths
     * from turning into arbitrary file reads, while the image extension guard
     * matches the host's native-preview whitelist.
     * @param {string} basePath - workspace-relative Markdown document path.
     * @param {string} target - authored image destination.
     * @param {string} workspaceRoot - absolute workspace root reported by the host.
     * @param {object} imageVersions - image path -> cache version map.
     * @param {string} [baseUri] - application base URI.
     * @returns {string|undefined} image URL accepted by the host Markdown primitive.
     */
    function markdownWorkspaceImageUrl(basePath, target, workspaceRoot, imageVersions = null, baseUri = document.baseURI) {
      const resolved = resolveMarkdownLink(basePath, target);
      if (resolved === null || !isImagePreviewPath(resolved) || typeof workspaceRoot !== 'string') return undefined;
      const root = workspaceRoot.replaceAll('\\', '/').replace(/\/+$/u, '');
      if (root === '') return undefined;
      const query = new URLSearchParams({ path: `${root}/${resolved}` });
      const revision = markdownAssetRevisionForPath(resolved, imageVersions);
      if (revision > 0) query.set('v', String(revision));
      return new URL(`api/file?${query}`, baseUri).href;
    }

    /**
     * Stable key for terminal processes and terminal-only preferences.
     *
     * An Editor opened from a workspace row must not reuse the conversation
     * session's terminal pool: the visible chat may belong to another project.
     * The host derives the same `workspace:<id>` key for API calls.
     * @returns {string} workspace or session scope, or '' before either exists.
     */
    function currentTerminalScope() {
      const workspaceId = currentEditorWorkspaceId();
      if (workspaceId !== '') return `workspace:${workspaceId}`;
      return currentSessionId();
    }

    /**
     * The host may still be replacing an older workspace API registration while
     * the browser has already loaded a newer client. Recognize that narrow
     * response so text search can retry once instead of flashing raw host text.
     * @param {object|undefined} data - parsed host response.
     * @param {string} operation - requested operation.
     * @returns {boolean} whether the host explicitly rejected the operation.
     */
    function fileApiMissingOperation(data, operation) {
      const message = String(data?.error?.message ?? '');
      return data?.ok === false
        && message.toLowerCase().includes('unknown operation')
        && message.includes(`"${operation}"`);
    }

    /**
     * Hide the transitional host operation-table error behind a stable,
     * localized recovery message. Other search failures retain their detail.
     * @param {unknown} failure - rejected file API request.
     * @param {Function} t - locale translator.
     * @returns {string} user-facing search failure.
     */
    function searchTextFailureMessage(failure, t) {
      const message = failure instanceof Error ? failure.message : String(failure);
      return /unknown operation\s+"searchText"/iu.test(message)
        ? t('editor.searchTextServiceUnavailable')
        : message;
    }

    /**
     * Post one workspace file API request with the active workspace identity.
     * @param {object} payload - operation-specific request body.
     * @param {{signal?: AbortSignal}} [options] - transport cancellation.
     * @returns {Promise<{response: Response, data: object}>} HTTP and JSON results.
     */
    async function requestFileApi(payload, options = {}) {
      const sessionId = currentSessionId();
      const workspaceId = currentEditorWorkspaceId();
      if (sessionId === '' && workspaceId === '') throw new Error('no active Session or workspace');
      const response = await fetch('api/dsh-editor/fs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, workspaceId, ...payload }),
        signal: options.signal,
      });
      const data = await response.json().catch(() => ({}));
      return { response, data };
    }

    /**
     * Call the host workspace file API.
     * @param {object} payload - operation-specific request body.
     * @param {{signal?: AbortSignal}} [options] - transport cancellation.
     * @returns {Promise<object>} host operation value.
     */
    async function callFs(payload, options = {}) {
      let { response, data } = await requestFileApi(payload, options);
      if (payload?.op === 'searchText' && fileApiMissingOperation(data, 'searchText')) {
        /* Host hot-reload can briefly expose an older operation table. One
           bounded retry avoids turning that transition into a user-visible
           Search Everywhere error. */
        await new Promise((resolve) => window.setTimeout(resolve, 60));
        ({ response, data } = await requestFileApi(payload, options));
      }
      if (!response.ok) throw new Error(`file API HTTP ${response.status}`);
      if (data?.ok !== true) throw new Error(data?.error?.message ?? 'file API failed');
      return data.value;
    }

    /** Call the host git API. */
    async function callGit(payload, options = {}) {
      const sessionId = currentSessionId();
      const workspaceId = currentEditorWorkspaceId();
      if (sessionId === '' && workspaceId === '') throw new Error('no active Session or workspace');
      const controller = new AbortController();
      let timedOut = false;
      const timer = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, 20000);
      const abortExternal = () => controller.abort();
      if (options.signal?.aborted === true) controller.abort();
      else options.signal?.addEventListener('abort', abortExternal, { once: true });
      try {
        const response = await fetch('api/dsh-editor/git', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId, workspaceId, ...payload }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`git API HTTP ${response.status}`);
        const data = await response.json();
        if (data?.ok !== true) throw new Error(data?.error?.message ?? 'git API failed');
        return data.value;
      } catch (error) {
        if (timedOut) throw new Error('git request timed out after 20 seconds');
        throw error;
      } finally {
        window.clearTimeout(timer);
        options.signal?.removeEventListener('abort', abortExternal);
      }
    }

    /** Pick a Monaco theme from the page's color scheme. */
    function detectTheme() {
      const root = document.documentElement;
      const explicit = root.dataset.theme ?? root.dataset.colorScheme ?? '';
      if (/dark/i.test(explicit)) return 'vs-dark';
      if (/light/i.test(explicit)) return 'vs';
      return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches === true ? 'vs-dark' : 'vs';
    }

    /**
     * IDEA's Editor / Editor and Preview / Preview switch.
     * @param {{mode: 'code'|'split'|'preview', onMode: Function, t: Function}} props - active mode and callback.
     * @returns {object} React element.
     */
    function MarkdownModeSwitch({ mode, onMode, t }) {
      const options = [
        { id: 'code', icon: 'code', label: t('editor.markdownModeCode') },
        { id: 'split', icon: 'split', label: t('editor.markdownModeSplit') },
        { id: 'preview', icon: 'eye', label: t('editor.markdownModePreview') },
      ];
      return React.createElement(
        'div',
        {
          style: styles.markdownModeBar,
          role: 'group',
          'aria-label': t('editor.markdownPreview'),
          'data-dsh-markdown-mode': mode,
        },
        options.map((option) =>
          React.createElement(
            'button',
            {
              key: option.id,
              type: 'button',
              style: {
                ...styles.markdownModeButton,
                ...(mode === option.id ? styles.markdownModeButtonActive : null),
              },
              title: option.label,
              'aria-label': option.label,
              'aria-pressed': mode === option.id,
              onClick: () => onMode(option.id),
            },
            React.createElement(Icon, { name: option.icon, size: 13 }),
          ),
        ),
      );
    }

    /**
     * Render Markdown with the host's own Markdown primitive.
     *
     * Reusing MarkdownText keeps code fences, tables, task lists, links and
     * sanitisation consistent with Chat instead of introducing a second parser.
     * @param {{t: Function, path: string, content: string, workspaceRoot: string, assetRevisions?: object, visible?: boolean, onOpenFile: Function, paneRef?: object}} props - preview state.
     * @returns {object} React element.
     */
    function MarkdownPreviewPane({
      t,
      path,
      content,
      workspaceRoot,
      assetRevisions = null,
      visible = true,
      onOpenFile,
      paneRef = null,
    }) {
      const MarkdownText = primitives?.MarkdownText ?? null;
      const Provider = primitives?.MarkdownDelegateProvider ?? null;
      const [linkError, setLinkError] = React.useState(null);
      const labels = React.useMemo(() => ({
        code: {
          copyLabel: t('editor.markdownCopyCode'),
          copiedLabel: t('editor.markdownCopiedCode'),
          toolbarLabels: {
            codeLabel: t('editor.markdownCodeBlock'),
            wrapLabel: t('editor.markdownWrapCode'),
            unwrapLabel: t('editor.markdownUnwrapCode'),
          },
        },
        footnotes: t('editor.markdownFootnotes'),
      }), [t]);
      const pathImages = React.useMemo(() => ({
        resolve: (value) => markdownWorkspaceImageUrl(path, value, workspaceRoot, assetRevisions),
      }), [path, workspaceRoot, assetRevisions]);
      const getTriggerProps = React.useCallback(() => undefined, []);
      const openLocal = React.useCallback((target) => {
        const resolved = resolveMarkdownLink(path, target);
        if (resolved === null) {
          setLinkError(null);
          return;
        }
        setLinkError(null);
        Promise.resolve(onOpenFile?.(resolved))
          .then((opened) => {
            if (opened === false) setLinkError(t('editor.markdownLinkOpenFailed', { path: resolved }));
          })
          .catch(() => setLinkError(t('editor.markdownLinkOpenFailed', { path: resolved })));
      }, [onOpenFile, path, t]);
      const openExternal = React.useCallback((target) => {
        if (typeof target === 'string' && target !== '') window.open(target, '_blank', 'noopener,noreferrer');
      }, []);
      const body = MarkdownText === null
        ? React.createElement('pre', { style: styles.markdownPreviewFallback }, content)
        : React.createElement(MarkdownText, { text: content, labels, pathImages });
      return React.createElement(
        'div',
        {
          ref: paneRef,
          style: { ...styles.markdownPreviewPane, display: visible ? 'block' : 'none' },
          className: 'dsh-editor-markdown-preview',
          role: 'document',
          'aria-label': t('editor.markdownPreview'),
          'data-dsh-markdown-preview': '',
          'data-dsh-markdown-preview-pane': '',
          'data-dsh-markdown-preview-path': path,
        },
        React.createElement(
          'div',
          { style: styles.markdownPreviewContent },
          linkError === null
            ? null
            : React.createElement(
                'div',
                {
                  className: 'dsh-editor-markdown-link-error',
                  style: styles.markdownLinkError,
                  role: 'alert',
                  'data-dsh-markdown-link-error': '',
                },
                linkError,
              ),
          Provider === null
            ? body
            : React.createElement(Provider, {
                getTriggerProps,
                openFile: openLocal,
                openExternalLink: openExternal,
                children: body,
              }),
        ),
      );
    }

    /**
     * Render one image with the browser's native decoder inside an editor tab.
     * @param {{t: Function, path: string, src: string, mediaType?: string, onActivate?: Function}} props - image preview.
     * @returns {object} React element.
     */
    function ImagePreviewPane({ t, path, src, mediaType = '', onActivate }) {
      const [state, setState] = React.useState({ status: 'loading', width: 0, height: 0 });
      React.useEffect(() => {
        setState({ status: 'loading', width: 0, height: 0 });
      }, [src]);
      return React.createElement(
        'div',
        {
          style: styles.imagePreviewPane,
          className: 'dsh-editor-image-preview',
          tabIndex: 0,
          role: 'group',
          'aria-label': t('editor.imagePreview'),
          'data-dsh-editor-image-preview': path,
          'data-dsh-editor-image-media-type': mediaType,
          onFocus: () => onActivate?.(),
          onPointerDown: () => onActivate?.(),
        },
        state.status === 'loading'
          ? React.createElement(
              'div',
              { style: styles.imagePreviewNotice, role: 'status' },
              t('editor.imagePreviewLoading'),
            )
          : null,
        state.status === 'error'
          ? React.createElement(
              'div',
              { style: styles.imagePreviewError, role: 'alert' },
              t('editor.imagePreviewFailed', { path }),
            )
          : null,
        React.createElement('img', {
          src,
          alt: basename(path),
          draggable: false,
          style: {
            ...styles.imagePreviewImage,
            display: state.status === 'error' ? 'none' : 'block',
          },
          'data-dsh-editor-image-preview-asset': '',
          onLoad: (event) => setState({
            status: 'loaded',
            width: event.currentTarget.naturalWidth,
            height: event.currentTarget.naturalHeight,
          }),
          onError: () => setState({ status: 'error', width: 0, height: 0 }),
        }),
        state.status === 'loaded'
          ? React.createElement(
              'div',
              { style: styles.imagePreviewMeta },
              `${state.width} × ${state.height}`,
            )
          : null,
      );
    }

    /**
     * Build the workspace tab record returned by either text read or image metadata.
     * @param {string} path - workspace-relative file path.
     * @param {object} value - host response.
     * @param {boolean} imagePreview - whether this path is rendered as an image.
     * @returns {object} open-file state.
     */
    function workspaceFileFromResponse(path, value, imagePreview) {
      return imagePreview
        ? { path, content: '', dirty: false, mtime: value.mtime ?? null, kind: 'image', size: value.size ?? 0, mediaType: value.mediaType ?? '' }
        : { path, content: value.content, dirty: false, mtime: value.mtime ?? null };
    }

    /** Choose the host reload operation for one open workspace tab. */
    function workspaceReloadOperation(file) {
      return file?.kind === 'image' ? 'image' : 'read';
    }

    /** Apply one host reload response while preserving the tab's media kind. */
    function workspaceFileAfterReload(file, value) {
      return file?.kind === 'image'
        ? {
            ...file,
            dirty: false,
            size: value.size ?? file.size,
            mtime: value.mtime ?? file.mtime,
            mediaType: value.mediaType ?? file.mediaType,
          }
        : {
            ...file,
            content: value.content,
            dirty: false,
            mtime: value.mtime ?? file.mtime,
          };
    }

    /** Create the native image surface used by the editor and right split. */
    function workspaceImagePreviewElement(t, path, file, onActivate) {
      return React.createElement(ImagePreviewPane, {
        key: path,
        t,
        path,
        src: imagePreviewUrl(path, file?.mtime),
        mediaType: file?.mediaType ?? '',
        onActivate: () => onActivate?.(path),
      });
    }

    /** Render text caret facts or the image-specific editor status. */
    function EditorStatusFacts({ t, file, caret, fileMode, lineStats }) {
      if (file?.kind === 'image') return React.createElement('span', { style: styles.statusItem }, t('editor.imagePreview'));
      return React.createElement(
        React.Fragment,
        null,
        React.createElement('span', { style: styles.statusItem }, t('editor.statusBarPosition', { line: caret.line, column: caret.column })),
        React.createElement('span', { style: styles.statusItem }, fileMode.encoding),
        React.createElement('span', { style: styles.statusItem }, t('editor.lineCount', { count: lineStats.lines })),
      );
    }

    /** Monotonic id source for per-editor Monaco context-key scopes. */
    let codeEditorGroupSequence = 0;

    /**
     * Remove selected built-in actions from Monaco's editor context menu.
     *
     * Monaco does not expose the menu registry it uses for built-in actions.
     * Its ContextMenuController owns the final action list, so wrap that one
     * seam and restore it when this editor group is disposed.
     * @param {object} editor - Monaco standalone editor.
     * @param {string[]} hiddenActionIds - action ids that must not be rendered.
     * @returns {Function} restores the previous menu action resolver.
     */
    function filterMonacoContextMenuActions(editor, hiddenActionIds) {
      const hidden = new Set(hiddenActionIds);
      const controller = editor?.getContribution?.('editor.contrib.contextmenu') ?? null;
      const original = controller?._getMenuActions;
      if (typeof original !== 'function') return () => {};
      const filtered = function (...args) {
        return original.apply(this, args).filter((action) => {
          const id = String(action?.id ?? '');
          for (const hiddenId of hidden) {
            if (id === hiddenId || id.endsWith(`:${hiddenId}`)) return false;
          }
          return true;
        });
      };
      controller._getMenuActions = filtered;
      return () => {
        if (controller._getMenuActions === filtered) controller._getMenuActions = original;
      };
    }

    /**
     * Create one independent Monaco editor group.
     *
     * The group owns only its editor instance and local actions. Models stay in
     * the workspace-wide model map so future split groups can share them without
     * one pane disposing another pane's document.
     * @param {object} monaco - Monaco global namespace.
     * @param {HTMLElement} container - host element.
     * @param {{onSave?: Function, onFind?: Function, onSearchText?: Function, onFindUsages?: Function, onFindUsagesInFile?: Function, onFindInFiles?: Function, onReplaceInFiles?: Function, onReplace?: Function, onIncrementalSearch?: Function, onFindInSelection?: Function, onReplaceInSelection?: Function, textSearchLabel?: string, findUsagesLabel?: string, findUsagesInFileLabel?: string, highlightUsagesInFileLabel?: string, findWordAtCaretLabel?: string, previousWordOccurrenceLabel?: string, replaceLabel?: string, incrementalSearchLabel?: string, findInSelectionLabel?: string, replaceInSelectionLabel?: string, findInFilesLabel?: string, replaceInFilesLabel?: string, selectAllOccurrencesLabel?: string, selectNextOccurrenceLabel?: string, unselectPreviousOccurrenceLabel?: string, searchWebLabel?: string, onSaveAll?: Function, onGotoLine?: Function, gotoLineLabel?: string, onGoToDefinition?: Function, goToDefinitionLabel?: string, onNavigateBack?: Function, onNavigateForward?: Function, navigationBackLabel?: string, navigationForwardLabel?: string, onCloseTab?: Function}} handlers - shortcut actions.
     * @returns {{editor: object, dispose: Function}} editor group controller.
     */
    function createCodeEditorGroup(monaco, container, handlers) {
      const actionsHandlers = handlers ?? {};
      const groupId = ++codeEditorGroupSequence;
      const findUsagesPrecondition = `dshEditorFindUsagesAvailable${groupId}`;
      const findSelectionPrecondition = `dshEditorFindSelectionAvailable${groupId}`;
      const platform = navigator.userAgentData?.platform ?? navigator.platform;
      const macPlatform = isMacPlatform(platform);
      const ideaControlModifier = ideaControlKeyModifier(
        monaco,
        platform,
      );
      const findUsagesInFileKeybindings = [
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.F7,
        ...(macPlatform ? [ideaControlModifier | monaco.KeyMod.Shift | monaco.KeyCode.KeyU] : []),
      ];
      const highlightUsagesInFileKeybindings = [
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.F7,
        ...(macPlatform ? [monaco.KeyMod.CtrlCmd | ideaControlModifier | monaco.KeyCode.KeyU] : []),
      ];
      const editor = monaco.editor.create(container, {
        value: '',
        language: 'plaintext',
        theme: detectTheme(),
        automaticLayout: true,
        fontSize: EDITOR_CODE_FONT_SIZE,
        lineHeight: EDITOR_CODE_LINE_HEIGHT,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'off',
        tabSize: 2,
        renderWhitespace: 'selection',
        /* The tool window owns find/replace, so Monaco's own widget stays closed. */
        find: { addExtraSpaceOnTop: false, autoFindInSelection: 'never', seedSearchStringFromSelection: 'never' },
        fontFamily: EDITOR_UI_FONT,
      });
      const findUsagesContextKey = editor.createContextKey?.(findUsagesPrecondition, false) ?? null;
      const findSelectionContextKey = editor.createContextKey?.(findSelectionPrecondition, false) ?? null;
      const restoreContextMenuActions = filterMonacoContextMenuActions(editor, ['editor.action.quickCommand']);
      const updateFindUsagesAvailability = () => {
        const queryAvailable = findUsagesSearchTarget(editor).query !== '';
        findUsagesContextKey?.set(queryAvailable);
        findSelectionContextKey?.set(queryAvailable && editorFindSelectionScope(editor) !== null);
      };
      const runSearchCommand = (command) => {
        const action = editor.getAction?.(command) ?? null;
        if (action === null) return;
        void Promise.resolve(action.run?.()).finally(() => editor.focus?.());
      };
      const actions = [
        editor.addAction({
          id: 'dsh-editor.save',
          label: 'Save file',
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
          run: () => actionsHandlers.onSave?.(),
        }),
        editor.addAction({
          id: `dsh-editor.sendHarnessReference.${groupId}`,
          label: actionsHandlers.sendHarnessReferenceLabel ?? 'Harness->',
          /* Monaco always orders its navigation group first. A lower order
             inside that group keeps this high-frequency action above Go to
             Declaration and the language-service entries. */
          contextMenuGroupId: 'navigation',
          contextMenuOrder: -100,
          run: (editorInstance) => actionsHandlers.onSendHarnessReference?.(editorInstance),
        }),
        editor.addAction({
          id: 'dsh-editor.find',
          label: 'Find',
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF],
          run: () => actionsHandlers.onFind?.(),
        }),
        editor.addAction({
          id: 'dsh-editor.textSearch',
          label: actionsHandlers.textSearchLabel ?? 'Text…',
          keybindings: [ideaControlModifier | monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyE],
          run: () => actionsHandlers.onSearchText?.(),
        }),
        editor.addAction({
          id: 'dsh-editor.saveAll',
          label: 'Save All',
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyS],
          run: () => actionsHandlers.onSaveAll?.(),
        }),
        editor.addAction({
          id: 'dsh-editor.gotoLine',
          label: actionsHandlers.gotoLineLabel ?? 'Go to Line/Column',
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL],
          run: () => actionsHandlers.onGotoLine?.(),
        }),
        editor.addAction({
          id: 'dsh-editor.goToDefinition',
          label: actionsHandlers.goToDefinitionLabel ?? 'Go to Declaration',
          keybindings: [
            monaco.KeyMod.CtrlCmd | monaco.KeyCode.F12,
            monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB,
          ],
          contextMenuGroupId: 'navigation',
          contextMenuOrder: 1.0,
          run: (editorInstance) => {
            const position = editorInstance.getPosition?.() ?? null;
            if (position !== null) void actionsHandlers.onGoToDefinition?.(editorInstance, position);
          },
        }),
        editor.addAction({
          id: 'dsh-editor.navigateBack',
          label: actionsHandlers.navigationBackLabel ?? 'Back',
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.BracketLeft],
          run: () => actionsHandlers.onNavigateBack?.(),
        }),
        editor.addAction({
          id: 'dsh-editor.navigateForward',
          label: actionsHandlers.navigationForwardLabel ?? 'Forward',
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.BracketRight],
          run: () => actionsHandlers.onNavigateForward?.(),
        }),
        editor.addAction({
          id: `dsh-editor.findUsages.${groupId}`,
          label: actionsHandlers.findUsagesLabel ?? 'Find Usages',
          precondition: findUsagesPrecondition,
          run: () => actionsHandlers.onFindUsages?.(editor),
        }),
        editor.addAction({
          id: `dsh-editor.selectAllOccurrences.${groupId}`,
          label: actionsHandlers.selectAllOccurrencesLabel ?? 'Select All Occurrences',
          precondition: findUsagesPrecondition,
          contextMenuGroupId: 'navigation',
          contextMenuOrder: 1.2,
          run: () => runSearchCommand('editor.action.selectHighlights'),
        }),
        editor.addAction({
          id: `dsh-editor.selectNextOccurrence.${groupId}`,
          label: actionsHandlers.selectNextOccurrenceLabel ?? 'Add Selection for Next Occurrence',
          precondition: findUsagesPrecondition,
          contextMenuGroupId: 'navigation',
          contextMenuOrder: 1.3,
          run: () => runSearchCommand('editor.action.addSelectionToNextFindMatch'),
        }),
        editor.addAction({
          id: `dsh-editor.unselectPreviousOccurrence.${groupId}`,
          label: actionsHandlers.unselectPreviousOccurrenceLabel ?? 'Unselect Occurrence',
          precondition: findUsagesPrecondition,
          contextMenuGroupId: 'navigation',
          contextMenuOrder: 1.4,
          run: () => runSearchCommand('cursorUndo'),
        }),
        editor.addAction({
          id: `dsh-editor.searchWeb.${groupId}`,
          label: actionsHandlers.searchWebLabel ?? 'Browser Search',
          precondition: findUsagesPrecondition,
          contextMenuGroupId: 'navigation',
          contextMenuOrder: 1.5,
          run: () => {
            const query = findUsagesSearchTarget(editor).query;
            if (query === '') return;
            window.open(
              `https://www.google.com/search?q=${encodeURIComponent(query)}`,
              '_blank',
              'noopener,noreferrer',
            );
          },
        }),
        editor.addAction({
          id: `dsh-editor.findInFiles.${groupId}`,
          label: actionsHandlers.findInFilesLabel ?? 'Find in Files…',
          precondition: findUsagesPrecondition,
          run: () => actionsHandlers.onFindInFiles?.(editor),
        }),
        editor.addAction({
          id: `dsh-editor.replaceInFiles.${groupId}`,
          label: actionsHandlers.replaceInFilesLabel ?? 'Replace in Files…',
          precondition: findUsagesPrecondition,
          run: () => actionsHandlers.onReplaceInFiles?.(editor),
        }),
        editor.addAction({
          id: `dsh-editor.findUsagesInFile.${groupId}`,
          label: actionsHandlers.findUsagesInFileLabel ?? 'Find Usages in File',
          keybindings: findUsagesInFileKeybindings,
          precondition: findUsagesPrecondition,
          contextMenuGroupId: 'navigation',
          contextMenuOrder: 1.8,
          run: () => actionsHandlers.onFindUsagesInFile?.(editor),
        }),
        editor.addAction({
          id: `dsh-editor.highlightUsagesInFile.${groupId}`,
          label: actionsHandlers.highlightUsagesInFileLabel ?? 'Highlight Usages in File',
          keybindings: highlightUsagesInFileKeybindings,
          precondition: findUsagesPrecondition,
          contextMenuGroupId: 'navigation',
          contextMenuOrder: 1.9,
          run: () => runSearchCommand('editor.action.wordHighlight.trigger'),
        }),
        editor.addAction({
          id: `dsh-editor.findWordAtCaret.${groupId}`,
          label: actionsHandlers.findWordAtCaretLabel ?? 'Next Occurrence of the Word at Caret',
          keybindings: [ideaControlModifier | monaco.KeyCode.F3],
          precondition: findUsagesPrecondition,
          contextMenuGroupId: 'navigation',
          contextMenuOrder: 2.0,
          run: () => runSearchCommand('editor.action.nextSelectionMatchFindAction'),
        }),
        editor.addAction({
          id: `dsh-editor.previousWordOccurrence.${groupId}`,
          label: actionsHandlers.previousWordOccurrenceLabel ?? 'Previous Occurrence of the Word at Caret',
          keybindings: [ideaControlModifier | monaco.KeyMod.Shift | monaco.KeyCode.F3],
          precondition: findUsagesPrecondition,
          contextMenuGroupId: 'navigation',
          contextMenuOrder: 2.1,
          run: () => runSearchCommand('editor.action.previousSelectionMatchFindAction'),
        }),
        editor.addAction({
          id: `dsh-editor.replace.${groupId}`,
          label: actionsHandlers.replaceLabel ?? 'Replace…',
          precondition: findUsagesPrecondition,
          run: () => actionsHandlers.onReplace?.(editor),
        }),
        editor.addAction({
          id: `dsh-editor.incrementalSearch.${groupId}`,
          label: actionsHandlers.incrementalSearchLabel ?? 'Incremental Search',
          precondition: findUsagesPrecondition,
          run: () => actionsHandlers.onIncrementalSearch?.(editor),
        }),
        editor.addAction({
          id: `dsh-editor.findInSelection.${groupId}`,
          label: actionsHandlers.findInSelectionLabel ?? 'Search in Selection Only',
          precondition: findSelectionPrecondition,
          run: () => actionsHandlers.onFindInSelection?.(editor),
        }),
        editor.addAction({
          id: `dsh-editor.replaceInSelection.${groupId}`,
          label: actionsHandlers.replaceInSelectionLabel ?? 'Replace in Selection Only',
          precondition: findSelectionPrecondition,
          run: () => actionsHandlers.onReplaceInSelection?.(editor),
        }),
        editor.addAction({
          id: 'dsh-editor.closeTab',
          label: 'Close Tab',
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW],
          run: () => actionsHandlers.onCloseTab?.(),
        }),
      ];
      const availabilitySubscriptions = [
        editor.onDidChangeCursorSelection?.(updateFindUsagesAvailability),
        editor.onDidChangeModel?.(updateFindUsagesAvailability),
      ];
      const definitionClickSubscription = editor.onMouseDown?.((event) => {
        const browserEvent = event?.event?.browserEvent ?? null;
        if (browserEvent?.metaKey !== true && browserEvent?.ctrlKey !== true) return;
        const position = event?.target?.position ?? null;
        if (position === null) return;
        event.event?.preventDefault?.();
        void actionsHandlers.onGoToDefinition?.(editor, position);
      });
      updateFindUsagesAvailability();
      let disposed = false;
      return {
        editor,
        dispose() {
          if (disposed) return;
          disposed = true;
          restoreContextMenuActions();
          for (const subscription of availabilitySubscriptions) subscription?.dispose?.();
          definitionClickSubscription?.dispose?.();
          for (const action of actions) action.dispose?.();
          editor.dispose();
        },
      };
    }

    /**
     * Reuse one workspace model for every editor group showing a path.
     * @param {object} monaco - Monaco global namespace.
     * @param {Map<string, object>} models - workspace-wide model registry.
     * @param {string} path - workspace-relative path.
     * @param {string} content - initial content when the model must be created.
     * @returns {object} Monaco text model.
     */
    function ensureEditorModel(monaco, models, path, content) {
      const existing = models.get(path);
      if (existing !== undefined) return existing;
      const uri = monaco.Uri.parse(`file:///${path.split('/').map(encodeURIComponent).join('/')}`);
      const model = monaco.editor.createModel(content, safeLanguage(monaco, path), uri);
      models.set(path, model);
      return model;
    }

    /**
     * Register the diff-only Monaco theme.
     *
     * Monaco draws line and character diff highlights on canvas, so CSS cannot give
     * them IDEA's stronger green/red treatment. A diff-scoped theme keeps the host's
     * syntax palette while setting only the comparison colors and gutter fills.
     * @param {object} monaco - Monaco global namespace.
     * @returns {string} registered theme name.
     */
    function ensureDiffTheme(monaco) {
      const base = detectTheme();
      const id = base === 'vs-dark' ? 'dsh-editor-diff-dark' : 'dsh-editor-diff-light';
      monaco.editor.defineTheme(id, {
        base,
        inherit: true,
        rules: [],
        colors: base === 'vs-dark'
          ? {
              'diffEditor.insertedLineBackground': '#1f6f3b38',
              'diffEditor.removedLineBackground': '#8b2f3438',
              'diffEditor.insertedTextBackground': '#2ea04355',
              'diffEditor.removedTextBackground': '#f8514955',
              'diffEditorGutter.insertedLineBackground': '#1f6f3b2e',
              'diffEditorGutter.removedLineBackground': '#8b2f342e',
              'diffEditorOverview.insertedForeground': '#3fb95088',
              'diffEditorOverview.removedForeground': '#f8514988',
            }
          : {
              'diffEditor.insertedLineBackground': '#1a7f3714',
              'diffEditor.removedLineBackground': '#cf222e14',
              'diffEditor.insertedTextBackground': '#1a7f3738',
              'diffEditor.removedTextBackground': '#cf222e38',
              'diffEditorGutter.insertedLineBackground': '#1a7f3724',
              'diffEditorGutter.removedLineBackground': '#cf222e24',
              'diffEditorOverview.insertedForeground': '#1a7f3777',
              'diffEditorOverview.removedForeground': '#cf222e77',
            },
      });
      return id;
    }

    /**
     * The parent directory of a change, printed the way IDEA prints it.
     *
     * A trailing `/` is what tells the row `r147nest/deep/inner/` is a DIRECTORY
     * and not a second file name; without it `note.md  spark` reads like two
     * files on one row. Root-level files return `''` and the caller substitutes
     * the project name (IDEA shows the module there).
     * @param {string} path - workspace-relative path.
     * @returns {string} the parent path with a trailing slash, or ''.
     */
    function parentDirLabel(path) {
      const parent = dirname(path);
      return parent === '' ? '' : `${parent}/`;
    }

    /** Basename of a workspace-relative path. */
    function basename(path) {
      const index = path.lastIndexOf('/');
      return index < 0 ? path : path.slice(index + 1);
    }

    /** Parent directory of a workspace-relative path. */
    /**
     * Every ancestor directory of one relative path, outermost first.
     * @param {string} path - workspace-relative path.
     * @returns {string[]} ancestor directories, excluding the path itself.
     */
    function ancestorsOf(path) {
      if (typeof path !== 'string' || path === '') return [];
      const parts = path.split('/');
      const ancestors = [];
      for (let index = 1; index < parts.length; index += 1) ancestors.push(parts.slice(0, index).join('/'));
      return ancestors;
    }

    /** Project 首次打开与目录点击默认预取的目录层数。 */
    const PROJECT_PREFETCH_DEPTH = 1;
    /** 单次预取最多读取的目录数，防止异常宽树拖垮 UI。 */
    const PROJECT_PREFETCH_VISIT_LIMIT = 200;

    /**
     * 按可选深度递归展开目录路径，使用 IDEA 风格的有界 BFS。
     *
     * 调用方提供当前 children 缓存和目录读取器。`maxDepth` 从起点算第 1 层；
     * Infinity 保留 Expand Selected / Expand All 的完整递归语义。
     * @param {string[]} startPaths - 要展开的 workspace 相对目录。
     * @param {{expanded?: Set<string>, children?: Record<string, object[]>}} current - 当前树缓存。
     * @param {(path: string) => Promise<object[]>} listDirectory - 读取一个目录。
     * @param {number} [limit=200] - 单次最多读取的目录数。
     * @param {number} [maxDepth=Infinity] - 最多展开的目录层数。
     * @returns {Promise<{expanded: Set<string>, children: Record<string, object[]>, visited: number, truncated: boolean}>} 更新后的缓存。
     */
    async function expandDirectorySubtrees(startPaths, current, listDirectory, limit = 200, maxDepth = Infinity) {
      const expanded = new Set(current?.expanded instanceof Set ? current.expanded : []);
      const children = { ...(current?.children ?? {}) };
      const depthLimit = Number.isFinite(maxDepth) ? Math.max(1, Math.floor(Number(maxDepth) || 1)) : Infinity;
      const queue = [...new Set((Array.isArray(startPaths) ? startPaths : []).filter((path) => typeof path === 'string'))]
        .map((path) => ({ path, depth: 1 }));
      const seen = new Set();
      let visited = 0;
      while (queue.length > 0 && visited < limit) {
        const item = queue.shift();
        const path = item.path;
        if (seen.has(path)) continue;
        seen.add(path);
        let rows = children[path];
        if (!Array.isArray(rows)) {
          try {
            rows = await listDirectory(path);
          } catch {
            continue;
          }
          children[path] = rows;
        }
        expanded.add(path);
        for (const child of rows) {
          if (child?.kind === 'directory' && typeof child.path === 'string' && item.depth < depthLimit) {
            queue.push({ path: child.path, depth: item.depth + 1 });
          }
        }
        visited += 1;
      }
      return {
        expanded,
        children,
        visited,
        truncated: queue.some((item) => !seen.has(item.path)),
      };
    }

    /**
     * 预取目录节点信息，但不改变 UI 的展开集合。
     *
     * 起点按第 1 层计算，默认只读取起点本身。调用方点击某目录时
     * 可以显式把该 clicked path 加入 expanded，后代保持折叠。
     * @param {string[]} startPaths - 需要预取的目录。
     * @param {{children?: Record<string, object[]>}} current - 当前 children 缓存。
     * @param {(path: string) => Promise<object[]>} listDirectory - 目录读取器。
     * @param {number} [limit=200] - 单次最多读取的目录数。
     * @param {number} [maxDepth=1] - 最多预取的目录层数。
     * @returns {Promise<{children: Record<string, object[]>, visited: number, truncated: boolean}>} 预取结果。
     */
    async function prefetchDirectorySubtrees(startPaths, current, listDirectory, limit = 200, maxDepth = 1) {
      const children = { ...(current?.children ?? {}) };
      const depthLimit = Math.max(1, Math.floor(Number(maxDepth) || 1));
      const queue = [...new Set((Array.isArray(startPaths) ? startPaths : []).filter((path) => typeof path === 'string'))]
        .map((path) => ({ path, depth: 1 }));
      const seen = new Set();
      let visited = 0;
      while (queue.length > 0 && visited < limit) {
        const item = queue.shift();
        if (seen.has(item.path)) continue;
        seen.add(item.path);
        let rows = children[item.path];
        if (!Array.isArray(rows)) {
          try {
            rows = await listDirectory(item.path);
          } catch {
            continue;
          }
          children[item.path] = rows;
        }
        for (const child of rows) {
          if (child?.kind === 'directory' && typeof child.path === 'string' && item.depth < depthLimit) {
            queue.push({ path: child.path, depth: item.depth + 1 });
          }
        }
        visited += 1;
      }
      return {
        children,
        visited,
        truncated: queue.some((item) => !seen.has(item.path)),
      };
    }

    function dirname(path) {
      const index = path.lastIndexOf('/');
      return index < 0 ? '' : path.slice(0, index);
    }

    /**
     * Follow a file or directory rename without changing path segments below it.
     *
     * @param {string} path - workspace-relative path currently held by editor state.
     * @param {Array<[string, string]>} entries - old/new roots in operation order.
     * @returns {string} the mapped path, or the original value.
     */
    function remapPathAfterMove(path, entries) {
      if (typeof path !== 'string') return path;
      for (const entry of Array.isArray(entries) ? entries : []) {
        const [from, to] = Array.isArray(entry) ? entry : [];
        if (typeof from !== 'string' || from === '' || typeof to !== 'string' || to === '') continue;
        if (path === from) return to;
        if (path.startsWith(`${from}/`)) return `${to}${path.slice(from.length)}`;
      }
      return path;
    }

    /** Abbreviate a home-prefixed absolute path. */
    /**
     * Split the project root row into the folder NAME and the path beside it.
     *
     * A narrow tool window cannot show both: the path (`~/Documents/project/doc`)
     * used to win and the folder name — the only part that identifies the project
     * — collapsed to an ellipsis. IDEA keeps the name and shortens the path.
     * @param {string} root - absolute workspace root.
     * @param {string} home - the user's home directory, for the `~` form.
     * @returns {{name: string, path: string}} the label parts.
     */
    function splitRootLabel(root, home) {
      const absolute = typeof root === 'string' ? root : '';
      const trimmed = absolute.length > 1 && absolute.endsWith('/') ? absolute.slice(0, -1) : absolute;
      const name = trimmed === '' ? '' : trimmed.slice(trimmed.lastIndexOf('/') + 1);
      return { name, path: abbreviatePath(absolute, home) };
    }

    function abbreviatePath(path, home) {
      if (!path) return '';
      if (home && path === home) return '~';
      if (home && path.startsWith(`${home}/`)) return `~${path.slice(home.length)}`;
      return path;
    }

    /** Monaco language id for a workspace-relative path. */
    function languageFor(path) {
      const name = basename(path).toLowerCase();
      const filenameLanguage = LANGUAGE_BY_FILENAME[name];
      if (filenameLanguage !== undefined) return filenameLanguage;
      if (name.startsWith('dockerfile.') || name.startsWith('containerfile.')) return 'dockerfile';
      if (name.startsWith('.env.')) return 'ini';
      const dot = name.lastIndexOf('.');
      if (dot < 0) return 'plaintext';
      return LANGUAGE_BY_EXTENSION[name.slice(dot + 1)] ?? 'plaintext';
    }

    /** Return a language id only when Monaco knows it. */
    function safeLanguage(monaco, path) {
      const language = languageFor(path);
      return monaco.languages.getLanguages().some((entry) => entry.id === language) ? language : 'plaintext';
    }

    /**
     * Stable local-time filename for a downloaded change patch.
     *
     * @param {Date} [date=new Date()] - timestamp to encode.
     * @returns {string} filesystem-safe `.patch` filename.
     */
    function patchDownloadName(date = new Date()) {
      const value = date instanceof Date ? date : new Date();
      const pad = (part) => String(part).padStart(2, '0');
      return `dsh-editor-changes-${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}-${pad(value.getHours())}${pad(value.getMinutes())}${pad(value.getSeconds())}.patch`;
    }

    /**
     * Stable, filesystem-safe filename for one commit's exported patch.
     *
     * A short hash guarantees distinct commits cannot silently overwrite the
     * same download. The subject is only a readable suffix: controls and
     * reserved path characters become hyphens, whitespace collapses, and the
     * suffix is bounded so CJK subjects still fit common filename limits.
     *
     * @param {string} hash - resolved commit hash.
     * @param {string} subject - commit subject.
     * @returns {string} filesystem-safe `.patch` filename.
     */
    function commitPatchDownloadName(hash, subject) {
      const shortHash = String(hash ?? '').trim().slice(0, 7).replace(/[^0-9a-z]/giu, '') || 'unknown';
      const safeSubject = String(subject ?? '')
        .normalize('NFKC')
        .replace(/[\u0000-\u001f\u007f<>:"\/\\|?*]+/gu, '-')
        .replace(/\s+/gu, '-')
        .replace(/-+/gu, '-')
        .replace(/^[.-]+|[.-]+$/gu, '')
        .slice(0, 48)
        .replace(/[.-]+$/gu, '');
      return `dsh-editor-${shortHash}${safeSubject === '' ? '' : `-${safeSubject}`}.patch`;
    }

    /**
     * Download one text patch through the same Blob URL path used by the local
     * changes exporter.
     *
     * @param {string} patch - complete patch text.
     * @param {string} downloadName - browser download filename.
     * @returns {void}
     */
    function downloadPatchBlob(patch, downloadName) {
      const blob = new Blob([patch], { type: 'text/x-patch;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = downloadName;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      try {
        anchor.click();
      } finally {
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
      }
    }

    let monacoPromise = null;
    /* Monotonic suffix for diff model URIs; see DiffPreview's model swap. */
    let diffLoadSerial = 0;

    /**
     * 修正 Monaco TS/JS worker 与插件 workspace 导航模型之间的诊断差异。
     *
     * Monaco 只认识当前注册的 model，没有完整 tsconfig/project service；
     * extensionless 相对 import 即使能被本插件正确导航，也会产生
     * TS2307/TS2792。这里只忽略 module-not-found 两类假错误，语法错误和
     * 其他 semantic diagnostics 继续保留。
     * @param {object} monaco - Monaco 全局命名空间。
     * @returns {boolean} 是否找到 TypeScript language defaults。
     */
    function configureMonacoLanguageDiagnostics(monaco) {
      const typescript = monaco?.languages?.typescript;
      if (typescript === undefined || typescript === null) return false;
      const diagnosticsOptions = {
        noSemanticValidation: false,
        noSyntaxValidation: false,
        diagnosticCodesToIgnore: [2307, 2792],
      };
      const compilerOptions = {
        moduleResolution: typescript.ModuleResolutionKind?.NodeJs ?? 2,
        module: typescript.ModuleKind?.ESNext ?? 99,
        allowSyntheticDefaultImports: true,
        resolveJsonModule: true,
      };
      typescript.typescriptDefaults?.setDiagnosticsOptions(diagnosticsOptions);
      typescript.javascriptDefaults?.setDiagnosticsOptions(diagnosticsOptions);
      typescript.typescriptDefaults?.setCompilerOptions(compilerOptions);
      typescript.javascriptDefaults?.setCompilerOptions({
        ...compilerOptions,
        allowJs: true,
        checkJs: false,
      });
      return true;
    }

    /** Load Monaco's AMD build through the host asset bridge. */
    function loadMonaco() {
      if (window.monaco?.editor !== undefined) {
        configureMonacoLanguageDiagnostics(window.monaco);
        return Promise.resolve(window.monaco);
      }
      if (monacoPromise !== null) return monacoPromise;
      monacoPromise = new Promise((resolve, reject) => {
        const start = () => {
          const amdRequire = window.require;
          if (typeof amdRequire !== 'function') {
            reject(new Error('Monaco AMD loader did not expose require'));
            return;
          }
          try {
            amdRequire.config({
              paths: { vs: '/api/dsh-editor/monaco/vs' },
              'vs/nls': { availableLanguages: { '*': 'zh-cn' } },
            });
            self.MonacoEnvironment = {
              getWorkerUrl: () => '/api/dsh-editor/monaco/vs/base/worker/workerMain.js',
            };
            amdRequire(['vs/editor/editor.main'], () => {
              configureMonacoLanguageDiagnostics(window.monaco);
              resolve(window.monaco);
            }, reject);
          } catch (error) {
            reject(error);
          }
        };
        const existing = document.querySelector('script[data-dsh-editor-monaco-loader]');
        if (existing !== null) {
          start();
          return;
        }
        const script = document.createElement('script');
        script.src = '/api/dsh-editor/monaco/vs/loader.js';
        script.async = true;
        script.dataset.dshEditorMonacoLoader = '';
        script.onload = start;
        script.onerror = () => reject(new Error('failed to load Monaco loader'));
        document.head.appendChild(script);
      });
      return monacoPromise;
    }

    /** The label and color used by one file-type badge. */
