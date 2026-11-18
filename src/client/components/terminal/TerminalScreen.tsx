import React from 'react';
import { styles } from '../../ui/styles';

export interface TerminalFindState {
  query: string;
  index: number;
}

export interface TerminalScreenProps {
  terminalId: string | null;
  terminals: unknown[];
  fontSize: number;
  find: TerminalFindState | null;
  onGrid?: (size: { cols: number; rows: number }) => void;
  onError?: (message: string) => void;
  onExit?: (code: number | null) => void;
  onEmulator?: (emulator: any | null) => void;
  onInput?: (data: string) => void;
  onTitle?: (title: string) => void;
  onCwd?: (cwd: string) => void;
  getCwd: () => string;
  focusGeneration?: number;
}

function TerminalScreen({
  terminalId,
  terminals,
  fontSize,
  find,
  onGrid,
  onError,
  onExit,
  onEmulator,
  onInput,
  onTitle,
  /* The shell's own directory reports (OSC 7); without it here the emulator
     would call an `undefined` name and take the pane down. */
  onCwd,
  getCwd,
  focusGeneration = 0,
}: TerminalScreenProps) {
  const hostRef = React.useRef(null);
  const emulatorRef = React.useRef(null);
  const fitRef = React.useRef(null);
  const [ready, setReady] = React.useState(false);
  /* The dock is hidden by CSS rather than unmounted, so the terminal must
     reclaim the caret when it becomes visible again. */
  const [visible, setVisible] = React.useState(false);
  const sizeRef = React.useRef({
    cols: 80,
    rows: 24,
  });
  const handlersRef = React.useRef({});
  /* Every callback the emulator mount may call must be registered here; a new one
     that is passed in but not listed stays `undefined` and fails silently (round
     122: `onCwd` was missing, so OSC 7 never reached the terminal state). */
  handlersRef.current = {
    onGrid,
    onError,
    onExit,
    onEmulator,
    onInput,
    onTitle,
    onCwd,
  };
  const setHostNode = React.useCallback((node) => {
    hostRef.current?.__dshTerminalVisibilityObserver?.disconnect?.();
    hostRef.current = node;
    if (node === null) {
      setVisible(false);
      return;
    }
    const update = () => {
      const rect = node.getBoundingClientRect();
      setVisible(rect.width > 0 && rect.height > 0 && node.offsetParent !== null);
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    node.__dshTerminalVisibilityObserver?.disconnect?.();
    node.__dshTerminalVisibilityObserver = observer;
  }, []);

  /* Create the emulator once the screen node exists. */
  React.useEffect(() => {
    const node = hostRef.current;
    if (node === null) return;
    let disposed = false;
    loadXterm().then(
      ({ Terminal, FitAddon }) => {
        if (disposed || node === null) return;
        const emulator = new Terminal({
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize,
          lineHeight: 1.25,
          cursorBlink: true,
          scrollback: 2000,
          theme: terminalTheme(node),
        });
        const fit = new FitAddon();
        emulator.loadAddon(fit);
        emulator.open(node);
        emulator.onData((data) => handlersRef.current.onInput?.(data));
        /* Shells publish their title over OSC 0/2; follow it like IDEA's terminal tabs. */
        emulator.onTitleChange((title) => handlersRef.current.onTitle?.(title));
        /* OSC 7 is how a shell reports `cd`; without it every menu action kept
         pointing at the tab's original directory. */
        /* `parser.registerOscHandler` exists on xterm 5.x; guard anyway, because a
         missing method here would take the whole emulator mount down. */
        if (typeof emulator.parser?.registerOscHandler === 'function') {
          emulator.parser.registerOscHandler(7, (payload) => {
            const cwd = cwdFromOsc7(payload);
            if (cwd !== null) handlersRef.current.onCwd?.(cwd);
            return true;
          });
        }
        /* IDEA underlines URLs and existing workspace files; both open on ⌘/Ctrl+click. */
        const linkDisposable = emulator.registerLinkProvider(createTerminalLinkProvider(emulator, () => getCwd()));
        emulatorRef.current = emulator;
        fitRef.current = fit;
        handlersRef.current.onEmulator?.(emulator);
        setReady(true);
        return () => linkDisposable.dispose();
      },
      (failure) => {
        if (!disposed) handlersRef.current.onError?.(failure instanceof Error ? failure.message : String(failure));
      },
    );
    return () => {
      disposed = true;
      emulatorRef.current?.dispose();
      emulatorRef.current = null;
      fitRef.current = null;
      handlersRef.current.onEmulator?.(null);
    };
  }, []);

  /* Follow this terminal's output stream, replaying its retained screen. */
  React.useEffect(() => {
    const emulator = emulatorRef.current;
    if (!ready || terminalId === null || emulator === null) return;
    const controller = new AbortController();
    emulator.reset();
    const sessionId = currentSessionId();
    const workspaceId = currentEditorWorkspaceId();
    const url = `api/dsh-editor/terminal/stream?sessionId=${encodeURIComponent(sessionId)}&workspaceId=${encodeURIComponent(workspaceId)}&id=${encodeURIComponent(terminalId)}`;
    fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'text/event-stream',
      },
    })
      .then((response) => {
        if (!response.ok) throw new Error(`terminal stream HTTP ${response.status}`);
        return readEventStream(
          response,
          (event) => {
            if (event.type === 'snapshot') {
              const restored = takeTerminalRestoreBuffer(terminalId);
              resetTerminalLiveBuffer(terminalId, event.data, restored);
              emulator.reset();
              if (restored !== '') emulator.write(restored);
              emulator.write(event.data);
            } else if (event.type === 'data') {
              appendTerminalLiveBuffer(terminalId, event.data);
              emulator.write(event.data);
            } else if (event.type === 'exit') {
              const exitText = `\r\n[process exited${event.code === null ? '' : ` with code ${event.code}`}]\r\n`;
              appendTerminalLiveBuffer(terminalId, exitText);
              emulator.write(exitText);
              handlersRef.current.onExit?.(event.code ?? null);
            } else if (event.type === 'error') {
              handlersRef.current.onError?.(event.message);
            }
          },
          controller.signal,
        );
      })
      .catch((failure) => {
        if (controller.signal.aborted) return;
        handlersRef.current.onError?.(failure instanceof Error ? failure.message : String(failure));
      });
    return () => controller.abort();
  }, [terminalId, ready]);

  /* Keep the PTY grid in step with the pane's real size. */
  React.useEffect(() => {
    const node = hostRef.current;
    const emulator = emulatorRef.current;
    if (!ready || node === null || emulator === null) return;
    const measure = () => {
      const fit = fitRef.current;
      if (fit === null) return;
      /* FitAddon needs a laid-out element; skip the frame where it has none. */
      if (node.clientWidth === 0 || node.clientHeight === 0) return;
      fit.fit();
      const cols = Math.max(2, Math.min(500, emulator.cols));
      const rows = Math.max(1, Math.min(200, emulator.rows));
      /* A measuring screen has no PTY yet: it still REPORTS the size, which is
         how a fresh shell is spawned at the real width instead of a guess. */
      if (cols === sizeRef.current.cols && rows === sizeRef.current.rows) return;
      sizeRef.current = {
        cols,
        rows,
      };
      handlersRef.current.onGrid?.({
        cols,
        rows,
      });
      if (terminalId !== null)
        void callTerminal({
          op: 'resize',
          id: terminalId,
          cols,
          rows,
        }).catch(() => {});
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(node);
    return () => observer?.disconnect();
  }, [ready, terminalId]);

  /* Font size is a preference; xterm re-renders without touching the PTY. */
  React.useEffect(() => {
    const emulator = emulatorRef.current;
    if (!ready || emulator === null) return;
    emulator.options.fontSize = fontSize;
    fitRef.current?.fit();
  }, [fontSize, ready]);

  /* IDEA focuses the terminal when it is raised with Alt+F12, and restores
     focus when the dock comes back after another tool window or a diff. */
  React.useEffect(() => {
    if (!ready) return;
    emulatorRef.current?.focus();
  }, [ready, visible, focusGeneration]);

  /* Follow the app's color scheme without restarting the shell. */
  React.useEffect(() => {
    if (!ready) return;
    const node = hostRef.current;
    const emulator = emulatorRef.current;
    if (node === null || emulator === null) return;
    const apply = () => {
      emulator.options.theme = terminalTheme(node);
    };
    const observer = new MutationObserver(apply);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-ds-dark-theme', 'class', 'style'],
    });
    return () => observer.disconnect();
  }, [ready]);

  /* Highlight and scroll to the requested find match inside this pane. */
  React.useEffect(() => {
    const emulator = emulatorRef.current;
    if (!ready || emulator === null || find === null) return;
    if (find.query === '') {
      emulator.clearSelection();
      return;
    }
    const hits = terminalMatches(emulator, find.query);
    if (hits.length === 0) {
      emulator.clearSelection();
      return;
    }
    const hit = hits[Math.min(find.index, hits.length - 1)];
    emulator.select(hit.column, hit.row, find.query.length);
    emulator.scrollToLine(hit.row - Math.floor(emulator.rows / 2));
  }, [ready, find?.query, find?.index]);
  return (
    <div
      ref={setHostNode}
      style={styles.xtermHost}
      data-dsh-terminal-pane=''
      onClick={() => emulatorRef.current?.focus()}
    />
  );
}

export { TerminalScreen };
