import React from 'react';
import { DiffPreview } from '../diff/DiffPreview';
import type { DiffTarget, DiffTextPosition } from '../diff/DiffPreview';
import { RepositoryVersionPreview } from '../diff/RepositoryVersionPreview';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface EditorDiffAreaProps {
  active: boolean;
  t: Translate;
  target: DiffTarget;
  monacoReady: boolean;
  includedInCommit: boolean;
  rollbackInclusion?: { included: boolean; onToggle: (included: boolean) => void };
  focusMode?: boolean;
  onToggleFocus?: () => void;
  onClose: () => void;
  onRestored?: (value: unknown) => void;
  onStatus?: (value: unknown) => void;
  onNotice?: (message: string) => void;
  onNavigate?: (target: DiffTarget) => void;
  filePosition?: DiffTextPosition | null;
  onPreviousFile?: () => void;
  onNextFile?: () => void;
  onOpenLocal?: (path: string) => void;
  undoRef?: React.MutableRefObject<unknown[]>;
  redoRef?: React.MutableRefObject<unknown[]>;
  viewStatesRef?: React.MutableRefObject<Map<string, Record<string, unknown>>>;
  searchInChangesRef?: React.MutableRefObject<(() => void) | null> | null;
}

function EditorDiffArea({
  active,
  t,
  target,
  monacoReady,
  includedInCommit,
  rollbackInclusion,
  focusMode = false,
  onToggleFocus,
  onClose,
  onRestored,
  onStatus,
  onNotice,
  onNavigate,
  filePosition,
  onPreviousFile,
  onNextFile,
  onOpenLocal,
  undoRef,
  redoRef,
  viewStatesRef,
  searchInChangesRef,
}: EditorDiffAreaProps) {
  if (!active || target === null) return null;
  if (target?.repositoryVersion !== null && typeof target?.repositoryVersion === 'object') {
    return (
      <RepositoryVersionPreview
        t={t}
        target={target}
        monacoReady={monacoReady}
        onClose={onClose}
        onOpenLocal={onOpenLocal}
      />
    );
  }
  return (
    <DiffPreview
      t={t}
      target={target}
      includedInCommit={includedInCommit}
      rollbackInclusion={rollbackInclusion}
      monacoReady={monacoReady}
      focusMode={focusMode}
      onToggleFocus={onToggleFocus}
      onClose={onClose}
      onRestored={onRestored}
      onStatus={onStatus}
      onNotice={onNotice}
      onNavigate={onNavigate}
      filePosition={filePosition}
      onPreviousFile={onPreviousFile}
      onNextFile={onNextFile}
      onOpenLocal={onOpenLocal}
      undoRef={undoRef}
      redoRef={redoRef}
      viewStatesRef={viewStatesRef}
      searchInChangesRef={searchInChangesRef}
    />
  );
}

export { EditorDiffArea };
