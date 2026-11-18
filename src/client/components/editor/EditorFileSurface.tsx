import React from 'react';
import { styles } from '../../ui/styles';

export interface EditorFileSurfaceProps {
  visible: boolean;
  empty: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}

function EditorFileSurface({ visible, empty, emptyLabel, children }: EditorFileSurfaceProps) {
  return (
    <>
      {empty ? <div style={styles.empty}>{emptyLabel}</div> : null}
      <div
        style={{
          ...styles.editorSplitRow,
          display: visible ? 'flex' : 'none',
        }}
        data-dsh-editor-file-surface=''>
        {children}
      </div>
    </>
  );
}

export { EditorFileSurface };
