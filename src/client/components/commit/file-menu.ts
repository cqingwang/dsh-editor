type CommitFileMenuTranslate = (key: string, params?: Record<string, unknown>) => string;

interface CommitFileMenuPosition {
  x: number;
  y: number;
}

interface CommitFileMenuItem {
  id: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  run: () => void;
}

interface CommitFileMenu {
  x: number;
  y: number;
  items: CommitFileMenuItem[];
}

interface CommitFileMenuOptions {
  t: CommitFileMenuTranslate;
  position: CommitFileMenuPosition;
  path: string;
  hash?: string | null;
  localExists?: boolean | null;
  localDirExists?: boolean | null;
  absoluteClipboardPath: string;
  onShowDiff: (target: { hash: string; path: string }) => void;
  onOpenRepositoryVersion: (target: { hash: string; path: string }) => void;
  onRevealPath: (path: string) => void;
  onOpenTerminal: (path: string) => void;
  onEditLocalVersion: (path: string) => void;
  onShowFileHistory: (path: string) => void;
  onCopyText: (value: string) => void;
}

export function commitFileMenu({
  t,
  position,
  path,
  hash,
  localExists,
  localDirExists,
  absoluteClipboardPath,
  onShowDiff,
  onOpenRepositoryVersion,
  onRevealPath,
  onOpenTerminal,
  onEditLocalVersion,
  onShowFileHistory,
  onCopyText,
}: CommitFileMenuOptions): CommitFileMenu {
  const revisionHash = typeof hash === 'string' && hash !== '' ? hash : '';
  const revisionAvailable = revisionHash !== '';
  return {
    x: position.x,
    y: position.y,
    items: [
      {
        id: 'diff',
        label: t('editor.showDiff'),
        disabled: !revisionAvailable,
        run: () => {
          if (revisionAvailable) onShowDiff({ hash: revisionHash, path });
        },
      },
      {
        id: 'openRepositoryVersion',
        label: t('editor.openRepositoryVersionAction'),
        disabled: !revisionAvailable,
        run: () => {
          if (revisionAvailable) onOpenRepositoryVersion({ hash: revisionHash, path });
        },
      },
      {
        id: 'reveal',
        label: t('editor.revealInProject'),
        run: () => onRevealPath(path),
      },
      {
        id: 'openTerminal',
        label: t('editor.openInTerminal'),
        disabled: localDirExists === false,
        run: () => {
          if (localDirExists !== false) onOpenTerminal(path);
        },
      },
      {
        id: 'openLocalVersion',
        label: t('editor.openLocalVersion'),
        shortcut: 'F4',
        disabled: localExists === false,
        run: () => {
          if (localExists !== false) onEditLocalVersion(path);
        },
      },
      {
        id: 'history',
        label: t('editor.showHistory'),
        run: () => onShowFileHistory(path),
      },
      {
        id: 'copyRelative',
        label: t('editor.copyRelativePath'),
        run: () => onCopyText(path),
      },
      {
        id: 'copyAbsolute',
        label: t('editor.copyAbsolutePath'),
        run: () => onCopyText(absoluteClipboardPath),
      },
    ],
  };
}
