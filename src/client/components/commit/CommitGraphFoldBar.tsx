import React from 'react';
import { styles } from '../../ui/styles';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface CommitGraphFoldBarProps {
  t: Translate;
  folded: boolean;
  rowCount: number;
  onToggleFolded: () => void;
}

function CommitGraphFoldBar({ t, folded, rowCount, onToggleFolded }: CommitGraphFoldBarProps) {
  const countLabel =
    rowCount === 1
      ? t('editor.graphFoldedCountOne')
      : t('editor.graphFoldedCount', {
          count: rowCount,
        });
  return (
    <div style={styles.graphFoldRow}>
      <button
        type='button'
        className='dsh-editor-graph-fold-toggle'
        style={{
          ...styles.graphFoldToggle,
          ...(folded ? styles.graphFoldToggleOn : null),
        }}
        aria-pressed={folded}
        aria-describedby={folded ? 'dsh-editor-graph-fold-count' : undefined}
        title={t('editor.graphFoldChains')}
        onClick={onToggleFolded}>
        {t('editor.graphFoldChains')}
      </button>
      {folded ? (
        <span
          id='dsh-editor-graph-fold-count'
          style={styles.graphFoldCount}>
          {countLabel}
        </span>
      ) : null}
    </div>
  );
}

export { CommitGraphFoldBar };
