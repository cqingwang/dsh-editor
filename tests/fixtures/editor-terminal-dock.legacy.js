/* editor-workspace.js editor terminal dock legacy oracle. */

            terminalOpen
              ? React.createElement(
                  'div',
                  { style: { ...styles.dock, height: terminalHeight } },
                  React.createElement('div', {
                    style: { ...styles.dockResize, cursor: dockDragging ? 'row-resize' : 'row-resize' },
                    title: t('editor.resizeTerminal'),
                    onMouseDown: (event) => {
                      event.preventDefault();
                      const startY = event.clientY;
                      const startHeight = terminalHeight;
                      setDockDragging(true);
                      const onMove = (moveEvent) => {
                        const next = startHeight + (startY - moveEvent.clientY);
                        setTerminalHeight(clampTerminalHeight(next));
                      };
                      const onUp = () => {
                        setDockDragging(false);
                        window.removeEventListener('mousemove', onMove);
                        window.removeEventListener('mouseup', onUp);
                        writeStoredNumber('dsh-editor.terminal.height', terminalHeightRef.current);
                      };
                      window.addEventListener('mousemove', onMove);
                      window.addEventListener('mouseup', onUp);
                    },
                  }),
                  React.createElement(TerminalPanel, {
                    t,
                    generation: terminalGeneration,
                    startDirectory: terminalStartDirectory,
                    workspaceRoot: root,
                    onOpenFile: (path) => void openFile(path),
                    onStartDirectoryUsed: () => {
                      pendingTerminalPath.current = '';
                      setTerminalStartDirectory('');
                    },
                    onRequestNew: () => setTerminalGeneration((value) => value + 1),
                    focusGeneration: terminalFocusGeneration,
                    onRequestClose: () => {
                      setTerminalOpen(false);
                      const previous = terminalReturnFocusRef.current;
                      terminalReturnFocusRef.current = null;
                      window.setTimeout(() => {
                        if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
                        else editorRef.current?.focus();
                      }, 0);
                    },
                    onEditorTerminals: (list) => setEditorTerminals(list),
                    onSwitchFocusToEditor: focusEditorFromTerminal,
                  }),
                )
              : null,

/* EDITOR_TERMINAL_DOCK_END */
