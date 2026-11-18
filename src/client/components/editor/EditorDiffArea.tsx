import React from 'react';
import { DiffPreview } from '../diff/DiffPreview';
import { RepositoryVersionPreview } from '../diff/RepositoryVersionPreview';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface EditorDiffAreaProps {
  active: boolean;
  t: Translate;
  target: any;
  monacoReady: boolean;
  includedInCommit: boolean;
  onClose: () => void;
  onRestored?: (...args: any[]) => void;
  onStatus?: (...args: any[]) => void;
  onNotice?: (...args: any[]) => void;
  onNavigate?: (...args: any[]) => void;
  filePosition?: any;
  onPreviousFile?: () => void;
  onNextFile?: () => void;
  onOpenLocal?: (path: string) => void;
  undoRef?: React.MutableRefObject<any>;
  redoRef?: React.MutableRefObject<any>;
  viewStatesRef?: React.MutableRefObject<Map<string, any>>;
  searchInChangesRef?: React.MutableRefObject<(() => void) | null> | null;
}

function EditorDiffArea({
  active,
  t,
  target,
  monacoReady,
  includedInCommit,
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
      monacoReady={monacoReady}
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
