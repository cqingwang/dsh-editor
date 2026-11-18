import React from 'react';
import { styles } from '../../ui/styles';
import { commitSearchScore, type CommitSearchEntry } from './commit-search-model';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface RevisionPickerState {
  commits?: CommitSearchEntry[];
  query?: string;
  index?: number;
  loading?: boolean;
}

export interface RevisionPickerProps {
  t: Translate;
  state: RevisionPickerState;
  onQuery: (value: string) => void;
  onMove: (direction: -1 | 1, count: number) => void;
  onPick: (hash: string) => void;
  onClose: () => void;
}

/** IDEA's searchable Compare with Revision commit picker. */
function RevisionPicker({ t, state, onQuery, onMove, onPick, onClose }: RevisionPickerProps) {
  const commits = state.commits ?? [];
  const query = state.query ?? '';
  const needle = query.trim().toLowerCase();
  const visible = needle === '' ? commits : commits.filter((commit) => commitSearchScore(commit, needle) >= 0);
  const index = Math.max(0, Math.min(state.index ?? 0, Math.max(0, visible.length - 1)));
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const node = listRef.current;
    const active = node?.querySelector<HTMLElement>('[data-dsh-active="true"]');
    active?.scrollIntoView?.({ block: 'nearest' });
  }, [index, needle, visible.length]);

  return (
    <div
      style={styles.paletteBackdrop}
      onMouseDown={onClose}>
      <div
        style={styles.palette}
        role='dialog'
        aria-label={t('editor.compareWithRevision')}
        onMouseDown={(event) => event.stopPropagation()}>
        <input
          style={styles.paletteInput}
          autoFocus={true}
          placeholder={t('editor.compareRevisionPlaceholder')}
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              onMove(1, visible.length);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              onMove(-1, visible.length);
            } else if (event.key === 'Enter') {
              event.preventDefault();
              if (visible[index] !== undefined) onPick(visible[index].hash ?? '');
            } else if (event.key === 'Escape') {
              event.preventDefault();
              onClose();
            }
          }}
        />
        <div
          ref={listRef}
          style={styles.paletteList}>
          {state.loading === true && commits.length === 0 ? (
            <div style={styles.treeMessage}>{t('editor.loading')}</div>
          ) : null}
          {state.loading !== true && visible.length === 0 ? (
            <div style={styles.treeMessage}>{t('editor.noMatches')}</div>
          ) : null}
          {visible.map((commit, position) => (
            <div
              key={commit.hash}
              data-dsh-active={position === index ? 'true' : 'false'}
              className='dsh-editor-palette-row'
              style={{
                ...styles.paletteRow,
                ...(position === index ? styles.paletteRowActive : null),
              }}
              onMouseDown={(event) => {
                event.preventDefault();
                onPick(commit.hash ?? '');
              }}>
              <span style={styles.logHash}>{commit.hash?.slice(0, 7)}</span>
              <span style={styles.paletteName}>{commit.subject}</span>
              <span style={styles.paletteDir}>{commit.author}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { RevisionPicker };
