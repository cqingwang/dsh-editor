import React from 'react';
import { styles } from '../../ui/styles';
import { ContextMenu } from '../ui/Menu';
import { Icon } from '../ui/Icon';
import { ToolbarButton } from '../ui/ToolbarButton';
import { TerminalScreen } from './TerminalScreen';
import { callFs, currentTerminalScope } from '../../editor-core';
import {
  countTerminalMatches,
  directTerminalShortcut,
  moveTerminalSelection,
  overflowTabs,
  pasteIntoTerminal,
  pushPasteHistory,
  terminalAdjacentBlockRange,
  terminalBlockKeyboardAction,
  terminalExpandBlockRange,
  terminalLastBlockSelection,
  terminalMenuModel,
  terminalMoveTarget,
  terminalPromptSelection,
  terminalPromptStartRow,
  terminalSelectionBlockRange,
  terminalTabContextFocus,
  terminalTabMenu,
  type TerminalEmulator,
  visibleTabCount,
  writeTerminalText,
} from '../../find-tool';
import { snapSplitPercent } from '../../injected-css';
import {
  callTerminal,
  clearTerminalLiveBuffer,
  forgetTerminalLiveBuffer,
  hostErrorText,
  persistTerminalRestoreSnapshots,
  readClosedTerminals,
  readEditorTerminals,
  readmeInDirectory,
  readStoredNumber,
  readTerminalColors,
  readTerminalProfile,
  readTerminalRestoreSnapshots,
  reconcileTerminalDockState,
  seedTerminalRestoreBuffer,
  storeFontSize,
  TERMINAL_COLORS,
  terminalActiveAfterClose,
  terminalFontSize,
  type TerminalDescription,
  writeEditorTerminals,
  writeTerminalColors,
  writeTerminalRestoreSnapshots,
} from '../../terminal';
import { MeasuringScreen } from './MeasuringScreen';

type Translate = (key: string, params?: Record<string, unknown>) => string;

interface TerminalGrid {
  cols: number;
  rows: number;
}

interface TerminalFindState {
  query: string;
  index: number;
  total: number;
}

interface TerminalRenameState {
  id: string;
  value: string;
  previous: string;
}

interface TerminalRestoreEntry {
  shell: string;
  cwd: string;
  title: string;
}

interface TerminalSelectionPosition {
  start: { x: number; y: number };
  end: { x: number; y: number };
}

export interface TerminalPanelProps {
  t: Translate;
  generation: number;
  startDirectory: string | null;
  workspaceRoot?: string;
  onStartDirectoryUsed?: () => void;
  onRequestNew?: () => void;
  onRequestClose?: () => void;
  onOpenFile?: (path: string) => void;
  onEditorTerminals?: (terminals: Array<{ id?: string; [key: string]: unknown }>) => void;
  onSwitchFocusToEditor?: () => void;
  focusGeneration?: number;
  [key: string]: unknown;
}

