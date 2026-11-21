import React from 'react';
import { styles } from '../../ui/styles';
import { editorToolWindowBackground } from './editor-style-model';

export interface EditorToolWindowPanelProps {
  activity: string;
  widthPercent: number;
  dragging: boolean;
  panelRef?: React.Ref<HTMLDivElement>;
  toolPanelFlex: (activity: string, value: number) => string;
  children: React.ReactNode;
}

function EditorToolWindowPanel({
  activity,
  widthPercent,
  dragging,
  panelRef,
  toolPanelFlex,
  children,
}: EditorToolWindowPanelProps) {
  return (
    <div
      ref={panelRef}
      data-dsh-editor-tool-window=''
      style={{
        ...styles.sidePanel,
        flex: toolPanelFlex(activity, widthPercent),
        background: editorToolWindowBackground(activity),
        cursor: dragging ? 'col-resize' : undefined,
      }}>
      {children}
    </div>
  );
}

export { EditorToolWindowPanel };
