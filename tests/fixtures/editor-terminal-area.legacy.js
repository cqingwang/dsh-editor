/* editor-workspace.js editor terminal area legacy oracle. */

              /* A terminal moved into the editor owns the code area, the way IDEA's
                 editor tab does: one surface at a time, not a split. */
              editorTerminals.length === 0 || diffOpen || annotateTarget !== null
                ? null
                : React.createElement(EditorTerminalTab, {
                    t,
                    terminal: editorTerminals[editorTerminals.length - 1],
                    fontSize: 12,
                    getCwd: () => editorTerminals[editorTerminals.length - 1]?.cwd ?? '',
                    onGrid: () => {},
                    onError: (message) => setEditorError(message),
                    onInput: (id, data) => {
                      /* Typing has to reach the PTY the dock would have written to. */
                      void callTerminal({ op: 'write', id, data }).catch(() => {});
                    },
                    onTitle: () => {},
                    onCwd: () => {},
                    onExit: () => {},
                    onReturnToDock: (terminal) => returnEditorTerminalToDock(terminal),
                  }),

/* EDITOR_TERMINAL_AREA_END */
