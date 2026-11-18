import React from 'react';
import { styles } from '../../ui/styles';

export interface EditorErrorBannerProps {
  monacoError: string | null;
  editorError: string | null;
  monacoLabel: string;
}

function EditorErrorBanner({ monacoError, editorError, monacoLabel }: EditorErrorBannerProps) {
  if (monacoError === null && editorError === null) return null;
  return (
    <>
      {monacoError === null ? null : <div style={styles.error}>{`${monacoLabel}: ${monacoError}`}</div>}
      {editorError === null ? null : <div style={styles.error}>{editorError}</div>}
    </>
  );
}

export { EditorErrorBanner };
