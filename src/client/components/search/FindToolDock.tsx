import React from 'react';
import { styles } from '../../ui/styles';

export interface FindToolDockProps {
  open: boolean;
  height: number;
  title: string;
  clampHeight: (value: number) => number;
  onHeightChange: (value: number) => void;
  onCommit: (final: number) => void;
  children: React.ReactNode;
}

function FindToolDock({ open, height, title, clampHeight, onHeightChange, onCommit, children }: FindToolDockProps) {
  if (!open) return null;
  const onMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = height;
    let latest = height;
    const onMove = (moveEvent: MouseEvent) => {
      latest = clampHeight(startHeight + (startY - moveEvent.clientY));
      onHeightChange(latest);
    };
    const onUp = () => {
      onCommit(latest);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div
      style={{ ...styles.dock, height }}
      data-dsh-find-tool-dock=''>
      <div
        style={{ ...styles.dockResize, cursor: 'row-resize' }}
        title={title}
        onMouseDown={onMouseDown}
      />
      {children}
    </div>
  );
}

export { FindToolDock };
