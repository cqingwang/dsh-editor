import React from 'react';
import type { CommitLogDetail } from './CommitLog';

export type CommitLogSelectionRestoreAction = 'none' | 'wait' | 'loadMore' | 'clear' | 'show';

export interface CommitLogSelectionRestoreInput {
  selectedCommit: string | null;
  commits: readonly { hash: string }[];
  detailHash: string | null;
  loading: boolean;
  loadingMore: boolean;
  exhausted: boolean;
  failed: boolean;
  attempts: number;
  maxAttempts: number;
  requestHash: string | null;
}

export function commitLogSelectionRestoreAction(
  input: CommitLogSelectionRestoreInput,
): CommitLogSelectionRestoreAction {
  if (input.selectedCommit === null || input.commits.length === 0) return 'none';
  const found = input.commits.some((commit) => commit.hash === input.selectedCommit);
  if (!found) {
    if (input.loading || input.loadingMore || input.failed) return 'wait';
    if (input.exhausted || input.attempts >= input.maxAttempts) return 'clear';
    return 'loadMore';
  }
  if (input.detailHash === input.selectedCommit) return 'none';
  if (input.requestHash === input.selectedCommit) return 'wait';
  return 'show';
}

export interface CommitLogSelectionRestoreOptions {
  enabled?: boolean;
  selectedCommit: string | null;
  commits: readonly { hash: string }[];
  detailHash: string | null;
  loading: boolean;
  exhausted: boolean;
  failed: boolean;
  requestRef: React.MutableRefObject<string | null>;
  maxAttempts: number;
  loadMore: () => Promise<void>;
  show: (hash: string) => Promise<void>;
  setSelectedCommit: React.Dispatch<React.SetStateAction<string | null>>;
  setLogSelectedCommits: React.Dispatch<React.SetStateAction<string[]>>;
  setLogDetail: React.Dispatch<React.SetStateAction<CommitLogDetail | null>>;
}

export function useCommitLogSelectionRestore(options: CommitLogSelectionRestoreOptions): void {
  const attemptsRef = React.useRef(0);
  const inFlightRef = React.useRef(false);
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    attemptsRef.current = 0;
    inFlightRef.current = false;
  }, [options.selectedCommit]);
  React.useEffect(() => {
    if (options.enabled === false) return;
    const action = commitLogSelectionRestoreAction({
      selectedCommit: options.selectedCommit,
      commits: options.commits,
      detailHash: options.detailHash,
      loading: options.loading,
      loadingMore: inFlightRef.current,
      exhausted: options.exhausted,
      failed: options.failed,
      attempts: attemptsRef.current,
      maxAttempts: options.maxAttempts,
      requestHash: options.requestRef.current,
    });
    if (action === 'clear') {
      options.requestRef.current = null;
      options.setSelectedCommit(null);
      options.setLogSelectedCommits([]);
      options.setLogDetail(null);
      return;
    }
    if (action === 'loadMore') {
      attemptsRef.current += 1;
      inFlightRef.current = true;
      void options.loadMore().finally(() => {
        inFlightRef.current = false;
        setTick((value) => value + 1);
      });
      return;
    }
    if (action === 'show') void options.show(options.selectedCommit as string);
  }, [
    options.commits,
    options.detailHash,
    options.enabled,
    options.exhausted,
    options.failed,
    options.loadMore,
    options.loading,
    options.maxAttempts,
    options.requestRef,
    options.selectedCommit,
    options.setLogDetail,
    options.setLogSelectedCommits,
    options.setSelectedCommit,
    options.show,
  ]);
}
