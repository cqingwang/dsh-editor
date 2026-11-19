import React from 'react';
import { clearSessionTerminalDockOpen, readTerminalDockOpen, writeTerminalDockOpen } from '../../terminal';

export function usePersistentTerminalDockOpen(
  workspaceId: string,
): [boolean, React.Dispatch<React.SetStateAction<boolean>>] {
  const scope = workspaceId === '' ? undefined : `workspace:${workspaceId}`;
  const [open, setOpen] = React.useState(() => (scope === undefined ? false : readTerminalDockOpen(scope)));
  const hydratedScopeRef = React.useRef(scope ?? '');
  React.useEffect(() => {
    if (scope === undefined) return;
    if (hydratedScopeRef.current !== scope) {
      hydratedScopeRef.current = scope;
      const remembered = readTerminalDockOpen(scope);
      setOpen(remembered);
      writeTerminalDockOpen(remembered, scope);
      clearSessionTerminalDockOpen();
      return;
    }
    writeTerminalDockOpen(open, scope);
    clearSessionTerminalDockOpen();
  }, [open, scope]);
  return [open, setOpen];
}
