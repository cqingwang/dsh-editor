import React from 'react';
import { styles } from '../../ui/styles';
import { dirname } from '../editor/editor-path-model';
import { gitStatusInfo } from '../ui/git-status-model';
import { basename } from '../../editor-core';
import { formatCommitDate } from '../../find-tool';
import type { CommitLogDetail } from './CommitLog';

type Translate = (key: string, params?: Record<string, unknown>) => string;

interface CommitLogDetailPaneProps {
  t: Translate;
  detail: CommitLogDetail | null;
  historyPath: string | null;
  onClearHistory?: () => void;
  localFileAvailability: Map<string, boolean>;
  detailScrollRef: React.RefObject<HTMLDivElement | null>;
  onShowCommitDiff?: (target: { hash: string; path: string }) => void;
  onEditSource?: (path: string) => void;
  onFileMenu?: (payload: {
    path: string;
    hash: string;
    localExists: boolean;
    localDirExists: boolean;
    x: number;
    y: number;
  }) => void;
}

function CommitLogDetailPane({
  t,
  detail,
  historyPath,
  onClearHistory,
  localFileAvailability,
  detailScrollRef,
  onShowCommitDiff,
  onEditSource,
  onFileMenu,
}: CommitLogDetailPaneProps) {
  return (
    <div style={styles.commitLogDetail}>
      <div style={styles.logToolbar}>
        <span style={styles.panelTitle}>{t('editor.commitDetails')}</span>
        {historyPath === null ? null : (
          <span
            style={styles.historyChip}
            title={historyPath}>
            {`${t('editor.fileHistory')}: ${basename(historyPath)}`}
            <button
              type='button'
              style={styles.historyChipShowAll}
              title={t('editor.historyShowAll')}
              onClick={() => onClearHistory?.()}>
              {t('editor.historyShowAll')}
            </button>
            <button
              type='button'
              style={styles.historyChipClear}
              aria-label={t('editor.clearHistory')}
              title={t('editor.clearHistory')}
              onClick={() => onClearHistory?.()}>
              ×
            </button>
          </span>
        )}
      </div>
      <div
        ref={detailScrollRef}
        style={styles.commitScroll}
        className='dsh-editor-tool-scroll'
        tabIndex={0}
        role='region'
        aria-label={t('editor.commitDetails')}>
        {detail === null ? (
          <div style={styles.treeMessage}>{t('editor.selectCommit')}</div>
        ) : (
          <div style={styles.logDetail}>
            <div style={styles.logSubject}>{detail.subject}</div>
            <div style={styles.logMeta}>{`${detail.author} · ${formatCommitDate(detail.date)}`}</div>
            {detail.body === '' ? null : <pre style={styles.logBody}>{detail.body}</pre>}
            <div style={styles.logFiles}>
              {detail.files.map((file) => {
                const localExists = localFileAvailability.get(file.path) !== false;
                const localDirExists = localFileAvailability.get(dirname(file.path)) !== false;
                return (
                  <div
                    key={`${file.status}:${file.path}`}
                    style={styles.logFileRow}
                    className='dsh-editor-commit-row'
                    tabIndex={0}
                    title={`${file.path} — ${t('editor.openAtRevision')}`}
                    onClick={() =>
                      onShowCommitDiff?.({
                        hash: detail.hash,
                        path: file.path,
                      })
                    }
                    onDoubleClick={() => {
                      if (localExists) onEditSource?.(file.path);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'F4' && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
                        if (!localExists) return;
                        event.preventDefault();
                        event.stopPropagation();
                        onEditSource?.(file.path);
                        return;
                      }
                      if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
                      event.preventDefault();
                      event.stopPropagation();
                      event.currentTarget.focus?.();
                      const rect = event.currentTarget.getBoundingClientRect();
                      onFileMenu?.({
                        path: file.path,
                        hash: detail.hash,
                        localExists,
                        localDirExists,
                        x: rect.left + 12,
                        y: rect.bottom,
                      });
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      event.currentTarget.focus?.();
                      onFileMenu?.({
                        path: file.path,
                        hash: detail.hash,
                        localExists,
                        localDirExists,
                        x: event.clientX,
                        y: event.clientY,
                      });
                    }}>
                    <span
                      style={{
                        ...styles.statusBadge,
                        color: gitStatusInfo(file.status)?.color ?? 'inherit',
                      }}>
                      {file.status}
                    </span>
                    <span style={styles.logFilePath}>{file.path}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { CommitLogDetailPane };
