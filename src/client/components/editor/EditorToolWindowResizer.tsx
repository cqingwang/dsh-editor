import React from 'react';
import { styles } from '../../ui/styles';

export const TOOL_WINDOW_WIDTH_MIN_PERCENT = 14;
export const TOOL_WINDOW_WIDTH_MAX_PERCENT = 72;

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
      latest = Math.max(TOOL_WINDOW_WIDTH_MIN_PERCENT, Math.min(TOOL_WINDOW_WIDTH_MAX_PERCENT, startWidth + delta));
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

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 2;
    let next: number;
    if (event.key === 'ArrowLeft') next = widthPercent - step;
    else if (event.key === 'ArrowRight') next = widthPercent + step;
    else if (event.key === 'Home') next = TOOL_WINDOW_WIDTH_MIN_PERCENT;
    else if (event.key === 'End') next = TOOL_WINDOW_WIDTH_MAX_PERCENT;
    else return;
    event.preventDefault();
    event.stopPropagation();
    const clamped = Math.max(TOOL_WINDOW_WIDTH_MIN_PERCENT, Math.min(TOOL_WINDOW_WIDTH_MAX_PERCENT, next));
    onWidthChange(clamped);
    onCommit(clamped);
  };

  return (
    <div
      style={styles.sideResize}
      role='separator'
      aria-orientation='vertical'
      aria-valuemin={TOOL_WINDOW_WIDTH_MIN_PERCENT}
      aria-valuemax={TOOL_WINDOW_WIDTH_MAX_PERCENT}
      aria-valuenow={Math.round(widthPercent)}
      aria-valuetext={`${Math.round(widthPercent)}%`}
      aria-label={title}
      tabIndex={0}
      title={title}
      data-dsh-editor-tool-window-resizer=''
      onMouseDown={onMouseDown}
      onKeyDown={onKeyDown}
    />
  );
}

export { EditorToolWindowResizer };
