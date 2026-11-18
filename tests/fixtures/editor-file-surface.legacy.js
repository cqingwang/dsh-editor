/* editor-workspace.js editor file surface legacy oracle. */

              /* A terminal in the editor area owns the surface: "no file open" is
                 then a lie, and the two boxes would split the height 50/50. */
              activeFile === null && splitFile === null && diffOpen === false && annotateTarget === null && monacoError === null && editorTerminals.length === 0
                ? React.createElement('div', { style: styles.empty }, t('editor.noFile'))
                : null,
              React.createElement(
                'div',
                {
                  style: {
                    ...styles.editorSplitRow,
                    display: fileSurfaceVisible ? 'flex' : 'none',
                  },
                  'data-dsh-editor-file-surface': '',
                },
                React.createElement(EditorMainPane, {
                  focused: leftFocused,
                  splitOpen: splitFile !== null,
                  splitPercent: editorSplitPercent,
                  editorHidden: activeImage || effectiveMarkdownMode === 'preview',
                  containerRef,
                  preview: activeImage
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
                }),
                splitFile === null
                  ? null
                  : React.createElement(EditorSplitDivider, {
                      percent: editorSplitPercent,
                      dragging: editorSplitDragging,
                      title: t('editor.resizeEditorSplit'),
                      clampPercent: clampEditorSplitPercent,
                      onChange: setEditorSplitPercent,
                      onDraggingChange: setEditorSplitDragging,
                      onCommit: (final) => writeStoredNumber('dsh-editor.editor.splitPercent', final),
                    }),
                splitFile === null
                  ? null
                  : React.createElement(EditorSplitPane, {
                      t,
                      focused: splitFocused,
                      tabStripRef: splitTabStripRef,
                      hiddenCount: splitTabLayout.hidden.length,
                      onOverflow: (event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        setMenu({
                          x: Math.max(4, rect.left - 190),
                          y: rect.bottom + 4,
                          title: t('editor.tabsOverflowTitle'),
                          items: splitTabLayout.hidden.map((path) => {
                            const file = openFiles.find((entry) => entry.path === path) ?? null;
                            return {
                              id: `split-tab:${path}`,
                              label: file?.dirty === true ? `${path} •` : path,
                              run: () => {
                                splitPathRef.current = path;
                                setSplitPath(path);
                                window.setTimeout(() => splitEditorRef.current?.focus?.(), 0);
                              },
                            };
                          }),
                        });
                      },
                      onCloseSplit: closeRightSplit,
                      tabs: splitTabElements,
                      containerRef: splitContainerRef,
                      editorHidden: splitImage,
                      imagePreview: splitImage && splitPath !== null
                        ? workspaceImagePreviewElement(t, splitPath, splitFile, activateImagePane)
                        : null,
                    }),
              ),

/* EDITOR_FILE_SURFACE_END */
