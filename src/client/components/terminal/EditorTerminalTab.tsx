import React from 'react';
import { styles } from '../../ui/styles';
import { ToolbarButton } from '../ui/ToolbarButton';
import { editorTerminalTabTargetIndex } from './editor-terminal-tabs';
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
  terminals?: EditorTerminalDescriptor[];
  activeTerminalId?: string;
  onSelectTerminal?: (id: string) => void;
  onSelectTerminalFromKeyboard?: (id: string) => void;
  fontSize: number;
  onGrid: (size: { cols: number; rows: number }) => void;
  onError: (message: string) => void;
  onInput: (id: string, data: string) => void;
  onTitle: (id: string, title: string) => void;
  onCwd: (id: string, cwd: string) => void;
  onExit: (code: number | null) => void;
  onReturnToDock: (terminal: EditorTerminalDescriptor) => void;
  getCwd: () => string;
  focusGeneration?: number;
}

/** One terminal living in the editor area (IDEA's Move to Editor). */
function EditorTerminalTab({
  t,
  terminal,
  terminals = [terminal],
  activeTerminalId = terminal.id,
  onSelectTerminal,
  onSelectTerminalFromKeyboard,
  fontSize,
  onGrid,
  onError,
  onInput,
  onTitle,
  onCwd,
  onExit,
  onReturnToDock,
  getCwd,
  focusGeneration = 0,
}: EditorTerminalTabProps) {
  const [emulator, setEmulator] = React.useState<TerminalEmulator | null>(null);
  return (
    <div
      style={styles.editorTerminalPane}
      data-dsh-editor-terminal-tab={terminal.id}>
      <div style={styles.editorTerminalToolbar}>
        <div
          style={styles.terminalTabs}
          role='tablist'
          aria-label={t('editor.terminalTabs')}
          data-dsh-editor-terminal-tabs=''>
          {terminals.map((entry) => (
            <button
              key={entry.id}
              type='button'
              className='dsh-editor-terminal-tab'
              role='tab'
              aria-selected={entry.id === activeTerminalId}
              tabIndex={entry.id === activeTerminalId ? 0 : -1}
              data-dsh-editor-terminal-tab-id={entry.id}
              title={`${entry.title} — ${entry.cwd}`}
              style={{
                ...styles.terminalTab,
                ...(entry.id === activeTerminalId ? styles.terminalTabActive : null),
              }}
              onClick={() => onSelectTerminal?.(entry.id)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  emulator?.focus();
                  return;
                }
                const index = terminals.findIndex((candidate) => candidate.id === entry.id);
                const nextIndex = editorTerminalTabTargetIndex(index, terminals.length, event.key);
                if (nextIndex === null) return;
                event.preventDefault();
                event.stopPropagation();
                const next = terminals[nextIndex];
                onSelectTerminalFromKeyboard?.(next.id);
                window.setTimeout(() => {
                  const nextTab = [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find(
                    (candidate) => candidate.dataset.dshEditorTerminalTabId === next.id,
                  );
                  nextTab?.focus({ preventScroll: true });
                }, 0);
              }}>
              <span style={styles.editorTerminalTitle}>{entry.title}</span>
            </button>
          ))}
        </div>
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
          focusGeneration={focusGeneration}
        />
      </div>
    </div>
  );
}

export { EditorTerminalTab };
