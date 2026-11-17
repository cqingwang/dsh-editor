/* diff.js: dsh-editor client module. Generated into lib/client.js by scripts/build-client.mjs. */
    function splitChanges(changes) {
      const staged = [];
      const unstaged = [];
      /* IDEA keeps brand-new files in their own "Unversioned Files" node. */
      const unversioned = [];
      for (const change of changes) {
        const index = change.status[0];
        const worktree = change.status[1];
        if (change.status === '??') {
          unversioned.push(change);
          continue;
        }
        if (index !== ' ' && index !== '?') staged.push(change);
        if (worktree !== ' ') unstaged.push(change);
      }
      return { staged, unstaged, unversioned };
    }

    /**
     * Paths IDEA stages for Stage All / Stage All Tracked.
     *
     * An `MM` path has a staged side and a newer working side, so it belongs in
     * this list even though the porcelain row's `staged` flag is true. Reuse the
     * existing band split instead of re-reading porcelain status locally.
     * @param {object[]} changes - porcelain changes from the host.
     * @param {boolean} [trackedOnly=false] - omit untracked files.
     * @returns {string[]} unique workspace-relative paths with working-side changes.
     */
    function stageAllTargets(changes, trackedOnly = false) {
      const bands = splitChanges(Array.isArray(changes) ? changes : []);
      const rows = trackedOnly === true ? bands.unstaged : [...bands.unstaged, ...bands.unversioned];
      return [...new Set(rows.map((change) => change.path).filter((path) => typeof path === 'string' && path !== ''))];
    }

    /**
     * Which Changes band owns one row.
     *
     * Unversioned files use the working-tree selection namespace, but they are
     * rendered in their own group. Keeping that decision in one helper prevents
     * Group by reveal and diff navigation from disagreeing about the collapse key.
     * @param {object|undefined} change - git status entry.
     * @param {boolean} staged - whether the current identity is the index side.
     * @returns {'staged'|'unstaged'|'unversioned'} display group.
     */
    function changeRowGroup(change, staged) {
      if (change?.status === '??') return 'unversioned';
      return staged === true ? 'staged' : 'unstaged';
    }

    /**
     * Count the leading Diff actions that fit beside the fixed controls.
     *
     * The toolbar cannot use a single compact/full breakpoint: at 521px the
     * previous full layout claimed to fit while the action group alone was
     * 524px wide, so its tail was clipped. Allocate real 24px action slots,
     * group separators and one overflow slot against the measured width left
     * after file navigation, hunk navigation, the hint and Close.
     * @param {number} width - measured toolbar width in CSS pixels.
     * @param {number} fixedWidth - measured non-action controls in CSS pixels.
     * @param {object[]} actions - ordered Diff actions.
     * @returns {number} number of leading actions that remain directly visible.
     */
    function diffDirectActionCountForWidth(width, fixedWidth, actions) {
      const ordered = Array.isArray(actions) ? actions.filter((action) => action !== null && typeof action === 'object') : [];
      if (!Number.isFinite(width)) return ordered.length;
      const available = Math.max(
        0,
        /* The toolbar's own padding, inter-group gaps and the path title's
           minimum margin consume space that individual child rects do not
           report. Reserve that chrome before allocating action slots. */
        (Number(width) || 0) - Math.max(0, Number(fixedWidth) || 0) - 44,
      );
      for (let count = ordered.length; count >= 0; count -= 1) {
        const separators = groupDiffToolbarActions(ordered.slice(0, count)).filter((entry) => entry === null).length;
        const overflow = count < ordered.length ? 1 : 0;
        const itemCount = count + separators + overflow;
        const cost = count * 24 + separators * 5 + overflow * 24 + Math.max(0, itemCount - 1) * 2;
        if (cost <= available) return count;
      }
      return 0;
    }

    /**
     * How much of the changed-file navigator still fits in a diff toolbar.
     *
     * The full `‹ n/total ›` control is 88px. At 193px it pushed the fixed
     * hunk/overflow/close controls outside the pane, so medium widths keep the
     * counter as one clickable chip and the narrowest widths drop it entirely.
     * Keyboard ⌃⇧←/→ remains available at every tier.
     * @param {number} width - measured diff toolbar width.
     * @returns {'full'|'compact'|'hidden'} file navigation presentation.
     */
    function diffFileNavModeForWidth(width) {
      if (!Number.isFinite(width)) return 'full';
      if (width >= 224) return 'full';
      if (width >= 160) return 'compact';
      return 'hidden';
    }

    /**
     * IDEA presents Unified and Side-by-side as two adjacent mode buttons.
     *
     * Preserve that recognizable pair while the toolbar has room. In the
     * quarter-width diff the pair would push hunk/close controls out, so it
     * collapses to the same button count as the previous single toggle.
     * @param {number} width - measured diff toolbar width.
     * @returns {'paired'|'toggle'} presentation mode.
     */
    function diffViewModeControlForWidth(width) {
      if (!Number.isFinite(width)) return 'paired';
      return width >= 280 ? 'paired' : 'toggle';
    }

    /**
     * IDEA's included-state label for a local Commit diff.
     *
     * DSH selects whole files for commit, so only the two truthful states exist:
     * zero hunks included or every hunk included. An unchanged file has no label.
     * @param {number} total - changed blocks currently reported by Monaco.
     * @param {boolean} included - whether the file is checked in Commit.
     * @returns {'none'|'all'|null} summary state.
     */
    function diffIncludedSummaryState(total, included) {
      const count = Number(total);
      if (!Number.isFinite(count) || count <= 0) return null;
      return included === true ? 'all' : 'none';
    }

    /**
     * Whether the IDEA-style difference summary fits without displacing controls.
     * @param {number} width - measured toolbar width.
     * @returns {boolean} true when the summary can be shown.
     */
    function diffSummaryVisibleForWidth(width) {
      return !Number.isFinite(width) || width >= 380;
    }

    /**
     * Insert non-interactive separators where Diff actions change semantic group.
     *
     * IDEA registers Diff modes, selection and inspection actions in separate
     * toolbar groups. Keeping that grouping visible prevents the flat icon row
     * from reading as one undifferentiated command strip. The null entries are
     * consumed as separators by both the wide toolbar and the overflow menu.
     * @param {object[]} actions - ordered Diff toolbar actions.
     * @returns {Array<object|null>} actions plus group boundaries.
     */
    function groupDiffToolbarActions(actions) {
      const entries = [];
      let previousGroup = null;
      for (const action of Array.isArray(actions) ? actions : []) {
        if (action === null || typeof action !== 'object') continue;
        const group = typeof action.group === 'string' ? action.group : null;
        if (group !== null && previousGroup !== null && group !== previousGroup) entries.push(null);
        entries.push(action);
        if (group !== null) previousGroup = group;
      }
      return entries;
    }

    /**
     * Whether the modified diff side may currently accept edits.
     *
     * Monaco has no per-action undo for arbitrary typed changes, so restoring a
     * gutter block and then locking the view must disable every write path
     * together: typing, undo/redo, selection restore and page mappings.
     * @param {{writable?: boolean, swapped?: boolean, locked?: boolean}|null} state - diff state.
     * @returns {boolean} true when the editable side is writable.
     */
    function diffEditingEnabled(state) {
      return state?.writable === true && state?.swapped !== true && state?.locked !== true;
    }

    /**
     * Whether a path still exists in the change band named by a row identity.
     *
     * Unversioned files use the `unstaged` selection namespace, but they live in
     * their own third band. Checking only `bands.unstaged` made the status poll
     * discard an open untracked-file diff immediately after it was opened.
     * @param {{staged: object[], unstaged: object[], unversioned: object[]}} bands - split changes.
     * @param {string} group - `staged` or `unstaged` row namespace.
     * @param {string} path - workspace-relative path.
     * @returns {boolean} true when the row still belongs to that namespace.
     */
    function listedInChangeBand(bands, group, path) {
      if (bands === null || typeof bands !== 'object' || typeof path !== 'string') return false;
      const listed = Array.isArray(bands[group]) && bands[group].some((change) => change.path === path);
      if (listed) return true;
      return group === 'unstaged' && Array.isArray(bands.unversioned) && bands.unversioned.some((change) => change.path === path);
    }

    /**
     * Locate the combined-diff file whose heading owns a modified-side line.
     *
     * @param {{line?: number}[]} files - files in combined order.
     * @param {number} line - one-based modified editor line.
     * @returns {number} zero-based file index, clamped to the surrounding files.
     */
    function combinedFileIndexAtLine(files, line) {
      const entries = Array.isArray(files) ? files : [];
      if (entries.length === 0) return 0;
      const target = Number.isFinite(Number(line)) ? Number(line) : 1;
      let index = 0;
      for (let cursor = 0; cursor < entries.length; cursor += 1) {
        const start = Number(entries[cursor]?.line);
        if (!Number.isFinite(start)) continue;
        if (start > target) break;
        index = cursor;
      }
      return index;
    }

    /**
     * Hidden Monaco range for one combined-file body, keeping its heading visible.
     *
     * @param {object|null} file - combined file metadata.
     * @param {'original'|'modified'} side - editor side.
     * @returns {{startLineNumber: number, endLineNumber: number}|null} hidden range.
     */
    function combinedFileHiddenRange(file, side) {
      if (file === null || typeof file !== 'object') return null;
      const header = Number(side === 'original' ? file.originalLine : file.line);
      const end = Number(side === 'original' ? file.originalEndLine : file.endLine);
      if (!Number.isFinite(header) || !Number.isFinite(end) || end <= header) return null;
      return { startLineNumber: header + 1, endLineNumber: end };
    }

    /**
     * IDEA's Control+Escape bindings for the current combined-diff file.
     *
     * The action is scoped to the combined diff surface and uses literal
     * Control, not Command on macOS.
     * @param {KeyboardEvent|object|null} event - keyboard event candidate.
     * @param {boolean} insideDiffPane - whether the focused element is inside the diff.
     * @param {boolean} combined - whether the active target is a combined diff.
     * @returns {boolean} true only for the IDEA key binding in its valid surface.
     */
    function isCombinedFileCollapseShortcut(event, insideDiffPane, combined) {
      return insideDiffPane === true
        && combined === true
        && event?.ctrlKey === true
        && event?.metaKey !== true
        && event?.altKey !== true
        && event?.shiftKey !== true
        && event?.key === 'Escape';
    }

    /**
     * IDEA's plain Escape action while the comparison owns the keyboard.
     *
     * Monaco's find/suggest widgets and our context menus also consume Escape.
     * They stay in charge while open; only the idle diff surface closes.
     * @param {KeyboardEvent|object|null} event - keyboard event candidate.
     * @param {boolean} insideDiffPane - whether the focused element is inside the diff.
     * @param {boolean} popupOwnsEscape - whether a menu or Monaco popup is open.
     * @returns {boolean} true only for the unmodified idle-diff binding.
     */
    function isDiffCloseShortcut(event, insideDiffPane, popupOwnsEscape) {
      return insideDiffPane === true
        && popupOwnsEscape !== true
        && event?.key === 'Escape'
        && event?.ctrlKey !== true
        && event?.metaKey !== true
        && event?.altKey !== true
        && event?.shiftKey !== true;
    }

    /**
     * IDEA's two-step Select Opened File shortcut: Alt+F1 then 1.
     *
     * The second key deliberately has no Alt modifier, so it cannot be confused
     * with the Alt+1 tool-window key. The chord expires instead of leaving stale
     * global state behind.
     * @param {KeyboardEvent|object|null} event - keyboard event candidate.
     * @param {number} armedAt - timestamp of the preceding Alt+F1, or zero.
     * @param {number} now - current timestamp.
     * @param {boolean} hasActiveFile - whether Select Opened File is enabled.
     * @returns {'arm'|'reveal'|'clear'|'ignore'} chord action.
     */
    function selectOpenedChordAction(event, armedAt, now, hasActiveFile) {
      const armed = Number(armedAt);
      const elapsed = Number(now) - armed;
      const sequenceActive = Number.isFinite(armed) && armed > 0 && Number.isFinite(elapsed) && elapsed >= 0 && elapsed <= 1500;
      if (
        hasActiveFile === true
        && event?.altKey === true
        && event?.metaKey !== true
        && event?.ctrlKey !== true
        && event?.shiftKey !== true
        && event?.key === 'F1'
      ) {
        return 'arm';
      }
      if (
        sequenceActive
        && event?.altKey !== true
        && event?.metaKey !== true
        && event?.ctrlKey !== true
        && event?.shiftKey !== true
        && event?.key === '1'
      ) {
        return 'reveal';
      }
      return armed > 0 ? 'clear' : 'ignore';
    }

    /**
     * Changed files in the same order the Commit tree presents them.
     *
     * IDEA's combined diff walks from one changed file to the next with
     * Control+Shift+Left/Right. The order must come from the visible tree model,
     * not raw `git status`: staged files come first, then working-tree changes,
     * then unversioned files, with each band using the active Group by sorting.
     * An `MM` path intentionally appears twice because its staged and working
     * copies are two separately addressable diffs.
     * @param {object[]} changes - porcelain changes from the host.
     * @param {'flat'|'module'|'directory'} [groupBy='directory'] - Commit tree grouping.
     * @returns {Array<{path: string, staged: boolean}>} navigable change identities.
     */
    function changeSequenceOf(changes, groupBy = 'directory') {
      const bands = splitChanges(Array.isArray(changes) ? changes : []);
      const sequence = [];
      for (const group of ['staged', 'unstaged', 'unversioned']) {
        const tree = changeTreeOf(bands[group], groupingDepth(groupBy));
        const rows = flattenChangeTree(tree, new Set(), group);
        for (const row of rows) {
          if (row.kind === 'file') sequence.push({ path: row.change.path, staged: group === 'staged' });
        }
      }
      return sequence;
    }

    /**
     * Locate one diff target in the change sequence.
     * @param {Array<{path: string, staged: boolean}>} sequence - navigable changes.
     * @param {{path?: string, staged?: boolean}|null} target - active diff target.
     * @returns {{index: number, total: number}|null} one-based position, or null.
     */
    function changePositionOf(sequence, target) {
      if (!Array.isArray(sequence) || target === null || target === undefined || typeof target.path !== 'string') return null;
      const staged = target.staged === true;
      const index = sequence.findIndex((entry) => entry.path === target.path && entry.staged === staged);
      return index < 0 ? null : { index: index + 1, total: sequence.length };
    }

    /**
     * Filter a change list by what the user typed (IDEA's change-list search).
     *
     * Matching is on the path, case-insensitively and as a plain substring: a
     * change list is a list of paths, so `docs/` or `.ts` are the useful queries.
     * The selection is deliberately NOT filtered — a ticked file that does not
     * match stays ticked, or typing in the box would silently change what the
     * next commit contains.
     * @param {object[]} changes - the group's changes.
     * @param {string} query - typed text; empty means "everything".
     * @returns {object[]} matching changes, original order.
     */
    function filterChanges(changes, query) {
      const needle = typeof query === 'string' ? query.trim().toLowerCase() : '';
      if (needle === '') return Array.isArray(changes) ? changes : [];
      return (Array.isArray(changes) ? changes : []).filter((change) => typeof change?.path === 'string' && change.path.toLowerCase().includes(needle));
    }

    /**
     * Narrow the changed-file navigation sequence to the Changes filter.
     *
     * File navigation must not jump to rows the current path filter hides. The
     * commit order and staged/working identity stay untouched; only entries whose
     * paths do not contain the case-insensitive query are removed.
     * @param {Array<{path: string, staged: boolean}>} sequence - full diff order.
     * @param {string} query - current Changes path filter.
     * @returns {Array<{path: string, staged: boolean}>} visible diff order.
     */
    function filterChangeSequence(sequence, query) {
      const entries = Array.isArray(sequence) ? sequence : [];
      const needle = typeof query === 'string' ? query.trim().toLowerCase() : '';
      if (needle === '') return entries;
      return entries.filter((entry) => typeof entry?.path === 'string' && entry.path.toLowerCase().includes(needle));
    }

    /**
     * Flatten the visible Changes groups into selectable row identities.
     *
     * The commit checkboxes and the current-row selection are independent. This
     * list is only for moving the current row while a path filter is active, so
     * it preserves each row's staged/unstaged namespace and never changes what
     * is ticked for commit.
     * @param {Array<{id: string, changes: object[]}>} groups - filtered display groups.
     * @returns {Array<{path: string, staged: boolean}>} visible row identities.
     */
    function changeFilterTargets(groups) {
      const targets = [];
      for (const group of Array.isArray(groups) ? groups : []) {
        const staged = group?.id === 'staged';
        for (const change of Array.isArray(group?.changes) ? group.changes : []) {
          if (typeof change?.path === 'string' && change.path !== '') targets.push({ path: change.path, staged });
        }
      }
      return targets;
    }

    /**
     * Cycle the Changes row selection within the filtered targets.
     *
     * A current row that was filtered out falls back to the first target for
     * either direction, which keeps the action target visible instead of applying
     * Stage/Show Diff/Rollback to a row the user cannot see.
     * @param {Array<{path: string, staged: boolean}>} targets - visible row identities.
     * @param {{path: string, staged: boolean}|null} current - selected row.
     * @param {'next'|'previous'} direction - navigation direction.
     * @returns {{path: string, staged: boolean}|null} next target.
     */
    function cycleChangeTarget(targets, current, direction) {
      const entries = Array.isArray(targets) ? targets : [];
      if (entries.length === 0) return null;
      const index = entries.findIndex((entry) =>
        entry.path === current?.path && entry.staged === (current?.staged === true),
      );
      if (index < 0) return entries[0];
      const offset = direction === 'previous' ? -1 : 1;
      return entries[(index + offset + entries.length) % entries.length];
    }

    /** Porcelain codes that mean an unresolved merge conflict. */
    const CONFLICT_STATUS = /^(DD|AU|UD|UA|DU|AA|UU)$/u;

    /**
     * How long a typeahead prefix survives without another key.
     *
     * One second is IDEA's own feel: fast enough that `g` `r` reads as one
     * prefix, slow enough that a deliberate second search starts clean.
     */
    const TYPEAHEAD_RESET_MS = 1000;

    /**
     * Whether one porcelain change is an unresolved conflict.
     * @param {object} change - change entry from the host.
     * @returns {boolean} true when the file needs a resolution.
     */
    function isConflict(change) {
      return typeof change?.status === 'string' && CONFLICT_STATUS.test(change.status);
    }

    /** Directory tree for one change group, sorted directories-first. */
    function changeTreeOf(changes, depthLimit = Infinity) {
      const root = { name: '', path: '', directories: new Map(), files: [] };
      /* `depthLimit` is IDEA's "Group by" choice: 0 is a single flat list, 1
         groups by module (the first path segment), Infinity by the whole path. */
      const limit = Number.isFinite(depthLimit) ? Math.max(0, depthLimit) : Infinity;
      for (const change of changes) {
        const segments = change.path.split('/');
        let node = root;
        for (let index = 0; index < segments.length - 1 && index < limit; index += 1) {
          const segment = segments[index];
          const child = node.directories.get(segment) ?? {
            name: segment,
            path: segments.slice(0, index + 1).join('/'),
            directories: new Map(),
            files: [],
          };
          node.directories.set(segment, child);
          node = child;
        }
        node.files.push(change);
      }
      return sortChangeTree(root);
    }

    /**
     * How deep the change tree nests for one "Group by" mode.
     *
     * IDEA's dropdown offers three answers, and the difference is only the
     * nesting depth: a flat list (0), modules (1 — the top-level segment), or
     * the full directory tree. Keeping it as a number means the renderer and the
     * collapse keys stay identical for all three.
     * @param {string} mode - 'flat' | 'module' | 'directory'.
     * @returns {number} depth limit for {@link changeTreeOf}.
     */
    function groupingDepth(mode) {
      if (mode === 'flat') return 0;
      if (mode === 'module') return 1;
      return Infinity;
    }

    /** Sort one change tree in place and return it. */
    function sortChangeTree(node) {
      node.directories = new Map([...node.directories.entries()].sort(([left], [right]) => left.localeCompare(right, undefined, { sensitivity: 'base' })));
      node.files.sort((left, right) => left.path.localeCompare(right.path, undefined, { sensitivity: 'base' }));
      for (const child of node.directories.values()) sortChangeTree(child);
      return node;
    }

    /**
     * Flatten one change tree into the visible, collapsible row list.
     *
     * A directory only appears as a collapsible group row, and a chain of
     * single-child directories collapses into ONE row. Visible descendants keep
     * their hierarchy depth so IDEA's indentation still tells a folder row apart
     * from files inside it; the muted parent path remains the disambiguator for
     * same-named files.
     * @param {object} tree - sorted tree root.
     * @param {Set<string>} collapsed - collapsed directory paths prefixed by the group id.
     * @param {string} group - group identity used in collapse keys.
     * @param {number} depth - indentation depth.
     * @param {object[]} rows - accumulator.
     * @returns {object[]} visible rows.
     */
    function flattenChangeTree(tree, collapsed, group, depth = 0, rows = []) {
      for (const directory of tree.directories.values()) {
        /* Compact a chain of single-child directories: `a/b/c` is one row, so a
           file under it is told apart by the grey path, not by extra indents. */
        let leaf = directory;
        let path = directory.path;
        while (leaf.files.length === 0 && leaf.directories.size === 1) {
          const only = [...leaf.directories.values()][0];
          leaf = only;
          path = only.path;
        }
        const key = `${group}:${path}`;
        const open = !collapsed.has(key);
        /* The directory row stages/unstages everything below it, so it carries its own leaves. */
        const inside = collectChanges(leaf, []);
        rows.push({ kind: 'directory', path, name: basename(path), parent: dirname(path), depth, open, collapseKey: key, changes: inside });
        if (open) flattenChangeTree(leaf, collapsed, group, depth + 1, rows);
      }
      /* IDEA indents files below their expanded directories. */
      for (const change of tree.files) rows.push({ kind: 'file', path: change.path, name: basename(change.path), depth, change });
      return rows;
    }

    /**
     * Every collapse key below (and including) one directory, group-prefixed.
     *
     * IDEA's ⌥-click on a tree node toggles the whole subtree in one gesture;
     * a plain click still toggles just that level. Returning keys (not a new
     * tree) keeps the caller's `Set` update trivial and side-effect free.
     * @param {object} tree - the group's sorted change tree.
     * @param {string} group - group identity used in collapse keys.
     * @param {string} path - directory path the click landed on.
     * @returns {string[]} keys to flip, outermost first.
     */
    function collapseKeysOf(tree, group, path) {
      const keys = [];
      if (tree === null || typeof tree !== 'object') return keys;
      const walk = (node) => {
        for (const directory of node.directories?.values?.() ?? []) {
          if (directory.path === path) {
            const collect = (current) => {
              keys.push(`${group}:${current.path}`);
              for (const child of current.directories?.values?.() ?? []) collect(child);
            };
            collect(directory);
            return true;
          }
          if (walk(directory)) return true;
        }
        return false;
      };
      walk(tree);
      return keys;
    }

    /**
     * Collapse keys that must be open for one changed file to become visible.
     *
     * IDEA's combined diff can move to a file while the Changes tree has its
     * group or an ancestor directory folded. Navigating the diff must reveal
     * that row in the same view rather than selecting an invisible identity.
     * @param {string} group - `staged`, `unstaged`, or `unversioned`.
     * @param {string} path - workspace-relative changed file path.
     * @returns {string[]} group key first, then each directory ancestor.
     */
    function revealCollapseKeys(group, path) {
      const keys = [`${group}:`];
      if (typeof path !== 'string' || path === '') return keys;
      const parts = path.split('/');
      for (let index = 1; index < parts.length; index += 1) {
        keys.push(`${group}:${parts.slice(0, index).join('/')}`);
      }
      return keys;
    }

    /** Every change below one tree node. */
    function collectChanges(node, out = []) {
      for (const child of node.directories.values()) collectChanges(child, out);
      out.push(...node.files);
      return out;
    }

    /**
     * One side-by-side diff surface for the selected change.
     *
     * Monaco's diff editor is created once and re-bound to fresh models per
     * path, so moving between changed files keeps scroll position and theme.
     */
    /**
     * IDEA's Annotate view: per-line author/commit gutter for the open file.
     *
     * Read-only by design — IDEA's annotate is a reading mode, and making it
     * editable would mean keeping two line-number spaces in sync.
     * Clicking a line's commit opens it in the Log, which is IDEA's jump from
     * annotate to the change that produced the line.
     * @param {{t: Function, target: object, lines: object[], loading: boolean, truncated: boolean, onClose: Function, onOpenCommit: Function, selected: string|null}} props - annotate payload.
     * @returns {object} the annotate panel.
     */
    function AnnotatePreview({ t, target, lines, loading, truncated, onClose, onOpenCommit, selected }) {
      return React.createElement(
        'div',
        { style: styles.diffPane, className: 'dsh-editor-annotate-pane' },
        React.createElement(
          'div',
          { style: styles.diffToolbar, className: 'dsh-editor-diff-toolbar' },
          React.createElement(PathLabel, { path: target?.path ?? '', style: styles.diffTitle }),
          React.createElement('span', { style: styles.diffHint }, t('editor.annotateMode')),
          truncated ? React.createElement('span', { style: styles.diffHint }, t('editor.annotateTruncated')) : null,
          React.createElement(ToolbarButton, { icon: 'hide', label: t('editor.closeAnnotate'), onClick: onClose }),
        ),
        loading
          ? React.createElement('div', { style: styles.empty }, t('editor.loading'))
          : React.createElement(
              'div',
              { style: styles.annotateScroll },
              lines.map((row) =>
                React.createElement(
                  'div',
                  {
                    key: row.line,
                    style: { ...styles.annotateRow, ...(selected === row.hash ? styles.commitGraphRowActive : null) },
                    className: 'dsh-editor-annotate-row',
                    title: `${row.hash} · ${row.summary}\n${t('editor.annotateOpenCommit')}`,
                    onClick: () => onOpenCommit?.(row.hash),
                  },
                  React.createElement('span', { style: styles.annotateMeta }, `${row.author} · ${formatCommitDate(row.date)}`),
                  React.createElement('span', { style: styles.annotateHash }, row.hash.slice(0, 7)),
                  React.createElement('span', { style: styles.annotateLineNo }, String(row.line)),
                ),
              ),
            ),
      );
    }

    /**
     * Read-only Monaco view of one file as it existed at a commit.
     *
     * IDEA opens repository revisions as VCS virtual files rather than as
     * working-copy files. This preview follows the same boundary: it renders
     * the fetched blob without registering a writable workspace document.
     *
     * @param {{t: Function, target: object, monacoReady: boolean, onClose: Function, onOpenLocal: Function}} props - revision target and actions.
     * @returns {object} repository version surface.
     */
    function RepositoryVersionPreview({ t, target, monacoReady, onClose, onOpenLocal }) {
      const hostRef = React.useRef(null);
      const editorRef = React.useRef(null);
      const version = target?.repositoryVersion ?? null;
      const path = typeof target?.path === 'string' ? target.path : '';
      const hash = typeof version?.hash === 'string' ? version.hash : '';

      React.useEffect(() => {
        const node = hostRef.current;
        const monaco = window.monaco;
        if (!monacoReady || node === null || monaco?.editor === undefined || version === null || version.binary === true) {
          return undefined;
        }
        const editor = monaco.editor.create(node, {
          value: typeof version.content === 'string' ? version.content : '',
          language: safeLanguage(monaco, path),
          theme: detectTheme(),
          readOnly: true,
          automaticLayout: true,
          fontSize: EDITOR_CODE_FONT_SIZE,
          lineHeight: EDITOR_CODE_LINE_HEIGHT,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          renderWhitespace: 'selection',
          find: { addExtraSpaceOnTop: false, autoFindInSelection: 'never', seedSearchStringFromSelection: 'never' },
          fontFamily: EDITOR_UI_FONT,
        });
        editorRef.current = editor;
        editor.focus();
        return () => {
          if (editorRef.current === editor) editorRef.current = null;
          editor.dispose?.();
        };
      }, [monacoReady, path, version?.binary, version?.content, version?.hash]);

      return React.createElement(
        'div',
        {
          style: styles.diffPane,
          className: 'dsh-editor-repository-version',
          'data-dsh-repository-version': '',
          'data-dsh-repository-version-hash': hash,
        },
        React.createElement(
          'div',
          { style: styles.diffToolbar, role: 'toolbar', 'aria-label': t('editor.repositoryVersionTab', { name: basename(path), hash: hash.slice(0, 7) }) },
          React.createElement(PathLabel, { path, style: styles.diffTitle }),
          React.createElement(
            'span',
            { style: styles.diffHint },
            t('editor.repositoryVersionMode', { hash: hash.slice(0, 7) }),
          ),
          React.createElement(ToolbarButton, {
            icon: 'file',
            label: t('editor.openLocalVersion'),
            onClick: () => onOpenLocal?.(path),
          }),
          React.createElement(ToolbarButton, {
            icon: 'hide',
            label: t('editor.closeDiff'),
            onClick: onClose,
          }),
        ),
        version?.binary === true
          ? React.createElement('div', { style: styles.empty }, t('editor.repositoryVersionBinary'))
          : React.createElement('div', { ref: hostRef, style: styles.diffHost }),
      );
    }

    function DiffPreview({ t, target, monacoReady, includedInCommit = false, onClose, onRestored, onStatus, onNotice, onNavigate, undoRef, redoRef, viewStatesRef, searchInChangesRef = null, filePosition = null, onPreviousFile, onNextFile, onOpenLocal }) {
      const hostRef = React.useRef(null);
      const diffRef = React.useRef(null);
      const diffModelsRef = React.useRef(null);
      const lastFocusedDiffSideRef = React.useRef('modified');
      const fallbackViewStatesRef = React.useRef(new Map());
      const viewStatesMapRef = viewStatesRef ?? fallbackViewStatesRef;
      const diffViewKeyRef = React.useRef('');
      const diffTargetRef = React.useRef(target);
      diffTargetRef.current = target;
      /* The last loaded sides and the text currently being persisted. Declared
         before render-time availability checks: reading a later hook here is a
         temporal-dead-zone error, which unmounts the whole editor workspace. */
      const diffLoadedRef = React.useRef(null);
      /* IDEA moves the keyboard into the comparison when Show Diff opens it.
         The widget is reused across targets, so the request belongs to each
         successful model swap rather than to the one-time mount. */
      const focusDiffRef = React.useRef(null);
      const [state, setState] = React.useState({ binary: false, error: null, missing: false });
      /* EditSource only makes sense while the working copy still exists. */
      const [localPathAvailable, setLocalPathAvailable] = React.useState(null);
      const [sideBySide, setSideBySide] = React.useState(() => readStoredText('dsh-editor.diff.sideBySide', '1') !== '0');
      const [swapSides, setSwapSides] = React.useState(false);
      const swapSidesRef = React.useRef(false);
      /* IDEA starts with unchanged regions folded, then lets the user reveal
         them. Monaco's native diff view-zone implementation is preferable to a
         second fold engine: it keeps both editors' scroll geometry aligned. */
      const [collapseUnchanged, setCollapseUnchanged] = React.useState(() => readStoredText('dsh-editor.diff.collapseUnchanged', '1') !== '0');
      const [ignoreWhitespace, setIgnoreWhitespace] = React.useState(() => readStoredText('dsh-editor.diff.ignoreWhitespace', '0') === '1');
      const [showWhitespaces, setShowWhitespaces] = React.useState(() => readStoredText('dsh-editor.diff.showWhitespaces', '0') === '1');
      const [showLineNumbers, setShowLineNumbers] = React.useState(() => readStoredText('dsh-editor.diff.showLineNumbers', '1') !== '0');
      const [softWrap, setSoftWrap] = React.useState(() => readStoredText('dsh-editor.diff.softWrap', '0') === '1');
      const [showIndentGuides, setShowIndentGuides] = React.useState(() => readStoredText('dsh-editor.diff.showIndentGuides', '0') === '1');
      const [editLocked, setEditLocked] = React.useState(false);
      const editLockedRef = React.useRef(false);
      editLockedRef.current = editLocked;
      /* IDEA's diff toolbar walks hunks and shows which one you are on. */
      const [hunks, setHunks] = React.useState({ index: 0, total: 0 });
      const [combinedFiles, setCombinedFiles] = React.useState([]);
      const [combinedPosition, setCombinedPosition] = React.useState({ index: 0, total: 0 });
      const [collapsedCombinedFiles, setCollapsedCombinedFiles] = React.useState(() => new Set());
      const combinedFilesRef = React.useRef([]);
      const [reloadGeneration, setReloadGeneration] = React.useState(0);
      /* When the modified side has a real selection Monaco also offers a native
         "Revert Selection" gutter button. Mirror that state in the toolbar so a
         narrow diff does not require hitting the glyph margin. */
      const [selectionRange, setSelectionRange] = React.useState(null);
      const diffReadOnly = typeof target?.commit === 'string'
        || typeof target?.revision === 'string'
        || typeof target?.clipboardText === 'string'
        || target?.combined === true;
      const diffUnavailable = target === null || state.binary || state.missing || diffLoadedRef.current === null;
      /* The keyboard handler below lists actionableSelection as a dependency;
         it therefore has to be initialised before that effect runs. */
      const actionableSelection = selectionRange !== null
        && !diffReadOnly
        && !swapSides
        && !editLocked
        && !diffUnavailable
        && selectedCharChanges(diffRef.current?.getLineChanges?.() ?? [], selectionRange).length > 0;
      const searchInChanges = React.useCallback(() => {
        const editor = diffRef.current?.getModifiedEditor?.();
        if (editor === null || editor === undefined) return;
        editor.focus();
        editor.trigger('dsh-editor', 'actions.find', null);
      }, []);
      React.useEffect(() => {
        if (searchInChangesRef === null) return undefined;
        searchInChangesRef.current = searchInChanges;
        return () => {
          if (searchInChangesRef.current === searchInChanges) searchInChangesRef.current = null;
        };
      }, [searchInChanges, searchInChangesRef]);
      /* IDEA's Diff.FocusOppositePane moves the keyboard between the compared
         sides without changing either model or caret. */
      const focusOppositeDiffPane = React.useCallback(() => {
        const original = diffRef.current?.getOriginalEditor?.();
        const modified = diffRef.current?.getModifiedEditor?.();
        if (original === null || original === undefined || modified === null || modified === undefined) return;
        const active = document.activeElement;
        const originalNode = original.getDomNode?.();
        const modifiedNode = modified.getDomNode?.();
        const activeIsOriginal = originalNode?.contains?.(active) === true;
        const activeIsModified = modifiedNode?.contains?.(active) === true;
        const sourceIsOriginal = activeIsOriginal || (!activeIsModified && lastFocusedDiffSideRef.current === 'original');
        if (sourceIsOriginal) modified.focus();
        else original.focus();
      }, []);
      /**
       * IDEA's Select Position in Opposite Diff Pane.
       *
       * Unlike Focus Opposite Pane, this action moves the caret to the
       * corresponding line on the other side and scrolls it into view. The
       * mapping uses Monaco's live line changes, so inserted/deleted blocks do
       * not leave the destination caret on an unrelated row.
       * @returns {void}
       */
      const selectPositionInOppositeDiffPane = React.useCallback(() => {
        const diff = diffRef.current;
        const original = diff?.getOriginalEditor?.();
        const modified = diff?.getModifiedEditor?.();
        if (diff === null || diff === undefined || original === null || original === undefined || modified === null || modified === undefined) return;
        const active = document.activeElement;
        const activeIsOriginal = original.getDomNode?.()?.contains?.(active) === true;
        const activeIsModified = modified.getDomNode?.()?.contains?.(active) === true;
        const sourceIsOriginal = activeIsOriginal || (!activeIsModified && lastFocusedDiffSideRef.current === 'original');
        const source = sourceIsOriginal ? original : modified;
        const target = sourceIsOriginal ? modified : original;
        const position = source.getPosition?.();
        if (position === null || position === undefined) return;
        const targetLine = transferDiffLine(
          position.lineNumber,
          sourceIsOriginal ? 'original' : 'modified',
          diff.getLineChanges?.() ?? [],
        );
        const targetModel = target.getModel?.();
        const line = Math.max(1, Math.min(targetModel?.getLineCount?.() ?? targetLine, targetLine));
        const maxColumn = targetModel?.getLineMaxColumn?.(line) ?? position.column;
        const next = { lineNumber: line, column: Math.max(1, Math.min(position.column, maxColumn)) };
        target.setPosition?.(next);
        target.revealPositionInCenterIfOutsideViewport?.(next);
        target.focus?.();
      }, []);
      /* Terminal "Switch Focus To Editor" asks the visible diff to own focus. */
      React.useEffect(() => {
        const host = hostRef.current?.closest?.('[data-dsh-editor-workspace]') ?? null;
        if (host === null) return undefined;
        const onFocus = () => focusDiffRef.current?.();
        host.addEventListener('dsh-editor-focus-diff', onFocus);
        return () => host.removeEventListener('dsh-editor-focus-diff', onFocus);
      }, []);
      React.useEffect(() => {
        if (typeof target?.path !== 'string' || target.path === '') {
          setLocalPathAvailable(null);
          return undefined;
        }
        let cancelled = false;
        setLocalPathAvailable(null);
        callFs({ op: 'exists', paths: [target.path] })
          .then((value) => {
            if (cancelled) return;
            const entry = Array.isArray(value)
              ? value.find((candidate) => candidate?.requested === target.path || candidate?.path === target.path)
              : null;
            setLocalPathAvailable(entry?.exists === true);
          })
          .catch(() => {
            if (!cancelled) setLocalPathAvailable(null);
          });
        return () => {
          cancelled = true;
        };
      }, [target?.path]);
      /* The working copy can appear or disappear while its diff is still open.
         Revalidate in both directions: missing files are retried quickly, while
         existing files use a slower guard so EditSource cannot go stale. */
      React.useEffect(() => {
        if (typeof target?.path !== 'string' || target.path === '') return undefined;
        let cancelled = false;
        const checkLocalPath = () => {
          callFs({ op: 'exists', paths: [target.path] })
            .then((value) => {
              if (cancelled) return;
              const entry = Array.isArray(value)
                ? value.find((candidate) => candidate?.requested === target.path || candidate?.path === target.path)
                : null;
              setLocalPathAvailable(entry?.exists === true);
            })
            .catch(() => {});
        };
        const delay = localPathAvailable === false ? 1500 : 3000;
        const timer = window.setInterval(checkLocalPath, delay);
        window.addEventListener('focus', checkLocalPath);
        return () => {
          cancelled = true;
          window.clearInterval(timer);
          window.removeEventListener('focus', checkLocalPath);
        };
      }, [localPathAvailable, target?.path]);
      const diffToolbarRef = React.useRef(null);
      const [diffDirectActionCount, setDiffDirectActionCount] = React.useState(null);
      const [diffToolbarWidth, setDiffToolbarWidth] = React.useState(Number.POSITIVE_INFINITY);
      const diffIsLocalCommitChange = target !== null
        && typeof target.path === 'string'
        && target.path !== ''
        && typeof target?.commit !== 'string'
        && typeof target?.revision !== 'string'
        && typeof target?.clipboardText !== 'string'
        && target.combined !== true;
      const includedState = diffIsLocalCommitChange
        ? diffIncludedSummaryState(hunks.total, includedInCommit)
        : null;
      const showIncludedSummary = includedState !== null && diffSummaryVisibleForWidth(diffToolbarWidth);
      const [diffActionMenu, setDiffActionMenu] = React.useState(null);
      const [hunkMenu, setHunkMenu] = React.useState(null);
      const openDiffActionSubmenu = React.useCallback((event, title, items, actionId = null) => {
        const rect = event?.currentTarget?.getBoundingClientRect?.()
          ?? diffToolbarRef.current?.getBoundingClientRect?.();
        if (rect === undefined || rect === null) return;
        setDiffActionMenu({
          x: Math.min(window.innerWidth - 212, Math.max(4, rect.right - 210)),
          y: rect.bottom + 4,
          title,
          actionId,
          items,
        });
      }, []);
      React.useEffect(() => {
        setHunkMenu(null);
      }, [target, hunks.total]);
      React.useEffect(() => {
        combinedFilesRef.current = [];
        setCombinedFiles([]);
        setCombinedPosition({ index: 0, total: 0 });
        setCollapsedCombinedFiles(new Set());
        diffRef.current?.getModifiedEditor?.().setHiddenAreas?.([]);
        diffRef.current?.getOriginalEditor?.().setHiddenAreas?.([]);
      }, [target, reloadGeneration]);
      /* IDEA's diff has a header per pane, not one ambiguous "workspace
         change" label: the left is the compared revision and the right names
         what is on screen. Both are derived from the target, so a staged and
         an unstaged file cannot be mislabelled by the other one. */
      const sideLabels = target?.combined === true
        ? target?.revisionPair !== null && typeof target?.revisionPair === 'object'
          ? {
              left: String(target.revisionPair.left ?? '').slice(0, 7),
              right: String(target.revisionPair.right ?? '').slice(0, 7),
            }
          : typeof target?.commitWithLocal === 'string'
          ? { left: target.commitWithLocal.slice(0, 7), right: t('editor.currentVersion') }
          : { left: t('editor.indexVersion'), right: t('editor.currentVersion') }
        : typeof target?.commit === 'string'
        ? { left: target.commit.slice(0, 7), right: t('editor.commitVersion') }
        : typeof target?.revision === 'string'
          ? { left: target.revision.slice(0, 7), right: t('editor.currentVersion') }
          : typeof target?.clipboardText === 'string'
            ? { left: t('editor.clipboardVersion'), right: t('editor.currentVersion') }
            : target?.staged === true
              ? { left: 'HEAD', right: t('editor.indexVersion') }
              : { left: 'HEAD', right: t('editor.currentVersion') };
      const displayedSideLabels = swapSides ? { left: sideLabels.right, right: sideLabels.left } : sideLabels;
      /* One promise chain per diff. Monaco can emit several model edits for a
         single block restore (and the user's ⌘Z is another edit); dropping an
         edit while an earlier write is in flight leaves the model and the file
         disagreeing. Each update therefore quotes the PREVIOUS expected text
         and waits for the preceding write. */
      const writeChainRef = React.useRef(Promise.resolve());
      /* A block restore clears Monaco's own undo stack on this model. IDEA still
         lets ⌘Z take the block back, so keep the inverse explicitly: newest
         restore first, scoped to this diff view. */
      /* Supplied by the workspace: IDEA's undo/redo crosses diff tabs. */
      const restoreUndoRef = undoRef ?? React.useRef([]);
      const restoreRedoRef = redoRef ?? React.useRef([]);
      /* Parent callbacks are inline functions; keeping them in refs stops a
         status-triggered parent render from re-running the model effect and
         wiping the undo history. */
      const onRestoredRef = React.useRef(onRestored);
      const onStatusRef = React.useRef(onStatus);
      const onNoticeRef = React.useRef(onNotice);
      const onNavigateRef = React.useRef(onNavigate);
      /* The editor status bar is hidden while a diff owns the code area, so the
         undo acknowledgement belongs to the diff's own hint row. */
      const [undoNotice, setUndoNotice] = React.useState(null);
      const loadingRef = React.useRef(false);
      /* A restore is a programmatic model edit: it must trigger one write, not
         one per keystroke the user makes in this read-only surface. */
      const restorePendingRef = React.useRef(false);
      /* One model restoration emits several content events (replace + undo
         bookkeeping). Attribute them to ONE restore record. */
      const activeRestoreRef = React.useRef(null);
      /* Declared before the model effect uses it: the sync runs from async
         callbacks, and a `const` declared later would still be in its TDZ then. */
      const syncHunksRef = React.useRef(null);
      /* IDEA opens a diff AT the first difference: its gutter reads `1/7`, not
         `0/7`, and the user can immediately see what changed. Monaco's
         `revealFirstDiff()` scrolls, but this version does not guarantee that
         the modified caret moved. Put it on the first modified range once the
         comparison settles. */
      const focusFirstHunkRef = React.useRef(null);
      /* View states are stored in the workspace, so closing the diff and
         reopening the same comparison still lands where the user left it. */
      const captureDiffViewState = React.useCallback((key = diffViewKeyRef.current) => {
        const diff = diffRef.current;
        if (diff === null || typeof key !== 'string' || key === '') return null;
        const originalEditor = diff.getOriginalEditor?.() ?? null;
        const modifiedEditor = diff.getModifiedEditor?.() ?? null;
        const original = originalEditor?.saveViewState?.() ?? null;
        const modified = modifiedEditor?.saveViewState?.() ?? null;
        if (original === null && modified === null) return null;
        const state = {
          original,
          modified,
          originalPosition: originalEditor?.getPosition?.() ?? null,
          modifiedPosition: modifiedEditor?.getPosition?.() ?? null,
          originalScrollTop: originalEditor?.getScrollTop?.() ?? null,
          modifiedScrollTop: modifiedEditor?.getScrollTop?.() ?? null,
        };
        viewStatesMapRef.current.set(key, state);
        return state;
      }, [viewStatesMapRef]);
      const restoreDiffViewState = React.useCallback((key, fallback = null) => {
        const state = (typeof key === 'string' && key !== '' ? viewStatesMapRef.current.get(key) : null) ?? fallback;
        const diff = diffRef.current;
        if (diff === null || state === null) return false;
        const original = diff.getOriginalEditor?.() ?? null;
        const modified = diff.getModifiedEditor?.() ?? null;
        let restored = false;
        if (original !== null && state.original !== null && state.original !== undefined) {
          original?.restoreViewState?.(state.original);
          restored = true;
        }
        if (modified !== null && state.modified !== null && state.modified !== undefined) {
          modified?.restoreViewState?.(state.modified);
          restored = true;
        }
        const clampPosition = (editor, position) => {
          if (position === null || position === undefined) return null;
          const lines = editor?.getModel?.()?.getLineCount?.() ?? position.lineNumber;
          return {
            lineNumber: Math.max(1, Math.min(Number(position.lineNumber) || 1, lines)),
            column: Math.max(1, Number(position.column) || 1),
          };
        };
        const originalPosition = clampPosition(original, state.originalPosition);
        if (originalPosition !== null) {
          original?.setPosition?.(originalPosition);
          restored = true;
        }
        const modifiedPosition = clampPosition(modified, state.modifiedPosition);
        if (modifiedPosition !== null) {
          modified?.setPosition?.(modifiedPosition);
          restored = true;
        }
        if (Number.isFinite(state.originalScrollTop)) original?.setScrollTop?.(state.originalScrollTop);
        if (Number.isFinite(state.modifiedScrollTop)) modified?.setScrollTop?.(state.modifiedScrollTop);
        return restored;
      }, [viewStatesMapRef]);

      /**
       * Give Monaco's native restore gutter the same discoverable semantics as
       * the rest of the diff surface. Monaco only supplies an English title on
       * an unfocusable div; keyboard users otherwise cannot reach the action.
       * @returns {void}
       */
      const localizeRevertButtons = React.useCallback(() => {
        const node = hostRef.current;
        if (node === null) return;
        for (const button of node.querySelectorAll('.revertButton')) {
          if (!(button instanceof HTMLElement)) continue;
          if (button.getAttribute('data-dsh-monaco-revert-title') === null) {
            button.setAttribute('data-dsh-monaco-revert-title', button.title);
          }
          const monacoTitle = button.getAttribute('data-dsh-monaco-revert-title') ?? '';
          const label = monacoTitle.toLowerCase().includes('selected')
            ? t('editor.diffSelectionRestore')
            : t('editor.diffRestoreChange');
          button.title = label;
          button.setAttribute('role', 'button');
          button.setAttribute('aria-label', label);
          button.tabIndex = 0;
        }
      }, [t]);

      React.useEffect(() => {
        const node = hostRef.current;
        if (node === null) return undefined;
        const observer = new MutationObserver(() => localizeRevertButtons());
        observer.observe(node, { childList: true, subtree: true });
        localizeRevertButtons();
        return () => observer.disconnect();
      }, [localizeRevertButtons]);

      React.useEffect(() => {
        onRestoredRef.current = onRestored;
        onStatusRef.current = onStatus;
        onNoticeRef.current = onNotice;
        onNavigateRef.current = onNavigate;
      }, [onNavigate, onNotice, onRestored, onStatus]);

      const persistRestored = React.useCallback(() => {
        const loaded = diffLoadedRef.current;
        const diff = diffRef.current;
        if (loaded === null || loaded.side === null || diff === null) return;
        const modified = diff.getModifiedEditor()?.getModel();
        if (modified === null || modified === undefined) return;
        setState((current) => ({ ...current, error: null }));
        restorePendingRef.current = false;
        const content = modified.getValue();
        const before = loaded.modified;
        const restoreRecord = {
          path: loaded.path,
          side: loaded.side,
          staged: target?.staged === true,
          original: loaded.original,
          text: before,
          after: content,
        };
        activeRestoreRef.current = restoreRecord;
        writeChainRef.current = writeChainRef.current
          .then(() => {
            const current = diffLoadedRef.current;
            if (current === null || current.side === null) return null;
            return callGit({
              op: 'applyChunk',
              path: current.path,
              side: current.side,
              expected: current.modified,
              content,
            }).then((value) => {
              diffLoadedRef.current = { ...current, modified: content };
              return value;
            });
          })
          .then((value) => {
            if (value === null) {
              activeRestoreRef.current = null;
              return;
            }
            if (before !== content) {
              restoreUndoRef.current.push(restoreRecord);
              restoreRedoRef.current = [];
            }
            onRestoredRef.current?.(value);
            onStatusRef.current?.(value);
            activeRestoreRef.current = null;
            /* Monaco has already consumed the model's undo entry for this
               restore, so keep an explicit inverse here. IDEA's diff undoes a
               block restore with ⌘Z; the file has to follow, not just the
               screen. */
            /* The onDidUpdateDiff subscription will settle the counter after
               Monaco finishes recomputing; an immediate read can still expose
               the pre-restore hunk list. */
            window.setTimeout(() => syncHunksRef.current?.(), 0);
          })
          .catch((failure) => {
            const message = failure instanceof Error ? failure.message : String(failure);
            setState((current) => ({
              ...current,
              error: /changed since the diff was loaded/u.test(message) ? t('editor.diffRestoreConflict') : t('editor.diffRestoreFailed', { message }),
            }));
            /* Put the model back when the host refused the write, so the screen
               never claims a change that is not on disk. */
            const current = diff.getModel();
            if (current !== null) {
              loadingRef.current = true;
              try {
                current.modified.setValue(diffLoadedRef.current?.modified ?? loaded.modified);
              } finally {
                loadingRef.current = false;
              }
            }
          });
      }, []);

      const applyHistoryEntry = React.useCallback((entry, redo) => {
        setState((current) => ({ ...current, error: null }));
        restorePendingRef.current = false;
        const content = redo ? entry.after : entry.text;
        activeRestoreRef.current = entry;
        writeChainRef.current = writeChainRef.current
          .then(() => callGit({
            op: 'applyChunk',
            path: entry.path,
            side: entry.side,
            expected: redo ? entry.text : entry.after,
            content,
          }))
          .then((value) => {
            onStatusRef.current?.(value);
            if (redo) {
              restoreUndoRef.current.push(entry);
              setUndoNotice(t('editor.diffRedoDone'));
            } else {
              restoreRedoRef.current.push(entry);
              setUndoNotice(t('editor.diffUndoDone'));
            }
            /* The record belongs to a file, not to whichever diff happens to be
               mounted. Make the visible diff match the file that was just
               restored, the way IDEA's global undo does. */
            const active = diffLoadedRef.current;
            if (active === null || active.path !== entry.path || active.side !== entry.side) {
              diffLoadedRef.current = {
                path: entry.path,
                side: entry.side,
                staged: entry.staged === true,
                original: entry.original ?? '',
                modified: redo ? entry.after : entry.text,
              };
              onNavigateRef.current?.(entry);
            }
            activeRestoreRef.current = null;
            window.setTimeout(() => syncHunksRef.current?.(), 0);
          })
          .catch((failure) => {
            if (redo) restoreRedoRef.current.push(entry);
            else restoreUndoRef.current.push(entry);
            setUndoNotice(null);
            const message = failure instanceof Error ? failure.message : String(failure);
            setState((current) => ({
              ...current,
              error: /changed since the diff was loaded/u.test(message) ? t('editor.diffRestoreConflict') : t('editor.diffRestoreFailed', { message }),
            }));
          });
      }, [t]);

      const undoRestore = React.useCallback(() => {
        restoreUndoRef.current = restoreUndoStack(activeRestoreRef.current, restoreUndoRef.current);
        const entry = restoreUndoRef.current.pop();
        if (entry === undefined) {
          setState((current) => ({ ...current, error: t('editor.diffUndoEmpty') }));
          return;
        }
        const loaded = diffLoadedRef.current;
        const modified = diffRef.current?.getModifiedEditor()?.getModel();
        if (loaded !== null && loaded.path === entry.path && modified !== undefined && modified !== null) {
          loadingRef.current = true;
          try {
            modified.setValue(entry.text);
          } finally {
            loadingRef.current = false;
          }
          loadingRef.current = true;
          try {
            applyHistoryEntry(entry, false);
          } finally {
            loadingRef.current = false;
          }
          return;
        }
        applyHistoryEntry(entry, false);
      }, [applyHistoryEntry, t]);

      const restoreSelection = React.useCallback(() => {
        const diff = diffRef.current;
        if (diff === null || diffLoadedRef.current?.side === null) return;
        const ranges = selectedCharChanges(diff.getLineChanges(), selectionRange);
        if (ranges.length === 0) {
          setState((current) => ({ ...current, error: t('editor.diffSelectionEmpty') }));
          return;
        }
        setState((current) => ({ ...current, error: null }));
        diff.revertRangeMappings(ranges);
      }, [selectionRange, t]);

      /**
       * Apply the focused-side change to the editable side.
       *
       * With a changed selection this behaves like IDEA's selected-changes
       * action; without one it applies the change under the current hunk
       * counter. Writable diffs only, so read-only history and Swap Sides do
       * not expose a misleading action.
       * @returns {void}
       */
      const applyLeftSide = React.useCallback(() => {
        const diff = diffRef.current;
        if (diff === null || diffLoadedRef.current?.side === null) return;
        if (diffReadOnly || swapSides || editLocked || diffUnavailable) return;
        const changes = diff.getLineChanges?.() ?? [];
        const ranges = actionableSelection
          ? selectedCharChanges(changes, selectionRange)
          : lineChangeRangeMappings(changes[Math.max(0, hunks.index - 1)]);
        if (ranges.length === 0) return;
        setState((current) => ({ ...current, error: null }));
        diff.revertRangeMappings(ranges);
      }, [actionableSelection, diffReadOnly, diffUnavailable, editLocked, hunks.index, selectionRange, swapSides]);

      const redoRestore = React.useCallback(() => {
        const entry = restoreRedoRef.current.pop();
        if (entry === undefined) {
          setState((current) => ({ ...current, error: t('editor.diffRedoEmpty') }));
          return;
        }
        const loaded = diffLoadedRef.current;
        const modified = diffRef.current?.getModifiedEditor()?.getModel();
        if (loaded !== null && loaded.path === entry.path && modified !== undefined && modified !== null) {
          loadingRef.current = true;
          try {
            modified.setValue(entry.after);
          } finally {
            loadingRef.current = false;
          }
          loadingRef.current = true;
          try {
            applyHistoryEntry(entry, true);
          } finally {
            loadingRef.current = false;
          }
          return;
        }
        applyHistoryEntry(entry, true);
      }, [applyHistoryEntry, t]);

      React.useEffect(() => {
        const node = hostRef.current;
        const monaco = window.monaco;
        if (!monacoReady || node === null || monaco?.editor === undefined) return;
        const diff = monaco.editor.createDiffEditor(node, {
          theme: ensureDiffTheme(monaco),
          automaticLayout: true,
          /* IDEA opens a change side by side by default. The right pane has to
             be writable for Monaco's native hunk-restore arrows to appear. */
          readOnly: false,
          renderSideBySide: readStoredText('dsh-editor.diff.sideBySide', '1') !== '0',
          useInlineViewWhenSpaceIsLimited: false,
          renderSideBySideInlineBreakpoint: 0,
          renderMarginRevertIcon: true,
          renderGutterMenu: false,
          hideUnchangedRegions: {
            enabled: readStoredText('dsh-editor.diff.collapseUnchanged', '1') !== '0',
            minimumLineCount: 4,
            contextLineCount: 2,
            revealLineCount: 10,
          },
          ignoreTrimWhitespace: readStoredText('dsh-editor.diff.ignoreWhitespace', '0') === '1',
          renderWhitespace: readStoredText('dsh-editor.diff.showWhitespaces', '0') === '1' ? 'all' : 'none',
          lineNumbers: readStoredText('dsh-editor.diff.showLineNumbers', '1') !== '0' ? 'on' : 'off',
          wordWrap: readStoredText('dsh-editor.diff.softWrap', '0') === '1' ? 'on' : 'off',
          guides: { indentation: readStoredText('dsh-editor.diff.showIndentGuides', '0') === '1' },
          /* The diff pane is a split inside a tool window, so its inner editor
             can be narrower than the media queries that hide Monaco's glyph
             margin. IDEA keeps the per-block restore affordance visible anyway. */
          glyphMargin: true,
          /* A quarter-width tool window leaves each diff side around 200px. The
             default 36px number column plus 10px decoration gutter spent almost
             a quarter of that on chrome; three digits are enough for ordinary
             files and the gutter is where the restore arrow must stay. */
          lineNumbersMinChars: 2,
          lineDecorationsWidth: 4,
          originalEditable: false,
          fontSize: EDITOR_CODE_FONT_SIZE,
          lineHeight: EDITOR_CODE_LINE_HEIGHT,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          renderOverviewRuler: false,
          fontFamily: EDITOR_UI_FONT,
        });
        diffRef.current = diff;
        const focusDisposables = [
          diff.getOriginalEditor?.()?.onDidFocusEditorText?.(() => {
            lastFocusedDiffSideRef.current = 'original';
          }),
          diff.getModifiedEditor?.()?.onDidFocusEditorText?.(() => {
            lastFocusedDiffSideRef.current = 'modified';
          }),
        ].filter((disposable) => disposable !== null && disposable !== undefined);
        return () => {
          focusDisposables.forEach((disposable) => disposable.dispose?.());
          captureDiffViewState(diffViewKeyRef.current);
          const models = diff.getModel();
          /* Same ordering rule as the swap below: the widget must let go of the
             models before they are disposed, or Monaco logs a warning per model. */
          diff.setModel(null);
          if (models?.modified?.__dshRestoreListener != null) {
            models.modified.__dshRestoreListener.dispose?.();
            models.modified.__dshRestoreListener = undefined;
          }
          if (models?.modified?.__dshFallbackUndo != null) {
            models.modified.__dshFallbackUndo.dispose?.();
            models.modified.__dshFallbackUndo = undefined;
          }
          models?.original?.dispose?.();
          models?.modified?.dispose?.();
          diff.dispose();
          diffRef.current = null;
        };
      }, [captureDiffViewState, monacoReady]);

      React.useEffect(() => {
        const diff = diffRef.current;
        if (diff === null) return;
        const savedView = captureDiffViewState(diffViewKeyRef.current);
        diff.updateOptions({ renderSideBySide: sideBySide });
        restoreDiffViewState(diffViewKeyRef.current, savedView);
        try {
          window.localStorage.setItem('dsh-editor.diff.sideBySide', sideBySide ? '1' : '0');
        } catch {
          /* a storage-less browser still gets the in-memory choice */
        }
      }, [captureDiffViewState, restoreDiffViewState, sideBySide]);

      React.useEffect(() => {
        const diff = diffRef.current;
        if (diff === null) return;
        diff.updateOptions({
          hideUnchangedRegions: {
            enabled: collapseUnchanged,
            minimumLineCount: 4,
            contextLineCount: 2,
            revealLineCount: 10,
          },
        });
        try {
          window.localStorage.setItem('dsh-editor.diff.collapseUnchanged', collapseUnchanged ? '1' : '0');
        } catch {
          /* a storage-less browser still gets the in-memory choice */
        }
      }, [collapseUnchanged]);

      React.useEffect(() => {
        const diff = diffRef.current;
        if (diff === null) return;
        diff.updateOptions({ ignoreTrimWhitespace: ignoreWhitespace });
        try {
          window.localStorage.setItem('dsh-editor.diff.ignoreWhitespace', ignoreWhitespace ? '1' : '0');
        } catch {
          /* a storage-less browser still gets the in-memory choice */
        }
      }, [ignoreWhitespace]);

      React.useEffect(() => {
        const diff = diffRef.current;
        if (diff === null) return;
        const renderWhitespace = showWhitespaces ? 'all' : 'none';
        const original = diff.getOriginalEditor?.();
        const modified = diff.getModifiedEditor?.();
        original?.updateOptions({ renderWhitespace });
        modified?.updateOptions({ renderWhitespace });
        try {
          window.localStorage.setItem('dsh-editor.diff.showWhitespaces', showWhitespaces ? '1' : '0');
        } catch {
          /* a storage-less browser still gets the in-memory choice */
        }
      }, [showWhitespaces]);

      React.useEffect(() => {
        const diff = diffRef.current;
        if (diff === null) return;
        diff.updateOptions({ lineNumbers: showLineNumbers ? 'on' : 'off' });
        try {
          window.localStorage.setItem('dsh-editor.diff.showLineNumbers', showLineNumbers ? '1' : '0');
        } catch {
          /* a storage-less browser still gets the in-memory choice */
        }
      }, [showLineNumbers]);

      React.useEffect(() => {
        const diff = diffRef.current;
        if (diff === null) return;
        const original = diff.getOriginalEditor?.();
        const modified = diff.getModifiedEditor?.();
        original?.updateOptions({ wordWrap: softWrap ? 'on' : 'off' });
        modified?.updateOptions({ wordWrap: softWrap ? 'on' : 'off' });
        try {
          window.localStorage.setItem('dsh-editor.diff.softWrap', softWrap ? '1' : '0');
        } catch {
          /* a storage-less browser still gets the in-memory choice */
        }
      }, [softWrap]);

      React.useEffect(() => {
        const diff = diffRef.current;
        if (diff === null) return;
        const original = diff.getOriginalEditor?.();
        const modified = diff.getModifiedEditor?.();
        original?.updateOptions({ guides: { indentation: showIndentGuides } });
        modified?.updateOptions({ guides: { indentation: showIndentGuides } });
        try {
          window.localStorage.setItem('dsh-editor.diff.showIndentGuides', showIndentGuides ? '1' : '0');
        } catch {
          /* a storage-less browser still gets the in-memory choice */
        }
      }, [showIndentGuides]);

      React.useEffect(() => {
        const diff = diffRef.current;
        const monaco = window.monaco;
        if (target === null || diff === null || monaco?.editor === undefined) return;
        const previousViewKey = diffViewKeyRef.current;
        if (previousViewKey !== '') captureDiffViewState(previousViewKey);
        diffViewKeyRef.current = diffViewStateKey(target, swapSidesRef.current);
        const writable = typeof target.clipboardText !== 'string' && typeof target.revision !== 'string' && typeof target.commit !== 'string';
        const canEdit = diffEditingEnabled({
          writable,
          swapped: swapSidesRef.current,
          locked: editLockedRef.current,
        });
        diff.updateOptions({
          readOnly: canEdit === false,
          renderMarginRevertIcon: canEdit,
          glyphMargin: canEdit || readStoredText('dsh-editor.diff.sideBySide', '1') !== '0',
          lineNumbersMinChars: 2,
          lineDecorationsWidth: 4,
        });
        let cancelled = false;
        /* A clipboard target sends its text; commit and change targets read from git. */
        const request = typeof target.clipboardText === 'string'
          ? { op: 'compareText', path: target.path, text: target.clipboardText, label: target.label }
          : typeof target.revision === 'string'
            /* Compare the file NOW against how it looked at that revision. */
            ? { op: 'diffWithRevision', hash: target.revision, path: target.path }
            : typeof target.commit === 'string'
              ? { op: 'commitDiff', hash: target.commit, path: target.path }
              : target.combined === true
                ? { op: 'combinedDiff', entries: target.entries }
              : { op: 'diff', path: target.path, staged: target.staged };
        const diffAbort = new AbortController();
        callGit(request, { signal: diffAbort.signal })
          .then((value) => {
            if (cancelled || diffRef.current !== diff) return;
            if (value.binary) {
              diff.setModel(null);
              diffLoadedRef.current = null;
              setState({ binary: true, error: null, missing: value.missing });
              return;
            }
            if (target.combined === true) {
              const files = (Array.isArray(value.files) ? value.files : [])
                .filter((file) => Number.isFinite(Number(file?.line)))
                .map((file) => ({ ...file, line: Number(file.line) }));
              combinedFilesRef.current = files;
              setCombinedFiles(files);
              setCombinedPosition(files.length === 0 ? { index: 0, total: 0 } : { index: 1, total: files.length });
            }
            const tag = typeof target.clipboardText === 'string'
              ? 'clipboard'
              : typeof target.commit === 'string'
                ? `commit=${target.commit}`
                : typeof target.revision === 'string'
                  ? `revision=${target.revision}`
                  : target.combined === true
                    ? `combined=${(target.entries ?? []).length}`
                : `staged=${target.staged}`;
            /* A unique fragment per load: reusing the exact URI while an older
               model is still being disposed makes Monaco reject the SECOND model
               (`ModelService: Cannot add model because it already exists`). */
            const modelPath = target.combined === true ? 'combined-diff.txt' : target.path;
            const base = `file:///${modelPath.split('/').map(encodeURIComponent).join('/')}?load=${String(++diffLoadSerial)}`;
            const original = monaco.editor.createModel(value.original, safeLanguage(monaco, modelPath), monaco.Uri.parse(`${base}?side=original&${tag}`));
            const modified = monaco.editor.createModel(value.modified, safeLanguage(monaco, modelPath), monaco.Uri.parse(`${base}?side=modified&${tag}`));
            diffModelsRef.current = { original, modified };
            diffLoadedRef.current = {
              path: modelPath,
              /* History and clipboard comparisons are read-only; only a working
                 change can be restored a block at a time. */
              side: typeof target.commit === 'string' || typeof target.revision === 'string' || typeof target.clipboardText === 'string'
                || target.combined === true
                ? null
                : target.staged === true ? 'index' : 'worktree',
              original: value.original,
              modified: value.modified,
            };
            const previous = diff.getModel();
            /* Detach BEFORE disposing: a model the widget still holds logs
               "TextModel got disposed before DiffEditorWidget model got reset". */
            diff.setModel(null);
            if (previous?.modified?.__dshRestoreListener != null) {
              previous.modified.__dshRestoreListener.dispose?.();
              previous.modified.__dshRestoreListener = undefined;
            }
            if (previous?.modified?.__dshFallbackUndo != null) {
              previous.modified.__dshFallbackUndo.dispose?.();
              previous.modified.__dshFallbackUndo = undefined;
            }
            previous?.original?.dispose?.();
            previous?.modified?.dispose?.();
            const loadedModels = diffModelsRef.current;
            diff.setModel(swapSidesRef.current === true
              ? { original: loadedModels.modified, modified: loadedModels.original }
              : loadedModels);
            /* Monaco's per-hunk arrow writes through `executeEdits`; listen on the
               model so both the arrow and the selection toolbar persist. */
            if (modified.__dshRestoreListener != null) modified.__dshRestoreListener.dispose?.();
            setSelectionRange(null);
            if (diffLoadedRef.current.side !== null) {
              modified.__dshRestoreListener = modified.onDidChangeContent(() => {
                if (loadingRef.current) return;
                restorePendingRef.current = true;
                window.setTimeout(() => {
                  if (restorePendingRef.current) persistRestored();
                }, 0);
              });
            }
            setState({ binary: false, error: null, missing: value.missing });
            /* The widget computes the hunks asynchronously; `revealFirstDiff` waits
               for that pass, so reading `getLineChanges()` after it is safe. The
               first diff can also carry a blank line (it did for a long
               translation table), which made a bare sync still read the old
               counter. Await the computation and then settle the toolbar once. */
            diff.revealFirstDiff();
            void diff.waitForDiff().then(() => {
              const restoredView = restoreDiffViewState(diffViewKeyRef.current);
              if (restoredView === false) focusFirstHunkRef.current?.();
              /* The diff now owns the active editor tab; arrows and F7 must work
                 without making the user click a pane first. */
              focusDiffRef.current?.();
              syncHunksRef.current?.();
            });
            syncHunksRef.current?.();
          })
          .catch((failure) => {
            if (failure?.name === 'AbortError' || failure?.name === 'CanceledError') return;
            if (!cancelled) {
              diffLoadedRef.current = null;
              setState({ binary: false, error: failure instanceof Error ? failure.message : String(failure), missing: false });
            }
          });
        return () => {
          cancelled = true;
          diffAbort.abort();
        };
      }, [captureDiffViewState, persistRestored, reloadGeneration, restoreDiffViewState, target]);

      React.useEffect(() => {
        const diff = diffRef.current;
        if (diff === null) return;
        const canEdit = diffEditingEnabled({
          writable: diffReadOnly === false,
          swapped: swapSides,
          locked: editLocked,
        });
        diff.updateOptions({
          readOnly: canEdit === false,
          renderMarginRevertIcon: canEdit,
          glyphMargin: canEdit || sideBySide,
        });
      }, [diffReadOnly, editLocked, sideBySide, swapSides]);

      React.useEffect(() => {
        swapSidesRef.current = false;
        setSwapSides(false);
      }, [target]);

      /**
       * Rebind the same two loaded documents in the requested visual order.
       *
       * Swap Sides is a view operation in IDEA, not a new comparison. Keeping
       * both models means switching back is instant and no diff request or
       * undo history is lost. The revision side must not accept block restores,
       * so the swapped orientation is read-only.
       * @param {boolean} swapped - whether the working/current side should be left.
       * @returns {void}
       */
      const applyDiffSideOrder = React.useCallback((swapped) => {
        const diff = diffRef.current;
        const pair = diffModelsRef.current;
        if (diff === null || pair === null) return;
        const next = swapped ? { original: pair.modified, modified: pair.original } : pair;
        diff.setModel(next);
        const canEdit = diffEditingEnabled({
          writable: diffReadOnly === false && diffLoadedRef.current?.side !== null,
          swapped,
          locked: editLockedRef.current,
        });
        diff.updateOptions({
          readOnly: canEdit === false,
          renderMarginRevertIcon: canEdit,
          glyphMargin: canEdit || sideBySide,
        });
      }, [diffReadOnly, sideBySide]);

      React.useEffect(() => {
        const previousState = captureDiffViewState(diffViewKeyRef.current);
        swapSidesRef.current = swapSides;
        const nextKey = diffViewStateKey(diffTargetRef.current, swapSides);
        diffViewKeyRef.current = nextKey;
        applyDiffSideOrder(swapSides);
        restoreDiffViewState(nextKey, previousState);
      }, [applyDiffSideOrder, captureDiffViewState, restoreDiffViewState, swapSides]);

      /* Track which hunk the modified pane's caret sits in, for the `n/total` label. */
      syncHunksRef.current = () => {
        const diff = diffRef.current;
        if (diff === null) return;
        const changes = diff.getLineChanges() ?? [];
        /* `getLineChanges()` can briefly return null while the widget recomputes
           after a restore; `hunkAt` already normalises non-arrays, but the null
           must not leave the old `1/1` counter on an empty diff. */
        const line = diff.getModifiedEditor()?.getPosition()?.lineNumber ?? 1;
        const next = hunkAt(changes, line);
        setHunks((current) => (current.index === next.index && current.total === next.total ? current : next));
      };

      focusFirstHunkRef.current = () => {
        const diff = diffRef.current;
        if (diff === null) return;
        const changes = diff.getLineChanges() ?? [];
        const first = changes[0];
        if (first === undefined) return;
        const editor = diff.getModifiedEditor();
        if (editor === null) return;
        editor.setPosition({ lineNumber: Math.max(1, Number(first.modifiedStartLineNumber) || 1), column: 1 });
        editor.revealPositionInCenterIfOutsideViewport(editor.getPosition());
      };

      focusDiffRef.current = () => {
        const editor = diffRef.current?.getModifiedEditor?.();
        if (editor === null || editor === undefined) return;
        editor.focus();
      };

      /**
       * Activate Monaco's native restore arrow from the keyboard.
       *
       * The gutter button is created outside React, so the diff host delegates
       * Enter/Space to its existing click handler instead of maintaining a
       * second restore implementation.
       * @param {KeyboardEvent} event - keydown from the diff host subtree.
       * @returns {void}
       */
      const onDiffHostKeyDown = React.useCallback((event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const revertTarget = event.target instanceof Element ? event.target.closest('.revertButton') : null;
        if (!(revertTarget instanceof HTMLElement)) return;
        event.preventDefault();
        event.stopPropagation();
        revertTarget.click();
      }, []);

      React.useEffect(() => {
        const diff = diffRef.current;
        if (diff === null) return;
        const subscription = diff.onDidUpdateDiff(() => syncHunksRef.current?.());
        return () => subscription.dispose();
      }, [monacoReady]);

      React.useEffect(() => {
        const diff = diffRef.current;
        if (diff === null) return;
        const editor = diff.getModifiedEditor();
        const subscription = editor.onDidChangeCursorSelection((event) => {
          const selection = event.selection;
          const empty = selection === null || selection === undefined
            || (selection.startLineNumber === selection.endLineNumber && selection.startColumn === selection.endColumn);
          setSelectionRange(empty ? null : {
            startLineNumber: selection.startLineNumber,
            startColumn: selection.startColumn,
            endLineNumber: selection.endLineNumber,
            endColumn: selection.endColumn,
          });
          const files = combinedFilesRef.current;
          if (files.length > 0) {
            const line = selection?.position?.lineNumber ?? editor.getPosition()?.lineNumber ?? 1;
            const index = combinedFileIndexAtLine(combinedFilesRef.current, line) + 1;
            setCombinedPosition((current) => (current.index === index && current.total === files.length ? current : { index, total: files.length }));
          }
        });
        return () => subscription.dispose();
      }, [monacoReady]);

      /** Walk to the next or previous hunk, IDEA's diff toolbar arrows. */
      const walkHunk = React.useCallback((direction) => {
        const diff = diffRef.current;
        if (diff === null) return;
        diff.goToDiff(direction === 'previous' ? 'previous' : 'next');
        /* `goToDiff` moves the modified pane's selection, so the caret is current. */
        window.setTimeout(() => syncHunksRef.current?.(), 0);
      }, []);

      /**
       * Jump directly to one of Monaco's existing line changes.
       *
       * IDEA's Go To Change popup lists every difference and moves the caret to
       * the chosen one. Reuse the diff widget's current hunk array instead of
       * recalculating the comparison in another component.
       * @param {number} index - zero-based hunk index.
       * @returns {void}
       */
      const jumpToDiffHunk = React.useCallback((index) => {
        const changes = diffRef.current?.getLineChanges?.() ?? [];
        const change = changes[index];
        if (change === undefined) return;
        const editor = diffRef.current?.getModifiedEditor?.();
        if (editor === null || editor === undefined) return;
        const position = { lineNumber: Math.max(1, Number(change.modifiedStartLineNumber) || 1), column: 1 };
        editor.setPosition(position);
        editor.revealPositionInCenterIfOutsideViewport(position);
        editor.focus();
        window.setTimeout(() => syncHunksRef.current?.(), 0);
      }, []);

      /**
       * Move to one file heading inside a combined diff.
       *
       * @param {number} index - zero-based combined file index.
       * @returns {void}
       */
      const jumpToCombinedFile = React.useCallback((index) => {
        const files = combinedFilesRef.current;
        if (files.length === 0) return;
        const next = Math.max(0, Math.min(files.length - 1, Number(index) || 0));
        const file = files[next];
        const editor = diffRef.current?.getModifiedEditor?.();
        if (editor === null || editor === undefined || !Number.isFinite(Number(file?.line))) return;
        const position = { lineNumber: Number(file.line), column: 1 };
        editor.setPosition(position);
        editor.revealPositionInCenterIfOutsideViewport(position);
        editor.focus();
        setCombinedPosition({ index: next + 1, total: files.length });
      }, []);

      const navigationPosition = target?.combined === true ? combinedPosition : filePosition;
      const previousFileAction = target?.combined === true
        ? () => jumpToCombinedFile((combinedPosition.index || 1) - 2)
        : onPreviousFile;
      const nextFileAction = target?.combined === true
        ? () => jumpToCombinedFile(combinedPosition.index || 0)
        : onNextFile;
      const currentCombinedIndex = Math.max(0, (combinedPosition.index || 1) - 1);
      const currentCombinedCollapsed = target?.combined === true && collapsedCombinedFiles.has(currentCombinedIndex);
      const allCombinedCollapsed = combinedFiles.length > 0 && collapsedCombinedFiles.size === combinedFiles.length;
      const toggleCombinedFileCollapse = React.useCallback(() => {
        if (target?.combined !== true) return;
        const index = combinedPosition.index - 1;
        if (index < 0 || index >= combinedFilesRef.current.length) return;
        setCollapsedCombinedFiles((current) => {
          const next = new Set(current);
          if (next.has(index)) next.delete(index);
          else next.add(index);
          return next;
        });
      }, [combinedPosition.index, target?.combined]);
      const toggleAllCombinedFiles = React.useCallback(() => {
        if (target?.combined !== true || combinedFilesRef.current.length === 0) return;
        setCollapsedCombinedFiles((current) => current.size === combinedFilesRef.current.length
          ? new Set()
          : new Set(combinedFilesRef.current.map((_, index) => index)));
      }, [target?.combined]);

      React.useEffect(() => {
        const diff = diffRef.current;
        if (diff === null || target?.combined !== true || combinedFiles.length === 0) return;
        const collapsed = [...collapsedCombinedFiles]
          .filter((index) => Number.isInteger(index) && index >= 0 && index < combinedFiles.length);
        const originalRanges = collapsed
          .map((index) => combinedFileHiddenRange(combinedFiles[index], 'original'))
          .filter(Boolean);
        const modifiedRanges = collapsed
          .map((index) => combinedFileHiddenRange(combinedFiles[index], 'modified'))
          .filter(Boolean);
        diff.getModifiedEditor().setHiddenAreas(modifiedRanges);
        diff.getOriginalEditor().setHiddenAreas(originalRanges);
      }, [collapsedCombinedFiles, combinedFiles, monacoReady, target?.combined]);

      /**
       * Open IDEA's Go To Change popup anchored to the hunk counter.
       * @param {MouseEvent} [event] - counter or overflow-button event.
       * @returns {void}
       */
      const openHunkMenu = React.useCallback((event) => {
        const changes = diffRef.current?.getLineChanges?.() ?? [];
        if (changes.length === 0) return;
        const rect = event?.currentTarget?.getBoundingClientRect?.();
        setHunkMenu({
          x: rect === undefined ? 240 : Math.max(4, rect.right - 220),
          y: rect === undefined ? 120 : rect.bottom + 4,
          title: t('editor.goToChange'),
          items: changes.map((change, index) => ({
            id: `change:${index + 1}`,
            label: t('editor.changeAtLine', {
              index: index + 1,
              total: changes.length,
              line: Math.max(1, Number(change.modifiedStartLineNumber) || 1),
            }),
            shortcut: index === hunks.index - 1 ? '✓' : '',
            restoreFocus: false,
            run: () => jumpToDiffHunk(index),
          })),
        });
      }, [hunks.index, jumpToDiffHunk, t]);

      /* F7 / ⇧F7 are IDEA's "next / previous difference". They only act while a
         diff is open, so they cannot collide with the editor's own bindings. */
      React.useEffect(() => {
        const onKeyDown = (event) => {
          /* The diff owns these keys only while it owns the keyboard. Terminal
             emulators, the Project/Change trees and ordinary form controls must
             receive F7, ⌘W, undo and redo themselves. */
          const shortcutTarget = event.target instanceof Element ? event.target : null;
          const insideDiffSurface = shortcutTarget?.closest('[data-dsh-editor-diff-surface]') !== null;
          const insideDiffPane = shortcutTarget?.closest('.dsh-editor-diff-pane') !== null;
          const foreignKeyboardSurface = shortcutTarget?.closest('[data-dsh-editor-terminal], [role="tree"], input, textarea, select, [contenteditable="true"]') !== null;
          if (!insideDiffPane && foreignKeyboardSurface) return;
          const meta = event.metaKey || event.ctrlKey;
          const editableHistory = diffReadOnly === false && editLocked === false;
          if (
            insideDiffPane
            && event.ctrlKey
            && event.shiftKey
            && !event.metaKey
            && !event.altKey
            && event.key === 'Tab'
          ) {
            event.preventDefault();
            event.stopPropagation();
            focusOppositeDiffPane();
            return;
          }
          /* IDEA's Combined Diff action uses literal Control+Escape and
             toggles only the file that owns the current caret. */
          if (isCombinedFileCollapseShortcut(event, insideDiffPane, target?.combined === true)) {
            event.preventDefault();
            event.stopPropagation();
            toggleCombinedFileCollapse();
            return;
          }
          /* IDEA closes the comparison with plain Escape. A context menu or
             Monaco's own find/suggest popup consumes Escape first, so opening
             one does not unexpectedly dismiss the whole diff. */
          const popupOwnsEscape = document.querySelector('[role="menu"]') !== null
            || hostRef.current?.querySelector('.monaco-editor .find-widget.visible, .monaco-editor .suggest-widget.visible') != null;
          if (isDiffCloseShortcut(event, insideDiffPane, popupOwnsEscape)) {
            event.preventDefault();
            event.stopPropagation();
            onClose();
            return;
          }
          /* IDEA's Rollback Lines shares the Commit view's ⌥⌘Z habit. The
             global row-rollback handler already yields inside Monaco. */
          if (meta && event.altKey && !event.shiftKey && event.key.toLowerCase() === 'z') {
            if (!insideDiffPane || !actionableSelection) return;
            event.preventDefault();
            event.stopPropagation();
            restoreSelection();
            return;
          }
          if (meta && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'f') {
            if (!insideDiffSurface) return;
            event.preventDefault();
            event.stopPropagation();
            searchInChanges();
            return;
          }
          if (
            insideDiffPane
            && event.ctrlKey
            && event.metaKey
            && !event.altKey
            && !event.shiftKey
            && event.key === 'ArrowRight'
          ) {
            event.preventDefault();
            event.stopPropagation();
            applyLeftSide();
            return;
          }
          /* IDEA's default macOS keymap maps Control+Shift+Left/Right to
             Previous/Next Change. DSH's combined diff uses the same gesture
             for its changed-file sequence, so that mode keeps file navigation. */
          if (
            insideDiffPane
            && event.ctrlKey
            && event.shiftKey
            && !event.altKey
            && !event.metaKey
            && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
          ) {
            event.preventDefault();
            event.stopPropagation();
            if (target?.combined === true && navigationPosition !== null) {
              if (event.key === 'ArrowLeft') previousFileAction?.();
              else nextFileAction?.();
            } else {
              if (event.key === 'ArrowLeft') walkHunk('previous');
              else walkHunk('next');
            }
            return;
          }
          /* Monaco's Close Tab action lives on the normal editor, not on the
             diff widget. Bind the same IDEA gesture here so the comparison can
             be closed and focus handed back to the next active tab. */
          if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'w') {
            if (shortcutTarget?.closest('input, textarea[data-dsh-diff-find], [contenteditable="true"]') === null) {
              event.preventDefault();
              event.stopPropagation();
              onClose();
              return;
            }
          }
          /* IDEA's EditSource is F4. On a comparison it opens the local file;
             the diff itself must not become the editor when the user wants to
             make the fix rather than only inspect it. */
          if (
            event.key === 'F4'
            && !event.metaKey
            && !event.ctrlKey
            && !event.altKey
            && !event.shiftKey
            && insideDiffPane
            && typeof target?.path === 'string'
            && typeof onOpenLocal === 'function'
            && localPathAvailable !== false
          ) {
            event.preventDefault();
            event.stopPropagation();
            onOpenLocal(target);
            return;
          }
          /* ⌘Z is IDEA's "take the block restore back". The diff surface owns
             the key while it is showing, unless the user is typing in a real
             field (find / rename). */
          if (editableHistory && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'z') {
            if (shortcutTarget?.closest('input, textarea[data-dsh-diff-find], [contenteditable="true"]') === null) {
              event.preventDefault();
              event.stopPropagation();
              undoRestore();
              return;
            }
          }
          /* IDEA's redo is ⇧⌘Z; Windows editors also accept Ctrl+Y. */
          if (
            editableHistory &&
            (((event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === 'z')
              || (event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'y'))
          ) {
            if (shortcutTarget?.closest('input, textarea[data-dsh-diff-find], [contenteditable="true"]') === null) {
              event.preventDefault();
              event.stopPropagation();
              redoRestore();
              return;
            }
          }
          if (event.key !== 'F7') return;
          if (event.metaKey || event.ctrlKey || event.altKey) return;
          event.preventDefault();
          walkHunk(event.shiftKey ? 'previous' : 'next');
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
      }, [actionableSelection, applyLeftSide, editLocked, focusOppositeDiffPane, localPathAvailable, navigationPosition, nextFileAction, onClose, onOpenLocal, previousFileAction, redoRestore, restoreSelection, searchInChanges, target, toggleCombinedFileCollapse, undoRestore, walkHunk]);

      const editorSettingsItems = [
        {
          id: 'whitespace',
          icon: 'ignore',
          label: t('editor.diffIgnoreWhitespace'),
          shortcut: ignoreWhitespace ? '✓' : '',
          active: ignoreWhitespace,
          run: () => setIgnoreWhitespace((value) => !value),
        },
        null,
        {
          id: 'showWhitespaces',
          icon: 'whitespace',
          label: t('editor.diffShowWhitespaces'),
          shortcut: showWhitespaces ? '✓' : '',
          active: showWhitespaces,
          run: () => setShowWhitespaces((value) => !value),
        },
        {
          id: 'lineNumbers',
          icon: 'lineNumbers',
          label: t('editor.diffLineNumbers'),
          shortcut: showLineNumbers ? '✓' : '',
          active: showLineNumbers,
          run: () => setShowLineNumbers((value) => !value),
        },
        {
          id: 'indentGuides',
          icon: 'indentGuides',
          label: t('editor.diffIndentGuides'),
          shortcut: showIndentGuides ? '✓' : '',
          active: showIndentGuides,
          run: () => setShowIndentGuides((value) => !value),
        },
        {
          id: 'softWrap',
          icon: 'wrap',
          label: t('editor.diffSoftWrap'),
          shortcut: softWrap ? '✓' : '',
          active: softWrap,
          run: () => setSoftWrap((value) => !value),
        },
      ];
      const diffToolbarActions = [
        {
          id: 'applyLeftSide',
          icon: 'applyLeft',
          label: t('editor.diffApplyLeftSide'),
          group: 'mode',
          shortcut: '⌃⌘→',
          disabled: diffUnavailable || diffReadOnly || swapSides || editLocked,
          run: applyLeftSide,
        },
        {
          id: 'swapSides',
          icon: 'swap',
          label: t('editor.diffSwapSides'),
          group: 'mode',
          active: swapSides,
          disabled: diffUnavailable,
          run: () => setSwapSides((value) => !value),
        },
        ...(diffReadOnly === false
          ? [{
              id: 'disableEditing',
              icon: editLocked ? 'lock' : 'unlock',
              label: t('editor.diffDisableEditing'),
              group: 'mode',
              active: editLocked,
              disabled: swapSides || diffUnavailable,
              run: () => setEditLocked((value) => !value),
            }]
          : []),
        ...(sideBySide
          ? [
              {
                id: 'focusOppositePane',
                icon: 'switchPane',
                label: t('editor.diffFocusOppositePane'),
                group: 'selection',
                shortcut: '⌃⇧⇥',
                disabled: diffUnavailable,
                restoreFocus: false,
                run: focusOppositeDiffPane,
              },
              {
                id: 'selectPositionInOppositePane',
                icon: 'target',
                label: t('editor.diffSelectOppositePosition'),
                group: 'selection',
                disabled: diffUnavailable,
                restoreFocus: false,
                run: selectPositionInOppositeDiffPane,
              },
            ]
          : []),
        {
          id: 'reloadDiff',
          icon: 'refresh',
          label: t('editor.diffReload'),
          group: 'inspect',
          run: () => setReloadGeneration((current) => current + 1),
        },
        {
          id: 'find',
          icon: 'search',
          label: t('editor.searchInChanges'),
          group: 'inspect',
          shortcut: '⌘F',
          disabled: diffUnavailable,
          run: searchInChanges,
        },
        {
          id: 'collapse',
          icon: collapseUnchanged ? 'expand' : 'collapse',
          label: collapseUnchanged ? t('editor.diffShowUnchanged') : t('editor.diffCollapseUnchanged'),
          group: 'inspect',
          active: collapseUnchanged,
          disabled: diffUnavailable,
          run: () => setCollapseUnchanged((value) => !value),
        },
        ...(target?.combined === true && combinedFiles.length > 0
          ? [{
              id: 'collapseAllCombinedFiles',
              icon: allCombinedCollapsed ? 'expand' : 'collapse',
              label: allCombinedCollapsed ? t('editor.expandAllCombinedFiles') : t('editor.collapseAllCombinedFiles'),
              group: 'inspect',
              active: allCombinedCollapsed,
              disabled: diffUnavailable,
              run: toggleAllCombinedFiles,
            }, {
              id: 'collapseCombinedFile',
              icon: currentCombinedCollapsed ? 'expand' : 'collapse',
              label: currentCombinedCollapsed ? t('editor.expandCombinedFile') : t('editor.collapseCombinedFile'),
              group: 'inspect',
              shortcut: '⌃Esc',
              active: currentCombinedCollapsed,
              disabled: diffUnavailable,
              run: toggleCombinedFileCollapse,
            }]
          : []),
        ...(hunks.total === 0
          ? []
          : [{ id: 'goToChange', icon: 'target', label: t('editor.goToChange'), group: 'inspect', run: () => openHunkMenu() }]),
        {
          id: 'settings',
          icon: 'settings',
          label: t('editor.settings'),
          group: 'inspect',
          disabled: diffUnavailable,
          items: editorSettingsItems,
          run: (event) => openDiffActionSubmenu(event, t('editor.settings'), editorSettingsItems, 'settings'),
        },
        ...(typeof target?.path === 'string' && typeof onOpenLocal === 'function'
          ? [{
              id: 'openLocalVersion',
              icon: 'file',
              label: t('editor.openLocalVersion'),
              group: 'open',
              shortcut: 'F4',
              disabled: localPathAvailable === false,
              run: () => {
                if (localPathAvailable !== false) onOpenLocal(target);
              },
            }]
          : []),
        ...(diffReadOnly === false && swapSides === false
          ? [
              { id: 'undo', icon: 'undo', label: t('editor.diffUndoRestore'), group: 'history', shortcut: '⌘Z', disabled: editLocked || diffUnavailable, run: undoRestore },
              { id: 'redo', icon: 'redo', label: t('editor.diffRedoRestore'), group: 'history', shortcut: '⇧⌘Z', disabled: editLocked || diffUnavailable, run: redoRestore },
            ]
          : []),
        ...(actionableSelection
          ? [{ id: 'selection', icon: 'target', label: t('editor.diffSelectionRestore'), group: 'history', shortcut: '⌥⌘Z', run: restoreSelection }]
          : []),
      ];
      /* Binary and missing targets have no Monaco model to show. Keep their
         message row visible while hiding the empty diff host. */
      const hidden = target === null || state.binary;
      const fileNavMode = diffFileNavModeForWidth(diffToolbarWidth);
      const diffViewModeControl = diffViewModeControlForWidth(diffToolbarWidth);
      const diffActionsKey = diffToolbarActions.map((action) => action.id).join('|');
      const resolvedDirectActionCount = diffDirectActionCount === null
        ? diffToolbarActions.length
        : Math.max(0, Math.min(diffDirectActionCount, diffToolbarActions.length));
      const directDiffActions = diffToolbarActions.slice(0, resolvedDirectActionCount);
      const hiddenDiffActions = diffToolbarActions.slice(resolvedDirectActionCount);
      const directDiffActionEntries = groupDiffToolbarActions(directDiffActions);
      const hiddenDiffActionEntries = groupDiffToolbarActions(hiddenDiffActions);
      const diffActionsCompact = hiddenDiffActions.length > 0;
      const openDiffActionMenu = (rect) => {
        setDiffActionMenu({
          x: Math.max(4, rect.right - 210),
          y: rect.bottom + 4,
          items: hiddenDiffActionEntries.map((action) => action === null ? null : ({
            id: action.id,
            label: action.label,
            shortcut: action.shortcut ?? (action.active === true ? '✓' : ''),
            active: typeof action.active === 'boolean' ? action.active : undefined,
            disabled: action.disabled === true,
            restoreFocus: action.restoreFocus === false ? false : undefined,
            run: action.run,
            items: action.items,
          })),
        });
      };
      const diffFixedLayoutKey = [
        target?.path ?? '',
        target?.staged === true ? '1' : '0',
        target?.revision ?? '',
        target?.clipboardText ?? '',
        target?.combined === true ? '1' : '0',
        includedInCommit === true ? '1' : '0',
        filePosition?.index ?? '',
        filePosition?.total ?? '',
        navigationPosition?.index ?? '',
        navigationPosition?.total ?? '',
        fileNavMode,
        showIncludedSummary === true ? '1' : '0',
      ].join('|');

      React.useLayoutEffect(() => {
        const node = diffToolbarRef.current;
        if (node === null) return undefined;
        const measure = () => {
          const width = node.clientWidth;
          const fixedWidth = [...node.querySelectorAll('[data-dsh-diff-fixed]')]
            .reduce((sum, control) => sum + control.getBoundingClientRect().width, 0);
          const next = diffDirectActionCountForWidth(width, fixedWidth, diffToolbarActions);
          setDiffDirectActionCount((current) => (current === next ? current : next));
          if (!Number.isFinite(width)) return;
          setDiffToolbarWidth((current) => (Math.abs(current - width) < 0.5 ? current : width));
        };
        let timer = 0;
        const scheduleMeasure = () => {
          if (timer !== 0) return;
          timer = window.setTimeout(() => {
            timer = 0;
            measure();
          }, 16);
        };
        measure();
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
        observer?.observe(node);
        /* ResizeObserver is not delivered in every embedded webview while a
           splitter is being dragged; pointer/resize events are the fallback. */
        window.addEventListener('mousemove', scheduleMeasure, { passive: true });
        window.addEventListener('resize', scheduleMeasure);
        return () => {
          observer?.disconnect();
          window.removeEventListener('mousemove', scheduleMeasure);
          window.removeEventListener('resize', scheduleMeasure);
          if (timer !== 0) window.clearTimeout(timer);
        };
      }, [diffActionsKey, diffFixedLayoutKey]);

      React.useEffect(() => {
        if (!diffActionsCompact) setDiffActionMenu(null);
      }, [diffActionsCompact]);

      return React.createElement(
        'div',
        { style: styles.diffPane, className: 'dsh-editor-diff-pane' },
        React.createElement(
          'div',
          { ref: diffToolbarRef, style: styles.diffToolbar, className: 'dsh-editor-diff-toolbar', role: 'toolbar', 'aria-label': t('editor.diffToolbar') },
          target?.combined === true
            ? React.createElement(
                'span',
                { style: styles.diffTitle, className: 'dsh-editor-diff-title' },
                target.revisionPair !== null && typeof target.revisionPair === 'object'
                  ? t('editor.compareRevisionsTitle', { count: target.entries?.length ?? 0 })
                  : typeof target.commitWithLocal === 'string'
                  ? t('editor.compareWithLocalTitle', { count: target.entries?.length ?? 0 })
                  : t('editor.combinedDiffTitle', { count: target.entries?.length ?? 0 }),
              )
            : React.createElement(PathLabel, { path: target?.path ?? '', style: styles.diffTitle }),
          React.createElement(
            'span',
            { style: styles.diffHint, className: 'dsh-editor-diff-hint', 'data-dsh-diff-fixed': '' },
            target?.combined === true
              ? target.revisionPair !== null && typeof target.revisionPair === 'object'
                ? t('editor.compareRevisionsMode', {
                    left: String(target.revisionPair.left ?? '').slice(0, 7),
                    right: String(target.revisionPair.right ?? '').slice(0, 7),
                  })
                : typeof target.commitWithLocal === 'string'
                ? t('editor.compareWithLocalMode', { hash: target.commitWithLocal.slice(0, 7) })
                : t('editor.combinedDiffMode', { count: target.entries?.length ?? 0 })
              : typeof target?.clipboardText === 'string'
              ? t('editor.compareClipboardMode')
              : typeof target?.revision === 'string'
                ? t('editor.compareRevisionMode', { hash: target.revision.slice(0, 7) })
              : typeof target?.commit === 'string'
                ? t('editor.commitDiffMode', { hash: target.commit.slice(0, 7) })
                : target?.staged === true
                  ? t('editor.stagedMode')
                  : t('editor.unstagedMode'),
          ),
          filePosition === null && navigationPosition === null
            ? null
            : fileNavMode === 'hidden'
              ? null
              : fileNavMode === 'compact'
                ? React.createElement(
                    'span',
                    {
                      style: styles.fileNavCapsule,
                      className: 'dsh-editor-file-nav dsh-editor-file-nav-capsule',
                      'data-dsh-diff-fixed': '',
                      role: 'button',
                      tabIndex: 0,
                      title: t('editor.fileNavCapsuleHint', { index: navigationPosition.index, total: navigationPosition.total }),
                      'aria-label': t('editor.fileNavCapsuleHint', { index: navigationPosition.index, total: navigationPosition.total }),
                      onClick: (event) => (event.shiftKey ? previousFileAction : nextFileAction)?.(),
                      onKeyDown: (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          (event.shiftKey ? previousFileAction : nextFileAction)?.();
                        } else if (event.key === 'ArrowLeft') {
                          event.preventDefault();
                          previousFileAction?.();
                        } else if (event.key === 'ArrowRight') {
                          event.preventDefault();
                          nextFileAction?.();
                        }
                      },
                      onContextMenu: (event) => {
                        event.preventDefault();
                        previousFileAction?.();
                      },
                    },
                    `${navigationPosition.index}/${navigationPosition.total}`,
                  )
                : React.createElement(
                    'span',
                    {
                      style: styles.fileNav,
                      className: 'dsh-editor-file-nav',
                      'data-dsh-diff-fixed': '',
                      title: t('editor.filePositionHint', { index: navigationPosition.index, total: navigationPosition.total }),
                    },
                    React.createElement(ToolbarButton, {
                      icon: 'chevronLeft',
                      label: t('editor.previousFile'),
                      disabled: navigationPosition.index <= 1 || previousFileAction === undefined,
                      onClick: () => previousFileAction?.(),
                    }),
                    React.createElement(
                      'span',
                      { style: styles.fileNavCounter, 'aria-label': t('editor.filePositionHint', { index: navigationPosition.index, total: navigationPosition.total }) },
                      `${navigationPosition.index}/${navigationPosition.total}`,
                    ),
                    React.createElement(ToolbarButton, {
                      icon: 'chevronRight',
                      label: t('editor.nextFile'),
                      disabled: navigationPosition.index >= navigationPosition.total || nextFileAction === undefined,
                      onClick: () => nextFileAction?.(),
                    }),
                  ),
          React.createElement(
            'span',
            { style: styles.diffToolbarActions, className: 'dsh-editor-diff-toolbar-actions' },
            showIncludedSummary
              ? React.createElement(
                  'span',
                  {
                    style: styles.diffSummary,
                    className: 'dsh-editor-diff-summary',
                    'data-dsh-diff-fixed': '',
                    title: includedState === 'all' ? t('editor.diffSummaryAllHint') : t('editor.diffSummaryNoneHint'),
                    'aria-label': includedState === 'all' ? t('editor.diffSummaryAllHint') : t('editor.diffSummaryNoneHint'),
                  },
                  includedState === 'all'
                    ? t('editor.diffSummaryAll', { count: hunks.total })
                    : includedState === 'none'
                      ? t('editor.diffSummaryNone', { count: hunks.total })
                      : null,
                )
              : null,
            directDiffActionEntries.map((action, index) =>
              action === null
                ? React.createElement('span', {
                    key: `diff-separator-${index}`,
                    className: 'dsh-editor-diff-toolbar-separator',
                    style: styles.diffToolbarSeparator,
                    role: 'separator',
                    'aria-orientation': 'vertical',
                  })
                : React.createElement(ToolbarButton, {
                    key: action.id,
                    icon: action.icon,
                    label: action.label,
                    active: toolbarActionActive(action),
                    disabled: action.disabled === true,
                    onClick: action.run,
                    ariaHasPopup: Array.isArray(action.items) ? 'menu' : undefined,
                    ariaExpanded: Array.isArray(action.items) ? diffActionMenu?.actionId === action.id : undefined,
                  }),
            ),
            diffActionsCompact
              ? React.createElement(ToolbarButton, {
                  icon: 'more',
                  label: t('editor.moreActions'),
                  onClick: (event) => {
                    openDiffActionMenu(event.currentTarget.getBoundingClientRect());
                  },
                  onKeyDown: (event) => {
                    if (event.key === 'ContextMenu' || (event.shiftKey === true && event.key === 'F10')) {
                      event.preventDefault();
                      event.stopPropagation();
                      openDiffActionMenu(event.currentTarget.getBoundingClientRect());
                    }
                  },
                  onContextMenu: (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openDiffActionMenu(event.currentTarget.getBoundingClientRect());
                  },
                  ariaHasPopup: 'menu',
                  ariaExpanded: diffActionMenu !== null,
                })
              : null,
            React.createElement(DiffViewModeControl, {
              t,
              mode: diffViewModeControl,
              sideBySide,
              disabled: diffUnavailable,
              onChange: setSideBySide,
            }),
            /* IDEA's diff toolbar: walk hunks, and say which one you are on. Hidden for
               an unchanged file — `0/0` next to two arrows that do nothing is noise. */
            hunks.total === 0
              ? null
                : React.createElement(
                    React.Fragment,
                    null,
                    React.createElement(
                      'span',
                      { style: styles.hunkNav, className: 'dsh-editor-hunk-nav', 'data-dsh-diff-fixed': '' },
                      React.createElement(ToolbarButton, { icon: 'chevronUp', label: t('editor.previousChange'), onClick: () => walkHunk('previous') }),
                      React.createElement(
                        'span',
                        {
                          style: styles.hunkCounter,
                          className: 'dsh-editor-hunk-counter',
                          role: 'button',
                          tabIndex: 0,
                          title: t('editor.goToChangeHint', { index: hunks.index, total: hunks.total }),
                          'aria-label': t('editor.goToChangeHint', { index: hunks.index, total: hunks.total }),
                          onClick: (event) => openHunkMenu(event),
                          onKeyDown: (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              openHunkMenu(event);
                            } else if (event.key === 'ArrowUp') {
                              event.preventDefault();
                              walkHunk('previous');
                            } else if (event.key === 'ArrowDown') {
                              event.preventDefault();
                              walkHunk('next');
                            }
                          },
                          onContextMenu: (event) => {
                            event.preventDefault();
                            openHunkMenu(event);
                          },
                        },
                        `${hunks.index}/${hunks.total}`,
                      ),
                      React.createElement(ToolbarButton, { icon: 'chevronDown', label: t('editor.nextChange'), onClick: () => walkHunk('next') }),
                    ),
                    /* At a quarter width the arrows cannot fit even with the
                       hint hidden. Keep the current position visible and make
                       the capsule itself walk to the next hunk; F7 / ⇧F7
                       remain the two-way keyboard path. */
                    React.createElement(
                      'span',
                      {
                        style: styles.hunkCapsule,
                        className: 'dsh-editor-hunk-nav dsh-editor-hunk-capsule',
                        'data-dsh-diff-fixed': '',
                        role: 'button',
                        tabIndex: 0,
                        title: t('editor.hunkCapsuleHint', { index: hunks.index, total: hunks.total }),
                        'aria-label': t('editor.hunkCapsuleHint', { index: hunks.index, total: hunks.total }),
                        onClick: (event) => walkHunk(event.shiftKey ? 'previous' : 'next'),
                        onKeyDown: (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            walkHunk(event.shiftKey ? 'previous' : 'next');
                          } else if (event.key === 'ArrowLeft') {
                            event.preventDefault();
                            walkHunk('previous');
                          } else if (event.key === 'ArrowRight') {
                            event.preventDefault();
                            walkHunk('next');
                          }
                        },
                        onContextMenu: (event) => {
                          event.preventDefault();
                          walkHunk('previous');
                        },
                      },
                      `${hunks.index}/${hunks.total}`,
                    ),
                  ),
            React.createElement(
              'span',
              { 'data-dsh-diff-fixed': '', style: { display: 'inline-flex', flex: 'none' } },
              React.createElement(ToolbarButton, { icon: 'hide', label: t('editor.closeDiff'), onClick: onClose }),
            ),
          ),
        ),
        diffActionMenu === null ? null : React.createElement(ContextMenu, {
          menu: diffActionMenu,
          onClose: () => setDiffActionMenu(null),
          t,
        }),
        hunkMenu === null ? null : React.createElement(ContextMenu, {
          menu: hunkMenu,
          onClose: () => setHunkMenu(null),
          t,
        }),
        typeof target?.commit === 'string' || typeof target?.revision === 'string' || typeof target?.clipboardText === 'string' || target?.combined === true
          ? null
          : React.createElement(
              'div',
              { style: styles.diffRestoreHint, role: undoNotice === null ? undefined : 'status' },
              undoNotice ?? t(target?.staged === true ? 'editor.diffRestoreHintStaged' : 'editor.diffRestoreHint'),
            ),
        sideBySide
          ? React.createElement(
              'div',
              { style: styles.diffSideHeaders, className: 'dsh-editor-diff-side-headers' },
              React.createElement('span', { style: styles.diffSideHeader }, displayedSideLabels.left),
              React.createElement('span', { style: { ...styles.diffSideHeader, ...styles.diffSideHeaderDivider } }, displayedSideLabels.right),
            )
          : null,
        state.error !== null ? React.createElement('div', { style: styles.error }, state.error) : null,
        state.binary ? React.createElement('div', { style: styles.empty }, t('editor.binaryDiff')) : null,
        React.createElement('div', {
          ref: hostRef,
          style: { ...styles.diffHost, display: hidden ? 'none' : 'block' },
          onKeyDown: onDiffHostKeyDown,
          'data-dsh-editor-diff-surface': '',
        }),
      );
    }

    /**
     * Commit tool window: grouped changes tree, diff preview, message box and actions.
     *
     * Staged and working-tree groups are separate, like IDEA's commit panel, and
     * a file's checkbox decides what the commit contains.
     */
