import React from 'react';

export interface DiffFocusLayoutOptions {
  diffOpen: boolean;
  harnessCollapsed: boolean;
  panelVisible: boolean;
  toggleHarness: () => void;
  setPanelVisible: (visible: boolean) => void;
}

export interface DiffFocusLayoutState {
  diffFocusMode: boolean;
  toggleDiffFocus: () => void;
}

/**
 * Temporarily give the diff the whole Editor surface.
 *
 * The saved chat/tool-window state is restored when the diff closes, when the
 * user toggles Focus Diff again, or when the user manually reopens either
 * surface. Persisted chat and tool-window widths are never overwritten.
 */
export function useDiffFocusLayout({
  diffOpen,
  harnessCollapsed,
  panelVisible,
  toggleHarness,
  setPanelVisible,
}: DiffFocusLayoutOptions): DiffFocusLayoutState {
  const [diffFocusMode, setDiffFocusMode] = React.useState(false);
  const restoreRef = React.useRef<{ chatCollapsed: boolean; panelVisible: boolean } | null>(null);

  const exitDiffFocus = React.useCallback(
    (options: { restorePanel?: boolean; restoreChat?: boolean } = {}): void => {
      const restore = restoreRef.current;
      restoreRef.current = null;
      setDiffFocusMode(false);
      if (options.restorePanel !== false && restore?.panelVisible === true) setPanelVisible(true);
      if (options.restoreChat !== false && restore?.chatCollapsed === false && harnessCollapsed === true) {
        toggleHarness();
      }
    },
    [harnessCollapsed, setPanelVisible, toggleHarness],
  );

  const toggleDiffFocus = React.useCallback((): void => {
    if (diffFocusMode) {
      exitDiffFocus();
      return;
    }
    restoreRef.current = { chatCollapsed: harnessCollapsed, panelVisible };
    setDiffFocusMode(true);
    if (panelVisible) setPanelVisible(false);
    if (!harnessCollapsed) toggleHarness();
  }, [diffFocusMode, exitDiffFocus, harnessCollapsed, panelVisible, setPanelVisible, toggleHarness]);

  React.useEffect(() => {
    if (!diffOpen && diffFocusMode) exitDiffFocus();
  }, [diffFocusMode, diffOpen, exitDiffFocus]);

  React.useEffect(() => {
    if (!diffFocusMode) return;
    const restore = restoreRef.current;
    if (restore === null) return;
    if (restore.chatCollapsed === false && harnessCollapsed === false) {
      exitDiffFocus({ restoreChat: false });
    }
  }, [diffFocusMode, exitDiffFocus, harnessCollapsed]);

  React.useEffect(() => {
    if (!diffFocusMode || panelVisible !== true) return;
    exitDiffFocus({ restorePanel: false });
  }, [diffFocusMode, exitDiffFocus, panelVisible]);

  return { diffFocusMode, toggleDiffFocus };
}
