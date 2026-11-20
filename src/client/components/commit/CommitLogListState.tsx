import React from 'react';
import { styles } from '../../ui/styles';

type Translate = (key: string, params?: Record<string, unknown>) => string;

interface CommitLogListStateProps {
  section: 'status' | 'footer';
  t: Translate;
  loading: boolean;
  logFailure: string | null;
  graphMode: boolean;
  commitCount: number;
  visibleCount: number;
  exhausted: boolean;
  onRetry?: () => void;
}

function CommitLogListState({
  section,
  t,
  loading,
  logFailure,
  graphMode,
  commitCount,
  visibleCount,
  exhausted,
  onRetry,
}: CommitLogListStateProps) {
  const retryError =
    logFailure === null ? null : (
      <div
        style={styles.logErrorRow}
        role='alert'
        aria-busy={loading ? true : undefined}>
        <span style={styles.logErrorText}>
          {t('editor.logFailed', {
            message: logFailure,
          })}
        </span>
        <button
          type='button'
          className='dsh-editor-log-retry'
          style={styles.conflictAction}
          aria-disabled={loading ? true : undefined}
          onClick={() => {
            if (!loading) onRetry?.();
          }}>
          {loading ? t('editor.loading') : t('editor.logRetry')}
        </button>
      </div>
    );
  return (
    <>
      {section === 'status' && !graphMode && loading && logFailure === null ? (
        <div
          style={styles.treeMessage}
          role='status'
          aria-live='polite'
          aria-atomic='true'
          aria-busy={loading ? true : undefined}
          data-dsh-log-state='loading'>
          {t('editor.loading')}
        </div>
      ) : null}
      {section === 'status' && logFailure !== null && (graphMode || commitCount === 0) ? retryError : null}
      {section === 'status' && !loading && commitCount > 0 && visibleCount === 0 ? (
        <div
          style={styles.treeMessage}
          role='status'
          aria-live='polite'
          aria-atomic='true'
          data-dsh-log-state='no-matches'>
          {t('editor.noMatches')}
        </div>
      ) : null}
      {section === 'status' && !graphMode && commitCount === 0 && !loading && logFailure === null ? (
        <div
          style={styles.treeMessage}
          role='status'
          aria-live='polite'
          aria-atomic='true'
          data-dsh-log-state='no-commits'>
          {t('editor.noCommits')}
        </div>
      ) : null}
      {section === 'footer' && logFailure !== null && !graphMode && commitCount > 0 ? retryError : null}
      {section === 'footer' && exhausted && visibleCount > 0 && logFailure === null ? (
        <div style={styles.treeMessage}>{t('editor.logEnd')}</div>
      ) : null}
    </>
  );
}

export { CommitLogListState };
