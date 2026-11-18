import React from 'react';
import { styles } from '../../ui/styles';
import { ToolbarButton } from '../ui/ToolbarButton';
import { EditorStatusFacts, EditorStatusFile } from './EditorStatusFacts';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface EditorStatusBarProps {
  t: Translate;
  visible: boolean;
  file: EditorStatusFile | null;
  caret: {
    line: number;
    column: number;
  };
  fileMode: {
    encoding: string;
  };
  lineStats: {
    lines: number;
    selected: number;
  };
  statusPath: string;
  statusNotice: string | null;
  onCopyStatusPath: () => void;
  onGotoLine: () => void;
  onAnnotate: () => void;
}

function EditorStatusBar({
  t,
  visible,
  file,
  caret,
  fileMode,
  lineStats,
  statusPath,
  statusNotice,
  onCopyStatusPath,
  onGotoLine,
  onAnnotate,
}: EditorStatusBarProps) {
  if (visible !== true || file === null) return null;
  return (
    <div style={styles.editorStatus}>
      <EditorStatusFacts
        t={t}
        file={file}
        caret={caret}
        fileMode={fileMode}
        lineStats={lineStats}
      />
      <button
        type='button'
        className='dsh-editor-status-path'
        style={{
          ...styles.statusItem,
          ...styles.statusPath,
          ...styles.statusPathButton,
        }}
        title={statusPath}
        aria-label={t('editor.copyStatusPath', { path: statusPath })}
        data-dsh-editor-status-path=''
        onClick={onCopyStatusPath}>
        {statusPath}
      </button>
      {lineStats.selected > 0 ? (
        <span style={styles.statusItem}>{t('editor.selectionInfo', { count: lineStats.selected })}</span>
      ) : null}
      <span style={styles.toolbarSpacer} />
      {statusNotice === null ? null : (
        <span
          style={styles.statusItem}
          role='status'>
          {statusNotice}
        </span>
      )}
      <ToolbarButton
        icon='search'
        label={t('editor.gotoLine')}
        onClick={onGotoLine}
      />
      <ToolbarButton
        icon='annotate'
        label={t('editor.annotate')}
        onClick={onAnnotate}
      />
    </div>
  );
}

export { EditorStatusBar };
