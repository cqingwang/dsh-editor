import React from 'react';
import { styles } from '../../ui/styles';

export interface EditorMainPaneProps {
  focused: boolean;
  splitOpen: boolean;
  splitPercent: number;
  editorHidden: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  preview: React.ReactNode;
}

function EditorMainPane({
  focused,
  splitOpen,
  splitPercent,
  editorHidden,
  containerRef,
  preview,
}: EditorMainPaneProps) {
  return (
    <div
      style={{
        display: 'flex',
        flex: splitOpen ? `0 0 clamp(96px, ${splitPercent}%, calc(100% - 103px))` : '1 1 0',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        borderTop: `2px solid ${focused ? 'var(--dsw-alias-state-business-primary)' : 'transparent'}`,
      }}
      data-dsh-markdown-workspace=''>
      <div
        ref={containerRef}
        style={{
          ...styles.editorContainer,
          flex: '1 1 0',
          display: editorHidden ? 'none' : undefined,
        }}
        data-dsh-markdown-editor-pane=''
      />
      {preview}
    </div>
  );
}

export { EditorMainPane };
