import React from 'react';
import { ImagePreviewPane } from './ImagePreviewPane';
import { imagePreviewUrl } from './editor-path-model';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface WorkspaceImagePreviewFile {
  mtime?: number | null;
  mediaType?: string;
}

export function workspaceImagePreviewElement(
  t: Translate,
  path: string,
  file: WorkspaceImagePreviewFile | null | undefined,
  onActivate?: (path: string) => void,
) {
  return (
    <ImagePreviewPane
      key={path}
      t={t}
      path={path}
      src={imagePreviewUrl(path, file?.mtime)}
      mediaType={file?.mediaType ?? ''}
      onActivate={() => onActivate?.(path)}
    />
  );
}
