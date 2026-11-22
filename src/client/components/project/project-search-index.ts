import React from 'react';

import type { SearchDirectoryRules } from '../../commit';
import { callFs } from '../../editor-core';
import type { MenuEntry } from '../ui/Menu';

type Translate = (key: string, params?: Record<string, unknown>) => string;

interface ProjectSearchIndexActions {
  rebuilding: boolean;
  clearing: boolean;
  progress: {
    processedFiles: number;
    totalFiles: number;
    contentBytes: number;
  };
  rebuild: () => void;
  update: () => void;
  cancel: () => void;
  clear: () => void;
}

interface SearchIndexMutationResult {
  files?: number;
  truncated?: boolean;
  pathTruncated?: boolean;
  contentTruncated?: boolean;
  cleared?: boolean;
}

export interface SearchIndexStatusResult extends SearchIndexMutationResult {
  rebuilding?: boolean;
  processedFiles?: number;
  totalFiles?: number;
  rebuiltContentBytes?: number;
  exists?: boolean;
  pathScanComplete?: boolean;
  directoryScanComplete?: boolean;
  contentScanVerified?: boolean;
  truncated?: boolean;
  pathTruncated?: boolean;
  contentTruncated?: boolean;
  watcherActive?: boolean;
}

/** Advance the owner token so an older rebuild cannot mutate the next one's UI state. */
export function advanceSearchIndexRequest(current: number): number {
  return current + 1;
}

/** Whether one rebuild request still owns progress, notices and final state cleanup. */
export function searchIndexRequestOwns(current: number, request: number): boolean {
  return current === request;
}

/** Clamp Host file counters into the percentage used by the Project progress strip. */
export function searchIndexProgressPercent(processedFiles: number, totalFiles: number): number {
  const processed = Math.max(0, Number(processedFiles) || 0);
  const total = Math.max(0, Number(totalFiles) || 0);
  if (total === 0) return 0;
  return Math.max(0, Math.min(100, Math.floor((processed / total) * 100)));
}

/** Whether project-open should start an incremental index mutation. */
export function searchIndexStatusNeedsUpdate(value: SearchIndexStatusResult | null | undefined): boolean {
  if (value?.rebuilding === true) return false;
  return (
    value?.exists !== true ||
    value.pathScanComplete !== true ||
    value.directoryScanComplete !== true ||
    value.contentScanVerified !== true
  );
}

/** Turn a stale Host operation table into actionable recovery instead of raw English. */
export function searchIndexActionFailureMessage(t: Translate, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return /unknown operation/iu.test(message) &&
    /(?:updateSearchIndex|rebuildSearchIndex|clearSearchIndex|searchIndexStatus)/u.test(message)
    ? t('editor.searchIndexRestartRequired')
    : t('editor.searchIndexActionFailed', { message });
}

