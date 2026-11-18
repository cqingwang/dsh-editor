/* editor-workspace.js editor annotate area legacy oracle. */

              annotateTarget === null
                ? null
                : React.createElement(AnnotatePreview, {
                    t,
                    target: annotateTarget,
                    lines: annotateLines,
                    loading: annotateLoading,
                    truncated: annotateTruncated,
                    onClose: () => setAnnotateTarget(null),
                    onOpenCommit: openCommitFromAnnotate,
                    selected: selectedCommit,
                  }),

/* EDITOR_ANNOTATE_AREA_END */