function TerminalPanel({
  t,
  generation,
  startDirectory,
  workspaceRoot = '',
  onStartDirectoryUsed,
  onRequestNew,
  onRequestClose,
  onOpenFile,
  onEditorTerminals,
  onSwitchFocusToEditor,
  focusGeneration = 0,
}: TerminalPanelProps) {
  const [terminals, setTerminals] = React.useState<TerminalDescription[]>([]);
  /* The live directory per terminal, updated from OSC 7. The menu builds its
     items from a render snapshot, so a `cd` right before the click would
     otherwise be missed. */
  const terminalCwdRef = React.useRef(new Map<string, string>());
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const closingTerminalIdsRef = React.useRef(new Set<string>());
  const terminalReorderRequestRef = React.useRef(0);
  const [available, setAvailable] = React.useState(true);
  /* Resolved README per terminal, so the tab menu can disable the item when the
     shell's directory has none (the cwd alone is always a non-empty string). */
  const [readmePaths, setReadmePaths] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  /* Terminals that were moved INTO the editor area (IDEA's "Move to Editor").
     Their PTY keeps running; the dock stops rendering the tab. */
  const [editorIds, setEditorIds] = React.useState(() => readEditorTerminals());
  const editorIdsRef = React.useRef(editorIds);
  React.useEffect(() => {
    editorIdsRef.current = editorIds;
    writeEditorTerminals(editorIds);
  }, [editorIds]);
  /* Tell the workspace which terminals now belong in the editor area. The
     editor renders them; this component only knows the ids. */
  React.useEffect(() => {
    if (onEditorTerminals === undefined) return;
    onEditorTerminals(terminals.filter((terminal) => editorIds.includes(terminal.id)));
  }, [editorIds, onEditorTerminals, terminals]);
  /**
   * Send one terminal into the editor area (IDEA's Move to Editor).
   *
   * The dock keeps the process; it simply stops rendering the tab. A split
   * pane bound to that terminal is released first, or both areas would trace
   * the same PTY.
   * @param {object} terminal - terminal description from the tab.
   * @returns {void}
   */
  const moveTerminalToEditor = React.useCallback(
    (terminal: TerminalDescription): void => {
      if (terminal === null || terminal === undefined) return;
      const remaining = terminals.find(
        (candidate) => candidate.id !== terminal.id && !editorIds.includes(candidate.id),
      );
      setEditorIds((current) => (current.includes(terminal.id) ? current : [...current, terminal.id]));
      setSplitId((current) => (current === terminal.id ? null : current));
      setActiveId((current) => (current === terminal.id ? (remaining?.id ?? null) : current));
    },
    [editorIds, terminals],
  );

  /**
   * Bring one terminal back to the dock (the reverse of Move to Editor).
   * @param {object} terminal - terminal description.
   * @returns {void}
   */
  const returnTerminalToDock = React.useCallback((terminal: TerminalDescription): void => {
    if (terminal === null || terminal === undefined) return;
    setEditorIds((current) => current.filter((id) => id !== terminal.id));
    setActiveId(terminal.id);
  }, []);
  /* IDEA splits the terminal dock: the right pane follows its own tab. */
  const [splitId, setSplitId] = React.useState<string | null>(null);
  /* The split ratio survives a reload, like IDEA's dock proportions. */
  const [splitPercent, setSplitPercent] = React.useState(() =>
    readStoredNumber('dsh-editor.terminal.splitPercent', 50),
  );
  const [splitDragging, setSplitDragging] = React.useState(false);
  /* Which pane owns the keyboard; IDEA highlights that pane's tab. */
  const [focusedPane, setFocusedPane] = React.useState<'left' | 'right'>('left');
  /* Keyboard handlers are bound once, so they read the pane through a ref. */
  const focusedPaneRef = React.useRef<'left' | 'right'>('left');
  const splitIdRef = React.useRef<string | null>(null);
  const tRef = React.useRef(t);
  tRef.current = t;
  React.useEffect(() => {
    splitIdRef.current = splitId;
  }, [splitId]);
  /**
   * The grid a NEW shell must start at.
   *
   * zsh's PROMPT_SP pads to the PTY width and erases its `%` marker with a
   * backspacing space; if the PTY is wider than the xterm that displays it,
   * that padded line wraps and the `%` is left stranded on the row above the
   * prompt. So the size is measured by the dock itself (see the measuring
   * screen below) instead of a hard-coded 80×24.
   */
  const measuredRef = React.useRef<TerminalGrid | null>(null);
  /* Callers waiting for the first measurement (see `awaitMeasured`). */
  const measureWaiters = React.useRef<Array<(value: TerminalGrid) => void>>([]);
  const reportGrid = React.useCallback((value: TerminalGrid): void => {
    measuredRef.current = value;
    const waiters = measureWaiters.current;
    if (waiters.length === 0) return;
    measureWaiters.current = [];
    for (const resolve of waiters) resolve(value);
  }, []);
  /**
   * The grid a shell should be spawned at, waiting briefly for the screen.
   *
   * Fitting takes one async xterm load, while `+` can be clicked the moment
   * the dock appears. Spawning before the fit is done is exactly the 80-column
   * guess this fix removes, so the click waits — but only for a moment, and
   * the 80×24 fallback stands if xterm never loads.
   * @param {number} timeout - how long to wait for a measurement.
   * @returns {Promise<{cols: number, rows: number}>} the grid to spawn with.
   */
  const awaitMeasured = React.useCallback((timeout = 400): Promise<TerminalGrid> => {
    if (measuredRef.current !== null) return Promise.resolve(measuredRef.current);
    return new Promise<TerminalGrid>((resolve) => {
      let settled = false;
      const finish = (value: TerminalGrid | null): void => {
        if (settled) return;
        settled = true;
        resolve(
          value ?? {
            cols: 80,
            rows: 24,
          },
        );
      };
      measureWaiters.current.push(finish);
      window.setTimeout(() => finish(measuredRef.current), timeout);
    });
  }, []);
  const [shellMenu, setShellMenu] = React.useState(null);
  const [fontSize, setFontSize] = React.useState(() => readStoredNumber('dsh-editor.terminal.fontSize', 12));
  const [renaming, setRenaming] = React.useState<TerminalRenameState | null>(null);
  const [menu, setMenu] = React.useState(null);
  /* The tab strip's measured width; 0 until the first layout pass. */
  const [tabStripWidth, setTabStripWidth] = React.useState(0);
  const tabStripRef = React.useRef(null);
  /* The dock's find bar; its opening query comes from the last search. */
  const [find, setFind] = React.useState<TerminalFindState | null>(null);
  /* The one-shot key listener needs to know whether the find bar is open. */
  const findRef = React.useRef(null);
  const findInputRef = React.useRef(null);
  React.useEffect(() => {
    findRef.current = find;
  }, [find]);
  React.useEffect(() => {
    if (find === null) return undefined;
    /* ContextMenu restores focus to its opener while unmounting. Defer one
       tick so the newly opened find field owns the keyboard afterwards. */
    const timer = window.setTimeout(() => findInputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [find === null]);
  const lastTerminalQuery = React.useRef('');
  /* Clipboard outcomes are invisible otherwise; show the last one briefly. */
  const [clipboardNotice, setClipboardNotice] = React.useState(null);
  const [pasteHistory, setPasteHistory] = React.useState([]);
  React.useEffect(() => {
    if (clipboardNotice === null) return undefined;
    const timer = window.setTimeout(() => setClipboardNotice(null), 2500);
    return () => window.clearTimeout(timer);
  }, [clipboardNotice]);
  /* IDEA collapses overflow tabs into `»`; that needs the strip's real width. */
  React.useLayoutEffect(() => {
    const node = tabStripRef.current;
    if (node === null) return undefined;
    const measure = () => setTabStripWidth(node.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /**
   * Reveal one shell's working directory in the system file manager.
   *
   * The shell can `cd` outside the workspace, and the host only reveals paths
   * inside it — so a rejected reveal falls back to the workspace root instead
   * of doing nothing (a menu item that silently fails reads as broken).
   * @param {string} cwd - absolute directory the shell is in.
   * @returns {Promise<void>} resolves once the reveal was attempted.
   */
  /**
   * Open the README that sits in a shell's directory.
   *
   * The tab menu shows the item disabled when there is none, so this only runs
   * for a directory that has one; it still tolerates a race (the file deleted
   * between menu build and click) by reporting the failure instead of throwing.
   * @param {string} cwd - the shell's absolute working directory.
   * @returns {Promise<void>} resolves when the tab is opened or the failure is shown.
   */
  const openTerminalReadme = React.useCallback(
    async (cwd: string): Promise<void> => {
      const absolute = typeof cwd === 'string' ? cwd : '';
      if (absolute === '') return;
      const root = workspaceRoot;
      const prefix = root !== '' && absolute.startsWith(`${root}/`) ? root.length + 1 : -1;
      const relative = prefix > 0 ? absolute.slice(prefix) : absolute === root ? '' : null;
      if (relative === null) {
        setClipboardNotice(
          t('editor.terminalLinkFailed', {
            path: absolute,
          }),
        );
        return;
      }
      try {
        const listing = await callFs({
          op: 'list',
          path: relative,
          showHidden: false,
          sort: 'name',
        });
        const entries = Array.isArray(listing.entries)
          ? (listing.entries as Array<{ kind?: unknown; name?: unknown }>)
          : [];
        const names = entries
          .filter((entry) => entry.kind !== 'directory' && typeof entry.name === 'string')
          .map((entry) => String(entry.name));
        const path = readmeInDirectory(names, relative);
        setReadmePaths((current) => ({
          ...current,
          [cwd]: path ?? '',
        }));
        if (path === null) {
          setClipboardNotice(
            t('editor.terminalLinkFailed', {
              path: relative === '' ? absolute : relative,
            }),
          );
          return;
        }
        await onOpenFile?.(path);
      } catch (failure) {
        setClipboardNotice(failure instanceof Error ? failure.message : String(failure));
      }
    },
    [onOpenFile, t, workspaceRoot],
  );
  const revealTerminalDirectory = React.useCallback(
    async (cwd: string): Promise<void> => {
      const absolute = typeof cwd === 'string' ? cwd : '';
      if (absolute === '') return;
      try {
        /* Translate the absolute path back to the workspace-relative form the API
         wants; a directory outside the workspace (the shell can `cd /tmp`) is
         sent absolute instead of silently falling back to the root. */
        const root = workspaceRoot;
        const prefix = root !== '' && absolute.startsWith(`${root}/`) ? root.length + 1 : -1;
        const relative = prefix > 0 ? absolute.slice(prefix) : absolute === root ? '' : null;
        if (relative === null)
          await callFs({
            op: 'reveal',
            path: absolute,
            absolute: true,
          });
        else
          await callFs({
            op: 'reveal',
            path: relative,
          });
      } catch (failure) {
        const message = failure instanceof Error ? failure.message : String(failure);
        setClipboardNotice(hostErrorText(message, t, absolute));
      }
    },
    [workspaceRoot],
  );

  /** Open the terminal find bar pre-filled with the previous query. */
  const openTerminalFind = (emulator: TerminalEmulator | null | undefined): void => {
    const query = lastTerminalQuery.current;
    const total =
      query === '' || emulator === null || emulator === undefined ? 0 : countTerminalMatches(emulator, query);
    setFind({
      query,
      index: 0,
      total,
    });
  };
  /* Tab drag-reorder state; IDEA lets you pull a terminal tab sideways. */
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [dragOverId, setDragOverId] = React.useState<string | null>(null);
  const newButtonRef = React.useRef(null);
  /* Emulators are owned by TerminalScreen; these mirror them for menus and shortcuts. */
  const emulatorRef = React.useRef<TerminalEmulator | null>(null);
  const splitEmulatorRef = React.useRef<TerminalEmulator | null>(null);
  const screenSelectionPositionRef = React.useRef<{
    left: TerminalSelectionPosition | null;
    right: TerminalSelectionPosition | null;
  }>({
    left: null,
    right: null,
  });
  const activeRef = React.useRef<string | null>(null);
  const terminalsRef = React.useRef<TerminalDescription[]>([]);
  /* The link provider runs on xterm's schedule, so the cwd is read through a ref. */
  const cwdRef = React.useRef('');
  /* Input must reach the PTY in typing order, so writes ride one promise chain. */
  const writeChain = React.useRef(Promise.resolve());
  /* Whether the retained-terminal list has settled, so auto-start never doubles a tab.
     This is state, not a ref: the auto-start effect must re-run when it flips. */
  const [loaded, setLoaded] = React.useState(false);
  /* The persistence callback is declared after the list effect; the ref bridges them. */
  const rememberTerminalsRef = React.useRef(null);
  /* Whether this mount already auto-opened its first shell. */
  const openedRef = React.useRef(false);
  /* Recently closed terminals for this Session, newest first. */
  const [closedHistory, setClosedHistory] = React.useState<TerminalRestoreEntry[]>(() => readClosedTerminals());
  /* Per-tab colour, an IDEA grouping aid; stored in the browser, not the host. */
  const [colors, setColors] = React.useState<Record<string, string>>(() => readTerminalColors());
  /* The key handler is bound once, so it reads the history through a ref. */
  const closedHistoryRef = React.useRef(closedHistory);
  React.useEffect(() => {
    closedHistoryRef.current = closedHistory;
  }, [closedHistory]);
  React.useEffect(() => {
    activeRef.current = activeId;
  }, [activeId]);
  React.useEffect(() => {
    focusedPaneRef.current = focusedPane;
  }, [focusedPane]);
  React.useEffect(() => {
    terminalsRef.current = terminals;
    /* Keep the remembered profile in step with the live tabs. */
    if (terminals.length > 0) rememberTerminalsRef.current?.(terminals);
  }, [terminals]);
  React.useEffect(() => {
    persistTerminalRestoreSnapshots(terminals);
  }, [terminals]);
  React.useEffect(() => {
    const persist = () => persistTerminalRestoreSnapshots(terminalsRef.current);
    const timer = window.setInterval(persist, 1000);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') persist();
    };
    window.addEventListener('pagehide', persist);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      persist();
      window.clearInterval(timer);
      window.removeEventListener('pagehide', persist);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  /* Ask the host which terminals this Session still retains. */
  const refresh = React.useCallback(async () => {
    try {
      const value = await callTerminal({
        op: 'list',
      });
      const listed = Array.isArray(value?.terminals) ? value.terminals : [];
      const reconciled = reconcileTerminalDockState(listed, editorIdsRef.current, activeRef.current);
      setAvailable(value.available !== false);
      setTerminals(listed);
      setEditorIds(reconciled.editorIds);
      setActiveId(reconciled.activeId);
      setError(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setLoaded(true);
    }
  }, []);
  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  /* Renaming a tab clears the auto-title flag, so a later OSC title cannot undo it. */
  const renamedRef = React.useRef(new Set());
  /**
   * Adopt a shell-published title, unless the user renamed that tab by hand.
   *
   * OSC titles can arrive per prompt (zsh's precmd) or per command; the host
   * keeps the authoritative name so a remount replays the same tab label.
   * @param {string} id - terminal identity.
   * @param {string} title - title the shell published.
   */
  const syncTerminalTitle = React.useCallback(async (id: string, title: string): Promise<void> => {
    if (renamedRef.current.has(id)) return;
    const current = terminalsRef.current.find((terminal) => terminal.id === id);
    if (current === undefined || current.title === title) return;
    setTerminals((list) =>
      list.map((terminal) =>
        terminal.id === id
          ? {
              ...terminal,
              title,
            }
          : terminal,
      ),
    );
    void callTerminal({
      op: 'rename',
      id,
      title,
      auto: true,
    }).catch(() => {});
  }, []);

  /**
   * Follow the shell's own working directory (reported via OSC 7).
   *
   * The PTY metadata keeps the directory the tab was created in; the menu actions
   * need where the user actually is. Only the local list is updated, and only when
   * it changes, so typing does not re-render the dock on every prompt.
   * @param {string} id - terminal id.
   * @param {string} cwd - absolute directory the shell reported.
   * @returns {void}
   */
  const syncTerminalCwd = React.useCallback((id: string, cwd: string): void => {
    if (typeof cwd !== 'string' || cwd === '') return;
    setTerminals((list) => {
      const target = list.find((terminal) => terminal.id === id);
      if (target === undefined || target.cwd === cwd) return list;
      return list.map((terminal) =>
        terminal.id === id
          ? {
              ...terminal,
              cwd,
            }
          : terminal,
      );
    });
    /* The tab menu reads `terminal.cwd` from the render snapshot; keep the host
       description in step too so a later re-read agrees. */
    terminalCwdRef.current.set(id, cwd);
  }, []);

  /** Queue one keystroke behind the previous one so the PTY sees typing order. */
  const sendInput = React.useCallback((id: string, data: string): Promise<void> => {
    writeChain.current = writeChain.current
      .then(async () => {
        await callTerminal({
          op: 'write',
          id,
          data,
        });
      })
      .catch(() => {});
    return writeChain.current;
  }, []);

  /**
   * Remember the open tabs' shells and working directories for the next mount.
   *
   * The host keeps the PTY and its screen buffer, but a host restart drops
   * both. Persisting only `shell` + `cwd` is enough to rebuild an equivalent
   * dock (IDEA reopens the last shell tabs without their scrollback too).
   */
  const rememberTerminals = React.useCallback((list: TerminalDescription[]): void => {
    try {
      const profile = list
        .filter((terminal) => typeof terminal.shell === 'string' && terminal.shell !== '')
        .map((terminal) => ({
          shell: terminal.shell,
          cwd: terminal.cwd ?? '',
          title: terminal.title ?? '',
        }));
      window.localStorage.setItem(`dsh-editor.terminal.profile:${currentTerminalScope()}`, JSON.stringify(profile));
    } catch {
      /* a storage-less browser simply does not restore */
    }
  }, []);
  /* Bridge for the list effect above, which runs before this callback exists. */
  rememberTerminalsRef.current = rememberTerminals;

  /**
   * Remember a terminal that was just closed, so it can be reopened.
   *
   * IDEA keeps closed tabs in the tab menu's history. Only the shell and cwd
   * can be restored — the PTY and its scrollback died with the close.
   * @param {{shell: string, cwd: string, title: string}} terminal - description before closing.
   */
  const rememberClosed = React.useCallback((terminal: TerminalDescription): void => {
    if (terminal === null || typeof terminal.shell !== 'string') return;
    setClosedHistory((current) => {
      const entry = {
        shell: terminal.shell,
        cwd: terminal.cwd ?? '',
        title: terminal.title ?? '',
      };
      const next = [entry, ...current.filter((item) => !(item.shell === entry.shell && item.cwd === entry.cwd))].slice(
        0,
        8,
      );
      try {
        window.localStorage.setItem(`dsh-editor.terminal.closed:${currentTerminalScope()}`, JSON.stringify(next));
      } catch {
        /* storage-less browsers keep the in-memory list only */
      }
      return next;
    });
  }, []);

  /**
   * Turn a terminal-create rejection into a sentence the dock can act on.
   *
   * The host caps retained shells per Session; its wording ("at most 6
   * terminals are retained per Session") is accurate but does not say what to
   * do. IDEA tells you to close a tab, so that is what the dock says.
   * @param {unknown} failure - rejection from the host call.
   * @returns {string} message for the dock's status bar.
   */
  const describeCreateFailure = React.useCallback(
    (failure: unknown): string => {
      const message = failure instanceof Error ? failure.message : String(failure);
      return /at most \d+ terminals/iu.test(message) ? t('editor.terminalLimit') : message;
    },
    [t],
  );
  const createTerminal = React.useCallback(
    async (
      shellPath: string | undefined = undefined,
      directory: string | undefined = undefined,
      restoreSnapshot = '',
    ) => {
      setBusy(true);
      setError(null);
      try {
        const grid = await awaitMeasured();
        const value = await callTerminal({
          op: 'create',
          cols: grid.cols,
          rows: grid.rows,
          shellPath,
          /* An explicit directory (duplicate / "open in terminal") wins; otherwise the
           ambient start directory from the tree, which a plain new tab ignores
           unless "open in terminal" was used. */
          startPath:
            typeof directory === 'string' && directory !== ''
              ? directory
              : shellPath === undefined && typeof startDirectory === 'string'
                ? startDirectory
                : '',
        });
        const created = value.terminal;
        seedTerminalRestoreBuffer(created.id, restoreSnapshot);
        setTerminals((current) => [...current, created]);
        setActiveId(created.id);
        /* "Open in Terminal" from a directory: enter it once the shell is up. */
        if (shellPath === undefined && typeof startDirectory === 'string' && startDirectory !== '')
          onStartDirectoryUsed?.();
        return created;
      } catch (failure) {
        setError(describeCreateFailure(failure));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [awaitMeasured, describeCreateFailure, startDirectory, onStartDirectoryUsed],
  );

  /**
   * Cycle one tab through IDEA's colour palette (and back to no colour).
   *
   * The palette order is fixed so "next colour" is predictable, and the map is
   * written on every change so a reload restores the grouping.
   * @param {string} id - terminal identity.
   */
  const cycleTerminalColor = React.useCallback((id: string): void => {
    setColors((current) => {
      const index = current[id] === undefined ? -1 : TERMINAL_COLORS.indexOf(current[id]);
      const next = {
        ...current,
      };
      if (index === TERMINAL_COLORS.length - 1) delete next[id];
      else next[id] = TERMINAL_COLORS[index + 1];
      writeTerminalColors(next);
      return next;
    });
  }, []);

  /* Reopening a closed tab starts a fresh shell in the same directory. */
  const reopenClosed = React.useCallback(
    async (entry: TerminalRestoreEntry): Promise<void> => {
      const exists = await callTerminal({
        op: 'shells',
      })
        .then((value) => (value.shells ?? []).some((shell) => shell.path === entry.shell))
        .catch(() => false);
      await createTerminal(exists ? entry.shell : undefined, entry.cwd);
    },
    [createTerminal],
  );

  /**
   * Recreate the remembered shell tabs, one PTY per entry.
   *
   * A shell that has since been uninstalled must not abort the restore, so
   * each entry is attempted independently and failures fall back to the
   * default shell instead of leaving the dock empty.
   * @param {Array<{shell: string, cwd: string}>} profile - remembered tabs.
   */
  const restoreTerminals = React.useCallback(
    async (profile: TerminalRestoreEntry[]): Promise<void> => {
      const snapshots = readTerminalRestoreSnapshots();
      for (const [index, entry] of profile.slice(0, 4).entries()) {
        const exists = await callTerminal({
          op: 'shells',
        })
          .then((value) => (value.shells ?? []).some((shell) => shell.path === entry.shell))
          .catch(() => false);
        const created = await createTerminal(exists ? entry.shell : undefined, undefined, snapshots[index] ?? '');
        if (created === null) break;
      }
    },
    [createTerminal],
  );

  /* "Return to dock" is fired from the editor area, which is a sibling
     component; the event carries the id and this panel owns the state.
     Listened for on `window`: the editor area dispatches from its own node,
     and a host re-render can replace that node between dispatches. */
  React.useEffect(() => {
    const onReturn = (event: CustomEvent<{ id?: unknown }>): void => {
      const id = event.detail?.id;
      if (typeof id !== 'string' || id === '') return;
      returnTerminalToDock({ id });
    };
    window.addEventListener('dsh-editor-return-terminal', onReturn);
    return () => window.removeEventListener('dsh-editor-return-terminal', onReturn);
  }, [returnTerminalToDock]);

  /* The first terminal starts automatically, the way IDEA opens a shell tab. */
  React.useEffect(() => {
    if (!loaded || !available || busy || terminals.length > 0 || error !== null) return;
    if (openedRef.current) {
      /* Closing the last tab closes the tool window, exactly like IDEA. */
      onRequestClose?.();
      return;
    }
    openedRef.current = true;
    /* After a host restart the tab list is empty: rebuild what was open, with its shell. */
    const remembered = readTerminalProfile();
    if (remembered.length > 0) {
      void restoreTerminals(remembered);
      return;
    }
    void createTerminal();
    /* `createTerminal`/`restoreTerminals` are read through the closure on
       purpose: including them re-ran this on every parent render. `openedRef`
       makes the body idempotent, so no dependency on them is needed. */
  }, [available, busy, loaded, terminals.length, error, onRequestClose]);

  /**
   * `createTerminal` as it exists NOW, for the one-shot effects below.
   *
   * Its dependency list includes props the workspace passes inline, so its
   * identity changes on almost every render. An effect that depends on it
   * therefore re-fired on every render: pressing `+` started a new shell per
   * render, which is the "terminal freezes when you press +" report. The
   * ref keeps the latest callback without making the effect depend on it.
   */
  const createTerminalRef = React.useRef(createTerminal);
  createTerminalRef.current = createTerminal;

  /* A "new terminal" request from the dock header or the shortcut. */
  React.useEffect(() => {
    if (generation === 0) return;
    /* `createTerminal` only honours `startPath` when no shell is named, so a
       request carrying a directory ("Open in Terminal") must not pass one. */
    void createTerminalRef.current();
  }, [generation]);

  /* The arrow beside "+" lists installed shells without allocating a process. */
  const openShellMenu = React.useCallback(async () => {
    const rect = newButtonRef.current?.getBoundingClientRect();
    setBusy(true);
    try {
      const value = await callTerminal({
        op: 'shells',
      });
      const entries = value.shells ?? [];
      setShellMenu({
        x: rect?.left ?? 240,
        y: (rect?.bottom ?? 200) + 4,
        items:
          entries.length === 0
            ? [
                {
                  id: 'none',
                  label: t('editor.terminalNoShell'),
                  disabled: true,
                  run: () => {},
                },
              ]
            : entries.map((shell) => ({
                id: shell.path,
                label: shell.name,
                shortcut: '',
                run: (): void => void createTerminal(shell.path),
              })),
      });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  }, [createTerminal, t]);

  /* Double-click a tab title to rename it, the way IDE terminals do. */
  const commitRename = React.useCallback(async () => {
    if (renaming === null) return;
    const title = renaming.value.trim();
    if (title === '' || title === renaming.previous) {
      setRenaming(null);
      return;
    }
    try {
      renamedRef.current.add(renaming.id);
      const value = await callTerminal({
        op: 'rename',
        id: renaming.id,
        title,
      });
      setTerminals((current) => current.map((terminal) => (terminal.id === renaming.id ? value.terminal : terminal)));
      setRenaming(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  }, [renaming]);
  const closeTerminal = React.useCallback(
    async (id: string): Promise<void> => {
      if (closingTerminalIdsRef.current.has(id)) return;
      closingTerminalIdsRef.current.add(id);
      /* Record it first: after the host reaps it there is nothing left to describe. */
      const closing = terminalsRef.current.find((terminal) => terminal.id === id);
      const focusedId = focusedPaneRef.current === 'right' ? splitIdRef.current : activeRef.current;
      if (closing !== undefined) rememberClosed(closing);
      forgetTerminalLiveBuffer(id);
      setColors((current) => {
        if (current[id] === undefined) return current;
        const next = {
          ...current,
        };
        delete next[id];
        writeTerminalColors(next);
        return next;
      });
      const remaining = terminalsRef.current.filter((terminal) => terminal.id !== id);
      const nextActive = terminalActiveAfterClose(remaining, splitIdRef.current, editorIdsRef.current);
      if (remaining.length === 0) writeTerminalRestoreSnapshots([]);
      setTerminals(remaining);
      setActiveId((active) => (active === id ? nextActive : active));
      if (focusedId === id) {
        window.setTimeout(() => emulatorRef.current?.focus?.(), 0);
      }
      try {
        await callTerminal({
          op: 'close',
          id,
        });
      } catch {
        /* a terminal the host already reaped needs no further cleanup */
      } finally {
        closingTerminalIdsRef.current.delete(id);
      }
    },
    [rememberClosed],
  );

  /* Reorder the dock's tabs locally first, then persist the order on the host. */
  const moveTab = React.useCallback(async (sourceId: string, targetId: string): Promise<void> => {
    const requestId = ++terminalReorderRequestRef.current;
    const current = terminalsRef.current.map((terminal) => terminal.id);
    const from = current.indexOf(sourceId);
    const to = current.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...current];
    next.splice(from, 1);
    next.splice(to, 0, sourceId);
    setTerminals((list) => [...list].sort((left, right) => next.indexOf(left.id) - next.indexOf(right.id)));
    try {
      const value = await callTerminal({
        op: 'reorder',
        ids: next,
      });
      if (terminalReorderRequestRef.current !== requestId) return;
      if (Array.isArray(value?.terminals)) setTerminals(value.terminals);
    } catch {
      /* the local order still matches what the user just did */
    }
  }, []);

  /* IDEA's "Close Other Terminals": keep one tab, reap the rest. */
  const closeOtherTerminals = React.useCallback(
    async (keepId: string): Promise<void> => {
      const current = terminalsRef.current;
      if (!current.some((terminal) => terminal.id === keepId)) return;
      const doomed = current.filter((terminal) => terminal.id !== keepId);
      const remaining = current.filter((terminal) => terminal.id === keepId);
      for (const terminal of doomed) {
        closingTerminalIdsRef.current.add(terminal.id);
        rememberClosed(terminal);
        forgetTerminalLiveBuffer(terminal.id);
      }
      setColors((colors) => {
        const next = {
          ...colors,
        };
        for (const terminal of doomed) delete next[terminal.id];
        writeTerminalColors(next);
        return next;
      });
      setTerminals(remaining);
      setActiveId(keepId);
      setSplitId(null);
      setFocusedPane('left');
      window.setTimeout(() => emulatorRef.current?.focus?.(), 0);
      await Promise.all(
        doomed.map((terminal) =>
          callTerminal({
            op: 'close',
            id: terminal.id,
          })
            .catch(() => {})
            .finally(() => closingTerminalIdsRef.current.delete(terminal.id)),
        ),
      );
    },
    [rememberClosed],
  );

  /* A terminal moved into the editor must not keep a second xterm view alive
     in the dock; the PTY itself remains in the host and is rendered by the
     editor surface only. */
  const dockTerminals = terminals.filter((terminal) => !editorIds.includes(terminal.id));
  const active = dockTerminals.find((terminal) => terminal.id === activeId) ?? null;
  /* The right pane's terminal; cleared when that tab is closed. */
  const splitTerminal = splitId === null ? null : (dockTerminals.find((terminal) => terminal.id === splitId) ?? null);
  React.useEffect(() => {
    cwdRef.current = active?.cwd ?? '';
  }, [active?.cwd]);
  React.useEffect(() => {
    /* A split always shows a DIFFERENT terminal: the same id would double the stream. */
    if (splitId !== null && (splitTerminal === null || splitId === activeId)) setSplitId(null);
    /* IDEA keeps the keyboard in the terminal: when the right pane closes, the
       focus goes back to the surviving one instead of being dropped. */
    if (splitId === null && focusedPane === 'right') setFocusedPane('left');
  }, [splitId, splitTerminal, activeId, focusedPane]);

  /** Open the screen context menu for one pane. */
  const openScreenMenu = (
    event: React.MouseEvent<HTMLElement>,
    emulator: TerminalEmulator | null | undefined,
    terminal: TerminalDescription,
    pane: 'left' | 'right' = 'left',
  ): void => {
    if (emulator === null || emulator === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    const selectionPosition = screenSelectionPositionRef.current[pane] ?? null;
    screenSelectionPositionRef.current[pane] = null;
    const model = terminalMenuModel({
      t,
      emulator,
      active: terminal,
      selectionPosition,
      onSelectAll: () => emulator.selectAll(),
      onFind: () => openTerminalFind(emulator),
      onClose: () => void closeTerminal(terminal.id),
      onClear: () => emulator.clear(),
      onClipboardError: (message) => setClipboardNotice(message),
      onPastedText: (text) => setPasteHistory((current) => pushPasteHistory(current, text)),
      pasteHistory,
      onPasteHistory: (text) => {
        void writeTerminalText(emulator, terminal, text, t).then((written) => {
          if (written) setPasteHistory((current) => pushPasteHistory(current, text));
        });
      },
      onClearBuffer: () => {
        /* Dispose the buffer by resetting, then drop any retained host output. */
        clearTerminalLiveBuffer(terminal.id);
        emulator.reset();
        emulator.clear();
        persistTerminalRestoreSnapshots(terminalsRef.current);
      },
      /* Screen context is about the CURRENT pane. Use IDEA's split
         operation (reuse another tab or create a fresh shell); setting the
         current terminal as splitId would be a no-op or duplicate its PTY. */
      onSplitRight: splitId === null ? () => void toggleSplit() : null,
      onMoveToEditor: () => moveTerminalToEditor(terminal),
      onSwitchFocusToEditor,
      onCreate: () => (onRequestNew === undefined ? void createTerminal() : onRequestNew()),
    });
    if (model !== null)
      setMenu({
        ...model,
        x: event.clientX,
        y: event.clientY,
      });
  };

  /* Recompute the match count whenever the query changes. */
  React.useEffect(() => {
    if (find === null) return;
    /* Remember the query so reopening the bar continues where the user left off. */
    lastTerminalQuery.current = find.query;
    if (emulatorRef.current === null) return;
    const total = countTerminalMatches(emulatorRef.current, find.query);
    setFind((current) =>
      current === null || current.total === total
        ? current
        : {
            ...current,
            total,
            index: Math.min(current.index, Math.max(0, total - 1)),
          },
    );
  }, [find?.query]);

  /* ⌘/Ctrl+F inside either terminal pane opens the dock's own find bar. */
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== 'f') return;
      if (document.activeElement?.closest('[data-dsh-terminal-pane]') == null) return;
      event.preventDefault();
      event.stopPropagation();
      if (findRef.current === null)
        openTerminalFind(focusedPaneRef.current === 'right' ? splitEmulatorRef.current : emulatorRef.current);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  /* IDEA switches terminal tabs with ⌘1–⌘9 and walks them with ⌥←/→. */
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (document.activeElement?.closest('[data-dsh-editor-terminal]') == null) return;
      const meta = event.metaKey || event.ctrlKey;
      const focusedEmulator = focusedPaneRef.current === 'right' ? splitEmulatorRef.current : emulatorRef.current;
      const selection =
        focusedEmulator !== null && typeof focusedEmulator.getSelection === 'function'
          ? focusedEmulator.getSelection()
          : '';
      const blockAction = terminalBlockKeyboardAction(event, selection !== '', findRef.current !== null);
      if (
        blockAction !== null &&
        focusedEmulator !== null &&
        focusedEmulator !== undefined &&
        document.activeElement?.closest('[data-dsh-terminal-pane]') !== null
      ) {
        event.preventDefault();
        event.stopPropagation();
        const buffer = focusedEmulator.buffer?.active;
        const blockRange = terminalSelectionBlockRange(buffer, focusedEmulator.getSelectionPosition?.());
        if (blockRange === null) return;
        const promptRow = terminalPromptStartRow(buffer);
        const maxBlockRow =
          promptRow === null ? (Number.isInteger(buffer?.length) ? buffer.length - 1 : blockRange.end) : promptRow - 1;
        const range = blockAction.startsWith('expand')
          ? terminalExpandBlockRange(buffer, blockRange, blockAction.endsWith('Above') ? -1 : 1, maxBlockRow)
          : terminalAdjacentBlockRange(buffer, blockRange, blockAction.endsWith('Above') ? -1 : 1, maxBlockRow);
        if (range !== null) focusedEmulator.selectLines?.(range.start, range.end);
        focusedEmulator.focus?.();
        return;
      }
      if (
        meta &&
        !event.altKey &&
        !event.shiftKey &&
        (event.key === 'ArrowUp' || event.key === 'ArrowDown') &&
        focusedEmulator !== null &&
        focusedEmulator !== undefined &&
        document.activeElement?.closest('[data-dsh-terminal-pane]') !== null
      ) {
        event.preventDefault();
        event.stopPropagation();
        if (event.key === 'ArrowUp') {
          const range = terminalLastBlockSelection(focusedEmulator.buffer?.active);
          if (range !== null) focusedEmulator.selectLines?.(range.start, range.end);
        } else {
          const range = terminalPromptSelection(focusedEmulator.buffer?.active);
          if (range !== null) {
            const startRow = terminalPromptStartRow(focusedEmulator.buffer?.active, range.row);
            if (startRow !== null && startRow < range.row) {
              focusedEmulator.selectLines?.(startRow, range.row);
            } else {
              focusedEmulator.select?.(range.column, range.row, range.length);
            }
          }
        }
        focusedEmulator.focus?.();
        return;
      }
      if (
        event.shiftKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.ctrlKey &&
        (event.key === 'PageUp' || event.key === 'PageDown') &&
        focusedEmulator !== null &&
        focusedEmulator !== undefined
      ) {
        event.preventDefault();
        event.stopPropagation();
        focusedEmulator.scrollPages(event.key === 'PageUp' ? -1 : 1);
        focusedEmulator.focus?.();
        return;
      }
      const directShortcut = directTerminalShortcut(event, selection !== '');
      /* IDEA's macOS terminal owns ⌘T, ⌘C over a selection, and ⌘V. Keep
         these away from the hidden xterm textarea so they do not become
         shell control characters. Inputs elsewhere in the dock retain
         their native clipboard behavior. */
      if (directShortcut !== null && document.activeElement?.closest('[data-dsh-terminal-pane]') !== null) {
        if (directShortcut === 'newTab') {
          event.preventDefault();
          event.stopPropagation();
          if (onRequestNew === undefined) void createTerminal();
          else onRequestNew();
          return;
        }
        if (focusedEmulator !== null && focusedEmulator !== undefined) {
          event.preventDefault();
          event.stopPropagation();
          if (directShortcut === 'copy') {
            void Promise.resolve(navigator.clipboard?.writeText(selection))
              .then(() => setClipboardNotice(tRef.current('editor.copiedToClipboard')))
              .catch(() => setClipboardNotice(tRef.current('editor.clipboardWriteFailed')));
            return;
          }
          if (directShortcut === 'copyBlock') {
            const range = terminalLastBlockSelection(focusedEmulator.buffer?.active);
            if (range === null) return;
            focusedEmulator.selectLines?.(range.start, range.end);
            focusedEmulator.focus?.();
            const blockText = typeof focusedEmulator.getSelection === 'function' ? focusedEmulator.getSelection() : '';
            if (blockText !== '') {
              void Promise.resolve(navigator.clipboard?.writeText(blockText))
                .then(() => setClipboardNotice(tRef.current('editor.copiedToClipboard')))
                .catch(() => setClipboardNotice(tRef.current('editor.clipboardWriteFailed')));
            }
            return;
          }
          if (directShortcut === 'paste') {
            const pane =
              focusedPaneRef.current === 'right'
                ? terminalsRef.current.find((terminal) => terminal.id === splitIdRef.current)
                : terminalsRef.current.find((terminal) => terminal.id === activeRef.current);
            if (pane !== undefined) {
              void pasteIntoTerminal(focusedEmulator, pane, tRef.current, setClipboardNotice, (text) => {
                setPasteHistory((current) => pushPasteHistory(current, text));
              });
            }
          }
          return;
        }
      }
      /* IDEA's Close Tab shortcut acts on the focused split pane; closing
         the last shell then closes the tool window through the normal path. */
      if (meta && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'w') {
        const id =
          focusedPaneRef.current === 'right' && splitIdRef.current !== null ? splitIdRef.current : activeRef.current;
        if (id === null) return;
        event.preventDefault();
        event.stopPropagation();
        void closeTerminal(id);
        return;
      }
      if (meta && !event.altKey && !event.shiftKey && /^[1-9]$/u.test(event.key)) {
        const index = Number(event.key) - 1;
        const target = terminalsRef.current[index];
        if (target === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        /* With a split open the shortcut acts on the pane the caret is in;
           switching the other pane's tab looks like the key did nothing. */
        if (focusedPaneRef.current === 'right' && splitIdRef.current !== null) {
          if (target.id === splitIdRef.current) return;
          /* Picking the terminal the LEFT pane is showing swaps the panes:
             binding both to one id makes the split guard collapse the dock. */
          if (target.id === activeRef.current) {
            setActiveId(splitIdRef.current);
            setSplitId(target.id);
            return;
          }
          setSplitId(target.id);
          return;
        }
        setActiveId(target.id);
        return;
      }
      /* ⌘⇧T reopens the most recently closed terminal, like IDEA's tab menu action. */
      if (meta && event.shiftKey && !event.altKey && event.key.toLowerCase() === 't') {
        const recent = closedHistoryRef.current[0];
        if (recent === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        void reopenClosed(recent);
        return;
      }
      /* IDEA's ⌘K clears the focused terminal without killing the shell. */
      if (meta && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        event.stopPropagation();
        const emulator = focusedPaneRef.current === 'right' ? splitEmulatorRef.current : emulatorRef.current;
        emulator?.clear();
        return;
      }
      /* ⌘G / ⇧⌘G walk the find bar's matches, IDEA's key for "next match".
         The bar had buttons only, so the keyboard path stopped at the count. */
      if (meta && !event.altKey && event.key.toLowerCase() === 'g') {
        const current = findRef.current;
        const emulator = focusedPaneRef.current === 'right' ? splitEmulatorRef.current : emulatorRef.current;
        if (current === null || emulator === null || emulator === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        moveTerminalSelection(emulator, current, setFind, event.shiftKey ? -1 : 1);
        return;
      }
      /* ⌘A selects the whole buffer, matching the screen menu's advertised key.
         xterm keeps the native textarea selection, so the DOM selection is not
         the buffer; without this the menu item was the only way to select all. */
      if (meta && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'a') {
        const emulator = focusedPaneRef.current === 'right' ? splitEmulatorRef.current : emulatorRef.current;
        if (emulator === null || emulator === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        emulator.selectAll();
        return;
      }
      /* ⇧F6 renames the focused tab, the key its own context menu prints. */
      if (!meta && !event.altKey && event.shiftKey && event.key === 'F6') {
        const id =
          focusedPaneRef.current === 'right' && splitIdRef.current !== null ? splitIdRef.current : activeRef.current;
        const terminal = terminalsRef.current.find((entry) => entry.id === id);
        if (terminal === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        setRenaming({
          id: terminal.id,
          value: terminal.title,
          previous: terminal.title,
        });
        return;
      }
      /* ⌘⇧C copies the selection, ⌘⇧V pastes into the focused pane. */
      if (
        meta &&
        event.shiftKey &&
        !event.altKey &&
        (event.key.toLowerCase() === 'c' || event.key.toLowerCase() === 'v')
      ) {
        const emulator = focusedPaneRef.current === 'right' ? splitEmulatorRef.current : emulatorRef.current;
        if (emulator === null || emulator === undefined) return;
        if (event.key.toLowerCase() === 'c') {
          const selection = typeof emulator.getSelection === 'function' ? emulator.getSelection() : '';
          if (selection === '') return;
          event.preventDefault();
          event.stopPropagation();
          /* A refused clipboard write must say so; silence looks like "copied". */
          void Promise.resolve(navigator.clipboard?.writeText(selection))
            .then(() => setClipboardNotice(tRef.current('editor.copiedToClipboard')))
            .catch(() => setClipboardNotice(tRef.current('editor.clipboardWriteFailed')));
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const pane =
          focusedPaneRef.current === 'right'
            ? terminalsRef.current.find((terminal) => terminal.id === splitIdRef.current)
            : terminalsRef.current.find((terminal) => terminal.id === activeRef.current);
        if (pane !== undefined) {
          void pasteIntoTerminal(emulator, pane, tRef.current, setClipboardNotice, (text) => {
            setPasteHistory((current) => pushPasteHistory(current, text));
          });
        }
        return;
      }
      if (event.altKey && !meta && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        const list = terminalsRef.current;
        if (list.length < 2) return;
        /* With a split open the walk belongs to the focused pane: cycling the
           left pane's tabs while the caret sits on the right looks inert. */
        const onRight = focusedPaneRef.current === 'right' && splitIdRef.current !== null;
        const current = list.findIndex(
          (terminal) => terminal.id === (onRight ? splitIdRef.current : activeRef.current),
        );
        const step = event.key === 'ArrowRight' ? 1 : -1;
        const next = list[(current + step + list.length) % list.length];
        event.preventDefault();
        event.stopPropagation();
        if (onRight) {
          /* Landing on the left pane's terminal would bind both panes to one
             PTY (the split guard then collapses the dock), so swap instead. */
          if (next.id === activeRef.current) {
            setActiveId(splitIdRef.current);
            setSplitId(next.id);
            return;
          }
          setSplitId(next.id);
          return;
        }
        setActiveId(next.id);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  /**
   * Split the dock with a second tab, or close the existing split.
   *
   * IDEA splits with the next tab; a session holding a single shell gets a
   * fresh one in the right pane instead of a dead button. Unsplit keeps the
   * pane the user was typing in and drops the other one.
   */
  const toggleSplit = async () => {
    if (splitId !== null) {
      const keep = focusedPane === 'right' ? splitId : activeId;
      setSplitId(null);
      setFocusedPane('left');
      if (keep !== null) setActiveId(keep);
      window.setTimeout(() => emulatorRef.current?.focus?.(), 0);
      return;
    }
    const candidate = terminals.find((terminal) => terminal.id !== activeId);
    if (candidate !== undefined) {
      setSplitId(candidate.id);
      setFocusedPane('left');
      return;
    }
    /* Keep the existing shell on the left: createTerminal() focuses the new one,
       and binding the SAME id to both panes would open two streams on one PTY. */
    const previous = activeId;
    if (previous === null) return;
    const created = await createTerminal();
    if (created === null || created.id === previous) return;
    setActiveId(previous);
    setSplitId(created.id);
    setFocusedPane('right');
  };

  /** Persist the split ratio once the drag settles. */
  const commitSplitPercent = (value: number): void => {
    try {
      window.localStorage.setItem('dsh-editor.terminal.splitPercent', String(Math.round(value)));
    } catch {
      /* a storage-less browser keeps the in-memory ratio */
    }
  };

  /**
   * Send one terminal to the other split pane, or bring it into the split.
   *
   * IDEA lets you drag a tab across the divider: the tab becomes that pane's
   * terminal, and dragging the pane's own tab back reunites the dock.
   * @param {string} terminalId - tab being dragged.
   * @param {'left'|'right'} pane - pane that received the drop.
   */
  const moveToPane = React.useCallback(
    (terminalId: string, pane: 'left' | 'right'): void => {
      if (pane === 'right') {
        if (terminalId === activeId) return;
        setSplitId(terminalId);
        setFocusedPane('right');
        return;
      }
      /* Dropping onto the left pane while it is the split's own tab means "unsplit". */
      if (terminalId === splitId) {
        setSplitId(null);
        setFocusedPane('left');
        return;
      }
      setActiveId(terminalId);
      setFocusedPane('left');
    },
    [activeId, splitId],
  );

  /**
   * Move keyboard focus between the two panes.
   *
   * The pane's own emulator handles the typing, so the state only drives the
   * tab highlighting and which terminal unsplit keeps.
   * @param {'left'|'right'} pane - pane that should own the caret.
   */
  const focusPane = (pane: 'left' | 'right'): void => {
    if (splitId === null) {
      setFocusedPane('left');
      return;
    }
    setFocusedPane(pane);
    const emulator = pane === 'right' ? splitEmulatorRef.current : emulatorRef.current;
    emulator?.focus();
  };

  /* One split for the render: which tabs stay in the strip and which go to `»`. */
  const tabLayout = overflowTabs(dockTerminals, visibleTabCount(tabStripWidth, dockTerminals.length), activeId);

  /**
   * Activate one terminal tab without changing its overflow visibility.
   *
   * A split pane owns its own tab; re-activating that id in the left pane
   * would make both panes trace the same PTY.
   * @param {object} terminal - terminal descriptor.
   * @returns {void}
   */
  const activateTerminalTab = (terminal: TerminalDescription): void => {
    if (splitId !== null && terminal.id === splitId) {
      focusPane('right');
      return;
    }
    setActiveId(terminal.id);
    setFocusedPane('left');
  };

  /**
   * Focus one visible terminal tab by identity.
   *
   * IDs are rendered as data attributes so focus never depends on a title
   * that the user can rename.
   * @param {string} terminalId - terminal id to focus.
   * @returns {void}
   */
  const focusTerminalTab = (terminalId: string): void => {
    const node = [...(tabStripRef.current?.querySelectorAll('[data-dsh-terminal-tab-id]') ?? [])].find(
      (candidate) => candidate.getAttribute('data-dsh-terminal-tab-id') === terminalId,
    );
    node?.focus();
  };

  /**
   * Move roving focus through the visible terminal tabs.
   *
   * Arrow navigation stops at the strip boundaries. The right edge hands
   * focus to IDEA's `»` control so hidden tabs remain reachable from the
   * keyboard instead of becoming mouse-only overflow.
   * @param {object} terminal - currently focused tab.
   * @param {-1|1} delta - movement direction.
   * @returns {void}
   */
  const moveTerminalTabFocus = (terminal: TerminalDescription, delta: number): void => {
    const index = tabLayout.visible.findIndex((entry) => entry.id === terminal.id);
    if (index < 0) return;
    const nextIndex = Math.max(0, Math.min(tabLayout.visible.length - 1, index + delta));
    if (nextIndex === index) {
      if (delta > 0 && tabLayout.hidden.length > 0) {
        tabStripRef.current?.parentElement?.querySelector('.dsh-editor-terminal-overflow')?.focus();
      }
      return;
    }
    const next = tabLayout.visible[nextIndex];
    activateTerminalTab(next);
    focusTerminalTab(next.id);
  };

  /** Focus the first or last visible terminal tab. */
  const focusBoundaryTerminalTab = (edge: 'first' | 'last'): void => {
    const target = edge === 'first' ? tabLayout.visible[0] : tabLayout.visible[tabLayout.visible.length - 1];
    if (target === undefined) return;
    activateTerminalTab(target);
    focusTerminalTab(target.id);
  };

  /** Return from the overflow control to the last visible tab. */
  const focusLastVisibleTerminalTab = () => {
    focusBoundaryTerminalTab('last');
  };

  /**
   * Open one terminal tab's IDEA context menu.
   *
   * Mouse right-click and Shift+F10 share this builder so a keyboard user
   * gets the same actions, disabled states and anchors as the pointer.
   * @param {object} terminal - tab under the gesture.
   * @param {number} x - menu anchor x.
   * @param {number} y - menu anchor y.
   * @returns {void}
   */
  const openTerminalTabMenu = (terminal: TerminalDescription, x: number, y: number): void => {
    const focus = terminalTabContextFocus(terminal.id, activeId, splitId);
    if (focus.activate) setActiveId(terminal.id);
    setFocusedPane(focus.pane);
    const leftTarget = terminalMoveTarget(terminals, terminal.id, 'left');
    const rightTarget = terminalMoveTarget(terminals, terminal.id, 'right');
    setMenu({
      x,
      y,
      items: terminalTabMenu(t, terminal, {
        rename: () =>
          setRenaming({
            id: terminal.id,
            value: terminal.title,
            previous: terminal.title,
          }),
        close: () => void closeTerminal(terminal.id),
        closeOthers: () => void closeOtherTerminals(terminal.id),
        canCloseOthers: terminals.length > 1,
        canMoveLeft: leftTarget !== null,
        moveLeft: leftTarget === null ? null : () => void moveTab(terminal.id, leftTarget),
        canMoveRight: rightTarget !== null,
        moveRight: rightTarget === null ? null : () => void moveTab(terminal.id, rightTarget),
        canDuplicate: terminals.length < 6,
        duplicate: () => void createTerminal(terminal.shell, terminalCwdRef.current.get(terminal.id) ?? terminal.cwd),
        splitRight:
          terminal.id === activeId || terminal.id === splitId
            ? null
            : () => {
                setSplitId(terminal.id);
                setFocusedPane('right');
              },
        reopen: closedHistory.length === 0 ? null : () => void reopenClosed(closedHistory[0]),
        moveToEditor: () => moveTerminalToEditor(terminal),
        switchFocusToEditor: onSwitchFocusToEditor,
        cycleColor: () => cycleTerminalColor(terminal.id),
        revealCwd: () => void revealTerminalDirectory(terminalCwdRef.current.get(terminal.id) ?? terminal.cwd),
        readmePath: readmePaths[terminalCwdRef.current.get(terminal.id) ?? terminal.cwd],
        cwd: terminalCwdRef.current.get(terminal.id) ?? terminal.cwd,
        openReadme: () => void openTerminalReadme(terminalCwdRef.current.get(terminal.id) ?? terminal.cwd),
      }),
    });
  };

  /**
   * Open the hidden-terminal list from IDEA's `»` overflow control.
   *
   * Click, Shift+F10 and the ContextMenu key share one builder so keyboard
   * users get the same tabs, colour swatches, disabled states and focus
   * hand-off as pointer users.
   * @param {{left: number, right: number, bottom: number}} anchor - opener rect.
   * @returns {void}
   */
  const openTerminalOverflowMenu = (anchor: { left: number; right: number; bottom: number }): void => {
    setMenu({
      x: Math.max(4, anchor.right - 188),
      y: anchor.bottom + 4,
      title: t('editor.terminalOverflowTitle'),
      items: tabLayout.hidden.map((terminal) => ({
        id: `tab:${terminal.id}`,
        label: terminal.title,
        ...(colors[terminal.id] === undefined
          ? {}
          : {
              swatch: colors[terminal.id],
            }),
        shortcut: terminal.state === 'exited' ? '×' : '',
        run: () => {
          if (splitId !== null && terminal.id === splitId) focusPane('right');
          else {
            setActiveId(terminal.id);
            setFocusedPane('left');
            window.setTimeout(() => focusTerminalTab(terminal.id), 0);
          }
        },
      })),
    });
  };
  return (
    <div
      style={styles.terminalPanel}
      data-dsh-editor-terminal=''>
      <div style={styles.terminalTabStrip}>
        <span
          className='dsh-editor-terminal-title'
          style={styles.terminalTitleLabel}
          title={t('editor.terminalTitleLocal')}>
          {t('editor.terminalTitleLocal')}
        </span>
        <div
          ref={tabStripRef}
          style={styles.terminalTabs}
          role='tablist'
          aria-label={t('editor.terminalTabs')}>
          {
            /* IDEA keeps every tab legible and moves the rest into a `»` list. */
            tabLayout.visible.map((terminal) => (
              <div
                key={terminal.id}
                className={
                  terminal.id === activeId
                    ? 'dsh-editor-terminal-tab dsh-editor-terminal-tab-active'
                    : 'dsh-editor-terminal-tab'
                }
                style={{
                  ...styles.terminalTab,
                  ...(terminal.id === activeId ? styles.terminalTabActive : null),
                  ...(dragOverId === terminal.id ? styles.terminalTabDrop : null),
                  ...(dragId === terminal.id ? styles.terminalTabDragging : null),
                }}
                title={`${terminal.title} — ${terminal.cwd}`}
                role='tab'
                aria-label={terminal.title}
                aria-selected={terminal.id === activeId}
                tabIndex={terminal.id === activeId ? 0 : -1}
                data-dsh-terminal-tab-id={terminal.id}
                onClick={(event) => {
                  event.currentTarget.focus?.();
                  activateTerminalTab(terminal);
                }}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                    event.preventDefault();
                    event.stopPropagation();
                    moveTerminalTabFocus(terminal, event.key === 'ArrowLeft' ? -1 : 1);
                  } else if (event.key === 'Home' || event.key === 'End') {
                    event.preventDefault();
                    event.stopPropagation();
                    focusBoundaryTerminalTab(event.key === 'Home' ? 'first' : 'last');
                  } else if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    activateTerminalTab(terminal);
                  } else if (event.key === 'ContextMenu' || (event.shiftKey === true && event.key === 'F10')) {
                    event.preventDefault();
                    event.stopPropagation();
                    const rect = event.currentTarget.getBoundingClientRect();
                    openTerminalTabMenu(terminal, rect.left + 12, rect.bottom);
                  }
                }}
                draggable={true}
                onDragStart={(event) => {
                  event.currentTarget.focus?.();
                  setDragId(terminal.id);
                  event.dataTransfer?.setData('text/plain', terminal.id);
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(event) => {
                  if (dragId === null || dragId === terminal.id) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  setDragOverId(terminal.id);
                }}
                onDragLeave={() => setDragOverId((current) => (current === terminal.id ? null : current))}
                onDrop={(event) => {
                  event.preventDefault();
                  const source = dragId ?? event.dataTransfer?.getData('text/plain') ?? '';
                  setDragId(null);
                  setDragOverId(null);
                  if (source !== '' && source !== terminal.id) void moveTab(source, terminal.id);
                }}
                onDragEnd={(event) => {
                  event.currentTarget.focus?.();
                  setDragId(null);
                  setDragOverId(null);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  event.currentTarget.focus?.();
                  openTerminalTabMenu(terminal, event.clientX, event.clientY);
                }}>
                {colors[terminal.id] === undefined ? null : (
                  <span
                    style={{
                      ...styles.terminalTabStripe,
                      background: colors[terminal.id],
                    }}
                  />
                )}
                <Icon
                  name='terminal'
                  size={12}
                />
                {renaming !== null && renaming.id === terminal.id ? (
                  <input
                    style={styles.terminalRenameInput}
                    value={renaming.value}
                    autoFocus={true}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) =>
                      setRenaming((current) =>
                        current === null
                          ? current
                          : {
                              ...current,
                              value: event.target.value,
                            },
                      )
                    }
                    onBlur={() => void commitRename()}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void commitRename();
                      } else if (event.key === 'Escape') {
                        event.preventDefault();
                        setRenaming(null);
                      }
                    }}
                  />
                ) : (
                  <span
                    style={{
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      setRenaming({
                        id: terminal.id,
                        value: terminal.title,
                        previous: terminal.title,
                      });
                    }}>
                    {terminal.title}
                  </span>
                )}
                {terminal.state === 'exited' ? (
                  <span style={styles.terminalExited}>{`[${terminal.exitCode ?? '×'}]`}</span>
                ) : null}
                <button
                  type='button'
                  style={styles.terminalTabClose}
                  aria-label={t('editor.terminalClose')}
                  onClick={(event) => {
                    event.stopPropagation();
                    void closeTerminal(terminal.id);
                  }}>
                  ×
                </button>
              </div>
            ))
          }
          {tabLayout.hidden.length === 0 ? null : (
            <button
              type='button'
              className='dsh-editor-terminal-overflow'
              style={styles.terminalOverflow}
              title={t('editor.terminalOverflow', {
                count: tabLayout.hidden.length,
              })}
              aria-label={t('editor.terminalOverflow', {
                count: tabLayout.hidden.length,
              })}
              onKeyDown={(event) => {
                if (event.key === 'ContextMenu' || (event.shiftKey === true && event.key === 'F10')) {
                  event.preventDefault();
                  event.stopPropagation();
                  openTerminalOverflowMenu(event.currentTarget.getBoundingClientRect());
                } else if (event.key === 'ArrowLeft') {
                  event.preventDefault();
                  event.stopPropagation();
                  focusLastVisibleTerminalTab();
                }
              }}
              onClick={(event) => {
                openTerminalOverflowMenu(event.currentTarget.getBoundingClientRect());
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                event.currentTarget.focus?.();
                openTerminalOverflowMenu(event.currentTarget.getBoundingClientRect());
              }}>
              »
            </button>
          )}
        </div>
        <span style={styles.toolbarSpacer} />
        <span
          ref={newButtonRef}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}>
          {clipboardNotice === null ? null : (
            <span
              style={styles.terminalClipboardNotice}
              role='status'>
              {clipboardNotice}
            </span>
          )}
          <ToolbarButton
            icon='newFile'
            label={t('editor.terminalNew')}
            onClick={() => (onRequestNew === undefined ? void createTerminal() : onRequestNew())}
            disabled={busy}
          />
        </span>
        <ToolbarButton
          icon='chevronDown'
          label={t('editor.terminalNewPredefinedSession')}
          onClick={() => void openShellMenu()}
          disabled={busy}
        />
        <ToolbarButton
          icon='split'
          label={splitId === null ? t('editor.terminalSplit') : t('editor.terminalUnsplit')}
          onClick={() => void toggleSplit()}
          disabled={available === false || activeId === null}
        />
        <ToolbarButton
          icon='search'
          label={t('editor.find')}
          onClick={() => openTerminalFind(emulatorRef.current)}
          disabled={available === false}
        />
        <ToolbarButton
          icon='settings'
          label={t('editor.terminalOptions')}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setMenu({
              x: Math.max(4, rect.right - 190),
              y: rect.bottom + 4,
              title: t('editor.terminalOptions'),
              items: [
                {
                  id: 'clear',
                  label: t('editor.terminalClear'),
                  shortcut: '⌘K',
                  disabled: activeId === null,
                  run: () => emulatorRef.current?.clear(),
                },
                {
                  id: 'increaseFont',
                  label: t('editor.terminalIncreaseFontSize'),
                  run: () => setFontSize((size) => storeFontSize(terminalFontSize(size, 'increase'))),
                },
                {
                  id: 'decreaseFont',
                  label: t('editor.terminalDecreaseFontSize'),
                  run: () => setFontSize((size) => storeFontSize(terminalFontSize(size, 'decrease'))),
                },
                {
                  id: 'resetFont',
                  label: t('editor.terminalResetFontSize'),
                  run: () => setFontSize((size) => storeFontSize(terminalFontSize(size, 'reset'))),
                },
                {
                  id: 'refresh',
                  label: t('editor.refresh'),
                  run: (): void => {
                    void refresh();
                  },
                },
              ],
            });
          }}
        />
        {
          /* IDEA puts the tool window's hide control at the end of the strip that
         already carries its actions, so the dock needs no second title row. */
          onRequestClose === undefined ? null : (
            <ToolbarButton
              icon='hide'
              label={t('editor.hideTerminal')}
              onClick={() => onRequestClose()}
            />
          )
        }
      </div>
      {find === null ? null : (
        <div style={styles.findBar}>
          <input
            ref={findInputRef}
            style={styles.findInput}
            autoFocus={true}
            placeholder={t('editor.find')}
            value={find.query}
            onChange={(event) =>
              setFind((current) =>
                current === null
                  ? current
                  : {
                      ...current,
                      query: event.target.value,
                      index: 0,
                    },
              )
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                moveTerminalSelection(emulatorRef.current, find, setFind, event.shiftKey ? -1 : 1);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                setFind(null);
                emulatorRef.current?.focus();
              }
            }}
          />
          <span style={styles.findCount}>
            {find.total === 0 ? t('editor.noMatches') : `${find.index + 1}/${find.total}`}
          </span>
          <ToolbarButton
            icon='chevronDown'
            label={t('editor.findNext')}
            onClick={() => moveTerminalSelection(emulatorRef.current, find, setFind, 1)}
          />
          <ToolbarButton
            icon='chevronRight'
            label={t('editor.findPrevious')}
            onClick={() => moveTerminalSelection(emulatorRef.current, find, setFind, -1)}
          />
          <button
            type='button'
            style={styles.conflictAction}
            onClick={() => {
              setFind(null);
              emulatorRef.current?.focus();
            }}>
            ×
          </button>
        </div>
      )}
      {available ? (
        <div
          style={{
            ...styles.terminalScreenArea,
            ...(splitId === null ? null : styles.terminalScreenSplit),
          }}>
          <div
            style={{
              ...styles.terminalPane,
              flex: splitId === null ? '1 1 0' : `0 0 ${splitPercent}%`,
              /* IDEA outlines the pane that owns the caret. */
              ...(splitId !== null && focusedPane === 'left' ? styles.terminalPaneFocused : null),
            }}
            data-dsh-terminal-pane-role='left'
            onMouseDownCapture={(event) => {
              focusPane('left');
              if (event.button === 2 && emulatorRef.current !== null) {
                screenSelectionPositionRef.current.left = emulatorRef.current.getSelectionPosition?.() ?? null;
              }
            }}
            onDragOver={(event) => {
              if (splitId === null) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(event) => {
              event.preventDefault();
              const source = event.dataTransfer?.getData('text/plain') ?? '';
              if (source !== '') moveToPane(source, 'left');
            }}
            onContextMenu={(event) => openScreenMenu(event, emulatorRef.current, active, 'left')}>
            {active === null ? (
              <React.Fragment>
                <div style={styles.terminalNotice}>
                  <span>{busy ? t('editor.terminalStarting') : t('editor.terminalEmpty')}</span>
                  <button
                    type='button'
                    style={styles.terminalAction}
                    onClick={() => void createTerminal()}
                    disabled={busy}>
                    {t('editor.terminalNew')}
                  </button>
                </div>
                <MeasuringScreen
                  fontSize={fontSize}
                  onGrid={reportGrid}
                />
              </React.Fragment>
            ) : (
              <TerminalScreen
                terminalId={activeId}
                focusGeneration={focusGeneration}
                fontSize={fontSize}
                find={find}
                getCwd={() => cwdRef.current}
                onGrid={reportGrid}
                onError={(message) => setError(message)}
                onExit={(code) =>
                  setTerminals((current) =>
                    current.map((terminal) =>
                      terminal.id === activeId
                        ? {
                            ...terminal,
                            state: 'exited',
                            exitCode: code,
                          }
                        : terminal,
                    ),
                  )
                }
                onEmulator={(emulator) => {
                  emulatorRef.current = emulator;
                }}
                onInput={(data) => {
                  if (activeId !== null) void sendInput(activeId, data);
                }}
                onTitle={(title) => {
                  const cleaned = title.trim();
                  if (activeId === null || cleaned === '') return;
                  void syncTerminalTitle(activeId, cleaned);
                }}
                onCwd={(cwd) => {
                  if (activeId === null) return;
                  syncTerminalCwd(activeId, cwd);
                }}
              />
            )}
          </div>
          {splitId === null ? null : (
            <div
              style={{
                ...styles.terminalSplitHandle,
                cursor: splitDragging ? 'col-resize' : 'col-resize',
              }}
              title={t('editor.terminalSplitReset')}
              onDoubleClick={() => {
                setSplitPercent(50);
                commitSplitPercent(50);
              }}
              onMouseDown={(event) => {
                event.preventDefault();
                const area = event.currentTarget.parentElement;
                if (area === null) return;
                const total = area.getBoundingClientRect().width;
                const startX = event.clientX;
                const startPercent = splitPercent;
                setSplitDragging(true);
                const onMove = (moveEvent: MouseEvent): void => {
                  const delta = ((moveEvent.clientX - startX) / Math.max(1, total)) * 100;
                  /* Snap to the middle like IDEA's splitter, and clamp in one place. */
                  setSplitPercent(snapSplitPercent(startPercent + delta));
                };
                const onUp = () => {
                  setSplitDragging(false);
                  setSplitPercent((value) => {
                    commitSplitPercent(value);
                    return value;
                  });
                  window.removeEventListener('mousemove', onMove);
                  window.removeEventListener('mouseup', onUp);
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }}
            />
          )}
          {splitTerminal === null ? null : (
            <div
              style={{
                ...styles.terminalPane,
                flex: '1 1 0',
                ...(focusedPane === 'right' ? styles.terminalPaneFocused : null),
              }}
              data-dsh-terminal-pane-role='right'
              onMouseDownCapture={(event) => {
                focusPane('right');
                if (event.button === 2 && splitEmulatorRef.current !== null) {
                  screenSelectionPositionRef.current.right = splitEmulatorRef.current.getSelectionPosition?.() ?? null;
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(event) => {
                event.preventDefault();
                const source = event.dataTransfer?.getData('text/plain') ?? '';
                if (source !== '') moveToPane(source, 'right');
              }}
              onContextMenu={(event) => openScreenMenu(event, splitEmulatorRef.current, splitTerminal, 'right')}>
              <div style={styles.terminalPaneBar}>
                <select
                  style={styles.terminalPaneSelect}
                  value={splitId}
                  aria-label={t('editor.terminalSplitPane')}
                  onChange={(event) => {
                    setSplitId(event.target.value);
                    focusPane('right');
                  }}>
                  {terminals
                    .filter((terminal) => terminal.id !== activeId)
                    .map((terminal) => (
                      <option
                        key={terminal.id}
                        value={terminal.id}>
                        {terminal.title}
                      </option>
                    ))}
                </select>
              </div>
              <TerminalScreen
                terminalId={splitId}
                fontSize={fontSize}
                find={find}
                getCwd={() => splitTerminal.cwd}
                onGrid={reportGrid}
                onError={(message) => setError(message)}
                onExit={(code) =>
                  setTerminals((current) =>
                    current.map((terminal) =>
                      terminal.id === splitId
                        ? {
                            ...terminal,
                            state: 'exited',
                            exitCode: code,
                          }
                        : terminal,
                    ),
                  )
                }
                onEmulator={(emulator) => {
                  splitEmulatorRef.current = emulator;
                }}
                onInput={(data) => {
                  if (splitId !== null) void sendInput(splitId, data);
                }}
                onTitle={(title) => {
                  const cleaned = title.trim();
                  if (splitId === null || cleaned === '') return;
                  void syncTerminalTitle(splitId, cleaned);
                }}
                onCwd={(cwd) => {
                  if (splitId === null) return;
                  syncTerminalCwd(splitId, cwd);
                }}
              />
            </div>
          )}
        </div>
      ) : (
        <div style={styles.terminalNotice}>{t('editor.terminalUnavailable')}</div>
      )}
      {shellMenu === null ? null : (
        <ContextMenu
          menu={shellMenu}
          onClose={() => setShellMenu(null)}
          t={t}
        />
      )}
      {menu === null ? null : (
        <ContextMenu
          menu={menu}
          onClose={() => setMenu(null)}
          t={t}
        />
      )}
      {
        /* No footer row: the cwd is already on the tab's tooltip and the PTY grid
       (`90×10`) is a diagnostic nobody reads. Both cost 20px of a short dock. */
        error === null ? null : (
          <div style={styles.terminalStatusBar}>
            <span
              style={{
                color: 'var(--dsw-alias-state-error-primary)',
              }}>
              {error}
            </span>
          </div>
        )
      }
    </div>
  );
}

export { TerminalPanel };
