import React from 'react';

import { uploadWorkspaceDropToProject } from '../../project';

type ProjectUploadDropInput = Parameters<typeof uploadWorkspaceDropToProject>[0];
type ProjectUploadDropHandles = ProjectUploadDropInput['handles'];

export interface ProjectUploadDropOptions extends Omit<ProjectUploadDropInput, 'handles' | 'targetDirectory'> {
  beginOperation: () => boolean;
  endOperation: () => void;
}

export async function uploadProjectDropWithGuard(
  options: ProjectUploadDropOptions,
  handles: ProjectUploadDropHandles,
  targetDirectory: string,
  upload: typeof uploadWorkspaceDropToProject = uploadWorkspaceDropToProject,
): Promise<void> {
  const { beginOperation, endOperation, ...input } = options;
  if (!beginOperation()) return;
  try {
    await upload({ ...input, handles, targetDirectory });
  } finally {
    endOperation();
  }
}

export function useProjectUploadDrop(
  options: ProjectUploadDropOptions,
): (handles: ProjectUploadDropHandles, targetDirectory: string) => Promise<void> {
  const {
    beginOperation,
    endOperation,
    uploadBusyRef,
    callFs,
    refreshTree,
    loadGit,
    setExpanded,
    setChildren,
    setEntries,
    setTreeError,
    flashStatus,
    applyTreeSelection,
    showHidden,
    sortMode,
    foldersFirst,
    showExcludedFiles,
    projectName,
    setUploadBusy,
    setUploadProgress,
    t,
  } = options;
  return React.useCallback(
    (handles, targetDirectory) =>
      uploadProjectDropWithGuard(
        {
          beginOperation,
          endOperation,
          uploadBusyRef,
          callFs,
          refreshTree,
          loadGit,
          setExpanded,
          setChildren,
          setEntries,
          setTreeError,
          flashStatus,
          applyTreeSelection,
          showHidden,
          sortMode,
          foldersFirst,
          showExcludedFiles,
          projectName,
          setUploadBusy,
          setUploadProgress,
          t,
        },
        handles,
        targetDirectory,
      ),
    [
      applyTreeSelection,
      beginOperation,
      callFs,
      endOperation,
      flashStatus,
      foldersFirst,
      loadGit,
      projectName,
      refreshTree,
      setChildren,
      setEntries,
      setExpanded,
      setTreeError,
      setUploadBusy,
      setUploadProgress,
      showExcludedFiles,
      showHidden,
      sortMode,
      t,
      uploadBusyRef,
    ],
  );
}
