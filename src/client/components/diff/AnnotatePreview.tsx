import React from 'react';
import { styles } from '../../ui/styles';
import { PathLabel } from '../ui/PathLabel';
import { ToolbarButton } from '../ui/ToolbarButton';
import { formatCommitDate } from '../../find-tool';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface AnnotateLine {
  line: number;
  hash: string;
  summary: string;
  author: string;
  date: unknown;
}

export interface AnnotatePreviewProps {
  t: Translate;
  target: {
    path?: string;
    [key: string]: unknown;
  } | null;
  lines: AnnotateLine[];
  loading: boolean;
  truncated: boolean;
  onClose: () => void;
  onOpenCommit?: (hash: string) => void;
  selected: string | null;
}

function AnnotatePreview({
  t,
  target,
  lines,
  loading,
  truncated,
  onClose,
  onOpenCommit,
  selected,
}: AnnotatePreviewProps) {
  return (
    <div
      style={styles.diffPane}
      className='dsh-editor-annotate-pane'>
      <div
        style={styles.diffToolbar}
        className='dsh-editor-diff-toolbar'>
        <PathLabel
          path={target?.path ?? ''}
          style={styles.diffTitle}
        />
        <span style={styles.diffHint}>{t('editor.annotateMode')}</span>
        {truncated ? <span style={styles.diffHint}>{t('editor.annotateTruncated')}</span> : null}
        <ToolbarButton
          icon='hide'
          label={t('editor.closeAnnotate')}
          onClick={onClose}
        />
      </div>
      {loading ? (
        <div style={styles.empty}>{t('editor.loading')}</div>
      ) : (
        <div style={styles.annotateScroll}>
          {lines.map((row) => (
            <div
              key={row.line}
              style={{
                ...styles.annotateRow,
                ...(selected === row.hash ? styles.commitGraphRowActive : null),
              }}
              className='dsh-editor-annotate-row'
              title={`${row.hash} · ${row.summary}\n${t('editor.annotateOpenCommit')}`}
              onClick={() => onOpenCommit?.(row.hash)}>
              <span style={styles.annotateMeta}>{`${row.author} · ${formatCommitDate(row.date)}`}</span>
              <span style={styles.annotateHash}>{row.hash.slice(0, 7)}</span>
              <span style={styles.annotateLineNo}>{String(row.line)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { AnnotatePreview };
