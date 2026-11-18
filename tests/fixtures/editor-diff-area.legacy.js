/* editor-workspace.js editor diff area legacy oracle. */

              /* A change selected in the Commit tool window opens as a diff in the editor area. */
              diffOpen === false
                ? null
                : diffTarget?.repositoryVersion !== null && typeof diffTarget?.repositoryVersion === 'object'
                  ? React.createElement(RepositoryVersionPreview, {
                      t,
                      target: diffTarget,
                      monacoReady,
                      onClose: closeDiff,
                      onOpenLocal: (path) => void openFile(path),
                    })
                : React.createElement(DiffPreview, {
                    t,
                    target: diffTarget,
                    includedInCommit: diffTarget === null ? false : commitSelection.has(diffTarget.path),
                    monacoReady,
                    onClose: closeDiff,
                    onRestored: (value) => {
                      /* Kept as the success hook for callers that want to react;
                         the status snapshot goes through `onStatus` so adopting it
                         does not rebuild the diff. */
                    },
                    onStatus: (value) => {
                      setGit((current) => (value === null || typeof value !== 'object' ? current : value));
                    },
                    onNotice: (message) => flashStatus(message),
                    onNavigate: (entry) => {
                      setDiffTarget({
                        path: entry.path,
                        staged: entry.staged === true,
                      });
                      setDiffActive(true);
                    },
                    filePosition: diffFilePosition,
                    onPreviousFile: () => navigateDiffFile('previous'),
                    onNextFile: () => navigateDiffFile('next'),
                    onOpenLocal: (localTarget) => void openFile(localTarget.path),
                    undoRef: diffUndoRef,
                    redoRef: diffRedoRef,
                    viewStatesRef: diffViewStatesRef,
                    searchInChangesRef: diffSearchInChangesRef,
                  }),

/* EDITOR_DIFF_AREA_END */
