import React from 'react';
import { styles } from '../../ui/styles';
import { EntryIcon } from '../ui/EntryIcon';
import { GitStatusBadge } from '../ui/GitStatusBadge';
import { basename } from '../../editor-core';
import { dirname } from '../editor/editor-path-model';
import { fuzzyScore } from '../../find-tool';
import { badgeFor } from '../ui/git-change-model';
import { searchEverywhereNextFocusIndex } from '../../foundation';

type Translate = (key: string, params?: Record<string, unknown>) => string;

function quickOpenOptionId(path: string): string {
  return `dsh-editor-quick-open-option-${encodeURIComponent(path)}`;
}

export interface QuickOpenProps {
  t: Translate;
  files: string[];
  changes: Map<string, string>;
  query: string;
  loading: boolean;
  error?: string | null;
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
  error = null,
  index,
  mode = 'files',
  onQuery,
  onMove,
  onOpen,
  onClose,
}: QuickOpenProps) {
  const listRef = React.useRef(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const QUICK_OPEN_LISTBOX_ID = 'dsh-editor-quick-open-listbox';
  React.useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, []);
  React.useEffect(() => {
    listRef.current?.scrollIntoView({ block: 'nearest' });
  }, [index]);
  const recent = mode === 'recent';
  const matches = React.useMemo(
    () =>
      (recent
        ? /* Recent Files keeps the order it is given: the list IS "most recent
     first", so sorting by score would destroy the only thing it says.
     A query still filters, but never reorders. */ files
            .map((path) => ({ path, score: query === '' ? 0 : fuzzyScore(path, query) }))
            .filter((entry) => entry.score >= 0)
        : files
            .map((path) => ({ path, score: fuzzyScore(path, query) }))
            .filter((entry) => entry.score >= 0)
            .sort((left, right) => right.score - left.score || left.path.length - right.path.length)
      ).slice(0, 60),
    [files, query, recent],
  );
  const trapQuickOpenFocus = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Tab') return;
    const root = event.currentTarget instanceof Element ? event.currentTarget : null;
    if (root === null) return;
    const selector =
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
      'textarea:not([disabled]), [tabindex="0"]:not([disabled])';
    const focusables = [...new Set(root.querySelectorAll<HTMLElement>(selector))].filter(
      (element) => element.tabIndex >= 0 && (element.getClientRects?.().length ?? 0) > 0,
    );
    if (focusables.length === 0) return;
    const currentElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const currentIndex = currentElement === null ? -1 : focusables.indexOf(currentElement);
    const nextIndex = searchEverywhereNextFocusIndex(focusables.length, currentIndex, event.shiftKey === true);
    if (nextIndex === null) return;
    event.preventDefault();
    event.stopPropagation();
    focusables[nextIndex]?.focus?.();
  };
  return (
    <div
      style={styles.paletteBackdrop}
      data-dsh-quick-open=''
      onMouseDown={onClose}>
      <div
        style={styles.palette}
        role='dialog'
        aria-modal='true'
        aria-label={recent ? t('editor.recentFiles') : t('editor.gotoFile')}
        onKeyDown={trapQuickOpenFocus}
        onMouseDown={(event) => event.stopPropagation()}>
        <input
          ref={inputRef}
          style={styles.paletteInput}
          autoFocus={true}
          role='combobox'
          aria-autocomplete='list'
          aria-expanded={matches.length > 0}
          aria-controls={QUICK_OPEN_LISTBOX_ID}
          aria-activedescendant={matches[index] === undefined ? undefined : quickOpenOptionId(matches[index].path)}
          placeholder={recent ? t('editor.recentFilesPlaceholder') : t('editor.gotoFilePlaceholder')}
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing === true) return;
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
        <div
          id={QUICK_OPEN_LISTBOX_ID}
          style={styles.paletteList}
          role='listbox'
          aria-busy={loading ? true : undefined}
          aria-label={recent ? t('editor.recentFiles') : t('editor.gotoFile')}>
          {loading && files.length === 0 ? (
            <div
              style={styles.treeMessage}
              role='status'>
              {t('editor.loading')}
            </div>
          ) : null}
          {error === null ? null : (
            <div
              style={styles.searchEverywhereError}
              role='alert'>
              {error}
            </div>
          )}
          {
            /* Recent Files with nothing in it is not "no matches": the list is
           simply empty because nothing has been opened in this workspace. */
            error === null && matches.length === 0 && !loading ? (
              <div
                style={styles.treeMessage}
                role='status'>
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
                id={quickOpenOptionId(entry.path)}
                ref={position === index ? listRef : null}
                className='dsh-editor-palette-row'
                role='option'
                aria-selected={position === index}
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
                  selected={position === index}
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
