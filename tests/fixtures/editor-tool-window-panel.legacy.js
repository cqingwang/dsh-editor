/* editor-workspace.js tool-window panel legacy oracle. */

          panelVisible
            ? React.createElement(
                'div',
                {
                  style: {
                    ...styles.sidePanel,
                    flex: toolPanelFlex(activity, toolWidths[activity] ?? (activity === 'project' ? 28 : 25)),
                    cursor: sideDragging ? 'col-resize' : undefined,
                  },
                },

/* EDITOR_TOOL_WINDOW_PANEL_END */
