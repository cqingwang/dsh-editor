import React from 'react';
import { styles } from '../../ui/styles';
import { formatCommitDate } from '../../find-tool';
import type { CommitLogEntry } from './CommitLog';

type Translate = (key: string, params?: Record<string, unknown>) => string;

interface CommitLogFlatRowProps {
  t: Translate;
  commit: CommitLogEntry;
  selectionIncluded: boolean;
  highlighted: boolean;
  rowRef?: (node: HTMLDivElement | null) => void;
  onMouseDown: () => void;
  onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  onContextMenu: (event: React.MouseEvent<HTMLDivElement>) => void;
}

function CommitLogFlatRow({
  t,
  commit,
  selectionIncluded,
  highlighted,
  rowRef,
  onMouseDown,
  onClick,
  onContextMenu,
}: CommitLogFlatRowProps) {
  return (
    <div
      className='dsh-editor-commit-row'
      title={`${commit.hash}\n${t('editor.logRowHint')}`}
      ref={rowRef}
      role='option'
      data-dsh-log-hash={commit.hash}
      aria-haspopup='menu'
      aria-selected={selectionIncluded}
      onMouseDown={onMouseDown}
      onClick={onClick}
      style={{
        ...styles.commitFileRow,
        paddingLeft: 10,
        alignItems: 'flex-start',
        height: 'auto',
        paddingTop: 5,
        paddingBottom: 5,
        ...(selectionIncluded ? styles.commitGraphRowActive : null),
      }}
      {...(highlighted
        ? {
            'data-dsh-log-new': '',
          }
        : null)}
      onContextMenu={onContextMenu}>
      <span style={styles.logHash}>{commit.hash.slice(0, 7)}</span>
      <span
        style={{
          minWidth: 0,
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
        <span style={styles.logSubject}>{commit.subject}</span>
        <span style={styles.logMeta}>{`${commit.author} · ${formatCommitDate(commit.date)}`}</span>
      </span>
    </div>
  );
}

export { CommitLogFlatRow };
