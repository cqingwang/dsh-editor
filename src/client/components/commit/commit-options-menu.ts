type CommitMenuTranslate = (key: string, params?: Record<string, unknown>) => string;

interface CommitMenuPosition {
  x: number;
  y: number;
}

interface CommitMenuItem {
  id: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  restoreFocus?: boolean;
  run?: () => void;
  items?: Array<CommitMenuItem | null>;
}

interface CommitMenu {
  owner?: string;
  x: number;
  y: number;
  title: string;
  items: Array<CommitMenuItem | null>;
}

interface ChangeGroupMenuOptions {
  t: CommitMenuTranslate;
  position: CommitMenuPosition;
  groupBy: string;
  keepOpen?: boolean;
  onApplyChangeGroupBy: (mode: string) => void;
}

interface ChangesViewOptionsMenuOptions extends ChangeGroupMenuOptions {}

interface CommitOptionsMenuOptions {
  t: CommitMenuTranslate;
  position: CommitMenuPosition;
  gitNotManaged?: boolean;
  fetchBusy: boolean;
  updateBusy: boolean;
  commitBusy: boolean;
  stageAllAvailable: boolean;
  groupBy: string;
  onApplyChangeGroupBy: (mode: string) => void;
  onFetch: () => void;
  onUpdate: () => void;
  onApplyPatchFile: () => void;
  onApplyPatchClipboard: () => void;
  onStageAll: () => void;
  onStash: () => void;
  onShelve: () => void;
}

export function changeGroupMenu({
  t,
  position,
  groupBy,
  keepOpen = false,
  onApplyChangeGroupBy,
}: ChangeGroupMenuOptions): CommitMenu {
  return {
    x: position.x,
    y: position.y,
    title: t('editor.groupByMenu'),
    items: ['flat', 'module', 'directory'].map((mode) => ({
      id: `groupBy:${mode}`,
      label: t(`editor.groupBy_${mode}`),
      shortcut: groupBy === mode ? '✓' : '',
      keepOpen,
      restoreFocus: false,
      run: () => onApplyChangeGroupBy(mode),
    })),
  };
}

export function changesViewOptionsMenu({
  t,
  position,
  groupBy,
  onApplyChangeGroupBy,
}: ChangesViewOptionsMenuOptions): CommitMenu {
  const groupMenu = changeGroupMenu({
    t,
    position,
    groupBy,
    keepOpen: true,
    onApplyChangeGroupBy,
  });
  return {
    owner: 'changes-view-options',
    x: position.x,
    y: position.y,
    title: t('editor.viewOptions'),
    items: [
      {
        id: 'groupBy',
        label: t('editor.groupByMenu'),
        items: groupMenu.items,
      },
    ],
  };
}

export function commitOptionsMenu({
  t,
  position,
  gitNotManaged = false,
  fetchBusy,
  updateBusy,
  commitBusy,
  stageAllAvailable,
  groupBy,
  onApplyChangeGroupBy,
  onFetch,
  onUpdate,
  onApplyPatchFile,
  onApplyPatchClipboard,
  onStageAll,
  onStash,
  onShelve,
}: CommitOptionsMenuOptions): CommitMenu {
  const groupMenu = changeGroupMenu({
    t,
    position,
    groupBy,
    onApplyChangeGroupBy,
  });
  return {
    owner: 'commit-options',
    x: position.x,
    y: position.y,
    title: t('editor.commitOptions'),
    items: [
      {
        id: 'fetch',
        label: fetchBusy ? t('editor.fetchBusy') : t('editor.fetchRemote'),
        disabled: gitNotManaged || fetchBusy,
        run: onFetch,
      },
      {
        id: 'update',
        label: updateBusy ? t('editor.updateBusy') : t('editor.updateProject'),
        disabled: gitNotManaged || updateBusy,
        run: onUpdate,
      },
      null,
      {
        id: 'applyPatchFile',
        label: t('editor.applyPatch'),
        disabled: gitNotManaged || commitBusy,
        run: onApplyPatchFile,
      },
      {
        id: 'applyPatchClipboard',
        label: t('editor.applyPatchFromClipboard'),
        disabled: gitNotManaged || commitBusy,
        run: onApplyPatchClipboard,
      },
      null,
      {
        id: 'stageAll',
        label: t('editor.stageAll'),
        disabled: gitNotManaged || commitBusy || !stageAllAvailable,
        run: onStageAll,
      },
      null,
      {
        id: 'stash',
        label: t('editor.stash'),
        disabled: gitNotManaged,
        run: onStash,
      },
      {
        id: 'shelve',
        label: t('editor.shelve'),
        disabled: gitNotManaged,
        run: onShelve,
      },
      null,
      {
        id: 'groupBy',
        label: t('editor.groupByMenu'),
        items: groupMenu.items,
      },
    ],
  };
}
