import React from 'react';
import { styles } from '../../ui/styles';

export interface EditorToolWindowResizerProps {
  activity: string;
  widthPercent: number;
  title: string;
  onWidthChange: (value: number) => void;
  onDraggingChange: (dragging: boolean) => void;
  onCommit: (final: number) => void;
}

function EditorToolWindowResizer({
  widthPercent,
  title,
  onWidthChange,
  onDraggingChange,
  onCommit,
}: EditorToolWindowResizerProps) {
  const onMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const body = event.currentTarget.parentElement;
    if (body === null) return;
    const total = body.getBoundingClientRect().width - 42;
    const startX = event.clientX;
    const startWidth = widthPercent;
    let latest = widthPercent;
    onDraggingChange(true);
    const onMove = (moveEvent: MouseEvent) => {
      const delta = ((moveEvent.clientX - startX) / Math.max(1, total)) * 100;
      latest = Math.max(14, Math.min(72, startWidth + delta));
      onWidthChange(latest);
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
    <div
      style={styles.sideResize}
      title={title}
      onMouseDown={onMouseDown}
    />
  );
}

export { EditorToolWindowResizer };
