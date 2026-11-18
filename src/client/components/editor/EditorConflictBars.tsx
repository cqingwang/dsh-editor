import React from 'react';
import { styles } from '../../ui/styles';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface EditorExternalChange {
  missing?: boolean;
}

export interface EditorSaveConflict {
  path: string;
}

export interface EditorConflictBarsProps {
  t: Translate;
  externalChange: EditorExternalChange | null;
  conflict: EditorSaveConflict | null;
  onRecreate: () => void;
  onReload: () => void;
  onKeepLocal: () => void;
  onOverwrite: () => void;
  onDismiss: () => void;
}

function EditorConflictBars({
  t,
  externalChange,
  conflict,
  onRecreate,
  onReload,
  onKeepLocal,
  onOverwrite,
  onDismiss,
}: EditorConflictBarsProps) {
  return (
    <>
      {externalChange === null || conflict !== null ? null : (
        <div style={styles.conflictBar}>
          <span
            style={{
              minWidth: 0,
              flex: '1 1 auto',
            }}>
            {externalChange.missing === true ? t('editor.externalDeleted') : t('editor.externalChanged')}
          </span>
          {externalChange.missing === true ? (
            <button
              type='button'
              style={styles.conflictAction}
              onClick={onRecreate}>
              {t('editor.recreateFile')}
            </button>
          ) : (
            <button
              type='button'
              style={styles.conflictAction}
              onClick={onReload}>
              {t('editor.reload')}
            </button>
          )}
          <button
            type='button'
            style={styles.conflictAction}
            onClick={onKeepLocal}>
            {t('editor.keepLocal')}
          </button>
        </div>
      )}
      {conflict === null ? null : (
        <div style={styles.conflictBar}>
          <span
            style={{
              minWidth: 0,
              flex: '1 1 auto',
            }}>
            {t('editor.saveConflict', { path: conflict.path })}
          </span>
          <button
            type='button'
            style={styles.conflictAction}
            onClick={onOverwrite}>
            {t('editor.overwrite')}
          </button>
          <button
            type='button'
            style={styles.conflictAction}
            onClick={onReload}>
            {t('editor.reloadFromDisk')}
          </button>
          <button
            type='button'
            style={styles.conflictAction}
            onClick={onDismiss}>
            {t('editor.dismiss')}
          </button>
        </div>
      )}
    </>
  );
}

export { EditorConflictBars };
