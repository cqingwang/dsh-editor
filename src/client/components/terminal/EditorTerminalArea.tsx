import React from 'react';
import { EditorTerminalTab, type EditorTerminalDescriptor } from './EditorTerminalTab';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface EditorTerminalAreaProps {
  active: boolean;
  terminal: EditorTerminalDescriptor | null;
  t: Translate;
  onError: (message: string) => void;
  onInput: (id: string, data: string) => void;
  onReturnToDock: (terminal: EditorTerminalDescriptor) => void;
}

function EditorTerminalArea({ active, terminal, t, onError, onInput, onReturnToDock }: EditorTerminalAreaProps) {
  if (!active || terminal === null) return null;
  return (
    <EditorTerminalTab
      t={t}
      terminal={terminal}
      fontSize={12}
      getCwd={() => terminal.cwd}
      onGrid={() => {}}
      onError={onError}
      onInput={onInput}
      onTitle={() => {}}
      onCwd={() => {}}
      onExit={() => {}}
      onReturnToDock={onReturnToDock}
    />
  );
}

export { EditorTerminalArea };
