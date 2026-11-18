import React from 'react';
import { styles } from '../../ui/styles';

export interface EditorToolWindowPanelProps {
  activity: string;
  widthPercent: number;
  dragging: boolean;
  toolPanelFlex: (activity: string, value: number) => string;
  children: React.ReactNode;
}

function EditorToolWindowPanel({
  activity,
  widthPercent,
  dragging,
  toolPanelFlex,
  children,
}: EditorToolWindowPanelProps) {
  return (
    <div
      style={{
        ...styles.sidePanel,
        flex: toolPanelFlex(activity, widthPercent),
        cursor: dragging ? 'col-resize' : undefined,
      }}>
      {children}
    </div>
  );
}

export { EditorToolWindowPanel };
