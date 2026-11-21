import React from 'react';

export function claimFindDockSlot(
  terminalOpen: boolean,
  findDockRestoreTerminalRef: React.MutableRefObject<boolean>,
  setTerminalOpen: React.Dispatch<React.SetStateAction<boolean>>,
): void {
  if (terminalOpen) findDockRestoreTerminalRef.current = true;
  setTerminalOpen(false);
}

export function takeFindDockTerminalRestore(findDockRestoreTerminalRef: React.MutableRefObject<boolean>): boolean {
  const restoreTerminal = findDockRestoreTerminalRef.current;
  findDockRestoreTerminalRef.current = false;
  return restoreTerminal;
}

export function restoreFindDockTerminal(
  findDockRestoreTerminalRef: React.MutableRefObject<boolean>,
  setTerminalOpen: React.Dispatch<React.SetStateAction<boolean>>,
): boolean {
  if (!takeFindDockTerminalRestore(findDockRestoreTerminalRef)) return false;
  setTerminalOpen(true);
  return true;
}

export interface FindDockSlotState {
  claimFindDockSlot: () => void;
  restoreTerminalAfterFind: () => boolean;
  minimized: boolean;
  setMinimized: React.Dispatch<React.SetStateAction<boolean>>;
  toggleMinimized: () => void;
}

export function useFindDockSlotState(
  terminalOpen: boolean,
  setTerminalOpen: React.Dispatch<React.SetStateAction<boolean>>,
): FindDockSlotState {
  const terminalOpenRef = React.useRef(terminalOpen);
  const findDockRestoreTerminalRef = React.useRef(false);
  const [minimized, setMinimized] = React.useState(false);
  React.useEffect(() => {
    terminalOpenRef.current = terminalOpen;
    if (terminalOpen) findDockRestoreTerminalRef.current = false;
  }, [terminalOpen]);
  const claim = React.useCallback(() => {
    claimFindDockSlot(terminalOpenRef.current, findDockRestoreTerminalRef, setTerminalOpen);
  }, [setTerminalOpen]);
  const restore = React.useCallback(
    () => restoreFindDockTerminal(findDockRestoreTerminalRef, setTerminalOpen),
    [setTerminalOpen],
  );
  const toggleMinimized = React.useCallback(() => setMinimized((current) => !current), []);
  return {
    claimFindDockSlot: claim,
    restoreTerminalAfterFind: restore,
    minimized,
    setMinimized,
    toggleMinimized,
  };
}
