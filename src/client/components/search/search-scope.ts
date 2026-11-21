import { searchDirectoryEffectiveState, searchDirectoryExcludedWithIncludedDescendant } from '../../commit';

export interface SearchScopeRevision {
  searchRevision: number;
  searchDirectoryRules: unknown;
}

export interface SearchEverywhereScopeState {
  files: unknown[];
  filesScope?: boolean;
  filesTruncated?: boolean;
  textMatches: unknown[];
  textLoading: boolean;
  textTruncated: boolean;
  textRevision?: number;
  error: unknown;
  errorSource?: unknown;
  includeNonProject?: boolean;
}

export interface FindToolScopeState {
  searchGeneration?: number;
  error?: unknown;
  files?: unknown[];
  matches?: unknown[];
  truncated?: boolean;
  loading?: boolean;
  loadedGeneration?: number;
}

export interface FindToolFileCandidatesRequest extends Record<string, unknown> {
  op: 'files';
  includeExcluded: boolean;
  respectGitIgnore: true;
  fileMask: string;
  searchDirectoryRules: unknown;
}

/**
 * Build the bounded candidate request for Find's File scope.
 *
 * The Host must apply the File Mask before its file-count ceiling. Filtering
 * the returned rows locally cannot recover paths that were already omitted,
 * especially when a large non-matching subtree sorts ahead of the target.
 * @param includeExcluded - whether Project-excluded directories participate.
 * @param fileMask - normalized IDEA File Mask text.
 * @param searchDirectoryRules - user include/exclude directory rules.
 * @returns Host files request retaining the mask before traversal.
 */
export function findToolFileCandidatesRequest(
  includeExcluded: unknown,
  fileMask: unknown,
  searchDirectoryRules: unknown,
): FindToolFileCandidatesRequest {
  return {
    op: 'files',
    includeExcluded: includeExcluded === true,
    respectGitIgnore: true,
    fileMask: typeof fileMask === 'string' ? fileMask : '',
    searchDirectoryRules,
  };
}

/** True when Git ignore or user search-directory scope can have changed. */
export function searchScopeRevisionChanged(
  previous: SearchScopeRevision,
  searchRevision: number,
  searchDirectoryRules: unknown,
): boolean {
  return previous.searchRevision !== searchRevision || previous.searchDirectoryRules !== searchDirectoryRules;
}

/** Clear pending Search Everywhere data and request the new text generation. */
export function searchEverywhereAfterSearchScopeChange<T extends SearchEverywhereScopeState>(state: T): T {
  return {
    ...state,
    files: [],
    filesScope: undefined,
    filesTruncated: false,
    textMatches: [],
    textLoading: false,
    textTruncated: false,
    textRevision: (state.textRevision ?? 0) + 1,
    error: null,
    errorSource: null,
  } as T;
}

/** Advance Find generation so its text and file scopes reload. */
export function findToolAfterSearchScopeChange<T extends FindToolScopeState>(state: T): T {
  return {
    ...state,
    searchGeneration: (state.searchGeneration ?? 0) + 1,
    error: null,
  } as T;
}

interface FindToolScopePreflightOptions {
  hasQuery: boolean;
  generation: number;
  directory: unknown;
  searchDirectoryRules: unknown;
  excludedMessage: (path: string) => string;
  invalidMessage: (path: string) => string;
}

export function findScopePreflight<T extends FindToolScopeState>(
  state: T | null,
  options: FindToolScopePreflightOptions,
): { state: T } | null {
  if (state === null) return null;
  const empty = {
    ...state,
    files: [],
    matches: [],
    truncated: false,
    loading: false,
    loadedGeneration: options.generation,
    error: null,
  } as T;
  if (!options.hasQuery) return { state: empty };
  const path = typeof options.directory === 'string' ? options.directory.trim() : '';
  if (invalidFindDirectoryScopePath(path)) {
    return { state: { ...empty, error: options.invalidMessage(path) } as T };
  }
  if (
    path === '' ||
    searchDirectoryEffectiveState(path, options.searchDirectoryRules) !== 'excluded' ||
    searchDirectoryExcludedWithIncludedDescendant(path, options.searchDirectoryRules)
  ) {
    return null;
  }
  return { state: { ...empty, error: options.excludedMessage(path) } as T };
}

export function invalidFindDirectoryScopePath(value: unknown): boolean {
  const path = typeof value === 'string' ? value.trim().replaceAll('\\', '/') : '';
  if (path === '') return false;
  return (
    path.length > 512 || path.startsWith('/') || path.split('/').some((segment) => segment === '' || segment === '..')
  );
}

export function directoryScopeRequest<T extends { mode: string; preset: string; directory: string }>(
  normalized: T,
  requested: { mode?: unknown; preset?: unknown; directory?: unknown },
): T {
  const directory = typeof requested.directory === 'string' ? requested.directory.trim().replaceAll('\\', '/') : '';
  return requested.mode === 'directory' && invalidFindDirectoryScopePath(directory)
    ? ({ ...normalized, mode: 'directory', directory } as T)
    : normalized;
}
import React from 'react';

interface UseSearchInvalidationOptions<TSearch extends SearchEverywhereScopeState, TFind extends FindToolScopeState> {
  searchRevision: number;
  searchDirectoryRules: unknown;
  searchEverywhere: TSearch | null;
  requestFiles: (includeNonProject: boolean) => void;
  setSearchEverywhere: React.Dispatch<React.SetStateAction<TSearch | null>>;
  setFindTool: React.Dispatch<React.SetStateAction<TFind | null>>;
}

export function useSearchInvalidation<TSearch extends SearchEverywhereScopeState, TFind extends FindToolScopeState>({
  searchRevision,
  searchDirectoryRules,
  searchEverywhere,
  requestFiles,
  setSearchEverywhere,
  setFindTool,
}: UseSearchInvalidationOptions<TSearch, TFind>): void {
  const previousRef = React.useRef<SearchScopeRevision>({ searchRevision, searchDirectoryRules });
  React.useEffect(() => {
    if (!searchScopeRevisionChanged(previousRef.current, searchRevision, searchDirectoryRules)) return;
    previousRef.current = { searchRevision, searchDirectoryRules };
    if (searchEverywhere !== null) {
      setSearchEverywhere((state) => (state === null ? state : searchEverywhereAfterSearchScopeChange(state)));
      requestFiles(searchEverywhere.includeNonProject === true);
    }
    setFindTool((current) => (current === null ? current : findToolAfterSearchScopeChange(current)));
  }, [requestFiles, searchDirectoryRules, searchEverywhere, searchRevision, setFindTool, setSearchEverywhere]);
}
