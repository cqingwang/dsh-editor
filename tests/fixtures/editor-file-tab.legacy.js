/* editor-workspace.js split file tab legacy oracle. */

                            return React.createElement(
                              'div',
                              {
                                key: splitTab,
                                className: 'dsh-editor-split-tab',
                                role: 'tab',
                                'aria-selected': splitTabActive,
                                tabIndex: splitTabActive ? 0 : -1,
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
                                'data-dsh-editor-split-path': splitTab,
                                onFocus: () => {
                                  if (splitTabActive) return;
                                  splitPathRef.current = splitTab;
                                  setSplitPath(splitTab);
                                },
                                onClick: () => {
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
                                draggable: true,
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
                              },
                              /* A split tab is still a file tab in IDEA: keep
                                 its file-type icon even while the dirty dot is
                                 visible. The old generic commit glyph made an
                                 edited file look like a diff tab. */
                              React.createElement(EntryIcon, { entry: { path: splitTab, kind: 'file' }, expanded: false }),
                              React.createElement('span', { style: styles.tabLabel }, basename(splitTab)),
                              splitTabFile?.dirty === true
                                ? React.createElement('span', { style: { color: 'var(--dsw-alias-state-business-primary)' } }, '●')
                                : null,
                              React.createElement(
                                'button',
                                {
                                  type: 'button',
                                  className: 'dsh-editor-tab-close',
                                  style: styles.tabClose,
                                  'aria-label': t('editor.closeTab', { name: basename(splitTab) }),
                                  title: t('editor.closeTab', { name: basename(splitTab) }),
                                  onClick: (event) => {
                                    event.stopPropagation();
                                    closeSplitTab(splitTab);
                                  },
                                },
                                '×',
                              ),

/* EDITOR_FILE_TAB_END */
