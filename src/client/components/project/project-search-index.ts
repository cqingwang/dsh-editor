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
  cancel: () => void;
  clear: () => void;
}

interface SearchIndexMutationResult {
  files?: number;
  truncated?: boolean;
  cleared?: boolean;
}

interface SearchIndexStatusResult extends SearchIndexMutationResult {
  rebuilding?: boolean;
  processedFiles?: number;
  totalFiles?: number;
  rebuiltContentBytes?: number;
}

/** Advance the owner token so an older rebuild cannot mutate the next one's UI state. */
export function advanceSearchIndexRequest(current: number): number {
  return current + 1;
}

/** Whether one rebuild request still owns progress, notices and final state cleanup. */
export function searchIndexRequestOwns(current: number, request: number): boolean {
  return current === request;
}

/** Turn a stale Host operation table into actionable recovery instead of raw English. */
export function searchIndexActionFailureMessage(t: Translate, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return /unknown operation/iu.test(message) &&
    /(?:rebuildSearchIndex|clearSearchIndex|searchIndexStatus)/u.test(message)
    ? t('editor.searchIndexRestartRequired')
    : t('editor.searchIndexActionFailed', { message });
}

/** Execute the Project-root search-index maintenance commands. */
export function useProjectSearchIndexActions(
  notify: (message: string) => void,
  t: Translate,
  searchDirectoryRules: SearchDirectoryRules,
): ProjectSearchIndexActions {
  const abortRef = React.useRef<AbortController | null>(null);
  const clearAbortRef = React.useRef<AbortController | null>(null);
  const requestSequenceRef = React.useRef(0);
  const progressTimerRef = React.useRef<ReturnType<typeof globalThis.setInterval> | null>(null);
  const [rebuilding, setRebuilding] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);
  const [progress, setProgress] = React.useState({ processedFiles: 0, totalFiles: 0, contentBytes: 0 });
  const rebuild = React.useCallback(() => {
    if (abortRef.current !== null || clearAbortRef.current !== null) return;
    const controller = new AbortController();
    const requestId = advanceSearchIndexRequest(requestSequenceRef.current);
    requestSequenceRef.current = requestId;
    abortRef.current = controller;
    setRebuilding(true);
    setProgress({ processedFiles: 0, totalFiles: 0, contentBytes: 0 });
    notify(t('editor.searchIndexRebuilding'));
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
          if (now - lastProgressUpdate >= 1000 && next.totalFiles > 0) {
            lastProgressUpdate = now;
            setProgress(next);
            notify(
              t('editor.searchIndexRebuildingProgress', {
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
    void callFs<SearchIndexMutationResult>(
      { op: 'rebuildSearchIndex', searchDirectoryRules },
      { signal: controller.signal },
    )
      .then((value) => {
        if (!searchIndexRequestOwns(requestSequenceRef.current, requestId)) return;
        notify(
          t(value.truncated === true ? 'editor.searchIndexRebuildTruncated' : 'editor.searchIndexRebuildDone', {
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
  }, [notify, searchDirectoryRules, t]);
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
    () => ({ rebuilding, clearing, progress, rebuild, cancel, clear }),
    [cancel, clear, clearing, progress, rebuild, rebuilding],
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