/** Execute the Project-root search-index maintenance commands. */
export function useProjectSearchIndexActions(
  notify: (message: string) => void,
  t: Translate,
  searchDirectoryRules: SearchDirectoryRules,
  root = '',
): ProjectSearchIndexActions {
  const abortRef = React.useRef<AbortController | null>(null);
  const clearAbortRef = React.useRef<AbortController | null>(null);
  const requestSequenceRef = React.useRef(0);
  const progressTimerRef = React.useRef<ReturnType<typeof globalThis.setInterval> | null>(null);
  const autoUpdateRootsRef = React.useRef(new Set<string>());
  const [rebuilding, setRebuilding] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);
  const [progress, setProgress] = React.useState({ processedFiles: 0, totalFiles: 0, contentBytes: 0 });
  const beginBuild = React.useCallback(
    (operation: 'updateSearchIndex' | 'rebuildSearchIndex') => {
      if (abortRef.current !== null || clearAbortRef.current !== null) return;
      const updating = operation === 'updateSearchIndex';
      const controller = new AbortController();
      const requestId = advanceSearchIndexRequest(requestSequenceRef.current);
      requestSequenceRef.current = requestId;
      abortRef.current = controller;
      setRebuilding(true);
      setProgress({ processedFiles: 0, totalFiles: 0, contentBytes: 0 });
      notify(t(updating ? 'editor.searchIndexUpdating' : 'editor.searchIndexRebuilding'));
      let lastProgressUpdate = 0;
      let active = true;
      let polling = false;
      const pollProgress = () => {
        if (polling) return;
        polling = true;
        void callFs<SearchIndexStatusResult>({ op: 'searchIndexStatus' }, { signal: controller.signal })
          .then((value) => {
            if (!active || controller.signal.aborted || !searchIndexRequestOwns(requestSequenceRef.current, requestId))
              return;
            const next = {
              processedFiles: Math.max(0, Number(value.processedFiles) || 0),
              totalFiles: Math.max(0, Number(value.totalFiles) || 0),
              contentBytes: Math.max(0, Number(value.rebuiltContentBytes) || 0),
            };
            const now = Date.now();
            if (next.totalFiles > 0) setProgress(next);
            if (now - lastProgressUpdate >= 1000 && next.totalFiles > 0) {
              lastProgressUpdate = now;
              notify(
                t(updating ? 'editor.searchIndexUpdateProgress' : 'editor.searchIndexRebuildingProgress', {
                  processed: next.processedFiles,
                  total: next.totalFiles,
                }),
              );
            }
          })
          .catch((error) => {
            if (error?.name !== 'AbortError' && error?.name !== 'CanceledError') {
              /* Progress polling is observational; the rebuild owns final errors. */
            }
          })
          .finally(() => {
            polling = false;
          });
      };
      pollProgress();
      const progressTimer = globalThis.setInterval(pollProgress, 300);
      progressTimerRef.current = progressTimer;
      void callFs<SearchIndexMutationResult>({ op: operation, searchDirectoryRules }, { signal: controller.signal })
        .then((value) => {
          if (!searchIndexRequestOwns(requestSequenceRef.current, requestId)) return;
          const doneKey = updating
            ? value.pathTruncated === true
              ? 'editor.searchIndexUpdateTruncated'
              : 'editor.searchIndexUpdateDone'
            : value.pathTruncated === true
              ? 'editor.searchIndexRebuildTruncated'
              : 'editor.searchIndexRebuildDone';
          notify(
            t(doneKey, {
              files: Number(value.files) || 0,
            }),
          );
        })
        .catch((error) => {
          if (!searchIndexRequestOwns(requestSequenceRef.current, requestId)) return;
          if (error?.name === 'AbortError' || error?.name === 'CanceledError') {
            notify(t('editor.searchIndexRebuildCancelled'));
            return;
          }
          notify(searchIndexActionFailureMessage(t, error));
        })
        .finally(() => {
          active = false;
          globalThis.clearInterval(progressTimer);
          if (progressTimerRef.current === progressTimer) progressTimerRef.current = null;
          if (!searchIndexRequestOwns(requestSequenceRef.current, requestId)) return;
          if (abortRef.current === controller) abortRef.current = null;
          setRebuilding(false);
          setProgress({ processedFiles: 0, totalFiles: 0, contentBytes: 0 });
        });
    },
    [notify, searchDirectoryRules, t],
  );
  const rebuild = React.useCallback(() => beginBuild('rebuildSearchIndex'), [beginBuild]);
  const update = React.useCallback(() => beginBuild('updateSearchIndex'), [beginBuild]);
  React.useEffect(() => {
    if (root === '' || autoUpdateRootsRef.current.has(root)) return;
    /* Wait briefly for the workspace watcher. Its freshness proof is what lets
       the completed increment participate in indexed search without dropping
       the filename/content cache straight back to live scanning. */
    const controller = new AbortController();
    let active = true;
    let attempts = 0;
    let timer: ReturnType<typeof globalThis.setTimeout> | null = null;
    const begin = () => {
      if (!active || autoUpdateRootsRef.current.has(root)) return;
      autoUpdateRootsRef.current.add(root);
      update();
    };
    const probe = () => {
      if (!active) return;
      attempts += 1;
      void callFs<SearchIndexStatusResult>({ op: 'searchIndexStatus' }, { signal: controller.signal })
        .then((value) => {
          if (!active) return;
          if (value.watcherActive === true || attempts >= 8) {
            if (searchIndexStatusNeedsUpdate(value)) begin();
            else autoUpdateRootsRef.current.add(root);
            return;
          }
          timer = globalThis.setTimeout(probe, 150);
        })
        .catch((error) => {
          if (!active || error?.name === 'AbortError' || error?.name === 'CanceledError') return;
          if (attempts >= 8) {
            begin();
            return;
          }
          timer = globalThis.setTimeout(probe, 150);
        });
    };
    probe();
    return () => {
      active = false;
      controller.abort();
      if (timer !== null) globalThis.clearTimeout(timer);
    };
  }, [root, update]);
  const cancel = React.useCallback(() => {
    const controller = abortRef.current;
    if (controller === null) return;
    requestSequenceRef.current = advanceSearchIndexRequest(requestSequenceRef.current);
    abortRef.current = null;
    if (progressTimerRef.current !== null) {
      globalThis.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    controller.abort();
    notify(t('editor.searchIndexRebuildCancelled'));
    setRebuilding(false);
    setProgress({ processedFiles: 0, totalFiles: 0, contentBytes: 0 });
  }, [notify, t]);
  const clear = React.useCallback(() => {
    if (abortRef.current !== null || clearAbortRef.current !== null) return;
    const controller = new AbortController();
    const requestId = advanceSearchIndexRequest(requestSequenceRef.current);
    requestSequenceRef.current = requestId;
    clearAbortRef.current = controller;
    setClearing(true);
    void callFs<SearchIndexMutationResult>({ op: 'clearSearchIndex' }, { signal: controller.signal })
      .then((value) => {
        if (!searchIndexRequestOwns(requestSequenceRef.current, requestId)) return;
        notify(t(value.cleared === true ? 'editor.searchIndexCleared' : 'editor.searchIndexClearNone'));
      })
      .catch((error) => {
        if (!searchIndexRequestOwns(requestSequenceRef.current, requestId)) return;
        if (error?.name === 'AbortError' || error?.name === 'CanceledError') return;
        notify(searchIndexActionFailureMessage(t, error));
      })
      .finally(() => {
        if (clearAbortRef.current === controller) clearAbortRef.current = null;
        if (searchIndexRequestOwns(requestSequenceRef.current, requestId)) setClearing(false);
      });
  }, [notify, t]);
  React.useEffect(
    () => () => {
      requestSequenceRef.current = advanceSearchIndexRequest(requestSequenceRef.current);
      abortRef.current?.abort();
      abortRef.current = null;
      clearAbortRef.current?.abort();
      clearAbortRef.current = null;
      if (progressTimerRef.current !== null) {
        globalThis.clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    },
    [],
  );
  return React.useMemo(
    () => ({ rebuilding, clearing, progress, rebuild, update, cancel, clear }),
    [cancel, clear, clearing, progress, rebuild, rebuilding, update],
  );
}

/** Root-only Project menu entries; child rows must not expose project-wide cache actions. */
export function projectSearchIndexMenuItems(t: Translate, actions: ProjectSearchIndexActions): MenuEntry[] {
  const mutationBusy = actions.rebuilding || actions.clearing;
  const rebuildingLabel =
    actions.progress.totalFiles > 0
      ? t('editor.searchIndexRebuildingProgress', {
          processed: actions.progress.processedFiles,
          total: actions.progress.totalFiles,
        })
      : t('editor.searchIndexRebuilding');
  return [
    {
      id: 'rebuildSearchIndex',
      label: actions.rebuilding ? rebuildingLabel : t('editor.rebuildSearchIndex'),
      disabled: mutationBusy,
      run: actions.rebuild,
    },
    {
      id: 'cancelSearchIndexRebuild',
      label: t('editor.searchIndexCancelRebuild'),
      disabled: !actions.rebuilding,
      run: actions.cancel,
    },
    {
      id: 'clearSearchIndex',
      label: actions.clearing ? t('editor.searchIndexClearing') : t('editor.clearSearchIndex'),
      disabled: mutationBusy,
      run: actions.clear,
    },
  ];
}
