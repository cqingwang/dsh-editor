import React from 'react';
import { styles } from '../../ui/styles';
import { ToolbarButton } from './ToolbarButton';

interface DiffViewModeControlProps {
  t: (key: string) => string;
  mode: 'paired' | 'toggle';
  sideBySide: boolean;
  disabled?: boolean;
  onChange: (sideBySide: boolean) => void;
}

function DiffViewModeControl({ t, mode, sideBySide, disabled, onChange }: DiffViewModeControlProps) {
  const unified = (
    <ToolbarButton
      icon='unified'
      label={t('editor.diffUnifiedMode')}
      active={sideBySide === false}
      disabled={disabled}
      onClick={() => onChange(false)}
    />
  );
  const sideBySideButton = (
    <ToolbarButton
      icon='split'
      label={t('editor.diffSideBySideMode')}
      active={sideBySide === true}
      disabled={disabled}
      onClick={() => onChange(true)}
    />
  );
  const toggle = (
    <ToolbarButton
      icon={sideBySide ? 'split' : 'unified'}
      label={sideBySide ? t('editor.diffUnifiedMode') : t('editor.diffSideBySideMode')}
      disabled={disabled}
      onClick={() => onChange(sideBySide === false)}
    />
  );
  return (
    <span
      style={styles.diffModeSwitch}
      className='dsh-editor-diff-mode-switch'
      data-dsh-diff-fixed=''
      role='group'
      aria-label={t('editor.diffViewModeGroup')}>
      {mode === 'paired' ? unified : toggle}
      {mode === 'paired' ? sideBySideButton : null}
    </span>
  );
}
export { DiffViewModeControl };
