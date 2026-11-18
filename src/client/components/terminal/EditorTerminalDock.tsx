import React from 'react';
import { styles } from '../../ui/styles';

export interface EditorTerminalDockProps {
  open: boolean;
  height: number;
  dragging: boolean;
  title: string;
  clampHeight: (value: number) => number;
  onHeightChange: (value: number) => void;
  onDraggingChange: (dragging: boolean) => void;
  onCommit: (final: number) => void;
  children: React.ReactNode;
}

function EditorTerminalDock({
  open,
  height,
  dragging,
  title,
  clampHeight,
  onHeightChange,
  onDraggingChange,
  onCommit,
  children,
}: EditorTerminalDockProps) {
  if (!open) return null;
  const onMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = height;
    let latest = height;
    onDraggingChange(true);
    const onMove = (moveEvent: MouseEvent) => {
      latest = clampHeight(startHeight + (startY - moveEvent.clientY));
      onHeightChange(latest);
    };
    const onUp = () => {
      onDraggingChange(false);
      onCommit(latest);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div style={{ ...styles.dock, height }}>
      <div
        style={{
          ...styles.dockResize,
          cursor: dragging ? 'row-resize' : 'row-resize',
        }}
        title={title}
        onMouseDown={onMouseDown}
      />
      {children}
    </div>
  );
}

export { EditorTerminalDock };
