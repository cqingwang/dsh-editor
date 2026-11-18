import React from 'react';
import { styles } from '../../ui/styles';
import { EntryIcon } from '../ui/EntryIcon';
import { GitStatusBadge } from '../ui/GitStatusBadge';
import { basename } from '../../editor-core';
import { dirname } from '../editor/editor-path-model';
import { fuzzyScore } from '../../find-tool';
import { badgeFor } from '../ui/git-change-model';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface QuickOpenProps {
  t: Translate;
  files: string[];
  changes: Map<string, string>;
  query: string;
  loading: boolean;
  index: number;
  mode?: 'files' | 'recent';
  onQuery: (query: string) => void;
  onMove: (direction: number, count: number) => void;
  onOpen: (path: string) => void;
  onClose: () => void;
}

function QuickOpen({
  t,
  files,
  changes,
  query,
  loading,
  index,
  mode = 'files',
  onQuery,
  onMove,
  onOpen,
  onClose,
}: QuickOpenProps) {
  const listRef = React.useRef(null);
  React.useEffect(() => {
    listRef.current?.scrollIntoView({ block: 'nearest' });
  }, [index]);
  const recent = mode === 'recent';
  const matches = (
    recent
      ? /* Recent Files keeps the order it is given: the list IS "most recent
     first", so sorting by score would destroy the only thing it says.
     A query still filters, but never reorders. */ files
          .map((path) => ({ path, score: query === '' ? 0 : fuzzyScore(path, query) }))
          .filter((entry) => entry.score >= 0)
      : files
          .map((path) => ({ path, score: fuzzyScore(path, query) }))
          .filter((entry) => entry.score >= 0)
          .sort((left, right) => right.score - left.score || left.path.length - right.path.length)
  ).slice(0, 60);
  return (
    <div
      style={styles.paletteBackdrop}
      onMouseDown={onClose}>
      <div
        style={styles.palette}
        role='dialog'
        aria-label={recent ? t('editor.recentFiles') : t('editor.gotoFile')}
        onMouseDown={(event) => event.stopPropagation()}>
        <input
          style={styles.paletteInput}
          autoFocus={true}
          placeholder={recent ? t('editor.recentFilesPlaceholder') : t('editor.gotoFilePlaceholder')}
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              onMove(1, matches.length);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              onMove(-1, matches.length);
            } else if (event.key === 'Enter') {
              event.preventDefault();
              if (matches[index] !== undefined) onOpen(matches[index].path);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              onClose();
            }
          }}
        />
        <div style={styles.paletteList}>
          {loading && files.length === 0 ? <div style={styles.treeMessage}>{t('editor.loading')}</div> : null}
          {
            /* Recent Files with nothing in it is not "no matches": the list is
           simply empty because nothing has been opened in this workspace. */
            matches.length === 0 && !loading ? (
              <div style={styles.treeMessage}>
                {recent && query === '' ? t('editor.recentEmpty') : t('editor.noMatches')}
              </div>
            ) : null
          }
          {matches.map((entry, position) => {
            /* Declared per row so the badge reads from the live status map. */
            const badge = badgeFor(entry.path, changes);
            return (
              <div
                key={entry.path}
                ref={position === index ? listRef : null}
                className='dsh-editor-palette-row'
                style={{ ...styles.paletteRow, ...(position === index ? styles.paletteRowActive : null) }}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onOpen(entry.path);
                }}>
                <EntryIcon
                  entry={{ path: entry.path, kind: 'file' }}
                  expanded={false}
                />
                <GitStatusBadge
                  selected={false}
                  info={badge}
                />
                <span style={styles.paletteName}>{basename(entry.path)}</span>
                <span style={styles.paletteDir}>{dirname(entry.path)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { QuickOpen };
