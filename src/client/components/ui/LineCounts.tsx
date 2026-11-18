import React from 'react';
import { styles } from '../../ui/styles';

export interface LineCountsValue {
  additions: number;
  deletions: number;
  binary?: boolean;
}

export interface LineCountsProps {
  counts?: LineCountsValue | null;
}

/** IDEA's per-row change size: `+N` in green and `−M` in red. */
export function LineCounts({ counts }: LineCountsProps) {
  if (counts === undefined || counts === null) return null;
  if (counts.binary === true) {
    return (
      <span
        className='dsh-editor-line-counts dsh-editor-line-counts-binary'
        style={styles.lineCountBinary}
        title='binary'>
        bin
      </span>
    );
  }
  const className =
    counts.additions === 0 && counts.deletions > 0
      ? 'dsh-editor-line-counts dsh-editor-line-counts-deletions-only'
      : 'dsh-editor-line-counts';
  return (
    <span
      className={className}
      style={styles.lineCounts}
      title={`+${counts.additions} −${counts.deletions}`}>
      <span
        className='dsh-editor-line-count-add'
        style={styles.lineCountAdd}>
        +{counts.additions}
      </span>
      <span
        className='dsh-editor-line-count-del'
        style={styles.lineCountDel}>
        −{counts.deletions}
      </span>
    </span>
  );
}
