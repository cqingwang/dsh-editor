import React from 'react';
import { styles } from '../../ui/styles';

export interface EditorSplitDividerProps {
  percent: number;
  dragging: boolean;
  title: string;
  clampPercent: (value: number, width?: number | null) => number;
  onChange: (next: number) => void;
  onDraggingChange: (dragging: boolean) => void;
  onCommit: (final: number) => void;
}

function EditorSplitDivider({
  percent,
  dragging,
  title,
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
    let latest = percent;
    onDraggingChange(true);
    const onMove = (moveEvent: MouseEvent) => {
      const next = clampPercent(((moveEvent.clientX - rect.left) / Math.max(1, rect.width)) * 100, rect.width);
      latest = next;
      onChange(next);
    };
    const onUp = () => {
      onDraggingChange(false);
      onCommit(Math.round(clampPercent(latest, rect.width)));
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
        background: dragging ? 'var(--dsw-alias-state-business-primary)' : 'var(--dsw-alias-bg-layer-1)',
      }}
      role='separator'
      aria-orientation='vertical'
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
