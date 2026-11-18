/* editor-workspace.js editor tab strip legacy oracle. */

              React.createElement(
                'div',
                {
                  ref: fileTabStripRef,
                  style: styles.tabStrip,
                  /* Runtime-verifiable facts: how many tabs are open vs rendered. */
                  'data-dsh-open-tabs': String(openFiles.length + (diffTab === null ? 0 : 1)),
                  /* A NUL byte in an HTML attribute is asking for trouble: the diff
                     tab reports itself as `commit:`, the file paths as themselves. */
                  'data-dsh-open-list': allTabs.map((entry) => (entry === DIFF_TAB_KEY ? 'commit:' : entry.path)).join('|'),
                  'data-dsh-hidden-tabs': String(fileTabLayout.hidden.length),
                  'data-dsh-editor-tabstrip': '',
                },
                /* IDEA collapses what does not fit into a `»` list; the terminal dock
                   already does this, and a file tab you just opened must not scroll
                   out of view while the strip silently widens. */
                fileTabLayout.visible.map((entry) => fileTabElement(entry)),
                React.createElement(
                  'div',
                  { style: styles.tabStripTrailing, 'data-dsh-editor-tabstrip-trailing': '' },
                  markdownAvailable
                    ? React.createElement(MarkdownModeSwitch, {
                        mode: effectiveMarkdownMode,
                        onMode: setMarkdownMode,
                        t,
                      })
                    : null,
                  fileTabLayout.hidden.length === 0
                    ? null
                    : React.createElement(
                        'button',
                        {
                          type: 'button',
                          className: 'dsh-editor-tab-overflow',
                          style: styles.tabOverflow,
                          title: t('editor.tabsOverflow', { count: fileTabLayout.hidden.length }),
                          'aria-label': t('editor.tabsOverflow', { count: fileTabLayout.hidden.length }),
                          onClick: (event) => {
                            const rect = event.currentTarget.getBoundingClientRect();
                            const hidden = fileTabLayout.hidden;
                            setMenu({
                              x: Math.max(4, rect.left - 180),
                              y: rect.bottom + 4,
                              title: t('editor.tabsOverflowTitle'),
                              items: hidden.map((entry) =>
                                entry === DIFF_TAB_KEY
                                  ? { id: 'tab:diff', label: diffTabName, run: () => setDiffActive(true) }
                                  : {
                                      id: `tab:${entry.path}`,
                                      /* The full path, because two `index.ts` must stay apart. */
                                      label: entry.dirty ? `${entry.path} •` : entry.path,
                                      run: () => {
                                        setActivePath(entry.path);
                                        setDiffActive(false);
                                      },
                                    },
                              ),
                            });
                          },
                        },
                        '»',
                      ),
                ),
              ),

/* EDITOR_TAB_STRIP_END */
