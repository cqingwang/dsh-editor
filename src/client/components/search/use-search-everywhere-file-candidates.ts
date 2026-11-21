import React from 'react';

import { searchEverywhereFilesRequestState } from '../../commit';
import type { SearchDirectoryRules } from '../../commit';
import { callFs, searchTextFailureMessage } from '../../editor-core';
import type { SearchEverywhereState, SearchFile } from './SearchEverywhere';

type Translate = (key: string, params?: Record<string, unknown>) => string;

interface UseSearchEverywhereFileCandidatesOptions {
  setSearchEverywhere: React.Dispatch<React.SetStateAction<SearchEverywhereState | null>>;
  searchDirectoryRules: SearchDirectoryRules;
  t: Translate;
}

interface SearchEverywhereFileCandidates {
  filesRef: React.MutableRefObject<SearchFile[]>;
  truncatedRef: React.MutableRefObject<boolean>;
  scopeRef: React.MutableRefObject<boolean | null>;
  requestFiles: (includeNonProject: boolean, fileMask?: string) => void;
  updateFileMask: (fileMask: string, includeNonProject: boolean) => void;
  updateQuery: (query: string) => void;
  abortRequests: () => void;
  clearCache: () => void;
}

interface FileListResponse {
  files?: string[];
  truncated?: boolean;
}

interface SearchEntryResult {
  path?: string;
  kind?: string;
}

interface SearchEntriesResponse {
  entries?: SearchEntryResult[];
  truncated?: boolean;
}

/** Merge host query hits after the bounded base list without duplicating paths. */
function mergeFileCandidates(base: SearchFile[], extra: SearchFile[]): SearchFile[] {
  const seen = new Set<string>();
  const merged: SearchFile[] = [];
  for (const file of [...base, ...extra]) {
    if (file.path === '' || seen.has(file.path)) continue;
    seen.add(file.path);
    merged.push(file);
  }
  return merged;
}

