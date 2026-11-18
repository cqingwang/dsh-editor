import React from 'react';
import type * as Monaco from 'monaco-editor';
import { styles } from '../../ui/styles';
import { PathLabel } from '../ui/PathLabel';
import { ToolbarButton } from '../ui/ToolbarButton';
import { EDITOR_CODE_FONT_SIZE, EDITOR_CODE_LINE_HEIGHT, EDITOR_UI_FONT } from '../editor/editor-style-model';
import { basename, detectTheme, safeLanguage } from '../../editor-core';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface RepositoryVersion {
  hash?: string;
  content?: string;
  binary?: boolean;
}

export interface RepositoryVersionTarget {
  path?: string;
  repositoryVersion?: RepositoryVersion | null;
}

export interface RepositoryVersionPreviewProps {
  t: Translate;
  target: RepositoryVersionTarget | null;
  monacoReady: boolean;
  onClose: () => void;
  onOpenLocal?: (path: string) => void;
}

function RepositoryVersionPreview({ t, target, monacoReady, onClose, onOpenLocal }: RepositoryVersionPreviewProps) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const editorRef = React.useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const version = target?.repositoryVersion ?? null;
  const path = typeof target?.path === 'string' ? target.path : '';
  const hash = typeof version?.hash === 'string' ? version.hash : '';

  React.useEffect(() => {
    const node = hostRef.current;
    const monaco = (window as Window & { monaco?: typeof Monaco }).monaco;
    if (!monacoReady || node === null || monaco?.editor === undefined || version === null || version.binary === true) {
      return undefined;
    }
    const editor = monaco.editor.create(node, {
      value: typeof version.content === 'string' ? version.content : '',
      language: safeLanguage(monaco, path),
      theme: detectTheme(),
      readOnly: true,
      automaticLayout: true,
      fontSize: EDITOR_CODE_FONT_SIZE,
      lineHeight: EDITOR_CODE_LINE_HEIGHT,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      renderWhitespace: 'selection',
      find: {
        addExtraSpaceOnTop: false,
        autoFindInSelection: 'never',
        seedSearchStringFromSelection: 'never',
      },
      fontFamily: EDITOR_UI_FONT,
    });
    editorRef.current = editor;
    editor.focus();
    return () => {
      if (editorRef.current === editor) editorRef.current = null;
      editor.dispose?.();
    };
  }, [monacoReady, path, version?.binary, version?.content, version?.hash]);

  return (
    <div
      style={styles.diffPane}
      className='dsh-editor-repository-version'
      data-dsh-repository-version=''
      data-dsh-repository-version-hash={hash}>
      <div
        style={styles.diffToolbar}
        role='toolbar'
        aria-label={t('editor.repositoryVersionTab', {
          name: basename(path),
          hash: hash.slice(0, 7),
        })}>
        <PathLabel
          path={path}
          style={styles.diffTitle}
        />
        <span style={styles.diffHint}>{t('editor.repositoryVersionMode', { hash: hash.slice(0, 7) })}</span>
        <ToolbarButton
          icon='file'
          label={t('editor.openLocalVersion')}
          onClick={() => onOpenLocal?.(path)}
        />
        <ToolbarButton
          icon='hide'
          label={t('editor.closeDiff')}
          onClick={onClose}
        />
      </div>
      {version?.binary === true ? (
        <div style={styles.empty}>{t('editor.repositoryVersionBinary')}</div>
      ) : (
        <div
          ref={hostRef}
          style={styles.diffHost}
        />
      )}
    </div>
  );
}

export { RepositoryVersionPreview };
