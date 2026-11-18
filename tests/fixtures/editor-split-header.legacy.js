/* editor-workspace.js editor split header legacy oracle. */

                      React.createElement(
                        'div',
                        { style: styles.editorSplitHeader },
                        React.createElement(Icon, { name: 'split', size: 11 }),
                        React.createElement(
                          'div',
                          {
                            ref: splitTabStripRef,
                            style: {
                              ...styles.editorSplitTabs,
                              position: 'relative',
                              boxSizing: 'border-box',
                              paddingRight: splitTabLayout.hidden.length === 0 ? 0 : 28,
                            },
                            'data-dsh-editor-split-tabs': '',
                            'data-dsh-editor-split-hidden-tabs': String(splitTabLayout.hidden.length),
                          },
                          splitTabLayout.visible.map((splitTab) => {
                            const splitTabFile = openFiles.find((file) => file.path === splitTab) ?? null;
                            const splitTabActive = splitTab === splitFile.path;
                            const splitTabIndex = splitTabs.indexOf(splitTab);
                            return React.createElement(EditorFileTab, {
                              key: splitTab,
                              path: splitTab,
                              label: basename(splitTab),
                              active: splitTabActive,
                              dirty: splitTabFile?.dirty === true,
                              className: 'dsh-editor-split-tab',
                              style: {
                                ...styles.editorSplitTab,
                                ...(splitTabActive ? styles.editorSplitTabActive : null),
                                ...(splitTabLayout.hidden.length === 0 ? null : { maxWidth: '100%', minWidth: 0, overflow: 'hidden' }),
                                ...(editorTabDrop?.group === 'right' && editorTabDrop.path === splitTab
                                  ? { boxShadow: editorTabDrop.after ? 'inset -2px 0 0 var(--dsw-alias-state-business-primary)' : 'inset 2px 0 0 var(--dsw-alias-state-business-primary)' }
                                  : null),
                                ...(editorTabDrag?.group === 'right' && editorTabDrag.path === splitTab ? { opacity: 0.55 } : null),
                              },
                              title: splitTabFile?.dirty === true ? `${splitTab} — ${t('editor.unsavedTitle')}` : splitTab,
                              closeLabel: t('editor.closeTab', { name: basename(splitTab) }),
                              dataAttributeName: 'data-dsh-editor-split-path',
                              onFocus: () => {
                                if (splitTabActive) return;
                                splitPathRef.current = splitTab;
                                setSplitPath(splitTab);
                              },
                              onActivate: () => {
                                splitPathRef.current = splitTab;
                                setSplitPath(splitTab);
                                window.setTimeout(() => splitEditorRef.current?.focus?.(), 0);
                              },
                              onKeyDown: (event) => {
                                if (!gotoLineShortcutMatches(event)) return;
                                event.preventDefault();
                                event.stopPropagation();
                                gotoLine(splitTab, 'right');
                              },
                              onAuxClick: (event) => {
                                if (event.button !== 1) return;
                                event.preventDefault();
                                closeSplitTab(splitTab);
                              },
                              onDragStart: (event) => beginEditorTabDrag(event, 'right', splitTab),
                              onDragOver: (event) => dragOverEditorTab(event, 'right', splitTab),
                              onDragLeave: () => setEditorTabDrop((current) => (current?.group === 'right' && current.path === splitTab ? null : current)),
                              onDrop: (event) => dropEditorTab(event, 'right', splitTab),
                              onDragEnd: () => {
                                editorTabDragRef.current = null;
                                setEditorTabDrag(null);
                                setEditorTabDrop(null);
                              },
                              onContextMenu: (event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setMenu({
                                  x: event.clientX,
                                  y: event.clientY,
                                  title: basename(splitTab),
                                  items: [
                                    buildHarnessPathAction([{ path: splitTab, isDirectory: false }]),
                                    null,
                                    {
                                      id: 'close',
                                      label: t('editor.closeTab', { name: basename(splitTab) }),
                                      shortcut: '⌘W',
                                      run: () => closeSplitTab(splitTab),
                                    },
                                    {
                                      id: 'closeOthers',
                                      label: t('editor.closeOtherTabs'),
                                      disabled: splitTabs.length <= 1,
                                      run: () => closeSplitTabs(splitTabs.filter((path) => path !== splitTab)),
                                    },
                                    {
                                      id: 'closeLeft',
                                      label: t('editor.closeTabsLeft'),
                                      disabled: splitTabIndex <= 0,
                                      run: () => closeSplitTabs(splitTabs.slice(0, splitTabIndex)),
                                    },
                                    {
                                      id: 'closeRight',
                                      label: t('editor.closeTabsRight'),
                                      disabled: splitTabIndex < 0 || splitTabIndex >= splitTabs.length - 1,
                                      run: () => closeSplitTabs(splitTabs.slice(splitTabIndex + 1)),
                                    },
                                    {
                                      id: 'closeAll',
                                      label: t('editor.closeAllTabs'),
                                      run: () => closeSplitTabs(splitTabs),
                                    },
                                    null,
                                    {
                                      id: 'moveLeft',
                                      label: t('editor.terminalMoveLeft'),
                                      disabled: splitTabIndex <= 0,
                                      run: () => moveEditorTabByOffset('right', splitTab, -1),
                                    },
                                    {
                                      id: 'moveRight',
                                      label: t('editor.terminalMoveRight'),
                                      disabled: splitTabIndex < 0 || splitTabIndex >= splitTabs.length - 1,
                                      run: () => moveEditorTabByOffset('right', splitTab, 1),
                                    },
                                    null,
                                    {
                                      id: 'save',
                                      label: t('editor.save'),
                                      shortcut: '⌘S',
                                      run: () => void savePath(splitTab),
                                    },
                                    {
                                      id: 'copyPath',
                                      label: t('editor.copyRelativePath'),
                                      run: () => void navigator.clipboard?.writeText(splitTab).catch(() => {}),
                                    },
                                    {
                                      id: 'reveal',
                                      label: t('editor.revealInProject'),
                                      run: () => void revealPath(splitTab),
                                    },
                                  ],
                                });
                              },
                              onClose: () => closeSplitTab(splitTab),
                            });

                          }),
                          splitTabLayout.hidden.length === 0
                            ? null
                            : React.createElement(
                                'button',
                                {
                                  type: 'button',
                                  style: {
                                    ...styles.tabOverflow,
                                    position: 'absolute',
                                    top: 0,
                                    right: 0,
                                    zIndex: 2,
                                    height: '100%',
                                    margin: 0,
                                    background: 'var(--dsw-alias-bg-layer-1)',
                                  },
                                  title: t('editor.tabsOverflow', { count: splitTabLayout.hidden.length }),
                                  'aria-label': t('editor.tabsOverflow', { count: splitTabLayout.hidden.length }),
                                  onClick: (event) => {
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
                                },
                                '»',
                              ),
                        ),
                        React.createElement(
                          'button',
                          {
                            type: 'button',
                            style: styles.tabClose,
                            'aria-label': t('editor.closeSplit'),
                            title: t('editor.closeSplit'),
                            onClick: closeRightSplit,
                          },
                          '▣',
                        ),
                      ),

/* EDITOR_SPLIT_HEADER_END */
