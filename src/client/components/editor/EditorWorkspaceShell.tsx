import React from 'react';
import { styles } from '../../ui/styles';

export interface EditorWorkspaceShellProps {
  workspaceId: string;
  editorFileDragProps: Record<string, unknown>;
  children: React.ReactNode;
}

function EditorWorkspaceShell({ workspaceId, editorFileDragProps, children }: EditorWorkspaceShellProps) {
  return (
    <div
      style={styles.root}
      data-dsh-editor-workspace=''
      data-dsh-workspace-id={workspaceId || undefined}
      data-dsh-editor-gutter-surface='idea'
      {...editorFileDragProps}>
      {children}
    </div>
  );
}

export { EditorWorkspaceShell };
