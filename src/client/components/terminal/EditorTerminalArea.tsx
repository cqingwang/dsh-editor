import React from 'react';
import { EDITOR_FONT_SIZE_SCALE } from '../editor/editor-style-model';
import {
  editorTerminalActiveAfterChange,
  editorTerminalsWithMetadata,
  updateEditorTerminalMetadata,
  type EditorTerminalMetadata,
} from './editor-terminal-tabs';
import { EditorTerminalTab, type EditorTerminalDescriptor } from './EditorTerminalTab';
import { callTerminal, readEditorTerminalActiveId, writeEditorTerminalActiveId } from '../../terminal';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface EditorTerminalAreaProps {
  active: boolean;
  terminals: EditorTerminalDescriptor[];
  t: Translate;
  onError: (message: string) => void;
  onInput: (id: string, data: string) => void;
  onReturnToDock: (terminal: EditorTerminalDescriptor) => void;
}

function EditorTerminalArea({ active, terminals, t, onError, onInput, onReturnToDock }: EditorTerminalAreaProps) {
  const [activeId, setActiveId] = React.useState<string | null>(() => readEditorTerminalActiveId());
  const [focusGeneration, setFocusGeneration] = React.useState(0);
  const [metadata, setMetadata] = React.useState<Record<string, EditorTerminalMetadata>>({});
  const previousIdsRef = React.useRef<string[]>([]);
  const initializedRef = React.useRef(false);
  const titleWriteChainRef = React.useRef(new Map<string, Promise<void>>());
  const terminalIdsKey = terminals.map((terminal) => terminal.id).join('\0');
  const resolvedTerminals = React.useMemo(
    () => editorTerminalsWithMetadata(terminals, metadata),
    [metadata, terminals],
  );
  React.useEffect(() => {
    if (terminals.length === 0) {
      previousIdsRef.current = [];
      return;
    }
    if (!initializedRef.current) {
      initializedRef.current = true;
      if (activeId !== null && terminals.some((terminal) => terminal.id === activeId)) {
        previousIdsRef.current = terminals.map((terminal) => terminal.id);
      }
    }
    const next = editorTerminalActiveAfterChange(previousIdsRef.current, terminals, activeId);
    previousIdsRef.current = terminals.map((terminal) => terminal.id);
    if (next !== activeId) setActiveId(next);
  }, [activeId, terminalIdsKey, terminals]);
  React.useEffect(() => {
    writeEditorTerminalActiveId(activeId);
  }, [activeId]);
  if (!active || terminals.length === 0) return null;
  const terminal =
    resolvedTerminals.find((entry) => entry.id === activeId) ?? resolvedTerminals[resolvedTerminals.length - 1];
  const updateMetadata = (id: string, patch: EditorTerminalMetadata): void => {
    setMetadata((current) => updateEditorTerminalMetadata(current, id, patch));
  };
  const updateTitle = (id: string, title: string): void => {
    const cleaned = title.trim();
    if (cleaned === '') return;
    updateMetadata(id, { title: cleaned });
    const previous = titleWriteChainRef.current.get(id) ?? Promise.resolve();
    const request = previous
      .catch(() => {})
      .then(async () => {
        await callTerminal({ op: 'rename', id, title: cleaned, auto: true }).catch(() => {});
      })
      .finally(() => {
        if (titleWriteChainRef.current.get(id) === request) titleWriteChainRef.current.delete(id);
      });
    titleWriteChainRef.current.set(id, request);
  };
  const selectTerminal = (id: string): void => {
    setActiveId(id);
    setFocusGeneration((value) => value + 1);
  };
  const selectTerminalFromKeyboard = (id: string): void => {
    setActiveId(id);
  };
  return (
    <EditorTerminalTab
      t={t}
      terminal={terminal}
      terminals={resolvedTerminals}
      activeTerminalId={terminal.id}
      onSelectTerminal={selectTerminal}
      onSelectTerminalFromKeyboard={selectTerminalFromKeyboard}
      fontSize={EDITOR_FONT_SIZE_SCALE.body}
      getCwd={() => terminal.cwd}
      onGrid={() => {}}
      onError={onError}
      onInput={onInput}
      onTitle={updateTitle}
      onCwd={(id, cwd) => updateMetadata(id, { cwd })}
      onExit={() => {}}
      onReturnToDock={onReturnToDock}
      focusGeneration={focusGeneration}
    />
  );
}

export { EditorTerminalArea };
