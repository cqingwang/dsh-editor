import React from 'react';
import { styles } from '../../ui/styles';
import { primitives } from '../../foundation';
import { markdownWorkspaceImageUrl, resolveMarkdownLink } from './editor-path-model';

type Translate = (key: string, params?: Record<string, unknown>) => string;
export interface MarkdownAssetRevisions {
  global: number;
  directories: Record<string, number>;
}

export interface MarkdownPreviewPaneProps {
  t: Translate;
  path: string;
  content: string;
  workspaceRoot: string;
  assetRevisions?: MarkdownAssetRevisions | null;
  visible?: boolean;
  onOpenFile?: (path: string) => boolean | void | Promise<boolean | void>;
  paneRef?: React.RefObject<HTMLDivElement | null> | null;
}

function MarkdownPreviewPane({
  t,
  path,
  content,
  workspaceRoot,
  assetRevisions = null,
  visible = true,
  onOpenFile,
  paneRef = null,
}: MarkdownPreviewPaneProps) {
  const MarkdownText = primitives?.MarkdownText ?? null;
  const Provider = primitives?.MarkdownDelegateProvider ?? null;
  const [linkError, setLinkError] = React.useState<string | null>(null);
  const labels = React.useMemo(
    () => ({
      code: {
        copyLabel: t('editor.markdownCopyCode'),
        copiedLabel: t('editor.markdownCopiedCode'),
        toolbarLabels: {
          codeLabel: t('editor.markdownCodeBlock'),
          wrapLabel: t('editor.markdownWrapCode'),
          unwrapLabel: t('editor.markdownUnwrapCode'),
        },
      },
      footnotes: t('editor.markdownFootnotes'),
    }),
    [t],
  );
  const pathImages = React.useMemo(
    () => ({
      resolve: (value: string) => markdownWorkspaceImageUrl(path, value, workspaceRoot, assetRevisions),
    }),
    [path, workspaceRoot, assetRevisions],
  );
  const getTriggerProps = React.useCallback(() => undefined, []);
  const openLocal = React.useCallback(
    (target: string) => {
      const resolved = resolveMarkdownLink(path, target);
      if (resolved === null) {
        setLinkError(null);
        return;
      }
      setLinkError(null);
      Promise.resolve(onOpenFile?.(resolved))
        .then((opened) => {
          if (opened === false) {
            setLinkError(t('editor.markdownLinkOpenFailed', { path: resolved }));
          }
        })
        .catch(() => setLinkError(t('editor.markdownLinkOpenFailed', { path: resolved })));
    },
    [onOpenFile, path, t],
  );
  const openExternal = React.useCallback((target: unknown) => {
    if (typeof target === 'string' && target !== '') {
      window.open(target, '_blank', 'noopener,noreferrer');
    }
  }, []);
  const body =
    MarkdownText === null ? (
      <pre style={styles.markdownPreviewFallback}>{content}</pre>
    ) : (
      <MarkdownText
        text={content}
        labels={labels}
        pathImages={pathImages}
      />
    );

  return (
    <div
      ref={paneRef}
      style={{
        ...styles.markdownPreviewPane,
        display: visible ? 'block' : 'none',
      }}
      className='dsh-editor-markdown-preview'
      role='document'
      aria-label={t('editor.markdownPreview')}
      data-dsh-markdown-preview=''
      data-dsh-markdown-preview-pane=''
      data-dsh-markdown-preview-path={path}>
      <div style={styles.markdownPreviewContent}>
        {linkError === null ? null : (
          <div
            className='dsh-editor-markdown-link-error'
            style={styles.markdownLinkError}
            role='alert'
            data-dsh-markdown-link-error=''>
            {linkError}
          </div>
        )}
        {Provider === null ? (
          body
        ) : (
          <Provider
            getTriggerProps={getTriggerProps}
            openFile={openLocal}
            openExternalLink={openExternal}>
            {body}
          </Provider>
        )}
      </div>
    </div>
  );
}

export { MarkdownPreviewPane };
