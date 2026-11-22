import React from 'react';
import { styles } from '../../ui/styles';
import { EntryIcon } from '../ui/EntryIcon';
import { GitStatusBadge } from '../ui/GitStatusBadge';
import { basename } from '../../editor-core';
import { dirname } from '../editor/editor-path-model';
import { fuzzyScore } from '../../find-tool';
import { callFs, searchTextFailureMessage } from '../../editor-core';
import type { SearchDirectoryRules } from '../../commit';
import { badgeFor } from '../ui/git-change-model';
import { trapDialogFocus } from '../ui/focus-trap';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface QuickOpenState {
  query: string;
  index: number;
  activePath?: string | null;
  files?: string[];
  truncated?: boolean;
  loading?: boolean;
  error?: string | null;
}

interface QuickOpenFileListResponse {
  files?: string[];
  truncated?: boolean;
}

interface QuickOpenSearchEntriesResponse {
  entries?: Array<{ path?: string; kind?: string }>;
  truncated?: boolean;
}

interface UseQuickOpenFileCandidatesOptions {
  setQuickOpen: React.Dispatch<React.SetStateAction<QuickOpenState | null>>;
  searchDirectoryRules: SearchDirectoryRules;
  t: Translate;
}

export interface QuickOpenFileCandidates {
  requestFiles: () => void;
  updateQuery: (query: string) => void;
  abortRequests: () => void;
}

/** Merge query hits outside the bounded base list without duplicating paths. */
export function mergeQuickOpenFiles(base: string[], extra: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const path of [...base, ...extra]) {
    if (path === '' || seen.has(path)) continue;
    seen.add(path);
    merged.push(path);
  }
  return merged;
}

/** Whether a non-empty Quick Open query needs the Host fallback. */
export function quickOpenNeedsHostQuery(query: string, truncated: boolean): boolean {
  return truncated && typeof query === 'string' && query.trim() !== '';
}

/** Preserve the selected file identity while asynchronous candidates merge. */
export function quickOpenActiveIndex(
  matches: Array<{ path: string }>,
  requestedIndex: number,
  activePath?: string | null,
): number {
  if (typeof activePath === 'string' && activePath !== '') {
    const preserved = matches.findIndex((entry) => entry.path === activePath);
    if (preserved >= 0) return preserved;
  }
  if (matches.length === 0) return 0;
  return Math.min(matches.length - 1, Math.max(0, Math.trunc(Number(requestedIndex) || 0)));
}

/**
 * Own Quick Open's bounded base list and its persisted-index query fallback.
 * The palette keeps filtering locally, while a truncated list can fetch paths
 * beyond the initial file budget for the current query.
 */
