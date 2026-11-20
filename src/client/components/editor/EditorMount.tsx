import React from 'react';
import { EditorErrorBoundary } from './EditorErrorBoundary';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface EditorMountProps {
  workspaceComponent: React.ComponentType<{
    t: Translate;
    workspaceId: string;
    restoreToolWindowFocus?: boolean;
    focusRequest?: number;
    initialHarnessCollapsed: boolean;
    onToggleHarness?: (() => boolean | void) | null;
    onCloseEditor?: (() => void) | null;
    onInsertHarnessReference?: ((request: Record<string, unknown>) => Promise<boolean> | boolean) | null;
  }>;
  t: Translate;
  workspaceId: string;
  restoreToolWindowFocus?: boolean;
  focusRequest?: number;
  initialHarnessCollapsed: boolean;
  onToggleHarness?: (() => boolean | void) | null;
  onCloseEditor?: (() => void) | null;
  onInsertHarnessReference?: ((request: Record<string, unknown>) => Promise<boolean> | boolean) | null;
}

function EditorMount({
  workspaceComponent: Workspace,
  t,
  workspaceId,
  restoreToolWindowFocus = false,
  focusRequest = 0,
  initialHarnessCollapsed,
  onToggleHarness,
  onCloseEditor,
  onInsertHarnessReference,
}: EditorMountProps) {
  return (
    <EditorErrorBoundary
      t={t}
      workspaceId={workspaceId}>
      <Workspace
        t={t}
        workspaceId={workspaceId}
        restoreToolWindowFocus={restoreToolWindowFocus}
        focusRequest={focusRequest}
        initialHarnessCollapsed={initialHarnessCollapsed}
        onToggleHarness={onToggleHarness}
        onCloseEditor={onCloseEditor}
        onInsertHarnessReference={onInsertHarnessReference}
      />
    </EditorErrorBoundary>
  );
}

export { EditorMount };
