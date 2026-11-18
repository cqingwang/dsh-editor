import React from 'react';
import { styles } from '../../ui/styles';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface EditorGotoLineState {
  value: string;
  error: string | null;
  path?: string | null;
  pane?: string | null;
}

export interface EditorGotoLinePopupProps {
  t: Translate;
  state: EditorGotoLineState | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

function EditorGotoLinePopup({ t, state, inputRef, onChange, onSubmit, onClose }: EditorGotoLinePopupProps) {
  if (state === null) return null;
  return (
    <div
      role='dialog'
      aria-label={t('editor.gotoLine')}
      aria-modal={false}
      style={styles.gotoLinePopup}
      data-dsh-editor-goto-dialog=''>
      <div style={styles.gotoLineRow}>
        <span
          style={{
            ...styles.findCount,
            minWidth: 60,
          }}>
          {t('editor.gotoLine')}
        </span>
        <input
          ref={inputRef}
          className='dsh-editor-goto-input'
          data-dsh-editor-goto-input=''
          style={styles.findInput}
          autoFocus={true}
          placeholder={t('editor.gotoLinePlaceholder')}
          value={state.value}
          aria-label={t('editor.gotoLine')}
          aria-invalid={state.error !== null}
          aria-describedby={state.error === null ? undefined : 'dsh-editor-goto-error'}
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
        <button
          type='button'
          style={styles.conflictAction}
          onClick={onSubmit}>
          {t('editor.gotoLine')}
        </button>
        <button
          type='button'
          style={styles.conflictAction}
          aria-label={t('editor.closeGotoLine')}
          onClick={onClose}>
          ×
        </button>
      </div>
      {state.error === null ? null : (
        <div
          id='dsh-editor-goto-error'
          role='alert'
          style={styles.gotoLineError}>
          {state.error}
        </div>
      )}
    </div>
  );
}

export { EditorGotoLinePopup };