export function useQuickOpenFileCandidates({
  setQuickOpen,
  searchDirectoryRules,
  t,
}: UseQuickOpenFileCandidatesOptions): QuickOpenFileCandidates {
  const filesRef = React.useRef<string[]>([]);
  const truncatedRef = React.useRef(false);
  const remoteFilesRef = React.useRef<string[]>([]);
  const currentQueryRef = React.useRef('');
  const requestRef = React.useRef(0);
  const abortRef = React.useRef<AbortController | null>(null);
  const queryRequestRef = React.useRef(0);
  const queryAbortRef = React.useRef<AbortController | null>(null);
  const queryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelPendingQuery = React.useCallback(() => {
    queryRequestRef.current += 1;
    queryAbortRef.current?.abort();
    queryAbortRef.current = null;
    if (queryTimerRef.current !== null) {
      globalThis.clearTimeout(queryTimerRef.current);
      queryTimerRef.current = null;
    }
  }, []);
  const restoreBaseFiles = React.useCallback(() => {
    remoteFilesRef.current = [];
    setQuickOpen((current) => (current === null ? current : { ...current, files: filesRef.current }));
  }, [setQuickOpen]);
  const requestHostQuery = React.useCallback(
    (query: string) => {
      const normalizedQuery = query.trim();
      if (!quickOpenNeedsHostQuery(normalizedQuery, truncatedRef.current)) {
        restoreBaseFiles();
        return;
      }
      const requestId = ++queryRequestRef.current;
      queryAbortRef.current?.abort();
      const queryAbort = new AbortController();
      queryAbortRef.current = queryAbort;
      void callFs<QuickOpenSearchEntriesResponse>(
        {
          op: 'search',
          query: normalizedQuery,
          showHidden: true,
          showExcluded: false,
          sort: 'name',
          foldersFirst: false,
          respectGitIgnore: true,
          searchDirectoryRules,
          matchPath: true,
          filesOnly: true,
        },
        { signal: queryAbort.signal },
      )
        .then((value) => {
          if (queryRequestRef.current !== requestId || currentQueryRef.current.trim() !== normalizedQuery) return;
          const remoteFiles = Array.isArray(value?.entries)
            ? value.entries
                .filter(
                  (entry): entry is { path: string; kind?: string } =>
                    entry?.kind === 'file' && typeof entry.path === 'string' && entry.path !== '',
                )
                .map((entry) => entry.path)
            : [];
          remoteFilesRef.current = remoteFiles;
          const files = mergeQuickOpenFiles(filesRef.current, remoteFiles);
          setQuickOpen((current) =>
            current === null || current.query.trim() !== normalizedQuery
              ? current
              : {
                  ...current,
                  files,
                  truncated: value?.truncated === true,
                  loading: false,
                  error: null,
                },
          );
        })
        .catch((failure) => {
          if (failure?.name === 'AbortError' || failure?.name === 'CanceledError') return;
          if (queryRequestRef.current !== requestId || currentQueryRef.current.trim() !== normalizedQuery) return;
          setQuickOpen((current) =>
            current === null || current.query.trim() !== normalizedQuery
              ? current
              : { ...current, error: searchTextFailureMessage(failure, t) },
          );
        })
        .finally(() => {
          if (queryAbortRef.current === queryAbort) queryAbortRef.current = null;
        });
    },
    [restoreBaseFiles, searchDirectoryRules, setQuickOpen, t],
  );
  const scheduleHostQuery = React.useCallback(
    (query: string) => {
      cancelPendingQuery();
      if (!quickOpenNeedsHostQuery(query, truncatedRef.current)) {
        restoreBaseFiles();
        return;
      }
      queryTimerRef.current = globalThis.setTimeout(() => {
        queryTimerRef.current = null;
        requestHostQuery(query);
      }, 180);
    },
    [cancelPendingQuery, requestHostQuery, restoreBaseFiles],
  );
  const requestFiles = React.useCallback(() => {
    const requestId = ++requestRef.current;
    abortRef.current?.abort();
    cancelPendingQuery();
    currentQueryRef.current = '';
    setQuickOpen((current) => (current === null ? current : { ...current, loading: true, error: null }));
    const filesAbort = new AbortController();
    abortRef.current = filesAbort;
    void callFs<QuickOpenFileListResponse>(
      { op: 'files', respectGitIgnore: true, searchDirectoryRules, searchIndex: true },
      { signal: filesAbort.signal },
    )
      .then((value) => {
        if (requestRef.current !== requestId) return;
        const files = Array.isArray(value?.files)
          ? value.files.filter((path): path is string => typeof path === 'string' && path !== '')
          : [];
        filesRef.current = files;
        truncatedRef.current = value?.truncated === true;
        remoteFilesRef.current = [];
        setQuickOpen((current) =>
          current === null
            ? current
            : {
                ...current,
                files,
                truncated: value?.truncated === true,
                loading: false,
                error: null,
              },
        );
        if (currentQueryRef.current.trim() !== '') scheduleHostQuery(currentQueryRef.current);
      })
      .catch((failure) => {
        if (failure?.name === 'AbortError' || failure?.name === 'CanceledError') return;
        if (requestRef.current !== requestId) return;
        setQuickOpen((current) =>
          current === null
            ? current
            : {
                ...current,
                files: [],
                truncated: false,
                loading: false,
                error: searchTextFailureMessage(failure, t),
              },
        );
      })
      .finally(() => {
        if (abortRef.current === filesAbort) abortRef.current = null;
      });
  }, [cancelPendingQuery, scheduleHostQuery, searchDirectoryRules, setQuickOpen, t]);
  const updateQuery = React.useCallback(
    (query: string) => {
      currentQueryRef.current = query;
      setQuickOpen((current) => (current === null ? current : { ...current, query, index: 0, activePath: null }));
      scheduleHostQuery(query);
    },
    [scheduleHostQuery, setQuickOpen],
  );
  const abortRequests = React.useCallback(() => {
    requestRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    cancelPendingQuery();
  }, [cancelPendingQuery]);
  React.useEffect(
    () => () => {
      cancelPendingQuery();
    },
    [cancelPendingQuery],
  );
  return React.useMemo(
    () => ({ requestFiles, updateQuery, abortRequests }),
    [abortRequests, requestFiles, updateQuery],
  );
}

