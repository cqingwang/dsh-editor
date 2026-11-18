type ProjectMenuTranslate = (key: string, params?: Record<string, unknown>) => string;

interface ProjectMenuPosition {
  x: number;
  y: number;
}

interface ProjectMenuItem {
  id: string;
  kind?: 'section';
  label?: string;
  shortcut?: string;
  disabled?: boolean;
  restoreFocus?: boolean;
  run?: () => void;
  items?: Array<ProjectMenuItem | null>;
}

interface ProjectMenu {
  owner?: string;
  x: number;
  y: number;
  title: string;
  items: Array<ProjectMenuItem | null>;
}

interface ProjectCreateMenuOptions {
  t: ProjectMenuTranslate;
  position: ProjectMenuPosition;
  onStartCreate: (kind: 'file' | 'directory') => void;
}

interface ProjectOptionsMenuOptions {
  t: ProjectMenuTranslate;
  position: ProjectMenuPosition;
  expandAllAvailable: boolean;
  previewTabEnabled: boolean;
  singleClickOpen: boolean;
  openDirectoriesSingleClick: boolean;
  showExcludedFiles: boolean;
  compactDirectories: boolean;
  showHidden: boolean;
  sortMode: string | null | undefined;
  manualOrderEmpty: boolean;
  foldersFirst: boolean;
  onRefresh: () => void;
  onGotoFile: () => void;
  onRecentFiles: () => void;
  onExpandAll: () => void;
  onTogglePreviewTab: () => void;
  onToggleSingleClickOpen: () => void;
  onToggleOpenDirectoriesSingleClick: () => void;
  onToggleShowExcludedFiles: () => void;
  onToggleCompactDirectories: () => void;
  onToggleHidden: () => void;
  onApplySortMode: (mode: string) => void;
  onResetManualOrder: () => void;
  onToggleFoldersFirst: () => void;
}

export function projectCreateMenu({ t, position, onStartCreate }: ProjectCreateMenuOptions): ProjectMenu {
  return {
    x: position.x,
    y: position.y,
    title: t('editor.newFile'),
    items: [
      {
        id: 'newFile',
        label: t('editor.newFile'),
        shortcut: '⌘N',
        run: () => onStartCreate('file'),
      },
      {
        id: 'newFolder',
        label: t('editor.newFolder'),
        shortcut: '⌥⌘N',
        run: () => onStartCreate('directory'),
      },
    ],
  };
}

export function projectOptionsMenu({
  t,
  position,
  expandAllAvailable,
  previewTabEnabled,
  singleClickOpen,
  openDirectoriesSingleClick,
  showExcludedFiles,
  compactDirectories,
  showHidden,
  sortMode,
  manualOrderEmpty,
  foldersFirst,
  onRefresh,
  onGotoFile,
  onRecentFiles,
  onExpandAll,
  onTogglePreviewTab,
  onToggleSingleClickOpen,
  onToggleOpenDirectoriesSingleClick,
  onToggleShowExcludedFiles,
  onToggleCompactDirectories,
  onToggleHidden,
  onApplySortMode,
  onResetManualOrder,
  onToggleFoldersFirst,
}: ProjectOptionsMenuOptions): ProjectMenu {
  return {
    owner: 'project-options',
    x: position.x,
    y: position.y,
    title: t('editor.options'),
    items: [
      {
        id: 'refresh',
        label: t('editor.refresh'),
        shortcut: '⌘R',
        restoreFocus: false,
        run: onRefresh,
      },
      {
        id: 'gotoFile',
        label: t('editor.gotoFileHint'),
        run: onGotoFile,
      },
      {
        id: 'recent',
        label: t('editor.recentFilesHint'),
        run: onRecentFiles,
      },
      null,
      {
        id: 'expandAll',
        label: t('editor.expandAll'),
        disabled: !expandAllAvailable,
        restoreFocus: false,
        run: onExpandAll,
      },
      null,
      {
        id: 'behavior',
        label: t('editor.projectOptionsBehavior'),
        items: [
          {
            id: 'previewTab',
            label: t('editor.projectPreviewTab'),
            shortcut: previewTabEnabled ? '✓' : '',
            restoreFocus: false,
            run: onTogglePreviewTab,
          },
          {
            id: 'singleClickOpen',
            label: t('editor.openFilesSingleClick'),
            shortcut: singleClickOpen ? '✓' : '',
            restoreFocus: false,
            run: onToggleSingleClickOpen,
          },
          {
            id: 'openDirectoriesSingleClick',
            label: t('editor.openDirectoriesSingleClick'),
            shortcut: openDirectoriesSingleClick ? '✓' : '',
            restoreFocus: false,
            run: onToggleOpenDirectoriesSingleClick,
          },
        ],
      },
      {
        id: 'appearance',
        label: t('editor.projectOptionsAppearance'),
        items: [
          {
            id: 'showSection',
            kind: 'section',
            label: t('editor.projectOptionsShow'),
          },
          {
            id: 'showExcludedFiles',
            label: t('editor.showExcludedFiles'),
            shortcut: showExcludedFiles ? '✓' : '',
            restoreFocus: false,
            run: onToggleShowExcludedFiles,
          },
          {
            id: 'compactDirectories',
            label: t('editor.compactDirectories'),
            shortcut: compactDirectories ? '✓' : '',
            restoreFocus: false,
            run: onToggleCompactDirectories,
          },
          {
            id: 'hidden',
            label: t('editor.showHidden'),
            shortcut: showHidden ? '✓' : '',
            restoreFocus: false,
            run: onToggleHidden,
          },
          null,
          {
            id: 'sortSection',
            kind: 'section',
            label: t('editor.projectOptionsSortBy'),
          },
          ...['name', 'type', 'modified', 'modified-asc', 'manual'].map((mode) => {
            const labelMode = mode === 'modified-asc' ? 'modified_asc' : mode;
            return {
              id: `sort:${mode}`,
              label: t(`editor.sort_${labelMode}`),
              shortcut: (sortMode ?? 'name') === mode ? '✓' : '',
              restoreFocus: false,
              run: () => onApplySortMode(mode),
            };
          }),
          {
            id: 'resetManualOrder',
            label: t('editor.resetManualOrderAction'),
            disabled: manualOrderEmpty,
            restoreFocus: false,
            run: onResetManualOrder,
          },
          {
            id: 'foldersFirst',
            label: t('editor.foldersAlwaysOnTop'),
            shortcut: foldersFirst ? '✓' : '',
            restoreFocus: false,
            run: onToggleFoldersFirst,
          },
        ],
      },
    ],
  };
}
