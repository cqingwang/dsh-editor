import React from 'react';
import { styles } from '../../ui/styles';

export interface EditorWorkspaceBodyProps {
  children: React.ReactNode;
}

function EditorWorkspaceBody({ children }: EditorWorkspaceBodyProps) {
  return <div style={styles.body}>{children}</div>;
}

export { EditorWorkspaceBody };
