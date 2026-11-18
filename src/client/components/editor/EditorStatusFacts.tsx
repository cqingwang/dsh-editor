import React from 'react';
import { styles } from '../../ui/styles';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface EditorStatusFile {
  kind?: string;
}

export interface EditorStatusFactsProps {
  t: Translate;
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
  };
}

function EditorStatusFacts({ t, file, caret, fileMode, lineStats }: EditorStatusFactsProps) {
  if (file?.kind === 'image') {
    return <span style={styles.statusItem}>{t('editor.imagePreview')}</span>;
  }

  return (
    <>
      <span style={styles.statusItem}>{t('editor.statusBarPosition', { line: caret.line, column: caret.column })}</span>
      <span style={styles.statusItem}>{fileMode.encoding}</span>
      <span style={styles.statusItem}>{t('editor.lineCount', { count: lineStats.lines })}</span>
    </>
  );
}

export { EditorStatusFacts };
