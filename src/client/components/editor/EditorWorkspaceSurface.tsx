import React from 'react';
import { styles } from '../../ui/styles';

export interface EditorWorkspaceSurfaceProps {
  children: React.ReactNode;
}

function EditorWorkspaceSurface({ children }: EditorWorkspaceSurfaceProps) {
  return <div style={styles.editorSurface}>{children}</div>;
}

export { EditorWorkspaceSurface };
