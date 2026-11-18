type CommitLogMenuTranslate = (key: string, params?: Record<string, unknown>) => string;

interface CommitLogMenuPosition {
  x: number;
  y: number;
}

interface CommitLogTarget {
  hash: string;
  subject?: string;
}

interface CommitLogMenuItem {
  id: string;
  label?: string;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  run?: () => void;
  items?: Array<CommitLogMenuItem | null>;
}

interface CommitLogMenu {
  x: number;
  y: number;
  items: Array<CommitLogMenuItem | null>;
}

interface CommitLogMenuOptions {
  t: CommitLogMenuTranslate;
  position: CommitLogMenuPosition;
  commit: CommitLogTarget;
  selectionHashes: string[];
  parentTargets: CommitLogTarget[];
  childTargets: CommitLogTarget[];
  detached: boolean;
  onShowCommit: (hash: string) => void;
  onShowCommitHistory: (hash: string) => void;
  onCompareRevisions: (hashes: string[]) => void;
  onCompareWithLocal: (hash: string) => void;
  onRunHistoryAction: (action: 'cherryPick' | 'revert', hash: string) => void;
  onCreateTag: (hash: string) => void;
  onCreateCommitPatch: (hash: string) => void;
  onCheckoutRevision: (hash: string) => void;
  onCreateBranch: (hash: string) => void;
  onResetBranchHere: (hash: string, mode: 'soft' | 'mixed' | 'hard') => void;
  onCopyText: (value: string) => void;
}

export function commitLogMenu({
  t,
  position,
  commit,
  selectionHashes,
  parentTargets,
  childTargets,
  detached,
  onShowCommit,
  onShowCommitHistory,
  onCompareRevisions,
  onCompareWithLocal,
  onRunHistoryAction,
  onCreateTag,
  onCreateCommitPatch,
  onCheckoutRevision,
  onCreateBranch,
  onResetBranchHere,
  onCopyText,
}: CommitLogMenuOptions): CommitLogMenu {
  const relationItems = (prefix: string, targets: CommitLogTarget[]) =>
    targets.map((target) => ({
      id: `${prefix}:${target.hash}`,
      label: `${target.hash.slice(0, 7)} ${target.subject}`,
      run: () => onShowCommit(target.hash),
    }));
  return {
    x: position.x,
    y: position.y,
    items: [
      ...(selectionHashes.length === 2
        ? [
            {
              id: 'compareRevisions',
              label: t('editor.compareRevisionsAction'),
              run: () => onCompareRevisions(selectionHashes),
            },
            null,
          ]
        : []),
      {
        id: 'show',
        label: t('editor.openCommitDetails'),
        run: () => onShowCommit(commit.hash),
      },
      {
        id: 'history',
        label: t('editor.fileHistoryOfCommit'),
        run: () => onShowCommitHistory(commit.hash),
      },
      {
        id: 'compareWithLocalCommit',
        label: t('editor.compareWithLocalCommitAction'),
        run: () => onCompareWithLocal(commit.hash),
      },
      null,
      {
        id: 'goToChildCommit',
        label: t('editor.goToChildCommitAction'),
        shortcut: '←',
        disabled: childTargets.length === 0,
        ...(childTargets.length > 1
          ? { items: relationItems('goToChild', childTargets) }
          : {
              run: () => {
                if (childTargets[0] !== undefined) onShowCommit(childTargets[0].hash);
              },
            }),
      },
      {
        id: 'goToParentCommit',
        label: t('editor.goToParentCommitAction'),
        shortcut: '→',
        disabled: parentTargets.length === 0,
        ...(parentTargets.length > 1
          ? { items: relationItems('goToParent', parentTargets) }
          : {
              run: () => {
                if (parentTargets[0] !== undefined) onShowCommit(parentTargets[0].hash);
              },
            }),
      },
      null,
      {
        id: 'cherryPick',
        label: t('editor.cherryPick'),
        run: () => onRunHistoryAction('cherryPick', commit.hash),
      },
      {
        id: 'revert',
        label: t('editor.revertCommit'),
        danger: true,
        run: () => onRunHistoryAction('revert', commit.hash),
      },
      null,
      {
        id: 'createTag',
        label: t('editor.createTagAction'),
        run: () => onCreateTag(commit.hash),
      },
      {
        id: 'createCommitPatch',
        label: t('editor.createPatchFromCommitAction'),
        run: () => onCreateCommitPatch(commit.hash),
      },
      null,
      {
        id: 'checkoutRevision',
        label: t('editor.checkoutRevision'),
        run: () => onCheckoutRevision(commit.hash),
      },
      {
        id: 'newBranchFromCommit',
        label: t('editor.newBranchFromCommitAction', {
          hash: commit.hash.slice(0, 7),
        }),
        run: () => onCreateBranch(commit.hash),
      },
      {
        id: 'resetBranchHere',
        label: t('editor.resetBranchHereAction'),
        disabled: detached,
        items: [
          {
            id: 'resetSoft',
            label: t('editor.resetSoft'),
            run: () => onResetBranchHere(commit.hash, 'soft'),
          },
          {
            id: 'resetMixed',
            label: t('editor.resetMixed'),
            run: () => onResetBranchHere(commit.hash, 'mixed'),
          },
          {
            id: 'resetHard',
            label: t('editor.resetHard'),
            danger: true,
            run: () => onResetBranchHere(commit.hash, 'hard'),
          },
        ],
      },
      null,
      {
        id: 'copyHash',
        label: t('editor.copyHash'),
        run: () => onCopyText(commit.hash),
      },
      {
        id: 'copySubject',
        label: t('editor.copySubject'),
        disabled: typeof commit.subject !== 'string' || commit.subject === '',
        run: () => onCopyText(commit.subject ?? ''),
      },
    ],
  };
}
