export interface WorkspaceTextFile {
  path: string;
  content: string;
  dirty: boolean;
  mtime: number | null;
}

export interface WorkspaceImageFile {
  path: string;
  content: '';
  dirty: boolean;
  mtime: number | null;
  kind: 'image';
  size: number;
  mediaType: string;
}

export type WorkspaceFile = WorkspaceTextFile | WorkspaceImageFile;

export interface WorkspaceTextResponse {
  content: string;
  mtime?: number | null;
}

export interface WorkspaceImageResponse {
  size?: number;
  mtime?: number | null;
  mediaType?: string;
}

export type WorkspaceReloadOperation = 'image' | 'read';

export function workspaceFileFromResponse(
  path: string,
  value: WorkspaceTextResponse | WorkspaceImageResponse,
  imagePreview: boolean,
): WorkspaceFile {
  if (imagePreview) {
    const image = value as WorkspaceImageResponse;
    return {
      path,
      content: '',
      dirty: false,
      mtime: image.mtime ?? null,
      kind: 'image',
      size: image.size ?? 0,
      mediaType: image.mediaType ?? '',
    };
  }
  const text = value as WorkspaceTextResponse;
  return {
    path,
    content: text.content,
    dirty: false,
    mtime: text.mtime ?? null,
  };
}

export function workspaceReloadOperation(file: WorkspaceFile | null | undefined): WorkspaceReloadOperation {
  return file?.kind === 'image' ? 'image' : 'read';
}

export function workspaceFileAfterReload(
  file: WorkspaceFile,
  value: WorkspaceTextResponse | WorkspaceImageResponse,
): WorkspaceFile {
  if (file.kind === 'image') {
    const image = value as WorkspaceImageResponse;
    return {
      ...file,
      dirty: false,
      size: image.size ?? file.size,
      mtime: image.mtime ?? file.mtime,
      mediaType: image.mediaType ?? file.mediaType,
    };
  }
  const text = value as WorkspaceTextResponse;
  return {
    ...file,
    content: text.content,
    dirty: false,
    mtime: text.mtime ?? file.mtime,
  };
}
