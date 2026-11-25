import React from 'react';
import { styles } from '../../ui/styles';
import { Icon } from '../ui/Icon';
import type { CommitGraphEntryData, CommitGraphMenuPayload } from './CommitGraph';
import { formatCommitDate } from '../../find-tool';
import { commitLogOptionId } from './commit-log-view-model';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface CommitGraphRun {
  hashes: string[];
  first: CommitGraphEntryData;
}

export interface CommitGraphRowProps {
  t: Translate;
  entry: CommitGraphEntryData;
  run: CommitGraphRun;
  lane: number;
  active: boolean;
  hovered?: boolean;
  isMerge: boolean;
  isHead: boolean;
  rowRef?: React.Ref<HTMLDivElement>;
  selectionHashes: string[];
  onShow?: (hash: string) => void;
  onRowClick?: (
    entry: CommitGraphEntryData,
    event: React.MouseEvent<HTMLElement>,
    options?: Record<string, unknown>,
  ) => void;
  onSelect?: (hash: string | null) => void;
  onContextMenu?: (payload: CommitGraphMenuPayload) => void;
  onPickRef?: (ref: string) => void;
}

function CommitGraphRow({
  t,
  entry,
  run,
  lane,
  active,
  hovered = false,
  isMerge,
  isHead,
  rowRef,
  selectionHashes,
  onShow,
  onRowClick,
  onSelect,
  onContextMenu,
  onPickRef,
}: CommitGraphRowProps) {
  const collapsed = run.hashes.length > 1;
  const foldedCommitCount = run.hashes.length - 1;
  const foldedCommitLabel =
    foldedCommitCount === 1
      ? t('editor.graphFoldedRunOne')
      : t('editor.graphFoldedRun', {
          count: foldedCommitCount,
        });
  return (
    <div
      ref={rowRef}
      className='dsh-editor-commit-row dsh-editor-graph-row'
      id={commitLogOptionId(entry.hash)}
      role='option'
      data-dsh-graph-hash={entry.hash}
      aria-haspopup='menu'
      aria-selected={active}
      style={{
        ...styles.commitGraphRow,
        ...(active || hovered ? styles.commitGraphRowActive : null),
      }}
      title={entry.hash}
      onClick={(event) => {
        if (onRowClick !== undefined) onRowClick(entry, event);
        else onShow?.(entry.hash);
      }}
      onMouseEnter={() => onSelect?.(entry.hash)}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const contextSelection = selectionHashes.includes(entry.hash) ? selectionHashes : [entry.hash];
        if (onRowClick !== undefined && !selectionHashes.includes(entry.hash)) {
          onRowClick(entry, event, {
            contextMenu: true,
          });
        } else {
          onShow?.(entry.hash);
        }
        onContextMenu?.({
          commit: entry,
          selectionHashes: contextSelection,
          x: event.clientX,
          y: event.clientY,
        });
      }}>
      <span
        style={{
          ...styles.commitGraphLane,
          width: Math.max(12, (lane + 1) * 10),
        }}>
        {
          /* Only the columns up to this commit's lane: the rest would be empty gutters
             that push the subject off a narrow tool window. */
          Array.from(
            {
              length: lane + 1,
            },
            (_, index) => (
              <span
                key={index}
                style={index === lane ? styles.commitGraphTrackActive : styles.commitGraphTrack}
              />
            ),
          )
        }
        <span style={styles.commitGraphNode}>
          <Icon
            name={isMerge ? 'graphMerge' : 'graphNode'}
            size={11}
          />
        </span>
      </span>
      <span style={styles.logHash}>{entry.hash.slice(0, 7)}</span>
      <span
        style={{
          minWidth: 0,
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}>
        <span style={styles.logSubject}>{entry.subject}</span>
        {
          /* A folded row must say how many commits it stands for; otherwise the
             list looks like it lost history. */
          collapsed ? <span style={styles.graphFoldBadge}>{foldedCommitLabel}</span> : null
        }
        <span
          style={{
            display: 'flex',
            gap: 4,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
          {isHead ? (
            <span
              style={styles.commitGraphHead}
              key='HEAD'>
              HEAD
            </span>
          ) : null}
          {
            /* IDEA's graph filters by clicking a ref badge; the badge names the
               scope it applies, so clicking `main` shows main's history. */
            (entry.refs ?? []).map((ref) => (
              <button
                key={ref}
                type='button'
                style={styles.commitGraphRef}
                className='dsh-editor-graph-ref'
                aria-label={t('editor.graphFilterByRef', {
                  ref,
                })}
                title={t('editor.graphFilterByRef', {
                  ref,
                })}
                onClick={(event) => {
                  /* The row underneath opens the commit; the badge must not. */
                  event.stopPropagation();
                  onPickRef?.(ref);
                }}>
                {ref}
              </button>
            ))
          }
          <span style={styles.logMeta}>{`${entry.author} · ${formatCommitDate(entry.date)}`}</span>
        </span>
      </span>
    </div>
  );
}

export { CommitGraphRow };
