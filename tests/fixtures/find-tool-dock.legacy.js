/* editor-workspace.js find tool dock legacy oracle. */

            findTool?.surface === 'dock' && terminalOpen === false
              ? React.createElement(
                  'div',
                  {
                    style: { ...styles.dock, height: findToolDockHeight },
                    'data-dsh-find-tool-dock': '',
                  },
                  React.createElement('div', {
                    style: { ...styles.dockResize, cursor: 'row-resize' },
                    title: t('editor.findToolDockResize'),
                    onMouseDown: (event) => {
                      event.preventDefault();
                      const startY = event.clientY;
                      const startHeight = findToolDockHeight;
                      const onMove = (moveEvent) => {
                        const next = clampFindDockHeight(startHeight + (startY - moveEvent.clientY));
                        setFindToolDockHeight(next);
                      };
                      const onUp = () => {
                        window.removeEventListener('mousemove', onMove);
                        window.removeEventListener('mouseup', onUp);
                        writeStoredNumber('dsh-editor.find.height', findToolDockHeightRef.current);
                      };
                      window.addEventListener('mousemove', onMove);
                      window.addEventListener('mouseup', onUp);
                    },
                  }),
                  findToolWindowElement,
                )
              : null,

/* FIND_TOOL_DOCK_END */
