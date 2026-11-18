import React from 'react';
import { styles } from '../../ui/styles';

export interface EditorWorkspaceMainColumnProps {
  children: React.ReactNode;
}

function EditorWorkspaceMainColumn({ children }: EditorWorkspaceMainColumnProps) {
  return <div style={styles.mainColumn}>{children}</div>;
}

export { EditorWorkspaceMainColumn };
