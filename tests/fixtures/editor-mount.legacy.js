/* controller.js editor mount legacy oracle. */

        root = createRoot(host);
        root.render(React.createElement(EditorErrorBoundary, {
          t,
          workspaceId: editorWorkspaceId,
        }, React.createElement(EditorWorkspace, {
          t,
          workspaceId: editorWorkspaceId,
          initialHarnessCollapsed: harnessCollapsed,
          onToggleHarness: toggleHarnessLayout,
          onCloseEditor: () => setActive(false),
          onInsertHarnessReference: (request) => insertHarnessReferencesIntoComposer(ctx, request),
        })));

/* EDITOR_MOUNT_END */
