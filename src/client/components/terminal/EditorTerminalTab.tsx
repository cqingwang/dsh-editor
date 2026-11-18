import React from 'react';
import { styles } from '../../ui/styles';
import { Icon } from '../ui/Icon';
import { ToolbarButton } from '../ui/ToolbarButton';
import { TerminalScreen } from './TerminalScreen';
import type { TerminalEmulator } from '../../find-tool';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface EditorTerminalDescriptor {
  id: string;
  title: string;
  cwd: string;
}

export interface EditorTerminalTabProps {
  t: Translate;
  terminal: EditorTerminalDescriptor;
  fontSize: number;
  onGrid: (size: { cols: number; rows: number }) => void;
  onError: (message: string) => void;
  onInput: (id: string, data: string) => void;
  onTitle: (id: string, title: string) => void;
  onCwd: (id: string, cwd: string) => void;
  onExit: (code: number | null) => void;
  onReturnToDock: (terminal: EditorTerminalDescriptor) => void;
  getCwd: () => string;
}

/** One terminal living in the editor area (IDEA's Move to Editor). */
function EditorTerminalTab({
  t,
  terminal,
  fontSize,
  onGrid,
  onError,
  onInput,
  onTitle,
  onCwd,
  onExit,
  onReturnToDock,
  getCwd,
}: EditorTerminalTabProps) {
  const [emulator, setEmulator] = React.useState<TerminalEmulator | null>(null);
  return (
    <div
      style={styles.editorTerminalPane}
      data-dsh-editor-terminal-tab={terminal.id}>
      <div style={styles.editorTerminalToolbar}>
        <Icon
          name='terminal'
          size={12}
        />
        <span
          style={styles.editorTerminalTitle}
          title={`${terminal.title} — ${terminal.cwd}`}>
          {terminal.title}
        </span>
        <span style={styles.toolbarSpacer} />
        <ToolbarButton
          icon='collapse'
          label={t('editor.terminalReturnToDock')}
          onClick={() => onReturnToDock(terminal)}
        />
        <ToolbarButton
          icon='search'
          label={t('editor.find')}
          onClick={() => emulator?.focus()}
        />
      </div>
      <div style={styles.editorTerminalScreen}>
        <TerminalScreen
          terminalId={terminal.id}
          terminals={[terminal]}
          fontSize={fontSize}
          find={null}
          getCwd={getCwd}
          onGrid={onGrid}
          onError={onError}
          onExit={onExit}
          onEmulator={setEmulator}
          onInput={(data) => onInput(terminal.id, data)}
          onTitle={(title) => onTitle(terminal.id, title)}
          onCwd={(cwd) => onCwd(terminal.id, cwd)}
        />
      </div>
    </div>
  );
}

export { EditorTerminalTab };
