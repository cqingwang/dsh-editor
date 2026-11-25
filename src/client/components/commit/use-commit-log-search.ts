import React from 'react';
import { callGit } from '../../editor-core';
import type { CommitLogEntry } from './CommitLog';

interface CommitLogSearchResponse {
  commits?: CommitLogEntry[];
  truncated?: boolean;
}

export interface CommitLogSearchController {
  query: string;
  setQuery: (value: string) => void;
  results: CommitLogEntry[];
  loading: boolean;
  error: string | null;
  truncated: boolean;
  searchMode: boolean;
  retry: () => void;
  refresh: () => void;
}

/**
 * Search the complete commit history without replacing the loaded log pages.
 *
 * The query is debounced and abortable. Results are bounded by the Host, so the
 * browser never has to walk every commit or keep an unbounded result array.
 */
export function useCommitLogSearch(root: string, author: string): CommitLogSearchController {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<CommitLogEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [truncated, setTruncated] = React.useState(false);
  const requestRef = React.useRef<AbortController | null>(null);
  const generationRef = React.useRef(0);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = React.useCallback((): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    requestRef.current?.abort();
    requestRef.current = null;
    generationRef.current += 1;
  }, []);

  const runSearch = React.useCallback(
    async (value: string): Promise<void> => {
      const needle = value.trim();
      cancel();
      if (root === '' || needle === '') {
        setResults([]);
        setLoading(false);
        setError(null);
        setTruncated(false);
        return;
      }
      const generation = generationRef.current;
      const controller = new AbortController();
      requestRef.current = controller;
      setLoading(true);
      setError(null);
      try {
        const response = await callGit<CommitLogSearchResponse>(
          {
            op: 'logSearch',
            query: needle,
            limit: 200,
            author,
          },
          { signal: controller.signal },
        );
        if (controller.signal.aborted || generation !== generationRef.current) return;
        setResults(Array.isArray(response.commits) ? response.commits : []);
        setTruncated(response.truncated === true);
      } catch (failure) {
        if (controller.signal.aborted || generation !== generationRef.current) return;
        setResults([]);
        setTruncated(false);
        setError(failure instanceof Error ? failure.message : String(failure));
      } finally {
        if (requestRef.current === controller) {
          requestRef.current = null;
          setLoading(false);
        }
      }
    },
    [author, cancel, root],
  );

  React.useEffect(() => {
    cancel();
    if (root === '' || query.trim() === '') {
      setResults([]);
      setLoading(false);
      setError(null);
      setTruncated(false);
      return undefined;
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void runSearch(query);
    }, 250);
    return cancel;
  }, [author, cancel, query, root, runSearch]);

  const retry = React.useCallback((): void => {
    void runSearch(query);
  }, [query, runSearch]);

  return {
    query,
    setQuery,
    results,
    loading,
    error,
    truncated,
    searchMode: query.trim() !== '',
    retry,
    refresh: retry,
  };
}
