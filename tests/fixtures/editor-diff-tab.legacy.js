/* editor-workspace.js editor diff tab legacy oracle. */

          : React.createElement(
              'div',
              {
                key: 'dsh-editor-difftab',
                className: diffActive ? 'dsh-editor-tab dsh-editor-tab-active dsh-editor-diff-tab' : 'dsh-editor-tab dsh-editor-diff-tab',
                style: { ...styles.tab, ...(diffActive ? styles.tabActive : null) },
                title: diffTarget.combined === true || diffTarget.repositoryVersion !== null && typeof diffTarget.repositoryVersion === 'object'
                  ? diffTabName
                  : `${diffTabName} — ${diffTarget.path}`,
                onClick: () => setDiffActive(true),
                onAuxClick: (event) => {
                  if (event.button !== 1) return;
                  event.preventDefault();
                  closeDiff();
                },
                onContextMenu: (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setDiffActive(true);
                  const diffTabIndex = allTabs.indexOf(DIFF_TAB_KEY);
                  setMenu({
                    x: event.clientX,
                    y: event.clientY,
                    items: [
                      buildHarnessPathAction([{ path: diffTarget.path, isDirectory: false }]),
                      null,
                      { id: 'close', label: t('editor.closeTab', { name: diffTabName }), shortcut: '⌘W', run: () => closeDiff() },
                      { id: 'closeOthers', label: t('editor.closeOtherTabs'), disabled: openFiles.length === 0, run: () => closeEditorTabs(openFiles.map((file) => file.path)) },
                      { id: 'closeRight', label: t('editor.closeTabsRight'), disabled: openFiles.length === 0, run: () => closeEditorTabs(allTabs.slice(diffTabIndex + 1)) },
                      { id: 'closeAll', label: t('editor.closeAllTabs'), run: () => closeAllTabs() },
                      ...(diffTarget.combined === true
                        ? []
                        : [
                            null,
                            { id: 'openFile', label: t('editor.openInEditor'), run: () => void openFile(diffTarget.path) },
                          ]),
                    ],
                  });
                },
              },
              /* IDEA puts the diff glyph first: the tab reads as a change, not as
                 a file, and the name is clipped from the END so the prefix stays. */
              React.createElement(Icon, { name: 'commit', size: 11 }),
              React.createElement('span', { style: styles.tabLabel }, diffTabName),
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'dsh-editor-tab-close',
                  style: styles.tabClose,
                  'aria-label': t('editor.closeTab', { name: diffTabName }),
                  title: t('editor.closeTab', { name: diffTabName }),
                  onClick: (event) => {
                    event.stopPropagation();
                    closeDiff();
                  },
                },
                '×',
              ),
            );

/* EDITOR_DIFF_TAB_END */
