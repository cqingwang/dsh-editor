import React from 'react';
import { styles } from '../../ui/styles';
import { EditorSplitHeader } from './EditorSplitHeader';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface EditorSplitPaneProps {
  t: Translate;
  focused: boolean;
  tabStripRef: React.RefObject<HTMLDivElement | null>;
  hiddenCount: number;
  onOverflow: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onCloseSplit: () => void;
  tabs: React.ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
  editorHidden: boolean;
  imagePreview: React.ReactNode;
}

function EditorSplitPane({
  t,
  focused,
  tabStripRef,
  hiddenCount,
  onOverflow,
  onCloseSplit,
  tabs,
  containerRef,
  editorHidden,
  imagePreview,
}: EditorSplitPaneProps) {
  return (
    <div
      style={{
        ...styles.editorSplitPane,
        borderTop: `2px solid ${focused ? 'var(--dsw-alias-state-business-primary)' : 'transparent'}`,
      }}
      data-dsh-editor-split=''>
      <EditorSplitHeader
        t={t}
        tabStripRef={tabStripRef}
        hiddenCount={hiddenCount}
        onOverflow={onOverflow}
        onCloseSplit={onCloseSplit}>
        {tabs}
      </EditorSplitHeader>
      <div
        ref={containerRef}
        style={{
          ...styles.editorContainer,
          display: editorHidden ? 'none' : undefined,
        }}
      />
      {imagePreview}
    </div>
  );
}

export { EditorSplitPane };
