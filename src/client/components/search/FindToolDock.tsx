import React from 'react';
import { styles } from '../../ui/styles';
import { DockResizeHandle } from '../ui/DockResizeHandle';

export interface FindToolDockProps {
  open: boolean;
  height: number;
  minHeight: number;
  maxHeight: number;
  title: string;
  clampHeight: (value: number) => number;
  onHeightChange: (value: number) => void;
  onCommit: (final: number) => void;
  resizable?: boolean;
  children: React.ReactNode;
}

function FindToolDock({
  open,
  height,
  minHeight,
  maxHeight,
  title,
  clampHeight,
  onHeightChange,
  onCommit,
  resizable = true,
  children,
}: FindToolDockProps) {
  if (!open) return null;

  return (
    <div
      style={{ ...styles.dock, height }}
      data-dsh-find-tool-dock=''>
      <DockResizeHandle
        value={height}
        valueMin={minHeight}
        valueMax={maxHeight}
        title={title}
        clampValue={clampHeight}
        onValueChange={onHeightChange}
        onCommit={onCommit}
        resizable={resizable}
      />
      {children}
    </div>
  );
}

export { FindToolDock };
