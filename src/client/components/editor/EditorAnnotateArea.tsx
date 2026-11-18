import React from 'react';
import { AnnotatePreview } from '../diff/AnnotatePreview';

type Translate = (key: string, params?: Record<string, unknown>) => string;

interface AnnotateTarget {
  path?: string;
  [key: string]: unknown;
}

interface AnnotateLine {
  [key: string]: unknown;
}

export interface EditorAnnotateAreaProps {
  active: boolean;
  t: Translate;
  target: AnnotateTarget;
  lines: AnnotateLine[];
  loading: boolean;
  truncated: boolean;
  onClose: () => void;
  onOpenCommit?: (hash: string) => void;
  selected: string | null;
}

function EditorAnnotateArea({
  active,
  t,
  target,
  lines,
  loading,
  truncated,
  onClose,
  onOpenCommit,
  selected,
}: EditorAnnotateAreaProps) {
  if (!active || target === null) return null;
  return (
    <AnnotatePreview
      t={t}
      target={target}
      lines={lines}
      loading={loading}
      truncated={truncated}
      onClose={onClose}
      onOpenCommit={onOpenCommit}
      selected={selected}
    />
  );
}

export { EditorAnnotateArea };