/** Own Search Everywhere's bounded file list, query fallback and cancellation. */
export function useSearchEverywhereFileCandidates({
  setSearchEverywhere,
  searchDirectoryRules,
  t,
}: UseSearchEverywhereFileCandidatesOptions): SearchEverywhereFileCandidates {
  const filesRef = React.useRef<SearchFile[]>([]);
  const truncatedRef = React.useRef(false);
  const scopeRef = React.useRef<boolean | null>(null);
  const fileMaskRef = React.useRef('');
  const remoteFilesRef = React.useRef<SearchFile[]>([]);
  const currentQueryRef = React.useRef('');
  const requestRef = React.useRef(0);
  const abortRef = React.useRef<AbortController | null>(null);
  const queryRequestRef = React.useRef(0);
  const queryAbortRef = React.useRef<AbortController | null>(null);
  const fileMaskTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelPendingFileMask = React.useCallback(() => {
    if (fileMaskTimerRef.current === null) return;
    globalThis.clearTimeout(fileMaskTimerRef.current);
    fileMaskTimerRef.current = null;
  }, []);
  const cancelPendingQuery = React.useCallback(() => {
    queryRequestRef.current += 1;
    queryAbortRef.current?.abort();
    queryAbortRef.current = null;
    if (queryTimerRef.current === null) return;
    globalThis.clearTimeout(queryTimerRef.current);
    queryTimerRef.current = null;
  }, []);
  const requestHostQueryFiles = React.useCallback(
    (query: string, includeNonProject: boolean, fileMask: string) => {
      const normalizedQuery = query.trim();
      if (normalizedQuery === '' || !truncatedRef.current) {
        remoteFilesRef.current = [];
        setSearchEverywhere((current) =>
          current === null || (normalizedQuery !== '' && current.query.trim() !== normalizedQuery)
            ? current
            : { ...current, files: filesRef.current },
        );
        return;
      }
      const requestId = ++queryRequestRef.current;
      queryAbortRef.current?.abort();
      const searchAbort = new AbortController();
      queryAbortRef.current = searchAbort;
      void callFs<SearchEntriesResponse>(
        {
          op: 'search',
          query: normalizedQuery,
          showHidden: true,
          showExcluded: includeNonProject === true,
          sort: 'name',
          foldersFirst: false,
          respectGitIgnore: true,
          fileMask,
          searchDirectoryRules,
        },
        { signal: searchAbort.signal },
      )
        .then((value) => {
          if (queryRequestRef.current !== requestId || currentQueryRef.current.trim() !== normalizedQuery) return;
          const remoteFiles: SearchFile[] = Array.isArray(value?.entries)
            ? value.entries
                .filter(
                  (entry): entry is SearchEntryResult & { path: string } =>
                    entry?.kind === 'file' && typeof entry.path === 'string' && entry.path !== '',
                )
                .map((entry) => ({ path: entry.path }))
            : [];
          remoteFilesRef.current = remoteFiles;
          const files = mergeFileCandidates(filesRef.current, remoteFiles);
          setSearchEverywhere((current) =>
            current === null || current.query.trim() !== normalizedQuery
              ? current
              : { ...current, files, error: null, errorSource: null },
          );
        })
        .catch((failure) => {
          if (failure?.name === 'AbortError' || failure?.name === 'CanceledError') return;
          if (queryRequestRef.current !== requestId || currentQueryRef.current.trim() !== normalizedQuery) return;
          setSearchEverywhere((current) =>
            current === null || current.query.trim() !== normalizedQuery
              ? current
              : {
                  ...current,
                  error: searchTextFailureMessage(failure, t),
                  errorSource: 'files',
                },
          );
        })
        .finally(() => {
          if (queryAbortRef.current === searchAbort) queryAbortRef.current = null;
        });
    },
    [searchDirectoryRules, setSearchEverywhere, t],
  );
  const scheduleHostQuery = React.useCallback(
    (query: string) => {
      cancelPendingQuery();
      const normalizedQuery = query.trim();
      if (normalizedQuery === '' || !truncatedRef.current) {
        remoteFilesRef.current = [];
        setSearchEverywhere((current) =>
          current === null || (normalizedQuery !== '' && current.query.trim() !== normalizedQuery)
            ? current
            : { ...current, files: filesRef.current },
        );
        return;
      }
      queryTimerRef.current = globalThis.setTimeout(() => {
        queryTimerRef.current = null;
        requestHostQueryFiles(normalizedQuery, scopeRef.current === true, fileMaskRef.current);
      }, 180);
    },
    [cancelPendingQuery, requestHostQueryFiles, setSearchEverywhere],
  );
  const requestFiles = React.useCallback(
    (includeNonProject: boolean, fileMask = '') => {
      const requestId = ++requestRef.current;
      abortRef.current?.abort();
      cancelPendingQuery();
      setSearchEverywhere((current) => searchEverywhereFilesRequestState(current, includeNonProject));
      const searchAbort = new AbortController();
      abortRef.current = searchAbort;
      const normalizedFileMask = typeof fileMask === 'string' ? fileMask.trim() : '';
      scopeRef.current = includeNonProject === true;
      fileMaskRef.current = normalizedFileMask;
      void callFs<FileListResponse>(
        {
          op: 'files',
          includeExcluded: includeNonProject === true,
          respectGitIgnore: true,
          fileMask: normalizedFileMask,
          searchDirectoryRules,
        },
        { signal: searchAbort.signal },
      )
        .then((value) => {
          if (requestRef.current !== requestId) return;
          const files: SearchFile[] = Array.isArray(value?.files)
            ? value.files.filter((path): path is string => typeof path === 'string').map((path) => ({ path }))
            : [];
          filesRef.current = files;
          truncatedRef.current = value?.truncated === true;
          remoteFilesRef.current = [];
          setSearchEverywhere((current) =>
            current === null || current.includeNonProject !== (includeNonProject === true)
              ? current
              : {
                  ...current,
                  files,
                  filesScope: includeNonProject === true,
                  filesTruncated: value?.truncated === true,
                  error: null,
                  errorSource: null,
                },
          );
          if (currentQueryRef.current.trim() !== '') scheduleHostQuery(currentQueryRef.current);
        })
        .catch((failure) => {
          if (failure?.name === 'AbortError' || failure?.name === 'CanceledError') return;
          if (requestRef.current !== requestId) return;
          setSearchEverywhere((current) =>
            current === null || current.includeNonProject !== (includeNonProject === true)
              ? current
              : {
                  ...current,
                  error: searchTextFailureMessage(failure, t),
                  errorSource: 'files',
                },
          );
        })
        .finally(() => {
          if (abortRef.current === searchAbort) abortRef.current = null;
        });
    },
    [cancelPendingQuery, scheduleHostQuery, searchDirectoryRules, setSearchEverywhere, t],
  );
  const updateFileMask = React.useCallback(
    (fileMask: string, includeNonProject: boolean) => {
      fileMaskRef.current = typeof fileMask === 'string' ? fileMask : '';
      remoteFilesRef.current = [];
      cancelPendingQuery();
      setSearchEverywhere((current) =>
        current === null
          ? current
          : {
              ...current,
              fileMask,
              textMatches: [],
              textRevision: (current.textRevision ?? 0) + 1,
              index: 0,
              error: null,
            },
      );
      cancelPendingFileMask();
      fileMaskTimerRef.current = globalThis.setTimeout(() => {
        fileMaskTimerRef.current = null;
        requestFiles(includeNonProject, fileMask);
      }, 180);
    },
    [cancelPendingFileMask, cancelPendingQuery, requestFiles, setSearchEverywhere],
  );
  const updateQuery = React.useCallback(
    (query: string) => {
      currentQueryRef.current = query;
      setSearchEverywhere((current) => (current === null ? current : { ...current, query, index: 0 }));
      scheduleHostQuery(query);
    },
    [scheduleHostQuery, setSearchEverywhere],
  );
  const abortRequests = React.useCallback(() => {
    requestRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    cancelPendingFileMask();
    cancelPendingQuery();
  }, [cancelPendingFileMask, cancelPendingQuery]);
  const clearCache = React.useCallback(() => {
    filesRef.current = [];
    truncatedRef.current = false;
    scopeRef.current = null;
    fileMaskRef.current = '';
    remoteFilesRef.current = [];
    currentQueryRef.current = '';
  }, []);
  React.useEffect(
    () => () => {
      cancelPendingFileMask();
      cancelPendingQuery();
    },
    [cancelPendingFileMask, cancelPendingQuery],
  );
  return {
    filesRef,
    truncatedRef,
    scopeRef,
    requestFiles,
    updateFileMask,
    updateQuery,
    abortRequests,
    clearCache,
  };
}
