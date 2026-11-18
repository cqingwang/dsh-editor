import React from 'react';
import { styles } from '../../ui/styles';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface NamePromptState {
  title: string;
  value: string;
  placeholder?: string;
  error?: string | null;
}

export interface NamePromptProps {
  t: Translate;
  state: NamePromptState;
  onSubmit: () => void;
  onChange: (value: string) => void;
  onClose: () => void;
}

function NamePrompt({ t, state, onSubmit, onChange, onClose }: NamePromptProps) {
  const error = typeof state.error === 'string' && state.error !== '' ? state.error : null;
  return (
    <div
      style={styles.paletteBackdrop}
      onMouseDown={onClose}>
      <div
        style={styles.namePrompt}
        role='dialog'
        aria-label={state.title}
        onMouseDown={(event) => event.stopPropagation()}>
        <div style={styles.namePromptTitle}>{state.title}</div>
        <input
          style={styles.namePromptInput}
          autoFocus={true}
          value={state.value}
          placeholder={state.placeholder}
          aria-label={state.title}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onSubmit();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              onClose();
            }
          }}
        />
        {error === null ? null : (
          <div
            style={styles.namePromptError}
            role='alert'>
            {error}
          </div>
        )}
        <div style={styles.namePromptButtons}>
          <button
            type='button'
            style={styles.commitSecondary}
            onClick={onClose}>
            {t('editor.cancel')}
          </button>
          <button
            type='button'
            style={styles.commitPrimary}
            onClick={() => onSubmit()}
            disabled={state.value.trim() === ''}>
            {t('editor.ok')}
          </button>
        </div>
      </div>
    </div>
  );
}

export { NamePrompt };
