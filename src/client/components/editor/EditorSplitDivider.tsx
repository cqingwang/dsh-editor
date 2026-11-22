import React from 'react';
import { styles } from '../../ui/styles';

export interface EditorSplitDividerProps {
  percent: number;
  dragging: boolean;
  title: string;
  orientation?: 'vertical' | 'horizontal';
  clampPercent: (value: number, width?: number | null) => number;
  onChange: (next: number) => void;
  onDraggingChange: (dragging: boolean) => void;
  onCommit: (final: number) => void;
}

function EditorSplitDivider({
  percent,
  dragging,
  title,
  orientation = 'vertical',
  clampPercent,
  onChange,
  onDraggingChange,
  onCommit,
}: EditorSplitDividerProps) {
  const onMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const row = event.currentTarget.parentElement;
    if (row === null) return;
    const rect = row.getBoundingClientRect();
    const horizontal = orientation === 'horizontal';
    let latest = percent;
    onDraggingChange(true);
    const onMove = (moveEvent: MouseEvent) => {
      const next = horizontal
        ? clampPercent(
            ((moveEvent.clientY - rect.top) / Math.max(1, rect.height)) * 100,
            rect.height,
          )
        : clampPercent(
            ((moveEvent.clientX - rect.left) / Math.max(1, rect.width)) * 100,
            rect.width,
          );
      latest = next;
      onChange(next);
    };
    const onUp = () => {
      onDraggingChange(false);
      onCommit(Math.round(clampPercent(latest, horizontal ? rect.height : rect.width)));
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div
      style={{
        ...styles.editorSplitDivider,
        ...(orientation === 'horizontal'
          ? {
              flex: '0 0 8px',
              width: '100%',
              height: 8,
              cursor: 'row-resize',
              borderLeft: 'none',
              borderRight: 'none',
              borderTop: '0.5px solid var(--dsw-alias-border-l3)',
              borderBottom: '0.5px solid var(--dsw-alias-border-l3)',
            }
          : null),
        background: dragging ? 'var(--dsw-alias-state-business-primary)' : 'var(--dsw-alias-bg-layer-1)',
      }}
      role='separator'
      aria-orientation={orientation === 'horizontal' ? 'horizontal' : 'vertical'}
      aria-valuemin={20}
      aria-valuemax={80}
      aria-valuenow={Math.round(percent)}
      title={title}
      data-dsh-editor-split-divider=''
      onMouseDown={onMouseDown}
    />
  );
}

export { EditorSplitDivider };
