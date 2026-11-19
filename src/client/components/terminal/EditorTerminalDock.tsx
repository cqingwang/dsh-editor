import React from 'react';
import { styles } from '../../ui/styles';
import { DockResizeHandle } from '../ui/DockResizeHandle';

export interface EditorTerminalDockProps {
  open: boolean;
  height: number;
  minHeight: number;
  maxHeight: number;
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
  minHeight,
  maxHeight,
  dragging,
  title,
  clampHeight,
  onHeightChange,
  onDraggingChange,
  onCommit,
  children,
}: EditorTerminalDockProps) {
  if (!open) return null;

  return (
    <div
      style={{ ...styles.dock, height }}
      data-dsh-terminal-dock=''
      data-dsh-terminal-dock-dragging={dragging ? '' : undefined}>
      <DockResizeHandle
        value={height}
        valueMin={minHeight}
        valueMax={maxHeight}
        title={title}
        clampValue={clampHeight}
        onValueChange={onHeightChange}
        onCommit={onCommit}
        onDraggingChange={onDraggingChange}
      />
      {children}
    </div>
  );
}

export { EditorTerminalDock };
