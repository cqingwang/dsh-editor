import React from 'react';
import { isGitRepositoryMissingMessage } from '../../commit';

interface MissingRepositoryStatus {
  root: '';
  isRepo: false;
  branch: '';
  prefix: '';
  changes: [];
  [key: string]: unknown;
}

interface GitActionFailureReporterOptions {
  setGit: (status: MissingRepositoryStatus) => void;
  setCommitSelection: (selection: Set<string>) => void;
  setCommitError: (message: string | null) => void;
}

type GitActionFailureReporter = (failure: unknown, setError?: (message: string | null) => void) => void;

/**
 * Route Git action failures through the same repository-availability fact as
 * status refresh. A command can lose `.git` after the window opened; showing
 * its raw fatal would resurrect an error over the neutral not-managed state.
 * @param options - state setters owned by the Commit tool window.
 * @returns reporter for rejected Git requests.
 */
export function useGitActionFailureReporter({
  setGit,
  setCommitSelection,
  setCommitError,
}: GitActionFailureReporterOptions): GitActionFailureReporter {
  return React.useCallback(
    (failure: unknown, setError: (message: string | null) => void = setCommitError): void => {
      const message = failure instanceof Error ? failure.message : String(failure);
      if (!isGitRepositoryMissingMessage(message)) {
        setError(message);
        return;
      }
      setGit({ root: '', isRepo: false, branch: '', prefix: '', changes: [] });
      setCommitSelection(new Set());
      setCommitError(null);
      setError(null);
    },
    [setCommitError, setCommitSelection, setGit],
  );
}
