/* editor-workspace.js editor split pane legacy oracle. */

                splitFile === null
                  ? null
                  : React.createElement(
                      'div',
                      {
                        style: {
                          ...styles.editorSplitDivider,
                          background: editorSplitDragging
                            ? 'var(--dsw-alias-state-business-primary)'
                            : 'var(--dsw-alias-bg-layer-1)',
                        },
                        role: 'separator',
                        'aria-orientation': 'vertical',
                        'aria-valuemin': 20,
                        'aria-valuemax': 80,
                        'aria-valuenow': Math.round(editorSplitPercent),
                        title: t('editor.resizeEditorSplit'),
                        'data-dsh-editor-split-divider': '',
                        onMouseDown: (event) => {
                          event.preventDefault();
                          const row = event.currentTarget.parentElement;
                          if (row === null) return;
                          const rect = row.getBoundingClientRect();
                          let latest = editorSplitPercent;
                          setEditorSplitDragging(true);
                          const onMove = (moveEvent) => {
                            const next = clampEditorSplitPercent(((moveEvent.clientX - rect.left) / Math.max(1, rect.width)) * 100, rect.width);
                            latest = next;
                            setEditorSplitPercent(next);
                          };
                          const onUp = () => {
                            setEditorSplitDragging(false);
                            const final = Math.round(clampEditorSplitPercent(latest, rect.width));
                            writeStoredNumber('dsh-editor.editor.splitPercent', final);
                            window.removeEventListener('mousemove', onMove);
                            window.removeEventListener('mouseup', onUp);
                          };
                          window.addEventListener('mousemove', onMove);
                          window.addEventListener('mouseup', onUp);
                        },
                      },
                    ),
                splitFile === null
                  ? null
                  : React.createElement(
                      'div',
                      {
                        style: {
                          ...styles.editorSplitPane,
                          borderTop: `2px solid ${splitFocused ? 'var(--dsw-alias-state-business-primary)' : 'transparent'}`,
                        },
                        'data-dsh-editor-split': '',
                      },
                      React.createElement(EditorSplitHeader, {
                        t,
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
                        children: splitTabElements,
                      }),
                      React.createElement('div', {
                        ref: splitContainerRef,
                        style: {
                          ...styles.editorContainer,
                          display: splitImage ? 'none' : undefined,
                        },
                      }),
                      splitImage && splitPath !== null
                        ? workspaceImagePreviewElement(t, splitPath, splitFile, activateImagePane)
                        : null,
                    ),

/* EDITOR_SPLIT_PANE_END */
