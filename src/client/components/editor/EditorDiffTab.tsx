import React from 'react';
import { styles } from '../../ui/styles';
import { Icon } from '../ui/Icon';

export interface EditorDiffTabProps {
  label: string;
  title: string;
  active: boolean;
  className: string;
  style: React.CSSProperties;
  closeLabel: string;
  onActivate: () => void;
  onAuxClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onClose: () => void;
}

function EditorDiffTab({
  label,
  title,
  active,
  className,
  style,
  closeLabel,
  onActivate,
  onAuxClick,
  onContextMenu,
  onClose,
}: EditorDiffTabProps) {
  return (
    <div
      role='tab'
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      className={className}
      style={style}
      title={title}
      data-dsh-editor-diff-tab=''
      onClick={onActivate}
      onAuxClick={onAuxClick}
      onContextMenu={onContextMenu}>
      <Icon
        name='commit'
        size={11}
      />
      <span style={styles.tabLabel}>{label}</span>
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

export { EditorDiffTab };
