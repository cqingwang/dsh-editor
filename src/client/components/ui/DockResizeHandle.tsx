import React from 'react';
import { styles } from '../../ui/styles';

export interface DockResizeHandleProps {
  value: number;
  valueMin: number;
  valueMax: number;
  title: string;
  clampValue: (value: number) => number;
  onValueChange: (value: number) => void;
  onCommit: (final: number) => void;
  onDraggingChange?: (dragging: boolean) => void;
  resizable?: boolean;
}

function DockResizeHandle({
  value,
  valueMin,
  valueMax,
  title,
  clampValue,
  onValueChange,
  onCommit,
  onDraggingChange,
  resizable = true,
}: DockResizeHandleProps) {
  const onMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!resizable) return;
    event.preventDefault();
    const startY = event.clientY;
    const startValue = value;
    let latest = value;
    onDraggingChange?.(true);
    const onMove = (moveEvent: MouseEvent) => {
      latest = clampValue(startValue + (startY - moveEvent.clientY));
      onValueChange(latest);
    };
    const onUp = () => {
      onDraggingChange?.(false);
      onCommit(latest);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!resizable) return;
    const step = event.shiftKey ? 64 : 16;
    let next: number;
    if (event.key === 'ArrowUp') next = value + step;
    else if (event.key === 'ArrowDown') next = value - step;
    else if (event.key === 'Home') next = valueMin;
    else if (event.key === 'End') next = valueMax;
    else return;
    event.preventDefault();
    event.stopPropagation();
    const clamped = clampValue(next);
    onValueChange(clamped);
    onCommit(clamped);
  };

  return (
    <div
      style={{
        ...styles.dockResize,
        cursor: resizable ? 'row-resize' : 'default',
        opacity: resizable ? 1 : 0.45,
      }}
      role='separator'
      aria-orientation='horizontal'
      aria-valuemin={valueMin}
      aria-valuemax={valueMax}
      aria-valuenow={Math.round(value)}
      aria-valuetext={`${Math.round(value)}px`}
      aria-label={resizable ? title : undefined}
      aria-disabled={!resizable}
      tabIndex={resizable ? 0 : -1}
      title={resizable ? title : undefined}
      data-dsh-dock-resize-handle=''
      data-dsh-dock-resize-resizable={resizable ? '' : undefined}
      onMouseDown={resizable ? onMouseDown : undefined}
      onKeyDown={resizable ? onKeyDown : undefined}
    />
  );
}

export { DockResizeHandle };
