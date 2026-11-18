/* editor-workspace.js main file tab legacy oracle. */

        return React.createElement(
          'div',
          {
            key: file.path,
            role: 'tab',
            'aria-selected': fileTabActive,
            tabIndex: fileTabActive ? 0 : -1,
            className: `${fileTabActive ? 'dsh-editor-tab dsh-editor-tab-active' : 'dsh-editor-tab'}${file.path === previewPath ? ' dsh-editor-tab-preview' : ''}`,
            style: {
              ...styles.tab,
              ...(fileTabActive ? styles.tabActive : null),
              ...(preview ? { fontStyle: 'italic' } : null),
              ...(editorTabDrop?.group === 'left' && editorTabDrop.path === file.path
                ? { boxShadow: editorTabDrop.after ? 'inset -2px 0 0 var(--dsw-alias-state-business-primary)' : 'inset 2px 0 0 var(--dsw-alias-state-business-primary)' }
                : null),
              ...(editorTabDrag?.group === 'left' && editorTabDrag.path === file.path ? { opacity: 0.55 } : null),
            },
            /* IDEA shows "name — full/path" and marks a dirty tab in its tooltip too. */
            title: file.dirty ? `${file.path} — ${t('editor.unsavedTitle')}` : file.path,
            'data-dsh-editor-file-tab-path': file.path,
            onFocus: () => {
              if (fileTabActive) return;
              setActivePath(file.path);
              setDiffActive(false);
            },
            onClick: () => {
              setActivePath(file.path);
              setDiffActive(false);
            },
            onKeyDown: (event) => {
              if (!gotoLineShortcutMatches(event)) return;
              event.preventDefault();
              event.stopPropagation();
              gotoLine(file.path, 'left');
            },
            onAuxClick: (event) => {
              /* Middle-click closes a tab, like IDEA and every browser. */
              if (event.button !== 1) return;
              event.preventDefault();
              closeFile(file.path);
            },
            draggable: true,
            onDragStart: (event) => beginEditorTabDrag(event, 'left', file.path),
            onDragOver: (event) => dragOverEditorTab(event, 'left', file.path),
            onDragLeave: () => setEditorTabDrop((current) => (current?.group === 'left' && current.path === file.path ? null : current)),
            onDrop: (event) => dropEditorTab(event, 'left', file.path),
            onDragEnd: () => {
              editorTabDragRef.current = null;
              setEditorTabDrag(null);
              setEditorTabDrop(null);
            },
            onContextMenu: (event) => {
              event.preventDefault();
              event.stopPropagation();
              setActivePath(file.path);
              setDiffActive(false);
              const tabIndex = allTabs.indexOf(file);
              const openIndex = openFiles.findIndex((entry) => entry.path === file.path);
              setMenu({
                x: event.clientX,
                y: event.clientY,
                items: [
                  buildHarnessPathAction([{ path: file.path, isDirectory: false }]),
                  null,
                  ...(preview
                    ? [
                        {
                          id: 'keepTabOpen',
                          label: t('editor.keepTabOpen'),
                          run: () => {
                            if (previewPathRef.current === file.path) {
                              previewPathRef.current = null;
                              setPreviewPath(null);
                            }
                          },
                        },
                        null,
                      ]
                    : []),
                  { id: 'close', label: t('editor.closeTab', { name: basename(file.path) }), shortcut: '⌘W', run: () => closeFile(file.path) },
                  { id: 'closeOthers', label: t('editor.closeOtherTabs'), run: () => closeOtherTabs(file.path) },
                  { id: 'closeLeft', label: t('editor.closeTabsLeft'), disabled: tabIndex <= 0, run: () => closeEditorTabs(allTabs.slice(0, tabIndex)) },
                  { id: 'closeRight', label: t('editor.closeTabsRight'), disabled: tabIndex < 0 || tabIndex >= allTabs.length - 1, run: () => closeEditorTabs(allTabs.slice(tabIndex + 1)) },
                  { id: 'closeAll', label: t('editor.closeAllTabs'), run: () => closeAllTabs() },
                  null,
                  { id: 'moveLeft', label: t('editor.terminalMoveLeft'), disabled: openIndex <= 0, run: () => moveEditorTabByOffset('left', file.path, -1) },
                  { id: 'moveRight', label: t('editor.terminalMoveRight'), disabled: openIndex < 0 || openIndex >= openFiles.length - 1, run: () => moveEditorTabByOffset('left', file.path, 1) },
                  null,
                  { id: 'saveAll', label: t('editor.saveAll'), shortcut: '⌥⌘S', run: () => void saveAll() },
                  null,
                  { id: 'copyPath', label: t('editor.copyTabPath'), run: () => void navigator.clipboard?.writeText(root === '' ? file.path : `${root}/${file.path}`).catch(() => {}) },
                  { id: 'reveal', label: t('editor.revealInProject'), run: () => void revealActive(), disabled: file.path !== activePath },
                ],
              });
            },
          },
          /* IDEA always leads an editor tab with the same 16px file-type icon
             used by the Project view. Reuse EntryIcon so tab and tree never
             drift to different icon providers or sizes. */
          React.createElement(EntryIcon, { entry: { path: file.path, kind: 'file' }, expanded: false }),
          React.createElement('span', null, basename(file.path)),
          file.dirty ? React.createElement('span', { style: { color: 'var(--dsw-alias-state-business-primary)' } }, '●') : null,
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'dsh-editor-tab-close',
              style: styles.tabClose,
              'aria-label': t('editor.closeTab', { name: basename(file.path) }),
              title: t('editor.closeTab', { name: basename(file.path) }),
              onClick: (event) => {
                event.stopPropagation();
                closeFile(file.path);
              },
            },
            '×',
          ),
        );
      })

/* EDITOR_MAIN_FILE_TAB_END */
