import React from 'react';
import { styles } from '../../ui/styles';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface ImagePreviewPaneProps {
  t: Translate;
  path: string;
  src: string;
  mediaType?: string;
  onActivate?: () => void;
}

interface ImagePreviewState {
  status: 'loading' | 'loaded' | 'error';
  width: number;
  height: number;
}

function ImagePreviewPane({ t, path, src, mediaType = '', onActivate }: ImagePreviewPaneProps) {
  const [state, setState] = React.useState<ImagePreviewState>({
    status: 'loading',
    width: 0,
    height: 0,
  });

  React.useEffect(() => {
    setState({
      status: 'loading',
      width: 0,
      height: 0,
    });
  }, [src]);

  return (
    <div
      style={styles.imagePreviewPane}
      className='dsh-editor-image-preview'
      tabIndex={0}
      role='group'
      aria-label={t('editor.imagePreview')}
      data-dsh-editor-image-preview={path}
      data-dsh-editor-image-media-type={mediaType}
      onFocus={() => onActivate?.()}
      onPointerDown={() => onActivate?.()}>
      {state.status === 'loading' ? (
        <div
          style={styles.imagePreviewNotice}
          role='status'>
          {t('editor.imagePreviewLoading')}
        </div>
      ) : null}
      {state.status === 'error' ? (
        <div
          style={styles.imagePreviewError}
          role='alert'>
          {t('editor.imagePreviewFailed', { path })}
        </div>
      ) : null}
      <img
        src={src}
        alt={basename(path)}
        draggable={false}
        style={{
          ...styles.imagePreviewImage,
          display: state.status === 'error' ? 'none' : 'block',
        }}
        data-dsh-editor-image-preview-asset=''
        onLoad={(event) =>
          setState({
            status: 'loaded',
            width: event.currentTarget.naturalWidth,
            height: event.currentTarget.naturalHeight,
          })
        }
        onError={() =>
          setState({
            status: 'error',
            width: 0,
            height: 0,
          })
        }
      />
      {state.status === 'loaded' ? (
        <div style={styles.imagePreviewMeta}>{`${state.width} × ${state.height}`}</div>
      ) : null}
    </div>
  );
}

export { ImagePreviewPane };
