/* editor-workspace.js editor split divider legacy oracle. */

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
                            const next = clampEditorSplitPercent(
                              ((moveEvent.clientX - rect.left) / Math.max(1, rect.width)) * 100,
                              rect.width,
                            );
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

/* EDITOR_SPLIT_DIVIDER_END */
