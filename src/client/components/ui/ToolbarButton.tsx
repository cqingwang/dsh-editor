import React from 'react';
import { styles } from '../../ui/styles';
import { Icon } from './Icon';
export interface ToolbarButtonProps {
  icon: string;
  label: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  active?: boolean;
  onKeyDown?: ((event: React.KeyboardEvent<HTMLButtonElement>) => void) | null;
  onContextMenu?: ((event: React.MouseEvent<HTMLButtonElement>) => void) | null;
  ariaHasPopup?: boolean | 'menu' | 'dialog' | 'listbox' | 'tree' | 'grid';
  ariaExpanded?: boolean;
  ariaKeyShortcuts?: string;
  style?: React.CSSProperties | null;
  iconSize?: number;
}
function ToolbarButton({
  icon,
  label,
  onClick,
  disabled = false,
  active = undefined,
  onKeyDown = null,
  onContextMenu = null,
  ariaHasPopup = undefined,
  ariaExpanded = undefined,
  ariaKeyShortcuts = undefined,
  style = null,
  iconSize = 16,
}: ToolbarButtonProps) {
  return (
    <button
      type='button'
      className={
        active === true ? 'dsh-editor-toolbar-button dsh-editor-toolbar-button-active' : 'dsh-editor-toolbar-button'
      }
      style={{
        ...styles.toolbarButton,
        ...(disabled ? styles.toolbarButtonDisabled : null),
        ...(active === true ? styles.toolbarButtonActive : null),
        ...(style ?? null),
      }}
      title={label}
      aria-label={label}
      aria-pressed={typeof active === 'boolean' ? active : undefined}
      aria-haspopup={ariaHasPopup}
      aria-expanded={ariaExpanded}
      aria-keyshortcuts={ariaKeyShortcuts}
      disabled={disabled}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onContextMenu={onContextMenu}>
      <Icon
        name={icon}
        size={iconSize}
      />
    </button>
  );
}
export { ToolbarButton };