/** Own IDEA's global Go to File shortcut and always invoke the latest opener. */
export function useQuickOpenShortcut(openQuickOpen: () => void): void {
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || !event.shiftKey || event.key.toLowerCase() !== 'o') return;
      const host = document.querySelector<HTMLElement>('[data-dsh-editor-workspace]');
      if (host === null || !document.body.contains(host)) return;
      event.preventDefault();
      openQuickOpen();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [openQuickOpen]);
}

function quickOpenOptionId(path: string): string {
  return `dsh-editor-quick-open-option-${encodeURIComponent(path)}`;
}

export interface QuickOpenProps {
  t: Translate;
  files: string[];
  truncated?: boolean;
  changes: Map<string, string>;
  query: string;
  loading: boolean;
  error?: string | null;
  index: number;
  activePath?: string | null;
  mode?: 'files' | 'recent';
  onQuery: (query: string) => void;
  onMove: (direction: number, count: number, activePath?: string) => void;
  onOpen: (path: string) => void;
  onClose: () => void;
}

function QuickOpen({
  t,
  files,
  truncated = false,
  changes,
  query,
  loading,
  error = null,
  index,
  activePath = null,
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
  const activeIndex = quickOpenActiveIndex(matches, index, activePath);
  React.useEffect(() => {
    listRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);
  const trapQuickOpenFocus = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const root = event.currentTarget instanceof Element ? event.currentTarget : null;
    trapDialogFocus(event, root, { focusWhenOutside: true });
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
          aria-activedescendant={
            matches[activeIndex] === undefined ? undefined : quickOpenOptionId(matches[activeIndex].path)
          }
          placeholder={recent ? t('editor.recentFilesPlaceholder') : t('editor.gotoFilePlaceholder')}
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing === true) return;
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              onMove(1, matches.length, matches[matches.length === 0 ? 0 : (activeIndex + 1) % matches.length]?.path);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              onMove(
                -1,
                matches.length,
                matches[matches.length === 0 ? 0 : (activeIndex - 1 + matches.length) % matches.length]?.path,
              );
            } else if (event.key === 'Enter') {
              event.preventDefault();
              if (matches[activeIndex] !== undefined) onOpen(matches[activeIndex].path);
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
                ref={position === activeIndex ? listRef : null}
                className='dsh-editor-palette-row'
                role='option'
                aria-selected={position === activeIndex}
                style={{ ...styles.paletteRow, ...(position === activeIndex ? styles.paletteRowActive : null) }}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onOpen(entry.path);
                }}>
                <EntryIcon
                  entry={{ path: entry.path, kind: 'file' }}
                  expanded={false}
                />
                <GitStatusBadge
                  selected={position === activeIndex}
                  info={badge}
                />
                <span
                  className='dsh-editor-search-result-name'
                  style={styles.paletteName}>
                  {basename(entry.path)}
                </span>
                <span
                  className='dsh-editor-search-result-detail'
                  style={styles.paletteDir}>
                  {dirname(entry.path)}
                </span>
              </div>
            );
          })}
          {truncated ? (
            <div
              style={styles.treeMessage}
              role='status'
              aria-live='polite'>
              {t('editor.searchFilesTruncated')}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export { QuickOpen };
