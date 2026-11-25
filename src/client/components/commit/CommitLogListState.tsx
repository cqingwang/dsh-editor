import React from 'react';
import { styles } from '../../ui/styles';
import { commitLogLoadMorePlacement } from './commit-log-view-model';

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
  searchMode?: boolean;
  searchTruncated?: boolean;
  onLoadMore?: () => void;
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
  searchMode = false,
  searchTruncated = false,
  onLoadMore,
  onRetry,
}: CommitLogListStateProps) {
  const loadMorePlacement = commitLogLoadMorePlacement({
    graphMode,
    loading,
    exhausted,
    failed: logFailure !== null,
    commitCount,
    visibleCount,
    searchMode,
  });
  const loadMoreButton =
    loadMorePlacement === 'none' ? null : (
      <button
        type='button'
        className='dsh-editor-log-load-more'
        style={styles.conflictAction}
        onClick={() => onLoadMore?.()}>
        {t('editor.logLoadMore')}
      </button>
    );
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
      {section === 'status' && !loading && visibleCount === 0 && (commitCount > 0 || searchMode) ? (
        <div
          style={styles.treeMessage}
          role='status'
          aria-live='polite'
          aria-atomic='true'
          data-dsh-log-state='no-matches'>
          {t('editor.noMatches')}
        </div>
      ) : null}
      {section === 'status' && loadMorePlacement === 'no-matches' ? loadMoreButton : null}
      {section === 'status' && !searchMode && !graphMode && commitCount === 0 && !loading && logFailure === null ? (
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
      {section === 'footer' && !searchMode && exhausted && visibleCount > 0 && logFailure === null ? (
        <div style={styles.treeMessage}>{t('editor.logEnd')}</div>
      ) : null}
      {section === 'footer' && searchMode && searchTruncated && visibleCount > 0 && logFailure === null ? (
        <div style={styles.treeMessage}>{t('editor.logSearchTruncated')}</div>
      ) : null}
      {section === 'footer' && loadMorePlacement === 'footer' ? loadMoreButton : null}
    </>
  );
}

export { CommitLogListState };
