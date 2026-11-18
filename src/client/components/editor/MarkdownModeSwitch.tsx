import React from 'react';
import { styles } from '../../ui/styles';
import { Icon } from '../ui/Icon';
import type { MarkdownMode } from './editor-document-model';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface MarkdownModeSwitchProps {
  mode: MarkdownMode;
  onMode: (mode: MarkdownMode) => void;
  t: Translate;
}

function MarkdownModeSwitch({ mode, onMode, t }: MarkdownModeSwitchProps) {
  const options: Array<{ id: MarkdownMode; icon: string; label: string }> = [
    { id: 'code', icon: 'code', label: t('editor.markdownModeCode') },
    { id: 'split', icon: 'split', label: t('editor.markdownModeSplit') },
    { id: 'preview', icon: 'eye', label: t('editor.markdownModePreview') },
  ];

  return (
    <div
      style={styles.markdownModeBar}
      role='group'
      aria-label={t('editor.markdownPreview')}
      data-dsh-markdown-mode={mode}>
      {options.map((option) => (
        <button
          key={option.id}
          type='button'
          style={{
            ...styles.markdownModeButton,
            ...(mode === option.id ? styles.markdownModeButtonActive : null),
          }}
          title={option.label}
          aria-label={option.label}
          aria-pressed={mode === option.id}
          onClick={() => onMode(option.id)}>
          <Icon
            name={option.icon}
            size={13}
          />
        </button>
      ))}
    </div>
  );
}

export { MarkdownModeSwitch };
