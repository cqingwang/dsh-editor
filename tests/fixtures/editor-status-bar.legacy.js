/* editor-workspace.js editor status bar legacy oracle. */

              statusFile === null || diffOpen || annotateTarget !== null
                ? null
                : React.createElement(
                    'div',
                    { style: styles.editorStatus },
                    React.createElement(EditorStatusFacts, { t, file: statusFile, caret, fileMode, lineStats }),
                    React.createElement(
                      'button',
                      {
                        type: 'button',
                        className: 'dsh-editor-status-path',
                        style: { ...styles.statusItem, ...styles.statusPath, ...styles.statusPathButton },
                        title: statusPath,
                        'aria-label': t('editor.copyStatusPath', { path: statusPath }),
                        'data-dsh-editor-status-path': '',
                        onClick: () => void copyStatusPath(),
                      },
                      statusPath,
                    ),
                    lineStats.selected > 0
                      ? React.createElement('span', { style: styles.statusItem }, t('editor.selectionInfo', { count: lineStats.selected }))
                      : null,
                    React.createElement('span', { style: styles.toolbarSpacer }),
                    statusNotice === null
                      ? null
                      : React.createElement('span', { style: styles.statusItem, role: 'status' }, statusNotice),
                    React.createElement(ToolbarButton, { icon: 'search', label: t('editor.gotoLine'), onClick: () => gotoLine() }),
                    React.createElement(ToolbarButton, { icon: 'annotate', label: t('editor.annotate'), onClick: () => void toggleAnnotate() }),
                  ),
            ),

/* EDITOR_STATUS_BAR_END */
