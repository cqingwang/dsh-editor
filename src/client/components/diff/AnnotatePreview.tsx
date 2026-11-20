import React from 'react';
import { styles } from '../../ui/styles';
import { useCodePreviewColorizedLines } from '../../commit';
import { CodePreviewCode } from '../commit/CodePreviewCode';
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
  content: string;
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
  const annotateTextLines = React.useMemo(() => lines.map((row) => (row.content === '' ? ' ' : row.content)), [lines]);
  const annotateColorizedLines = useCodePreviewColorizedLines(annotateTextLines, target?.path ?? '');

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
          {lines.map((row, index) => (
            <div
              key={row.line}
              style={{
                ...styles.annotateRow,
                ...(selected === row.hash ? styles.commitGraphRowActive : null),
              }}
              className='dsh-editor-annotate-row'>
              <button
                type='button'
                style={styles.annotateGutter}
                className='dsh-editor-annotate-gutter'
                title={`${row.hash} · ${row.summary}\n${t('editor.annotateOpenCommit')}`}
                aria-label={`${row.author} · ${formatCommitDate(row.date)} · ${row.hash.slice(0, 7)} · ${t('editor.annotateOpenCommit')}`}
                onClick={() => onOpenCommit?.(row.hash)}>
                <span style={styles.annotateMeta}>{`${row.author} · ${formatCommitDate(row.date)}`}</span>
                <span style={styles.annotateHash}>{row.hash.slice(0, 7)}</span>
                <span style={styles.annotateLineNo}>{String(row.line)}</span>
              </button>
              <code
                style={styles.annotateCode}
                className='dsh-editor-annotate-code'>
                <CodePreviewCode
                  text={annotateTextLines[index] ?? ' '}
                  html={annotateColorizedLines?.[index] ?? null}
                />
              </code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { AnnotatePreview };
