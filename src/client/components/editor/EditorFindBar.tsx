import React from 'react';
import { styles } from '../../ui/styles';
import { ContextMenu } from '../ui/Menu';
import { ToolbarButton } from '../ui/ToolbarButton';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export type EditorFindOption = 'caseSensitive' | 'wholeWords' | 'regex' | 'preserveCase';

export interface EditorFindState {
  find: string;
  replace: string;
  error: string | null;
  total: number;
  index: number;
  caseSensitive?: boolean;
  wholeWords?: boolean;
  regex?: boolean;
  preserveCase?: boolean;
  withReplace?: boolean;
  scope?: { start: number; end: number } | null;
}

export interface EditorFindHistoryMenu {
  kind: 'query' | 'replace';
  x: number;
  y: number;
}

export interface EditorFindBarProps {
  t: Translate;
  state: EditorFindState | null;
  historyMenu: EditorFindHistoryMenu | null;
  historyValues: string[];
  onFindChange: (value: string) => void;
  onReplaceChange: (value: string) => void;
  onOpenHistory: (event: React.MouseEvent<HTMLElement>, kind: 'query' | 'replace') => void;
  onSelectHistory: (value: string) => void;
  onCloseHistory: () => void;
  onJump: (direction: number) => void;
  onToggleOption: (option: EditorFindOption) => void;
  onToggleSelectionScope: () => void;
  onReplaceCurrent: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
}

function EditorFindBar({
  t,
  state,
  historyMenu,
  historyValues,
  onFindChange,
  onReplaceChange,
  onOpenHistory,
  onSelectHistory,
  onCloseHistory,
  onJump,
  onToggleOption,
  onToggleSelectionScope,
  onReplaceCurrent,
  onReplaceAll,
  onClose,
}: EditorFindBarProps) {
  if (state === null) return null;
  return (
    <div style={styles.findBar}>
      <input
        data-dsh-editor-find-input=''
        style={styles.findInput}
        autoFocus={true}
        placeholder={t('editor.find')}
        value={state.find}
        onChange={(event) => onFindChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.altKey === true && event.key === 'ArrowDown') {
            onOpenHistory(event, 'query');
          } else if (event.key === 'Enter') {
            event.preventDefault();
            onJump(event.shiftKey ? -1 : 1);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
          }
        }}
      />
      <ToolbarButton
        icon='history'
        label={t('editor.findSearchHistory')}
        ariaHasPopup='menu'
        ariaExpanded={historyMenu?.kind === 'query'}
        onClick={(event) => onOpenHistory(event, 'query')}
      />
      <span style={styles.findCount}>
        {state.total === 0 ? t('editor.noMatches') : `${state.index + 1}/${state.total}`}
      </span>
      <ToolbarButton
        icon='matchCase'
        label={t('editor.searchMatchCase')}
        active={state.caseSensitive === true}
        onClick={() => onToggleOption('caseSensitive')}
      />
      <ToolbarButton
        icon='wholeWords'
        label={t('editor.searchWholeWords')}
        active={state.wholeWords === true}
        disabled={state.regex === true}
        onClick={() => onToggleOption('wholeWords')}
      />
      <ToolbarButton
        icon='regex'
        label={t('editor.searchRegex')}
        active={state.regex === true}
        onClick={() => onToggleOption('regex')}
      />
      {state.withReplace === true ? (
        <ToolbarButton
          icon='preserveCase'
          label={t('editor.searchPreserveCase')}
          active={state.preserveCase === true}
          onClick={() => onToggleOption('preserveCase')}
        />
      ) : null}
      <ToolbarButton
        icon='target'
        label={t('editor.searchInSelectionOnly')}
        active={state.scope !== null}
        onClick={onToggleSelectionScope}
      />
      {state.error === null ? null : (
        <span
          style={{
            ...styles.findCount,
            color: 'var(--dsw-alias-state-error-primary)',
          }}
          role='alert'
          title={state.error}>
          {state.error}
        </span>
      )}
      <ToolbarButton
        icon='chevronDown'
        label={t('editor.findNext')}
        onClick={() => onJump(1)}
      />
      <ToolbarButton
        icon='chevronRight'
        label={t('editor.findPrevious')}
        onClick={() => onJump(-1)}
      />
      {state.withReplace === true ? (
        <ToolbarButton
          icon='check'
          label={t('editor.replaceCurrent')}
          disabled={state.error !== null || state.total === 0}
          onClick={onReplaceCurrent}
        />
      ) : null}
      {state.withReplace === true ? (
        <input
          data-dsh-editor-find-replace-input=''
          style={styles.findInput}
          placeholder={t('editor.replace')}
          value={state.replace}
          onChange={(event) => onReplaceChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.isComposing === true) return;
            if (event.altKey === true && event.key === 'ArrowDown') {
              onOpenHistory(event, 'replace');
            } else if (event.key === 'Enter') {
              event.preventDefault();
              event.stopPropagation();
              if (state.error === null && state.total > 0) onReplaceCurrent();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              onClose();
            }
          }}
        />
      ) : null}
      {state.withReplace === true ? (
        <ToolbarButton
          icon='history'
          label={t('editor.findReplaceHistory')}
          ariaHasPopup='menu'
          ariaExpanded={historyMenu?.kind === 'replace'}
          onClick={(event) => onOpenHistory(event, 'replace')}
        />
      ) : null}
      {state.withReplace === true ? (
        <button
          type='button'
          style={{
            ...styles.conflictAction,
            opacity: state.error === null && state.total > 0 ? 1 : 0.45,
          }}
          disabled={state.error !== null || state.total === 0}
          onClick={onReplaceAll}>
          {t('editor.replaceAll')}
        </button>
      ) : null}
      <button
        type='button'
        style={styles.conflictAction}
        onClick={onClose}>
        ×
      </button>
      {historyMenu === null ? null : (
        <div data-dsh-editor-find-history-menu=''>
          <ContextMenu
            t={t}
            menu={{
              x: historyMenu.x,
              y: historyMenu.y,
              title: historyMenu.kind === 'query' ? t('editor.findSearchHistory') : t('editor.findReplaceHistory'),
              items:
                historyValues.length === 0
                  ? [
                      {
                        id: 'empty',
                        label: t('editor.findHistoryEmpty'),
                        disabled: true,
                        run: () => {},
                      },
                    ]
                  : historyValues.map((value, index) => ({
                      id: `${historyMenu.kind}:${index}`,
                      label: value,
                      run: () => onSelectHistory(value),
                    })),
            }}
            onClose={onCloseHistory}
          />
        </div>
      )}
    </div>
  );
}

export { EditorFindBar };
