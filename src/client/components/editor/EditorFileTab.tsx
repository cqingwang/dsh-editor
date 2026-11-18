import React from 'react';
import { styles } from '../../ui/styles';
import { EntryIcon } from '../ui/EntryIcon';

export interface EditorFileTabProps {
  path: string;
  label: string;
  active: boolean;
  dirty: boolean;
  className: string;
  style: React.CSSProperties;
  title: string;
  closeLabel: string;
  dataAttributeName: string;
  onFocus?: () => void;
  onActivate?: () => void;
  onAuxClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onDragStart?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave?: () => void;
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onClose: () => void;
}

function EditorFileTab({
  path,
  label,
  active,
  dirty,
  className,
  style,
  title,
  closeLabel,
  dataAttributeName,
  onFocus,
  onActivate,
  onAuxClick,
  onKeyDown,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onContextMenu,
  onClose,
}: EditorFileTabProps) {
  return (
    <div
      role='tab'
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      className={className}
      style={style}
      title={title}
      {...{ [dataAttributeName]: path }}
      onFocus={onFocus}
      onClick={onActivate}
      onAuxClick={onAuxClick}
      onKeyDown={onKeyDown}
      draggable={true}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onContextMenu={onContextMenu}>
      <EntryIcon
        entry={{
          path,
          kind: 'file',
        }}
        expanded={false}
      />
      <span style={styles.tabLabel}>{label}</span>
      {dirty ? (
        <span
          style={{
            color: 'var(--dsw-alias-state-business-primary)',
          }}>
          ●
        </span>
      ) : null}
      <button
        type='button'
        className='dsh-editor-tab-close'
        style={styles.tabClose}
        aria-label={closeLabel}
        title={closeLabel}
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}>
        ×
      </button>
    </div>
  );
}

export { EditorFileTab };
