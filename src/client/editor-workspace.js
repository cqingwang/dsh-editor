/* editor-workspace.js: dsh-editor client module. Generated into lib/client.js by scripts/build-client.mjs. */
    function EditorWorkspace({ t, workspaceId = '', initialHarnessCollapsed = false, onToggleHarness, onCloseEditor }) {
      const [monacoReady, setMonacoReady] = React.useState(false);
      const [monacoError, setMonacoError] = React.useState(null);
      const [root, setRoot] = React.useState('');
      const [home, setHome] = React.useState('');
      const [entries, setEntries] = React.useState([]);
      const [children, setChildren] = React.useState({});
      const [expanded, setExpanded] = React.useState(() => new Set(['']));
      /* Restored once the workspace root is known, so keys can include it. */
      const expandedRestoredRef = React.useRef('');
      /* IDEA's project tree is multi-select: one primary row plus shift/⌘ extended rows. */
      const [selectedPath, setSelectedPathRaw] = React.useState(null);
      const [selection, setSelection] = React.useState(() => new Set());
      const selectionAnchor = React.useRef(null);
      const setSelectedPath = React.useCallback((next) => {
        setSelectedPathRaw(next);
        setSelection(next === null ? new Set() : new Set([next]));
        selectionAnchor.current = next;
      }, []);
      const [treeLoading, setTreeLoading] = React.useState(true);
      /* The flattened rows as of the last render, so the loader can decide whether a
         refresh needs a visible placeholder. */
      const rowsRef = React.useRef([]);
      /* A workspace switch must show the placeholder again: the previous root's rows
         are irrelevant to the new one. */
      const treeRootRef = React.useRef('');
      /* Which workspace's tool-window widths are loaded (see loadRoot). */
      const toolWidthsRestoredFor = React.useRef('');
      const [treeError, setTreeError] = React.useState(null);
      const [activity, setActivity] = React.useState(() => lastEditorActivity);
      const [harnessCollapsed, setHarnessCollapsed] = React.useState(initialHarnessCollapsed === true);
      const toggleHarness = React.useCallback(() => {
        const next = onToggleHarness?.();
        if (typeof next === 'boolean') setHarnessCollapsed(next);
      }, [onToggleHarness]);
      React.useEffect(() => {
        lastEditorActivity = activity;
      }, [activity]);
      const [panelVisible, setPanelVisible] = React.useState(true);
      /* IDEA keeps one width per tool window. Commit used to open at 52%, which
         spent more than half the work area before a diff was even open; the
         default is now the same quarter-sized panel as Project. The user can
         still drag it wider, and that width is remembered per workspace. */
      const [toolWidths, setToolWidths] = React.useState({ project: 28, commit: 25 });
      /* The mouseup handler was registered on window and closes over an older
         render's state; read the final width from a ref. */
      const toolWidthsRef = React.useRef(toolWidths);
      const [sideDragging, setSideDragging] = React.useState(false);
      /* IDEA keeps the terminal in its own bottom dock, toggled by Alt+F12. */
      const [terminalOpen, setTerminalOpen] = React.useState(false);
      /* A monotonic request, not a boolean: repeated Alt+F12 must focus again
         even when the dock component was already mounted and cached. */
      const [terminalFocusGeneration, setTerminalFocusGeneration] = React.useState(0);
      /* Alt+F12 is a focus round-trip, not just a visibility bit: the surface
         that owned the caret before the dock opened gets it back on close. */
      const terminalReturnFocusRef = React.useRef(null);
      /* IDEA remembers the Terminal tool-window height; a reload or app restart
         must not snap it back to the factory default. */
      const [terminalHeight, setTerminalHeight] = React.useState(() => clampTerminalHeight(readStoredNumber('dsh-editor.terminal.height', 220)));
      const terminalHeightRef = React.useRef(terminalHeight);
      React.useEffect(() => {
        terminalHeightRef.current = terminalHeight;
      }, [terminalHeight]);
      const [dockDragging, setDockDragging] = React.useState(false);
      const [terminalGeneration, setTerminalGeneration] = React.useState(0);
      /* Terminals living in the EDITOR area (IDEA's Move to Editor). The PTY is
         owned by the host, so only the description is needed here to render a
         second view onto the same shell. */
      const [editorTerminals, setEditorTerminals] = React.useState([]);
      /**
       * Return one editor-area terminal to the dock.
       *
       * The dock panel may not be mounted while it is closed, so dispatching the
       * legacy event alone loses the action. Remove the editor placement locally,
       * persist it, then open the dock; the event still updates a mounted panel.
       * @param {{id: string}} terminal - editor terminal being returned.
       * @returns {void}
       */
      const returnEditorTerminalToDock = React.useCallback((terminal) => {
        if (terminal === null || terminal === undefined || typeof terminal.id !== 'string') return;
        const next = editorTerminals.filter((entry) => entry.id !== terminal.id);
        setEditorTerminals(next);
        writeEditorTerminals(next.map((entry) => entry.id));
        window.dispatchEvent(new CustomEvent('dsh-editor-return-terminal', { detail: { id: terminal.id } }));
        setTerminalOpen(true);
        setTerminalFocusGeneration((generation) => generation + 1);
      }, [editorTerminals]);
      /**
       * Rebuild the editor-area terminals after a reload.
       *
       * The dock reports what it moved, but a reload starts with the dock closed,
       * so nothing reports and the stored id renders nowhere. The PTY itself
       * survives in the host, so asking it for the list is enough: the placement
       * is remembered, the process was never ours to restart.
       * @returns {void}
       */
      React.useEffect(() => {
        const remembered = readEditorTerminals();
        if (remembered.length === 0) return;
        let cancelled = false;
        callTerminal({ op: 'list' })
          .then((value) => {
            if (cancelled) return;
            const listed = Array.isArray(value?.terminals) ? value.terminals : [];
            /* Only ids the host still holds: a terminal closed while the page was
               away must not be resurrected as a dangling tab. */
            setEditorTerminals(listed.filter((terminal) => remembered.includes(terminal.id)));
          })
          .catch(() => {});
        return () => {
          cancelled = true;
        };
      }, []);
      /* Directory "Open in Terminal" asked for, consumed by the next shell. */
      const pendingTerminalPath = React.useRef('');
      const [terminalStartDirectory, setTerminalStartDirectory] = React.useState('');
      const [createState, setCreateState] = React.useState(null);
      const [git, setGit] = React.useState(null);
      const [openFiles, setOpenFiles] = React.useState([]);
      const [previewPath, setPreviewPath] = React.useState(null);
      const [activePath, setActivePath] = React.useState(null);
      const [splitPath, setSplitPath] = React.useState(null);
      const [splitTabs, setSplitTabs] = React.useState([]);
      const [focusedPath, setFocusedPath] = React.useState(null);
      const [editorSplitPercent, setEditorSplitPercent] = React.useState(() => readStoredNumber('dsh-editor.editor.splitPercent', 50));
      const [editorSplitDragging, setEditorSplitDragging] = React.useState(false);
      /* The file tab strip's measured width, for IDEA's `»` overflow. */
      const [tabStripWidth, setTabStripWidth] = React.useState(0);
      const fileTabStripRef = React.useRef(null);
      const [splitTabStripWidth, setSplitTabStripWidth] = React.useState(0);
      const splitTabStripRef = React.useRef(null);
      const [editorTabDrag, setEditorTabDrag] = React.useState(null);
      const editorTabDragRef = React.useRef(null);
      const [editorTabDrop, setEditorTabDrop] = React.useState(null);
      const [editorError, setEditorError] = React.useState(null);
      const [saving, setSaving] = React.useState(false);
      /* IDEA's editor status bar: caret position, indentation and line-ending mode. */
      const [caret, setCaret] = React.useState({ line: 1, column: 1 });
      /* Line count and selection size for IDEA's status bar. */
      const [lineStats, setLineStats] = React.useState({ lines: 0, selected: 0 });
      const [fileMode, setFileMode] = React.useState({ tabSize: 2, insertSpaces: true, eol: 'LF', encoding: 'UTF-8' });
      const [commitMessage, setCommitMessage] = React.useState('');
      /* Recently used commit messages, recalled with ↑/↓ like IDEA's message box. */
      const [messageHistory, setMessageHistory] = React.useState([]);
      const [historyIndex, setHistoryIndex] = React.useState(-1);
      const [amend, setAmend] = React.useState(false);
      const [commitSelection, setCommitSelection] = React.useState(() => new Set());
      const commitSelectionLoadedRef = React.useRef(false);
      const [commitBusy, setCommitBusy] = React.useState(false);
      const [commitError, setCommitError] = React.useState(null);
      /* Git refuses to commit without an identity; say so before the message is written. */
      const [identityMissing, setIdentityMissing] = React.useState(false);
      /* The reason the last push failed; clears on a successful one. */
      const [pushError, setPushError] = React.useState(null);
      /* A push can take a while; it needs its own busy flag so Commit stays usable. */
      const [pushBusy, setPushBusy] = React.useState(false);
      /* Fetch and Update share the network cost of push, so each gets its own flag. */
      const [fetchBusy, setFetchBusy] = React.useState(false);
      const [updateBusy, setUpdateBusy] = React.useState(false);
      const [commitNotice, setCommitNotice] = React.useState(null);
      /* The message that was just committed, offered back as "Undo". */
      const [clearedMessage, setClearedMessage] = React.useState('');
      /* The draft the user was typing before they started walking the history with ↑. */
      const draftBeforeRecall = React.useRef(null);
      /* What the box held before Amend prefilled it, so unticking Amend can restore it. */
      const preAmendMessage = React.useRef(null);
      const [diffTarget, setDiffTarget] = React.useState(null);
      /* IDEA's change list has a row selection separate from the diff tab. The
         selection is what ⌘D / stage / rollback act on; opening the diff is a
         double-click (or a deliberate Show Diff shortcut). */
      const [selectedChange, setSelectedChange] = React.useState(null);
      const selectedChangeRef = React.useRef(null);
      /* IDEA's Changes tree can select a group node as well as a file row.
         Group selection is separate from commit inclusion and clears every
         file-scoped target so commands cannot act on a hidden previous row. */
      const [selectedGroup, setSelectedGroup] = React.useState(null);
      const selectedGroupRef = React.useRef(null);
      /* IDEA's Changes list has a multi-row selection separate from the commit
         checkboxes. The primary row owns the diff/shortcuts; the range members
         receive row-level actions such as stage/rollback as one batch. */
      const [selectedChanges, setSelectedChanges] = React.useState(() => new Set());
      const selectedChangesRef = React.useRef(new Set());
      const changeSelectionAnchorRef = React.useRef(null);
      const changeRowRefs = React.useRef(new Map());
      /* The Changes row that owned the keyboard before Show Diff moved focus
         into the comparison. Closing the diff returns it there, so the user can
         keep walking the list instead of hunting for the tree again. */
      const diffReturnFocusRef = React.useRef(null);
      /* IDEA's undo/redo history is global across diff tabs, not scoped to the
         model currently mounted. Keep it here so switching from one changed
         file to another does not throw away the previous edit. */
      const diffUndoRef = React.useRef([]);
      const diffRedoRef = React.useRef([]);
      const diffViewStatesRef = React.useRef(new Map());
      const diffSearchInChangesRef = React.useRef(null);
      /* The Commit diff keeps ONE editor tab. `diffTarget` is what it shows;
         `diffActive` says whether that tab or a file tab owns the code area, so
         picking a file tab does not silently leave the diff on screen. */
      const [diffActive, setDiffActive] = React.useState(true);
      /* Per-line attribution for the open file (IDEA's Annotate). */
      const [annotateTarget, setAnnotateTarget] = React.useState(null);
      /* The change the Commit panel is showing, for ⌥⌘Z. Declared AFTER the state
         it mirrors: a ref synced in an effect placed above it hits the TDZ. */
      const selectedDiffPathRef = React.useRef(null);
      const selectedCommitPathRef = React.useRef(null);
      /* The context menu resolves conflict actions against the same git snapshot
         the row was rendered from, so a ref keeps the callback stable. */
      const changesByPathRef = React.useRef(new Map());
      /* The change the Commit panel last pointed at, kept after the diff closes:
         ⌘D closes the diff, and pressing it again must reopen the same one rather
         than fall through to "no current change" and do nothing. */
      const lastChangePathRef = React.useRef(null);
      /* A newly opened diff takes the surface; the tab keeps its place when the
         user walks back to a file and returns. */
      React.useEffect(() => {
        if (diffTarget !== null) {
          setDiffActive(true);
          setActivity('commit');
          setPanelVisible(true);
        }
      }, [diffTarget]);
      React.useEffect(() => {
        selectedDiffPathRef.current = diffTarget === null ? null : diffTarget.path;
        if (diffTarget !== null) lastChangePathRef.current = { path: diffTarget.path, staged: diffTarget.staged === true };
      }, [diffTarget]);
      React.useEffect(() => {
        selectedChangeRef.current = selectedChange;
      }, [selectedChange]);
      React.useEffect(() => {
        selectedChangesRef.current = selectedChanges;
      }, [selectedChanges]);
      React.useEffect(() => {
        selectedGroupRef.current = selectedGroup;
      }, [selectedGroup]);
      React.useEffect(() => {
        if (selectedGroup === null) return;
        const members = splitChanges(git?.changes ?? [])[selectedGroup] ?? [];
        /* staged/unstaged remain valid, selectable empty tree nodes. Only the
           unversioned node disappears when git removes its last member. */
        if (selectedGroup === 'unversioned' && members.length === 0) {
          setSelectedGroup(null);
          selectedGroupRef.current = null;
        }
      }, [git, selectedGroup]);
      React.useEffect(() => {
        if (selectedChange === null) return;
        const key = `${selectedChange.staged === true ? 'staged' : 'unstaged'}:${selectedChange.path}`;
        window.setTimeout(() => changeRowRefs.current.get(key)?.scrollIntoView?.({ block: 'nearest' }), 0);
      }, [selectedChange]);
      /**
       * Apply one Changes-list selection gesture.
       *
       * A plain click collapses to one row and moves the Shift anchor; Shift
       * extends from that anchor through the currently rendered visual order;
       * ⌘/Ctrl toggles a row without moving the anchor. These rows are the git
       * selection, not the commit checkboxes.
       * @param {{path: string, staged: boolean}} target - clicked row identity.
       * @param {{shift?: boolean, toggle?: boolean, row?: HTMLElement|null}} options - gesture modifiers.
       * @returns {void}
       */
      const chooseChange = React.useCallback((target, options = {}) => {
        if (target === null || typeof target.path !== 'string' || target.path === '') return;
        setSelectedGroup(null);
        const node = document.querySelector('[data-dsh-changes-list]');
        const rows = node === null ? [] : [...node.querySelectorAll('[data-dsh-change-path]')];
        const keyOf = (row) => `${row.getAttribute('data-dsh-change-staged') === 'true' ? 'staged' : 'unstaged'}:${row.getAttribute('data-dsh-change-path')}`;
        const targetKey = `${target.staged === true ? 'staged' : 'unstaged'}:${target.path}`;
        const targetRow = rows.find((row) => keyOf(row) === targetKey) ?? options.row ?? null;
        if (options.shift === true) {
          const anchor = changeSelectionAnchorRef.current;
          const anchorIndex = anchor === null ? -1 : rows.findIndex((row) => keyOf(row) === anchor.key);
          const targetIndex = rows.indexOf(targetRow);
          if (anchor !== null && anchorIndex >= 0 && targetIndex >= 0) {
            const start = Math.min(anchorIndex, targetIndex);
            const end = Math.max(anchorIndex, targetIndex);
            const next = new Set(rows.slice(start, end + 1).map(keyOf));
            setSelectedChanges(next);
            selectedChangesRef.current = next;
          } else {
            const next = new Set([targetKey]);
            setSelectedChanges(next);
            selectedChangesRef.current = next;
          }
        } else if (options.toggle === true) {
          const next = new Set(selectedChangesRef.current);
          if (next.has(targetKey)) next.delete(targetKey);
          else next.add(targetKey);
          if (next.size === 0) next.add(targetKey);
          setSelectedChanges(next);
          selectedChangesRef.current = next;
          changeSelectionAnchorRef.current = { key: targetKey };
        } else {
          const next = new Set([targetKey]);
          setSelectedChanges(next);
          selectedChangesRef.current = next;
          changeSelectionAnchorRef.current = { key: targetKey };
        }
        setSelectedChange({ path: target.path, staged: target.staged === true });
      }, []);

      /**
       * Select a Changes group node without changing its commit inclusion.
       *
       * IDEA keeps row selection separate from the three-state checkbox. Moving
       * to a group therefore clears the file target and range selection, which
       * disables Show Diff and rollback until a file row is selected again.
       * @param {'staged'|'unstaged'|'unversioned'} group - selected band.
       * @returns {void}
       */
      const chooseGroup = React.useCallback((group) => {
        if (group !== null && group !== 'staged' && group !== 'unstaged' && group !== 'unversioned') return;
        setSelectedGroup(group);
        setSelectedChange(null);
        selectedChangeRef.current = null;
        const empty = new Set();
        setSelectedChanges(empty);
        selectedChangesRef.current = empty;
        changeSelectionAnchorRef.current = null;
      }, []);
      /**
       * Visible Changes rows selected for a batch action, in list order.
       * @returns {Array<{path: string, staged: boolean}>} selected identities.
       */
      const chosenChanges = React.useCallback((fallback = selectedChangeRef.current) => {
        const node = document.querySelector('[data-dsh-changes-list]');
        const rows = node === null ? [] : [...node.querySelectorAll('[data-dsh-change-path]')];
        if (rows.length > 0) {
          return rows
            .map((row) => ({
              path: row.getAttribute('data-dsh-change-path'),
              staged: row.getAttribute('data-dsh-change-staged') === 'true',
            }))
            .filter((entry) => selectedChangesRef.current.has(`${entry.staged ? 'staged' : 'unstaged'}:${entry.path}`));
        }
        return fallback === null || fallback === undefined ? [] : [fallback];
      }, []);
      /**
       * Reconcile the Changes selection after a destructive git operation.
       *
       * IDEA keeps the list's keyboard position near the removed rows rather
       * than selecting the first file again. The current render's row order is
       * the visual truth; choose the nearest surviving row after the first
       * removed row. Checkboxes stay independent and are only pruned.
       * @param {object[]} changes - the post-operation git change list.
       * @param {Set<string>} removedKeys - `<staged|unstaged>:<path>` identities gone.
       * @returns {void}
       */
      const reconcileChangeSelection = React.useCallback((changes, removedKeys) => {
        if (!(removedKeys instanceof Set) || removedKeys.size === 0) return;
        const rows = [...document.querySelectorAll('[data-dsh-changes-list] [data-dsh-change-path]')];
        const keyOf = (row) => `${row.getAttribute('data-dsh-change-staged') === 'true' ? 'staged' : 'unstaged'}:${row.getAttribute('data-dsh-change-path')}`;
        const keysInVisualOrder = rows.map(keyOf);
        const firstRemoved = keysInVisualOrder.findIndex((key) => removedKeys.has(key));
        const remaining = new Set((changes ?? []).flatMap((change) => {
          const entries = [];
          if (change.status[0] !== ' ' && change.status[0] !== '?') entries.push(`staged:${change.path}`);
          if (change.status[1] !== ' ') entries.push(`unstaged:${change.path}`);
          return entries;
        }));
        const keptSelected = new Set([...selectedChangesRef.current].filter((key) => remaining.has(key)));
        let next = null;
        const selectedAfterRemoval = keysInVisualOrder.find((key) => keptSelected.has(key));
        if (selectedAfterRemoval !== undefined) next = selectedAfterRemoval;
        if (next === null && firstRemoved >= 0) {
          for (let offset = 1; offset < keysInVisualOrder.length; offset += 1) {
            const candidate = keysInVisualOrder[Math.min(firstRemoved + offset, keysInVisualOrder.length - 1)];
            if (remaining.has(candidate)) {
              next = candidate;
              break;
            }
          }
        }
        if (next === null) next = [...remaining][0] ?? null;
        if (next === null) {
          setSelectedChanges(new Set());
          selectedChangesRef.current = new Set();
          setSelectedChange(null);
          changeSelectionAnchorRef.current = null;
          return;
        }
        const separator = next.indexOf(':');
        const current = { path: next.slice(separator + 1), staged: next.slice(0, separator) === 'staged' };
        keptSelected.add(next);
        setSelectedChanges(keptSelected);
        selectedChangesRef.current = keptSelected;
        setSelectedChange(current);
        changeSelectionAnchorRef.current = { key: next };
      }, []);
      const closeDiff = React.useCallback(() => {
        setDiffTarget(null);
        /* The comparison tab is gone; without this the strip still points its
           active-key calculation at DIFF_TAB_KEY even though no diff exists. */
        setDiffActive(false);
        const path = activePathRef.current;
        if (path !== null) {
          /* IDEA's ⌘W closes the diff tab and activates the editor tab that was
             underneath it. The file view is hidden while the diff owns the
             surface, so wait for React to restore it before moving the caret. */
          window.setTimeout(() => editorRef.current?.focus(), 0);
          return;
        }
        const selected = selectedChangeRef.current;
        const selectedKey = selected === null
          ? null
          : `${selected.staged === true ? 'staged' : 'unstaged'}:${selected.path}`;
        const row = diffReturnFocusRef.current
          ?? (selectedKey === null ? null : changeRowRefs.current.get(selectedKey))
          ?? null;
        diffReturnFocusRef.current = null;
        if (row === null) return;
        window.setTimeout(() => {
          if (row.isConnected) row.focus();
        }, 0);
      }, []);
      React.useEffect(() => {
        selectedCommitPathRef.current = annotateTarget === null ? null : annotateTarget.path;
      }, [annotateTarget]);
      React.useEffect(() => {
        changesByPathRef.current = new Map((git?.changes ?? []).map((change) => [change.path, change]));
      }, [git]);
      const [annotateLines, setAnnotateLines] = React.useState([]);
      const [annotateLoading, setAnnotateLoading] = React.useState(false);
      const [annotateTruncated, setAnnotateTruncated] = React.useState(false);
      /* Keys carry the workspace root, so this starts empty and is restored below. */
      const [collapsedGroups, setCollapsedGroups] = React.useState(() => new Set());
      const [menu, setMenu] = React.useState(null);
      const [renameState, setRenameState] = React.useState(null);
      /* Hidden entries are shown BY DEFAULT: the tree hides only `.git`, because
         `.env` / `.github` / `.vscode` are files people actually open. The toggle
         still hides them for a compact view. */
      const [showHidden, setShowHidden] = React.useState(() => readStoredText('dsh-editor.project.showHidden', '1') !== '0');
      /* IDEA lets the Project view sort by name, type, or modification time. */
      const [sortMode, setSortMode] = React.useState(() => readStoredText('dsh-editor.project.sort', 'name'));
      const [manualOrder, setManualOrder] = React.useState(() => readProjectManualOrder(root));
      React.useEffect(() => {
        setManualOrder(readProjectManualOrder(root));
      }, [root]);
      /* IDEA's "Autoscroll from Source": the tree follows whichever tab is active. */
      const [autoScroll, setAutoScroll] = React.useState(() => readStoredText('dsh-editor.project.autoscroll', '1') === '1');
      const [markdownMode, setMarkdownModeState] = React.useState(() => normalizeMarkdownMode(
        readStoredText('dsh-editor.markdown.mode', 'code'),
      ));
      const setMarkdownMode = React.useCallback((next) => {
        const normalized = normalizeMarkdownMode(next);
        setMarkdownModeState(normalized);
        try {
          window.localStorage.setItem('dsh-editor.markdown.mode', normalized);
        } catch {
          /* a storage-less browser keeps the in-memory mode */
        }
      }, []);
      /* IDEA's Project View defaults to select-on-click/open-on-double-click.
         Users who prefer the old one-click behaviour can opt in explicitly. */
      const [singleClickOpen, setSingleClickOpen] = React.useState(readProjectSingleClickOpen);
      /* Directories have their own IDEA option: default select-on-click and
         toggle-on-double-click, independently of the file-open preference. */
      const [openDirectoriesSingleClick, setOpenDirectoriesSingleClick] = React.useState(() => readStoredText('dsh-editor.project.openDirectoriesSingleClick', '0') === '1');
      /* IDEA's preview tab is opt-in; enabling it makes single-click Project
         navigation reuse one replaceable tab until the user edits or pins it. */
      const [previewTabEnabled, setPreviewTabEnabled] = React.useState(() => readStoredText('dsh-editor.project.previewTab', '0') === '1');
      /* IDEA Folders Always on Top: on by default, independently of Sort By. */
      const [foldersFirst, setFoldersFirst] = React.useState(() => readStoredText('dsh-editor.project.foldersFirst', '1') !== '0');
      const foldersFirstRef = React.useRef(foldersFirst);
      /* IDEA Compact Directories: compatibility default is off, matching
         ViewSettings.isCompactDirectories(). */
      const [compactDirectories, setCompactDirectories] = React.useState(() => readStoredText('dsh-editor.project.compactDirectories', '0') === '1');
      /* The selected Project view is a reading preference and survives workspace
         switches, like IDEA's last used view for the Project tool window. */
      const [projectView, setProjectView] = React.useState(() => normalizeProjectView(
        readStoredText('dsh-editor.project.view', 'projectFiles'),
      ));
      const lastProjectTreeViewRef = React.useRef(projectViewIsTree(projectView) ? projectView : 'projectFiles');
      /** Select one supported IDEA Project view and remember it globally. */
      const applyProjectView = React.useCallback((next) => {
        const normalized = normalizeProjectView(next);
        if (projectViewIsTree(normalized)) lastProjectTreeViewRef.current = normalized;
        setProjectView(normalized);
        try {
          window.localStorage.setItem('dsh-editor.project.view', normalized);
        } catch {
          /* a storage-less browser keeps the in-memory view */
        }
      }, []);
      /* Compatibility default: existing users keep seeing heavy directories
         until they explicitly hide excluded items. */
      const [showExcludedFiles, setShowExcludedFiles] = React.useState(() => readStoredText('dsh-editor.project.showExcludedFiles', '1') !== '0');
      const [conflict, setConflict] = React.useState(null);
      /* Open tabs whose file changed on disk since they were loaded. */
      const [externalChanges, setExternalChanges] = React.useState({});
      /* Open files that no longer exist on disk, shown with a strikethrough in the tree. */
      const [deletedPaths, setDeletedPaths] = React.useState(() => new Set());
      /* Files that appeared outside the editor since the last refresh. */
      const [newPaths, setNewPaths] = React.useState(() => new Set());
      /* Paths seen in the previous root listing; null until the baseline is established. */
      const knownPathsRef = React.useRef(null);
      /* Paths whose model is being replaced programmatically: that edit is not a user edit. */
      const silentReloadRef = React.useRef(new Set());
      const [replaceState, setReplaceState] = React.useState(null);
      const [editorFindHistoryMenu, setEditorFindHistoryMenu] = React.useState(null);
      const [quickOpen, setQuickOpen] = React.useState(null);
      /* IDEA's double-Shift Search Everywhere shares file, text and command data
         with the existing editor actions instead of inventing another index. */
      const [searchEverywhere, setSearchEverywhere] = React.useState(null);
      const [searchHistoryRequest, setSearchHistoryRequest] = React.useState(0);
      const [findUsagesHistoryRequest, setFindUsagesHistoryRequest] = React.useState(0);
      const [recentSearches, setRecentSearches] = React.useState([]);
      const [recentFindQueries, setRecentFindQueries] = React.useState([]);
      const [recentFindUsages, setRecentFindUsages] = React.useState([]);
      const [recentReplacements, setRecentReplacements] = React.useState([]);
      const [recentCommands, setRecentCommands] = React.useState(() => readCommandHistory());
      const searchEverywhereFilesRef = React.useRef([]);
      const searchEverywhereFilesScopeRef = React.useRef(null);
      const searchEverywhereFilesRequestRef = React.useRef(0);
      const searchTextRequestRef = React.useRef(0);
      const doubleShiftAtRef = React.useRef(0);
      /* Monaco effects mount before Search Everywhere is declared below. Route
         their callbacks through a ref so the dependency arrays cannot hit TDZ. */
      const openSearchEverywhereRef = React.useRef(() => {});
      /* IDEA's persistent Find tool window, shared by Find/Replace in Files. */
      const [findTool, setFindTool] = React.useState(null);
      const [findToolDockHeight, setFindToolDockHeight] = React.useState(() =>
        clampFindDockHeight(readStoredNumber('dsh-editor.find.height', 280)));
      const findToolDockHeightRef = React.useRef(findToolDockHeight);
      React.useEffect(() => {
        findToolDockHeightRef.current = findToolDockHeight;
      }, [findToolDockHeight]);
      const findToolRequestRef = React.useRef(0);
      const findToolHandoffSequenceRef = React.useRef(0);
      const replaceWriteBusyRef = React.useRef(false);
      /* IDEA's transient Show Usages popup is separate from persistent Find. */
      const [showUsages, setShowUsages] = React.useState(null);
      const showUsagesRequestRef = React.useRef(0);
      const editorFindStepRef = React.useRef(() => {});
      const editorFindQueryActiveRef = React.useRef(false);
      React.useEffect(() => {
        editorFindQueryActiveRef.current = replaceState !== null && replaceState.find !== '';
      }, [replaceState?.find]);
      /* IDEA's revision picker (Compare with Revision…), searchable. */
      const [revisionPicker, setRevisionPicker] = React.useState(null);
      /* IDEA's Recent Files (⌘E): the MRU list for this workspace. */
      const [recentFiles, setRecentFiles] = React.useState([]);
      /* The palette mode: 'files' is Go to File, 'recent' is Recent Files. */
      const [paletteMode, setPaletteMode] = React.useState('files');
      /* IDEA's in-window name prompt (New Branch / New Tag). */
      const [namePrompt, setNamePrompt] = React.useState(null);
      /* IDEA's "Move to…" (F6): a directory picker over the whole workspace. */
      const [moveTo, setMoveTo] = React.useState(null);
      const [commitMode, setCommitMode] = React.useState('changes');
      /* IDEA's "Group by" for the change list; persisted because it is a
         preference about how the user reads changes, not about one session. */
      const [groupBy, setGroupBy] = React.useState(() => readStoredText('dsh-editor.commit.groupBy', 'directory'));
      /* Group by can rebuild the tree under the current row. The effect below
         restores focus only after that new tree has committed. */
      const groupByFocusRef = React.useRef(null);
      React.useEffect(() => {
        const target = groupByFocusRef.current;
        if (target === null) return;
        const key = `${target.staged === true ? 'staged' : 'unstaged'}:${target.path}`;
        const row = changeRowRefs.current.get(key)
          ?? [...document.querySelectorAll('[data-dsh-changes-list] [data-dsh-change-path]')].find(
            (candidate) =>
              candidate.getAttribute('data-dsh-change-path') === target.path
              && candidate.getAttribute('data-dsh-change-staged') === String(target.staged === true),
          );
        if (row === undefined) return;
        row.focus?.();
        row.scrollIntoView?.({ block: 'nearest' });
        groupByFocusRef.current = null;
      }, [collapsedGroups, groupBy]);
      /* The change-list filter; deliberately NOT persisted — a filter left over
         from yesterday makes the list look like files went missing. */
      const [pathQuery, setPathQuery] = React.useState('');
      /* One remembered offset per Commit tab: switching tabs remounts the list, and
         IDEA keeps each tab where you left it. */
      const commitScrollRef = React.useRef({ changes: null, log: null });
      const commitChangesRef = React.useRef(null);
      const commitLogRef = React.useRef(null);
      /**
       * Record the outgoing tab's offset, then switch.
       * @param {'changes'|'log'} next - tab being opened.
       * @returns {void}
       */
      const switchCommitMode = React.useCallback((next) => {
        const node = commitMode === 'changes' ? commitChangesRef.current : commitLogRef.current;
        if (node !== null && node !== undefined) commitScrollRef.current[commitMode] = node.scrollTop;
        setCommitMode(next);
      }, [commitMode]);
      /**
       * Put the incoming tab back where the user left it.
       * @param {'changes'|'log'} mode - tab that just rendered.
       * @returns {void}
       */
      const rememberCommitScroll = React.useCallback((mode) => {
        const node = mode === 'changes' ? commitChangesRef.current : commitLogRef.current;
        if (node === null || node === undefined) return;
        const next = restoreScrollTop({ remembered: commitScrollRef.current[mode], max: node.scrollHeight - node.clientHeight });
        if (next === null) return;
        node.scrollTop = next;
      }, []);
      /* Apply the remembered offset once the active tab's list has rendered. */
      React.useEffect(() => {
        const frame = window.requestAnimationFrame(() => rememberCommitScroll(commitMode));
        return () => window.cancelAnimationFrame(frame);
      }, [commitMode, rememberCommitScroll]);
      const [commits, setCommits] = React.useState([]);
      /* The commit just created, highlighted in the log so the user sees it land. */
      const [highlightedCommit, setHighlightedCommit] = React.useState(null);
      const [logLoading, setLogLoading] = React.useState(false);
      const [logDetail, setLogDetail] = React.useState(null);
      /* The commit chosen in either the flat list or the graph; both views mark it. */
      const [selectedCommit, setSelectedCommit] = React.useState(null);
      const [logSelectedCommits, setLogSelectedCommits] = React.useState([]);

      const containerRef = React.useRef(null);
      const editorRef = React.useRef(null);
      const markdownPreviewRef = React.useRef(null);
      const markdownScrollSyncRef = React.useRef({ source: null, until: 0 });
      const splitEditorRef = React.useRef(null);
      const splitContainerRef = React.useRef(null);
      const focusedEditorRef = React.useRef(null);
      const focusedPathRef = React.useRef(null);
      const modelsRef = React.useRef(new Map());
      const activePathRef = React.useRef(null);
      const splitPathRef = React.useRef(null);
      const splitTabsRef = React.useRef([]);
      const previewPathRef = React.useRef(null);
      /* The editor groups mount before the Find tool callback is declared. */
      const findUsagesRunnerRef = React.useRef(null);
      const findToolContextRunnerRef = React.useRef(null);
      const editorFindContextRunnerRef = React.useRef(null);
      const selectionFindContextRunnerRef = React.useRef(null);
      /* Read by the window/Monaco shortcuts, which are registered once. */
      const diffActiveRef = React.useRef(true);
      const openFilesRef = React.useRef([]);
      const sessionRestoredFor = React.useRef('');
      const sessionRestoringRef = React.useRef(false);
      const sessionRestoreGeneration = React.useRef(0);
      const childrenRef = React.useRef({});
      const expandedRef = React.useRef(expanded);
      const rootRef = React.useRef('');
      const rememberCurrentSearchQuery = React.useCallback((query) => {
        const next = rememberWorkspaceSearchQuery(rootRef.current, query);
        if (next !== null) setRecentSearches(next);
      }, []);
      const rememberCurrentFindQuery = React.useCallback((query) => {
        const next = rememberWorkspaceFindQuery(rootRef.current, query);
        if (next !== null) setRecentFindQueries(next);
      }, []);
      const rememberCurrentReplacement = React.useCallback((replacement) => {
        const next = rememberWorkspaceReplacement(rootRef.current, replacement);
        if (next !== null) setRecentReplacements(next);
      }, []);
      /* Which workspace's fold state is currently loaded (see loadRoot). */
      const collapsedRestoredFor = React.useRef(null);
      const rowRefs = React.useRef(new Map());
      const treeRef = React.useRef(null);
      /* Read by the one-shot keyboard handlers, which must not re-bind per render. */
      const panelVisibleRef = React.useRef(true);
      const activityRef = React.useRef('project');
      const gitRef = React.useRef(null);
      const restageRef = React.useRef(async () => {});
      /* The sort the tree is currently laid out with, and the row to keep visible. */
      const sortAppliedRef = React.useRef('');
      const selectedPathRef = React.useRef(null);
      /* Explicit row reveal wins over the next Auto Scroll pass caused by leaving
         a filtered view; otherwise the active editor tab reselects itself. */
      const suppressAutoScrollRef = React.useRef(false);

      React.useEffect(() => {
        activePathRef.current = activePath;
      }, [activePath]);
      React.useEffect(() => {
        splitPathRef.current = splitPath;
      }, [splitPath]);
      React.useEffect(() => {
        splitTabsRef.current = splitTabs;
      }, [splitTabs]);
      React.useEffect(() => {
        focusedPathRef.current = focusedPath;
      }, [focusedPath]);
      const currentCodeEditor = React.useCallback(() => {
        const focused = focusedEditorRef.current?.editor ?? null;
        const model = focused?.getModel?.();
        return model === null || model === undefined ? editorRef.current : focused;
      }, []);
      const currentCodePath = React.useCallback(() => (
        focusedEditorRef.current?.path ?? focusedPathRef.current ?? activePathRef.current
      ), []);
      React.useEffect(() => {
        diffActiveRef.current = diffActive;
      }, [diffActive]);
      React.useEffect(() => {
        selectedPathRef.current = selectedPath;
      }, [selectedPath]);
      React.useEffect(() => {
        openFilesRef.current = openFiles;
      }, [openFiles]);
      React.useEffect(() => {
        previewPathRef.current = previewPath;
      }, [previewPath]);
      React.useEffect(() => {
        childrenRef.current = children;
      }, [children]);
      React.useEffect(() => {
        expandedRef.current = expanded;
        if (expandedRestoredRef.current !== '') writeExpanded(expandedRestoredRef.current, expanded);
      }, [expanded]);
      React.useEffect(() => {
        rootRef.current = root;
      }, [root]);
      /* The keyboard shortcuts are registered once, so they read the panel state,
         the git snapshot and the stager through refs rather than stale closures. */
      React.useEffect(() => {
        panelVisibleRef.current = panelVisible;
      }, [panelVisible]);
      React.useEffect(() => {
        activityRef.current = activity;
      }, [activity]);
      React.useEffect(() => {
        gitRef.current = git;
      }, [git]);
      React.useEffect(() => {
        toolWidthsRef.current = toolWidths;
      }, [toolWidths]);

      const beginEditorTabDrag = React.useCallback((event, group, path) => {
        if ((group !== 'left' && group !== 'right') || typeof path !== 'string' || path === '') return;
        const source = { group, path };
        editorTabDragRef.current = source;
        setEditorTabDrag(source);
        setEditorTabDrop(null);
        event.dataTransfer?.setData('text/plain', path);
        if (event.dataTransfer !== null && event.dataTransfer !== undefined) event.dataTransfer.effectAllowed = 'move';
      }, []);

      const dragOverEditorTab = React.useCallback((event, group, path) => {
        const source = editorTabDragRef.current;
        if (source === null || source.group !== group || source.path === path) return;
        event.preventDefault();
        if (event.dataTransfer !== null && event.dataTransfer !== undefined) event.dataTransfer.dropEffect = 'move';
        const rect = event.currentTarget.getBoundingClientRect();
        setEditorTabDrop({
          group,
          path,
          after: event.clientX > rect.left + rect.width / 2,
        });
      }, []);

      const moveEditorTab = React.useCallback((group, source, target, after) => {
        if (group === 'left') {
          const next = reorderTabPaths(openFilesRef.current, source, target, after, (file) => file.path);
          if (next === openFilesRef.current) return;
          openFilesRef.current = next;
          setOpenFiles(next);
          return;
        }
        if (group === 'right') {
          const next = reorderTabPaths(splitTabsRef.current, source, target, after, (path) => path);
          if (next === splitTabsRef.current) return;
          splitTabsRef.current = next;
          setSplitTabs(next);
        }
      }, []);

      /** Move one tab by ±1 while preserving the active document. */
      const moveEditorTabByOffset = React.useCallback((group, path, direction) => {
        const order = group === 'left'
          ? openFilesRef.current.map((file) => file.path)
          : group === 'right'
            ? splitTabsRef.current
            : [];
        const index = order.indexOf(path);
        const target = index < 0 ? undefined : order[index + direction];
        if (target === undefined) return;
        moveEditorTab(group, path, target, direction > 0);
      }, [moveEditorTab]);

      const dropEditorTab = React.useCallback((event, group, path) => {
        event.preventDefault();
        const source = editorTabDragRef.current;
        const rect = event.currentTarget.getBoundingClientRect();
        const after = event.clientX > rect.left + rect.width / 2;
        editorTabDragRef.current = null;
        setEditorTabDrag(null);
        setEditorTabDrop(null);
        if (source === null || source.group !== group || source.path === path) return;
        moveEditorTab(group, source.path, path, after);
      }, [moveEditorTab]);

      const activeFile = activePath === null ? null : openFiles.find((file) => file.path === activePath) ?? null;
      const markdownAvailable = activeFile !== null && isMarkdownPath(activePath);
      const effectiveMarkdownMode = markdownAvailable ? markdownMode : 'code';
      const markdownPreviewVisible = markdownAvailable && effectiveMarkdownMode !== 'code';
      const splitFile = splitPath === null ? null : openFiles.find((file) => file.path === splitPath) ?? null;
      const statusFile = focusedPath === null
        ? activeFile
        : openFiles.find((file) => file.path === focusedPath) ?? activeFile;
      const splitFocused = focusedPath === splitFile?.path;
      const leftFocused = focusedPath === activePath && splitFocused === false;
      /* The diff preview is rendered only while its tab (or a freshly opened
         change) owns the code area. */
      const diffOpen = diffTarget !== null && diffActive;
      const fileSurfaceVisible = (activeFile !== null || splitFile !== null)
        && diffOpen === false
        && annotateTarget === null
        && editorTerminals.length === 0;
      /**
       * Move keyboard ownership from the terminal dock back into the editor.
       *
       * A visible diff owns its own modified Monaco instance, so the workspace
       * dispatches a scoped event instead of focusing the hidden main editor.
       * With no diff, Monaco's normal editor is the correct target.
       * @returns {void}
       */
      const focusEditorFromTerminal = React.useCallback(() => {
        if (diffOpen) {
          const host = editorRef.current?.getDomNode?.()?.closest?.('[data-dsh-editor-workspace]') ?? null;
          host?.dispatchEvent(new CustomEvent('dsh-editor-focus-diff'));
          return;
        }
        editorRef.current?.focus();
      }, [diffOpen]);
      /* IDEA's combined diff can walk every changed file without returning to
         the Changes tree. The sequence follows the active Group by order, so
         Control+Shift+Left/Right lands on the same file the user sees there. */
      const diffChangeSequence = React.useMemo(
        () => filterChangeSequence(changeSequenceOf(git?.changes ?? [], groupBy), pathQuery),
        [git, groupBy, pathQuery],
      );
      const diffFilePosition = React.useMemo(
        () => changePositionOf(diffChangeSequence, diffTarget),
        [diffChangeSequence, diffTarget],
      );
      /**
       * Clear every collapsed group/directory that hides one changed row.
       *
       * Diff navigation, Group by and the Changes path filter all need the same
       * visibility repair. Keeping it here means no caller can forget one of the
       * staged/unstaged/unversioned collapse-key variants.
       * @param {{path: string, staged: boolean}|null} target - row identity to reveal.
       * @returns {void}
       */
      const revealChangeRow = React.useCallback((target) => {
        if (target === null || target === undefined || typeof target.path !== 'string') return;
        const change = changesByPathRef.current.get(target.path);
        const group = changeRowGroup(change, target.staged);
        const revealKeys = revealCollapseKeys(group, target.path);
        setCollapsedGroups((current) => {
          const revealed = new Set(current);
          let changed = false;
          for (const collapseKey of revealKeys) changed = revealed.delete(collapseKey) || changed;
          if (!changed) return current;
          writeCollapsedGroups(rootRef.current, revealed);
          return revealed;
        });
      }, []);
      const navigateDiffFile = React.useCallback((direction) => {
        const position = changePositionOf(diffChangeSequence, diffTarget);
        if (position === null) return;
        const nextIndex = position.index - 1 + (direction === 'previous' ? -1 : 1);
        if (nextIndex < 0 || nextIndex >= diffChangeSequence.length) return;
        const next = diffChangeSequence[nextIndex];
        revealChangeRow(next);
        const key = `${next.staged ? 'staged' : 'unstaged'}:${next.path}`;
        diffReturnFocusRef.current = changeRowRefs.current.get(key) ?? null;
        chooseChange(next, {});
        setDiffTarget({ path: next.path, staged: next.staged });
        setDiffActive(true);
      }, [chooseChange, diffChangeSequence, diffTarget, revealChangeRow]);
      const projectName = basename(root) || 'Workspace';
      const filteredView = projectViewIsTree(projectView) === false;
      const projectTreeActionsAvailable = filteredView === false;
      const projectExpandAllAvailable = projectTreeActionsAvailable
        && projectCanExpandAll(entries, children, expanded);
      const projectRows = React.useMemo(
        () => flattenRows(entries, children, expanded, projectName, root, compactDirectories, sortMode, manualOrder),
        [compactDirectories, entries, children, expanded, manualOrder, projectName, root, sortMode],
      );
      const rows = React.useMemo(
        () => projectViewRows(projectView, projectRows, openFiles, git),
        [git, openFiles, projectRows, projectView],
      );
      /* Mirror the flattened rows for the loader (which runs outside render). */
      React.useEffect(() => {
        rowsRef.current = projectRows;
      }, [projectRows]);
      React.useEffect(() => {
        if (filteredView === false) return;
        const nextState = filteredViewSelection(
          rows.map((row) => row.path),
          selection,
          selectedPath,
          activePath,
        );
        if (nextState.selection !== selection) setSelection(nextState.selection);
        if (nextState.primary !== selectedPath) setSelectedPath(nextState.primary);
        selectionAnchor.current = nextState.primary;
      }, [activePath, filteredView, rows, selectedPath, selection, setSelectedPath]);

      /**
       * Apply one click on a tree row, honouring IDEA's ⌘/Shift modifiers.
       *
       * A plain click replaces the selection; ⌘/Ctrl toggles one row; Shift takes
       * the whole visible range between the anchor and the clicked row, exactly
       * like the Project tool window's DnD and batch delete.
       * @param {object} row - flattened tree row.
       * @param {{metaKey?: boolean, ctrlKey?: boolean, shiftKey?: boolean}} event - click modifiers.
       */
      const selectRow = React.useCallback(
        (row, event) => {
          const path = row.path;
          const meta = event.metaKey === true || event.ctrlKey === true;
          if (event.shiftKey === true && selectionAnchor.current !== null) {
            const from = rows.findIndex((entry) => entry.path === selectionAnchor.current);
            const to = rows.findIndex((entry) => entry.path === path);
            if (from >= 0 && to >= 0) {
              const [start, end] = from <= to ? [from, to] : [to, from];
              setSelection(new Set(rows.slice(start, end + 1).map((entry) => entry.path)));
              setSelectedPathRaw(path);
              return;
            }
          }
          if (meta) {
            setSelection((current) => {
              const next = new Set(current);
              if (next.has(path)) next.delete(path);
              else next.add(path);
              setSelectedPathRaw(next.has(path) ? path : [...next].pop() ?? null);
              return next;
            });
            selectionAnchor.current = path;
            return;
          }
          setSelectedPath(path);
        },
        [rows, setSelectedPath],
      );

      /* Load Monaco once. */
      React.useEffect(() => {
        let cancelled = false;
        loadMonaco().then(
          () => {
            if (!cancelled) setMonacoReady(true);
          },
          (error) => {
            if (!cancelled) setMonacoError(error instanceof Error ? error.message : String(error));
          },
        );
        return () => {
          cancelled = true;
        };
      }, []);

      /* File tabs overflow like the terminal dock's: measure the strip, not the tabs. */
      React.useLayoutEffect(() => {
        const node = fileTabStripRef.current;
        if (node === null) return undefined;
        const measure = () => setTabStripWidth(node.clientWidth);
        measure();
        if (typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(measure);
        observer.observe(node);
        return () => observer.disconnect();
      }, []);

      /* The right group is often narrower than one full tab; measure it instead
         of letting additional tabs disappear beyond the pane's clipped edge. */
      React.useLayoutEffect(() => {
        const node = splitTabStripRef.current;
        if (node === null) return undefined;
        const measure = () => setSplitTabStripWidth(node.clientWidth);
        measure();
        if (typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(measure);
        observer.observe(node);
        return () => observer.disconnect();
      }, [splitTabs.length === 0]);

      const loadGit = React.useCallback(async () => {
        try {
          const value = await callGit({ op: 'status' });
          setGit(value);
          setCommitError(null);
          /* Keep the user's checkbox choices across a watcher/signature refresh;
             only drop paths that no longer exist. Re-selecting everything made
             a manual uncheck (or Space) bounce back on the next status frame. */
          setCommitSelection((current) => {
            const changes = value?.changes ?? [];
            if (commitSelectionLoadedRef.current === false) {
              commitSelectionLoadedRef.current = true;
              return new Set(changes.map((change) => change.path));
            }
            return new Set([...current].filter((path) => changes.some((change) => change.path === path)));
          });
          /* The watcher can remove one SIDE of an open diff between two status
             reads (e.g. it was unstaged, then only the index copy remains).
             Keeping the preview on the vanished side means its restore arrow
             targets a placeholder that no longer exists. Check the exact group
             the target opened from, not just the path. */
          setDiffTarget((current) => {
            if (current === null || typeof current.clipboardText === 'string'
              || typeof current.revision === 'string' || typeof current.commit === 'string'
              || current.combined === true) return current;
            const bands = splitChanges(value?.changes ?? []);
            const group = current.staged === true ? 'staged' : 'unstaged';
            const stillListed = listedInChangeBand(bands, group, current.path);
            if (stillListed) return current;
            return null;
          });
          setSelectedChange((current) => {
            if (current === null) return current;
            const bands = splitChanges(value?.changes ?? []);
            const group = current.staged === true ? 'staged' : 'unstaged';
            return listedInChangeBand(bands, group, current.path) ? current : null;
          });
          setSelectedChanges((current) => {
            if (current.size === 0) return current;
            const bands = splitChanges(value?.changes ?? []);
            const valid = new Set();
            for (const key of current) {
              const separator = key.indexOf(':');
              if (separator < 0) continue;
              const group = key.slice(0, separator) === 'staged' ? 'staged' : 'unstaged';
              const path = key.slice(separator + 1);
              if (listedInChangeBand(bands, group, path)) valid.add(key);
            }
            return valid.size === current.size ? current : valid;
          });
          return value;
        } catch (failure) {
          setGit({ root: '', branch: '', prefix: '', changes: [] });
          setCommitSelection(new Set());
          setCommitError(failure instanceof Error ? failure.message : String(failure));
          return null;
        }
      }, []);

      /**
       * Common commit prefixes, IDEA's commit-message templates in miniature.
       *
       * The list is fixed rather than free-form on purpose: a template that the
       * user has to configure first would never be used, and these are the
       * conventional prefixes this repository's history already follows.
       */
      const COMMIT_TEMPLATES = ['feat', 'fix', 'refactor', 'docs', 'test', 'chore', 'perf', 'style'];

      /**
       * Insert one template prefix at the start of the message.
       *
       * Applying a template twice must not produce `feat: feat: …`, so an
       * existing prefix that is itself a template is replaced.
       * @param {string} prefix - template to apply.
       */
      const applyCommitTemplate = React.useCallback((prefix) => {
        setCommitMessage((current) => {
          const text = current ?? '';
          const match = /^([a-z]+)(\([^)]*\))?: ?/u.exec(text);
          const rest = match !== null && COMMIT_TEMPLATES.includes(match[1]) ? text.slice(match[0].length) : text;
          return `${prefix}: ${rest}`;
        });
        setHistoryIndex(-1);
      }, []);

      /* Log paging: IDEA loads the history in pages as you scroll. */
      const LOG_PAGE = 60;
      /* Declared before `loadLog`, which resets it: reading it later would hit the TDZ. */
      const [logExhausted, setLogExhausted] = React.useState(false);
      /* Why the last log/graph request failed; null while the view is healthy. */
      const [logError, setLogError] = React.useState(null);
      const [logAuthor, setLogAuthor] = React.useState('');
      const logAuthorRef = React.useRef('');
      React.useEffect(() => {
        logAuthorRef.current = logAuthor;
      }, [logAuthor]);
      const logHistoryRef = React.useRef(null);

      /**
       * Reload the first page of the log, honouring the author filter.
       * @returns {Promise<void>} resolves once the first page is set.
       */
      const loadLog = React.useCallback(async () => {
        setLogLoading(true);
        try {
          const value = await callGit({ op: 'log', limit: LOG_PAGE, skip: 0, author: logAuthorRef.current });
          const firstPage = value.commits ?? [];
          setCommits(firstPage);
          /* A short first page already ends the history: no scroll will find more. */
          setLogExhausted(firstPage.length < LOG_PAGE);
          setLogError(null);
        } catch (failure) {
          setCommits([]);
          /* An empty list alone reads as "this repo has no commits"; the reason
             git gave is the only thing that explains why the log went blank. */
          setLogError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setLogLoading(false);
        }
      }, []);

      /**
       * Append the next page when the list is scrolled to the bottom.
       *
       * A short page means the history ended, so the next scroll does not ask
       * again; the flag resets with every reload or filter change.
       */
      const loadingMoreRef = React.useRef(false);
      const loadMoreLog = React.useCallback(async () => {
        if (loadingMoreRef.current || logExhausted) return;
        loadingMoreRef.current = true;
        try {
          const value = await callGit({ op: 'log', limit: LOG_PAGE, skip: commits.length, author: logAuthorRef.current });
          const page = value.commits ?? [];
          setCommits((current) => {
            const known = new Set(current.map((commit) => commit.hash));
            return [...current, ...page.filter((commit) => !known.has(commit.hash))];
          });
          if (page.length < LOG_PAGE) setLogExhausted(true);
          setLogError(null);
        } catch (failure) {
          /* a failed page leaves the list as it was, but must say why */
          setLogError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          loadingMoreRef.current = false;
        }
      }, [commits.length, logExhausted]);

      /**
       * Load the bounded commit graph for the Log tab's "Graph" toggle.
       *
       * Read on demand: a repository walk is heavier than the flat log, and most
       * log visits do not ask for lanes. The branch argument is the graph's own
       * filter — the flat log's author box must not leak into it.
       * @param {string} [branch] - local branch to walk; empty means every ref.
       * @returns {Promise<void>} resolves once the graph (or an error) is set.
       */
      const [graph, setGraph] = React.useState(null);
      const loadGraph = React.useCallback(async (branch, at) => {
        const branchValue = typeof branch === 'string' ? branch : '';
        const atValue = typeof at === 'string' ? at : '';
        setLogLoading(true);
        try {
          const value = await callGit({ op: 'graph', limit: 80, branch: branchValue, at: atValue });
          setGraph({
            entries: value?.entries ?? [],
            branches: value?.branches ?? [],
            tags: value?.tags ?? [],
            branchList: value?.branchList ?? [],
            tagList: Array.isArray(value?.tagList) ? value.tagList : [],
            head: typeof value?.head === 'string' ? value.head : null,
            branch: typeof value?.branch === 'string' ? value.branch : null,
            at: typeof value?.at === 'string' ? value.at : null,
          });
          setLogError(null);
        } catch (failure) {
          const message = failure instanceof Error ? failure.message : String(failure);
          setLogError(message);
          setGraph({
            entries: [],
            branches: [],
            tags: [],
            branchList: [],
            tagList: [],
            head: null,
            branch: branchValue !== '' ? branchValue : null,
            at: atValue !== '' ? atValue : null,
          });
        } finally {
          setLogLoading(false);
        }
      }, []);

      /**
       * Select one commit: load the detail AND keep the list on that row.
       *
       * The graph and the flat log are two views of the same selection. Walking
       * the graph with the keyboard used to fill the detail pane while the flat
       * list stayed where it was, so switching back to the list lost the commit
       * the user had just picked.
       * @param {string} hash - full commit hash.
       * @returns {Promise<void>} resolves once the detail is set.
       */
      const showCommit = React.useCallback(async (hash) => {
        setSelectedCommit(hash);
        try {
          setLogDetail(await callGit({ op: 'show', hash }));
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        }
      }, []);

      /**
       * Open one file's version inside one commit as a diff in the editor area.
       *
       * This is IDEA's "Show Diff" from the log: it never touches the working
       * tree, so a commit that deleted the file still renders its full change.
       * @param {{hash: string, path: string}} target - commit and workspace path.
       */
      /**
       * Compare one workspace file with the current clipboard, IDEA's "Compare with Clipboard".
       *
       * The clipboard is read in the browser (the host never sees it) and handed
       * to the diff as a text target. An empty or unreadable clipboard is reported
       * instead of opening a diff against nothing.
       * @param {string} path - workspace-relative file path.
       * @returns {Promise<void>} resolves once the diff is open or the failure shown.
       */
      const compareWithClipboard = React.useCallback(async (path) => {
        if (typeof path !== 'string' || path === '') return;
        let text = '';
        try {
          text = (await navigator.clipboard?.readText()) ?? '';
        } catch {
          setEditorError(t('editor.clipboardUnavailable'));
          return;
        }
        if (text === '') {
          setEditorError(t('editor.clipboardEmpty'));
          return;
        }
        setDiffTarget({ path, clipboardText: text, label: 'clipboard', staged: false });
      }, [t]);

      /**
       * Compare one tracked file's current working content with its HEAD blob.
       *
       * This is intentionally the combined view, not the staged-only or
       * worktree-only row: IDEA's file menu also offers a direct HEAD comparison
       * when both index and working copy have moved. It reuses the existing
       * read-only revision target and therefore the one Compare diff tab.
       * @param {string} path - workspace-relative file path.
       * @returns {void}
       */
      const compareWithHead = React.useCallback((path) => {
        if (typeof path !== 'string' || path === '') return;
        setDiffTarget({ path, revision: 'HEAD', staged: false });
        setDiffActive(true);
      }, []);

      /**
       * Offer the recent commits and compare the file against the chosen one.
       *
       * IDEA's "Compare with Revision" needs a revision first, so the picker is
       * the existing commit log rather than a free-form hash box: a typo would
       * otherwise become an "invalid commit id" error after two round trips.
       * @param {string} path - workspace-relative file path.
       */
      /**
       * Open IDEA's revision picker for one file ("Compare with Revision").
       *
       * The picker reads a full page (100) and is searchable, because a context
       * submenu could only offer a fixed handful and the commit you want is
       * usually older than that.
       * @param {string} path - workspace-relative file to compare.
       * @returns {Promise<void>} resolves once the picker has its first page.
       */
      const compareWithRevision = React.useCallback(async (path) => {
        if (typeof path !== 'string' || path === '') return;
        setRevisionPicker({ path, query: '', index: 0, commits: [], loading: true });
        try {
          const value = await callGit({ op: 'log', limit: 100 });
          setRevisionPicker((current) => (current === null ? current : { ...current, commits: value.commits ?? [], loading: false }));
        } catch (failure) {
          setEditorError(failure instanceof Error ? failure.message : String(failure));
          setRevisionPicker(null);
        }
      }, []);

      const showCommitDiff = React.useCallback((target) => {
        if (typeof target?.hash !== 'string' || typeof target?.path !== 'string') return;
        setDiffTarget({ path: target.path, commit: target.hash, staged: false });
        setDiffActive(true);
      }, []);

      /**
       * Open IDEA's combined diff for the selected working changes.
       *
       * The aggregate is intentionally read-only: per-file block restore must
       * keep operating on that file's actual index/worktree side, not on a
       * merged text document. The host reuses the same single-file diff source.
       *
       * @param {Array<{path: string, staged?: boolean}>} targetList - selected change identities.
       * @returns {void}
       */
      const showCombinedDiff = React.useCallback((targetList) => {
        const entries = (Array.isArray(targetList) ? targetList : [])
          .filter((entry) => typeof entry?.path === 'string' && entry.path !== '')
          .map((entry) => ({
            path: entry.path,
            staged: entry.staged === true,
            heading: `${entry.path} · ${entry.staged === true ? t('editor.stagedMode') : t('editor.unstagedMode')}`,
          }));
        if (entries.length < 2) return;
        setDiffTarget({ combined: true, entries, staged: false });
        setDiffActive(true);
      }, [t]);

      /* IDEA's per-file history: a filtered log of the commits that touched one path. */
      const [historyPath, setHistoryPath] = React.useState(null);
      const showFileHistory = React.useCallback(async (path) => {
        if (typeof path !== 'string' || path === '') return;
        /* IDEA answers "Show History" by opening the Commit tool window's Log tab. */
        setActivity('commit');
        setPanelVisible(true);
        setCommitMode('log');
        setHistoryPath(path);
        setLogLoading(true);
        try {
          const value = await callGit({ op: 'fileHistory', path });
          setCommits(value.commits ?? []);
          setLogExhausted(true);
          setLogDetail(null);
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
          setCommits([]);
        } finally {
          setLogLoading(false);
        }
      }, []);
      /**
       * Apply the log's author filter, debounced so typing does not spawn a git per key.
       *
       * File history and the full log answer different questions, so switching the
       * filter drops back to the repository-wide log — matching IDEA's Log tab.
       */
      const authorTimer = React.useRef(null);
      const changeLogAuthor = React.useCallback((value) => {
        setLogAuthor(value);
        logAuthorRef.current = value;
        if (authorTimer.current !== null) window.clearTimeout(authorTimer.current);
        authorTimer.current = window.setTimeout(() => {
          authorTimer.current = null;
          setHistoryPath(null);
          void loadLog();
        }, 350);
      }, [loadLog]);
      React.useEffect(() => () => {
        if (authorTimer.current !== null) window.clearTimeout(authorTimer.current);
      }, []);

      const clearFileHistory = React.useCallback(() => {
        setHistoryPath(null);
        void loadLog();
      }, [loadLog]);

      /* Load the workspace root and its git status. */
      const loadRoot = React.useCallback(async (foldersFirstOverride) => {
        /* A silent refresh once there is something on screen: flipping the flag on
           every poll made the placeholder row appear above the list and shove the
           whole tree down (and back) every few seconds. */
        if (shouldShowTreeLoading({ loading: true, rowCount: treeRootRef.current === '' ? 0 : rowsRef.current.length })) setTreeLoading(true);
        try {
          const requestFoldersFirst = typeof foldersFirstOverride === 'boolean' ? foldersFirstOverride : foldersFirst;
          const value = await callFs({ op: 'list', path: '', showHidden, sort: sortMode, foldersFirst: requestFoldersFirst, showExcluded: showExcludedFiles });
          const listing = Array.isArray(value.entries) ? value.entries : [];
          setRoot(value.root ?? '');
          setHome(value.home ?? '');
          treeRootRef.current = value.root ?? '';
          if (toolWidthsRestoredFor.current !== (value.root ?? '')) {
            toolWidthsRestoredFor.current = value.root ?? '';
            setToolWidths({
              project: readToolWidth(value.root ?? '', 'project', 28),
              commit: readToolWidth(value.root ?? '', 'commit', 25),
            });
          }
          /* Keep the array React already holds when the listing is identical: a
             new array reference re-renders every row (a visible flash) even though
             nothing on disk changed. */
          setEntries((current) => keepUnchangedListing(current, listing));
          setTreeError(null);
          /* The fold keys embed the root, so they are restored here (not in the
             initialiser). Guarded by the root itself rather than by "first load":
             a poll must not overwrite folds made a moment ago, but switching to a
             different workspace still has to restore ITS folds. */
          if (collapsedRestoredFor.current !== (value.root ?? '')) {
            collapsedRestoredFor.current = value.root ?? '';
            setCollapsedGroups(readCollapsedGroups(value.root ?? ''));
          }
          const restored = readExpanded(value.root ?? '');
          setExpanded((current) => {
            let next = null;
            for (const path of ['', ...restored]) {
              if (current.has(path)) continue;
              if (next === null) next = new Set(current);
              next.add(path);
            }
            /* Same membership: return the SAME Set, or the flattened-row memo
               recomputes and every tree row re-renders on an idle poll. */
            return next ?? current;
          });
          expandedRestoredRef.current = value.root ?? '';
          /* Restored directories must also fetch their children, or they render empty. */
          const hydrated = {};
          for (const path of restored) {
            try {
              const listing = await callFs({ op: 'list', path, showHidden, sort: sortMode, foldersFirst, showExcluded: showExcludedFiles });
              hydrated[path] = listing.entries ?? [];
            } catch {
              /* a directory that vanished stays collapsed in effect */
            }
          }
          if (Object.keys(hydrated).length > 0) {
            setChildren((current) => {
              const next = { ...current };
              for (const [path, listing] of Object.entries(hydrated)) next[path] = keepUnchangedListing(current[path], listing);
              return next;
            });
          }
          /* Establish the "new file" baseline on load as well: refreshTree compares
             against it, and leaving it null until the first refresh means that
             refresh only re-baselines instead of reporting what appeared. */
          if (knownPathsRef.current === null) knownPathsRef.current = new Set(collectFilePaths(listing));
          await loadGit();
          return listing;
        } catch (error) {
          setTreeError(error instanceof Error ? error.message : String(error));
          return null;
        } finally {
          setTreeLoading(false);
        }
      }, [foldersFirst, loadGit, showExcludedFiles, showHidden, sortMode]);

      React.useEffect(() => {
        void loadRoot();
      }, [foldersFirst, loadRoot, showExcludedFiles, showHidden, sortMode]);

      /* Restore the per-workspace MRU list once the root is known. */
      React.useEffect(() => {
        if (root === '') return;
        setRecentFiles(readRecentFiles(root));
      }, [root]);

      /* Restore the per-workspace commit message history. */
      React.useEffect(() => {
        if (root === '') return;
        try {
          const raw = window.localStorage.getItem(`dsh-editor.commitHistory:${root}`);
          const parsed = raw === null ? [] : JSON.parse(raw);
          setMessageHistory(Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : []);
        } catch {
          setMessageHistory([]);
        }
        setHistoryIndex(-1);
      }, [root]);

      /* Restore the unsent draft when the workspace (and so its key) becomes known. */
      React.useEffect(() => {
        if (root === '') return;
        const draft = readCommitDraft(root);
        if (draft !== '') setCommitMessage((current) => (current === '' ? draft : current));
      }, [root]);

      /* Debounce writes: typing must not hit localStorage on every keystroke. */
      const draftTimer = React.useRef(null);
      React.useEffect(() => {
        if (root === '') return undefined;
        if (draftTimer.current !== null) window.clearTimeout(draftTimer.current);
        draftTimer.current = window.setTimeout(() => {
          draftTimer.current = null;
          writeCommitDraft(root, commitMessage);
        }, 400);
        return () => {
          if (draftTimer.current !== null) window.clearTimeout(draftTimer.current);
        };
      }, [commitMessage, root]);

      /**
       * Expand or collapse one directory, loading its children.
       *
       * Expanding always re-reads the directory: a cached listing goes stale the
       * moment something outside the editor creates or deletes a child, and the
       * tree would then keep hiding it forever (the entry never appears, even
       * after collapse + expand).
       * @param {string} path - workspace-relative directory path.
       * @returns {Promise<void>} resolves once the listing is applied.
       */
      const toggleDirectory = React.useCallback(async (path) => {
        /* Decide from the render's own `expanded` (this closure is rebuilt whenever it
           changes), never from a ref synced in an effect or from inside the updater:
           both are stale at click time, which silently skipped the fetch. */
        const willExpand = !expanded.has(path);
        setExpanded((current) => {
          const next = new Set(current);
          if (next.has(path)) next.delete(path);
          else next.add(path);
          return next;
        });
        if (path === '' || !willExpand) return;
        const hydration = {};
        const expandedPaths = [path];
        try {
          const value = await callFs({ op: 'list', path, showHidden, sort: sortMode, foldersFirst, showExcluded: showExcludedFiles });
          /* `children` is keyed by the same relative path the rows carry. */
          let listing = Array.isArray(value?.entries) ? value.entries : [];
          hydration[path] = listing;
          let chainPath = path;
          let guard = 0;
          /* Compact Directories makes the merged node the expand gesture. Load
             the rest of a single-child chain now, so one click reveals content
             instead of converting the row to a still-collapsed `a/b` node. */
          while (compactDirectories === true && listing.length === 1 && listing[0]?.kind === 'directory' && guard < 64) {
            const nextPath = listing[0].path;
            if (typeof nextPath !== 'string' || nextPath === '' || nextPath === chainPath) break;
            let nextListing;
            try {
              const nextValue = await callFs({ op: 'list', path: nextPath, showHidden, sort: sortMode, foldersFirst, showExcluded: showExcludedFiles });
              nextListing = Array.isArray(nextValue?.entries) ? nextValue.entries : [];
            } catch {
              break;
            }
            chainPath = nextPath;
            hydration[chainPath] = nextListing;
            expandedPaths.push(chainPath);
            listing = nextListing;
            guard += 1;
          }
          setChildren((current) => {
            const next = { ...current };
            for (const [listingPath, entriesInDirectory] of Object.entries(hydration)) {
              next[listingPath] = entriesInDirectory;
            }
            return next;
          });
          setExpanded((current) => {
            let next = null;
            for (const expandedPath of expandedPaths) {
              if (current.has(expandedPath)) continue;
              if (next === null) next = new Set(current);
              next.add(expandedPath);
            }
            return next ?? current;
          });
        } catch (error) {
          setTreeError(error instanceof Error ? error.message : String(error));
        }
      }, [compactDirectories, expanded, foldersFirst, showExcludedFiles, showHidden, sortMode]);

      /* Open a file, reusing its existing tab. */
      /**
       * Paths whose read is in flight.
       *
       * A double-click fires two opens before either read resolves; without this
       * guard both appends land and the tab strip shows the same file twice.
       */
      const openingRef = React.useRef(new Set());
      /**
       * Note one visit in this workspace's MRU list (IDEA's Recent Files).
       *
       * Called for every open — including a file that is already in a tab, since
       * clicking a tab is exactly the "I was just here" signal ⌘E is for.
       * @param {string} path - workspace-relative path.
       * @returns {void}
       */
      const noteRecent = React.useCallback((path) => {
        if (typeof path !== 'string' || path === '') return;
        const workspace = rootRef.current;
        if (workspace === '') return;
        setRecentFiles((current) => {
          const next = pushRecent(current, path);
          /* Same array → same state → no re-render on an idle re-open. */
          if (next === current) return current;
          writeRecentFiles(workspace, next);
          return next;
        });
      }, []);

      /**
       * Keep every path-keyed editor surface attached to the same file after a
       * Project rename or move. The filesystem operation already happened; this
       * callback prevents stale Model keys, preview labels, comparisons and MRU
       * entries from pointing at the old path.
       *
       * @param {Array<[string, string]>} entries - old/new paths from the move.
       * @returns {void}
       */
      const remapEditorPaths = React.useCallback((entries) => {
        const moves = (Array.isArray(entries) ? entries : [])
          .filter((entry) => Array.isArray(entry) && typeof entry[0] === 'string' && entry[0] !== '' && typeof entry[1] === 'string' && entry[1] !== '');
        if (moves.length === 0) return;
        const remap = (path) => remapPathAfterMove(path, moves);

        for (const [path, model] of [...modelsRef.current.entries()]) {
          const next = remap(path);
          if (next === path) continue;
          modelsRef.current.delete(path);
          modelsRef.current.set(next, model);
        }

        if (previewPathRef.current !== null) {
          const next = remap(previewPathRef.current);
          if (next !== previewPathRef.current) {
            previewPathRef.current = next;
            setPreviewPath(next);
          }
        }

        setOpenFiles((current) => {
          let changed = false;
          const next = current.map((file) => {
            const path = remap(file.path);
            if (path === file.path) return file;
            changed = true;
            return { ...file, path };
          });
          return changed ? next : current;
        });
        setActivePath((current) => (current === null ? current : remap(current)));
        setSplitTabs((current) => {
          let changed = false;
          const seen = new Set();
          const nextTabs = [];
          for (const path of current) {
            const next = remap(path);
            if (next !== path) changed = true;
            if (seen.has(next)) {
              changed = true;
              continue;
            }
            seen.add(next);
            nextTabs.push(next);
          }
          if (!changed) return current;
          splitTabsRef.current = nextTabs;
          return nextTabs;
        });
        if (splitPathRef.current !== null) {
          const next = remap(splitPathRef.current);
          if (next !== splitPathRef.current) {
            splitPathRef.current = next;
            setSplitPath(next);
          }
        }
        setDiffTarget((current) => {
          if (current === null || typeof current.path !== 'string') return current;
          const path = remap(current.path);
          return path === current.path ? current : { ...current, path };
        });
        setAnnotateTarget((current) => {
          if (current === null || typeof current.path !== 'string') return current;
          const path = remap(current.path);
          return path === current.path ? current : { ...current, path };
        });
        setRecentFiles((current) => {
          let changed = false;
          const seen = new Set();
          const next = [];
          for (const path of current) {
            const mapped = remap(path);
            if (mapped !== path || seen.has(mapped)) changed = true;
            if (seen.has(mapped)) continue;
            seen.add(mapped);
            next.push(mapped);
          }
          if (!changed) return current;
          const workspace = rootRef.current;
          if (workspace !== '') writeRecentFiles(workspace, next);
          return next;
        });
      }, []);

      const openFile = React.useCallback(async (path, options = {}) => {
        setSelectedPath(path);
        /* The Commit diff is a tab of its own: picking a file shows that file and
           leaves the diff tab where it is, ready to be clicked back (IDEA). */
        setDiffActive(false);
        noteRecent(path);
        const wantsPreview = options.preview === true && previewTabEnabled;
        const existing = openFilesRef.current.find((file) => file.path === path);
        /* A second open of a file already being read just focuses it; the first
           read will place the tab. */
        if (existing === undefined && openingRef.current.has(path)) {
          setActivePath(path);
          return true;
        }
        if (existing !== undefined) {
          /* Re-opening an already open file must NOT clear Annotate: clicking a
             blame row to inspect a commit while annotating would drop the reading
             mode the user just asked for. Diff still closes, since it replaces
             the same surface with a different file's change. */
          if (!wantsPreview && previewPathRef.current === path) {
            previewPathRef.current = null;
            setPreviewPath(null);
          }
          setActivePath(path);
          return true;
        }
        openingRef.current.add(path);
        try {
          const value = await callFs({ op: 'read', path });
          const file = { path, content: value.content, dirty: false, mtime: value.mtime ?? null };
          if (wantsPreview) {
            const previous = previewPathRef.current;
            const previousFile = previous === null ? undefined : openFilesRef.current.find((entry) => entry.path === previous);
            if (previous !== null && previous !== path && previousFile?.dirty !== true) {
              const model = modelsRef.current.get(previous);
              model?.dispose?.();
              modelsRef.current.delete(previous);
              setOpenFiles((current) => current.filter((entry) => entry.path !== previous));
            }
          }
          /* Re-check on arrival: a parallel open may have appended it already. */
          setOpenFiles((current) => (current.some((entry) => entry.path === path) ? current : [file, ...current]));
          if (wantsPreview) {
            previewPathRef.current = path;
            setPreviewPath(path);
          }
          setActivePath(path);
          setEditorError(null);
          return true;
        } catch (error) {
          if (options.silentError !== true) setEditorError(error instanceof Error ? error.message : String(error));
          return false;
        } finally {
          openingRef.current.delete(path);
        }
      }, [noteRecent, previewTabEnabled]);

      /* IDEA's EditSource opens the local working copy and hands it the keyboard.
         Tree clicks intentionally keep focus in the tree, so callers that mean
         "edit this source" use this explicit path instead. */
      const editLocalVersion = React.useCallback((path) => {
        void openFile(path).then(() => window.setTimeout(() => editorRef.current?.focus(), 0));
      }, [openFile]);

      /**
       * Reveal one search location in the right editor group after it binds.
       * @param {string} path - workspace-relative file.
       * @param {number} line - one-based line.
       * @param {number} column - one-based column.
       * @returns {void}
       */
      const revealSplitLocation = React.useCallback((path, line, column) => {
        if (typeof path !== 'string' || path === '' || !Number.isFinite(line) || line < 1) return;
        let attempts = 0;
        let applied = 0;
        const reveal = () => {
          const editor = splitEditorRef.current;
          const model = editor?.getModel?.() ?? null;
          const expectedModel = modelsRef.current.get(path) ?? null;
          if (editor === null || model === null || model !== expectedModel || splitPathRef.current !== path) {
            attempts += 1;
            if (attempts < 60) window.requestAnimationFrame(reveal);
            return;
          }
          const safeLine = Math.min(Math.max(1, Math.floor(line)), model.getLineCount());
          const safeColumn = Math.min(Math.max(1, Math.floor(column ?? 1)), model.getLineMaxColumn(safeLine));
          editor.setSelection(new window.monaco.Range(safeLine, safeColumn, safeLine, safeColumn));
          editor.revealLineInCenter(safeLine);
          applied += 1;
          if (applied < 3) {
            window.requestAnimationFrame(reveal);
            return;
          }
          editor.focus();
        };
        window.requestAnimationFrame(reveal);
      }, []);

      /**
       * Open one or more Project files in the right editor group.
       *
       * Files join the shared openFiles list one at a time in stable caller
       * order. The left group's active tab is restored after the reads so the
       * action never steals the document the user was editing.
       * @param {string|string[]} target - one path or an ordered file batch.
       * @returns {Promise<void>} resolves after the right pane is requested.
       */
      const openInRightSplit = React.useCallback(async (target, location = null) => {
        const requested = Array.isArray(target) ? target : [target];
        const paths = [...new Set(requested.filter((path) => typeof path === 'string' && path !== ''))];
        if (paths.length === 0) return;
        const previous = activePathRef.current;
        let lastOpened = null;
        for (const path of paths) {
          if (!await openFile(path)) continue;
          lastOpened = path;
          const nextSplitTabs = splitTabsRef.current.includes(path) ? splitTabsRef.current : [...splitTabsRef.current, path];
          splitTabsRef.current = nextSplitTabs;
          setSplitTabs((current) => current.includes(path) ? current : [...current, path]);
          setSplitPath(path);
          splitPathRef.current = path;
        }
        if (lastOpened === null) return;
        setAnnotateTarget(null);
        setActivePath(previous);
        if (location !== null && lastOpened === location.path) {
          revealSplitLocation(lastOpened, location.line, location.column);
        } else {
          window.setTimeout(() => splitEditorRef.current?.focus(), 0);
        }
      }, [openFile, revealSplitLocation]);

      /**
       * Restore this workspace's clean editor tabs after the root is known.
       *
       * Dirty buffers are intentionally absent from the stored session. Each
       * path is re-read through the normal openFile path so missing or forbidden
       * files are dropped instead of resurrected as invalid tabs.
       * @returns {Promise<void>} resolves once existing tabs and split state settle.
       */
      const restoreEditorSession = React.useCallback(async () => {
        if (root === '' || sessionRestoredFor.current === root) return;
        const requestedRoot = root;
        const generation = ++sessionRestoreGeneration.current;
        sessionRestoredFor.current = requestedRoot;
        sessionRestoringRef.current = true;
        const stored = readEditorSession(requestedRoot);
        openFilesRef.current = [];
        splitTabsRef.current = [];
        splitPathRef.current = null;
        setOpenFiles([]);
        setSplitTabs([]);
        setSplitPath(null);
        const requested = [...new Set([...stored.openPaths, ...stored.splitPaths])];
        const opened = new Set();
        try {
          for (const path of requested) {
            if (sessionRestoreGeneration.current !== generation) return;
            if (!await openFile(path)) continue;
            opened.add(path);
          }
          if (sessionRestoreGeneration.current !== generation) return;
          const restoredOpenPaths = requested.filter((path) => opened.has(path));
          const restoredSplitPaths = stored.splitPaths.filter((path) => opened.has(path));
          if (restoredOpenPaths.length > 0) {
            setOpenFiles((current) => {
              const byPath = new Map(current.map((file) => [file.path, file]));
              return restoredOpenPaths.map((path) => byPath.get(path)).filter(Boolean);
            });
          }
          const restoredActive = stored.activePath !== null && opened.has(stored.activePath)
            ? stored.activePath
            : restoredOpenPaths[0] ?? null;
          const restoredSplit = stored.splitPath !== null && restoredSplitPaths.includes(stored.splitPath)
            ? stored.splitPath
            : restoredSplitPaths[0] ?? null;
          setActivePath(restoredActive);
          setSplitTabs(restoredSplitPaths);
          splitTabsRef.current = restoredSplitPaths;
          setSplitPath(restoredSplit);
          splitPathRef.current = restoredSplit;
          if (stored.splitPercent !== null) setEditorSplitPercent(stored.splitPercent);
        } finally {
          if (sessionRestoreGeneration.current === generation) sessionRestoringRef.current = false;
        }
      }, [openFile, root]);

      React.useEffect(() => {
        void restoreEditorSession();
      }, [restoreEditorSession]);

      /* Persist clean editor tabs per workspace after the initial restore settles. */
      const sessionPersistTimer = React.useRef(null);
      React.useEffect(() => {
        if (root === '' || sessionRestoredFor.current !== root || sessionRestoringRef.current) return undefined;
        if (sessionPersistTimer.current !== null) window.clearTimeout(sessionPersistTimer.current);
        sessionPersistTimer.current = window.setTimeout(() => {
          sessionPersistTimer.current = null;
          const cleanFiles = openFiles.filter((file) => file.dirty !== true);
          const cleanPaths = new Set(cleanFiles.map((file) => file.path));
          const nextActive = activePath !== null && cleanPaths.has(activePath)
            ? activePath
            : cleanFiles[0]?.path ?? null;
          const cleanSplitTabs = splitTabs.filter((path) => cleanPaths.has(path));
          const nextSplit = splitPath !== null && cleanPaths.has(splitPath) && cleanSplitTabs.includes(splitPath)
            ? splitPath
            : cleanSplitTabs[0] ?? null;
          writeEditorSession(root, {
            openPaths: cleanFiles.map((file) => file.path),
            activePath: nextActive,
            splitPaths: cleanSplitTabs,
            splitPath: nextSplit,
            splitPercent: editorSplitPercent,
          });
        }, 250);
        return () => {
          if (sessionPersistTimer.current !== null) {
            window.clearTimeout(sessionPersistTimer.current);
            sessionPersistTimer.current = null;
          }
        };
      }, [activePath, editorSplitPercent, openFiles, root, splitPath, splitTabs]);

      /**
       * Save one open model by path.
       *
       * Split editor groups share this path-addressed save entry so a focused
       * right pane writes its own file instead of whichever tab the left pane
       * happens to expose.
       * @param {string|null} path - workspace-relative file path.
       * @param {boolean} [force=false] - overwrite after an explicit conflict confirmation.
       * @returns {Promise<void>} resolves after the write attempt.
       */
      const savePath = React.useCallback(
        async (path, force = false) => {
          if (typeof path !== 'string' || path === '') return;
          const model = modelsRef.current.get(path);
          if (model === undefined) return;
          const file = openFilesRef.current.find((entry) => entry.path === path);
          setSaving(true);
          try {
            const value = await callFs({ op: 'write', path, content: model.getValue(), mtime: file?.mtime ?? undefined, force });
            setOpenFiles((current) =>
              current.map((entry) =>
                entry.path === path ? { ...entry, content: model.getValue(), dirty: false, mtime: value.mtime ?? entry.mtime } : entry,
              ),
            );
            setEditorError(null);
            setConflict(null);
            await loadGit();
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (/changed on disk|no longer exists/u.test(message)) {
              /* IDEA asks before clobbering someone else's edit. */
              setConflict({ path, message });
            } else {
              setEditorError(message);
            }
          } finally {
            setSaving(false);
          }
        },
        [loadGit],
      );

      /* Save the active model. */
      const saveActive = React.useCallback(async (force = false) => {
        await savePath(activePathRef.current, force);
      }, [savePath]);

      /**
       * Flip the active model between spaces and tabs, IDEA's indentation chip.
       *
       * Monaco's own "convert indentation" actions rewrite the existing lines, so
       * the whole file follows the new setting instead of only new typing.
       * `model.detectIndentation` is deliberately NOT used: it re-detects from the
       * content and would immediately undo the user's choice.
       */
      const toggleIndentation = React.useCallback(() => {
        const editor = editorRef.current;
        const model = editor?.getModel();
        if (editor === null || editor === undefined || model === null || model === undefined) return;
        const options = model.getOptions();
        const insertSpaces = options.insertSpaces === false;
        model.updateOptions({ insertSpaces, tabSize: options.tabSize });
        const action = editor.getAction?.(insertSpaces ? 'editor.action.indentationToSpaces' : 'editor.action.indentationToTabs');
        void action?.run?.();
        model.updateOptions({ insertSpaces, tabSize: options.tabSize });
        setFileMode((current) => ({ ...current, insertSpaces }));
      }, []);

      /**
       * Switch the active model between LF and CRLF, IDEA's line-separator chip.
       *
       * Monaco's `pushEOL` takes the `EndOfLineSequence` enum (0 = LF, 1 = CRLF),
       * not the separator string: a string is silently treated as LF.
       */
      const toggleLineSeparator = React.useCallback(() => {
        const editor = editorRef.current;
        const model = editor?.getModel();
        const monaco = window.monaco;
        if (editor === null || editor === undefined || model === null || model === undefined) return;
        const next = model.getEOL() === '\r\n' ? '\n' : '\r\n';
        const sequence = monaco?.editor?.EndOfLineSequence;
        const value = next === '\r\n' ? (sequence?.CRLF ?? 1) : (sequence?.LF ?? 0);
        model.pushEOL(value);
        setFileMode((current) => ({ ...current, eol: next === '\r\n' ? 'CRLF' : 'LF' }));
      }, []);

      /**
       * Toggle the Annotate view for the active file.
       *
       * Annotate and diff are mutually exclusive: both replace the editor area,
       * so opening one closes the other instead of stacking two panes.
       */
      const toggleAnnotate = React.useCallback(async () => {
        const path = activePathRef.current;
        if (path === null) return;
        if (annotateTarget !== null) {
          setAnnotateTarget(null);
          return;
        }
        setDiffTarget(null);
        setAnnotateTarget({ path });
        setAnnotateLoading(true);
        setAnnotateLines([]);
        setAnnotateTruncated(false);
        try {
          const value = await callGit({ op: 'blame', path });
          setAnnotateLines(value?.lines ?? []);
          setAnnotateTruncated(value?.truncated === true);
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setAnnotateLoading(false);
        }
      }, [annotateTarget]);

      /**
       * Jump from an Annotate line to the commit that introduced it.
       *
       * IDEA answers the click by opening the change in its Log; here that means
       * the Commit tool window's Log tab with the commit selected, while the
       * annotate reading position is kept so the user can come back.
       * @param {string} hash - full commit hash from the blame row.
       * @returns {void}
       */
      const openCommitFromAnnotate = React.useCallback((hash) => {
        if (typeof hash !== 'string' || hash === '') return;
        setActivity('commit');
        setPanelVisible(true);
        setCommitMode('log');
        setHistoryPath(null);
        void loadLog();
        void showCommit(hash);
      }, [loadLog, showCommit]);

      /* Reveal a line requested by a terminal link once the model is bound. */
      const pendingReveal = React.useRef(null);
      const revealLines = React.useCallback((path, line, column) => {
        const focused = focusedEditorRef.current;
        const editor = focused?.path === path ? focused.editor : editorRef.current;
        const model = modelsRef.current.get(path);
        if (editor === null || model === undefined || typeof line !== 'number' || line < 1) return;
        const safeLine = Math.min(Math.max(1, line), model.getLineCount());
        const safeColumn = Math.min(Math.max(1, column ?? 1), model.getLineMaxColumn(safeLine));
        editor.setSelection(new window.monaco.Range(safeLine, safeColumn, safeLine, safeColumn));
        editor.revealLineInCenter(safeLine);
        editor.focus();
      }, []);

      /**
       * Open a search hit and reveal its exact line once the model is bound.
       * Reopening the already-active tab must still move the caret, so this
       * cannot rely on an active-path change effect.
       * @param {string} path - workspace-relative file.
       * @param {number} line - one-based line.
       * @param {number} column - one-based column.
       * @returns {void}
       */
      const openFileAtLocation = React.useCallback((path, line, column) => {
        if (typeof path !== 'string' || path === '') return;
        void openFile(path).then((opened) => {
          if (!opened) return;
          let attempts = 0;
          const reveal = () => {
            if (!modelsRef.current.has(path)) {
              attempts += 1;
              if (attempts < 30) window.requestAnimationFrame(reveal);
              return;
            }
            revealLines(path, line, column);
          };
          window.requestAnimationFrame(reveal);
        });
      }, [openFile, revealLines]);

      /** Transient status-bar message, IDEA's its own "file(s) saved" hint. */
      const [statusNotice, setStatusNotice] = React.useState(null);
      const statusNoticeTimer = React.useRef(null);
      const flashStatus = React.useCallback((message) => {
        setStatusNotice(message);
        if (statusNoticeTimer.current !== null) window.clearTimeout(statusNoticeTimer.current);
        statusNoticeTimer.current = window.setTimeout(() => {
          statusNoticeTimer.current = null;
          setStatusNotice(null);
        }, 4000);
      }, []);
      React.useEffect(() => () => {
        if (statusNoticeTimer.current !== null) window.clearTimeout(statusNoticeTimer.current);
      }, []);

      /**
       * Save every dirty tab, IDEA's "Save All" (⌥⌘S / Ctrl+Alt+S).
       *
       * A tab whose file changed on disk is left alone: it keeps its conflict
       * banner instead of being force-written behind the user's back.
       * @returns {Promise<number>} how many files were written.
       */
      const saveAll = React.useCallback(async () => {
        const dirty = openFilesRef.current.filter((file) => file.dirty);
        let written = 0;
        for (const file of dirty) {
          const model = modelsRef.current.get(file.path);
          if (model === undefined) continue;
          try {
            const value = await callFs({ op: 'write', path: file.path, content: model.getValue(), mtime: file.mtime ?? undefined });
            setOpenFiles((current) =>
              current.map((entry) => (entry.path === file.path ? { ...entry, content: model.getValue(), dirty: false, mtime: value.mtime ?? entry.mtime } : entry)),
            );
            written += 1;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (/changed on disk|no longer exists/u.test(message)) setConflict({ path: file.path, message });
            else setEditorError(message);
          }
        }
        if (written > 0) {
          flashStatus(t('editor.savedAll', { count: written }));
          await loadGit();
        }
        return written;
      }, [flashStatus, loadGit, t]);

      /* IDEA's "Go to Line" (⌘/Ctrl+L): accept `123` or `12:7`. */
      const [gotoState, setGotoState] = React.useState(null);
      const gotoLine = React.useCallback(() => {
        if (currentCodePath() === null) return;
        setGotoState({ value: '' });
      }, [currentCodePath]);
      const commitGotoLine = React.useCallback(() => {
        const raw = gotoState?.value?.trim() ?? '';
        const match = /^(\d+)(?:\s*[:,]\s*(\d+))?$/u.exec(raw);
        const path = currentCodePath();
        setGotoState(null);
        if (match === null || path === null) {
          setEditorError(t('editor.invalidName'));
          return;
        }
        revealLines(path, Number(match[1]), match[2] === undefined ? 1 : Number(match[2]));
      }, [currentCodePath, gotoState, revealLines, t]);

      /* A terminal link asks the editor to open a workspace file at a location. */
      React.useEffect(() => {
        const host = document.querySelector('[data-dsh-editor-workspace]');
        if (host === null) return;
        const onOpen = (event) => {
          const detail = event.detail ?? {};
          const path = typeof detail.path === 'string' ? detail.path : '';
          if (path === '') return;
          pendingReveal.current = { path, line: detail.line ?? null, column: detail.column ?? null };
          void openFile(path);
        };
        host.addEventListener('dsh-editor-open-file', onOpen);
        return () => host.removeEventListener('dsh-editor-open-file', onOpen);
      }, [openFile]);

      /** Mirror one focused Monaco editor into the shared status bar. */
      const syncEditorStatus = React.useCallback((editor) => {
        const model = editor?.getModel?.();
        if (model === null || model === undefined) return;
        const options = model.getOptions?.() ?? {};
        setFileMode({
          tabSize: typeof options.tabSize === 'number' ? options.tabSize : 2,
          insertSpaces: options.insertSpaces !== false,
          eol: model.getEOL?.() === '\r\n' ? 'CRLF' : 'LF',
          encoding: 'UTF-8',
        });
        const position = editor.getPosition?.();
        if (position !== null && position !== undefined) {
          setCaret({ line: position.lineNumber, column: position.column });
        }
        const selection = editor.getSelection?.();
        const selected = selection === null || selection === undefined ? '' : model.getValueInRange(selection);
        setLineStats({ lines: model.getLineCount(), selected: selected.length });
      }, []);

      /* Create Monaco once the container exists. */
      React.useEffect(() => {
        if (!monacoReady || containerRef.current === null) return;
        const monaco = window.monaco;
        if (monaco?.editor === undefined) return;
        const group = createCodeEditorGroup(monaco, containerRef.current, {
          onSave: () => void saveActive(),
          onFind: () => {
            /* ⌘F belongs to whatever has focus: the Project tree's speed search,
               the terminal's find bar, or this editor find bar — never two at once. */
            if (document.activeElement?.closest('.monaco-editor') == null) return;
            setReplaceState((current) => current ?? { find: '', replace: '', index: 0, total: 0, withReplace: false, preserveCase: false, scope: null });
          },
          textSearchLabel: t('editor.textSearchAction'),
          onSearchText: () => {
            openSearchEverywhereRef.current?.('text');
            window.setTimeout(() => document.querySelector('[data-dsh-search-query]')?.focus?.(), 0);
          },
          findUsagesLabel: t('editor.findUsagesAction'),
          selectAllOccurrencesLabel: t('editor.selectAllOccurrencesAction'),
          selectNextOccurrenceLabel: t('editor.selectNextOccurrenceAction'),
          unselectPreviousOccurrenceLabel: t('editor.unselectPreviousOccurrenceAction'),
          searchWebLabel: t('editor.searchWebAction'),
          findInFilesLabel: t('editor.findInFilesAction'),
          replaceInFilesLabel: t('editor.replaceInFilesAction'),
          findUsagesInFileLabel: t('editor.findUsagesInFileAction'),
          highlightUsagesInFileLabel: t('editor.highlightUsagesInFileAction'),
          findWordAtCaretLabel: t('editor.nextWordOccurrenceAction'),
          previousWordOccurrenceLabel: t('editor.previousWordOccurrenceAction'),
          replaceLabel: t('editor.replaceAction'),
          incrementalSearchLabel: t('editor.incrementalSearchAction'),
          onReplace: (editor) => editorFindContextRunnerRef.current?.(editor, true, 'replace'),
          onIncrementalSearch: (editor) => editorFindContextRunnerRef.current?.(editor, false, 'query'),
          findInSelectionLabel: t('editor.searchInSelectionOnly'),
          replaceInSelectionLabel: t('editor.replaceInSelectionOnly'),
          onFindInSelection: (editor) => selectionFindContextRunnerRef.current?.(editor, false, 'query'),
          onReplaceInSelection: (editor) => selectionFindContextRunnerRef.current?.(editor, true, 'replace'),
          onFindUsagesInFile: (editor) => editorFindContextRunnerRef.current?.(editor),
          onFindInFiles: (editor) => findToolContextRunnerRef.current?.(editor, 'find'),
          onReplaceInFiles: (editor) => findToolContextRunnerRef.current?.(editor, 'replace'),
          onFindUsages: (editor) => findUsagesRunnerRef.current?.(editor),
          onSaveAll: () => void saveAll(),
          onGotoLine: () => setGotoState({ value: '' }),
          onCloseTab: () => {
            /* ⌘W closes whichever editor tab is showing: the Commit diff while
               that tab is active, otherwise the open file. */
            if (diffActiveRef.current) closeDiff();
            else if (activePathRef.current !== null) closeFile(activePathRef.current);
          },
        });
        const editor = group.editor;
        editorRef.current = editor;
        const focusSubscription = editor.onDidFocusEditorText?.(() => {
          focusedEditorRef.current = { path: activePathRef.current, editor };
          focusedPathRef.current = activePathRef.current;
          setFocusedPath(activePathRef.current);
          syncEditorStatus(editor);
        });
        return () => {
          focusSubscription?.dispose?.();
          group.dispose();
          editorRef.current = null;
          for (const model of modelsRef.current.values()) model.dispose();
          modelsRef.current.clear();
        };
      }, [closeDiff, monacoReady, saveActive, syncEditorStatus, t]);

      /* Hidden Monaco panes cannot measure themselves. Re-layout after IDEA's
         Editor / Editor and Preview / Preview switch changes the visible box. */
      React.useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
          editorRef.current?.layout?.();
          splitEditorRef.current?.layout?.();
        });
        return () => window.cancelAnimationFrame(frame);
      }, [effectiveMarkdownMode, activePath, fileSurfaceVisible]);

      /* IDEA keeps the Markdown editor and preview on the same reading position.
         Suppress only the echo produced by the opposite pane's programmatic
         assignment; a real scroll in either pane becomes the next driver. */
      React.useEffect(() => {
        const editor = editorRef.current;
        const preview = markdownPreviewRef.current;
        if (effectiveMarkdownMode !== 'split' || editor === null || preview === null) return undefined;
        let disposed = false;
        const editorBox = () => ({
          scrollTop: editor.getScrollTop?.() ?? 0,
          scrollHeight: editor.getScrollHeight?.() ?? 0,
          clientHeight: editor.getLayoutInfo?.()?.height ?? 0,
        });
        const isEcho = (source) => {
          const lock = markdownScrollSyncRef.current;
          if (lock.source !== source || lock.until <= performance.now()) return false;
          lock.source = null;
          lock.until = 0;
          return true;
        };
        const claim = (source) => {
          markdownScrollSyncRef.current = { source, until: performance.now() + 120 };
        };
        const onEditorScroll = () => {
          if (disposed || isEcho('editor')) return;
          claim('preview');
          preview.scrollTop = markdownScrollTopForRatio(markdownScrollRatio(editorBox()), preview);
        };
        const onPreviewScroll = () => {
          if (disposed || isEcho('preview')) return;
          claim('editor');
          const next = markdownScrollTopForRatio(markdownScrollRatio(preview), editorBox());
          if (Math.abs((editor.getScrollTop?.() ?? 0) - next) >= 1) editor.setScrollTop?.(next);
        };
        const subscription = editor.onDidScrollChange?.(onEditorScroll);
        preview.addEventListener('scroll', onPreviewScroll, { passive: true });
        return () => {
          disposed = true;
          subscription?.dispose?.();
          preview.removeEventListener('scroll', onPreviewScroll);
        };
      }, [activePath, effectiveMarkdownMode, fileSurfaceVisible, monacoReady]);

      /* Bind the active file's model to the editor. */
      React.useEffect(() => {
        const monaco = window.monaco;
        const editor = editorRef.current;
        if (!monacoReady || monaco?.editor === undefined || editor === null) return;
        if (activePath === null) {
          editor.setModel(null);
          return;
        }
        const file = openFilesRef.current.find((entry) => entry.path === activePath);
        if (file === undefined) return;
        const model = ensureEditorModel(monaco, modelsRef.current, activePath, file.content);
        if (editor.getModel() !== model) editor.setModel(model);
        /* An inline create/rename in the tree keeps focus, and so does a plain tree
           click: IDEA opens the file but leaves the caret on the row you clicked, so
           the next arrow key walks the tree instead of the code. Focus is only
           pulled into the editor when it was already heading there (the editor, a
           terminal link, or the tab strip). */
        const activeNode = document.activeElement;
        const inlineEditing = activeNode?.closest('[data-dsh-editor-workspace] input') !== null
          && activeNode?.closest('.dsh-editor-tree-row, [data-dsh-editor-workspace] > div') !== null;
        const inTree = activeNode?.closest('[role="tree"]') != null;
        /* Clicking a file tab answers "show me this file"; the Commit panel's
           checkbox or tree must keep the caret where the user is working. */
        const inTabs = activeNode?.closest('[data-dsh-editor-tabstrip]') != null;
        if (!inlineEditing && !inTree && !inTabs) editor.focus();
        /* Reflect the file's own indentation and line endings in the status bar. */
        const options = model.getOptions?.() ?? {};
        setFileMode({
          tabSize: typeof options.tabSize === 'number' ? options.tabSize : 2,
          insertSpaces: options.insertSpaces !== false,
          eol: model.getEOL?.() === '\r\n' ? 'CRLF' : 'LF',
          encoding: 'UTF-8',
        });
        /* A terminal link may have asked for a specific line in this file. */
        const reveal = pendingReveal.current;
        if (reveal !== null && reveal.path === activePath) {
          pendingReveal.current = null;
          revealLines(activePath, reveal.line, reveal.column);
        }
        const subscription = editor.onDidChangeModelContent(() => {
          /* A reload from disk replaces the model; marking it dirty would fake unsaved work. */
          if (silentReloadRef.current.has(activePath)) return;
          if (previewPathRef.current === activePath) {
            previewPathRef.current = null;
            setPreviewPath(null);
          }
          const value = editor.getValue();
          setOpenFiles((current) =>
            current.map((entry) => (entry.path === activePath ? { ...entry, content: value, dirty: true } : entry)),
          );
        });
        const caretSubscription = editor.onDidChangeCursorPosition((event) => {
          setCaret({ line: event.position.lineNumber, column: event.position.column });
          setLineStats((current) => ({ ...current, selected: editor.getModel()?.getValueInRange(editor.getSelection() ?? new monaco.Range(1, 1, 1, 1))?.length ?? 0, lines: editor.getModel()?.getLineCount() ?? 0 }));
        });
        const position = editor.getPosition();
        if (position !== null) setCaret({ line: position.lineNumber, column: position.column });
        setLineStats({ lines: model.getLineCount(), selected: 0 });
        return () => {
          subscription.dispose();
          caretSubscription.dispose();
        };
      }, [activePath, diffActive, monacoReady, openFiles.length]);

      /**
       * Close a set of tabs from the right editor group.
       *
       * Range commands in one editor group never close the shared workspace
       * documents. Dirty files get one confirmation for the whole batch, then
       * only the right group's history is updated.
       * @param {string[]} paths - right-group tab identities.
       * @returns {boolean} whether the batch was closed.
       */
      const closeSplitTabs = React.useCallback((paths) => {
        const wanted = new Set(paths);
        const doomed = splitTabsRef.current.filter((path) => wanted.has(path));
        if (doomed.length === 0) return true;
        const dirty = doomed.filter((path) => openFilesRef.current.find((file) => file.path === path)?.dirty === true).length;
        if (dirty > 0 && !window.confirm(t('editor.unsavedTabsConfirm', { count: dirty }))) return false;
        const current = splitTabsRef.current;
        const remaining = splitTabsRef.current.filter((path) => wanted.has(path) === false);
        splitTabsRef.current = remaining;
        setSplitTabs(remaining);
        if (splitPathRef.current !== null && wanted.has(splitPathRef.current)) {
          const index = current.indexOf(splitPathRef.current);
          const fallback = remaining[Math.min(Math.max(index, 0), remaining.length - 1)] ?? null;
          splitPathRef.current = fallback;
          setSplitPath(fallback);
          if (fallback === null) {
            splitEditorRef.current?.setModel?.(null);
            const editor = editorRef.current;
            editor?.focus();
            syncEditorStatus(editor);
            focusedEditorRef.current = { path: activePathRef.current, editor };
            focusedPathRef.current = activePathRef.current;
            setFocusedPath(activePathRef.current);
          }
        }
        return true;
      }, [syncEditorStatus, t]);

      /**
       * Close one tab from the right editor group without closing the shared file.
       *
       * The right group is a view over the same workspace models. Removing its
       * tab must therefore leave the file available in the left group; only the
       * per-group tab history changes. When the active tab disappears IDEA moves
       * to the tab that occupied its slot, then falls back to the new last tab.
       * @param {string} path - workspace-relative tab identity.
       * @param {{skipConfirm?: boolean}} [options] - batch callers confirm once.
       * @returns {boolean} whether the tab was closed.
       */
      const closeSplitTab = React.useCallback((path, options = {}) => {
        if (typeof path !== 'string' || path === '') return true;
        const current = splitTabsRef.current;
        if (!current.includes(path)) return true;
        const file = openFilesRef.current.find((entry) => entry.path === path);
        if (options.skipConfirm !== true && file?.dirty === true && !window.confirm(t('editor.unsavedTabsConfirm', { count: 1 }))) return false;
        const index = current.indexOf(path);
        const next = current.filter((entry) => entry !== path);
        splitTabsRef.current = next;
        setSplitTabs(next);
        const fallback = next[Math.min(index, next.length - 1)] ?? null;
        if (splitPathRef.current === path) {
          splitPathRef.current = fallback;
          setSplitPath(fallback);
          if (fallback === null) {
            splitEditorRef.current?.setModel?.(null);
            const editor = editorRef.current;
            editor?.focus();
            syncEditorStatus(editor);
            focusedEditorRef.current = { path: activePathRef.current, editor };
            focusedPathRef.current = activePathRef.current;
            setFocusedPath(activePathRef.current);
          }
        }
        return true;
      }, [syncEditorStatus, t]);

      /** Move within the right group's own tab history, wrapping at both ends. */
      const cycleSplitTab = React.useCallback((step) => {
        const tabs = splitTabsRef.current;
        if (tabs.length < 2) return false;
        const index = Math.max(0, tabs.indexOf(splitPathRef.current ?? tabs[0]));
        const next = tabs[(index + step + tabs.length) % tabs.length];
        if (next === undefined || next === splitPathRef.current) return false;
        splitPathRef.current = next;
        setSplitPath(next);
        window.setTimeout(() => splitEditorRef.current?.focus?.(), 0);
        return true;
      }, []);

      /** Alt+Left/Right is owned by the right group only while it contains the caret. */
      const splitTabShortcut = React.useCallback((event) => {
        if (!event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        const target = event.target instanceof Node ? event.target : null;
        if (target === null || splitContainerRef.current?.contains(target) !== true) return;
        if (!cycleSplitTab(event.key === 'ArrowRight' ? 1 : -1)) return;
        event.preventDefault();
        event.stopPropagation();
      }, [cycleSplitTab]);

      React.useEffect(() => {
        window.addEventListener('keydown', splitTabShortcut, true);
        return () => window.removeEventListener('keydown', splitTabShortcut, true);
      }, [splitTabShortcut]);

      /** Close the entire right editor group and return the caret to the left. */
      const closeRightSplit = React.useCallback(() => {
        splitTabsRef.current = [];
        setSplitTabs([]);
        splitPathRef.current = null;
        setSplitPath(null);
        splitEditorRef.current?.setModel?.(null);
        const editor = editorRef.current;
        editor?.focus();
        syncEditorStatus(editor);
        focusedEditorRef.current = { path: activePathRef.current, editor };
        focusedPathRef.current = activePathRef.current;
        setFocusedPath(activePathRef.current);
      }, [syncEditorStatus]);

      /**
       * Close one tab and dispose its model.
       *
       * IDEA asks before dropping unsaved edits, and the caller can bypass the
       * prompt when it already confirmed for a whole batch (Close All).
       * @param {string} path - tab identity.
       * @param {boolean} skipConfirm - close even when the model is dirty.
       */
      const closeFile = React.useCallback((path, skipConfirm = false) => {
        if (!skipConfirm) {
          const file = openFilesRef.current.find((entry) => entry.path === path);
          if (file?.dirty === true && !window.confirm(t('editor.unsavedTabsConfirm', { count: 1 }))) return;
        }
        closeSplitTab(path, { skipConfirm: true });
        const model = modelsRef.current.get(path);
        if (model !== undefined) {
          model.dispose();
          modelsRef.current.delete(path);
        }
        if (previewPathRef.current === path) {
          previewPathRef.current = null;
          setPreviewPath(null);
        }
        const before = openFilesRef.current;
        const index = before.findIndex((file) => file.path === path);
        const remaining = before.filter((file) => file.path !== path);
        setOpenFiles(remaining);
        if (activePathRef.current === path) {
          /* IDEA activates the tab that moved into the closed tab's slot;
             at the right edge it falls back to the new last tab. */
          const next = remaining.length > 0 ? remaining[Math.min(index, remaining.length - 1)].path : null;
          setActivePath(next);
        }
      }, [closeSplitTab, t]);

      /* The right split is a second view over the same workspace model. */
      React.useEffect(() => {
        if (!monacoReady || splitTabs.length === 0 || splitContainerRef.current === null) return undefined;
        const monaco = window.monaco;
        if (monaco?.editor === undefined) return undefined;
        const group = createCodeEditorGroup(monaco, splitContainerRef.current, {
          onSave: () => void savePath(splitPathRef.current),
          onFind: () => {
            if (document.activeElement?.closest('.monaco-editor') == null) return;
            setReplaceState((current) => current ?? { find: '', replace: '', index: 0, total: 0, withReplace: false, preserveCase: false, scope: null });
          },
          textSearchLabel: t('editor.textSearchAction'),
          onSearchText: () => {
            openSearchEverywhereRef.current?.('text');
            window.setTimeout(() => document.querySelector('[data-dsh-search-query]')?.focus?.(), 0);
          },
          findUsagesLabel: t('editor.findUsagesAction'),
          selectAllOccurrencesLabel: t('editor.selectAllOccurrencesAction'),
          selectNextOccurrenceLabel: t('editor.selectNextOccurrenceAction'),
          unselectPreviousOccurrenceLabel: t('editor.unselectPreviousOccurrenceAction'),
          searchWebLabel: t('editor.searchWebAction'),
          findInFilesLabel: t('editor.findInFilesAction'),
          replaceInFilesLabel: t('editor.replaceInFilesAction'),
          findUsagesInFileLabel: t('editor.findUsagesInFileAction'),
          highlightUsagesInFileLabel: t('editor.highlightUsagesInFileAction'),
          findWordAtCaretLabel: t('editor.nextWordOccurrenceAction'),
          previousWordOccurrenceLabel: t('editor.previousWordOccurrenceAction'),
          replaceLabel: t('editor.replaceAction'),
          incrementalSearchLabel: t('editor.incrementalSearchAction'),
          onReplace: (editor) => editorFindContextRunnerRef.current?.(editor, true, 'replace'),
          onIncrementalSearch: (editor) => editorFindContextRunnerRef.current?.(editor, false, 'query'),
          findInSelectionLabel: t('editor.searchInSelectionOnly'),
          replaceInSelectionLabel: t('editor.replaceInSelectionOnly'),
          onFindInSelection: (editor) => selectionFindContextRunnerRef.current?.(editor, false, 'query'),
          onReplaceInSelection: (editor) => selectionFindContextRunnerRef.current?.(editor, true, 'replace'),
          onFindUsagesInFile: (editor) => editorFindContextRunnerRef.current?.(editor),
          onFindInFiles: (editor) => findToolContextRunnerRef.current?.(editor, 'find'),
          onReplaceInFiles: (editor) => findToolContextRunnerRef.current?.(editor, 'replace'),
          onFindUsages: (editor) => findUsagesRunnerRef.current?.(editor),
          onSaveAll: () => void saveAll(),
          onGotoLine: () => setGotoState({ value: '' }),
          onCloseTab: () => closeSplitTab(splitPathRef.current),
        });
        const editor = group.editor;
        splitEditorRef.current = editor;
        const contentSubscription = editor.onDidChangeModelContent(() => {
          const path = splitPathRef.current;
          if (path === null || silentReloadRef.current.has(path)) return;
          const value = editor.getValue();
          setOpenFiles((current) =>
            current.map((entry) => (entry.path === path ? { ...entry, content: value, dirty: true } : entry)),
          );
        });
        const cursorSubscription = editor.onDidChangeCursorPosition((event) => {
          setCaret({ line: event.position.lineNumber, column: event.position.column });
        });
        const focusSubscription = editor.onDidFocusEditorText?.(() => {
          const path = splitPathRef.current;
          focusedEditorRef.current = { path, editor };
          focusedPathRef.current = path;
          setFocusedPath(path);
          syncEditorStatus(editor);
        });
        return () => {
          contentSubscription.dispose();
          cursorSubscription.dispose();
          focusSubscription?.dispose?.();
          splitEditorRef.current = null;
          group.dispose();
        };
      }, [closeSplitTab, monacoReady, saveAll, savePath, splitTabs.length === 0, syncEditorStatus, t]);

      const bindActiveModel = React.useCallback(() => {
        const monaco = window.monaco;
        const editor = splitEditorRef.current;
        const path = splitPathRef.current;
        if (!monacoReady || monaco?.editor === undefined || editor === null || path === null) return;
        const file = openFilesRef.current.find((entry) => entry.path === path);
        if (file === undefined) return;
        const model = ensureEditorModel(monaco, modelsRef.current, path, file.content);
        if (editor.getModel() !== model) editor.setModel(model);
        syncEditorStatus(editor);
      }, [monacoReady, syncEditorStatus]);

      React.useEffect(() => {
        bindActiveModel();
        const path = splitPathRef.current;
        if (path !== null) {
          window.setTimeout(() => {
            if (splitPathRef.current === path) splitEditorRef.current?.focus?.();
          }, 0);
        }
      }, [bindActiveModel, openFiles.length, splitPath]);

      React.useEffect(() => {
        if (splitPath !== null && !openFiles.some((file) => file.path === splitPath)) setSplitPath(null);
      }, [openFiles, splitPath]);

      React.useEffect(() => {
        if (splitTabs.length === 0) {
          if (splitPathRef.current === null) return;
          splitPathRef.current = null;
          setSplitPath(null);
          return;
        }
        const validTabs = splitTabs.filter((path) => openFiles.some((file) => file.path === path));
        if (validTabs.length === splitTabs.length) {
          if (splitPath === null && validTabs.length > 0) {
            splitPathRef.current = validTabs[0];
            setSplitPath(validTabs[0]);
          }
          return;
        }
        splitTabsRef.current = validTabs;
        setSplitTabs((current) => current.filter((path) => openFiles.some((file) => file.path === path)));
        if (splitPathRef.current !== null && !validTabs.includes(splitPathRef.current)) {
          const fallback = validTabs[0] ?? null;
          splitPathRef.current = fallback;
          setSplitPath(fallback);
          if (fallback === null) {
            splitEditorRef.current?.setModel?.(null);
            focusedEditorRef.current = { path: activePathRef.current, editor: editorRef.current };
            focusedPathRef.current = activePathRef.current;
            setFocusedPath(activePathRef.current);
          }
        }
      }, [openFiles, splitPath, splitTabs]);

      /**
       * Close a batch of file paths after warning once.
       *
       * All close-menu operations go through this helper, so a dirty tab can
       * never be discarded silently just because it arrived through a range
       * command instead of the close button.
       * @param {string[]} paths - file paths to close.
       * @returns {void}
       */
      const closePaths = React.useCallback((paths) => {
        const wanted = new Set(paths);
        const before = openFilesRef.current;
        const doomed = before.filter((file) => wanted.has(file.path));
        if (doomed.length === 0) return true;
        const dirty = doomed.filter((file) => file.dirty).length;
        if (dirty > 0 && !window.confirm(t('editor.unsavedTabsConfirm', { count: dirty }))) return false;
        {
          const previousSplitTabs = splitTabsRef.current;
          const remaining = splitTabsRef.current.filter((path) => wanted.has(path) === false);
          if (remaining.length !== previousSplitTabs.length) {
            splitTabsRef.current = remaining;
            setSplitTabs(remaining);
          }
          if (splitPathRef.current !== null && wanted.has(splitPathRef.current)) {
            const index = previousSplitTabs.indexOf(splitPathRef.current);
            const fallback = remaining[Math.min(Math.max(index, 0), remaining.length - 1)] ?? null;
            splitPathRef.current = fallback;
            setSplitPath(fallback);
            if (fallback === null) {
              splitEditorRef.current?.setModel?.(null);
              focusedEditorRef.current = { path: activePathRef.current, editor: editorRef.current };
              focusedPathRef.current = activePathRef.current;
              setFocusedPath(activePathRef.current);
            }
          }
        }
        for (const file of doomed) {
          const model = modelsRef.current.get(file.path);
          model?.dispose?.();
          modelsRef.current.delete(file.path);
        }
        if (previewPathRef.current !== null && wanted.has(previewPathRef.current)) {
          previewPathRef.current = null;
          setPreviewPath(null);
        }
        const remaining = before.filter((file) => wanted.has(file.path) === false);
        setOpenFiles(remaining);
        const active = activePathRef.current;
        if (active !== null && wanted.has(active)) {
          const index = before.findIndex((file) => file.path === active);
          const next = remaining.length > 0 ? remaining[Math.min(Math.max(index, 0), remaining.length - 1)].path : null;
          setActivePath(next);
        }
        return true;
      }, [t]);

      /** IDEA's "Close Other Tabs": keep one tab, drop the rest after one prompt. */
      const closeOtherTabs = React.useCallback(
        (keepPath) => {
          closePaths(openFilesRef.current.filter((file) => file.path !== keepPath).map((file) => file.path));
        },
        [closePaths],
      );

      /** IDEA's "Close All Tabs". */
      const closeAllTabs = React.useCallback(() => {
        if (!closePaths(openFilesRef.current.map((file) => file.path))) return;
        /* Close All is the one command that closes the pinned comparison too. */
        closeDiff();
      }, [closeDiff, closePaths]);

      /**
       * Close a set of editor tabs identified by tab-strip keys.
       *
       * The diff tab and file tabs share one strip order, so "close to the
       * left/right" must be evaluated over both kinds. All dirty file tabs are
       * covered by one confirmation, and state is replaced once rather than
       * once per tab (which would leave all but the last tab open).
       * @param {string[]} keys - file paths or DIFF_TAB_KEY entries.
       * @returns {void}
       */
      const closeEditorTabs = React.useCallback((keys) => {
        const wanted = new Set(keys);
        const includesDiff = wanted.has(DIFF_TAB_KEY);
        const fileKeys = [...wanted].filter((key) => key !== DIFF_TAB_KEY);
        if (!closePaths(fileKeys)) return;
        /* Only a range that actually covers the pinned diff may dismiss it.
           Closing tabs to the RIGHT of a file must leave a diff pinned at the
           left intact (it was the observed bug: diff vanished but the file to
           the right stayed open). */
        if (includesDiff) {
          setDiffTarget(null);
        }
        const remainingFiles = openFilesRef.current.filter((file) => !fileKeys.includes(file.path));
        if (includesDiff && remainingFiles.length === 0) {
          setDiffActive(false);
          /* No file remains to hand the caret to: return to the Changes row
             that opened the comparison. */
          window.setTimeout(() => {
            const row = diffReturnFocusRef.current;
            if (row !== null && row.isConnected) row.focus();
          }, 0);
        }
      }, [closePaths]);

      /* Cmd/Ctrl+Shift+O opens "Go to File", IDEA's most-used navigation shortcut. */
      React.useEffect(() => {
        const onKeyDown = (event) => {
          if (!(event.metaKey || event.ctrlKey) || !event.shiftKey || event.key.toLowerCase() !== 'o') return;
          const host = document.querySelector('[data-dsh-editor-workspace]');
          if (host === null || !document.body.contains(host)) return;
          event.preventDefault();
          void openQuickOpen();
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
      }, []);

      /* Load the palette's candidate list lazily, once per open. */
      const openQuickOpen = React.useCallback(async () => {
        setPaletteMode('files');
        setQuickOpen({ query: '', index: 0 });
        try {
          const value = await callFs({ op: 'files' });
          setQuickOpen((current) => (current === null ? current : { ...current, files: value.files ?? [], loading: false }));
        } catch {
          setQuickOpen((current) => (current === null ? current : { ...current, files: [], loading: false }));
        }
      }, []);

      /**
       * Load the file candidate list for one explicit non-project scope.
       * @param {boolean} includeNonProject - whether excluded directories are included.
       * @returns {void}
       */
      const requestSearchEverywhereFiles = React.useCallback((includeNonProject) => {
        const requestId = ++searchEverywhereFilesRequestRef.current;
        void callFs({ op: 'files', includeExcluded: includeNonProject === true })
          .then((value) => {
            if (searchEverywhereFilesRequestRef.current !== requestId) return;
            const files = Array.isArray(value?.files) ? value.files : [];
            searchEverywhereFilesRef.current = files;
            searchEverywhereFilesScopeRef.current = includeNonProject === true;
            setSearchEverywhere((current) => (current === null || current.includeNonProject !== (includeNonProject === true)
              ? current
              : { ...current, files }));
          })
          .catch((failure) => {
            if (searchEverywhereFilesRequestRef.current !== requestId) return;
            setSearchEverywhere((current) => (current === null || current.includeNonProject !== (includeNonProject === true)
              ? current
              : {
                  ...current,
                  error: failure instanceof Error ? failure.message : String(failure),
                }));
          });
      }, []);

      /**
       * Open IDEA's Search Everywhere in one requested tab.
       * @param {'all'|'files'|'text'|'actions'} [tab='all'] - initial tab.
       * @param {string} [query=''] - initial query.
       * @param {boolean} [withReplace=false] - show the Replace in Files row.
       * @returns {void}
       */
      const openSearchEverywhere = React.useCallback((tab = 'all', query = '', withReplace = false) => {
        const savedOptions = readSearchOptions();
        const includeNonProject = savedOptions.includeExcluded === true;
        const cachedFilesMatchScope = searchEverywhereFilesScopeRef.current === includeNonProject;
        const initial = {
          tab,
          query,
          index: 0,
          withReplace,
          replace: '',
          files: cachedFilesMatchScope ? searchEverywhereFilesRef.current : [],
          textMatches: [],
          textLoading: false,
          textTruncated: false,
          textRevision: 0,
          replaceBusy: false,
          replaceFocusRequest: 0,
          error: null,
          includeNonProject,
          ...savedOptions,
        };
        setSearchEverywhere(initial);
        if (cachedFilesMatchScope && initial.files.length > 0) return;
        requestSearchEverywhereFiles(includeNonProject);
      }, [requestSearchEverywhereFiles]);
      React.useEffect(() => {
        openSearchEverywhereRef.current = openSearchEverywhere;
        return () => {
          if (openSearchEverywhereRef.current === openSearchEverywhere) {
            openSearchEverywhereRef.current = () => {};
          }
        };
      }, [openSearchEverywhere]);

      const toggleIncludeNonProject = React.useCallback(() => {
        if (searchEverywhere === null) return;
        const includeNonProject = searchEverywhere.includeNonProject !== true;
        setSearchEverywhere((current) => (current === null
          ? current
          : { ...current, includeNonProject, index: 0, error: null }));
        requestSearchEverywhereFiles(includeNonProject);
      }, [requestSearchEverywhereFiles, searchEverywhere]);

      const searchEverywhereRawQuery = searchEverywhere?.query.trim() ?? '';
      const searchEverywhereTextQuery = searchEverywhereRawQuery;
      const searchEverywhereOpen = searchEverywhere !== null;
      const searchEverywhereTextActive = searchEverywhere !== null
        && (searchEverywhere.tab === 'all' || searchEverywhere.tab === 'text');
      React.useEffect(() => {
        if (!searchEverywhereTextActive) return undefined;
        const requestId = ++searchTextRequestRef.current;
        if (searchEverywhereTextQuery.length < 2) {
          setSearchEverywhere((current) => (current === null
            ? current
            : { ...current, textMatches: [], textLoading: false, textTruncated: false }));
          return undefined;
        }
        setSearchEverywhere((current) => (current === null ? current : { ...current, textLoading: true, error: null }));
        const timer = window.setTimeout(() => {
          void callFs({
            op: 'searchText',
            query: searchEverywhereTextQuery,
            maxMatches: 200,
            includeExcluded: searchEverywhere?.includeNonProject === true,
            caseSensitive: searchEverywhere?.caseSensitive === true ? true : undefined,
            wholeWords: searchEverywhere?.wholeWords === true,
            regex: searchEverywhere?.regex === true,
            fileMask: normalizeFileExtensionFilter(searchEverywhere?.fileMask),
          })
            .then((value) => {
              if (searchTextRequestRef.current !== requestId) return;
              setSearchEverywhere((current) => (current === null
                ? current
                : {
                    ...current,
                    textMatches: Array.isArray(value?.matches) ? value.matches : [],
                    textTruncated: value?.truncated === true,
                    textLoading: false,
                    error: null,
                  }));
            })
            .catch((failure) => {
              if (searchTextRequestRef.current !== requestId) return;
              setSearchEverywhere((current) => (current === null
                ? current
                : {
                    ...current,
                    textMatches: [],
                    textLoading: false,
                    textTruncated: false,
                    error: searchTextFailureMessage(failure, t),
                  }));
            });
        }, 180);
        return () => window.clearTimeout(timer);
      }, [
        searchEverywhereTextActive,
        searchEverywhereTextQuery,
        root,
        searchEverywhere?.textRevision,
        searchEverywhere?.includeNonProject,
        searchEverywhere?.caseSensitive,
        searchEverywhere?.wholeWords,
        searchEverywhere?.regex,
        searchEverywhere?.preserveCase,
        searchEverywhere?.fileMask,
        t,
      ]);

      /**
       * Move a Search Everywhere result set into IDEA's persistent Find tool.
       *
       * The tool window has its own query lifecycle so subsequent edits no
       * longer depend on the transient dialog being mounted.
       * @param {string} [query=''] - initial search text.
       * @param {'find'|'replace'} [mode='find'] - whether to show replacement.
       * @param {{files?: object[], matches?: object[], truncated?: boolean}|null} [initial=null] - existing results.
       * @param {'query'|'replace'} [focusTarget='query'] - input to focus after mounting.
       * @param {'popup'|'dock'} [surface='popup'] - transient popup or persistent tool window.
       * @returns {void}
       */
      const openFindTool = React.useCallback((query = '', mode = 'find', initial = null, focusTarget = 'query', surface = 'popup') => {
        const textQuery = findToolContentQuery(query);
        const savedOptions = normalizeSearchOptions(initial === null ? readSearchOptions() : initial);
        const savedScope = readFindScope(rootRef.current);
        const initialFiles = Array.isArray(initial?.files) ? initial.files : [];
        const initialMatches = Array.isArray(initial?.matches) ? initial.matches : [];
        const initialCount = (Array.isArray(initial?.files) ? initial.files.length : 0) + (Array.isArray(initial?.matches) ? initial.matches.length : 0);
        setTerminalOpen(false);
        setSearchEverywhere(null);
        setFindTool({
          surface: surface === 'dock' ? 'dock' : 'popup',
          query: textQuery,
          mode: mode === 'replace' ? 'replace' : 'find',
          replace: '',
          files: initialFiles,
          matches: initialMatches,
          truncated: initial?.truncated === true,
          loading: false,
          error: null,
          index: Math.max(0, Math.min(initialCount - 1, Number(initial?.index) || 0)),
          handoffRevision: ++findToolHandoffSequenceRef.current,
          replaceBusy: false,
          ...savedOptions,
          includeExcluded: initial !== null
            ? initial.includeExcluded === true
            : savedOptions.includeExcluded === true,
          searchScopeMode: savedScope.mode,
          searchScopePreset: savedScope.preset,
          searchScopeDirectory: savedScope.directory,
          searchGeneration: 0,
          loadedGeneration: initial === null || initial?.refresh === true ? -1 : 0,
        });
        /* Monaco restores editor focus after a context-menu action returns.
           Defer past that restoration so the requested Find field wins. */
        window.setTimeout(() => {
          const target = focusTarget === 'replace'
            ? '[data-dsh-find-replace-input]'
            : '[data-dsh-find-tool-window] input[role="combobox"]';
          document.querySelector(target)?.focus?.();
        }, 40);
      }, []);

      /**
       * 将当前 transient Find 结果集转入 IDEA 的底部持久 Find 工具窗。
       * query、options、scope 与活动结果保持不变，只切换承载 surface。
       * @returns {void}
       */
      const openFindToolInDock = React.useCallback(() => {
        setTerminalOpen(false);
        setFindTool((current) => (current === null ? current : { ...current, surface: 'dock' }));
        window.setTimeout(() => {
          document.querySelector('[data-dsh-find-tool-window] input[role="combobox"]')?.focus?.();
        }, 0);
      }, []);

      /**
       * IDEA's persistent Find toolbar Settings action.
       *
       * It reopens the same query and options in the configuration popup while
       * preserving the current find/replace mode and result selection.
       * @returns {void}
       */
      const openFindToolSettings = React.useCallback(() => {
        setFindTool((current) => (current === null
          ? current
          : {
              ...current,
              surface: 'popup',
              mode: current.mode,
            }));
        window.setTimeout(() => {
          document.querySelector('[data-dsh-find-tool-window] input[role="combobox"]')?.focus?.();
        }, 0);
      }, []);

      /**
       * Restart the bounded host search when the Find scope changes.
       *
       * Scope is applied before the host's 200-match ceiling, so matches from
       * outside a directory or file preset cannot starve the selected range.
       * @param {{mode?: string, preset?: string, directory?: string}} scope - selected scope.
       * @returns {void}
       */
      const changeFindToolScope = React.useCallback((scope) => {
        const normalized = writeFindScope(rootRef.current, scope);
        const { mode, preset, directory } = normalized;
        setFindTool((current) => {
          if (current === null) return current;
          if (
            current.searchScopeMode === mode
            && current.searchScopePreset === preset
            && current.searchScopeDirectory === directory
          ) return current;
          return {
            ...current,
            searchScopeMode: mode,
            searchScopePreset: preset,
            searchScopeDirectory: directory,
            files: [],
            matches: [],
            index: 0,
            error: null,
            searchGeneration: (current.searchGeneration ?? 0) + 1,
            loadedGeneration: -1,
          };
        });
      }, []);

      /**
       * Open IDEA's blank Replace in Files dialog without losing the live scope.
       *
       * ⇧⌘R intentionally clears the previous content query, but Directory and
       * Open/Changed Files scope remain user configuration and must continue to
       * constrain the next host search.
       * @returns {void}
       */
      const openBlankReplaceInFilesFromEditor = React.useCallback(() => {
        if (findTool === null) {
          openFindTool('', 'replace');
          return;
        }
        setTerminalOpen(false);
        setFindTool((current) => (current === null
          ? current
          : {
              ...current,
              query: '',
              mode: 'replace',
              replace: '',
              files: [],
              matches: [],
              truncated: false,
              loading: false,
              error: null,
              index: 0,
              surface: 'popup',
              replaceBusy: false,
              searchGeneration: (current.searchGeneration ?? 0) + 1,
              loadedGeneration: -1,
            }));
        window.setTimeout(() => {
          document.querySelector('[data-dsh-find-tool-window] input[role="combobox"]')?.focus?.();
        }, 0);
      }, [findTool, openFindTool]);

      /** Single shortcut body shared by double Shift and Cmd/Ctrl+Shift+F. */
      const openFindInFilesFromShortcut = React.useCallback(() => {
        if (findTool !== null) {
          setFindTool((current) => (current === null
            ? current
            : {
                ...current,
                mode: 'find',
                surface: current.surface === 'dock' ? 'popup' : current.surface ?? 'popup',
              }));
          window.setTimeout(() => {
            document.querySelector('[data-dsh-find-tool-window] input[role="combobox"]')?.focus?.();
          }, 0);
          return;
        }
        openFindTool('', 'find');
      }, [findTool, openFindTool]);

      /**
       * Hide the persistent Find tool and return the caret to the editor.
       *
       * Closing from Escape, Hide, or the toolbar overflow unmounts the focused
       * control. Deferring the editor focus lets React finish the unmount first;
       * otherwise the browser falls back to <body> and global editor shortcuts die.
       * @returns {void}
       */
      const closeFindToolWindow = React.useCallback(() => {
        setFindTool(null);
        window.setTimeout(() => currentCodeEditor()?.focus?.(), 0);
      }, [currentCodeEditor]);

      /**
       * Open IDEA's transient Show Usages popup for one symbol or selection.
       * The popup owns filtering and navigation for this loaded result set;
       * pinning transfers the same rows to the persistent Find tool.
       * @param {string} [query=''] - symbol text to search.
       * @returns {void}
       */
      const openShowUsages = React.useCallback((query = '') => {
        const textQuery = typeof query === 'string' ? query.trim() : '';
        if (textQuery === '') return;
        const requestId = ++showUsagesRequestRef.current;
        setSearchEverywhere(null);
        setShowUsages({
          query: textQuery,
          filter: '',
          matches: [],
          truncated: false,
          loading: true,
          error: null,
          index: 0,
        });
        void callFs({ op: 'searchText', query: textQuery, maxMatches: 200 })
          .then((value) => {
            if (showUsagesRequestRef.current !== requestId) return;
            setShowUsages((current) => (current === null
              ? current
              : {
                  ...current,
                  matches: Array.isArray(value?.matches) ? value.matches : [],
                  truncated: value?.truncated === true,
                  loading: false,
                  error: null,
                }));
          })
          .catch((failure) => {
            if (showUsagesRequestRef.current !== requestId) return;
            setShowUsages((current) => (current === null
              ? current
              : {
                  ...current,
                  matches: [],
                  truncated: false,
                  loading: false,
                  error: searchTextFailureMessage(failure, t),
                }));
          });
      }, [t]);

      const pinShowUsages = React.useCallback(() => {
        const current = showUsages;
        if (current === null) return;
        setShowUsages(null);
        openFindTool(current.query, 'find', {
          files: [],
          matches: current.matches,
          truncated: current.truncated === true,
          index: 0,
        }, 'query', 'dock');
      }, [openFindTool, showUsages]);

      const openFindUsages = React.useCallback((query = '') => {
        const textQuery = typeof query === 'string' ? query.trim() : '';
        if (textQuery === '') return;
        const workspace = rootRef.current;
        if (workspace !== '') {
          setRecentFindUsages((current) => {
            const stored = rememberWorkspaceFindUsagesQuery(workspace, textQuery);
            return stored ?? current;
          });
        }
        openFindTool(textQuery, 'find');
      }, [openFindTool]);

      React.useEffect(() => {
        findUsagesRunnerRef.current = (editor) => {
          const target = findUsagesSearchTarget(editor);
          if (target.query !== '') openFindUsages(target.query);
        };
        return () => {
          findUsagesRunnerRef.current = null;
        };
      }, [openFindUsages]);

      React.useEffect(() => {
        findToolContextRunnerRef.current = (editor, mode) => {
          const target = findUsagesSearchTarget(editor);
          if (target.query === '') return;
          const replace = mode === 'replace';
          openFindTool(target.query, replace ? 'replace' : 'find', null, replace ? 'replace' : 'query');
        };
        return () => {
          findToolContextRunnerRef.current = null;
        };
      }, [openFindTool]);

      React.useEffect(() => {
        if (searchEverywhere !== null) writeSearchOptions(searchEverywhere);
      }, [
        searchEverywhere?.caseSensitive,
        searchEverywhere?.wholeWords,
        searchEverywhere?.regex,
        searchEverywhere?.includeNonProject,
        searchEverywhere?.fileMask,
      ]);

      React.useEffect(() => {
        if (findTool !== null) writeSearchOptions(findTool);
      }, [
        findTool?.caseSensitive,
        findTool?.wholeWords,
        findTool?.regex,
        findTool?.preserveCase,
        findTool?.includeExcluded,
        findTool?.fileMask,
      ]);

      React.useEffect(() => {
        if (replaceState !== null) writeSearchOptions({ ...readSearchOptions(), ...replaceState });
      }, [
        replaceState?.caseSensitive,
        replaceState?.wholeWords,
        replaceState?.regex,
        replaceState?.preserveCase,
      ]);

      const findToolOpen = findTool !== null;
      const findToolQuery = findToolContentQuery(findTool?.query);
      const findToolSearchScopeMode = findTool?.searchScopeMode ?? 'project';
      const findToolSearchScopePreset = findTool?.searchScopePreset ?? 'projectFiles';
      const findToolAllowedScopePaths = findToolSearchScopeMode === 'scope'
        && findToolSearchScopePreset !== 'projectFiles'
        ? [...new Set((findToolSearchScopePreset === 'openFiles'
            ? openFiles.map((file) => file.path)
            : (git?.changes ?? []).map((change) => change.path))
          .filter((path) => typeof path === 'string' && path !== ''))]
        : undefined;
      const findToolAllowedScopePathsKey = findToolAllowedScopePaths?.join('\u0000') ?? '';
      React.useEffect(() => {
        if (!findToolOpen || findTool.loadedGeneration === findTool.searchGeneration) return undefined;
        const generation = findTool.searchGeneration;
        const requestId = ++findToolRequestRef.current;
        const requestRoot = rootRef.current;
        if (!hasFindToolContentQuery(findToolQuery)) {
          setFindTool((current) => (current === null
            ? current
            : {
                ...current,
                files: [],
                matches: [],
                truncated: false,
                loading: false,
                loadedGeneration: generation,
              }));
          return undefined;
        }
        setFindTool((current) => (current === null
          ? current
          : { ...current, files: [], loading: true, error: null }));
        const timer = window.setTimeout(() => {
          void callFs({
            op: 'searchText',
            query: findToolQuery,
            maxMatches: 200,
            caseSensitive: findTool?.caseSensitive === true ? true : undefined,
            wholeWords: findTool?.wholeWords === true,
            regex: findTool?.regex === true,
            includeExcluded: findTool?.includeExcluded === true,
            fileMask: normalizeFileExtensionFilter(findTool?.fileMask),
            directory: findTool?.searchScopeMode === 'directory' ? findTool.searchScopeDirectory ?? '' : '',
            allowedPaths: findTool?.searchScopeMode === 'scope' && findTool?.searchScopePreset !== 'projectFiles'
              ? findToolAllowedScopePaths
              : undefined,
          })
            .then((value) => {
              if (!findToolRequestIsCurrent(requestId, requestRoot, findToolRequestRef.current, rootRef.current)) return;
              const hostMatches = Array.isArray(value?.matches) ? value.matches : [];
              const dirtyFiles = (openFilesRef.current ?? []).filter((file) =>
                file.dirty === true && typeof file.content === 'string');
              const merged = mergeFindToolDirtyMatches(
                hostMatches,
                dirtyFiles,
                findToolQuery,
                {
                  caseSensitive: findTool?.caseSensitive === true,
                  wholeWords: findTool?.wholeWords === true,
                  regex: findTool?.regex === true,
                  fileMask: findTool?.fileMask,
                },
                {
                  mode: findToolSearchScopeMode,
                  directory: findTool?.searchScopeDirectory ?? '',
                  preset: findToolSearchScopePreset,
                  allowedPaths: findToolAllowedScopePaths ?? null,
                },
                200,
              );
              setFindTool((current) => (current === null
                ? current
                : {
                    ...current,
                    matches: merged.matches,
                    truncated: value?.truncated === true || merged.truncated,
                    loading: false,
                    loadedGeneration: generation,
                    error: null,
                  }));
              rememberCurrentFindQuery(findToolQuery);
            })
            .catch((failure) => {
              if (!findToolRequestIsCurrent(requestId, requestRoot, findToolRequestRef.current, rootRef.current)) return;
              setFindTool((current) => (current === null
                ? current
                : {
                    ...current,
                    files: [],
                    matches: [],
                    truncated: false,
                    loading: false,
                    loadedGeneration: generation,
                    error: searchTextFailureMessage(failure, t),
                  }));
            });
        }, 180);
        return () => window.clearTimeout(timer);
      }, [
        findToolOpen,
        findToolQuery,
        root,
        findTool?.searchGeneration,
        findTool?.loadedGeneration,
        findTool?.caseSensitive,
        findTool?.wholeWords,
        findTool?.regex,
        findTool?.fileMask,
        findToolSearchScopeMode,
        findToolSearchScopePreset,
        findTool?.searchScopeDirectory,
        findToolAllowedScopePathsKey,
        openFiles,
        rememberCurrentFindQuery,
        t,
      ]);

      /* IDEA's Find Action chord opens Search Everywhere in Actions mode.
         Existing focused controls keep their own shortcut semantics. */
      React.useEffect(() => {
        const findActionGlobalShortcut = (event) => {
          const macPlatform = isMacPlatform(navigator.userAgentData?.platform ?? navigator.platform);
          if (!findActionShortcutMatches(event, macPlatform)) return;
          if (searchEverywhereOpen) return;
          const host = document.querySelector('[data-dsh-editor-workspace]');
          if (host === null || !host.contains(document.activeElement)) return;
          if (findActionShortcutBlockedByChildContext(event.target, document.activeElement)) return;
          event.preventDefault();
          event.stopPropagation();
          openSearchEverywhere('actions');
          window.setTimeout(() => document.querySelector('[data-dsh-search-query]')?.focus?.(), 0);
        };
        window.addEventListener('keydown', findActionGlobalShortcut, true);
        return () => window.removeEventListener('keydown', findActionGlobalShortcut, true);
      }, [openSearchEverywhere, searchEverywhereOpen]);

      /* Double Shift remains a registered alias, but its action is now the
         same Find in Files handler as Cmd/Ctrl+Shift+F. */
      React.useEffect(() => {
        const onKeyDown = (event) => {
          if (visibleEditorWorkspace(document) === null) {
            doubleShiftAtRef.current = 0;
            return;
          }
          const next = doubleShiftAction(doubleShiftAtRef.current, event, performance.now());
          doubleShiftAtRef.current = next.lastAt;
          if (!next.open) return;
          event.preventDefault();
          event.stopPropagation();
          openFindInFilesFromShortcut();
        };
        const resetGesture = () => {
          doubleShiftAtRef.current = 0;
        };
        window.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('blur', resetGesture);
        return () => {
          window.removeEventListener('keydown', onKeyDown, true);
          window.removeEventListener('blur', resetGesture);
        };
      }, [openFindInFilesFromShortcut]);

      React.useEffect(() => {
        searchEverywhereFilesRequestRef.current += 1;
        findToolRequestRef.current += 1;
        searchEverywhereFilesRef.current = [];
        searchEverywhereFilesScopeRef.current = null;
        setSearchEverywhere(null);
        setShowUsages(null);
        setFindTool(null);
        setRecentSearches(root === '' ? [] : readSearchHistory(root));
        setRecentFindQueries(root === '' ? [] : readFindQueryHistory(root));
        setRecentFindUsages(root === '' ? [] : readFindUsagesHistory(root));
        setRecentReplacements(root === '' ? [] : readReplaceHistory(root));
      }, [root]);

      /**
       * ⌘E — IDEA's Recent Files.
       *
       * The list is the MRU for this workspace, newest first, and it is shown
       * WITHOUT a filesystem walk: a recent-file popup that waits for a disk scan
       * before it can render defeats the point. Files that no longer exist are
       * still listed (IDEA keeps them); opening one reports the failure in the
       * usual status line instead of the row silently doing nothing.
       * @returns {void}
       */
      const openRecent = React.useCallback(() => {
        if (rootRef.current === '') return;
        setPaletteMode('recent');
        /* Read through the ref: the keydown handler closes over an older render. */
        const list = readRecentFiles(rootRef.current);
        setRecentFiles(list);
        setQuickOpen({ query: '', index: 0, files: list, loading: false });
      }, []);

      React.useEffect(() => {
        const onKeyDown = (event) => {
          const meta = event.metaKey || event.ctrlKey;
          if (!meta || event.altKey) return;
          if (event.key.toLowerCase() !== 'e') return;
          const host = document.querySelector('[data-dsh-editor-workspace]');
          if (host === null || !document.body.contains(host)) return;
          event.preventDefault();
          event.stopPropagation();
          openRecent();
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
      }, [openRecent]);

      const openEditorFind = React.useCallback((withReplace = false, initialQuery = null, focusTarget = 'query') => {
        const savedOptions = readSearchOptions();
        const editor = currentCodeEditor();
        const model = editor?.getModel?.() ?? null;
        const selection = editor?.getSelection?.() ?? null;
        const selected = model !== null && selection !== null && !selection.isEmpty?.()
          ? model.getValueInRange(selection)
          : '';
        const requestedFind = typeof initialQuery === 'string' ? initialQuery.trim() : '';
        const hasExplicitQuery = typeof initialQuery === 'string';
        const selectedFind = selected.includes('\n') || selected.length > 200 ? '' : selected;
        const find = hasExplicitQuery ? requestedFind : selectedFind;
        const result = model !== null && find !== ''
          ? editorFindResult(model.getValue(), find, savedOptions)
          : { matches: [], error: null };
        setReplaceState((current) => {
          const base = current ?? {
            find: '',
            replace: '',
            index: 0,
            total: 0,
            withReplace: false,
            caseSensitive: savedOptions.caseSensitive,
            wholeWords: savedOptions.wholeWords,
            regex: savedOptions.regex,
            preserveCase: savedOptions.preserveCase,
            scope: null,
            error: null,
          };
          return hasExplicitQuery
            ? {
                ...base,
                find,
                index: 0,
                total: result.matches.length,
                withReplace,
                scope: null,
                error: result.error,
              }
            : { ...base, withReplace };
        });
        /* Monaco restores editor focus after a context-menu action returns.
           Defer past that restoration so the editor Find query wins. */
        window.setTimeout(() => {
          const selector = focusTarget === 'replace'
            ? '[data-dsh-editor-find-replace-input]'
            : '[data-dsh-editor-find-input]';
          document.querySelector(selector)?.focus?.();
        }, 40);
      }, [currentCodeEditor]);

      React.useEffect(() => {
        editorFindContextRunnerRef.current = (editor, withReplace = false, focusTarget = 'query') => {
          const target = findUsagesSearchTarget(editor);
          if (target.query !== '') openEditorFind(withReplace, target.query, focusTarget);
        };
        return () => {
          editorFindContextRunnerRef.current = null;
        };
      }, [openEditorFind]);

      const openEditorFindInSelection = React.useCallback((scope, withReplace = null, initialQuery = null, focusTarget = null) => {
        const editor = currentCodeEditor();
        const model = editor?.getModel?.() ?? null;
        if (model === null || scope === null) return;
        const savedOptions = readSearchOptions();
        const requestedFind = typeof initialQuery === 'string' ? initialQuery.trim() : '';
        const hasExplicitQuery = typeof initialQuery === 'string';
        setReplaceState((current) => {
          const base = current ?? {
            find: '',
            replace: '',
            index: 0,
            total: 0,
            withReplace: false,
            caseSensitive: savedOptions.caseSensitive,
            wholeWords: savedOptions.wholeWords,
            regex: savedOptions.regex,
            preserveCase: savedOptions.preserveCase,
            scope: null,
            error: null,
          };
          const nextScope = { start: scope.start, end: scope.end };
          const find = hasExplicitQuery ? requestedFind : base.find;
          const result = find === ''
            ? { matches: [], error: null }
            : editorFindResult(model.getValue(), find, { ...base, scope: nextScope });
          return {
            ...base,
            find,
            withReplace: withReplace === null ? base.withReplace === true : withReplace === true,
            scope: nextScope,
            total: result.matches.length,
            error: result.error,
            index: hasExplicitQuery ? 0 : Math.min(base.index, Math.max(0, result.matches.length - 1)),
          };
        });
        if (focusTarget !== null) {
          window.setTimeout(() => {
            const selector = focusTarget === 'replace'
              ? '[data-dsh-editor-find-replace-input]'
              : '[data-dsh-editor-find-input]';
            document.querySelector(selector)?.focus?.();
          }, 40);
        }
      }, [currentCodeEditor]);

      React.useEffect(() => {
        selectionFindContextRunnerRef.current = (editor, withReplace = false, focusTarget = 'query') => {
          const scope = editorFindSelectionScope(editor);
          const target = findUsagesSearchTarget(editor);
          if (scope === null || target.query === '') return;
          openEditorFindInSelection(scope, withReplace, target.query, focusTarget);
        };
        return () => {
          selectionFindContextRunnerRef.current = null;
        };
      }, [openEditorFindInSelection]);

      /* IDEA's editor search family: ⌘F Find, ⌘R Replace,
         ⇧⌘F Find in Files and ⇧⌘R Replace in Files. The legacy
         ⌥⌘F replace alias stays available. */
      React.useEffect(() => {
        const onKeyDown = (event) => {
          const usageFamilyAction = ideaUsageFamilyShortcutAction(
            event,
            isMacPlatform(navigator.userAgentData?.platform ?? navigator.platform),
          );
          if (usageFamilyAction !== null) {
            const target = event.target instanceof Element ? event.target : null;
            const active = document.activeElement instanceof Element ? document.activeElement : null;
            const monacoTarget = target?.closest('.monaco-editor') ?? active?.closest('.monaco-editor');
            if (monacoTarget == null || monacoTarget.closest('[data-dsh-editor-file-surface]') == null) return;
            const host = document.querySelector('[data-dsh-editor-workspace]');
            if (host === null || !host.contains(document.activeElement)) return;
            const request = findUsagesSearchTarget(currentCodeEditor());
            if (request.query === '') return;
            if (usageFamilyAction === 'findUsagesSettings') return;
            event.preventDefault();
            event.stopPropagation();
            if (usageFamilyAction === 'findUsages') openFindUsages(request.query);
            else if (usageFamilyAction === 'showUsages') openShowUsages(request.query);
            return;
          }
          const findStepDirection = ideaFindStepShortcutAction(
            event,
            isMacPlatform(navigator.userAgentData?.platform ?? navigator.platform),
          );
          if (findStepDirection !== 0) {
            const host = document.querySelector('[data-dsh-editor-workspace]');
            if (host === null || !host.contains(document.activeElement)) return;
            if (editorFindQueryActiveRef.current !== true) return;
            const target = event.target instanceof Element ? event.target : null;
            const active = document.activeElement instanceof Element ? document.activeElement : null;
            const blocked = '[data-dsh-editor-terminal], [role="tree"], [data-dsh-changes-panel], '
              + '[data-dsh-log-panel], [data-dsh-find-tool-window], [data-dsh-editor-diff-surface]';
            if (target?.closest(blocked) != null || active?.closest(blocked) != null) return;
            const editable = target?.closest('input, textarea, [contenteditable="true"]')
              ?? active?.closest('input, textarea, [contenteditable="true"]');
            if (
              editable != null
              && editable.closest('[data-dsh-search-everywhere], [data-dsh-editor-find-input], '
                + '[data-dsh-editor-find-replace-input], .monaco-editor') == null
            ) return;
            event.preventDefault();
            event.stopPropagation();
            const fromSearchEverywhere = searchEverywhereOpen;
            if (fromSearchEverywhere) setSearchEverywhere(null);
            editorFindStepRef.current?.(findStepDirection);
            if (fromSearchEverywhere) {
              window.setTimeout(() => currentCodeEditor()?.focus?.(), 0);
            }
            return;
          }
          const key = event.key.toLowerCase();
          const macMultipleCaretShortcut = isMacPlatform(navigator.userAgentData?.platform ?? navigator.platform)
            && key === 'g'
            && event.ctrlKey === true
            && event.altKey !== true;
          /* IDEA's macOS keymap reserves Control+G for multiple-caret selection;
             the dedicated listener below owns those chords. */
          if (macMultipleCaretShortcut) return;
          const meta = event.metaKey || event.ctrlKey;
          if (!meta) return;
          if (searchEverywhereOpen && key === 'r') return;
          if (key !== 'f' && key !== 'r' && key !== 'g') return;
          if (key === 'f' && event.shiftKey) {
            if (visibleEditorWorkspace(document) === null) return;
            event.preventDefault();
            event.stopPropagation();
            openFindInFilesFromShortcut();
            return;
          }
          const host = document.querySelector('[data-dsh-editor-workspace]');
          if (host === null || !host.contains(document.activeElement)) return;
          if (event.target instanceof Element && event.target.closest('[data-dsh-editor-diff-surface]') !== null) return;
          if (document.activeElement?.closest('[data-dsh-editor-diff-surface]') != null) return;
          if (key === 'r' && event.shiftKey) {
            event.preventDefault();
            event.stopPropagation();
            openBlankReplaceInFilesFromEditor();
            return;
          }
          /* The terminal dock owns ⌘F inside its own screen. */
          if (document.activeElement?.closest('[data-dsh-editor-terminal]') !== null && document.activeElement?.closest('[data-dsh-editor-terminal]') !== undefined) return;
          /* So does the Project tree: ⌘F there is the tree's speed search. */
          if (event.target instanceof Element && event.target.closest('[role="tree"]') !== null) return;
          if (document.activeElement?.closest('[role="tree"]') != null) return;
          /* Commit Changes owns ⌘F for its path filter. */
          if (event.target instanceof Element && event.target.closest('[data-dsh-changes-panel]') !== null) return;
          if (document.activeElement?.closest('[data-dsh-changes-panel]') != null) return;
          /* Commit Log owns ⌘F for IDEA's Focus Text Filter action. */
          if (event.target instanceof Element && event.target.closest('[data-dsh-log-panel]') !== null) return;
          if (document.activeElement?.closest('[data-dsh-log-panel]') != null) return;
          /* The persistent Find tool owns its own search/replace fields. */
          if (event.target instanceof Element && event.target.closest('[data-dsh-find-tool-window]') !== null) return;
          if (document.activeElement?.closest('[data-dsh-find-tool-window]') != null) return;
          if (key === 'g') {
            event.preventDefault();
            event.stopPropagation();
            const fromSearchEverywhere = searchEverywhereOpen;
            if (fromSearchEverywhere) setSearchEverywhere(null);
            editorFindStepRef.current?.(event.shiftKey ? -1 : 1);
            if (fromSearchEverywhere) {
              window.setTimeout(() => currentCodeEditor()?.focus?.(), 0);
            }
            return;
          }
          if (searchEverywhereOpen && key === 'f' && !event.shiftKey) setSearchEverywhere(null);
          event.preventDefault();
          if (key === 'r') {
            openEditorFind(true);
            return;
          }
          openEditorFind(event.altKey);
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
      }, [openBlankReplaceInFilesFromEditor, openEditorFind, openFindInFilesFromShortcut, openFindTool, openFindUsages, openShowUsages, searchEverywhereOpen, currentCodeEditor]);

      const closeSearchEverywhere = React.useCallback(() => {
        setSearchEverywhere(null);
      }, []);
      const rememberSearchEverywhereQuery = React.useCallback((query) => {
        const workspace = rootRef.current;
        if (workspace === '') return;
        const normalizedQuery = normalizeRecentSearchEntry(query);
        if (normalizedQuery === '') return;
        setRecentSearches((current) => {
          const next = rememberSearchHistory(current, normalizedQuery, 20);
          writeSearchHistory(workspace, next);
          return next;
        });
      }, []);
      const rememberSearchEverywhereCommand = React.useCallback((id) => {
        setRecentCommands((current) => {
          const next = rememberCommandHistory(current, id, 12);
          writeCommandHistory(next);
          return next;
        });
      }, []);
      const activeSourceEditor = currentCodeEditor();
      const editorModel = activeSourceEditor?.getModel?.() ?? null;
      const hasEditorModel = editorModel !== null;
      const findUsagesTarget = findUsagesSearchTarget(activeSourceEditor);
      const selectionScope = editorFindSelectionScope(activeSourceEditor);
      const hasSelectionScope = selectionScope !== null;
      const searchPlatform = navigator.userAgentData?.platform ?? navigator.platform;
      const searchMacPlatform = isMacPlatform(searchPlatform);
      const runWordOccurrence = React.useCallback((command) => {
        closeSearchEverywhere();
        if (activeSourceEditor === null) return;
        window.setTimeout(() => {
          void Promise.resolve(activeSourceEditor.getAction?.(command)?.run?.())
            .finally(() => activeSourceEditor.focus?.());
        }, 0);
      }, [activeSourceEditor, closeSearchEverywhere]);
      React.useEffect(() => {
        const platform = navigator.userAgentData?.platform ?? navigator.platform;
        if (!isMacPlatform(platform)) return undefined;
        const onKeyDown = (event) => {
          if (event.key.toLowerCase() !== 'g' || event.ctrlKey !== true || event.altKey === true) return;
          const host = document.querySelector('[data-dsh-editor-workspace]');
          if (host === null || !host.contains(document.activeElement)) return;
          const command = event.metaKey === true && event.shiftKey !== true
            ? 'editor.action.selectHighlights'
            : event.metaKey !== true && event.shiftKey === true
              ? 'cursorUndo'
              : event.metaKey !== true && event.shiftKey !== true
                ? 'editor.action.addSelectionToNextFindMatch'
                : null;
          if (command === null) return;
          event.preventDefault();
          event.stopPropagation();
          runWordOccurrence(command);
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
      }, [runWordOccurrence]);
      /* Show Usages has its own transient popup with local filtering and an
         explicit pin-to-Find handoff; it remains separate from Find Usages. */
      const searchEverywhereActions = React.useMemo(() => [
        {
          id: 'searchEverywhere',
          icon: 'search',
          label: t('editor.searchEverywhereAction'),
          description: t('editor.searchEverywhereActionHint'),
          keepOpen: true,
          rememberQuery: false,
          run: () => {
            openSearchEverywhere('all');
            window.setTimeout(() => document.querySelector('[data-dsh-search-query]')?.focus?.(), 0);
          },
        },
        {
          id: 'goToFile',
          icon: 'file',
          label: t('editor.gotoFile'),
          description: t('editor.gotoFileHint'),
          shortcut: '⌘⇧O',
          run: () => {
            closeSearchEverywhere();
            void openQuickOpen();
          },
        },
        {
          id: 'recentFiles',
          icon: 'history',
          label: t('editor.recentFiles'),
          description: t('editor.recentFilesHint'),
          shortcut: '⌘E',
          run: () => {
            closeSearchEverywhere();
            openRecent();
          },
        },
        {
          id: 'textSearch',
          icon: 'search',
          label: t('editor.textSearchAction'),
          description: t('editor.textSearchHint'),
          shortcut: '⌃⇧⌥E',
          keepOpen: true,
          rememberQuery: false,
          run: () => {
            setSearchEverywhere((current) => {
              if (current === null) return current;
              return {
                ...current,
                query: current.query,
                tab: 'text',
                index: 0,
              };
            });
            window.setTimeout(() => document.querySelector('[data-dsh-search-query]')?.focus?.(), 0);
          },
        },
        {
          id: 'findAction',
          icon: 'settings',
          label: t('editor.findActionAction'),
          description: t('editor.findActionHint'),
          shortcut: '⇧⌘A',
          keepOpen: true,
          rememberQuery: false,
          run: () => {
            setSearchEverywhere((current) => current === null
              ? current
              : { ...current, query: '', tab: 'actions', index: 0 });
            window.setTimeout(() => document.querySelector('[data-dsh-search-query]')?.focus?.(), 0);
          },
        },
        {
          id: 'showSearchHistory',
          icon: 'history',
          label: t('editor.showSearchHistoryAction'),
          description: t('editor.showSearchHistoryHint'),
          shortcut: '⌥↓',
          keepOpen: true,
          rememberQuery: false,
          run: () => {
            setSearchEverywhere((current) => current === null ? current : { ...current, tab: 'all', index: 0 });
            setSearchHistoryRequest((current) => current + 1);
          },
        },
        {
          id: 'recentFindUsages',
          icon: 'history',
          label: t('editor.recentFindUsagesAction'),
          description: t('editor.recentFindUsagesHint'),
          keepOpen: true,
          rememberQuery: false,
          run: () => setFindUsagesHistoryRequest((current) => current + 1),
        },
        {
          id: 'find',
          icon: 'search',
          label: t('editor.findAction'),
          description: t('editor.find'),
          shortcut: '⌘F',
          disabled: !hasEditorModel,
          disabledReason: t('editor.findEditorRequired'),
          run: () => {
            closeSearchEverywhere();
            openEditorFind(false);
          },
        },
        {
          id: 'findToolWindow',
          icon: 'search',
          label: t('editor.findToolWindowAction'),
          description: t('editor.findToolWindowHint'),
          keywords: t('editor.findToolWindowSynonym'),
          rememberQuery: false,
          run: () => {
            closeSearchEverywhere();
            openFindTool('', 'find', null, 'query', 'dock');
          },
        },
        {
          id: 'replace',
          icon: 'code',
          label: t('editor.replaceAction'),
          description: t('editor.replace'),
          shortcut: '⌘R',
          disabled: !hasEditorModel,
          disabledReason: t('editor.findEditorRequired'),
          run: () => {
            closeSearchEverywhere();
            openEditorFind(true);
          },
        },
        {
          id: 'structuralSearch',
          icon: 'search',
          label: t('editor.structuralSearchAction'),
          description: t('editor.structuralSearchHint'),
          keywords: t('editor.structuralSearchSynonym'),
          rememberQuery: false,
          disabled: true,
          disabledReason: t('editor.structuralSearchUnavailable'),
          run: () => {},
        },
        {
          id: 'structuralReplace',
          icon: 'code',
          label: t('editor.structuralReplaceAction'),
          description: t('editor.structuralReplaceHint'),
          keywords: t('editor.structuralReplaceSynonym'),
          rememberQuery: false,
          disabled: true,
          disabledReason: t('editor.structuralSearchUnavailable'),
          run: () => {},
        },
        {
          id: 'incrementalSearch',
          icon: 'search',
          label: t('editor.incrementalSearchAction'),
          description: t('editor.incrementalSearchHint'),
          rememberQuery: false,
          disabled: !hasEditorModel,
          disabledReason: t('editor.findEditorRequired'),
          run: () => {
            closeSearchEverywhere();
            openEditorFind(false, findUsagesTarget.query);
          },
        },
        {
          id: 'searchInSelectionOnly',
          icon: 'target',
          label: t('editor.searchInSelectionOnly'),
          description: t('editor.searchInSelectionOnly'),
          shortcut: '⌃⌥E',
          keywords: t('editor.toggleFindInSelectionSynonym'),
          rememberQuery: false,
          disabled: !hasSelectionScope,
          disabledReason: hasEditorModel
            ? t('editor.findSelectionRequired')
            : t('editor.findEditorRequired'),
          run: () => {
            closeSearchEverywhere();
            openEditorFindInSelection(selectionScope);
          },
        },
        {
          id: 'replaceInSelectionOnly',
          icon: 'code',
          label: t('editor.replaceInSelectionOnly'),
          description: t('editor.replaceInSelectionOnly'),
          rememberQuery: false,
          disabled: !hasSelectionScope,
          disabledReason: hasEditorModel
            ? t('editor.findSelectionRequired')
            : t('editor.findEditorRequired'),
          run: () => {
            closeSearchEverywhere();
            openEditorFindInSelection(selectionScope, true);
          },
        },
        {
          id: 'findSelectionInFiles',
          icon: 'search',
          label: t('editor.findSelectionInFilesAction'),
          description: t('editor.findSelectionInFilesHint'),
          keywords: t('editor.findSelectionInFilesSynonym'),
          rememberQuery: false,
          disabled: findUsagesTarget.query === '',
          disabledReason: findUsagesTarget.reason === 'editor'
            ? t('editor.findEditorRequired')
            : t('editor.findUsagesSymbolRequired'),
          run: () => openFindTool(findUsagesTarget.query, 'find'),
        },
        {
          id: 'replaceSelectionInFiles',
          icon: 'code',
          label: t('editor.replaceSelectionInFilesAction'),
          description: t('editor.replaceSelectionInFilesHint'),
          rememberQuery: false,
          disabled: findUsagesTarget.query === '',
          disabledReason: findUsagesTarget.reason === 'editor'
            ? t('editor.findEditorRequired')
            : t('editor.findUsagesSymbolRequired'),
          run: () => openFindTool(findUsagesTarget.query, 'replace', null, 'replace'),
        },
        {
          id: 'findUsages',
          icon: 'search',
          label: t('editor.findUsagesAction'),
          description: t('editor.findUsagesHint'),
          shortcut: ideaUsageFamilyShortcut('findUsages', searchMacPlatform),
          disabled: findUsagesTarget.query === '',
          disabledReason: findUsagesTarget.reason === 'editor'
            ? t('editor.findEditorRequired')
            : t('editor.findUsagesSymbolRequired'),
          run: () => openFindUsages(findUsagesTarget.query),
        },
        {
          id: 'showUsages',
          icon: 'findWindow',
          label: t('editor.showUsagesAction'),
          description: t('editor.showUsagesHint'),
          shortcut: ideaUsageFamilyShortcut('showUsages', searchMacPlatform),
          disabled: findUsagesTarget.query === '',
          disabledReason: findUsagesTarget.reason === 'editor'
            ? t('editor.findEditorRequired')
            : t('editor.findUsagesSymbolRequired'),
          run: () => {
            closeSearchEverywhere();
            openShowUsages(findUsagesTarget.query);
          },
        },
        {
          id: 'findUsagesSettings',
          icon: 'settings',
          label: t('editor.findUsagesSettingsAction'),
          description: t('editor.findUsagesSettingsHint'),
          shortcut: ideaUsageFamilyShortcut('findUsagesSettings', searchMacPlatform),
          keywords: t('editor.findUsagesSettingsSynonym'),
          disabled: true,
          disabledReason: t('editor.findUsagesSettingsUnavailable'),
          run: () => {},
        },
        {
          id: 'findUsagesInFile',
          icon: 'search',
          label: t('editor.findUsagesInFileAction'),
          description: t('editor.findUsagesInFileHint'),
          shortcut: '⌘F7',
          disabled: findUsagesTarget.query === '',
          disabledReason: findUsagesTarget.reason === 'editor'
            ? t('editor.findEditorRequired')
            : t('editor.findUsagesSymbolRequired'),
          run: () => {
            closeSearchEverywhere();
            openEditorFind(false, findUsagesTarget.query);
          },
        },
        {
          id: 'highlightUsagesInFile',
          icon: 'search',
          label: t('editor.highlightUsagesInFileAction'),
          description: t('editor.highlightUsagesInFileHint'),
          shortcut: '⇧⌘F7',
          rememberQuery: false,
          disabled: findUsagesTarget.query === '',
          disabledReason: findUsagesTarget.reason === 'editor'
            ? t('editor.findEditorRequired')
            : t('editor.findUsagesSymbolRequired'),
          run: () => {
            closeSearchEverywhere();
            if (activeSourceEditor === null) return;
            window.setTimeout(() => {
              activeSourceEditor.focus?.();
              void Promise.resolve(activeSourceEditor.getAction?.('editor.action.wordHighlight.trigger')?.run?.())
                .finally(() => activeSourceEditor.focus?.());
            }, 0);
          },
        },
        {
          id: 'searchWeb',
          icon: 'search',
          label: t('editor.searchWebAction'),
          description: t('editor.searchWebHint'),
          keywords: t('editor.searchWebSynonym'),
          disabled: findUsagesTarget.query === '',
          disabledReason: findUsagesTarget.reason === 'editor'
            ? t('editor.findEditorRequired')
            : t('editor.findUsagesSymbolRequired'),
          run: () => {
            const query = findUsagesTarget.query;
            if (query === '') return;
            closeSearchEverywhere();
            window.open(
              `https://www.google.com/search?q=${encodeURIComponent(query)}`,
              '_blank',
              'noopener,noreferrer',
            );
          },
        },
        {
          id: 'findNextWordOccurrence',
          icon: 'search',
          label: t('editor.nextWordOccurrenceAction'),
          description: t('editor.findWordAtCaretHint'),
          keywords: t('editor.nextWordOccurrenceSynonym'),
          shortcut: '⌃F3',
          disabled: findUsagesTarget.query === '',
          disabledReason: findUsagesTarget.reason === 'editor'
            ? t('editor.findEditorRequired')
            : t('editor.findUsagesSymbolRequired'),
          run: () => runWordOccurrence('editor.action.nextSelectionMatchFindAction'),
        },
        {
          id: 'findPreviousWordOccurrence',
          icon: 'search',
          label: t('editor.previousWordOccurrenceAction'),
          description: t('editor.wordOccurrenceHint'),
          shortcut: '⌃⇧F3',
          disabled: findUsagesTarget.query === '',
          disabledReason: findUsagesTarget.reason === 'editor'
            ? t('editor.findEditorRequired')
            : t('editor.findUsagesSymbolRequired'),
          run: () => runWordOccurrence('editor.action.previousSelectionMatchFindAction'),
        },
        {
          id: 'selectAllOccurrences',
          icon: 'target',
          label: t('editor.selectAllOccurrencesAction'),
          description: t('editor.selectAllOccurrencesHint'),
          shortcut: '⌃⌘G',
          disabled: findUsagesTarget.query === '',
          disabledReason: findUsagesTarget.reason === 'editor'
            ? t('editor.findEditorRequired')
            : t('editor.findUsagesSymbolRequired'),
          run: () => runWordOccurrence('editor.action.selectHighlights'),
        },
        {
          id: 'selectNextOccurrence',
          icon: 'search',
          label: t('editor.selectNextOccurrenceAction'),
          description: t('editor.selectNextOccurrenceHint'),
          keywords: t('editor.selectNextOccurrenceSynonym'),
          shortcut: '⌃G',
          disabled: findUsagesTarget.query === '',
          disabledReason: findUsagesTarget.reason === 'editor'
            ? t('editor.findEditorRequired')
            : t('editor.findUsagesSymbolRequired'),
          run: () => runWordOccurrence('editor.action.addSelectionToNextFindMatch'),
        },
        {
          id: 'unselectPreviousOccurrence',
          icon: 'history',
          label: t('editor.unselectPreviousOccurrenceAction'),
          description: t('editor.unselectPreviousOccurrenceHint'),
          keywords: t('editor.unselectPreviousOccurrenceSynonym'),
          shortcut: '⌃⇧G',
          disabled: findUsagesTarget.query === '',
          disabledReason: findUsagesTarget.reason === 'editor'
            ? t('editor.findEditorRequired')
            : t('editor.findUsagesSymbolRequired'),
          run: () => runWordOccurrence('cursorUndo'),
        },
        {
          id: 'findNext',
          icon: 'search',
          label: t('editor.findNextAction'),
          description: t('editor.findNextActionHint'),
          shortcut: '⌘G',
          disabled: !hasEditorModel || replaceState === null || replaceState.find === '',
          disabledReason: !hasEditorModel ? t('editor.findEditorRequired') : t('editor.findStepInactive'),
          run: () => {
            closeSearchEverywhere();
            editorFindStepRef.current?.(1);
          },
        },
        {
          id: 'findPrevious',
          icon: 'search',
          label: t('editor.findPreviousAction'),
          description: t('editor.findPreviousActionHint'),
          shortcut: '⇧⌘G',
          disabled: !hasEditorModel || replaceState === null || replaceState.find === '',
          disabledReason: !hasEditorModel ? t('editor.findEditorRequired') : t('editor.findStepInactive'),
          run: () => {
            closeSearchEverywhere();
            editorFindStepRef.current?.(-1);
          },
        },
        {
          id: 'searchInChanges',
          icon: 'search',
          label: t('editor.searchInChanges'),
          description: t('editor.searchInChangesHint'),
          shortcut: '⌘F',
          disabled: diffOpen === false
            || (diffTarget?.repositoryVersion !== null && typeof diffTarget?.repositoryVersion === 'object'),
          disabledReason: t('editor.searchInChangesUnavailable'),
          run: () => {
            closeSearchEverywhere();
            setActivity('commit');
            setPanelVisible(true);
            setDiffActive(true);
            window.setTimeout(() => diffSearchInChangesRef.current?.(), 40);
          },
        },
        {
          id: 'findInFiles',
          icon: 'search',
          label: t('editor.findInFilesAction'),
          description: t('editor.findInFilesHint'),
          shortcut: '⇧⌘F',
          keywords: t('editor.findInPathSynonym'),
          run: () => openFindTool('', 'find'),
        },
        {
          id: 'replaceInFiles',
          icon: 'code',
          label: t('editor.replaceInFilesAction'),
          description: t('editor.replaceInFilesHint'),
          shortcut: '⇧⌘R',
          keywords: t('editor.replaceInPathSynonym'),
          run: () => openFindTool('', 'replace'),
        },
      ], [
        activeSourceEditor,
        findUsagesTarget.query,
        findUsagesTarget.reason,
        hasSelectionScope,
        hasEditorModel,
        closeSearchEverywhere,
        openEditorFind,
        openEditorFindInSelection,
        openFindTool,
        openFindUsages,
        openShowUsages,
        openQuickOpen,
        openRecent,
        openSearchEverywhere,
        replaceState,
        runWordOccurrence,
        searchMacPlatform,
        selectionScope,
        diffOpen,
        t,
      ]);

      /* Recompute match count whenever the query or the active file changes. */
      const updateFind = React.useCallback((patch) => {
        setReplaceState((current) => {
          if (current === null) return current;
          const next = { ...current, ...patch };
          const path = currentCodePath();
          const model = path === null ? undefined : modelsRef.current.get(path);
          const text = model?.getValue() ?? '';
          const result = next.find === ''
            ? { matches: [], error: null }
            : editorFindResult(text, next.find, next);
          next.total = result.matches.length;
          next.error = result.error;
          next.index = Math.min(next.index, Math.max(0, next.total - 1));
          return next;
        });
      }, [currentCodePath]);

      const toggleFindOption = React.useCallback((key) => {
        setReplaceState((current) => {
          if (current === null) return current;
          const next = { ...current, [key]: current[key] !== true };
          if (key === 'regex' && next.regex === true) next.wholeWords = false;
          if (key === 'wholeWords' && current.regex === true) return current;
          const path = currentCodePath();
          const model = path === null ? undefined : modelsRef.current.get(path);
          const result = editorFindResult(model?.getValue() ?? '', next.find, next);
          next.total = result.matches.length;
          next.error = result.error;
          next.index = Math.min(next.index, Math.max(0, next.total - 1));
          return next;
        });
      }, [currentCodePath]);

      const toggleFindSelectionScope = React.useCallback(() => {
        const scope = editorFindSelectionScope(currentCodeEditor());
        setReplaceState((current) => {
          if (current === null) return current;
          const scoped = current.scope !== null && current.scope !== undefined;
          const nextScope = scoped ? null : scope;
          if (!scoped && nextScope === null) return current;
          const path = currentCodePath();
          const model = path === null ? undefined : modelsRef.current.get(path);
          const result = current.find === ''
            ? { matches: [], error: null }
            : editorFindResult(model?.getValue() ?? '', current.find, { ...current, scope: nextScope });
          return {
            ...current,
            scope: nextScope,
            total: result.matches.length,
            error: result.error,
            index: Math.min(current.index, Math.max(0, result.matches.length - 1)),
          };
        });
      }, [currentCodePath, currentCodeEditor]);

      /* IDEA Toggle Find in Selection: ⌃⌥E. Keep editor Find as the sole
         owner of scope state instead of adding a second selection matcher. */
      React.useEffect(() => {
        const onKeyDown = (event) => {
          if (
            event.ctrlKey !== true
            || event.altKey !== true
            || event.metaKey === true
            || event.shiftKey === true
            || event.key.toLowerCase() !== 'e'
          ) return;
          const target = event.target instanceof Element ? event.target : null;
          const host = document.querySelector('[data-dsh-editor-workspace]');
          if (target === null || host === null || !host.contains(target)) return;
          if (target.closest('[data-dsh-search-everywhere], [data-dsh-find-tool-window], [data-dsh-editor-terminal]') !== null) return;
          if (target.closest('.monaco-editor, [data-dsh-editor-find-input], [data-dsh-editor-find-replace-input]') === null) return;
          const scope = editorFindSelectionScope(currentCodeEditor());
          const action = editorFindSelectionShortcutAction(replaceState, scope);
          if (action === null) return;
          event.preventDefault();
          event.stopPropagation();
          if (action === 'toggle') {
            toggleFindSelectionScope();
            return;
          }
          openEditorFindInSelection(scope, null, null, 'query');
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
      }, [currentCodeEditor, openEditorFindInSelection, replaceState, toggleFindSelectionScope]);

      const openEditorFindHistory = (event, kind) => {
        event.preventDefault();
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        setEditorFindHistoryMenu({ kind, x: rect.left, y: rect.bottom + 4 });
      };

      /* Move the editor selection to the next/previous match. */
      const jumpToMatch = React.useCallback((direction) => {
        const editor = currentCodeEditor();
        const model = editor?.getModel() ?? null;
        if (editor === null || model === null) return;
        if (replaceState !== null && replaceState.find !== '') rememberCurrentSearchQuery(replaceState.find);
        setReplaceState((current) => {
          if (current === null || current.find === '') return current;
          const text = model.getValue();
          const result = editorFindResult(text, current.find, current);
          const matches = result.matches;
          if (matches.length === 0) return { ...current, total: 0, index: 0, error: result.error };
          const index = ((current.index + direction) % matches.length + matches.length) % matches.length;
          const match = matches[index];
          const position = model.getPositionAt(match.offset);
          editor.setSelection(new window.monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column + match.length));
          editor.revealPositionInCenterIfOutsideViewport(position);
          return { ...current, index, total: matches.length, error: null };
        });
      }, [currentCodeEditor, rememberCurrentSearchQuery, replaceState?.find]);
      editorFindStepRef.current = jumpToMatch;

      /**
       * Replace the selected occurrence, or the current find result, then move to
       * the next match. This is IDEA's single Replace action; Replace All remains
       * a separate explicit command.
       * @returns {void}
       */
      const replaceCurrent = React.useCallback(() => {
        const editor = currentCodeEditor();
        const model = editor?.getModel() ?? null;
        if (editor === null || model === null || replaceState === null || replaceState.find === '') return;
        const query = replaceState.find;
        const selection = editor.getSelection();
        const text = model.getValue();
        const result = editorFindResult(text, query, replaceState);
        if (result.error !== null) {
          setReplaceState((current) => (current === null ? current : { ...current, total: 0, index: 0, error: result.error }));
          return;
        }
        if (result.matches.length === 0) {
          setReplaceState((current) => (current === null ? current : { ...current, total: 0, index: 0, error: null }));
          return;
        }
        const selectionOffset = selection === null ? null : model.getOffsetAt(selection.getStartPosition());
        const selectedMatch = selectionOffset === null
          ? null
          : result.matches.find((match) => match.offset === selectionOffset);
        const match = selectedMatch ?? result.matches[Math.min(replaceState.index, result.matches.length - 1)];
        const offset = match.offset;
        if (!Number.isFinite(offset)) return;
        const rewritten = editorReplaceAt(text, query, replaceState.replace, offset, replaceState);
        if (rewritten.error !== null) {
          setReplaceState((current) => (current === null ? current : { ...current, error: rewritten.error }));
          return;
        }
        rememberCurrentSearchQuery(query);
        rememberCurrentReplacement(replaceState.replace);
        const start = model.getPositionAt(offset);
        const end = model.getPositionAt(offset + rewritten.length);
        editor.executeEdits('dsh-editor-replace', [{
          range: new window.monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
          text: rewritten.replacementText,
          forceMoveMarkers: true,
        }]);
        const replacementEnd = offset + rewritten.replacementText.length;
        const after = model.getValue();
        const nextScope = replaceState.scope === null || replaceState.scope === undefined
          ? null
          : {
              start: replaceState.scope.start,
              end: replaceState.scope.end + rewritten.replacementText.length - rewritten.length,
            };
        const nextResult = editorFindResult(after, query, { ...replaceState, scope: nextScope });
        const nextMatches = nextResult.matches;
        const nextIndex = Math.max(0, nextMatches.findIndex((entry) => entry.offset >= replacementEnd));
        if (nextMatches.length > 0) {
          const nextMatch = nextMatches[nextIndex];
          const position = model.getPositionAt(nextMatch.offset);
          editor.setSelection(new window.monaco.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column + nextMatch.length,
          ));
          editor.revealPositionInCenterIfOutsideViewport(position);
        }
        setReplaceState((current) => (current === null
          ? current
          : {
              ...current,
              scope: nextScope,
              total: nextMatches.length,
              index: nextMatches.length === 0 ? 0 : nextIndex,
              error: nextResult.error,
            }));
      }, [currentCodeEditor, rememberCurrentReplacement, rememberCurrentSearchQuery, replaceState]);

      const replaceAll = React.useCallback(() => {
        const editor = currentCodeEditor();
        const model = editor?.getModel() ?? null;
        if (model === null) return;
        if (replaceState !== null && replaceState.find !== '') {
          rememberCurrentSearchQuery(replaceState.find);
          rememberCurrentReplacement(replaceState.replace);
        }
        setReplaceState((current) => {
          if (current === null || current.find === '') return current;
          const query = current.find;
          const next = current.replace;
          const before = model.getValue();
          const rewritten = editorReplaceAll(before, query, next, current);
          if (rewritten.error !== null) return { ...current, total: 0, index: 0, error: rewritten.error };
          if (rewritten.text !== before) {
            editor.executeEdits('dsh-editor-replace-all', [{ range: model.getFullModelRange(), text: rewritten.text, forceMoveMarkers: true }]);
          }
          const nextScope = current.scope === null || current.scope === undefined
            ? null
            : { start: current.scope.start, end: current.scope.end + (rewritten.delta ?? 0) };
          const result = editorFindResult(rewritten.text, query, { ...current, scope: nextScope });
          return { ...current, scope: nextScope, total: result.matches.length, index: 0, error: result.error };
        });
      }, [currentCodeEditor, rememberCurrentReplacement, rememberCurrentSearchQuery, replaceState]);

      const closeFind = React.useCallback(() => {
        setReplaceState(null);
        currentCodeEditor()?.focus();
      }, [currentCodeEditor]);

      /* Discard local edits and take the on-disk contents, IDEA's "Load File from Disk". */
      /**
       * Re-read one open tab from disk, keeping it open and clean.
       *
       * `openFile` short-circuits when a path is already open, so anything that
       * rewrites a file behind the editor (restore-to-revision, checkout) needs
       * this instead — otherwise the tab keeps showing stale bytes.
       * @param {string} path - workspace-relative file path.
       * @returns {Promise<void>} resolves once the tab reflects the disk.
       */
      const reloadFile = React.useCallback(async (path) => {
        if (typeof path !== 'string' || path === '') return;
        try {
          const value = await callFs({ op: 'read', path });
          const model = modelsRef.current.get(path);
          if (model !== undefined) {
            silentReloadRef.current.add(path);
            try {
              model.setValue(value.content);
            } finally {
              silentReloadRef.current.delete(path);
            }
          }
          setOpenFiles((current) =>
            current.map((entry) => (entry.path === path ? { ...entry, content: value.content, dirty: false, mtime: value.mtime ?? null } : entry)),
          );
          setExternalChanges((current) => {
            if (current[path] === undefined) return current;
            const next = { ...current };
            delete next[path];
            return next;
          });
        } catch (error) {
          setEditorError(error instanceof Error ? error.message : String(error));
        }
      }, []);

      /**
       * IDEA's Replace in Files apply step.
       *
       * Search results supply the exact files and their observed mtimes. Dirty
       * open buffers are rewritten in their Monaco models; clean targets keep
       * the host's protected disk-write path and transactional rollback.
       * @returns {Promise<void>} resolves after the write attempt and refresh.
       */
      const replaceInFiles = React.useCallback(async () => {
        const query = searchEverywhere?.query.trim() ?? '';
        const replacement = typeof searchEverywhere?.replace === 'string' ? searchEverywhere.replace : '';
        const matches = Array.isArray(searchEverywhere?.textMatches) ? searchEverywhere.textMatches : [];
        if (query === '' || matches.length === 0) return;
        const replacementPlan = planWorkspaceReplacements(
          matches,
          openFilesRef.current,
          modelsRef.current,
          query,
          replacement,
          {
            caseSensitive: searchEverywhere.caseSensitive === true,
            wholeWords: searchEverywhere.wholeWords === true,
            regex: searchEverywhere.regex === true,
            preserveCase: searchEverywhere.preserveCase === true,
          },
        );
        if (replacementPlan.errorPath !== null) {
          setSearchEverywhere((current) => (current === null
            ? current
            : {
                ...current,
                error: t('editor.searchReplaceDirty', { files: replacementPlan.errorPath }),
              }));
          return;
        }
        if (replacementPlan.errorMessage !== null) {
          setSearchEverywhere((current) => (current === null
            ? current
            : {
                ...current,
                error: replacementPlan.errorMessage,
              }));
          return;
        }
        const { cleanTargets, dirtyPlans } = replacementPlan;
        const operationFileCount = new Set([...cleanTargets.keys(), ...dirtyPlans.map((plan) => plan.path)]).size;
        if (operationFileCount === 0) return;
        if (!claimReplaceAttempt(replaceWriteBusyRef, searchEverywhere?.replaceBusy === true)) return;
        if (!window.confirm(t('editor.searchReplaceConfirm', searchReplaceCountParams(t, matches.length, operationFileCount)))) {
          releaseReplaceAttempt(replaceWriteBusyRef);
          setSearchEverywhere((current) => (current === null
            ? current
            : {
                ...current,
                replaceFocusRequest: (current.replaceFocusRequest ?? 0) + 1,
              }));
          return;
        }
        setSearchEverywhere((current) => (current === null ? current : { ...current, replaceBusy: true, error: null }));
        try {
          const value = cleanTargets.size === 0 ? null : await callFs({
              op: 'replaceText',
              query,
              replacement,
              targets: [...cleanTargets.values()],
              caseSensitive: searchEverywhere.caseSensitive === true ? true : undefined,
              wholeWords: searchEverywhere.wholeWords === true,
              regex: searchEverywhere.regex === true,
              preserveCase: searchEverywhere.preserveCase === true,
              fileMask: normalizeFileExtensionFilter(searchEverywhere.fileMask),
          });
          const dirtyCommit = commitFindToolDirtyPlans(dirtyPlans);
          const dirtyReplacements = dirtyCommit.count;
          const dirtyChanged = dirtyCommit.paths;
          if (dirtyCommit.contents.size > 0) {
            setOpenFiles((current) => current.map((file) =>
              dirtyCommit.contents.has(file.path)
                ? { ...file, content: dirtyCommit.contents.get(file.path), dirty: true }
                : file));
          }
          const hostChanged = Array.isArray(value?.files) ? value.files : [];
          const changed = [...new Set([...hostChanged, ...dirtyChanged])];
          const openChanged = new Set(openFilesRef.current.map((file) => file.path));
          const dirtyChangedSet = new Set(dirtyChanged);
          for (const path of hostChanged) {
            if (openChanged.has(path) && !dirtyChangedSet.has(path)) await reloadFile(path);
          }
          await loadGit();
          rememberCurrentSearchQuery(query);
          rememberCurrentReplacement(replacement);
          const replacedCount = (value?.replacements ?? 0) + dirtyReplacements;
          flashStatus(t('editor.searchReplaceDone', searchReplaceCountParams(t, replacedCount, changed.length)));
          setSearchEverywhere((current) => (current === null
            ? current
            : {
                ...current,
                textMatches: [],
                textRevision: (current.textRevision ?? 0) + 1,
                replaceBusy: false,
                error: null,
              }));
        } catch (failure) {
          setSearchEverywhere((current) => (current === null
            ? current
            : {
                ...current,
                replaceBusy: false,
                error: failure instanceof Error ? failure.message : String(failure),
              }));
        } finally {
          releaseReplaceAttempt(replaceWriteBusyRef);
        }
      }, [flashStatus, loadGit, reloadFile, rememberCurrentReplacement, rememberCurrentSearchQuery, searchEverywhere, t]);

      /**
       * Apply IDEA's Replace in Files action from the persistent Find window.
       *
       * Dirty open documents are replaced in their Monaco models; clean targets
       * continue through the host's guarded disk write. Each dirty model edit is
       * isolated as its own undo step.
       * @returns {Promise<void>} resolves after the guarded write and refresh.
       */
      const replaceInFindTool = React.useCallback(async (allowedPaths = null) => {
        const query = findToolContentQuery(findTool?.query);
        const requestGeneration = Math.max(0, Number(findTool?.searchGeneration) || 0);
        const allowed = allowedPaths instanceof Set ? allowedPaths : null;
        const matches = (Array.isArray(findTool?.matches) ? findTool.matches : [])
          .filter((match) => allowed === null || allowed.has(match.path));
        if (!hasFindToolContentQuery(query) || matches.length === 0) return;
        const replacementPlan = planWorkspaceReplacements(
          matches,
          openFilesRef.current,
          modelsRef.current,
          query,
          findTool.replace,
          {
            caseSensitive: findTool.caseSensitive === true,
            wholeWords: findTool.wholeWords === true,
            regex: findTool.regex === true,
            preserveCase: findTool.preserveCase === true,
          },
        );
        if (replacementPlan.errorPath !== null) {
          setFindTool((current) => (current === null
            ? current
            : {
                ...current,
                error: t('editor.searchReplaceDirty', { files: replacementPlan.errorPath }),
                replaceFocusRequest: (current.replaceFocusRequest ?? 0) + 1,
              }));
          return;
        }
        if (replacementPlan.errorMessage !== null) {
          setFindTool((current) => (current === null
            ? current
            : {
                ...current,
                error: replacementPlan.errorMessage,
                replaceFocusRequest: (current.replaceFocusRequest ?? 0) + 1,
              }));
          return;
        }
        const { cleanTargets, dirtyPlans } = replacementPlan;
        const operationFileCount = new Set([...cleanTargets.keys(), ...dirtyPlans.map((plan) => plan.path)]).size;
        if (operationFileCount === 0) return;
        if (!claimReplaceAttempt(replaceWriteBusyRef, findTool?.replaceBusy === true)) return;
        if (!window.confirm(t('editor.searchReplaceConfirm', searchReplaceCountParams(t, matches.length, operationFileCount)))) {
          releaseReplaceAttempt(replaceWriteBusyRef);
          setFindTool((current) => (current === null
            ? current
            : {
                ...current,
                replaceFocusRequest: (current.replaceFocusRequest ?? 0) + 1,
              }));
          return;
        }
        setFindTool((current) => (current === null
          ? current
          : {
              ...current,
              replaceBusy: true,
              error: null,
              replaceFocusRequest: (current.replaceFocusRequest ?? 0) + 1,
            }));
        try {
          const value = cleanTargets.size === 0 ? null : await callFs({
              op: 'replaceText',
              query,
              replacement: findTool.replace,
              targets: [...cleanTargets.values()],
              caseSensitive: findTool.caseSensitive === true ? true : undefined,
              wholeWords: findTool.wholeWords === true,
              regex: findTool.regex === true,
              preserveCase: findTool.preserveCase === true,
              fileMask: normalizeFileExtensionFilter(findTool.fileMask),
          });
          const dirtyCommit = commitFindToolDirtyPlans(dirtyPlans);
          const dirtyReplacements = dirtyCommit.count;
          const dirtyChanged = dirtyCommit.paths;
          if (dirtyCommit.contents.size > 0) {
            setOpenFiles((current) => current.map((file) =>
              dirtyCommit.contents.has(file.path)
                ? { ...file, content: dirtyCommit.contents.get(file.path), dirty: true }
                : file));
          }
          const hostChanged = Array.isArray(value?.files) ? value.files : [];
          const changed = [...new Set([...hostChanged, ...dirtyChanged])];
          const openChanged = new Set(openFilesRef.current.map((file) => file.path));
          const dirtyChangedSet = new Set(dirtyChanged);
          for (const path of hostChanged) {
            if (openChanged.has(path) && !dirtyChangedSet.has(path)) await reloadFile(path);
          }
          await loadGit();
          rememberCurrentFindQuery(query);
          rememberCurrentReplacement(findTool.replace);
          const replacedCount = (value?.replacements ?? 0) + dirtyReplacements;
          flashStatus(t('editor.searchReplaceDone', searchReplaceCountParams(t, replacedCount, changed.length)));
          setFindTool((current) => (current === null
            ? current
            : {
                ...current,
                matches: [],
                files: [],
                replaceBusy: false,
                error: null,
                searchGeneration: (current.searchGeneration ?? 0) + 1,
                loadedGeneration: -1,
              }));
        } catch (failure) {
          const message = failure instanceof Error ? failure.message : String(failure);
          flashStatus(message);
          setFindTool((current) => replaceFailureState(current, requestGeneration, message));
        } finally {
          releaseReplaceAttempt(replaceWriteBusyRef);
        }
      }, [findTool, flashStatus, loadGit, reloadFile, rememberCurrentFindQuery, rememberCurrentReplacement, t]);

      /**
       * Replace the one Find occurrence the user is pointing at.
       *
       * Dirty occurrences are replaced in the exact live model; clean
       * occurrences continue through the host's mtime and line/column checks.
       * Keeping the current visible index after the follow-up search naturally
       * advances to the next result.
       * @param {{path?: string, mtime?: number, line?: number, column?: number, kind?: string}} match - active Find row.
       * @param {number} activeIndex - current row index in the visible result set.
       * @returns {Promise<void>} resolves after the guarded write and refresh.
       */
      const replaceFindToolOccurrence = React.useCallback(async (match, activeIndex) => {
        const query = findToolContentQuery(findTool?.query);
        const requestGeneration = Math.max(0, Number(findTool?.searchGeneration) || 0);
        const line = Number(match?.line);
        const column = Number(match?.column);
        if (
          !hasFindToolContentQuery(query)
          || match?.kind !== 'text'
          || typeof match.path !== 'string'
          || match.path === ''
          || !Number.isInteger(line)
          || line < 1
          || !Number.isInteger(column)
          || column < 1
        ) return;
        const dirtyFile = openFilesRef.current.find((file) => file.path === match.path && file.dirty === true);
        const dirtyModel = dirtyFile === undefined ? undefined : modelsRef.current.get(match.path);
        let dirtyOffset = null;
        let dirtyRewrite = null;
        if (dirtyFile !== undefined) {
          if (dirtyModel === undefined) {
            setFindTool((current) => (current === null
              ? current
              : {
                  ...current,
                  error: t('editor.searchReplaceDirty', { files: match.path }),
                  replaceFocusRequest: (current.replaceFocusRequest ?? 0) + 1,
                }));
            return;
          }
          dirtyOffset = textOffsetAtLineColumn(dirtyModel.getValue(), line, column);
          dirtyRewrite = dirtyOffset === null
            ? { error: 'find result no longer matches' }
            : editorReplaceAt(dirtyModel.getValue(), query, findTool.replace, dirtyOffset, {
                caseSensitive: findTool.caseSensitive === true,
                wholeWords: findTool.wholeWords === true,
                regex: findTool.regex === true,
                preserveCase: findTool.preserveCase === true,
              });
          if (dirtyRewrite.error !== null) {
            setFindTool((current) => (current === null
              ? current
              : {
                  ...current,
                  error: dirtyRewrite.error,
                  replaceFocusRequest: (current.replaceFocusRequest ?? 0) + 1,
                }));
            return;
          }
        }
        if (!claimReplaceAttempt(replaceWriteBusyRef, findTool?.replaceBusy === true)) return;
        setFindTool((current) => (current === null
          ? current
          : {
              ...current,
              replaceBusy: true,
              error: null,
              replaceFocusRequest: (current.replaceFocusRequest ?? 0) + 1,
            }));
        try {
          const value = dirtyFile === undefined ? await callFs({
              op: 'replaceText',
              query,
              replacement: findTool.replace,
              targets: [{ path: match.path, mtime: match.mtime }],
              occurrence: { line: match.line, column: match.column },
              caseSensitive: findTool.caseSensitive === true ? true : undefined,
              wholeWords: findTool.wholeWords === true,
              regex: findTool.regex === true,
              preserveCase: findTool.preserveCase === true,
              fileMask: normalizeFileExtensionFilter(findTool.fileMask),
          }) : null;
          if (dirtyFile !== undefined && dirtyModel !== undefined && dirtyRewrite !== null && dirtyOffset !== null) {
            const start = dirtyModel.getPositionAt(dirtyOffset);
            const end = dirtyModel.getPositionAt(dirtyOffset + dirtyRewrite.length);
            dirtyModel.pushStackElement?.();
            dirtyModel.pushEditOperations([], [{
              range: {
                startLineNumber: start.lineNumber,
                startColumn: start.column,
                endLineNumber: end.lineNumber,
                endColumn: end.column,
              },
              text: dirtyRewrite.replacementText,
              forceMoveMarkers: true,
            }], () => null);
            setOpenFiles((current) => current.map((file) =>
              file.path === match.path ? { ...file, content: dirtyRewrite.text, dirty: true } : file));
          }
          const changed = dirtyFile === undefined
            ? (Array.isArray(value?.files) ? value.files : [])
            : [match.path];
          const openChanged = new Set(openFilesRef.current.map((file) => file.path));
          for (const path of changed) {
            if (dirtyFile === undefined && openChanged.has(path)) await reloadFile(path);
          }
          await loadGit();
          rememberCurrentFindQuery(query);
          rememberCurrentReplacement(findTool.replace);
          const replacedCount = (value?.replacements ?? 0) + (dirtyFile === undefined ? 0 : 1);
          flashStatus(t('editor.searchReplaceDone', searchReplaceCountParams(t, replacedCount, changed.length)));
          setFindTool((current) => (current === null
            ? current
            : {
                ...current,
                replaceBusy: false,
                error: null,
                index: Math.max(0, Number(activeIndex) || 0),
                replaceFocusRequest: (current.replaceFocusRequest ?? 0) + 1,
              replaceAdvanceRowKey: match.rowKey,
              replaceAdvanceRevision: (current.replaceAdvanceRevision ?? 0) + 1,
                searchGeneration: (current.searchGeneration ?? 0) + 1,
                loadedGeneration: -1,
              }));
        } catch (failure) {
          const message = failure instanceof Error ? failure.message : String(failure);
          flashStatus(message);
          setFindTool((current) => replaceFailureState(current, requestGeneration, message));
        } finally {
          releaseReplaceAttempt(replaceWriteBusyRef);
        }
      }, [findTool, flashStatus, loadGit, reloadFile, rememberCurrentFindQuery, rememberCurrentReplacement, t]);

      /**
       * Stop warning about one external change without touching the editor.
       *
       * Declared before `reloadActiveFromDisk` because that callback lists it as a
       * dependency: reading it later would hit the temporal dead zone.
       * @param {string} path - workspace-relative file path.
       */
      const dismissExternal = React.useCallback((path) => {
        setExternalChanges((current) => {
          if (current[path] === undefined) return current;
          const next = { ...current };
          delete next[path];
          return next;
        });
      }, []);

      const reloadActiveFromDisk = React.useCallback(async () => {
        const path = activePathRef.current;
        if (path === null) return;
        try {
          const value = await callFs({ op: 'read', path });
          const model = modelsRef.current.get(path);
          if (model !== undefined) {
            silentReloadRef.current.add(path);
            try {
              model.setValue(value.content);
            } finally {
              silentReloadRef.current.delete(path);
            }
          }
          setOpenFiles((current) =>
            current.map((entry) => (entry.path === path ? { ...entry, content: value.content, dirty: false, mtime: value.mtime ?? null } : entry)),
          );
          setConflict(null);
          setEditorError(null);
          dismissExternal(path);
          await loadGit();
        } catch (error) {
          setEditorError(error instanceof Error ? error.message : String(error));
        }
      }, [dismissExternal, loadGit]);

      /**
       * Reveal one path in the Project tree, expanding its ancestors.
       *
       * IDEA's "Select in Project View": the tree is where the file lives, so the
       * reveal has to expand what is collapsed instead of only moving the
       * selection to a row that may not be rendered yet.
       * @param {string} path - workspace-relative path to show.
       * @returns {Promise<void>} resolves once the tree shows the path.
       */
      /**
       * Make one path visible in the tree: expand its ancestors, select it, scroll to it.
       *
       * Deliberately does NOT touch the tool window's activity or visibility —
       * "Autoscroll from Source" runs this on every tab change and must not pop
       * the Commit panel back to Project or open a hidden tool window.
       * @param {string} path - workspace-relative path to show.
       * @returns {Promise<void>} resolves once the row is on screen.
       */
      const revealInProjectTree = React.useCallback(async (path) => {
        if (typeof path !== 'string' || path === '') return;
        const parts = path.split('/');
        let prefix = '';
        const nextExpanded = new Set(expandedRef.current);
        /* The root's own row is always present, so this stops before the last part. */
        for (let index = 0; index < parts.length - 1; index += 1) {
          prefix = prefix === '' ? parts[index] : `${prefix}/${parts[index]}`;
          nextExpanded.add(prefix);
          if (childrenRef.current[prefix] === undefined) {
            try {
              const value = await callFs({ op: 'list', path: prefix, showHidden, sort: sortMode, foldersFirst, showExcluded: showExcludedFiles });
              setChildren((current) => ({ ...current, [prefix]: value.entries ?? [] }));
            } catch {
              /* an unreadable ancestor still leaves the target selected */
            }
          }
        }
        setExpanded(nextExpanded);
        setSelectedPath(path);
        window.setTimeout(() => {
          rowRefs.current.get(path)?.scrollIntoView({ block: 'center' });
        }, 0);
      }, [foldersFirst, setSelectedPath, showExcludedFiles, showHidden, sortMode]);

      const revealPath = React.useCallback(async (path) => {
        if (typeof path !== 'string' || path === '') return;
        suppressAutoScrollRef.current = true;
        /* IDEA returns to the last real tree view (Project or Project Files),
           not necessarily the default Project entry, when leaving a filtered view. */
        applyProjectView(lastProjectTreeViewRef.current);
        setActivity('project');
        setPanelVisible(true);
        await revealInProjectTree(path);
        window.setTimeout(() => {
          suppressAutoScrollRef.current = false;
        }, 250);
      }, [applyProjectView, revealInProjectTree]);

      /**
       * IDEA's "Autoscroll from Source": the Project tree follows the active tab.
       *
       * Only while the Project view is actually on screen — silently reselecting
       * rows in a closed tool window would make the next glance at it feel random
       * (a selection nobody asked for, moved while the user was reading code).
       */
      React.useEffect(() => {
        if (suppressAutoScrollRef.current) return;
        if (!autoScroll || !panelVisible || activity !== 'project') return;
        if (activePath === null || activePath === '') return;
        if (projectTreeActionsAvailable === false) {
          if (rows.some((row) => row.path === activePath)) setSelectedPath(activePath);
          return;
        }
        void revealInProjectTree(activePath);
      }, [activePath, activity, autoScroll, panelVisible, revealInProjectTree, setSelectedPath]);

      /* The tab menu's "Select in Project View" acts on the open file. */
      const revealActive = React.useCallback(async () => {
        const path = activePathRef.current;
        if (path === null) return;
        if (projectTreeActionsAvailable === false && rows.some((row) => row.path === path)) {
          setActivity('project');
          setPanelVisible(true);
          setSelectedPath(path);
          window.setTimeout(() => rowRefs.current.get(path)?.scrollIntoView({ block: 'nearest' }), 0);
          return;
        }
        await revealPath(path);
      }, [projectTreeActionsAvailable, revealPath, rows, setSelectedPath]);
      const revealActiveRef = React.useRef(null);
      React.useEffect(() => {
        revealActiveRef.current = revealActive;
      }, [revealActive]);

      /**
       * Return keyboard ownership to the Project tree after an Options command.
       *
       * The generic ContextMenu restores focus to the button that opened it. When
       * the action came from the overflow `»`, that button may no longer exist or
       * may have been the previous menu row, leaving arrow keys dead. IDEA keeps
       * the selected tree row alive and hands keys back to the tree.
       * @returns {void}
       */
      const focusProjectAfterOption = React.useCallback(() => {
        const focusNow = () => {
          const path = selectedPathRef.current;
          const row = path === null ? null : rowRefs.current.get(path);
          /* The selected row is usually tabIndex=-1 (the tree container owns the
             0 tab stop). Calling focus() on it is a no-op that strands <body>. */
          const target = row?.isConnected === true && row.tabIndex >= 0 ? row : treeRef.current;
          target?.focus?.();
        };
        /* Commands such as Sort/Expand All re-render or reload the tree asynchronously.
           The first write lands immediately; the second covers a host/re-render pass
           that would otherwise move focus to <body>. */
        focusNow();
        window.setTimeout(focusNow, 120);
      }, []);

      /**
       * Run one Project Options command, then restore tree focus unless the command
       * intentionally opened another keyboard-owned surface (Quick Open / Recent).
       * @param {Function} action - command body.
       * @returns {void}
       */
      const runProjectOption = React.useCallback((action) => {
        action();
        focusProjectAfterOption();
      }, [focusProjectAfterOption]);

      /**
       * Expand one directory without ever collapsing it, loading children on demand.
       * @param {string} path - workspace-relative directory ('' for the root).
       * @returns {Promise<void>} resolves once the tree shows the directory.
       */
      const expandTo = React.useCallback(async (path) => {
        setExpanded((current) => new Set([...current, '', ...ancestorsOf(path)]));
        for (const directory of [...ancestorsOf(path), path === '' ? null : path].filter((value) => typeof value === 'string')) {
          if (childrenRef.current[directory] !== undefined) continue;
          try {
            const value = await callFs({ op: 'list', path: directory, showHidden, sort: sortMode, foldersFirst, showExcluded: showExcludedFiles });
            setChildren((current) => ({ ...current, [directory]: value.entries ?? [] }));
          } catch {
            /* a vanished directory simply stays absent */
          }
        }
      }, [foldersFirst, showExcludedFiles, showHidden, sortMode]);

      /**
       * Expand one or more directory subtrees, reusing one safety-bounded walk.
       * @param {string[]} startPaths - directories to expand recursively.
       * @returns {Promise<void>} resolves once the tree caches are updated.
       */
      const expandSubtrees = React.useCallback(async (startPaths) => {
        const value = await expandDirectorySubtrees(
          startPaths,
          { expanded: expandedRef.current, children: childrenRef.current },
          async (directory) => {
            const listing = await callFs({ op: 'list', path: directory, showHidden, sort: sortMode, foldersFirst, showExcluded: showExcludedFiles });
            return listing.entries ?? [];
          },
        );
        setChildren(value.children);
        setExpanded(value.expanded);
      }, [foldersFirst, showExcludedFiles, showHidden, sortMode]);

      /**
       * IDEA ExpandRecursively: expand every selected directory and its descendants.
       *
       * A selected root intentionally traverses the whole workspace, matching
       * IDEA. File-only and empty selections stay disabled in the toolbar.
       * @returns {void}
       */
      const expandSelectedTree = React.useCallback(() => {
        const starts = [...selection].flatMap((path) => {
          const row = rows.find((entry) => entry.path === path);
          return row?.kind === 'directory' ? ['', ...ancestorsOf(path), path] : [];
        });
        void expandSubtrees([...new Set(starts)]);
      }, [expandSubtrees, rows, selection]);

      /* Expand every directory under the root, bounded to keep huge repos responsive. */
      const expandAll = React.useCallback(async () => {
        await expandSubtrees(entries.filter((entry) => entry.kind === 'directory').map((entry) => entry.path));
      }, [entries, expandSubtrees]);

      /* Clear every expansion state. */
      const collapseAll = React.useCallback(() => {
        setExpanded(new Set());
      }, []);

      /**
       * Re-read the tree from disk, keeping every unchanged listing as it is.
       *
       * This is the broad path: an explicit refresh, a git operation, or a
       * structural filesystem change. `only` narrows it to the directories that
       * actually changed on disk, which is what the watcher reports.
       * @param {string[]|null} [only] - workspace-relative directories to re-read; omitted for every expanded one.
       * @returns {Promise<void>} resolves once the listings are applied.
       */
      const refreshTree = React.useCallback(async (only) => {
        /* A toolbar button passes its click event here; anything but an array means
           "refresh everything". */
        const narrowed = Array.isArray(only) ? only : null;
        /* Re-read the root first: everything below it is keyed by paths in that
           listing, and a delete can invalidate an expanded directory outright. */
        const listing = await loadRoot();
        const nextChildren = {};
        /* Only expanded directories render rows, so re-reading a collapsed one buys
           nothing. `narrowed` may name collapsed directories (the watcher reports
           the disk, not the view), which this filter drops. */
        for (const path of narrowed ?? [...expandedRef.current]) {
          if (path === '' || !expandedRef.current.has(path)) continue;
          try {
            const value = await callFs({ op: 'list', path, showHidden, sort: sortMode, foldersFirst, showExcluded: showExcludedFiles });
            nextChildren[path] = value.entries ?? [];
          } catch {
            /* a directory that disappeared stays absent */
          }
        }
        /* Merge instead of replace: a directory expanded a moment ago may not be in
           `expandedRef` yet (that ref syncs in an effect), and replacing the whole map
           would drop its freshly fetched children until the next expand. */
        setChildren((current) => {
          let changed = false;
          const next = { ...current };
          for (const [path, rows] of Object.entries(nextChildren)) {
            /* An identical listing keeps the SAME array, so React skips those rows
               entirely — that is what makes a no-op refresh invisible. */
            const kept = keepUnchangedListing(current[path], rows);
            if (kept === current[path]) continue;
            next[path] = kept;
            changed = true;
          }
          /* A directory that disappeared leaves a cached listing behind: its rows
             stop rendering (the parent no longer lists it) but the entry keeps the
             old files, and re-creating the name would show them again for a frame.
             Prune only where the PARENT's listing was actually read this round —
             otherwise a collapsed branch's cache would be thrown away for free. */
          const read = new Map([['', Array.isArray(listing) ? listing : []], ...Object.entries(next)]);
          for (const path of Object.keys(next)) {
            const parent = dirname(path);
            const siblings = read.get(parent);
            if (siblings === undefined) continue;
            if (siblings.some((entry) => entry?.path === path)) continue;
            delete next[path];
            changed = true;
          }
          return changed ? next : current;
        });
        /* Files that appeared since the last refresh are marked "new" for one cycle. */
        setNewPaths((current) => {
          const known = knownPathsRef.current;
          if (known === null) {
            /* First refresh only establishes the baseline: nothing is "new" yet. */
            knownPathsRef.current = new Set(collectFilePaths(listing ?? []));
            return current;
          }
          const next = new Set(current);
          const visible = new Set(collectFilePaths(listing ?? []));
          for (const path of visible) if (!known.has(path)) next.add(path);
          /* A path that disappeared stops being "new". */
          for (const path of [...next]) if (!visible.has(path)) next.delete(path);
          knownPathsRef.current = visible;
          /* Same membership: keep the Set, so an idle refresh re-renders nothing. */
          if (next.size === current.size && [...next].every((path) => current.has(path))) return current;
          return next;
        });
        /* A tab whose file vanished outside the editor is marked, not silently kept. */
        const open = openFilesRef.current;
        if (open.length === 0) return;
        try {
          const described = await callFs({ op: 'exists', paths: open.map((file) => file.path) });
          const vanished = new Set((described ?? []).filter((entry) => entry.exists !== true).map((entry) => entry.path));
          setDeletedPaths((current) => {
            /* Same membership: keep the Set so React skips the re-render. */
            if (current.size === vanished.size && [...vanished].every((path) => current.has(path))) return current;
            return vanished;
          });
        } catch {
          /* an unreadable workspace keeps the previous marks */
        }
      }, [foldersFirst, loadRoot, showExcludedFiles, showHidden, sortMode]);

      /**
       * Write the editor's content back to a file that was deleted underneath it.
       *
       * "Reload from disk" cannot work here (there is nothing to read), so the
       * only sensible action is the opposite one: recreate the file from what the
       * user still has in front of them.
       * @returns {Promise<void>} resolves once the file exists again.
       */
      const recreateActive = React.useCallback(async () => {
        const path = activePathRef.current;
        if (path === null) return;
        const model = modelsRef.current.get(path);
        if (model === undefined) return;
        try {
          /* `create` is required: a deleted file cannot be "overwritten", only recreated. */
          const value = await callFs({ op: 'write', path, content: model.getValue(), force: true, create: true });
          setOpenFiles((current) =>
            current.map((entry) => (entry.path === path ? { ...entry, content: model.getValue(), dirty: false, mtime: value.mtime ?? entry.mtime } : entry)),
          );
          setExternalChanges((current) => {
            if (current[path] === undefined) return current;
            const next = { ...current };
            delete next[path];
            return next;
          });
          await refreshTree();
          await loadGit();
        } catch (error) {
          setEditorError(error instanceof Error ? error.message : String(error));
        }
      }, [loadGit, refreshTree]);


      /**
       * Check out one local branch and bring the editor back in sync.
       *
       * IDEA asks before switching when the working tree has changes, because a
       * checkout can carry them into the other branch or refuse outright.
       * @param {string} name - local branch name.
       */
      const checkoutBranch = React.useCallback(async (name) => {
        const dirty = (openFilesRef.current ?? []).some((file) => file.dirty === true);
        if (dirty && !window.confirm(t('editor.checkoutDirty'))) return;
        setCommitBusy(true);
        try {
          const value = await callGit({ op: 'checkout', branch: name });
          setGit(value);
          setCommitSelection(new Set((value?.changes ?? []).map((change) => change.path)));
          setDiffTarget(null);
          setExternalChanges({});
          await refreshTree();
          /* A checkout rewrites the history the Log tab is showing; leaving the old
             rows there means acting on another branch's commits. */
          setHistoryPath(null);
          await loadLog();
          setCommitNotice(t('editor.checkoutDone', { name }));
          /* A checkout can rewrite every file under the open tabs: re-read them all. */
          for (const file of openFilesRef.current) await reloadFile(file.path);
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setCommitBusy(false);
        }
      }, [loadLog, reloadFile, refreshTree, t]);

      /**
       * Open IDEA's branch popup: list local branches and check one out.
       *
       * The list is read on open (not cached) so a branch created in the terminal
       * shows up immediately; checking out one refreshes the tree because the
       * working files change under the editor.
       * @param {{x: number, y: number}} position - popup anchor in viewport coordinates.
       */
      const openBranchMenu = React.useCallback(async (position) => {
        setCommitBusy(true);
        setCommitError(null);
        try {
          const value = await callGit({ op: 'branches' });
          const names = Array.isArray(value?.branches) ? value.branches : [];
          const current = typeof value?.branch === 'string' ? value.branch : '';
          setMenu({
            owner: 'branch-menu',
            x: position?.x ?? 220,
            y: position?.y ?? 120,
            items: [
              {
                id: 'newBranch',
                label: t('editor.newBranchAction'),
                run: () => setNamePrompt({
                  kind: 'branch',
                  title: t('editor.newBranchAction'),
                  placeholder: t('editor.newBranchPlaceholder'),
                  value: '',
                  error: '',
                }),
              },
              null,
              ...(names.length === 0
                ? [{ id: 'none', label: t('editor.noBranches'), disabled: true, run: () => {} }]
                : names.map((name) => ({
                    id: `branch:${name}`,
                    label: name,
                    shortcut: name === current ? '✓' : '',
                    run: () => {
                      if (name === current) return;
                      void checkoutBranch(name);
                    },
                  }))),
            ],
          });
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setCommitBusy(false);
        }
      }, [checkoutBranch, t]);

      /**
       * Create the branch named in the prompt, then refresh everything a switch touches.
       *
       * Errors land back in the prompt instead of the Commit error bar: the user is
       * still looking at the field they have to fix, and a message in the panel
       * behind a modal reads as "nothing happened".
       * @returns {Promise<void>} resolves once the branch exists or the error is shown.
       */
      const submitNamePrompt = React.useCallback(async () => {
        if (namePrompt === null) return;
        const name = namePrompt.value.trim();
        if (name === '') return;
        setCommitBusy(true);
        try {
          if (namePrompt.kind === 'tag') {
            /* A tag moves no HEAD and rewrites no file: only the graph's ref list
               changes, so the tree and open tabs stay untouched. */
            const tagValue = await callGit({ op: 'createTag', name, hash: namePrompt.hash });
            setGit((current) => (current === null ? current : { ...current, ...tagValue }));
            setNamePrompt(null);
            setCommitNotice(t('editor.tagCreated', { name: tagValue?.tag ?? name }));
            if (graph !== null) await loadGraph(graph.branch ?? '', graph.at ?? '');
            return;
          }
          const value = await callGit({
            op: 'createBranch',
            name,
            ...(typeof namePrompt.hash === 'string' && namePrompt.hash !== '' ? { startPoint: namePrompt.hash } : {}),
          });
          setGit(value);
          setCommitSelection(new Set((value?.changes ?? []).map((change) => change.path)));
          setDiffTarget(null);
          setExternalChanges({});
          await refreshTree();
          setHistoryPath(null);
          await loadLog();
          setNamePrompt(null);
          setCommitNotice(t('editor.branchCreated', { name: value?.created ?? name }));
          for (const file of openFilesRef.current) await reloadFile(file.path);
        } catch (failure) {
          const message = failure instanceof Error ? failure.message : String(failure);
          setNamePrompt((current) => (current === null ? current : { ...current, error: message }));
        } finally {
          setCommitBusy(false);
        }
      }, [graph, loadGraph, loadLog, namePrompt, reloadFile, refreshTree, t]);

      /**
       * Run one stash operation and bring the changes list back in sync.
       *
       * Stashing is the one action that empties the panel on purpose, so the
       * selection is rebuilt from the fresh status instead of being left stale.
       * @param {'save'|'pop'} operation - stash action.
       */
      const runStash = React.useCallback(async (operation, ref) => {
        if (operation === 'pop' && !window.confirm(t('editor.stashPopConfirm'))) return;
        if (operation === 'drop' && !window.confirm(t('editor.stashDropConfirm', { ref: ref ?? '' }))) return;
        setCommitBusy(true);
        setCommitError(null);
        setCommitNotice(null);
        try {
          const value = await callGit({ op: 'stash', action: operation, ...(ref === undefined ? {} : { ref }) });
          setGit(value);
          setCommitSelection(new Set((value?.changes ?? []).map((change) => change.path)));
          setDiffTarget(null);
          setCommitNotice(
            operation === 'save'
              ? t('editor.stashed')
              : operation === 'apply'
                ? t('editor.stashApplied', { ref: ref ?? '' })
                : operation === 'drop'
                  ? t('editor.stashDropped', { ref: ref ?? '' })
                  : t('editor.stashPopped'),
          );
          await refreshTree();
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setCommitBusy(false);
        }
      }, [refreshTree, t]);

      /**
       * Run a shelf operation and refresh the same views as a stash operation.
       * @param {'save'|'apply'|'drop'} operation - shelf action.
       * @param {string} [ref] - shelf ref for apply/drop.
       * @param {string[]} [paths] - selected paths for save.
       * @returns {Promise<void>} resolves after the panel catches up.
       */
      const runShelve = React.useCallback(async (operation, ref, paths) => {
        if (operation === 'drop' && !window.confirm(t('editor.shelveConfirmDrop', { ref: ref ?? '' }))) return;
        setCommitBusy(true);
        setCommitError(null);
        setCommitNotice(null);
        try {
          const value = await callGit({
            op: 'shelve',
            action: operation,
            ...(Array.isArray(paths) ? { paths } : {}),
            ...(ref === undefined ? {} : { ref }),
          });
          setGit(value);
          setCommitSelection(new Set((value?.changes ?? []).map((change) => change.path)));
          setDiffTarget(null);
          setCommitNotice(
            operation === 'save'
              ? t('editor.shelved', { count: paths?.length ?? 0 })
              : operation === 'apply'
                ? t('editor.shelveApplied', { ref: ref ?? '' })
                : t('editor.shelveDropped', { ref: ref ?? '' }),
          );
          await refreshTree();
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setCommitBusy(false);
        }
      }, [refreshTree, t]);

      /**
       * Open IDEA's stash menu: save the working tree, or pop the newest entry.
       *
       * The list is read on open so the "pop" row can name which stash it will
       * restore, and stays disabled when the stack is empty.
       * @param {{x: number, y: number}} position - popup anchor in viewport coordinates.
       */
      const openStashMenu = React.useCallback(async (position) => {
        setCommitBusy(true);
        setCommitError(null);
        try {
          const value = await callGit({ op: 'stash', action: 'list' });
          const entries = Array.isArray(value?.entries) ? value.entries : [];
          const newest = entries[0];
          setMenu({
            x: position?.x ?? 240,
            y: position?.y ?? 120,
            items: [
              {
                id: 'save',
                label: t('editor.stashSave'),
                disabled: (git?.changes ?? []).length === 0,
                run: () => void runStash('save'),
              },
              {
                id: 'pop',
                label: newest === undefined ? t('editor.stashEmpty') : t('editor.stashPop', { subject: newest.subject }),
                disabled: newest === undefined,
                run: () => void runStash('pop'),
              },
              /* IDEA lists the stack: applying keeps the entry (pop drops it), and a
                 drop is the only way to throw one away without touching the tree. */
              ...(entries.length === 0
                ? []
                : [null, ...entries.flatMap((entry) => [
                    {
                      id: `apply:${entry.ref}`,
                      label: t('editor.stashApply', { ref: entry.ref, subject: entry.subject }),
                      run: () => void runStash('apply', entry.ref),
                    },
                    {
                      id: `drop:${entry.ref}`,
                      label: t('editor.stashDrop', { ref: entry.ref }),
                      danger: true,
                      run: () => void runStash('drop', entry.ref),
                    },
                  ])]),
            ],
          });
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setCommitBusy(false);
        }
      }, [git, runStash, t]);

      /**
       * IDEA's Shelve Silently: shelf exactly the ticked changes, then offer the
       * saved shelves for restore/delete.
       *
       * A shelf is index-aware (`git stash apply --index`), unlike the ordinary
       * stash menu's whole-tree save. The selected paths are the commit checkboxes,
       * so shelving never sweeps unrelated work out of the tree.
       * @param {{x: number, y: number}} position - popup anchor in viewport coordinates.
       * @returns {Promise<void>} resolves once the menu is populated.
       */
      const openShelveMenu = React.useCallback(async (position) => {
        setCommitBusy(true);
        setCommitError(null);
        try {
          const value = await callGit({ op: 'shelve', action: 'list' });
          const entries = Array.isArray(value?.entries) ? value.entries : [];
          const selected = [...commitSelection];
          setMenu({
            x: position?.x ?? 240,
            y: position?.y ?? 120,
            items: [
              {
                id: 'shelveSave',
                label: t('editor.shelveSave'),
                disabled: selected.length === 0,
                run: () => void runShelve('save', undefined, selected),
              },
              ...(entries.length === 0
                ? [{ id: 'empty', label: t('editor.shelveEmpty'), disabled: true, run: () => {} }]
                : [null, ...entries.flatMap((entry) => [
                    {
                      id: `shelveApply:${entry.ref}`,
                      label: t('editor.stashApply', { ref: entry.ref, subject: entry.subject }),
                      run: () => void runShelve('apply', entry.ref),
                    },
                    {
                      id: `shelveDrop:${entry.ref}`,
                      label: t('editor.stashDrop', { ref: entry.ref }),
                      danger: true,
                      run: () => void runShelve('drop', entry.ref),
                    },
                  ])]),
            ],
          });
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setCommitBusy(false);
        }
      }, [commitSelection, runShelve, t]);

      /* Batch delete for the Project tool window's multi-row selection. */
      /**
       * Open tabs below one path that still hold unsaved edits.
       *
       * IDEA's delete dialog names them: deleting a directory silently throws away
       * the editor's copy of every dirty file under it, and "cannot be undone" does
       * not tell you WHAT is being lost.
       * @param {string} path - file or directory path being deleted.
       * @returns {string[]} workspace-relative paths with unsaved edits.
       */
      const dirtyUnder = React.useCallback((path) => {
        if (typeof path !== 'string') return [];
        return (openFilesRef.current ?? [])
          .filter((file) => file.dirty === true && (file.path === path || file.path.startsWith(`${path}/`)))
          .map((file) => file.path);
      }, []);

      const removeEntries = React.useCallback(
        async (paths) => {
          const targets = paths.filter((path) => path !== '');
          if (targets.length === 0) return;
          if (!window.confirm(t('editor.deleteSelectedConfirm', { count: targets.length }))) return;
          /* Name the unsaved tabs first: they are what the delete actually destroys. */
          const unsaved = targets.flatMap((path) => dirtyUnder(path));
          if (unsaved.length > 0 && !window.confirm(t('editor.deleteDirty', { count: unsaved.length, files: unsaved.join(', ') }))) return;
          setCommitBusy(true);
          try {
            for (const path of targets) {
              /* Deleting a parent first would make its children vanish from under us. */
              await callFs({ op: 'delete', path }).catch(() => {});
            }
            await refreshTree();
            await loadGit();
            setSelection(new Set());
            setSelectedPath(null);
            const active = activePathRef.current;
            if (active !== null && targets.some((path) => active === path || active.startsWith(`${path}/`))) closeFile(active);
          } catch (failure) {
            setTreeError(failure instanceof Error ? failure.message : String(failure));
          } finally {
            setCommitBusy(false);
          }
        },
        [closeFile, dirtyUnder, loadGit, refreshTree, setSelectedPath, t],
      );

      /* Delete one entry after confirmation, then refresh the tree and git status. */
      const removeEntry = React.useCallback(
        async (row) => {
          const label = row.path === '' ? projectName : row.path;
          if (!window.confirm(t('editor.deleteConfirm', { path: label }))) return;
          const unsaved = dirtyUnder(row.path);
          if (unsaved.length > 0 && !window.confirm(t('editor.deleteDirty', { count: unsaved.length, files: unsaved.join(', ') }))) return;
          try {
            await callFs({ op: 'delete', path: row.path });
            await refreshTree();
            await loadGit();
            setSelectedPath(null);
            if (activePathRef.current !== null && (activePathRef.current === row.path || activePathRef.current.startsWith(`${row.path}/`))) {
              closeFile(activePathRef.current);
            }
          } catch (failure) {
            setTreeError(failure instanceof Error ? failure.message : String(failure));
          }
        },
        [closeFile, dirtyUnder, loadGit, projectName, refreshTree, t],
      );

      /**
       * Compare each open tab's recorded mtime with the file on disk.
       *
       * IDEA reloads a clean file silently and only asks when the editor holds
       * unsaved work, so a clean tab adopts the new content and a dirty tab gets
       * the banner. A file that vanished stays listed so the banner can say so.
       * @returns {Promise<void>} resolves once every open tab has been checked.
       */
      const checkExternalChanges = React.useCallback(async () => {
        const open = openFilesRef.current.filter((file) => file.mtime !== null && file.mtime !== undefined);
        if (open.length === 0) return;
        let described;
        try {
          described = await callFs({ op: 'exists', paths: open.map((file) => file.path) });
        } catch {
          return;
        }
        const findings = {};
        for (const entry of described ?? []) {
          const current = open.find((file) => file.path === entry.path);
          if (current === undefined) continue;
          if (entry.exists !== true) {
            findings[current.path] = { missing: true, diskMtime: null };
            continue;
          }
          /* mtime is the cheap signal; an unchanged file costs nothing further. */
          if (typeof entry.mtime === 'number' && Math.abs(entry.mtime - current.mtime) <= 1) continue;
          findings[current.path] = { missing: false, diskMtime: entry.mtime ?? null };
        }
        const paths = Object.keys(findings);
        if (paths.length === 0) {
          setExternalChanges((current) => (Object.keys(current).length === 0 ? current : {}));
          return;
        }
        /* A clean tab silently adopts the disk version; only unsaved work needs a prompt. */
        const clean = paths.filter((path) => openFilesRef.current.find((file) => file.path === path)?.dirty !== true);
        for (const path of clean) {
          try {
            const value = await callFs({ op: 'read', path });
            const model = modelsRef.current.get(path);
            if (model !== undefined) {
              /* Replace content without marking the model dirty. */
              silentReloadRef.current.add(path);
              try {
                model.setValue(value.content);
                model.pushStackElement?.();
              } finally {
                silentReloadRef.current.delete(path);
              }
            }
            setOpenFiles((list) =>
              list.map((entry) => (entry.path === path ? { ...entry, content: value.content, dirty: false, mtime: value.mtime ?? entry.mtime } : entry)),
            );
            delete findings[path];
          } catch {
            /* an unreadable file keeps its banner instead of silently vanishing */
          }
        }
        setExternalChanges(findings);
      }, []);

      /**
       * Follow the workspace's real filesystem changes (SSE from the host).
       *
       * The 4-second git-signature poll this replaces had three faults: it missed
       * changes for up to 4s, it re-read the WHOLE tree on any change (which is
       * what made the list flash), and it never fired at all outside a repository.
       * The host now watches the directory tree and reports which directories
       * changed, so only those listings are re-read; unchanged ones keep their
       * array identity and re-render nothing.
       */
      React.useEffect(() => {
        if (root === '') return undefined;
        const sessionId = currentSessionId();
        if (sessionId === '' && workspaceId === '') return undefined;
        const controller = new AbortController();
        let disposed = false;
        let chain = Promise.resolve();
        const handle = (event) => {
          if (disposed) return;
          if (event.type === 'change') {
            const dirs = Array.isArray(event.dirs) ? event.dirs : null;
            /* Serialize: two overlapping refreshes would interleave their state
               writes and one could resurrect a listing the other just dropped. */
            chain = chain
              .then(async () => {
                if (disposed) return;
                /* The watcher names the directories that changed; without that hint
                   only the root is re-read. */
                await refreshTree(dirs === null ? undefined : dirs);
                await loadGit();
                await checkExternalChanges();
              })
              .catch(() => {
                /* a Session that went away mid-refresh just stops reporting */
              });
            return;
          }
          if (event.type === 'error') {
            /* The watcher is best-effort: keep the tree usable without it. */
            console.warn('dsh-editor: file watch failed', event.message);
          }
        };
        const url = `api/dsh-editor/watch?sessionId=${encodeURIComponent(sessionId)}&workspaceId=${encodeURIComponent(workspaceId)}`;
        fetch(url, { signal: controller.signal, headers: { accept: 'text/event-stream' } })
          .then((response) => {
            if (!response.ok) throw new Error(`file watch HTTP ${response.status}`);
            return readEventStream(response, handle, controller.signal);
          })
          .catch((failure) => {
            if (controller.signal.aborted || disposed) return;
            console.warn('dsh-editor: file watch disconnected', failure instanceof Error ? failure.message : String(failure));
          });
        return () => {
          disposed = true;
          controller.abort();
        };
      }, [checkExternalChanges, loadGit, refreshTree, root, workspaceId]);

      /* Notice edits made outside the editor (another window, a shell, an agent).
         A slow backstop for the watcher: it still catches what `fs.watch` misses
         (network mounts, editors that swap the inode) and keeps git status fresh
         even when the filesystem is quiet. */
      const signatureRef = React.useRef('');
      const pollingRef = React.useRef(false);
      React.useEffect(() => {
        const interval = window.setInterval(async () => {
          if (pollingRef.current || document.visibilityState === 'hidden') return;
          pollingRef.current = true;
          try {
            const value = await callGit({ op: 'signature' });
            const signature = value?.signature ?? '';
            if (signature === '') return;
            if (signatureRef.current === '') {
              signatureRef.current = signature;
              return;
            }
            if (signature === signatureRef.current) return;
            signatureRef.current = signature;
            await loadGit();
            await refreshTree();
            await checkExternalChanges();
          } catch {
            /* a workspace that is not a repository has nothing to poll */
          } finally {
            pollingRef.current = false;
          }
        }, 8000);
        return () => window.clearInterval(interval);
      }, [checkExternalChanges, loadGit, refreshTree]);

      const applySortMode = React.useCallback((next) => {
        setSortMode(next);
        try {
          window.localStorage.setItem('dsh-editor.project.sort', next);
        } catch {
          /* a storage-less browser keeps the in-memory mode */
        }
      }, []);

      /* Cycle IDEA's Project sort actions in their menu order. */
      const cycleSort = React.useCallback(() => {
        setSortMode((current) => {
          const order = ['name', 'type', 'modified', 'modified-asc', 'manual'];
          const next = order[(order.indexOf(current) + 1) % order.length];
          try {
            window.localStorage.setItem('dsh-editor.project.sort', next);
          } catch {
            /* a storage-less browser keeps the in-memory mode */
          }
          return next;
        });
      }, []);

      /**
       * Reorder siblings for IDEA Manual Order without touching the filesystem.
       * Cross-directory drops are intentionally ignored: manual ranks are stored
       * per parent, so accepting a foreign child would fabricate a tree edge.
       */
      const reorderManualProject = React.useCallback((sources, target, edge) => {
        if (sortMode !== 'manual' || typeof target !== 'string' || target === '') return;
        const parent = dirname(target);
        const listing = parent === '' ? entries : children[parent];
        if (!Array.isArray(listing)) return;
        const siblings = new Set(listing.map((entry) => entry.path));
        const moving = (Array.isArray(sources) ? sources : []).filter((path) =>
          siblings.has(path) && dirname(path) === parent);
        if (moving.length === 0) {
          flashStatus(t('editor.manualOrderSameDirectory'));
          return;
        }
        setManualOrder((current) => {
          const ordered = orderProjectEntriesByManual(listing, current[parent]);
          const paths = reorderProjectManualPaths(
            ordered.map((entry) => entry.path),
            moving,
            target,
            edge === 'after' ? 'after' : 'before',
          );
          const next = { ...current, [parent]: paths };
          writeProjectManualOrder(root, next);
          return next;
        });
      }, [children, entries, flashStatus, root, sortMode, t]);

      /**
       * Keep the selected row on screen across a re-sort.
       *
       * Changing the order re-reads the root, and the selected file lands wherever
       * the new order puts it — often below the fold. IDEA keeps the row you were
       * on visible, so the tree is scrolled back to it once the new listing has
       * rendered (the row may not exist for a frame, hence the bounded retry).
       * @returns {void}
       */
      React.useEffect(() => {
        if (sortAppliedRef.current === '') {
          sortAppliedRef.current = sortMode;
          return;
        }
        if (sortAppliedRef.current === sortMode) return;
        sortAppliedRef.current = sortMode;
        const path = selectedPathRef.current;
        if (path === null || path === '') return;
        let tries = 0;
        const tick = () => {
          const row = rowRefs.current.get(path);
          if (row !== undefined) {
            row.scrollIntoView({ block: 'nearest' });
            return;
          }
          tries += 1;
          if (tries < 20) window.requestAnimationFrame(tick);
        };
        window.requestAnimationFrame(tick);
      }, [sortMode]);

      /**
       * Flip IDEA's "Autoscroll from Source" and remember the choice.
       *
       * Turning it ON takes effect immediately (the effect re-runs on the new
       * value), so the tree jumps to the open file without a second click.
       * @returns {void}
       */
      const toggleAutoScroll = React.useCallback(() => {
        setAutoScroll((current) => {
          const next = !current;
          try {
            window.localStorage.setItem('dsh-editor.project.autoscroll', next ? '1' : '0');
          } catch {
            /* a storage-less browser keeps the in-memory choice */
          }
          return next;
        });
      }, []);

      /**
       * Toggle IDEA's "Open Files with Single Click" Project View preference.
       *
       * The choice is application-wide, like IntelliJ's Project View option; it
       * is not keyed by workspace. Directory rows keep their own expand gesture.
       * @returns {void}
       */
      const toggleSingleClickOpen = React.useCallback(() => {
        setSingleClickOpen((current) => {
          const next = !current;
          try {
            window.localStorage.setItem('dsh-editor.project.singleClickOpen', next ? '1' : '0');
            window.localStorage.removeItem('dsh-editor.project.autoscrollToSource');
          } catch {
            /* a storage-less browser keeps the in-memory choice */
          }
          return next;
        });
      }, []);

      const toggleOpenDirectoriesSingleClick = React.useCallback(() => {
        setOpenDirectoriesSingleClick((current) => {
          const next = !current;
          try {
            window.localStorage.setItem('dsh-editor.project.openDirectoriesSingleClick', next ? '1' : '0');
          } catch {
            /* a storage-less browser keeps the in-memory choice */
          }
          return next;
        });
      }, []);

      const togglePreviewTab = React.useCallback(() => {
        setPreviewTabEnabled((current) => {
          const next = !current;
          try {
            window.localStorage.setItem('dsh-editor.project.previewTab', next ? '1' : '0');
          } catch {
            /* a storage-less browser keeps the in-memory choice */
          }
          return next;
        });
      }, []);

      const toggleFoldersFirst = React.useCallback(() => {
        const next = !foldersFirstRef.current;
        foldersFirstRef.current = next;
        setFoldersFirst(next);
        try {
          window.localStorage.setItem('dsh-editor.project.foldersFirst', next ? '1' : '0');
        } catch {
          /* a storage-less browser keeps the in-memory choice */
        }
        /* Apply immediately with the explicit next value; the state effect will
           later keep handling external preference changes/dependency refreshes. */
        void loadRoot(next);
      }, [loadRoot]);

      const toggleCompactDirectories = React.useCallback(() => {
        setCompactDirectories((current) => {
          const next = !current;
          try {
            window.localStorage.setItem('dsh-editor.project.compactDirectories', next ? '1' : '0');
          } catch {
            /* a storage-less browser keeps the in-memory choice */
          }
          return next;
        });
      }, []);

      const toggleShowExcludedFiles = React.useCallback(() => {
        setShowExcludedFiles((current) => {
          const next = !current;
          try {
            window.localStorage.setItem('dsh-editor.project.showExcludedFiles', next ? '1' : '0');
          } catch {
            /* a storage-less browser keeps the in-memory choice */
          }
          return next;
        });
      }, []);

      /* Start the inline create row in the selected directory. */
      const startCreate = React.useCallback(
        (kind, explicitParent) => {
          let parent = typeof explicitParent === 'string' ? explicitParent : '';
          if (typeof explicitParent !== 'string') {
            const selected = selectedPath;
            if (selected !== null && selected !== '') {
              const row = rows.find((entry) => entry.path === selected);
              parent = row?.kind === 'directory' ? selected : dirname(selected);
            }
          }
          setActivity('project');
          setPanelVisible(true);
          /* Templates are on by default, like IDEA's New-from-Template dialog. */
          setCreateState({ kind, parent, value: '', template: true });
        },
        [rows, selectedPath],
      );

      const createEntry = React.useCallback(async () => {
        if (createState === null) return;
        const name = createState.value.trim();
        if (name === '' || name.includes('/') || name === '.' || name === '..') {
          setTreeError(t('editor.invalidNameNoSlashes'));
          return;
        }
        const path = createState.parent === '' ? name : `${createState.parent}/${name}`;
        try {
          await callFs({ op: 'create', path, kind: createState.kind });
          /* IDEA's "New from Template": a named file gets the language's skeleton
             instead of a zero-byte file. The host creates first and the content
             follows, so a template failure cannot leave no file at all. Only when
             the user kept the toggle on (it is on by default, as in IDEA). */
          if (createState.kind === 'file' && createState.template !== false) {
            const skeleton = templateFor(name);
            if (skeleton !== '') {
              await callFs({ op: 'write', path, content: skeleton, force: true, create: true }).catch(() => {});
            }
          }
          const value = await callFs({ op: 'list', path: createState.parent, showHidden, sort: sortMode, foldersFirst, showExcluded: showExcludedFiles });
          if (createState.parent === '') setEntries(value.entries ?? []);
          else setChildren((current) => ({ ...current, [createState.parent]: value.entries ?? [] }));
          setExpanded((current) => {
            const next = new Set(current);
            next.add(createState.parent);
            return next;
          });
          setSelectedPath(path);
          setCreateState(null);
          setTreeError(null);
          /* IDEA drops straight into "rename" on a freshly created entry. */
          setRenameState({ path, value: name, fresh: true });
          if (createState.kind === 'file') await openFile(path);
        } catch (error) {
          setTreeError(error instanceof Error ? error.message : String(error));
        }
      }, [createState, foldersFirst, openFile, showExcludedFiles, showHidden, sortMode, t]);

      /* IDEA's "Reveal in Finder": hand the absolute path to the platform file manager. */
      const revealInFinder = React.useCallback(async (path) => {
        try {
          await callFs({ op: 'reveal', path });
        } catch (failure) {
          setTreeError(failure instanceof Error ? failure.message : String(failure));
        }
      }, []);

      /**
       * IDEA's "Open in Terminal": reveal the dock and start a shell in that directory.
       *
       * The dock only knows the Session workspace, so a subdirectory is reached by
       * committing `cd <relative>` to the new shell — the same thing a user does.
       * @param {string} relativeDirectory - workspace-relative directory to enter.
       */
      const openInTerminal = React.useCallback(
        (relativeDirectory) => {
          pendingTerminalPath.current = relativeDirectory;
          setTerminalStartDirectory(relativeDirectory);
          setTerminalOpen(true);
          setTerminalGeneration((generation) => generation + 1);
        },
        [],
      );



      const restage = React.useCallback(
        async (paths, staged) => {
          if (paths.length === 0) return false;
          setCommitBusy(true);
          setCommitError(null);
          try {
            const value = await callGit({ op: 'stage', paths, staged });
            setGit(value);
            setCommitSelection((current) => {
              const next = new Set([...current].filter((path) => (value?.changes ?? []).some((change) => change.path === path)));
              return next;
            });
            setDiffTarget(null);
            return true;
          } catch (failure) {
            setCommitError(failure instanceof Error ? failure.message : String(failure));
            return false;
          } finally {
            setCommitBusy(false);
          }
        },
        [],
      );
      /* The ⌘⇧A/⌥⌘A handler is registered once, so it reaches the stager by ref. */
      restageRef.current = restage;

      /**
       * Stage every working-side change, with an optional tracked-only scope.
       *
       * IDEA's Stage All is a deliberate "include all" action. Keep those paths
       * ticked for the next commit instead of staging them while leaving the
       * commit box empty, which would make the command appear to do nothing.
       * @param {boolean} [trackedOnly=false] - skip untracked files.
       * @returns {Promise<void>} resolves after the index and selection settle.
       */
      const stageEveryChange = React.useCallback(async (trackedOnly = false) => {
        const paths = stageAllTargets(git?.changes ?? [], trackedOnly === true);
        if (paths.length === 0) return;
        const staged = await restage(paths, false);
        if (!staged) return;
        setCommitSelection((current) => new Set([...current, ...paths]));
      }, [git, restage]);

      /**
       * Apply a Group by choice and keep the current Change row visible.
       *
       * A key collapsed in the old grouping can still fold the selected file in
       * the new tree. Clear every group/ancestor key for that file, then restore
       * keyboard focus so Show Diff and the row shortcuts keep the same target.
       * @param {'flat'|'module'|'directory'} mode - chosen grouping.
       * @returns {void}
       */
      const applyChangeGroupBy = React.useCallback((mode) => {
        setGroupBy(mode);
        try {
          window.localStorage.setItem('dsh-editor.commit.groupBy', mode);
        } catch {
          /* a storage-less browser keeps the in-memory mode */
        }
        const selected = selectedChangeRef.current;
        if (selected === null) return;
        groupByFocusRef.current = { path: selected.path, staged: selected.staged === true };
        revealChangeRow(selected);
      }, [revealChangeRow]);

      /**
       * The "Group by" menu: flat, module, or the full directory tree.
       *
       * IDEA puts this next to the change list, and the choice is a view
       * preference — it never changes what gets committed, only how the rows are
       * nested. The current mode carries a check mark so the popup says where
       * you are as well as where you can go.
       * @param {{x: number, y: number}} position - where to open the popup.
       * @returns {object} menu descriptor for the shared popup.
       */
      const changeGroupMenu = React.useCallback((position) => ({
        x: position.x,
        y: position.y,
        title: t('editor.groupByMenu'),
        items: ['flat', 'module', 'directory'].map((mode) => ({
          id: `groupBy:${mode}`,
          label: t(`editor.groupBy_${mode}`),
          shortcut: groupBy === mode ? '✓' : '',
          restoreFocus: false,
          run: () => applyChangeGroupBy(mode),
        })),
      }), [applyChangeGroupBy, groupBy, t]);

      /**
       * IDEA's Changes "View Options" entry.
       *
       * The available view preference is Group by. Reuse the same value menu as
       * Commit Options so the two entry points cannot drift.
       * @param {{x: number, y: number}} position - toolbar anchor.
       * @returns {void}
       */
      const openChangesViewMenu = React.useCallback((position) => {
        const groupMenu = changeGroupMenu(position);
        setMenu({
          owner: 'changes-view-options',
          x: position?.x ?? 240,
          y: position?.y ?? 120,
          title: t('editor.viewOptions'),
          items: [
            {
              id: 'groupBy',
              label: t('editor.groupByMenu'),
              items: groupMenu.items,
            },
          ],
        });
      }, [changeGroupMenu, t]);

      /**
       * Open IDEA's "Move to…" picker for the current tree selection.
       *
       * The picker asks the host for every directory: building the list from the
       * expanded rows would hide any folder the user has not opened, which is
       * exactly the folder a move usually targets.
       * @param {string|string[]} [target] - one path or a batch; defaults to the selection.
       * @returns {Promise<void>} resolves once the picker is on screen.
       */
      const openMoveTo = React.useCallback(async (target) => {
        const raw = Array.isArray(target) ? target : target === undefined ? [...selection] : [target];
        /* The root row is a directory but moving the root into itself is meaningless. */
        const sources = raw.filter((path) => typeof path === 'string' && path !== '');
        if (sources.length === 0) return;
        const parent = sources.length === 1 ? dirname(sources[0]) : '';
        setMoveTo({ sources, parent, query: '', index: 0, loading: true, directories: [], rootName: projectName });
        try {
          const value = await callFs({ op: 'directories' });
          const directories = (value.directories ?? []).filter((path) => typeof path === 'string');
          setMoveTo((current) => (current === null ? current : { ...current, loading: false, directories }));
        } catch (failure) {
          setMoveTo(null);
          setTreeError(failure instanceof Error ? failure.message : String(failure));
        }
      }, [projectName, selection]);

      /* IDEA's project-tree context menu: new/rename/delete/reveal/copy path. */
      const buildTreeMenu = React.useCallback(
        ({ row, x, y }) => {
          const isDirectory = row.kind === 'directory';
          const isRoot = row.path === '';
          /* Where a NEW entry lands: beside the clicked entry, which is inside a
             clicked directory and next to a clicked file. Rename cannot reuse this
             — it keeps the entry in its own parent — so it derives its own
             destination (see `commitRename`). */
          const createParent = isDirectory ? row.path : dirname(row.path);
          /* A right-click inside a multi-row selection acts on all selected rows. */
          const selectedRows = selection.has(row.path) ? rows.filter((entry) => selection.has(entry.path) && entry.path !== '') : [];
          const batch = selectedRows.length > 1 ? selectedRows : [];
          const splitCandidates = projectRightSplitPaths(rows, selection, row.path);
          return {
            x,
            y,
            /* IDEA tells you how many rows a context action will touch. */
            title: batch.length > 1 ? t('editor.selectionCount', { count: batch.length }) : null,
            items: [
              {
                id: 'newFile',
                label: t('editor.newFile'),
                shortcut: '⌥⌘N',
                ariaKeyShortcuts: 'Alt+Meta+N Control+Alt+N',
                /* Enabled on files too: the new entry goes beside the clicked
                   one. Greying it out on a file looked like "disabled because
                   something is wrong" and forced a trip through its folder. */
                disabled: batch.length > 1,
                run: () => startCreate('file', createParent),
              },
              {
                id: 'newFolder',
                label: t('editor.newFolder'),
                disabled: batch.length > 1,
                run: () => startCreate('directory', createParent),
              },
              null,
              {
                id: 'rename',
                label: t('editor.rename'),
                shortcut: '⇧F6',
                ariaKeyShortcuts: 'Shift+F6',
                disabled: isRoot || batch.length > 1,
                run: () => setRenameState({ path: row.path, value: basename(row.path) }),
              },
              {
                id: 'moveTo',
                label: t('editor.moveTo'),
                shortcut: 'F6',
                ariaKeyShortcuts: 'F6',
                disabled: isRoot,
                /* A batch keeps its members' names, so the picker collects them all. */
                run: () => void openMoveTo(batch.length > 1 ? batch.map((entry) => entry.path) : row.path),
              },
              {
                id: 'delete',
                label: batch.length > 1 ? t('editor.deleteSelected', { count: batch.length }) : t('editor.delete'),
                shortcut: '⌫',
                ariaKeyShortcuts: 'Backspace',
                danger: true,
                disabled: isRoot,
                run: () => void (batch.length > 1 ? removeEntries(batch.map((entry) => entry.path)) : removeEntry(row)),
              },
              null,
              {
                id: 'open',
                label: isDirectory ? t('editor.expandFolder') : t('editor.openInEditor'),
                shortcut: isDirectory ? '' : 'F4',
                ariaKeyShortcuts: isDirectory ? undefined : 'F4',
                /* Multi-row selections act in bulk, so the single-row action is disabled. */
                disabled: isRoot || batch.length > 1,
                run: () => (isDirectory ? void toggleDirectory(row.path) : void openFile(row.path)),
              },
              {
                id: 'openRightSplit',
                label: t('editor.openInRightSplit'),
                disabled: isRoot || splitCandidates.length === 0,
                run: () => void openInRightSplit(splitCandidates),
              },
              {
                id: 'reveal',
                label: isDirectory
                  ? t('editor.expandFolder')
                  : filteredView === true
                    ? t('editor.revealInProject')
                    : t('editor.reveal'),
                disabled: isDirectory === false && filteredView !== true,
                run: () => {
                  if (isDirectory) {
                    setExpanded((current) => new Set([...current, row.path]));
                  } else if (filteredView === true) {
                    void revealPath(row.path);
                  }
                },
              },
              {
                id: 'openTerminal',
                label: t('editor.openInTerminal'),
                run: () => void openInTerminal(isDirectory ? row.path : dirname(row.path)),
              },
              {
                id: 'refresh',
                label: t('editor.refresh'),
                shortcut: '⌘R',
                ariaKeyShortcuts: 'Meta+R Control+R',
                run: () => void refreshTree(),
              },
              {
                id: 'revealFinder',
                label: t('editor.revealInFinder'),
                run: () => void revealInFinder(row.path),
              },
              {
                id: 'history',
                label: t('editor.showHistory'),
                disabled: isRoot,
                run: () => void showFileHistory(row.path),
              },
              {
                id: 'compareClipboard',
                label: t('editor.compareWithClipboard'),
                disabled: isRoot || isDirectory,
                run: () => void compareWithClipboard(row.path),
              },
              {
                id: 'compareRevision',
                label: t('editor.compareWithRevision'),
                disabled: isRoot || isDirectory,
                run: () => void compareWithRevision(row.path),
              },
              {
                id: 'stageHere',
                label: t('editor.stageThisDirectory'),
                disabled: isRoot || !isDirectory || (git?.changes ?? []).length === 0,
                run: () => {
                  const inside = (git?.changes ?? []).filter((change) => change.path === row.path || change.path.startsWith(`${row.path}/`)).map((change) => change.path);
                  if (inside.length > 0) void restage(inside, false);
                },
              },
              {
                id: 'unstageHere',
                label: t('editor.unstageThisDirectory'),
                disabled: isRoot || !isDirectory || (git?.changes ?? []).length === 0,
                run: () => {
                  const inside = (git?.changes ?? []).filter((change) => (change.path === row.path || change.path.startsWith(`${row.path}/`)) && change.staged === true).map((change) => change.path);
                  if (inside.length > 0) void restage(inside, true);
                },
              },
              null,
              {
                id: 'copyReference',
                label: t('editor.copyPathReference'),
                items: copyReferenceMenuItems({
                  entries: batch.length > 1 ? batch : [{ path: row.path, isDirectory }],
                  root,
                  t,
                  editor: currentCodeEditor(),
                  editorPath: currentCodePath(),
                  writeText: (value) => navigator.clipboard?.writeText(value),
                }),
              },
            ],
          };
        },
        [compareWithClipboard, compareWithRevision, currentCodeEditor, currentCodePath, filteredView, git, openFile, openInRightSplit, openInTerminal, openMoveTo, refreshTree, removeEntries, removeEntry, restage, revealInFinder, revealPath, root, rows, selection, showFileHistory, startCreate, t, toggleDirectory],
      );
      /* Move one entry into a directory by drag-and-drop, reusing the rename endpoint. */
      const moveEntry = React.useCallback(
        async (source, targetDirectory) => {
          /* A multi-row drag arrives as a list; a single row drag as one string. */
          const sources = (Array.isArray(source) ? source : [source]).filter((entry) => typeof entry === 'string' && entry !== '');
          if (sources.length === 0) return;
          /* Plan the whole selection first: a destination that already exists (or
             a batch whose members share a basename) is refused BEFORE the first
             rename, so a failed drag never leaves the tree half-moved.
             The candidate destinations are ASKED OF THE HOST, not read off the
             visible rows: a collapsed directory's children are not in `rows`, and
             a collision with one of them used to slip through and silently
             overwrite the file. */
          const candidate = sources
            .filter((entry) => !(targetDirectory === entry || targetDirectory.startsWith(`${entry}/`)))
            .map((entry) => (targetDirectory === '' ? basename(entry) : `${targetDirectory}/${basename(entry)}`));
          const described = candidate.length === 0
            ? []
            : await callFs({ op: 'exists', paths: candidate }).catch(() => []);
          const taken = new Set((described ?? []).filter((entry) => entry.exists === true).map((entry) => entry.path));
          const existing = new Set([...rows.map((row) => row.path), ...taken]);
          const plan = planMoves(sources, targetDirectory, existing);
          if (plan.moves.length === 0) {
            if (plan.intoSelf.length > 0) setTreeError(t('editor.moveIntoSelf'));
            else if (plan.conflicts.length > 0) setTreeError(t('editor.moveConflict', { path: plan.conflicts[0].to }));
            return;
          }
          const moved = {};
          try {
            for (const move of plan.moves) {
              await callFs({ op: 'rename', path: move.from, to: move.to });
              moved[move.from] = move.to;
            }
            const entries = Object.entries(moved);
            if (entries.length === 0) return;
            /* The refusal sentence names what DID move; built once, shown after
               the refresh (which clears `treeError`). */
            const summary = describeMoveResult({ moved: entries.map(([, to]) => to), conflicts: plan.conflicts, target: targetDirectory });
            const moveNotice = summary === null
              ? null
              : summary.blocked === undefined
                /* A clean move still needs an acknowledgement: silence reads like a no-op. */
                ? t('editor.movedCount', { count: summary.done, target: summary.target === '' ? t('editor.projectRoot') : summary.target })
                : describeMoved(entries.map(([, to]) => to), summary.blocked, t);
            /* Open tabs, previews, comparisons and Models follow their files. */
            remapEditorPaths(entries);
            setSelection(new Set(entries.map(([, to]) => to)));
            setSelectedPathRaw(entries[entries.length - 1][1]);
            await refreshTree();
            await loadGit();
            /* After the refresh, not before: `refreshTree` reloads the root and
               that reload clears `treeError`, so a message set first was wiped
               before it could be read. */
            setTreeError(moveNotice);
          } catch (failure) {
            setTreeError(failure instanceof Error ? failure.message : String(failure));
          }
        },
        [loadGit, refreshTree, remapEditorPaths, rows, t],
      );

      /* Resolve one conflicted file by taking ours/theirs, then refresh the change list. */
      const resolveConflict = React.useCallback(
        async (paths, side) => {
          if (paths.length === 0) return;
          const resolvedPaths = new Set(paths);
          setCommitBusy(true);
          setCommitError(null);
          try {
            const value = await callGit({ op: 'resolve', paths, side });
            setGit(value);
            const next = (value?.changes ?? []).find((change) => resolvedPaths.has(change.path));
            const staged = next !== undefined
              && next.status[0] !== ' ' && next.status[0] !== '?';
            if (next !== undefined && staged) {
              setSelectedChange({ path: next.path, staged });
              setSelectedChanges(new Set([`${staged ? 'staged' : 'unstaged'}:${next.path}`]));
              const key = `${staged ? 'staged' : 'unstaged'}:${next.path}`;
              selectedChangesRef.current = new Set([key]);
              changeSelectionAnchorRef.current = { key };
            }
            setDiffTarget(null);
            await refreshTree();
            if (next !== undefined && staged) {
              const key = `staged:${next.path}`;
              window.setTimeout(() => {
                const row = changeRowRefs.current.get(key);
                if (row?.isConnected !== true) return;
                row.focus?.();
              }, 0);
            }
          } catch (failure) {
            setCommitError(failure instanceof Error ? failure.message : String(failure));
          } finally {
            setCommitBusy(false);
          }
        },
        [refreshTree],
      );

      /* IDEA's change-list menu: show diff, stage/unstage, roll back the working-tree edits. */
      /**
       * Apply one history rewrite action and bring the panel back in sync.
       *
       * A stopped cherry-pick or revert leaves the repository mid-operation, so
       * the failure stays visible as an error with git's own first line instead
       * of being reported as a generic success.
       * @param {'cherryPick'|'revert'} operation - git action to run.
       * @param {string} hash - commit to act on.
       */
      /**
       * Check out one commit (IDEA's "Checkout Revision").
       *
       * Detached HEAD is destructive-looking but reversible, so it asks once and then
       * refreshes both the tree and the graph — the working tree contents change.
       * @param {string} hash - commit to check out.
       * @returns {Promise<void>} resolves when the refresh finishes.
       */
      const checkoutRevision = React.useCallback(async (hash) => {
        if (typeof hash !== 'string' || hash === '') return;
        if (!window.confirm(t('editor.checkoutRevisionConfirm', { hash: hash.slice(0, 7) }))) return;
        setCommitBusy(true);
        setCommitError(null);
        setCommitNotice(null);
        try {
          const value = await callGit({ op: 'checkoutRevision', hash });
          setGit(value);
          setCommitSelection(new Set());
          setDiffTarget(null);
          setCommitNotice(t('editor.checkoutRevisionDone', { hash: hash.slice(0, 7) }));
          await refreshTree();
          await loadLog();
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setCommitBusy(false);
        }
      }, [loadLog, refreshTree, t]);

      /**
       * Reset the active branch to one log row using Git's soft/mixed/hard modes.
       * Hard reset is destructive: the confirmation names the commit and the
       * number of unsaved Editor tabs whose models will be overwritten.
       * @param {string} hash - target commit.
       * @param {'soft'|'mixed'|'hard'} mode - reset mode.
       * @returns {Promise<void>} resolves after history/tree state refresh.
       */
      const resetBranchHere = React.useCallback(async (hash, mode) => {
        if (typeof hash !== 'string' || hash === '') return;
        const shortHash = hash.slice(0, 7);
        const modeLabel = mode === 'soft'
          ? t('editor.resetSoft')
          : mode === 'hard'
            ? t('editor.resetHard')
            : t('editor.resetMixed');
        const dirty = openFilesRef.current.filter((file) => file.dirty === true).length;
        const confirmation = mode === 'hard'
          ? t('editor.resetHardConfirm', { hash: shortHash, dirty })
          : t('editor.resetConfirm', { hash: shortHash, mode: modeLabel });
        if (!window.confirm(confirmation)) return;
        setCommitBusy(true);
        setCommitError(null);
        setCommitNotice(null);
        try {
          const value = await callGit({ op: 'resetBranch', hash, mode });
          setGit(value);
          setCommitSelection(new Set((value?.changes ?? []).map((change) => change.path)));
          setDiffTarget(null);
          setExternalChanges({});
          setHistoryPath(null);
          setCommitNotice(t('editor.resetDone', { hash: shortHash, mode: modeLabel }));
          await refreshTree();
          await loadLog();
          if (mode === 'hard') {
            for (const file of openFilesRef.current) await reloadFile(file.path);
          }
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setCommitBusy(false);
        }
      }, [loadLog, reloadFile, refreshTree, t]);

      const runHistoryAction = React.useCallback(async (operation, hash) => {
        if (typeof hash !== 'string' || hash === '') return;
        const label = operation === 'cherryPick' ? t('editor.cherryPick') : t('editor.revertCommit');
        if (!window.confirm(t('editor.historyActionConfirm', { action: label, hash: hash.slice(0, 7) }))) return;
        setCommitBusy(true);
        setCommitError(null);
        setCommitNotice(null);
        try {
          const value = await callGit({ op: operation, hash });
          setGit(value);
          setCommitSelection(new Set((value?.changes ?? []).map((change) => change.path)));
          setDiffTarget(null);
          setCommitNotice(t('editor.historyActionDone', { action: label }));
          await refreshTree();
          await loadLog();
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setCommitBusy(false);
        }
      }, [loadLog, refreshTree, t]);

      /**
       * Restore one file to its content at a commit, IDEA's "Revert Selected Changes".
       *
       * Only that one path is written; the working tree otherwise stays as it is.
       * @param {{hash: string, path: string}} input - revision and workspace path.
       */
      const restoreFileAtCommit = React.useCallback(async ({ hash, path }) => {
        if (typeof hash !== 'string' || typeof path !== 'string' || path === '') return;
        if (!window.confirm(t('editor.restoreFileConfirm', { path, hash: hash.slice(0, 7) }))) return;
        setCommitBusy(true);
        setCommitError(null);
        try {
          const value = await callGit({ op: 'restoreFile', hash, path });
          setGit(value);
          setCommitNotice(t('editor.restoreFileDone', { path }));
          await refreshTree();
          /* An open tab must not keep showing the pre-restore bytes. */
          if (openFilesRef.current.some((file) => file.path === path)) await reloadFile(path);
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setCommitBusy(false);
        }
      }, [reloadFile, refreshTree, t]);

      /* IDEA's Log row context menu: diff, history, cherry-pick and revert. */
      /**
       * Open the history of the first file touched by the RIGHT-CLICKED commit.
       *
       * Reading `logDetail` would use whatever commit happened to be selected
       * before the menu opened, which is often a different row — the user then
       * sees another commit's file history.
       * @param {string} hash - commit whose first changed file to follow.
       * @returns {Promise<void>} resolves once the history is shown.
       */
      const showCommitHistory = React.useCallback(async (hash) => {
        if (typeof hash !== 'string' || hash === '') return;
        try {
          const detail = await callGit({ op: 'show', hash });
          const first = (detail?.files ?? [])[0];
          if (first === undefined) {
            setCommitNotice(t('editor.noChangedFiles'));
            return;
          }
          void showFileHistory(first.path);
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        }
      }, [showFileHistory, t]);

      const compareCommitRevisions = React.useCallback(async (selectionHashes) => {
        setCommitError(null);
        setCommitNotice(null);
        const loadedEntries = [
          ...(Array.isArray(commits) ? commits : []),
          ...(Array.isArray(graph?.entries) ? graph.entries : []),
        ].filter((entry, index, list) =>
          typeof entry?.hash === 'string'
          && entry.hash !== ''
          && list.findIndex((candidate) => candidate?.hash === entry.hash) === index);
        const pair = orderedRevisionPair(selectionHashes, loadedEntries);
        if (pair === null) {
          setCommitError(t('editor.compareRevisionsNeedTwo'));
          return;
        }
        const [rightHash, leftHash] = pair;
        try {
          const [leftDetail, rightDetail] = await Promise.all([
            callGit({ op: 'show', hash: leftHash }),
            callGit({ op: 'show', hash: rightHash }),
          ]);
          const paths = [...new Set([
            ...(Array.isArray(leftDetail?.files) ? leftDetail.files : []).map((file) => file.path),
            ...(Array.isArray(rightDetail?.files) ? rightDetail.files : []).map((file) => file.path),
          ].filter((path) => typeof path === 'string' && path !== ''))];
          if (paths.length === 0) {
            setCommitNotice(t('editor.noChangedFiles'));
            return;
          }
          const entries = paths.map((path) => ({
            path,
            originalRevision: leftHash,
            modifiedRevision: rightHash,
            heading: `${path} · ${leftHash.slice(0, 7)} → ${rightHash.slice(0, 7)}`,
          }));
          setDiffTarget({
            combined: true,
            entries,
            revisionPair: { left: leftHash, right: rightHash },
            staged: false,
          });
          setDiffActive(true);
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        }
      }, [commits, graph?.entries, t]);

      const compareCommitWithLocal = React.useCallback(async (hash) => {
        setCommitError(null);
        setCommitNotice(null);
        try {
          const detail = await callGit({ op: 'show', hash });
          const entries = commitLocalDiffEntries(detail, hash, t('editor.currentVersion'));
          if (entries.length === 0) {
            setCommitNotice(t('editor.noChangedFiles'));
            return;
          }
          setDiffTarget({
            combined: true,
            entries,
            commitWithLocal: hash,
            staged: false,
          });
          setDiffActive(true);
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        }
      }, [t]);

      const createCommitPatch = React.useCallback(async (hash) => {
        setCommitError(null);
        setCommitNotice(null);
        try {
          const value = await callGit({ op: 'commitPatch', hash });
          if (typeof value?.patch !== 'string' || value.patch.trim() === '') throw new Error(t('editor.patchEmpty'));
          const resolvedHash = typeof value.hash === 'string' && value.hash !== '' ? value.hash : hash;
          downloadPatchBlob(value.patch, commitPatchDownloadName(resolvedHash, value.subject));
          setCommitNotice(t('editor.commitPatchCreated', { hash: resolvedHash.slice(0, 7) }));
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        }
      }, [t]);

      const openRepositoryVersion = React.useCallback(async ({ hash, path }) => {
        if (typeof hash !== 'string' || hash === '' || typeof path !== 'string' || path === '') return;
        setCommitError(null);
        setCommitNotice(null);
        try {
          const value = await callGit({ op: 'repositoryVersion', hash, path });
          setAnnotateTarget(null);
          setDiffTarget({
            path,
            repositoryVersion: { hash: value.hash, content: value.content, binary: value.binary === true },
            staged: false,
          });
          setDiffActive(true);
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        }
      }, []);

      /**
       * Context menu for a file row in a commit's detail pane.
       *
       * IDEA's version of this menu starts with "Jump to Source"; the tree is
       * this plugin's source view, so the first entry selects the working copy
       * there and the second opens it in the editor.
       * @param {{path: string, x: number, y: number}} payload - clicked file.
       * @returns {object} menu descriptor for the shared popup.
       */
      const buildCommitFileMenu = React.useCallback(
        ({ path, hash, localExists, localDirExists, x, y }) => ({
          x,
          y,
          items: [
            {
              id: 'diff',
              label: t('editor.showDiff'),
              disabled: typeof hash !== 'string' || hash === '',
              run: () => {
                if (typeof hash === 'string' && hash !== '') showCommitDiff({ hash, path });
              },
            },
            {
              id: 'openRepositoryVersion',
              label: t('editor.openRepositoryVersionAction'),
              disabled: typeof hash !== 'string' || hash === '',
              run: () => {
                if (typeof hash === 'string' && hash !== '') void openRepositoryVersion({ hash, path });
              },
            },
            { id: 'reveal', label: t('editor.revealInProject'), run: () => void revealPath(path) },
            {
              id: 'openTerminal',
              label: t('editor.openInTerminal'),
              disabled: localDirExists === false,
              run: () => {
                if (localDirExists !== false) openInTerminal(dirname(path));
              },
            },
            {
              id: 'openLocalVersion',
              label: t('editor.openLocalVersion'),
              shortcut: 'F4',
              disabled: localExists === false,
              run: () => {
                if (localExists !== false) void editLocalVersion(path);
              },
            },
            { id: 'history', label: t('editor.showHistory'), run: () => void showFileHistory(path) },
            { id: 'copyRelative', label: t('editor.copyRelativePath'), run: () => void navigator.clipboard?.writeText(path).catch(() => {}) },
            { id: 'copyAbsolute', label: t('editor.copyAbsolutePath'), run: () => void navigator.clipboard?.writeText(shellQuote(root === '' ? path : `${root}/${path}`)).catch(() => {}) },
          ],
        }),
        [showCommitDiff, editLocalVersion, openInTerminal, openRepositoryVersion, revealPath, showFileHistory, root, t],
      );

      const buildLogMenu = React.useCallback(
        ({ commit, selectionHashes: requestedSelectionHashes, x, y }) => {
          const loaded = [...(Array.isArray(commits) ? commits : []), ...(graph?.entries ?? [])];
          const unique = [...new Map(loaded
            .filter((entry) => typeof entry?.hash === 'string' && entry.hash !== '')
            .map((entry) => [entry.hash, entry])).values()];
          const selectionHashes = [...new Set([
            ...(Array.isArray(requestedSelectionHashes) ? requestedSelectionHashes : []),
            commit.hash,
          ].filter((hash) => typeof hash === 'string' && hash !== ''))];
          const relations = commitRelationTargets(unique, commit.hash);
          const parentTargets = relations.parents;
          const childTargets = relations.children;
          const relationItems = (prefix, targets) => targets.map((target) => ({
            id: `${prefix}:${target.hash}`,
            label: `${target.hash.slice(0, 7)} ${target.subject}`,
            run: () => void showCommit(target.hash),
          }));
          return {
            x,
            y,
            items: [
            ...(selectionHashes.length === 2
              ? [
                  {
                    id: 'compareRevisions',
                    label: t('editor.compareRevisionsAction'),
                    run: () => void compareCommitRevisions(selectionHashes),
                  },
                  null,
                ]
              : []),
            {
              id: 'show',
              label: t('editor.openCommitDetails'),
              run: () => void showCommit(commit.hash),
            },
            {
              id: 'history',
              label: t('editor.fileHistoryOfCommit'),
              run: () => void showCommitHistory(commit.hash),
            },
            {
              id: 'compareWithLocalCommit',
              label: t('editor.compareWithLocalCommitAction'),
              run: () => void compareCommitWithLocal(commit.hash),
            },
            null,
            {
              id: 'goToChildCommit',
              label: t('editor.goToChildCommitAction'),
              shortcut: '←',
              disabled: childTargets.length === 0,
              ...(childTargets.length > 1
                ? { items: relationItems('goToChild', childTargets) }
                : { run: () => {
                    if (childTargets[0] !== undefined) void showCommit(childTargets[0].hash);
                  } }),
            },
            {
              id: 'goToParentCommit',
              label: t('editor.goToParentCommitAction'),
              shortcut: '→',
              disabled: parentTargets.length === 0,
              ...(parentTargets.length > 1
                ? { items: relationItems('goToParent', parentTargets) }
                : { run: () => {
                    if (parentTargets[0] !== undefined) void showCommit(parentTargets[0].hash);
                  } }),
            },
            null,
            {
              id: 'cherryPick',
              label: t('editor.cherryPick'),
              run: () => void runHistoryAction('cherryPick', commit.hash),
            },
            {
              id: 'revert',
              label: t('editor.revertCommit'),
              danger: true,
              run: () => void runHistoryAction('revert', commit.hash),
            },
            null,
            {
              id: 'createTag',
              label: t('editor.createTagAction'),
              run: () => setNamePrompt({
                kind: 'tag',
                title: t('editor.createTagAction'),
                placeholder: t('editor.createTagPlaceholder'),
                value: '',
                hash: commit.hash,
                error: '',
              }),
            },
            {
              id: 'createCommitPatch',
              label: t('editor.createPatchFromCommitAction'),
              run: () => void createCommitPatch(commit.hash),
            },
            null,
            {
              /* IDEA puts "Checkout Revision" in the log's context menu; without it a
                 revision can only be inspected, never returned to. */
              id: 'checkoutRevision',
              label: t('editor.checkoutRevision'),
              run: () => void checkoutRevision(commit.hash),
            },
            {
              id: 'newBranchFromCommit',
              label: t('editor.newBranchFromCommitAction', { hash: commit.hash.slice(0, 7) }),
              run: () => setNamePrompt({
                kind: 'branch',
                title: t('editor.newBranchFromCommitAction', { hash: commit.hash.slice(0, 7) }),
                placeholder: t('editor.newBranchPlaceholder'),
                value: '',
                hash: commit.hash,
                error: '',
              }),
            },
            {
              id: 'resetBranchHere',
              label: t('editor.resetBranchHereAction'),
              disabled: git?.detached === true,
              items: [
                {
                  id: 'resetSoft',
                  label: t('editor.resetSoft'),
                  run: () => void resetBranchHere(commit.hash, 'soft'),
                },
                {
                  id: 'resetMixed',
                  label: t('editor.resetMixed'),
                  run: () => void resetBranchHere(commit.hash, 'mixed'),
                },
                {
                  id: 'resetHard',
                  label: t('editor.resetHard'),
                  danger: true,
                  run: () => void resetBranchHere(commit.hash, 'hard'),
                },
              ],
            },
            null,
            {
              id: 'copyHash',
              label: t('editor.copyHash'),
              run: () => void navigator.clipboard?.writeText(commit.hash).catch(() => {}),
            },
            {
              id: 'copySubject',
              label: t('editor.copySubject'),
              /* A log row always has a subject, but the menu is also built from
                 payloads the detail pane produces; an empty item is better than
                 copying the string "undefined". */
              disabled: typeof commit.subject !== 'string' || commit.subject === '',
              run: () => void navigator.clipboard?.writeText(commit.subject).catch(() => {}),
            },
            ],
          };
        },
        [commits, compareCommitRevisions, compareCommitWithLocal, createCommitPatch, git?.detached, graph?.entries, resetBranchHere, runHistoryAction, showCommit, showCommitHistory, t],
      );

      /* Rollback discards edits, so it asks first — IDEA does the same for modified files. */
      const rollback = React.useCallback(
        async (paths, options) => {
          if (paths.length === 0) return;
          const stagedOnly = options?.staged === true;
          const unversionedOnly = options?.unversioned === true;
          const confirmKey = stagedOnly
            ? 'editor.rollbackStagedConfirm'
            : unversionedOnly ? 'editor.rollbackUnversionedConfirm' : 'editor.rollbackConfirm';
          if (!window.confirm(t(confirmKey, { count: paths.length }))) return;
          const pickedKeys = new Set(chosenChanges(selectedChangeRef.current)
            .filter((entry) => stagedOnly ? entry.staged === true : entry.staged !== true)
            .map((entry) => `${entry.staged === true ? 'staged' : 'unstaged'}:${entry.path}`));
          setCommitBusy(true);
          setCommitError(null);
          try {
            const value = await callGit({ op: 'rollback', paths, ...(stagedOnly ? { staged: true } : {}) });
            setGit(value);
            /* Rollback changes the working list, not the user's commit choice:
               keep the checkbox set and only drop paths that disappeared. */
            setCommitSelection((current) => {
              const existing = new Set((value?.changes ?? []).map((change) => change.path));
              return new Set([...current].filter((path) => existing.has(path)));
            });
            setDiffTarget(null);
            await refreshTree();
            reconcileChangeSelection(value?.changes ?? [], pickedKeys);
            if (activePathRef.current !== null && paths.includes(activePathRef.current)) {
              await openFile(activePathRef.current);
            }
          } catch (failure) {
            setCommitError(failure instanceof Error ? failure.message : String(failure));
          } finally {
            setCommitBusy(false);
          }
        },
        [chosenChanges, openFile, reconcileChangeSelection, refreshTree, t],
      );

      /* IDEA's "Add to .gitignore", shared by the unversioned group header and
         individual unversioned file rows. Declared before buildChangeMenu so its
         callback dependency can never enter the TDZ. */
      const addToGitignore = React.useCallback(
        async (paths) => {
          if (paths.length === 0) return;
          setCommitBusy(true);
          setCommitError(null);
          try {
            const value = await callGit({ op: 'ignore', paths });
            const added = value?.added ?? [];
            setCommitNotice(added.length === 0 ? t('editor.alreadyIgnored') : t('editor.addedToGitignore', { count: added.length }));
            await loadGit();
            await refreshTree();
          } catch (failure) {
            setCommitError(failure instanceof Error ? failure.message : String(failure));
          } finally {
            setCommitBusy(false);
          }
        },
        [loadGit, refreshTree, t],
      );

      /**
       * Copy IDEA's selected-changes patch without mutating the index.
       *
       * @param {Array<{path: string, staged?: boolean}>} targets - selected change identities.
       * @returns {Promise<void>} resolves after clipboard feedback is set.
       */
      const requestSelectedPatch = React.useCallback(async (targets) => {
        const entries = (Array.isArray(targets) ? targets : [])
          .filter((entry) => typeof entry?.path === 'string' && entry.path !== '')
          .map((entry) => ({ path: entry.path, staged: entry.staged === true }));
        if (entries.length === 0) return null;
        return callGit({ op: 'patch', entries });
      }, []);

      const copySelectedPatch = React.useCallback(async (targets) => {
        setCommitError(null);
        setCommitNotice(null);
        try {
          const value = await requestSelectedPatch(targets);
          if (value === null) return;
          if (typeof value?.patch !== 'string' || value.patch.trim() === '') throw new Error(t('editor.patchEmpty'));
          if (typeof navigator.clipboard?.writeText !== 'function') throw new Error(t('editor.clipboardWriteFailed'));
          try {
            await navigator.clipboard?.writeText(value.patch);
          } catch {
            throw new Error(t('editor.clipboardWriteFailed'));
          }
          setCommitNotice(t('editor.patchCopied', { count: value.files?.length ?? 0 }));
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        }
      }, [requestSelectedPatch, t]);

      const createSelectedPatch = React.useCallback(async (targets) => {
        setCommitError(null);
        setCommitNotice(null);
        try {
          const value = await requestSelectedPatch(targets);
          if (value === null) return;
          if (typeof value?.patch !== 'string' || value.patch.trim() === '') throw new Error(t('editor.patchEmpty'));
          downloadPatchBlob(value.patch, patchDownloadName());
          setCommitNotice(t('editor.patchCreated', { count: value.files?.length ?? 0 }));
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        }
      }, [requestSelectedPatch, t]);

      /**
       * Apply one unified diff through the host's atomic Git preflight.
       *
       * IDEA saves documents before applying a patch. Dirty tabs therefore get
       * one explicit confirmation; a partial Save All aborts before any hunk is
       * applied. The returned status refreshes the tree and every open buffer.
       * @param {string} patchText - clipboard or chosen patch-file contents.
       * @returns {Promise<boolean>} true when the patch was applied.
       */
      const applyPatchText = React.useCallback(async (patchText) => {
        if (commitBusy) return false;
        if (typeof patchText !== 'string' || patchText.trim() === '') {
          setCommitError(t('editor.applyPatchEmpty'));
          return false;
        }
        const dirty = openFilesRef.current.filter((file) => file.dirty === true);
        if (dirty.length > 0 && !window.confirm(t('editor.applyPatchDirty', { count: dirty.length }))) return false;
        setCommitBusy(true);
        setCommitError(null);
        setCommitNotice(null);
        try {
          if (dirty.length > 0 && (await saveAll()) < dirty.length) {
            throw new Error(t('editor.applyPatchSaveFailed'));
          }
          const value = await callGit({ op: 'applyPatch', patch: patchText });
          setGit(value);
          setCommitSelection((current) => {
            const existing = new Set((value?.changes ?? []).map((change) => change.path));
            return new Set([...current].filter((path) => existing.has(path)));
          });
          setDiffTarget(null);
          setExternalChanges({});
          await refreshTree();
          for (const file of openFilesRef.current) await reloadFile(file.path);
          setCommitNotice(t('editor.applyPatchDone', { count: value?.appliedFiles?.length ?? 0 }));
          return true;
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
          return false;
        } finally {
          setCommitBusy(false);
        }
      }, [commitBusy, refreshTree, reloadFile, saveAll, t]);

      const applyPatchFile = React.useCallback(() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.patch,.diff,text/plain';
        input.style.display = 'none';
        document.body.appendChild(input);
        input.addEventListener('cancel', () => input.remove(), { once: true });
        input.addEventListener('change', () => {
          const file = input.files?.[0] ?? null;
          input.remove();
          if (file === null) return;
          if (file.size > 4 * 1024 * 1024) {
            setCommitError(t('editor.applyPatchTooLarge'));
            return;
          }
          file.text()
            .then((text) => applyPatchText(text))
            .catch(() => setCommitError(t('editor.applyPatchReadFailed')));
        }, { once: true });
        input.click();
      }, [applyPatchText, t]);

      const applyPatchClipboard = React.useCallback(async () => {
        let text;
        try {
          if (typeof navigator.clipboard?.readText !== 'function') throw new Error(t('editor.applyPatchReadFailed'));
          text = await navigator.clipboard.readText();
        } catch {
          setCommitError(t('editor.applyPatchReadFailed'));
          return;
        }
        await applyPatchText(text);
      }, [applyPatchText, t]);

      const buildChangeMenu = React.useCallback(
        (payload) => {
          const change = payload.change;
          const staged = payload.staged;
          const range = payload.selectedChanges instanceof Set && payload.selectedChanges.size > 0
            ? payload.selectedChanges
            : new Set([`${staged === true ? 'staged' : 'unstaged'}:${change.path}`]);
          const parsed = [...range].map((key) => {
            const separator = key.indexOf(':');
            return separator < 0 ? null : {
              staged: key.slice(0, separator) === 'staged',
              path: key.slice(separator + 1),
            };
          }).filter((entry) => entry !== null);
          const selected = parsed.length > 0 ? parsed : [{ path: change.path, staged }];
          const paths = [...new Set(selected.map((entry) => entry.path))];
          const allStaged = selected.every((entry) => entry.staged === true);
          const allWorking = selected.every((entry) => entry.staged === false);
          const allUnversioned = allPathsUnversioned(selected, changesByPathRef.current);
          const removablePaths = pathsScheduledForRemoval(selected, changesByPathRef.current);
          const removalOnly = allWorking && removablePaths.length > 0 && removablePaths.length === selected.length;
          const batchLabel = (single, multiple) => (paths.length > 1 ? t(multiple, { count: paths.length }) : t(single));
          const pick = (path) => (changesByPathRef.current.get(path) ?? change);
          const allConflicts = selected.every((entry) => isConflict(pick(entry.path)));
          return {
            x: payload.x,
            y: payload.y,
            title: paths.length > 1 ? t('editor.selectedChangesTitle', { count: paths.length }) : undefined,
            items: [
              {
                id: 'rollback',
                label: t('editor.rollback'),
                danger: true,
                items: [
                  ...(allStaged
                    ? [{ id: 'rollbackStaged', label: t('editor.rollbackStaged'), danger: true, run: () => void rollback(paths, { staged: true }) }]
                    : []),
                  ...(allWorking
                    ? [{
                        id: 'rollbackWorking',
                        label: allUnversioned
                          ? batchLabel('editor.rollbackUnversioned', 'editor.rollbackUnversionedCount')
                          : batchLabel('editor.rollbackWorking', 'editor.rollbackWorkingCount'),
                        shortcut: '⌥⌘Z',
                        ariaKeyShortcuts: 'Alt+Meta+Z Control+Alt+Z',
                        danger: true,
                        run: () => void rollback(paths, allUnversioned ? { unversioned: true } : undefined),
                      }]
                    : []),
                ],
              },
              null,
              {
                id: 'diff',
                label: t('editor.showDiff'),
                shortcut: '⌘D',
                ariaKeyShortcuts: 'Meta+D Control+D',
                run: () => {
                  setDiffTarget({ path: change.path, staged });
                  setDiffActive(true);
                },
              },
              {
                id: 'combinedDiff',
                label: t('editor.showCombinedDiff'),
                disabled: paths.length < 2,
                run: () => showCombinedDiff(selected),
              },
              {
                id: 'open',
                label: t('editor.openInEditor'),
                run: () => void openFile(change.path),
              },
              ...(allConflicts
                ? [{
                    id: 'resolveConflicts',
                    label: t('editor.resolveConflicts'),
                    items: [
                      { id: 'acceptOurs', label: t('editor.acceptOurs'), run: () => void resolveConflict(paths, 'ours') },
                      { id: 'acceptTheirs', label: t('editor.acceptTheirs'), run: () => void resolveConflict(paths, 'theirs') },
                    ],
                  }]
                : []),
              {
                id: 'copyReference',
                label: t('editor.copyPathReference'),
                items: copyReferenceMenuItems({
                  entries: paths.map((path) => ({ path })),
                  root,
                  t,
                  editor: currentCodeEditor(),
                  editorPath: currentCodePath(),
                  writeText: (value) => navigator.clipboard?.writeText(value),
                }),
              },
              null,
              {
                id: removalOnly ? 'removeDeleted' : 'stage',
                label: removalOnly
                  ? t('editor.removeFromVcs')
                  : allStaged
                  ? batchLabel('editor.unstageAction', 'editor.unstageSelectedCount')
                  : allUnversioned
                    ? batchLabel('editor.addToVcs', 'editor.addToVcsCount')
                    : batchLabel('editor.stageAction', 'editor.stageSelectedCount'),
                disabled: allStaged === false && allWorking === false,
                ...(removalOnly ? {} : { shortcut: allStaged ? '⌥⌘A' : '⌘⇧A' }),
                ariaKeyShortcuts: removalOnly
                  ? undefined
                  : allStaged
                    ? 'Alt+Meta+A Control+Alt+A'
                    : 'Meta+Shift+A Control+Shift+A',
                run: () => void restage(removalOnly ? removablePaths : paths, allStaged),
              },
              ...(removablePaths.length > 0 && !removalOnly
                ? [{
                    id: 'removeDeleted',
                    label: t('editor.removeFromVcs'),
                    run: () => void restage(removablePaths, false),
                  }]
                : []),
              ...(allUnversioned
                ? [{
                    id: 'gitignore',
                    label: t('editor.addToGitignore'),
                    run: () => void addToGitignore(paths),
                  }]
                : []),
              null,
              {
                id: 'createPatch',
                label: t('editor.createPatchFromChanges'),
                run: () => void createSelectedPatch(selected),
              },
              {
                id: 'copyPatch',
                label: t('editor.copyPatchToClipboard'),
                run: () => void copySelectedPatch(selected),
              },
              null,
              {
                id: 'history',
                label: t('editor.showHistory'),
                disabled: paths.length > 1,
                run: () => void showFileHistory(change.path),
              },
              {
                id: 'reveal',
                label: t('editor.revealInProject'),
                disabled: paths.length > 1,
                run: () => void revealPath(change.path),
              },
              {
                id: 'openTerminal',
                label: t('editor.openInTerminal'),
                disabled: paths.length > 1,
                run: () => openInTerminal(dirname(change.path)),
              },
              null,
              {
                id: 'compareRevision',
                label: t('editor.compareWithRevision'),
                disabled: paths.length > 1,
                run: () => void compareWithRevision(change.path),
              },
              {
                id: 'compareHead',
                label: t('editor.compareWithHead'),
                disabled: paths.length > 1 || !canCompareWithHead(pick(change.path)),
                run: () => compareWithHead(change.path),
              },
              {
                id: 'compareClipboard',
                label: t('editor.compareWithClipboard'),
                disabled: paths.length > 1,
                run: () => void compareWithClipboard(change.path),
              },
            ],
          };
        },
        [compareWithClipboard, compareWithHead, compareWithRevision, copySelectedPatch, createSelectedPatch, currentCodeEditor, currentCodePath, openFile, openInTerminal, addToGitignore, resolveConflict, restage, revealPath, rollback, root, showCombinedDiff, showFileHistory, t],
      );

      /**
       * Context menu for one directory node in the change tree.
       *
       * IDEA acts on a directory's whole subtree: stage/unstage every file below
       * it, or roll the lot back. The paths are collected by the row (it already
       * holds `row.changes`), so the menu never re-derives the tree. Declared
       * after `rollback` because its dependency array names it.
       * @param {{directory: string, changes: object[], group: string, x: number, y: number}} payload - clicked node.
       * @returns {object} menu descriptor for the shared popup.
       */
      const buildChangeDirMenu = React.useCallback(
        ({ directory, changes: inside, group, x, y }) => {
          const paths = (inside ?? []).map((change) => change.path);
          return {
            x,
            y,
            title: basename(directory),
            items: [
              ...(group === 'staged'
                ? [{ id: 'unstageDirectory', label: t('editor.unstageThisDirectory'), run: () => void restage(paths, true) }]
                : [{ id: 'stageDirectory', label: t('editor.stageThisDirectory'), run: () => void restage(paths, false) }]),
              null,
              {
                id: 'rollbackDirectory',
                label: t('editor.rollbackDirectory'),
                danger: true,
                disabled: paths.length === 0,
                run: () => void rollback(paths),
              },
              null,
              {
                id: 'openDirectory',
                label: t('editor.revealInProject'),
                run: () => void revealPath(directory),
              },
              {
                id: 'openTerminal',
                label: t('editor.openInTerminal'),
                run: () => openInTerminal(directory),
              },
            ],
          };
        },
        [openInTerminal, restage, revealPath, rollback, t],
      );

      /**
       * ⌥⌘Z — "revert the working copy" for the row the Commit panel is showing.
       *
       * The context menu has advertised this shortcut since the two discards were
       * split, but nothing listened for it. It acts on the change selected in the
       * panel (the one the detail pane is about), and steps aside whenever a text
       * field or the editor owns the keyboard.
       * @param {Event} event - keydown from the window capture phase.
       * @returns {void}
       */
      const rollbackWorkingShortcut = React.useCallback((event) => {
        const meta = event.metaKey || event.ctrlKey;
        if (!event.altKey || !meta || event.shiftKey || event.key.toLowerCase() !== 'z') return;
        const target = event.target instanceof Element ? event.target : null;
        /* A terminal, a rename field or the code editor must keep the key. */
        if (target?.closest('.monaco-editor') != null) return;
        if (target?.closest('input, textarea, [contenteditable="true"]') != null) return;
        if (target?.closest('[data-dsh-editor-terminal]') != null) return;
        if (selectedGroupRef.current !== null) return;
        const fallback = selectedChangeRef.current ?? lastChangePathRef.current;
        const picked = chosenChanges(fallback);
        const working = picked.filter((entry) => entry.staged !== true).map((entry) => entry.path);
        if (working.length === 0) return;
        event.preventDefault();
        event.stopPropagation();
        void rollback([...new Set(working)]);
      }, [chosenChanges, rollback]);

      React.useEffect(() => {
        window.addEventListener('keydown', rollbackWorkingShortcut, true);
        return () => window.removeEventListener('keydown', rollbackWorkingShortcut, true);
      }, [rollbackWorkingShortcut]);

      /**
       * ⌘⇧A — stage, ⌥⌘A — unstage the Commit panel's current change.
       *
       * IDEA's changelist is fully keyboard-driven: reaching for the row's
       * checkbox is the only way to move one file between the bands here. The
       * shortcut acts on the file the panel is showing (the diff target, the
       * annotated file, or the open tab) and stands aside for text fields.
       * @param {KeyboardEvent} event - window keydown.
       * @returns {void}
       */
      const stageShortcut = React.useCallback((event) => {
        const meta = event.metaKey || event.ctrlKey;
        if (!meta || event.shiftKey === event.altKey || event.key.toLowerCase() !== 'a') return;
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('.monaco-editor') != null) return;
        if (target?.closest('input, textarea, [contenteditable="true"]') != null) return;
        if (target?.closest('[data-dsh-editor-terminal]') != null) return;
        /* No Commit panel on screen: the shortcut has nothing to act on. */
        if (!panelVisibleRef.current || activityRef.current !== 'commit') return;
        if (selectedGroupRef.current !== null) return;
        const remembered = lastChangePathRef.current;
        const fallback = selectedChangeRef.current ?? (remembered === null || remembered === undefined ? null : remembered);
        const picked = chosenChanges(fallback);
        const single = picked.length > 0 ? picked : (fallback === null ? [] : [fallback]);
        if (single.length === 0) return;
        const change = (gitRef.current?.changes ?? []).find((entry) => entry.path === single[0].path);
        if (change === undefined) return;
        /* Already in the requested band: the reverse action would be a surprise. */
        const staged = change.status[0] !== ' ' && change.status[0] !== '?';
        const eligible = single
          .filter((entry) => entry.staged === staged)
          .map((entry) => entry.path);
        if (eligible.length === 0) return;
        event.preventDefault();
        event.stopPropagation();
        void restageRef.current([...new Set(eligible)], staged);
      }, [chosenChanges]);

      React.useEffect(() => {
        window.addEventListener('keydown', stageShortcut, true);
        return () => window.removeEventListener('keydown', stageShortcut, true);
      }, [stageShortcut]);

      /**
       * ⌘D — open the diff of the current change, IDEA's "Show Diff" key.
       *
       * The change row menu has printed `⌘D` since the diff existed, but the key
       * did nothing unless the row was already selected and clicked. This opens (or
       * closes) the diff for whatever the Commit panel is pointing at, so a file can
       * be reviewed from the keyboard after staging it.
       * @param {KeyboardEvent} event - window keydown.
       * @returns {void}
       */
      const showDiffShortcut = React.useCallback((event) => {
        if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'd') return;
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('.monaco-editor') != null) return;
        if (target?.closest('input, textarea, [contenteditable="true"]') != null) return;
        if (target?.closest('[data-dsh-editor-terminal]') != null) return;
        if (!panelVisibleRef.current || activityRef.current !== 'commit') return;
        if (selectedGroupRef.current !== null) return;
        const remembered = lastChangePathRef.current;
        const path = selectedChangeRef.current?.path ?? selectedDiffPathRef.current ?? selectedCommitPathRef.current ?? remembered?.path ?? activePathRef.current;
        if (path === null || path === undefined || path === '') return;
        const change = (gitRef.current?.changes ?? []).find((entry) => entry.path === path);
        if (change === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        const staged = change.status[0] !== ' ' && change.status[0] !== '?';
        setDiffTarget((current) => (current !== null && current.path === path && current.staged === staged ? null : { path, staged }));
        setDiffActive(true);
      }, []);

      React.useEffect(() => {
        window.addEventListener('keydown', showDiffShortcut, true);
        return () => window.removeEventListener('keydown', showDiffShortcut, true);
      }, [showDiffShortcut]);

      /* Apply a rename from the inline editor row. */
      const commitRename = React.useCallback(async () => {
        if (renameState === null) return;
        const name = renameState.value.trim();
        if (name === '' || name.includes('/') || name === '.' || name === '..') {
          setTreeError(t('editor.invalidName'));
          return;
        }
        /* The destination is derived from the ORIGINAL path, not from a stored
           `parent`: a rename keeps the entry in its own directory, and deriving it
           here means no caller can hand in a `parent` equal to the entry itself
           (which produced `assets/assets` and an EINVAL from the host). */
        const parent = dirname(renameState.path);
        const next = parent === '' ? name : `${parent}/${name}`;
        if (next === renameState.path) {
          /* A freshly created entry that keeps its name simply leaves edit mode. */
          setRenameState(null);
          return;
        }
        try {
          await callFs({ op: 'rename', path: renameState.path, to: next });
          remapEditorPaths([[renameState.path, next]]);
          setRenameState(null);
          setSelectedPath(next);
          await refreshTree();
          await loadGit();
        } catch (failure) {
          setTreeError(failure instanceof Error ? failure.message : String(failure));
        }
      }, [loadGit, refreshTree, remapEditorPaths, renameState, t]);

      const selectActivity = React.useCallback(
        (next) => {
          if (next === 'terminal') {
            setTerminalOpen((open) => !open);
            setFindTool(null);
            return;
          }
          /* The terminal dock is PERSISTENT, matching IDEA: switching to Project or
             Commit leaves the open shells exactly where they are. Hiding the dock
             on every tool-window switch lost the user's terminal while they looked
             at a diff, and the shell's output was scrolled away when it came back. */
          if (next === activity) {
            setPanelVisible((visible) => !visible);
            return;
          }
          setActivity(next);
          setPanelVisible(true);
        },
        [activity],
      );

      /* The first Alt+F1 of IDEA's Select Opened File chord. */
      const selectOpenedChordAt = React.useRef(0);
      /**
       * Alt+F12, Alt+1..3 and Ctrl+Shift+` — IDEA's tool-window keys.
       *
       * IDEA raises a tool window with `Alt+<digit>` and its terminal with
       * `Alt+F12`. The digits used to be dead here: nothing opened Project or
       * Commit without the mouse, which is the difference between "a panel" and
       * "an IDE". A key that raises the active window again hides it, exactly as
       * IDEA's toggle does; the terminal keeps its own open/close behaviour.
       * @param {KeyboardEvent} event - window keydown.
       * @returns {void}
       */
      React.useEffect(() => {
        /* Remember the surface that owned the caret before the dock opened. A
           terminal shortcut pressed while the terminal is already focused must
           not replace the origin with the terminal itself. */
        const rememberTerminalOrigin = () => {
          const current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          const editorNode = editorRef.current?.getDomNode?.() ?? null;
          terminalReturnFocusRef.current = current !== null && current.closest('[data-dsh-editor-terminal]') === null
            ? current
            : editorNode;
        };
        const restoreTerminalOrigin = () => {
          const previous = terminalReturnFocusRef.current;
          terminalReturnFocusRef.current = null;
          window.setTimeout(() => {
            if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
            else editorRef.current?.focus();
          }, 0);
        };
        const toggleTerminalDock = () => {
          const current = document.activeElement instanceof Element ? document.activeElement : null;
          const action = terminalShortcutAction(
            terminalOpen,
            current?.closest('[data-dsh-editor-terminal]') !== null,
          );
          if (action.open === false) {
            setTerminalOpen(false);
            if (action.restoreFocus) restoreTerminalOrigin();
            else terminalReturnFocusRef.current = null;
            return;
          }
          rememberTerminalOrigin();
          setTerminalOpen(true);
          setFindTool(null);
          setTerminalFocusGeneration((value) => value + 1);
        };
        const onKeyDown = (event) => {
          const chordAction = selectOpenedChordAction(event, selectOpenedChordAt.current, Date.now(), activePathRef.current !== null);
          if (chordAction === 'arm') {
            event.preventDefault();
            event.stopPropagation();
            selectOpenedChordAt.current = Date.now();
            return;
          }
          if (chordAction === 'reveal') {
            event.preventDefault();
            event.stopPropagation();
            selectOpenedChordAt.current = 0;
            void revealActiveRef.current?.();
            return;
          }
          if (chordAction === 'clear') selectOpenedChordAt.current = 0;
          if (event.altKey && !event.metaKey && !event.ctrlKey && event.key === 'F12') {
            event.preventDefault();
            toggleTerminalDock();
            return;
          }
          if (event.altKey && !event.metaKey && !event.ctrlKey && (event.key === '1' || event.key === '2' || event.key === '3')) {
            event.preventDefault();
            selectActivity(event.key === '1' ? 'project' : event.key === '2' ? 'commit' : 'terminal');
            return;
          }
          if (event.ctrlKey && event.shiftKey && (event.code === 'Backquote' || event.key === '`' || event.key === '~')) {
            event.preventDefault();
            toggleTerminalDock();
          }
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
      }, [selectActivity, terminalOpen]);

      /* Keyboard navigation over the visible flattened rows. */
      /* The typeahead's pending prefix, and when the last key arrived. */
      const typeaheadBuffer = React.useRef('');
      const typeaheadAt = React.useRef(0);

      const onTreeKeyDown = React.useCallback(
        (event) => {
          /* The inline rename field and the create row live inside the tree, so their
             keydown bubbles here. Without this guard every letter typed into a rename
             would also run the typeahead and swallow the keystroke. */
          if (event.target instanceof Element && event.target.closest('input, textarea, select') !== null) return;
          if (rows.length === 0) return;
          if (sortMode === 'manual'
            && event.altKey
            && !event.metaKey
            && !event.ctrlKey
            && !event.shiftKey
            && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
            const selected = selectedPath === null
              ? null
              : rows.find((row) => row.path === selectedPath && row.kind !== 'placeholder');
            if (selected === null || selected === undefined || selected.root === true) return;
            const parent = dirname(selected.path);
            const listing = parent === '' ? entries : children[parent];
            if (!Array.isArray(listing)) return;
            const ordered = orderProjectEntriesByManual(listing, manualOrder[parent]);
            const siblingPaths = new Set(ordered.map((entry) => entry.path));
            const sources = selection.has(selected.path)
              ? [...selection].filter((path) => siblingPaths.has(path) && dirname(path) === parent)
              : [selected.path];
            const boundary = manualReorderBoundary(
              ordered.map((entry) => entry.path),
              sources,
              event.key === 'ArrowUp' ? 'up' : 'down',
            );
            if (boundary === null) return;
            event.preventDefault();
            event.stopPropagation();
            reorderManualProject(sources, boundary.target, boundary.edge);
            window.setTimeout(() => rowRefs.current.get(selected.path)?.scrollIntoView?.({ block: 'nearest' }), 0);
            return;
          }
          /* IDEA's typeahead: a printable key moves the selection, and a pause of a
             second starts a new prefix. Modified keys (⌘N, ⌥…) are commands. */
          if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
            const step = typeaheadStep({
              rows,
              buffer: typeaheadBuffer.current,
              path: selectedPath,
              key: event.key,
              now: Date.now(),
              lastAt: typeaheadAt.current,
            });
            typeaheadBuffer.current = step.buffer;
            typeaheadAt.current = step.at;
            if (step.hit !== null) {
              event.preventDefault();
              setSelectedPath(step.hit);
              window.setTimeout(() => rowRefs.current.get(step.hit)?.scrollIntoView({ block: 'nearest' }), 0);
            }
            /* A prefix with no hit must not swallow the key: only claim it once
               something matched, so nothing else in the tree goes dead. */
            return;
          }
          /* Placeholder rows are not selectable, so arrow keys step over them. */
          const selectable = rows.filter((row) => row.kind !== 'placeholder');
          const currentIndex = selectedPath === null ? -1 : selectable.findIndex((row) => row.path === selectedPath);
          const current = currentIndex >= 0 ? selectable[currentIndex] : null;
          /* IDEA's EditSource opens the selected tree file in the editor. F4 is
             the cross-platform key; macOS also advertises ⌘↓ in the same action. */
          const editSource = (event.key === 'F4' && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey)
            || ((event.metaKey || event.ctrlKey) && event.key === 'ArrowDown' && !event.altKey && !event.shiftKey);
          if (editSource && current !== null && current.kind !== 'directory') {
            event.preventDefault();
            event.stopPropagation();
            /* EditSource means edit, not only reveal: unlike a tree click,
               this action hands the keyboard to Monaco once the model is open. */
            void openFile(current.path).then(() => window.setTimeout(() => editorRef.current?.focus(), 0));
            return;
          }
          const focusRow = (index, extend = false) => {
            const row = selectable[Math.max(0, Math.min(index, selectable.length - 1))];
            if (row === undefined) return;
            if (extend) {
              /* Shift+Arrow grows the selection from the anchor, IDEA's range behaviour. */
              const anchor = selectionAnchor.current ?? selectedPath ?? row.path;
              const from = rows.findIndex((entry) => entry.path === anchor);
              const to = rows.findIndex((entry) => entry.path === row.path);
              if (from >= 0 && to >= 0) {
                const [start, end] = from <= to ? [from, to] : [to, from];
                setSelection(new Set(rows.slice(start, end + 1).map((entry) => entry.path)));
                setSelectedPathRaw(row.path);
              }
            } else {
              setSelectedPath(row.path);
            }
            window.setTimeout(() => rowRefs.current.get(row.path)?.scrollIntoView({ block: 'nearest' }), 0);
          };
          switch (event.key) {
            case 'ArrowDown':
              event.preventDefault();
              focusRow(currentIndex + 1, event.shiftKey);
              break;
            case 'ArrowUp':
              event.preventDefault();
              focusRow(currentIndex - 1, event.shiftKey);
              break;
            case 'ArrowRight':
              event.preventDefault();
              if (current?.kind === 'directory') {
                if (!expanded.has(current.path)) void toggleDirectory(current.path);
                else focusRow(currentIndex + 1);
              }
              break;
            case 'ArrowLeft':
              event.preventDefault();
              if (current?.kind === 'directory' && current.root !== true && expanded.has(current.path)) {
                void toggleDirectory(current.path);
              } else if (current !== null && current.depth > 0) {
                for (let index = currentIndex - 1; index >= 0; index -= 1) {
                  if (rows[index].depth === current.depth - 1) {
                    focusRow(index);
                    break;
                  }
                }
              }
              break;
            case 'Enter':
              event.preventDefault();
              if (current === null) break;
              if (current.kind === 'directory') {
                if (current.root !== true) void toggleDirectory(current.path);
              } else {
                void openFile(current.path);
              }
              break;
            case 'Home':
              event.preventDefault();
              focusRow(0);
              break;
            case 'End':
              event.preventDefault();
              focusRow(rows.length - 1);
              break;
            case 'F2':
              /* IDEA's ⇧F6 rename, reachable from the keyboard. */
              event.preventDefault();
              if (current !== null && current.path !== '') {
                setRenameState({ path: current.path, value: basename(current.path) });
              }
              break;
            case 'F6':
              /* ⇧F6 renames, F6 alone is IDEA's "Move to…". */
              if (current === null || current.path === '') break;
              event.preventDefault();
              if (event.shiftKey) {
                setRenameState({ path: current.path, value: basename(current.path) });
              } else {
                void openMoveTo(selection.size > 1 ? [...selection].filter((path) => path !== '') : current.path);
              }
              break;
            case 'Delete':
            case 'Backspace':
              event.preventDefault();
              if (selection.size > 1) void removeEntries([...selection]);
              else if (current !== null && current.path !== '') void removeEntry(current);
              break;
            case 'Escape':
              event.preventDefault();
              setRenameState(null);
              setCreateState(null);
              break;
            default:
              break;
          }
          /* ⌘/Ctrl+N opens a new file, ⌥⌘N a new directory — IDEA's Project shortcuts. */
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
            event.preventDefault();
            startCreate(event.altKey ? 'directory' : 'file');
          }
          /* ⌘R refreshes the tree, as the row menu advertises. */
          if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'r') {
            event.preventDefault();
            void refreshTree();
          }
        },
        [children, entries, expanded, manualOrder, openFile, openMoveTo, refreshTree, removeEntries, removeEntry, reorderManualProject, rows, selectedPath, selection, setSelectedPath, sortMode, startCreate, toggleDirectory],
      );

      const toggleCommitPath = React.useCallback((path) => {
        setCommitSelection((current) => {
          const next = new Set(current);
          if (next.has(path)) next.delete(path);
          else next.add(path);
          return next;
        });
      }, []);

      const changeTypeaheadBufferRef = React.useRef('');
      const changeTypeaheadAtRef = React.useRef(0);

      /**
       * Keyboard navigation for IDEA's Changes list.
       *
       * The list is one focusable tree in visual order (staged rows, then
       * unstaged, then unversioned), including only rows the current filter has
       * not hidden. Moving the cursor selects but never opens a diff; Enter is
       * the deliberate Show Diff, and Space toggles the commit checkbox.
       * @param {KeyboardEvent} event - keydown from the changes scroller.
       * @returns {void}
       */
      const onChangesKeyDown = React.useCallback((event) => {
        if (event.target instanceof Element && event.target.closest('input, textarea, select') !== null) return;
        const focused = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
        const node = focused?.closest('[data-dsh-changes-list]')
          ?? focused?.closest('[role="tree"]')
          ?? null;
        if (node === null) return;
        /* A row's keydown bubbles into the scroller. Act only for the element
           that owns the event; otherwise a row focus move re-runs the handler
           with `currentTarget=row` and walks one extra step. */
        if (focused !== node && focused !== event.target) return;
        const rows = [...node.querySelectorAll('[data-dsh-change-group], [data-dsh-change-path], [data-dsh-change-directory]')];
        if (rows.length === 0) return;
        const current = selectedChangeRef.current;
        const currentGroup = selectedGroupRef.current;
        const focusedRow = event.target instanceof Element
          ? event.target.closest('[data-dsh-change-group], [data-dsh-change-path], [data-dsh-change-directory]')
          : null;
        const focusedIndex = focusedRow === null ? -1 : rows.indexOf(focusedRow);
        const index = focusedIndex >= 0
          ? focusedIndex
          : currentGroup !== null
          ? rows.findIndex((row) => row.getAttribute('data-dsh-change-group') === currentGroup)
          : current === null ? -1 : rows.findIndex((row) =>
              row.getAttribute('data-dsh-change-path') === current.path
              && (row.getAttribute('data-dsh-change-staged') === 'true') === (current.staged === true));
        if (event.key.length === 1 && event.key !== ' ' && !event.metaKey && !event.ctrlKey && !event.altKey) {
          const fileRows = rows.filter((row) => row.hasAttribute('data-dsh-change-path'));
          const candidates = changeTypeaheadRows(fileRows.map((row, order) => ({
            path: row.getAttribute('data-dsh-change-path') ?? '',
            staged: row.getAttribute('data-dsh-change-staged') === 'true',
            order,
          }))).map((candidate) => ({ ...candidate, row: fileRows[candidate.order] }));
          const step = typeaheadStep({
            rows: candidates,
            buffer: changeTypeaheadBufferRef.current,
            path: current === null ? null : `${current.staged === true ? 'staged' : 'unstaged'}:${current.path}`,
            key: event.key,
            now: Date.now(),
            lastAt: changeTypeaheadAtRef.current,
          });
          changeTypeaheadBufferRef.current = step.buffer;
          changeTypeaheadAtRef.current = step.at;
          if (step.hit !== null) {
            const hit = candidates.find((candidate) => candidate.path === step.hit);
            if (hit !== undefined) {
              event.preventDefault();
              event.stopPropagation();
              chooseChange({ path: hit.workspacePath, staged: hit.staged }, { row: hit.row });
              hit.row.focus?.({ preventScroll: true });
              hit.row.scrollIntoView?.({ block: 'nearest' });
            }
          }
          /* A dead-end prefix leaves the key to the browser instead of swallowing it. */
          return;
        }
        const choose = (next) => {
          const row = rows[Math.max(0, Math.min(next, rows.length - 1))];
          if (row === undefined) return;
          const group = row.getAttribute('data-dsh-change-group');
          if (group !== null) {
            chooseGroup(group);
            row.focus?.({ preventScroll: true });
            return;
          }
          if (row.getAttribute('data-dsh-change-directory') !== null) {
            chooseGroup(null);
            row.focus?.({ preventScroll: true });
            row.scrollIntoView?.({ block: 'nearest' });
            return;
          }
          chooseChange({
            path: row.getAttribute('data-dsh-change-path'),
            staged: row.getAttribute('data-dsh-change-staged') === 'true',
          }, { shift: event.shiftKey, row });
          row.focus?.({ preventScroll: true });
        };
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          event.stopPropagation();
          choose(index < 0 ? 0 : index + 1);
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          event.stopPropagation();
          choose(index < 0 ? rows.length - 1 : index - 1);
          return;
        }
        if (event.key === 'Home') {
          event.preventDefault();
          event.stopPropagation();
          choose(0);
          return;
        }
        if (event.key === 'End') {
          event.preventDefault();
          event.stopPropagation();
          choose(rows.length - 1);
          return;
        }
        if (current === null) return;
        if (event.key === 'Enter') {
          event.preventDefault();
          event.stopPropagation();
          setActivity('commit');
          setPanelVisible(true);
          const focusedRow = event.target instanceof Element
            ? event.target.closest('[data-dsh-change-path]')
            : null;
          diffReturnFocusRef.current = focusedRow instanceof HTMLElement ? focusedRow : node;
          setDiffTarget({ path: current.path, staged: current.staged === true });
          setDiffActive(true);
          return;
        }
        if (event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          /* The keyup handler performs the toggle after the default is
             blocked. Doing it here as well would toggle twice. */
        }
      }, [chooseChange, chooseGroup, toggleCommitPath]);

      /**
       * Commit the Space toggle on keyup.
       *
       * Browsers dispatch the keydown first and use Space's default to scroll
       * or activate the focused row; treating keyup as the committed gesture
       * keeps one press to exactly one toggle and matches the native checkbox
       * timing. Arrow/Home/End continue to act on keydown.
       * @param {KeyboardEvent} event - keyup from the changes list or a row.
       * @returns {void}
       */
      const onChangesKeyUp = React.useCallback((event) => {
        if (event.key !== ' ' && event.key !== 'Spacebar') return;
        if (event.target instanceof Element && event.target.closest('input, textarea, select') !== null) return;
        const target = event.target instanceof Element ? event.target : null;
        const active = document.activeElement instanceof Element ? document.activeElement : null;
        const row = target?.closest('[data-dsh-change-path]') ?? active?.closest('[data-dsh-change-path]');
        const current = selectedChangeRef.current;
        const path = row?.getAttribute('data-dsh-change-path') ?? current?.path ?? null;
        if (path === null) return;
        event.preventDefault();
        event.stopPropagation();
        toggleCommitPath(path);
      }, [toggleCommitPath]);

      /* One group's checkbox toggles every file in it, like IDEA's changelist node. */
      const toggleCommitGroup = React.useCallback(
        (group) => {
          const changes = git?.changes ?? [];
          const members = splitChanges(changes)[group] ?? [];
          setCommitSelection((current) => {
            const next = new Set(current);
            const all = members.length > 0 && members.every((change) => next.has(change.path));
            for (const change of members) {
              if (all) next.delete(change.path);
              else next.add(change.path);
            }
            return next;
          });
        },
        [git],
      );

      /**
       * Flip one collapse key, or a whole list of them (the ⌥-click subtree case).
       *
       * Flipping a list against the SAME starting set is what makes the gesture
       * read as one action: deciding each key from a freshly read state would
       * toggle the first level and leave the rest in place.
       * @param {string|string[]} key - one collapse key or several.
       */
      const toggleCollapsedGroup = React.useCallback((key) => {
        const keys = Array.isArray(key) ? key : [key];
        if (keys.length === 0) return;
        setCollapsedGroups((current) => {
          const next = new Set(current);
          const collapse = !next.has(keys[0]);
          for (const entry of keys) {
            if (collapse) next.add(entry);
            else next.delete(entry);
          }
          writeCollapsedGroups(rootRef.current, next);
          return next;
        });
      }, []);

      /* Stage or unstage the ticked files without touching the rest of the index. */
      /* IDEA prefills the message box with the previous message while Amend is ticked. */
      /**
       * Toggle Amend, pre-filling the box from the previous commit.
       *
       * IDEA prefills subject AND body, and only when the box is empty: an amend
       * with a half-written new message must not be silently overwritten.
       */
      const toggleAmend = React.useCallback(
        (next) => {
          setAmend(next);
          if (!next) {
            /* Turning amend off restores what the user had before it was turned on. */
            if (preAmendMessage.current !== null) {
              setCommitMessage(preAmendMessage.current);
              preAmendMessage.current = null;
            }
            return;
          }
          const previous = git?.lastCommit;
          if (previous === null || previous === undefined) return;
          if (commitMessage.trim() !== '') return;
          preAmendMessage.current = commitMessage;
          const body = typeof previous.body === 'string' ? previous.body.trimEnd() : '';
          setCommitMessage(body === '' ? previous.subject : `${previous.subject}\n\n${body}`);
        },
        [commitMessage, git],
      );

      /**
       * Store one message in the per-workspace history, newest first.
       *
       * IDEA keeps roughly the last 20 messages; duplicates move to the top rather
       * than being appended twice, so ↑/↓ never cycles through the same text.
       * @param {string} message - submitted commit message.
       */
      const rememberMessage = React.useCallback(
        (message) => {
          const text = message.trim();
          if (text === '' || root === '') return;
          setMessageHistory((current) => {
            const next = [text, ...current.filter((entry) => entry !== text)].slice(0, 20);
            try {
              window.localStorage.setItem(`dsh-editor.commitHistory:${root}`, JSON.stringify(next));
            } catch {
              /* a storage-less browser keeps the in-memory history only */
            }
            return next;
          });
          setHistoryIndex(-1);
        },
        [root],
      );

      /**
       * Walk the message history with ↑/↓, returning to the draft after the oldest entry.
       * @param {number} direction - +1 older, -1 newer.
       */
      const recallMessage = React.useCallback(
        (direction) => {
          if (messageHistory.length === 0) return;
          /* Walking back past the newest entry must restore what the user had typed,
             not blank the box: the draft is not part of the history. */
          if (historyIndex === -1 && draftBeforeRecall.current === null) draftBeforeRecall.current = commitMessage;
          setHistoryIndex((current) => {
            const next = Math.max(-1, Math.min(messageHistory.length - 1, current + direction));
            if (next < 0) setCommitMessage(draftBeforeRecall.current ?? '');
            else setCommitMessage(messageHistory[next]);
            return next;
          });
        },
        [commitMessage, historyIndex, messageHistory],
      );

      /**
       * Select one message from the visible history menu.
       *
       * The menu is a direct jump, but it keeps the same draft-protection and
       * arrow-walk position as repeated ↑/↓, so switching interaction style does
       * not lose what the user was typing.
       * @param {number} index - history entry, newest first.
       * @returns {void}
       */
      const selectHistoryMessage = React.useCallback((index) => {
        if (!Number.isInteger(index) || index < 0 || index >= messageHistory.length) return;
        if (draftBeforeRecall.current === null && historyIndex === -1) draftBeforeRecall.current = commitMessage;
        setHistoryIndex(index);
        setCommitMessage(messageHistory[index]);
      }, [commitMessage, historyIndex, messageHistory]);

      /**
       * Put the just-committed message back into the box.
       *
       * IDEA's commit box has an undo for the clear; without it, a mis-click after
       * a long message means retyping it. The commit itself is never undone.
       */
      const restoreClearedMessage = React.useCallback(() => {
        if (clearedMessage === '') return;
        setCommitMessage(clearedMessage);
        setClearedMessage('');
        writeCommitDraft(root, clearedMessage);
      }, [clearedMessage, root]);

      /**
       * Push the current branch on its own, IDEA's "Push" action and the retry
       * path after a commit whose push was rejected.
       *
       * Publishing (no upstream yet) is handled by the host, so the failure the
       * user sees is the real reason rather than git's "no upstream" paragraph.
       */
      const pushNow = React.useCallback(async () => {
        setPushBusy(true);
        setPushError(null);
        try {
          const value = await callGit({ op: 'push' });
          setGit(value);
          setCommitNotice(value.published === true ? t('editor.pushedPublished', { branch: value.branch ?? '' }) : t('editor.pushed'));
          setCommitError(null);
        } catch (failure) {
          setPushError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setPushBusy(false);
        }
      }, [t]);

      /**
       * Fetch every remote without touching the working tree (IDEA's Fetch).
       *
       * Only remote-tracking refs move, so open buffers stay valid; the point of
       * running it is the refreshed `behind` count in the commit toolbar.
       * @returns {Promise<void>} resolves once the status has been refreshed.
       */
      const fetchNow = React.useCallback(async () => {
        setFetchBusy(true);
        setCommitError(null);
        try {
          const value = await callGit({ op: 'fetch' });
          setGit(value);
          setCommitNotice(t('editor.fetchDone', { count: (value?.remotes ?? []).length }));
          setPushError(null);
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setFetchBusy(false);
        }
      }, [t]);

      /**
       * IDEA's Update Project: fast-forward onto the upstream and re-read tabs.
       *
       * The working tree is rewritten by the update, so every open tab is read
       * again — otherwise the editor would show the pre-update text and the next
       * save would silently revert the update. Unsaved edits are confirmed first.
       * @returns {Promise<void>} resolves once the tree and tabs are refreshed.
       */
      const updateNow = React.useCallback(async () => {
        if ((openFilesRef.current ?? []).some((file) => file.dirty === true) && !window.confirm(t('editor.updateDirty'))) return;
        setUpdateBusy(true);
        setCommitError(null);
        setCommitNotice(null);
        try {
          const value = await callGit({ op: 'pull' });
          setGit(value);
          setDiffTarget(null);
          setExternalChanges({});
          await refreshTree();
          for (const file of openFilesRef.current) await reloadFile(file.path);
          /* The pull just moved HEAD: a Log tab still showing the old first page
             would hide the commits that arrived, so re-read it (and drop a file
             history filter, whose commit set the update may have rewritten). */
          setHistoryPath(null);
          await loadLog();
          setCommitNotice(t('editor.updateDone', { branch: value?.branch ?? '' }));
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setUpdateBusy(false);
        }
      }, [loadLog, reloadFile, refreshTree, t]);

      /**
       * IDEA's Commit tool-window options.
       *
       * Fetch, Update, Stash, Shelve and Group by are low-frequency commands. Keeping
       * them as separate toolbar buttons crowded out Refresh/Hide at a 200px tool
       * window, so they live behind the same Settings entry IDEA uses.
       * @param {{x: number, y: number}} position - toolbar popup anchor.
       * @returns {void}
       */
      const openCommitOptionsMenu = React.useCallback((position) => {
        const groupMenu = changeGroupMenu(position);
        const stageAllPaths = stageAllTargets(git?.changes ?? [], false);
        setMenu({
          owner: 'commit-options',
          x: position?.x ?? 240,
          y: position?.y ?? 120,
          title: t('editor.commitOptions'),
          items: [
            {
              id: 'fetch',
              label: fetchBusy ? t('editor.fetchBusy') : t('editor.fetchRemote'),
              disabled: fetchBusy,
              run: () => void fetchNow(),
            },
            {
              id: 'update',
              label: updateBusy ? t('editor.updateBusy') : t('editor.updateProject'),
              disabled: updateBusy,
              run: () => void updateNow(),
            },
            null,
            {
              id: 'applyPatchFile',
              label: t('editor.applyPatch'),
              disabled: commitBusy,
              run: applyPatchFile,
            },
            {
              id: 'applyPatchClipboard',
              label: t('editor.applyPatchFromClipboard'),
              disabled: commitBusy,
              run: () => void applyPatchClipboard(),
            },
            null,
            {
              id: 'stageAll',
              label: t('editor.stageAll'),
              disabled: commitBusy || stageAllPaths.length === 0,
              run: () => void stageEveryChange(false),
            },
            null,
            {
              id: 'stash',
              label: t('editor.stash'),
              run: () => void openStashMenu(position),
            },
            {
              id: 'shelve',
              label: t('editor.shelve'),
              run: () => void openShelveMenu(position),
            },
            null,
            {
              id: 'groupBy',
              label: t('editor.groupByMenu'),
              items: groupMenu.items,
            },
          ],
        });
      }, [applyPatchClipboard, applyPatchFile, changeGroupMenu, commitBusy, fetchBusy, fetchNow, git, openShelveMenu, openStashMenu, stageEveryChange, t, updateBusy, updateNow]);

      const commit = React.useCallback(
        async (push) => {
          const paths = [...commitSelection];
          if (commitMessage.trim() === '' || paths.length === 0) return;
          setCommitBusy(true);
          setCommitError(null);
          setCommitNotice(null);
          setPushError(null);
          try {
            const inspection = await callGit({ op: 'inspect', paths });
            /* inspect also reports the identity, so the guard costs no extra round trip. */
            setIdentityMissing(inspection.identity?.name === '' || inspection.identity?.email === '');
            if (inspection.conflicts.length > 0) {
              throw new Error(t('editor.commitConflicts', { count: inspection.conflicts.length }));
            }
            if (inspection.whitespace.length > 0 && !window.confirm(t('editor.commitWhitespace', { count: inspection.whitespace.length }))) {
              return;
            }
            /* IDEA warns that a commit leaves untracked files behind, but never blocks it. */
            const untrackedLeft = (git?.changes ?? []).filter((change) => change.status === '??' && !paths.includes(change.path));
            if (untrackedLeft.length > 0 && !window.confirm(t('editor.commitUntracked', { count: untrackedLeft.length }))) {
              return;
            }
            const value = await callGit({ op: 'commit', message: commitMessage, paths, amend, push });
            setGit(value);
            setCommitSelection(new Set((value?.changes ?? []).map((change) => change.path)));
            rememberMessage(commitMessage);
            /* Keep the text so the "cleared by mistake" case has a one-click undo. */
            setClearedMessage(commitMessage);
            setCommitMessage('');
            writeCommitDraft(root, '');
            setAmend(false);
            setDiffTarget(null);
            /* A rejected push keeps the commit: IDEA reports both outcomes separately. */
            setCommitNotice(t('editor.committed'));
            setCommitError(null);
            /* A rejected push keeps the commit: offer a dedicated retry rather than a bare message. */
            setPushError(value.pushError ?? null);
            setTreeError(null);
            /* IDEA refreshes the Log tab after a commit so the new row is there immediately. */
            await loadLog();
            /* Remember which commit we just made so the list can point at it. */
            const head = value?.lastCommit?.hash;
            if (typeof head === 'string' && head !== '') {
              setHighlightedCommit(head);
              setCommitMode('log');
            }
          } catch (error) {
            setCommitError(error instanceof Error ? error.message : String(error));
          } finally {
            setCommitBusy(false);
          }
        },
        [amend, commitMessage, commitSelection, git, loadLog, root, t],
      );

      const tabs = openFiles.map((file) => {
        const fileTabActive = diffActive === false && file.path === activePath;
        const preview = file.path === previewPath;
        return React.createElement(
          'div',
          {
            key: file.path,
            className: `${fileTabActive ? 'dsh-editor-tab dsh-editor-tab-active' : 'dsh-editor-tab'}${file.path === previewPath ? ' dsh-editor-tab-preview' : ''}`,
            style: {
              ...styles.tab,
              ...(fileTabActive ? styles.tabActive : null),
              ...(preview ? { fontStyle: 'italic' } : null),
              ...(editorTabDrop?.group === 'left' && editorTabDrop.path === file.path
                ? { boxShadow: editorTabDrop.after ? 'inset -2px 0 0 var(--dsw-alias-state-business-primary)' : 'inset 2px 0 0 var(--dsw-alias-state-business-primary)' }
                : null),
              ...(editorTabDrag?.group === 'left' && editorTabDrag.path === file.path ? { opacity: 0.55 } : null),
            },
            /* IDEA shows "name — full/path" and marks a dirty tab in its tooltip too. */
            title: file.dirty ? `${file.path} — ${t('editor.unsavedTitle')}` : file.path,
            'data-dsh-editor-file-tab-path': file.path,
            onClick: () => {
              setActivePath(file.path);
              setDiffActive(false);
            },
            onAuxClick: (event) => {
              /* Middle-click closes a tab, like IDEA and every browser. */
              if (event.button !== 1) return;
              event.preventDefault();
              closeFile(file.path);
            },
            draggable: true,
            onDragStart: (event) => beginEditorTabDrag(event, 'left', file.path),
            onDragOver: (event) => dragOverEditorTab(event, 'left', file.path),
            onDragLeave: () => setEditorTabDrop((current) => (current?.group === 'left' && current.path === file.path ? null : current)),
            onDrop: (event) => dropEditorTab(event, 'left', file.path),
            onDragEnd: () => {
              editorTabDragRef.current = null;
              setEditorTabDrag(null);
              setEditorTabDrop(null);
            },
            onContextMenu: (event) => {
              event.preventDefault();
              event.stopPropagation();
              setActivePath(file.path);
              setDiffActive(false);
              const tabIndex = allTabs.indexOf(file);
              const openIndex = openFiles.findIndex((entry) => entry.path === file.path);
              setMenu({
                x: event.clientX,
                y: event.clientY,
                items: [
                  ...(preview
                    ? [
                        {
                          id: 'keepTabOpen',
                          label: t('editor.keepTabOpen'),
                          run: () => {
                            if (previewPathRef.current === file.path) {
                              previewPathRef.current = null;
                              setPreviewPath(null);
                            }
                          },
                        },
                        null,
                      ]
                    : []),
                  { id: 'close', label: t('editor.closeTab', { name: basename(file.path) }), shortcut: '⌘W', run: () => closeFile(file.path) },
                  { id: 'closeOthers', label: t('editor.closeOtherTabs'), run: () => closeOtherTabs(file.path) },
                  { id: 'closeLeft', label: t('editor.closeTabsLeft'), disabled: tabIndex <= 0, run: () => closeEditorTabs(allTabs.slice(0, tabIndex)) },
                  { id: 'closeRight', label: t('editor.closeTabsRight'), disabled: tabIndex < 0 || tabIndex >= allTabs.length - 1, run: () => closeEditorTabs(allTabs.slice(tabIndex + 1)) },
                  { id: 'closeAll', label: t('editor.closeAllTabs'), run: () => closeAllTabs() },
                  null,
                  { id: 'moveLeft', label: t('editor.terminalMoveLeft'), disabled: openIndex <= 0, run: () => moveEditorTabByOffset('left', file.path, -1) },
                  { id: 'moveRight', label: t('editor.terminalMoveRight'), disabled: openIndex < 0 || openIndex >= openFiles.length - 1, run: () => moveEditorTabByOffset('left', file.path, 1) },
                  null,
                  { id: 'saveAll', label: t('editor.saveAll'), shortcut: '⌥⌘S', run: () => void saveAll() },
                  null,
                  { id: 'copyPath', label: t('editor.copyTabPath'), run: () => void navigator.clipboard?.writeText(root === '' ? file.path : `${root}/${file.path}`).catch(() => {}) },
                  { id: 'reveal', label: t('editor.revealInProject'), run: () => void revealActive(), disabled: file.path !== activePath },
                ],
              });
            },
          },
          /* IDEA always leads an editor tab with the same 16px file-type icon
             used by the Project view. Reuse EntryIcon so tab and tree never
             drift to different icon providers or sizes. */
          React.createElement(EntryIcon, { entry: { path: file.path, kind: 'file' }, expanded: false }),
          React.createElement('span', null, basename(file.path)),
          file.dirty ? React.createElement('span', { style: { color: 'var(--dsw-alias-state-business-primary)' } }, '●') : null,
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'dsh-editor-tab-close',
              style: styles.tabClose,
              'aria-label': t('editor.closeTab', { name: basename(file.path) }),
              title: t('editor.closeTab', { name: basename(file.path) }),
              onClick: (event) => {
                event.stopPropagation();
                closeFile(file.path);
              },
            },
            '×',
          ),
        );
      });

      /**
       * The diff's own editor tab, IDEA's "Commit: <name>".
       *
       * There is exactly ONE such tab: opening another change re-uses it and
       * swaps the content, the way IDEA replaces a single diff tab instead of
       * piling up one tab per changed file. A change or a commit's file reads
       * "Commit: <name>"; clipboard / revision comparisons read "Compare:".
       */
      const diffIsCompare = diffTarget !== null && (typeof diffTarget.clipboardText === 'string' || typeof diffTarget.revision === 'string');
      const diffTabName = diffTarget === null
        ? ''
        : diffTarget.repositoryVersion !== null && typeof diffTarget.repositoryVersion === 'object'
          ? t('editor.repositoryVersionTab', {
              name: basename(diffTarget.path),
              hash: String(diffTarget.repositoryVersion.hash ?? '').slice(0, 7),
            })
          : diffTarget.combined === true
          ? diffTarget.revisionPair !== null && typeof diffTarget.revisionPair === 'object'
            ? t('editor.compareRevisionsTitle', { count: diffTarget.entries?.length ?? 0 })
            : typeof diffTarget.commitWithLocal === 'string'
            ? t('editor.compareWithLocalTitle', { count: diffTarget.entries?.length ?? 0 })
            : t('editor.combinedDiffTitle', { count: diffTarget.entries?.length ?? 0 })
          : t(diffIsCompare ? 'editor.compareTab' : 'editor.commitTab', { name: basename(diffTarget.path) });
      const diffTab =
        diffTarget === null
          ? null
          : React.createElement(
              'div',
              {
                key: 'dsh-editor-difftab',
                className: diffActive ? 'dsh-editor-tab dsh-editor-tab-active dsh-editor-diff-tab' : 'dsh-editor-tab dsh-editor-diff-tab',
                style: { ...styles.tab, ...(diffActive ? styles.tabActive : null) },
                title: diffTarget.combined === true || diffTarget.repositoryVersion !== null && typeof diffTarget.repositoryVersion === 'object'
                  ? diffTabName
                  : `${diffTabName} — ${diffTarget.path}`,
                onClick: () => setDiffActive(true),
                onAuxClick: (event) => {
                  if (event.button !== 1) return;
                  event.preventDefault();
                  closeDiff();
                },
                onContextMenu: (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setDiffActive(true);
                  const diffTabIndex = allTabs.indexOf(DIFF_TAB_KEY);
                  setMenu({
                    x: event.clientX,
                    y: event.clientY,
                    items: [
                      { id: 'close', label: t('editor.closeTab', { name: diffTabName }), shortcut: '⌘W', run: () => closeDiff() },
                      { id: 'closeOthers', label: t('editor.closeOtherTabs'), disabled: openFiles.length === 0, run: () => closeEditorTabs(openFiles.map((file) => file.path)) },
                      { id: 'closeRight', label: t('editor.closeTabsRight'), disabled: openFiles.length === 0, run: () => closeEditorTabs(allTabs.slice(diffTabIndex + 1)) },
                      { id: 'closeAll', label: t('editor.closeAllTabs'), run: () => closeAllTabs() },
                      ...(diffTarget.combined === true
                        ? []
                        : [
                            null,
                            { id: 'openFile', label: t('editor.openInEditor'), run: () => void openFile(diffTarget.path) },
                          ]),
                    ],
                  });
                },
              },
              /* IDEA puts the diff glyph first: the tab reads as a change, not as
                 a file, and the name is clipped from the END so the prefix stays. */
              React.createElement(Icon, { name: 'commit', size: 11 }),
              React.createElement('span', { style: styles.tabLabel }, diffTabName),
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'dsh-editor-tab-close',
                  style: styles.tabClose,
                  'aria-label': t('editor.closeTab', { name: diffTabName }),
                  title: t('editor.closeTab', { name: diffTabName }),
                  onClick: (event) => {
                    event.stopPropagation();
                    closeDiff();
                  },
                },
                '×',
              ),
            );

      /* One layout for this render: which tabs fit and which go to `»`. The diff
         tab is pinned FIRST, so the one tab the user is reading never overflows. */
      const allTabs = diffTab === null ? openFiles : [DIFF_TAB_KEY, ...openFiles];
      const activeTabKey = diffActive ? DIFF_TAB_KEY : activePath;
      const fileTabElement = (entry) => (entry === DIFF_TAB_KEY ? diffTab : tabs[openFiles.indexOf(entry)] ?? null);
      const fileTabLayout = overflowTabs(allTabs, visibleTabCount(tabStripWidth, allTabs.length), activeTabKey, (entry) => (entry === DIFF_TAB_KEY ? DIFF_TAB_KEY : entry.path));
      const splitTabLayout = overflowTabs(splitTabs, visibleTabCount(splitTabStripWidth, splitTabs.length), splitPath, (path) => path);

      /* IDEA's breadcrumbs: workspace root › directories › the open file. */
      const breadcrumbSegments = activeFile !== null && diffOpen === false
        ? (() => {
            const parts = activeFile.path.split('/');
            const segments = [{ label: projectName, path: '', kind: 'root' }];
            let prefix = '';
            for (let index = 0; index < parts.length; index += 1) {
              prefix = prefix === '' ? parts[index] : `${prefix}/${parts[index]}`;
              segments.push({
                label: parts[index],
                path: prefix,
                kind: index === parts.length - 1 ? 'file' : 'directory',
              });
            }
            return segments;
          })()
        : [];

      const findToolWindowElement = findTool === null
        ? null
        : React.createElement(FindToolWindow, {
            t,
            state: findTool,
            floating: findTool.surface !== 'dock',
            activeFilePath: activePath,
            openFilePaths: openFiles.map((file) => file.path),
            openFilesRef,
            changedFilePaths: (git?.changes ?? []).map((change) => change.path),
            queryHistory: recentFindQueries,
            replaceHistory: recentReplacements,
            onQuery: (query) => {
              setFindTool((current) => (current === null
                ? current
                : {
                    ...current,
                    query,
                    files: [],
                    matches: [],
                    index: 0,
                    error: null,
                    loadedGeneration: -1,
                    searchGeneration: (current.searchGeneration ?? 0) + 1,
                  }));
            },
            onReplace: (replace) => setFindTool((current) => (current === null ? current : { ...current, replace })),
            onToggleCaseSensitive: () => setFindTool((current) => (current === null
              ? current
              : {
                  ...current,
                  caseSensitive: current.caseSensitive !== true,
                  files: [],
                  matches: [],
                  index: 0,
                  error: null,
                  loadedGeneration: -1,
                  searchGeneration: (current.searchGeneration ?? 0) + 1,
                })),
            onToggleWholeWords: () => setFindTool((current) => (current === null
              ? current
              : {
                  ...current,
                  wholeWords: current.regex !== true && current.wholeWords !== true,
                  files: [],
                  matches: [],
                  index: 0,
                  error: null,
                  loadedGeneration: -1,
                  searchGeneration: (current.searchGeneration ?? 0) + 1,
                })),
            onToggleRegex: () => setFindTool((current) => (current === null
              ? current
              : {
                  ...current,
                  regex: current.regex !== true,
                  wholeWords: false,
                  files: [],
                  matches: [],
                  index: 0,
                  error: null,
                  loadedGeneration: -1,
                  searchGeneration: (current.searchGeneration ?? 0) + 1,
                })),
            onTogglePreserveCase: () => setFindTool((current) => (current === null
              ? current
              : { ...current, preserveCase: current.preserveCase !== true })),
            onToggleIncludeExcluded: () => setFindTool((current) => (current === null
              ? current
              : {
                  ...current,
                  includeExcluded: current.includeExcluded !== true,
                  files: [],
                  matches: [],
                  index: 0,
                  error: null,
                  loadedGeneration: -1,
                  searchGeneration: (current.searchGeneration ?? 0) + 1,
                })),
            onFileMaskChange: (fileMask) => setFindTool((current) => (current === null
              ? current
              : {
                  ...current,
                  fileMask,
                  files: [],
                  matches: [],
                  index: 0,
                  error: null,
                  loadedGeneration: -1,
                  searchGeneration: (current.searchGeneration ?? 0) + 1,
                })),
            onScopeChange: changeFindToolScope,
            onMove: (direction, count, absolute = null) =>
              setFindTool((current) => {
                if (current === null) return current;
                if (count === 0) return { ...current, index: 0 };
                if (Number.isFinite(absolute)) return { ...current, index: Math.max(0, Math.min(count - 1, absolute)) };
                return { ...current, index: (current.index + direction + count) % count };
              }),
            onOpen: (result, openInNewTab = false) => {
              if (openInNewTab) {
                void openInRightSplit(result.path, result.kind === 'text'
                  ? { path: result.path, line: result.line, column: result.column }
                  : null);
                return;
              }
              if (result.kind === 'text') {
                openFileAtLocation(result.path, result.line, result.column);
                return;
              }
              void openFile(result.path);
            },
            onOpenInRightSplit: (path, location) => void openInRightSplit(path, location),
            onRevealResult: (path) => void revealPath(path),
            onNotify: (message) => flashStatus(message),
            onReplaceMode: () => setFindTool((current) => current === null ? current : { ...current, mode: 'replace' }),
            onReplaceOccurrence: (match, activeIndex) => void replaceFindToolOccurrence(match, activeIndex),
            onReplaceAll: (allowedPaths) => void replaceInFindTool(allowedPaths),
            onOpenSettings: openFindToolSettings,
            onOpenInFindWindow: openFindToolInDock,
            onClose: closeFindToolWindow,
          });

      return React.createElement(
        'div',
        {
          style: styles.root,
          'data-dsh-editor-workspace': '',
          'data-dsh-workspace-id': workspaceId || undefined,
          'data-dsh-editor-gutter-surface': 'idea',
        },
        /* No title/save/refresh bar: the tool-window toolbars already sit at the top,
           the breadcrumb strip names the open file, and saving belongs to ⌘/Ctrl+S
           (plus ⌥⌘S for "save all"), so a second row only cost vertical space. */
        menu === null ? null : React.createElement(ContextMenu, { menu, onClose: () => setMenu(null), t }),
        showUsages === null
          ? null
          : React.createElement(ShowUsagesPopup, {
              t,
              state: showUsages,
              onFilterChange: (filter) => setShowUsages((current) => (current === null
                ? current
                : { ...current, filter, index: 0 })),
              onMove: (index) => setShowUsages((current) => (current === null
                ? current
                : { ...current, index })),
              onOpen: (match) => {
                setShowUsages(null);
                openFileAtLocation(match.path, match.line, match.column);
              },
              onPin: pinShowUsages,
              onOpenInRightSplit: (path, location) => {
                setShowUsages(null);
                void openInRightSplit(path, location);
              },
              onRevealResult: (path) => {
                setShowUsages(null);
                void revealPath(path);
              },
              onNotify: (message) => flashStatus(message),
              onClose: () => setShowUsages(null),
            }),
        searchEverywhere === null
          ? null
          : React.createElement(SearchEverywhere, {
              t,
              state: searchEverywhere,
              files: searchEverywhere.files ?? [],
              changes: new Map((git?.changes ?? []).map((change) => [change.path, change.status])),
              textMatches: searchEverywhere.textMatches ?? [],
              actions: searchEverywhereActions,
              recentSearches,
              recentFindUsages,
              recentCommands,
              historyRequest: searchHistoryRequest,
              findUsagesHistoryRequest,
              replaceHistory: recentReplacements,
              textLoading: searchEverywhere.textLoading === true,
              textTruncated: searchEverywhere.textTruncated === true,
              error: searchEverywhere.error ?? null,
              replaceBusy: searchEverywhere.replaceBusy === true,
              onQuery: (query) => setSearchEverywhere((current) => (current === null ? current : { ...current, query, index: 0 })),
              onTab: (tab) => setSearchEverywhere((current) => (current === null ? current : { ...current, tab, index: 0 })),
              onMove: (direction, count, absolute = null) =>
                setSearchEverywhere((current) => {
                  if (current === null) return current;
                  if (count === 0) return { ...current, index: 0 };
                  if (Number.isFinite(absolute)) return { ...current, index: Math.max(0, Math.min(count - 1, absolute)) };
                  return { ...current, index: (current.index + direction + count) % count };
                }),
              onActivate: (result) => {
                if (result.kind === 'action') {
                  if (result.keepOpen !== true) setSearchEverywhere(null);
                  result.run?.();
                  return;
                }
                setSearchEverywhere(null);
                if (result.kind === 'text') {
                  openFileAtLocation(result.path, result.line, result.column);
                  return;
                }
                void openFile(result.path);
              },
              onClose: closeSearchEverywhere,
              onReplaceChange: (replace) => setSearchEverywhere((current) => (current === null ? current : { ...current, replace })),
              onReplaceAll: () => void replaceInFiles(),
              onRememberQuery: rememberSearchEverywhereQuery,
              onRememberCommand: rememberSearchEverywhereCommand,
              onOpenFindUsagesHistory: openFindUsages,
              onOpenInFindToolWindow: (initial) => openFindTool(
                initial?.query ?? searchEverywhere.query,
                initial?.mode === 'replace' ? 'replace' : 'find',
                initial,
                'query',
                'dock',
              ),
              onToggleIncludeNonProject: toggleIncludeNonProject,
              onToggleCaseSensitive: () => setSearchEverywhere((current) => (current === null
                ? current
                : {
                    ...current,
                    caseSensitive: current.caseSensitive !== true,
                    textMatches: [],
                    textRevision: (current.textRevision ?? 0) + 1,
                    index: 0,
                    error: null,
                  })),
              onToggleWholeWords: () => setSearchEverywhere((current) => (current === null
                ? current
                : {
                    ...current,
                    wholeWords: current.regex !== true && current.wholeWords !== true,
                    textMatches: [],
                    textRevision: (current.textRevision ?? 0) + 1,
                    index: 0,
                    error: null,
                  })),
              onToggleRegex: () => setSearchEverywhere((current) => (current === null
                ? current
                : {
                    ...current,
                    regex: current.regex !== true,
                    wholeWords: false,
                    textMatches: [],
                    textRevision: (current.textRevision ?? 0) + 1,
                    index: 0,
                    error: null,
                  })),
              onTogglePreserveCase: () => setSearchEverywhere((current) => (current === null
                ? current
                : { ...current, preserveCase: current.preserveCase !== true })),
              onFileMaskChange: (fileMask) => setSearchEverywhere((current) => (current === null
                ? current
                : {
                    ...current,
                    fileMask,
                    textMatches: [],
                    textRevision: (current.textRevision ?? 0) + 1,
                    index: 0,
                    error: null,
                  })),
              onOpenInRightSplit: (path, location) => void openInRightSplit(path, location),
              onRevealResult: (path) => void revealPath(path),
              onNotify: (message) => flashStatus(message),
            }),
        quickOpen === null
          ? null
          : React.createElement(QuickOpen, {
              t,
              mode: paletteMode,
              files: quickOpen.files ?? [],
              /* The palette marks changed files exactly like the tree does. */
              changes: new Map((git?.changes ?? []).map((change) => [change.path, change.status])),
              loading: quickOpen.loading === true,
              query: quickOpen.query,
              index: quickOpen.index,
              onQuery: (query) => setQuickOpen((current) => (current === null ? current : { ...current, query, index: 0 })),
              onMove: (direction, count) =>
                setQuickOpen((current) =>
                  current === null ? current : { ...current, index: count === 0 ? 0 : (current.index + direction + count) % count },
                ),
              onOpen: (path) => {
                setQuickOpen(null);
                void openFile(path);
              },
              onClose: () => setQuickOpen(null),
            }),
        namePrompt === null
          ? null
          : React.createElement(NamePrompt, {
              t,
              state: namePrompt,
              onChange: (value) => setNamePrompt((current) => (current === null ? current : { ...current, value, error: '' })),
              onSubmit: () => void submitNamePrompt(),
              onClose: () => setNamePrompt(null),
            }),
        moveTo === null
          ? null
          : React.createElement(MoveToPicker, {
              t,
              state: moveTo,
              onQuery: (query) => setMoveTo((current) => (current === null ? current : { ...current, query, index: 0 })),
              onMove: (direction, count) =>
                setMoveTo((current) =>
                  current === null ? current : { ...current, index: count === 0 ? 0 : (current.index + direction + count) % count },
                ),
              onPick: (directory) => {
                const sources = moveTo.sources ?? [];
                setMoveTo(null);
                void moveEntry(sources, directory);
              },
              onClose: () => setMoveTo(null),
            }),
        revisionPicker === null
          ? null
          : React.createElement(RevisionPicker, {
              t,
              state: revisionPicker,
              onQuery: (query) => setRevisionPicker((current) => (current === null ? current : { ...current, query, index: 0 })),
              onMove: (direction, count) =>
                setRevisionPicker((current) =>
                  current === null ? current : { ...current, index: count === 0 ? 0 : (current.index + direction + count) % count },
                ),
              onPick: (hash) => {
                const path = revisionPicker.path;
                setRevisionPicker(null);
                if (typeof hash === 'string' && hash !== '') setDiffTarget({ path, revision: hash, staged: false });
              },
              onClose: () => setRevisionPicker(null),
            }),
        React.createElement(
          'div',
          { style: styles.body },
          React.createElement(ActivityStripe, {
            activity,
            panelVisible,
            terminalOpen,
            harnessCollapsed,
            onSelect: selectActivity,
            onToggleHarness: toggleHarness,
            onCloseEditor,
            t,
          }),
          panelVisible
            ? React.createElement(
                'div',
                {
                  style: {
                    ...styles.sidePanel,
                    flex: toolPanelFlex(activity, toolWidths[activity] ?? (activity === 'project' ? 28 : 25)),
                    cursor: sideDragging ? 'col-resize' : undefined,
                  },
                },
                activity === 'project'
                  ? React.createElement(ProjectPanel, {
                      t,
                      root,
                      home,
                      entries,
                      children,
                      expanded,
                      rows,
                      projectRows,
                      projectView,
                      onProjectViewChange: applyProjectView,
                      filteredView,
                      supportsExpansion: projectTreeActionsAvailable,
                      emptyMessage: projectView === 'openFiles'
                        ? t('editor.noOpenFiles')
                        : projectView === 'changedFiles'
                          ? t('editor.noChangedFiles')
                          : '',
                      selectedPath,
                      selection,
                      hasActiveFile: activePath !== null,
                      git,
                      loading: treeLoading,
                      error: treeError,
                      createState,
                      onToggle: toggleDirectory,
                      onOpen: openFile,
                      onOpenPreview: (path) => void openFile(path, { preview: true }),
                      onSelect: selectRow,
                      onOpenCreateMenu: (event) => {
                        /* PanelToolbar's overflow menu invokes an action without a
                           DOM event. Fall back to the tree's box so keyboard Enter
                           on "New…" still opens the choice menu. */
                        const rect = event?.currentTarget?.getBoundingClientRect?.()
                          ?? treeRef.current?.getBoundingClientRect();
                        if (rect === undefined || rect === null) return;
                        setMenu({
                          x: Math.max(4, rect.left),
                          y: rect.bottom + 4,
                          title: t('editor.newFile'),
                          items: [
                            { id: 'newFile', label: t('editor.newFile'), shortcut: '⌘N', run: () => startCreate('file') },
                            { id: 'newFolder', label: t('editor.newFolder'), shortcut: '⌥⌘N', run: () => startCreate('directory') },
                          ],
                        });
                      },
                      optionsOpen: menu?.owner === 'project-options',
                      onOpenOptions: (event) => {
                        /* Same contract as New: Options may itself sit inside the
                           overflow menu, whose run callback has no event. */
                        const rect = event?.currentTarget?.getBoundingClientRect?.()
                          ?? treeRef.current?.getBoundingClientRect();
                        if (rect === undefined || rect === null) return;
                        setMenu({
                          owner: 'project-options',
                          x: Math.min(window.innerWidth - 212, Math.max(4, rect.right - 204)),
                          y: rect.bottom + 4,
                          title: t('editor.options'),
                          items: [
                            { id: 'refresh', label: t('editor.refresh'), shortcut: '⌘R', restoreFocus: false, run: () => runProjectOption(() => void refreshTree()) },
                            { id: 'gotoFile', label: t('editor.gotoFileHint'), run: () => void openQuickOpen() },
                            { id: 'recent', label: t('editor.recentFilesHint'), run: () => openRecent() },
                            null,
                            { id: 'expandAll', label: t('editor.expandAll'), disabled: !projectExpandAllAvailable, restoreFocus: false, run: () => runProjectOption(() => void expandAll()) },
                            null,
                            {
                              id: 'behavior',
                              label: t('editor.projectOptionsBehavior'),
                              items: [
                                { id: 'previewTab', label: t('editor.projectPreviewTab'), shortcut: previewTabEnabled ? '✓' : '', restoreFocus: false, run: () => runProjectOption(() => togglePreviewTab()) },
                                { id: 'singleClickOpen', label: t('editor.openFilesSingleClick'), shortcut: singleClickOpen ? '✓' : '', restoreFocus: false, run: () => runProjectOption(() => toggleSingleClickOpen()) },
                                { id: 'openDirectoriesSingleClick', label: t('editor.openDirectoriesSingleClick'), shortcut: openDirectoriesSingleClick ? '✓' : '', restoreFocus: false, run: () => runProjectOption(() => toggleOpenDirectoriesSingleClick()) },
                                { id: 'autoscroll', label: t('editor.alwaysSelectOpenedFile'), shortcut: autoScroll === false ? '' : '✓', restoreFocus: false, run: () => runProjectOption(() => toggleAutoScroll()) },
                              ],
                            },
                            {
                              id: 'appearance',
                              label: t('editor.projectOptionsAppearance'),
                              items: [
                                { id: 'showSection', kind: 'section', label: t('editor.projectOptionsShow') },
                                { id: 'showExcludedFiles', label: t('editor.showExcludedFiles'), shortcut: showExcludedFiles ? '✓' : '', restoreFocus: false, run: () => runProjectOption(() => toggleShowExcludedFiles()) },
                                { id: 'compactDirectories', label: t('editor.compactDirectories'), shortcut: compactDirectories ? '✓' : '', restoreFocus: false, run: () => runProjectOption(() => toggleCompactDirectories()) },
                                { id: 'hidden', label: t('editor.showHidden'), shortcut: showHidden ? '✓' : '', restoreFocus: false, run: () => runProjectOption(() => {
                                  setShowHidden((current) => {
                                    const next = !current;
                                    try {
                                      window.localStorage.setItem('dsh-editor.project.showHidden', next ? '1' : '0');
                                    } catch {
                                      /* a storage-less browser keeps the in-memory choice */
                                    }
                                    return next;
                                  });
                                }) },
                                null,
                                { id: 'sortSection', kind: 'section', label: t('editor.projectOptionsSortBy') },
                                ...['name', 'type', 'modified', 'modified-asc', 'manual'].map((mode) => {
                                  const labelMode = mode === 'modified-asc' ? 'modified_asc' : mode;
                                  return {
                                    id: `sort:${mode}`,
                                    label: t(`editor.sort_${labelMode}`),
                                    shortcut: (sortMode ?? 'name') === mode ? '✓' : '',
                                    restoreFocus: false,
                                    run: () => runProjectOption(() => applySortMode(mode)),
                                  };
                                }),
                                {
                                  id: 'resetManualOrder',
                                  label: t('editor.resetManualOrderAction'),
                                  disabled: Object.keys(manualOrder).length === 0,
                                  restoreFocus: false,
                                  run: () => runProjectOption(() => {
                                    setManualOrder({});
                                    writeProjectManualOrder(root, {});
                                    flashStatus(t('editor.manualOrderReset'));
                                  }),
                                },
                                { id: 'foldersFirst', label: t('editor.foldersAlwaysOnTop'), shortcut: foldersFirst ? '✓' : '', restoreFocus: false, run: () => runProjectOption(() => toggleFoldersFirst()) },
                              ],
                            },
                          ],
                        });
                      },
                      onCreateChange: (value) => setCreateState((current) => (current === null ? current : { ...current, value })),
                      onCreateCommit: createEntry,
                      onCreateCancel: () => setCreateState(null),
                      onCreateParent: (parent) => setCreateState((current) => (current === null ? current : { ...current, parent })),
                      onCreateTemplate: (template) => setCreateState((current) => (current === null ? current : { ...current, template })),
                      onReveal: revealActive,
                      onExpandSelected: () => void expandSelectedTree(),
                      onExpandAll: expandAll,
                      canCollapseAll: projectCanCollapseAll(expanded),
                      onCollapseAll: collapseAll,
                      onNotify: (message) => flashStatus(message),
                      onRefresh: refreshTree,
                      onHide: () => setPanelVisible(false),
                      rowRefs,
                      treeRef,
                      onTreeKeyDown,
                      onContextMenu: (payload) => setMenu(buildTreeMenu(payload)),
                      onRootContextMenu: ({ x, y }) => setMenu({
                        owner: 'project-root',
                        ...buildTreeMenu({
                          row: { name: projectName, path: '', kind: 'directory', root: true },
                          x,
                          y,
                        }),
                      }),
                      rootContextMenuOpen: menu?.owner === 'project-root',
                      onDrop: (source, target) => void moveEntry(source, target),
                      /* Rename is reached from the context menu and F2/⇧F6 only. */
                      showHidden,
                      foldersFirst,
                      showExcludedFiles,
                      sortMode,
                      onManualReorder: reorderManualProject,
                      onCycleSort: () => cycleSort(),
                      /* Remembered: whether dot-entries are visible is a reading
                         preference, not a per-session accident. */
                      onToggleHidden: () =>
                        setShowHidden((current) => {
                          const next = !current;
                          try {
                            window.localStorage.setItem('dsh-editor.project.showHidden', next ? '1' : '0');
                          } catch {
                            /* a storage-less browser keeps the in-memory choice */
                          }
                          return next;
                        }),
                      autoScroll,
                      onToggleAutoScroll: () => toggleAutoScroll(),
                      singleClickOpen,
                      onToggleSingleClickOpen: () => toggleSingleClickOpen(),
                      openDirectoriesSingleClick,
                      onToggleOpenDirectoriesSingleClick: () => toggleOpenDirectoriesSingleClick(),
                      compactDirectories,
                      renameState,
                      onRenameChange: (value) => setRenameState((current) => (current === null ? current : { ...current, value })),
                      onRenameCommit: () => void commitRename(),
                      onRenameCancel: () => setRenameState(null),
                      deletedPaths,
                      newPaths,
                    })
                  : activity === 'commit'
                    ? React.createElement(CommitPanel, {
                        t: commitEnglish,
                        git,
                        selectedPaths: commitSelection,
                        message: commitMessage,
                        amend,
                        busy: commitBusy,
                        error: commitError,
                        onRetryStatus: () => void loadGit(),
                        notice: commitNotice,
                        diffTarget,
                        selectedChange,
                        selectedGroup,
                        selectedChanges,
                        chosenChangeList: chosenChanges(selectedChange),
                        collapsedGroups,
                        monacoReady,
                        onTogglePath: toggleCommitPath,
                        onToggleGroup: toggleCommitGroup,
                        onToggleDirectory: toggleCollapsedGroup,
                        onSelectChange: (target) => chooseChange(target, target),
                        onSelectGroup: chooseGroup,
                        onChangesKeyDown,
                        onChangesKeyUp,
                        changeRowRefs,
                        onSelectDiff: (target) => {
                          /* Previewing from the panel always shows the diff, even
                             when the user had walked back to a file tab. A second
                             click on the same change toggles the preview off. */
                          setActivity('commit');
                          setPanelVisible(true);
                          const same = diffTarget !== null && diffActive && diffTarget.path === target.path && diffTarget.staged === target.staged;
                          diffReturnFocusRef.current = changeRowRefs.current.get(
                            `${target.staged === true ? 'staged' : 'unstaged'}:${target.path}`,
                          ) ?? null;
                          setDiffTarget(same ? null : target);
                          setDiffActive(true);
                        },
                        onShowDiff: (target) => {
                          /* IDEA's Show Diff is a deliberate action on the selected
                             row; unlike a double click it never closes an existing
                             diff when the same row is pressed again. */
                          setActivity('commit');
                          setPanelVisible(true);
                          diffReturnFocusRef.current = changeRowRefs.current.get(
                            `${target.staged === true ? 'staged' : 'unstaged'}:${target.path}`,
                          ) ?? null;
                          setDiffTarget(target);
                          setDiffActive(true);
                        },
                        onShowCombinedDiff: showCombinedDiff,
                        onSelectOpenedChange: () => {
                          const path = activePathRef.current;
                          if (path === null) return;
                          const candidate = (gitRef.current?.changes ?? []).find((change) => change.path === path);
                          if (candidate === undefined) {
                            setCommitNotice(t('editor.openedFileNotChanged'));
                            return;
                          }
                          const staged = candidate.status[0] !== ' ' && candidate.status[0] !== '?';
                          chooseChange({ path, staged }, {});
                          window.setTimeout(() => changeRowRefs.current.get(`${staged ? 'staged' : 'unstaged'}:${path}`)?.focus(), 0);
                        },
                        onExpandChanges: () => {
                          setCollapsedGroups(new Set());
                          writeCollapsedGroups(rootRef.current, new Set());
                        },
                        onCollapseChanges: () => {
                          const all = new Set();
                          const changesNow = gitRef.current?.changes ?? [];
                          const bands = splitChanges(changesNow);
                          for (const [id, entries] of Object.entries(bands)) {
                            if (entries.length === 0) continue;
                            all.add(`${id}:`);
                            for (const change of entries) {
                              for (let index = change.path.indexOf('/'); index >= 0; index = change.path.indexOf('/', index + 1)) {
                                all.add(`${id}:${change.path.slice(0, index)}`);
                              }
                            }
                          }
                          setCollapsedGroups(all);
                          writeCollapsedGroups(rootRef.current, all);
                        },
                        onRollbackSelected: (picked) => {
                          const working = [...new Set(picked.filter((entry) => entry.staged !== true).map((entry) => entry.path))];
                          if (working.length > 0) void rollback(working);
                        },
                        onRollbackGroup: (group, paths) => {
                          if (paths.length === 0) return;
                          if (group === 'staged') void rollback(paths, { staged: true });
                          else if (group === 'unversioned') void rollback(paths, { unversioned: true });
                          else void rollback(paths);
                        },
                        onStage: (paths) => void restage(paths, false),
                        onStageAllTracked: () => void stageEveryChange(true),
                        onUnstage: (paths) => void restage(paths, true),
                        onGitignore: (paths) => void addToGitignore(paths),
                        onCopyPatch: (targets) => void copySelectedPatch(targets),
                        onCreatePatch: (targets) => void createSelectedPatch(targets),
                        onShelve: (position) => void openShelveMenu(position),
                        onContextMenu: (payload) => setMenu(payload.directory === undefined ? buildChangeMenu(payload) : buildChangeDirMenu(payload)),
                        mode: commitMode,
                        scrollRefs: { changes: commitChangesRef, log: commitLogRef },
                        onRestoreScroll: rememberCommitScroll,
                        onMode: (next) => {
                          switchCommitMode(next);
                          if (next === 'log') void loadLog();
                        },
                        commits,
                        logLoading,
                        logDetail,
                        onLoadLog: loadLog,
                        onSelectCommit: (hash) => void showCommit(hash),
                        onOpenFile: (path) => void openFile(path),
                        onEditSource: editLocalVersion,
                        onShowCommitDiff: showCommitDiff,
                        historyPath,
                        onClearHistory: clearFileHistory,
                        logAuthor,
                        onLogAuthor: changeLogAuthor,
                        onLoadMoreLog: () => void loadMoreLog(),
                        logExhausted,
                        onLogContextMenu: (payload) => setMenu(buildLogMenu(payload)),
                        highlightedCommit,
                        graph,
                        onLoadGraph: () => void loadGraph(graph?.branch ?? '', graph?.at ?? ''),
                        onGraphBranch: (branch) => void loadGraph(branch, ''),
                        selected: selectedCommit,
                        selectedCommits: logSelectedCommits,
                        onSelectCommits: setLogSelectedCommits,
                        logFailure: logError,
                        onFileMenu: (payload) => setMenu(buildCommitFileMenu(payload)),
                        onRetry: () => {
                          void loadLog();
                          if (graph !== null) void loadGraph(graph.branch ?? '', graph.at ?? '');
                        },
                        onGraphRef: (ref) => {
                          const scope = refScopeOf(ref, graph);
                          if (scope.branch === '' && scope.at === '') return;
                          void loadGraph(scope.branch, scope.at);
                        },
                        onMessage: (value) => {
                          setCommitMessage(value);
                          setHistoryIndex(-1);
                          /* Typing is the user taking over: the saved draft is no longer relevant. */
                          draftBeforeRecall.current = null;
                        },
                        history: messageHistory,
                        onRecall: (direction) => recallMessage(direction),
                        onPickHistory: (index) => selectHistoryMessage(index),
                        onAmend: toggleAmend,
                        onCommit: commit,
                        onRefresh: loadGit,
                        onHide: () => setPanelVisible(false),
                        projectName,
                        branchMenuOpen: menu?.owner === 'branch-menu',
                        onBranchMenu: (position) => void openBranchMenu(position),
                        onOptionsMenu: (position) => openCommitOptionsMenu(position),
                        viewOptionsOpen: menu?.owner === 'changes-view-options',
                        templates: COMMIT_TEMPLATES,
                        onTemplate: applyCommitTemplate,
                        identityMissing,
                        pushFailure: pushError,
                        onPush: () => void pushNow(),
                        undoMessage: clearedMessage,
                        onUndoMessage: restoreClearedMessage,
                        pushing: pushBusy,
                        groupBy,
                        optionsOpen: menu?.owner === 'commit-options',
                        onViewOptionsMenu: (position) => openChangesViewMenu(position),
                        pathQuery,
                        onPathQuery: setPathQuery,
                        onRevealChange: (target) => revealChangeRow(target),
                      })
                    : null,
              )
            : null,
          panelVisible
            ? React.createElement('div', {
                style: styles.sideResize,
                title: t('editor.resizeToolWindow'),
                onMouseDown: (event) => {
                  event.preventDefault();
                  const body = event.currentTarget.parentElement;
                  if (body === null) return;
                  const total = body.getBoundingClientRect().width - 42;
                  const startX = event.clientX;
                  const startWidth = toolWidths[activity] ?? 25;
                  setSideDragging(true);
                  const onMove = (moveEvent) => {
                    const delta = ((moveEvent.clientX - startX) / Math.max(1, total)) * 100;
                    const next = Math.max(14, Math.min(72, startWidth + delta));
                    setToolWidths((current) => ({ ...current, [activity]: next }));
                  };
                  const onUp = () => {
                    setSideDragging(false);
                    const final = toolWidthsRef.current[activity] ?? startWidth;
                    writeToolWidth(rootRef.current, activity, final);
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                  };
                  window.addEventListener('mousemove', onMove);
                  window.addEventListener('mouseup', onUp);
                },
              })
            : null,
          React.createElement(
            'div',
            { style: styles.mainColumn },
            React.createElement(
              'div',
              { style: styles.editorSurface },
              React.createElement(
                'div',
                {
                  ref: fileTabStripRef,
                  style: styles.tabStrip,
                  /* Runtime-verifiable facts: how many tabs are open vs rendered. */
                  'data-dsh-open-tabs': String(openFiles.length + (diffTab === null ? 0 : 1)),
                  /* A NUL byte in an HTML attribute is asking for trouble: the diff
                     tab reports itself as `commit:`, the file paths as themselves. */
                  'data-dsh-open-list': allTabs.map((entry) => (entry === DIFF_TAB_KEY ? 'commit:' : entry.path)).join('|'),
                  'data-dsh-hidden-tabs': String(fileTabLayout.hidden.length),
                  'data-dsh-editor-tabstrip': '',
                },
                /* IDEA collapses what does not fit into a `»` list; the terminal dock
                   already does this, and a file tab you just opened must not scroll
                   out of view while the strip silently widens. */
                fileTabLayout.visible.map((entry) => fileTabElement(entry)),
                fileTabLayout.hidden.length === 0
                  ? null
                  : React.createElement(
                      'button',
                      {
                        type: 'button',
                        className: 'dsh-editor-tab-overflow',
                        style: styles.tabOverflow,
                        title: t('editor.tabsOverflow', { count: fileTabLayout.hidden.length }),
                        'aria-label': t('editor.tabsOverflow', { count: fileTabLayout.hidden.length }),
                        onClick: (event) => {
                          const rect = event.currentTarget.getBoundingClientRect();
                          const hidden = fileTabLayout.hidden;
                          setMenu({
                            x: Math.max(4, rect.left - 180),
                            y: rect.bottom + 4,
                            title: t('editor.tabsOverflowTitle'),
                            items: hidden.map((entry) =>
                              entry === DIFF_TAB_KEY
                                ? { id: 'tab:diff', label: diffTabName, run: () => setDiffActive(true) }
                                : {
                                    id: `tab:${entry.path}`,
                                    /* The full path, because two `index.ts` must stay apart. */
                                    label: entry.dirty ? `${entry.path} •` : entry.path,
                                    run: () => {
                                      setActivePath(entry.path);
                                      setDiffActive(false);
                                    },
                                  },
                            ),
                          });
                        },
                      },
                      '»',
                    ),
              ),
              /* IDEA's breadcrumb trail under the tabs; a directory segment reveals it in Project. */
              breadcrumbSegments.length === 0
                ? null
                : React.createElement(
                    'div',
                    { style: styles.breadcrumbBar, 'aria-label': t('editor.breadcrumb') },
                    React.createElement(
                      'span',
                      { style: styles.breadcrumbTrail },
                      breadcrumbSegments.map((segment, index) =>
                        React.createElement(
                          React.Fragment,
                          { key: `${segment.path}:${index}` },
                          index === 0
                            ? null
                            : React.createElement('span', { style: styles.breadcrumbSeparator }, '›'),
                          React.createElement(
                            'button',
                            {
                              type: 'button',
                              style: { ...styles.breadcrumbItem, ...(index === breadcrumbSegments.length - 1 ? styles.breadcrumbItemActive : null) },
                              title: segment.path === '' ? root : segment.path,
                              onClick: () => {
                                if (segment.kind === 'file') {
                                  setActivePath(segment.path);
                                  return;
                                }
                                /* IDEA reveals the directory in Project; it never collapses it. */
                                setActivity('project');
                                setPanelVisible(true);
                                setSelectedPath(segment.path === '');
                                void expandTo(segment.path);
                              },
                            },
                            index === 0
                              ? React.createElement(Icon, { name: 'project', size: 11 })
                              : segment.kind === 'directory'
                                ? React.createElement(Icon, { name: 'folder', size: 11 })
                                : React.createElement(Icon, { name: 'file', size: 11 }),
                            segment.label,
                          ),
                        ),
                      ),
                    ),
                    markdownAvailable
                      ? React.createElement(MarkdownModeSwitch, {
                          mode: effectiveMarkdownMode,
                          onMode: setMarkdownMode,
                          t,
                        })
                      : null,
                  ),
              gotoState === null
                ? null
                : React.createElement(
                    'div',
                    { style: styles.gotoLineBar },
                    React.createElement('span', { style: { ...styles.findCount, minWidth: 60 } }, t('editor.gotoLine')),
                    React.createElement('input', {
                      style: styles.findInput,
                      autoFocus: true,
                      placeholder: t('editor.gotoLinePlaceholder'),
                      value: gotoState.value,
                      onChange: (event) => setGotoState({ value: event.target.value }),
                      onKeyDown: (event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          commitGotoLine();
                        } else if (event.key === 'Escape') {
                          event.preventDefault();
                          setGotoState(null);
                          editorRef.current?.focus();
                        }
                      },
                    }),
                    React.createElement(
                      'button',
                      { type: 'button', style: styles.conflictAction, onClick: () => commitGotoLine() },
                      t('editor.gotoLine'),
                    ),
                    React.createElement(
                      'button',
                      { type: 'button', style: styles.conflictAction, onClick: () => setGotoState(null) },
                      '×',
                    ),
                  ),
              replaceState === null
                ? null
                : React.createElement(
                    'div',
                    { style: styles.findBar },
                    React.createElement('input', {
                      'data-dsh-editor-find-input': '',
                      style: styles.findInput,
                      autoFocus: true,
                      placeholder: t('editor.find'),
                      value: replaceState.find,
                      onChange: (event) => updateFind({ find: event.target.value }),
                      onKeyDown: (event) => {
                        if (event.altKey === true && event.key === 'ArrowDown') {
                          openEditorFindHistory(event, 'query');
                        } else if (event.key === 'Enter') {
                          event.preventDefault();
                          jumpToMatch(event.shiftKey ? -1 : 1);
                        } else if (event.key === 'Escape') {
                          event.preventDefault();
                          closeFind();
                        }
                      },
                    }),
                    React.createElement(ToolbarButton, {
                      icon: 'history',
                      label: t('editor.findSearchHistory'),
                      ariaHasPopup: 'menu',
                      ariaExpanded: editorFindHistoryMenu?.kind === 'query',
                      onClick: (event) => openEditorFindHistory(event, 'query'),
                    }),
                    React.createElement(
                      'span',
                      { style: styles.findCount },
                      replaceState.total === 0 ? t('editor.noMatches') : `${replaceState.index + 1}/${replaceState.total}`,
                    ),
                    React.createElement(ToolbarButton, {
                      icon: 'matchCase',
                      label: t('editor.searchMatchCase'),
                      active: replaceState.caseSensitive === true,
                      onClick: () => toggleFindOption('caseSensitive'),
                    }),
                    React.createElement(ToolbarButton, {
                      icon: 'wholeWords',
                      label: t('editor.searchWholeWords'),
                      active: replaceState.wholeWords === true,
                      disabled: replaceState.regex === true,
                      onClick: () => toggleFindOption('wholeWords'),
                    }),
                    React.createElement(ToolbarButton, {
                      icon: 'regex',
                      label: t('editor.searchRegex'),
                      active: replaceState.regex === true,
                      onClick: () => toggleFindOption('regex'),
                    }),
                    replaceState.withReplace === true
                      ? React.createElement(ToolbarButton, {
                          icon: 'preserveCase',
                          label: t('editor.searchPreserveCase'),
                          active: replaceState.preserveCase === true,
                          onClick: () => toggleFindOption('preserveCase'),
                        })
                      : null,
                    React.createElement(ToolbarButton, {
                      icon: 'target',
                      label: t('editor.searchInSelectionOnly'),
                      active: replaceState.scope !== null,
                      onClick: () => toggleFindSelectionScope(),
                    }),
                    replaceState.error === null
                      ? null
                      : React.createElement(
                          'span',
                          {
                            style: { ...styles.findCount, color: 'var(--dsw-alias-state-error-primary)' },
                            role: 'alert',
                            title: replaceState.error,
                          },
                          replaceState.error,
                        ),
                    React.createElement(ToolbarButton, { icon: 'chevronDown', label: t('editor.findNext'), onClick: () => jumpToMatch(1) }),
                    React.createElement(ToolbarButton, { icon: 'chevronRight', label: t('editor.findPrevious'), onClick: () => jumpToMatch(-1) }),
                    replaceState.withReplace === true
                      ? React.createElement(ToolbarButton, {
                          icon: 'check',
                          label: t('editor.replaceCurrent'),
                          disabled: replaceState.error !== null || replaceState.total === 0,
                          onClick: () => replaceCurrent(),
                        })
                      : null,
                    replaceState.withReplace === true
                      ? React.createElement('input', {
                          'data-dsh-editor-find-replace-input': '',
                          style: styles.findInput,
                          placeholder: t('editor.replace'),
                          value: replaceState.replace,
                          onChange: (event) => setReplaceState((current) => (current === null ? current : { ...current, replace: event.target.value })),
                          onKeyDown: (event) => {
                            if (event.isComposing === true) return;
                            if (event.altKey === true && event.key === 'ArrowDown') openEditorFindHistory(event, 'replace');
                            else if (event.key === 'Enter') {
                              event.preventDefault();
                              event.stopPropagation();
                              if (replaceState.error === null && replaceState.total > 0) replaceCurrent();
                            } else if (event.key === 'Escape') {
                              event.preventDefault();
                              closeFind();
                            }
                          },
                        })
                      : null,
                    replaceState.withReplace === true
                      ? React.createElement(ToolbarButton, {
                          icon: 'history',
                          label: t('editor.findReplaceHistory'),
                          ariaHasPopup: 'menu',
                          ariaExpanded: editorFindHistoryMenu?.kind === 'replace',
                          onClick: (event) => openEditorFindHistory(event, 'replace'),
                        })
                      : null,
                    replaceState.withReplace === true
                      ? React.createElement(
                          'button',
                          {
                            type: 'button',
                            style: {
                              ...styles.conflictAction,
                              opacity: replaceState.error === null && replaceState.total > 0 ? 1 : 0.45,
                            },
                            disabled: replaceState.error !== null || replaceState.total === 0,
                            onClick: () => replaceAll(),
                          },
                          t('editor.replaceAll'),
                        )
                      : null,
                    React.createElement(
                      'button',
                      { type: 'button', style: styles.conflictAction, onClick: () => closeFind() },
                      '×',
                    ),
                    editorFindHistoryMenu === null
                      ? null
                      : React.createElement(
                          'div',
                          { 'data-dsh-editor-find-history-menu': '' },
                          React.createElement(ContextMenu, {
                            t,
                            menu: {
                              x: editorFindHistoryMenu.x,
                              y: editorFindHistoryMenu.y,
                              title: editorFindHistoryMenu.kind === 'query'
                                ? t('editor.findSearchHistory')
                                : t('editor.findReplaceHistory'),
                              items: (() => {
                                const values = editorFindHistoryMenu.kind === 'query'
                                  ? readSearchHistory(rootRef.current)
                                  : readReplaceHistory(rootRef.current);
                                return values.length === 0
                                  ? [{ id: 'empty', label: t('editor.findHistoryEmpty'), disabled: true, run: () => {} }]
                                  : values.map((value, index) => ({
                                      id: `${editorFindHistoryMenu.kind}:${index}`,
                                      label: value,
                                      run: () => {
                                        if (editorFindHistoryMenu.kind === 'query') updateFind({ find: value });
                                        else setReplaceState((current) => (current === null ? current : { ...current, replace: value }));
                                        setEditorFindHistoryMenu(null);
                                      },
                                    }));
                              })(),
                            },
                            onClose: () => setEditorFindHistoryMenu(null),
                          }),
                        ),
                  ),
              monacoError !== null
                ? React.createElement('div', { style: styles.error }, `${t('editor.monacoError')}: ${monacoError}`)
                : null,
              editorError !== null ? React.createElement('div', { style: styles.error }, editorError) : null,
              activePath !== null && externalChanges[activePath] !== undefined && conflict === null
                ? React.createElement(
                    'div',
                    { style: styles.conflictBar },
                    React.createElement(
                      'span',
                      { style: { minWidth: 0, flex: '1 1 auto' } },
                      /* A deleted file cannot be "reloaded": say what happened, offer recreation. */
                      externalChanges[activePath].missing === true ? t('editor.externalDeleted') : t('editor.externalChanged'),
                    ),
                    externalChanges[activePath].missing === true
                      ? React.createElement(
                          'button',
                          { type: 'button', style: styles.conflictAction, onClick: () => void recreateActive() },
                          t('editor.recreateFile'),
                        )
                      : React.createElement(
                          'button',
                          { type: 'button', style: styles.conflictAction, onClick: () => void reloadActiveFromDisk() },
                          t('editor.reload'),
                        ),
                    React.createElement(
                      'button',
                      { type: 'button', style: styles.conflictAction, onClick: () => dismissExternal(activePath) },
                      t('editor.keepLocal'),
                    ),
                  )
                : null,
              conflict === null
                ? null
                : React.createElement(
                    'div',
                    { style: styles.conflictBar },
                    React.createElement('span', { style: { minWidth: 0, flex: '1 1 auto' } }, t('editor.saveConflict', { path: conflict.path })),
                    React.createElement(
                      'button',
                      { type: 'button', style: styles.conflictAction, onClick: () => void saveActive(true) },
                      t('editor.overwrite'),
                    ),
                    React.createElement(
                      'button',
                      { type: 'button', style: styles.conflictAction, onClick: () => reloadActiveFromDisk() },
                      t('editor.reloadFromDisk'),
                    ),
                    React.createElement(
                      'button',
                      { type: 'button', style: styles.conflictAction, onClick: () => setConflict(null) },
                      t('editor.dismiss'),
                    ),
                  ),
              /* A terminal in the editor area owns the surface: "no file open" is
                 then a lie, and the two boxes would split the height 50/50. */
              activeFile === null && splitFile === null && diffOpen === false && annotateTarget === null && monacoError === null && editorTerminals.length === 0
                ? React.createElement('div', { style: styles.empty }, t('editor.noFile'))
                : null,
              React.createElement(
                'div',
                {
                  style: {
                    ...styles.editorSplitRow,
                    display: fileSurfaceVisible ? 'flex' : 'none',
                  },
                  'data-dsh-editor-file-surface': '',
                },
                React.createElement(
                  'div',
                  {
                    style: {
                      display: 'flex',
                      flex: splitFile === null ? '1 1 0' : `0 0 clamp(96px, ${editorSplitPercent}%, calc(100% - 103px))`,
                      minWidth: 0,
                      minHeight: 0,
                      overflow: 'hidden',
                      borderTop: `2px solid ${leftFocused ? 'var(--dsw-alias-state-business-primary)' : 'transparent'}`,
                    },
                    'data-dsh-markdown-workspace': '',
                  },
                  React.createElement('div', {
                    ref: containerRef,
                    style: {
                      ...styles.editorContainer,
                      flex: '1 1 0',
                      display: effectiveMarkdownMode === 'preview' ? 'none' : undefined,
                    },
                    'data-dsh-markdown-editor-pane': '',
                  }),
                  markdownAvailable
                    ? React.createElement(MarkdownPreviewPane, {
                        key: activePath,
                        t,
                        path: activePath,
                        content: activeFile?.content ?? '',
                        visible: markdownPreviewVisible,
                        paneRef: markdownPreviewRef,
                        onOpenFile: (path) => (path === '' ? Promise.resolve(false) : openFile(path, { silentError: true })),
                      })
                    : null,
                ),
                splitFile === null
                  ? null
                  : React.createElement(
                      'div',
                      {
                        style: {
                          ...styles.editorSplitDivider,
                          background: editorSplitDragging
                            ? 'var(--dsw-alias-state-business-primary)'
                            : 'var(--dsw-alias-bg-layer-1)',
                        },
                        role: 'separator',
                        'aria-orientation': 'vertical',
                        'aria-valuemin': 20,
                        'aria-valuemax': 80,
                        'aria-valuenow': Math.round(editorSplitPercent),
                        title: t('editor.resizeEditorSplit'),
                        'data-dsh-editor-split-divider': '',
                        onMouseDown: (event) => {
                          event.preventDefault();
                          const row = event.currentTarget.parentElement;
                          if (row === null) return;
                          const rect = row.getBoundingClientRect();
                          let latest = editorSplitPercent;
                          setEditorSplitDragging(true);
                          const onMove = (moveEvent) => {
                            const next = clampEditorSplitPercent(((moveEvent.clientX - rect.left) / Math.max(1, rect.width)) * 100, rect.width);
                            latest = next;
                            setEditorSplitPercent(next);
                          };
                          const onUp = () => {
                            setEditorSplitDragging(false);
                            const final = Math.round(clampEditorSplitPercent(latest, rect.width));
                            writeStoredNumber('dsh-editor.editor.splitPercent', final);
                            window.removeEventListener('mousemove', onMove);
                            window.removeEventListener('mouseup', onUp);
                          };
                          window.addEventListener('mousemove', onMove);
                          window.addEventListener('mouseup', onUp);
                        },
                      },
                    ),
                splitFile === null
                  ? null
                  : React.createElement(
                      'div',
                      {
                        style: {
                          ...styles.editorSplitPane,
                          borderTop: `2px solid ${splitFocused ? 'var(--dsw-alias-state-business-primary)' : 'transparent'}`,
                        },
                        'data-dsh-editor-split': '',
                      },
                      React.createElement(
                        'div',
                        { style: styles.editorSplitHeader },
                        React.createElement(Icon, { name: 'split', size: 11 }),
                        React.createElement(
                          'div',
                          {
                            ref: splitTabStripRef,
                            style: {
                              ...styles.editorSplitTabs,
                              position: 'relative',
                              boxSizing: 'border-box',
                              paddingRight: splitTabLayout.hidden.length === 0 ? 0 : 28,
                            },
                            'data-dsh-editor-split-tabs': '',
                            'data-dsh-editor-split-hidden-tabs': String(splitTabLayout.hidden.length),
                          },
                          splitTabLayout.visible.map((splitTab) => {
                            const splitTabFile = openFiles.find((file) => file.path === splitTab) ?? null;
                            const splitTabActive = splitTab === splitFile.path;
                            const splitTabIndex = splitTabs.indexOf(splitTab);
                            return React.createElement(
                              'div',
                              {
                                key: splitTab,
                                role: 'tab',
                                'aria-selected': splitTabActive,
                                style: {
                                  ...styles.editorSplitTab,
                                  ...(splitTabActive ? styles.editorSplitTabActive : null),
                                  ...(splitTabLayout.hidden.length === 0 ? null : { maxWidth: '100%', minWidth: 0, overflow: 'hidden' }),
                                  ...(editorTabDrop?.group === 'right' && editorTabDrop.path === splitTab
                                    ? { boxShadow: editorTabDrop.after ? 'inset -2px 0 0 var(--dsw-alias-state-business-primary)' : 'inset 2px 0 0 var(--dsw-alias-state-business-primary)' }
                                    : null),
                                  ...(editorTabDrag?.group === 'right' && editorTabDrag.path === splitTab ? { opacity: 0.55 } : null),
                                },
                                title: splitTabFile?.dirty === true ? `${splitTab} — ${t('editor.unsavedTitle')}` : splitTab,
                                'data-dsh-editor-split-path': splitTab,
                                onClick: () => {
                                  splitPathRef.current = splitTab;
                                  setSplitPath(splitTab);
                                  window.setTimeout(() => splitEditorRef.current?.focus?.(), 0);
                                },
                                onAuxClick: (event) => {
                                  if (event.button !== 1) return;
                                  event.preventDefault();
                                  closeSplitTab(splitTab);
                                },
                                draggable: true,
                                onDragStart: (event) => beginEditorTabDrag(event, 'right', splitTab),
                                onDragOver: (event) => dragOverEditorTab(event, 'right', splitTab),
                                onDragLeave: () => setEditorTabDrop((current) => (current?.group === 'right' && current.path === splitTab ? null : current)),
                                onDrop: (event) => dropEditorTab(event, 'right', splitTab),
                                onDragEnd: () => {
                                  editorTabDragRef.current = null;
                                  setEditorTabDrag(null);
                                  setEditorTabDrop(null);
                                },
                                onContextMenu: (event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setMenu({
                                    x: event.clientX,
                                    y: event.clientY,
                                    title: basename(splitTab),
                                    items: [
                                      {
                                        id: 'close',
                                        label: t('editor.closeTab', { name: basename(splitTab) }),
                                        shortcut: '⌘W',
                                        run: () => closeSplitTab(splitTab),
                                      },
                                      {
                                        id: 'closeOthers',
                                        label: t('editor.closeOtherTabs'),
                                        disabled: splitTabs.length <= 1,
                                        run: () => closeSplitTabs(splitTabs.filter((path) => path !== splitTab)),
                                      },
                                      {
                                        id: 'closeLeft',
                                        label: t('editor.closeTabsLeft'),
                                        disabled: splitTabIndex <= 0,
                                        run: () => closeSplitTabs(splitTabs.slice(0, splitTabIndex)),
                                      },
                                      {
                                        id: 'closeRight',
                                        label: t('editor.closeTabsRight'),
                                        disabled: splitTabIndex < 0 || splitTabIndex >= splitTabs.length - 1,
                                        run: () => closeSplitTabs(splitTabs.slice(splitTabIndex + 1)),
                                      },
                                      {
                                        id: 'closeAll',
                                        label: t('editor.closeAllTabs'),
                                        run: () => closeSplitTabs(splitTabs),
                                      },
                                      null,
                                      {
                                        id: 'moveLeft',
                                        label: t('editor.terminalMoveLeft'),
                                        disabled: splitTabIndex <= 0,
                                        run: () => moveEditorTabByOffset('right', splitTab, -1),
                                      },
                                      {
                                        id: 'moveRight',
                                        label: t('editor.terminalMoveRight'),
                                        disabled: splitTabIndex < 0 || splitTabIndex >= splitTabs.length - 1,
                                        run: () => moveEditorTabByOffset('right', splitTab, 1),
                                      },
                                      null,
                                      {
                                        id: 'save',
                                        label: t('editor.save'),
                                        shortcut: '⌘S',
                                        run: () => void savePath(splitTab),
                                      },
                                      {
                                        id: 'copyPath',
                                        label: t('editor.copyRelativePath'),
                                        run: () => void navigator.clipboard?.writeText(splitTab).catch(() => {}),
                                      },
                                      {
                                        id: 'reveal',
                                        label: t('editor.revealInProject'),
                                        run: () => void revealPath(splitTab),
                                      },
                                    ],
                                  });
                                },
                              },
                              /* A split tab is still a file tab in IDEA: keep
                                 its file-type icon even while the dirty dot is
                                 visible. The old generic commit glyph made an
                                 edited file look like a diff tab. */
                              React.createElement(EntryIcon, { entry: { path: splitTab, kind: 'file' }, expanded: false }),
                              React.createElement('span', { style: styles.tabLabel }, basename(splitTab)),
                              splitTabFile?.dirty === true
                                ? React.createElement('span', { style: { color: 'var(--dsw-alias-state-business-primary)' } }, '●')
                                : null,
                              React.createElement(
                                'button',
                                {
                                  type: 'button',
                                  className: 'dsh-editor-tab-close',
                                  style: styles.tabClose,
                                  'aria-label': t('editor.closeTab', { name: basename(splitTab) }),
                                  title: t('editor.closeTab', { name: basename(splitTab) }),
                                  onClick: (event) => {
                                    event.stopPropagation();
                                    closeSplitTab(splitTab);
                                  },
                                },
                                '×',
                              ),
                            );
                          }),
                          splitTabLayout.hidden.length === 0
                            ? null
                            : React.createElement(
                                'button',
                                {
                                  type: 'button',
                                  style: {
                                    ...styles.tabOverflow,
                                    position: 'absolute',
                                    top: 0,
                                    right: 0,
                                    zIndex: 2,
                                    height: '100%',
                                    margin: 0,
                                    background: 'var(--dsw-alias-bg-layer-1)',
                                  },
                                  title: t('editor.tabsOverflow', { count: splitTabLayout.hidden.length }),
                                  'aria-label': t('editor.tabsOverflow', { count: splitTabLayout.hidden.length }),
                                  onClick: (event) => {
                                    const rect = event.currentTarget.getBoundingClientRect();
                                    setMenu({
                                      x: Math.max(4, rect.left - 190),
                                      y: rect.bottom + 4,
                                      title: t('editor.tabsOverflowTitle'),
                                      items: splitTabLayout.hidden.map((path) => {
                                        const file = openFiles.find((entry) => entry.path === path) ?? null;
                                        return {
                                          id: `split-tab:${path}`,
                                          label: file?.dirty === true ? `${path} •` : path,
                                          run: () => {
                                            splitPathRef.current = path;
                                            setSplitPath(path);
                                            window.setTimeout(() => splitEditorRef.current?.focus?.(), 0);
                                          },
                                        };
                                      }),
                                    });
                                  },
                                },
                                '»',
                              ),
                        ),
                        React.createElement(
                          'button',
                          {
                            type: 'button',
                            style: styles.tabClose,
                            'aria-label': t('editor.closeSplit'),
                            title: t('editor.closeSplit'),
                            onClick: closeRightSplit,
                          },
                          '▣',
                        ),
                      ),
                      React.createElement('div', { ref: splitContainerRef, style: styles.editorContainer }),
                    ),
              ),
              /* A terminal moved into the editor owns the code area, the way IDEA's
                 editor tab does: one surface at a time, not a split. */
              editorTerminals.length === 0 || diffOpen || annotateTarget !== null
                ? null
                : React.createElement(EditorTerminalTab, {
                    t,
                    terminal: editorTerminals[editorTerminals.length - 1],
                    fontSize: 12,
                    getCwd: () => editorTerminals[editorTerminals.length - 1]?.cwd ?? '',
                    onGrid: () => {},
                    onError: (message) => setEditorError(message),
                    onInput: (id, data) => {
                      /* Typing has to reach the PTY the dock would have written to. */
                      void callTerminal({ op: 'write', id, data }).catch(() => {});
                    },
                    onTitle: () => {},
                    onCwd: () => {},
                    onExit: () => {},
                    onReturnToDock: (terminal) => returnEditorTerminalToDock(terminal),
                  }),
              /* A change selected in the Commit tool window opens as a diff in the editor area. */
              diffOpen === false
                ? null
                : diffTarget?.repositoryVersion !== null && typeof diffTarget?.repositoryVersion === 'object'
                  ? React.createElement(RepositoryVersionPreview, {
                      t,
                      target: diffTarget,
                      monacoReady,
                      onClose: closeDiff,
                      onOpenLocal: (path) => void openFile(path),
                    })
                : React.createElement(DiffPreview, {
                    t,
                    target: diffTarget,
                    includedInCommit: diffTarget === null ? false : commitSelection.has(diffTarget.path),
                    monacoReady,
                    onClose: closeDiff,
                    onRestored: (value) => {
                      /* Kept as the success hook for callers that want to react;
                         the status snapshot goes through `onStatus` so adopting it
                         does not rebuild the diff. */
                    },
                    onStatus: (value) => {
                      setGit((current) => (value === null || typeof value !== 'object' ? current : value));
                    },
                    onNotice: (message) => flashStatus(message),
                    onNavigate: (entry) => {
                      setDiffTarget({
                        path: entry.path,
                        staged: entry.staged === true,
                      });
                      setDiffActive(true);
                    },
                    filePosition: diffFilePosition,
                    onPreviousFile: () => navigateDiffFile('previous'),
                    onNextFile: () => navigateDiffFile('next'),
                    onOpenLocal: (localTarget) => void openFile(localTarget.path),
                    undoRef: diffUndoRef,
                    redoRef: diffRedoRef,
                    viewStatesRef: diffViewStatesRef,
                    searchInChangesRef: diffSearchInChangesRef,
                  }),
              annotateTarget === null
                ? null
                : React.createElement(AnnotatePreview, {
                    t,
                    target: annotateTarget,
                    lines: annotateLines,
                    loading: annotateLoading,
                    truncated: annotateTruncated,
                    onClose: () => setAnnotateTarget(null),
                    onOpenCommit: openCommitFromAnnotate,
                    selected: selectedCommit,
                  }),
              /* IDEA's editor status bar; a diff and an empty editor hide the caret facts. */
              statusFile === null || diffOpen || annotateTarget !== null
                ? null
                : React.createElement(
                    'div',
                    { style: styles.editorStatus },
                    React.createElement('span', { style: styles.statusItem }, t('editor.statusBarPosition', { line: caret.line, column: caret.column })),
                    React.createElement(
                      'button',
                      {
                        type: 'button',
                        style: { ...styles.statusItem, ...styles.statusButton },
                        title: t('editor.indentToggle'),
                        onClick: () => toggleIndentation(),
                      },
                      fileMode.insertSpaces ? `␣${fileMode.tabSize}` : `⇥${fileMode.tabSize}`,
                    ),
                    React.createElement(
                      'button',
                      {
                        type: 'button',
                        style: { ...styles.statusItem, ...styles.statusButton },
                        title: t('editor.toggleEol'),
                        onClick: () => toggleLineSeparator(),
                      },
                      fileMode.eol,
                    ),
                    React.createElement('span', { style: styles.statusItem }, fileMode.encoding),
                    React.createElement('span', { style: styles.statusItem }, t('editor.lineCount', { count: lineStats.lines })),
                    lineStats.selected > 0
                      ? React.createElement('span', { style: styles.statusItem }, t('editor.selectionInfo', { count: lineStats.selected }))
                      : null,
                    React.createElement('span', { style: styles.toolbarSpacer }),
                    statusNotice === null
                      ? null
                      : React.createElement('span', { style: styles.statusItem, role: 'status' }, statusNotice),
                    React.createElement(ToolbarButton, { icon: 'search', label: t('editor.gotoLine'), onClick: () => gotoLine() }),
                    React.createElement(ToolbarButton, { icon: 'annotate', label: t('editor.annotate'), onClick: () => void toggleAnnotate() }),
                    statusFile.dirty
                      ? React.createElement('span', { style: styles.statusItem }, t('editor.unsaved'))
                      : React.createElement('span', { style: styles.statusItem }, t('editor.saved')),
                  ),
            ),
            findTool === null || findTool.surface === 'dock'
              ? null
              : React.createElement(
                  'div',
                  {
                    style: styles.findToolPopup,
                    'data-dsh-find-tool-popup': '',
                  },
                  findToolWindowElement,
                ),
            findTool?.surface === 'dock' && terminalOpen === false
              ? React.createElement(
                  'div',
                  {
                    style: { ...styles.dock, height: findToolDockHeight },
                    'data-dsh-find-tool-dock': '',
                  },
                  React.createElement('div', {
                    style: { ...styles.dockResize, cursor: 'row-resize' },
                    title: t('editor.findToolDockResize'),
                    onMouseDown: (event) => {
                      event.preventDefault();
                      const startY = event.clientY;
                      const startHeight = findToolDockHeight;
                      const onMove = (moveEvent) => {
                        const next = clampFindDockHeight(startHeight + (startY - moveEvent.clientY));
                        setFindToolDockHeight(next);
                      };
                      const onUp = () => {
                        window.removeEventListener('mousemove', onMove);
                        window.removeEventListener('mouseup', onUp);
                        writeStoredNumber('dsh-editor.find.height', findToolDockHeightRef.current);
                      };
                      window.addEventListener('mousemove', onMove);
                      window.addEventListener('mouseup', onUp);
                    },
                  }),
                  findToolWindowElement,
                )
              : null,
            terminalOpen
              ? React.createElement(
                  'div',
                  { style: { ...styles.dock, height: terminalHeight } },
                  React.createElement('div', {
                    style: { ...styles.dockResize, cursor: dockDragging ? 'row-resize' : 'row-resize' },
                    title: t('editor.resizeTerminal'),
                    onMouseDown: (event) => {
                      event.preventDefault();
                      const startY = event.clientY;
                      const startHeight = terminalHeight;
                      setDockDragging(true);
                      const onMove = (moveEvent) => {
                        const next = startHeight + (startY - moveEvent.clientY);
                        setTerminalHeight(clampTerminalHeight(next));
                      };
                      const onUp = () => {
                        setDockDragging(false);
                        window.removeEventListener('mousemove', onMove);
                        window.removeEventListener('mouseup', onUp);
                        writeStoredNumber('dsh-editor.terminal.height', terminalHeightRef.current);
                      };
                      window.addEventListener('mousemove', onMove);
                      window.addEventListener('mouseup', onUp);
                    },
                  }),
                  React.createElement(TerminalPanel, {
                    t,
                    generation: terminalGeneration,
                    startDirectory: terminalStartDirectory,
                    workspaceRoot: root,
                    /* TerminalPanel is a sibling: pass the opener instead of capturing it. */
                    onOpenFile: (path) => void openFile(path),
                    onStartDirectoryUsed: () => {
                      pendingTerminalPath.current = '';
                      setTerminalStartDirectory('');
                    },
                    onRequestNew: () => setTerminalGeneration((value) => value + 1),
                    focusGeneration: terminalFocusGeneration,
                    onRequestClose: () => {
                      setTerminalOpen(false);
                      const previous = terminalReturnFocusRef.current;
                      terminalReturnFocusRef.current = null;
                      window.setTimeout(() => {
                        if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
                        else editorRef.current?.focus();
                      }, 0);
                    },
                    /* The editor area is a SIBLING of this panel, so a moved tab is
                       reported up rather than rendered down here. */
                    onEditorTerminals: (list) => setEditorTerminals(list),
                    onSwitchFocusToEditor: focusEditorFromTerminal,
                  }),
                )
              : null,
          ),
        ),
      );
    }

    /** Bounds of the chat column, in percent of the conversation area. */
    const CHAT_WIDTH_MIN = 28;
    const CHAT_WIDTH_MAX = 44;
    /* Gufa keeps the AI pane wide enough to read while the editor stays primary.
       A quarter width made the hero and message bubbles wrap at ordinary laptop
       widths; 35% leaves the editor the majority without turning the chat into a
       decorative strip. The user can still drag it. */
    const CHAT_WIDTH_DEFAULT = 35;

    /**
     * Keep a requested chat width inside the usable range.
     *
     * Below 28% the message list is unreadable; past 44% the editor is no longer
     * an editor. A non-number falls back to the default so a corrupt stored value
     * cannot leave a zero-width column.
     * @param {number} value - requested width in percent.
     * @returns {number} clamped width.
     */
    function clampChatPercent(value) {
      if (!Number.isFinite(value)) return CHAT_WIDTH_DEFAULT;
      return Math.min(CHAT_WIDTH_MAX, Math.max(CHAT_WIDTH_MIN, value));
    }

    /**
     * Resolve the rendered chat width while preserving the saved preference.
     * Harness collapse uses a temporary 0% layout; expanding reads `chatWidth`
     * again, so no drag-selected size is overwritten by minimize/restore.
     * @param {boolean} collapsed - whether the Harness tab is minimizing chat.
     * @param {number} value - persisted chat width percentage.
     * @returns {number} width to apply to the current layout.
     */
    function chatLayoutWidth(collapsed, value) {
      return collapsed === true ? 0 : clampChatPercent(value);
    }

    /**
     * The chat width the user last chose (percent), or the default.
     * @returns {number} width in percent.
     */
    function readChatWidth() {
      try {
        const current = window.localStorage.getItem('dsh-editor.chatWidth.v2');
        if (current !== null) return clampChatPercent(Number(current));
        /* The old key held percentages from the 25%-era layout. Preserve a user's
           deliberate width, but migrate the old untouched default once so an
           upgraded workspace actually gains the wider reading column. */
        const legacy = window.localStorage.getItem('dsh-editor.chatWidth');
        if (legacy === null) return CHAT_WIDTH_DEFAULT;
        const value = Number(legacy);
        const migrated = Number.isFinite(value) && Math.abs(value - 25) > 0.01
          ? clampChatPercent(value)
          : CHAT_WIDTH_DEFAULT;
        window.localStorage.setItem('dsh-editor.chatWidth.v2', String(migrated));
        return migrated;
      } catch {
        return CHAT_WIDTH_DEFAULT;
      }
    }

    /**
     * Persist the chat width so the next Editor open starts where it left off.
     * @param {number} value - width in percent.
     * @returns {void}
     */
    function writeChatWidth(value) {
      try {
        window.localStorage.setItem('dsh-editor.chatWidth.v2', String(Math.round(clampChatPercent(value) * 10) / 10));
      } catch {
        /* a storage-less browser keeps the in-memory width */
      }
    }

    /** Inject the small amount of global CSS the split layout and chrome need. */
