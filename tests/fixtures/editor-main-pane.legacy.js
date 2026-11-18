/* editor-workspace.js editor main pane legacy oracle. */

                React.createElement(
                  'div',
                  {
                    style: {
                      display: 'flex',
                      flex: splitFile === null ? '1 1 0' : `0 0 clamp(96px, ${editorSplitPercent}%, calc(100% - 103px))`,
                      minWidth: 0,
                      minHeight: 0,
                      overflow: 'hidden',
                      borderTop: `2px solid ${leftFocused ? 'var(--dsw-alias-state-business-primary)' : 'transparent'}`,
                    },
                    'data-dsh-markdown-workspace': '',
                  },
                  React.createElement('div', {
                    ref: containerRef,
                    style: {
                      ...styles.editorContainer,
                      flex: '1 1 0',
                      display: activeImage || effectiveMarkdownMode === 'preview' ? 'none' : undefined,
                    },
                    'data-dsh-markdown-editor-pane': '',
                  }),
                  activeImage
                    ? workspaceImagePreviewElement(t, activePath, activeFile, activateImagePane)
                    : markdownAvailable
                    ? React.createElement(MarkdownPreviewPane, {
                        key: activePath,
                        t,
                        path: activePath,
                        content: activeFile?.content ?? '',
                        workspaceRoot: root,
                        assetRevisions: markdownAssetRevisions,
                        visible: markdownPreviewVisible,
                        paneRef: markdownPreviewRef,
                        onOpenFile: (path) => (path === '' ? Promise.resolve(false) : openFile(path, { silentError: true })),
                      })
                    : null,
                ),

/* EDITOR_MAIN_PANE_END */
