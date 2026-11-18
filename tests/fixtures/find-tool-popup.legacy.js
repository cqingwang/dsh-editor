/* editor-workspace.js find tool popup legacy oracle. */

            findTool === null || findTool.surface === 'dock'
              ? null
              : React.createElement(
                  'div',
                  {
                    style: {
                      ...styles.findToolPopup,
                      left: findToolPopupGeometry.x,
                      top: findToolPopupGeometry.y,
                      width: findToolPopupGeometry.width,
                      height: findToolPopupGeometry.height,
                      transform: 'none',
                    },
                    'data-dsh-find-tool-popup': '',
                  },
                  React.cloneElement(findToolWindowElement, {
                    onPopupDragStart: startFindPopupInteraction,
                    onPopupResizeStart: (event, direction) => startFindPopupInteraction(event, direction),
                  }),
                ),

/* FIND_TOOL_POPUP_END */
