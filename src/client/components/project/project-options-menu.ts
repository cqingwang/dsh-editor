type ProjectMenuTranslate = (key: string, params?: Record<string, unknown>) => string;

interface ProjectMenuPosition {
  x: number;
  y: number;
}

interface ProjectMenuItem {
  id: string;
  kind?: 'section';
  label: string;
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

interface ProjectOptionsMenuOptions {
  t: ProjectMenuTranslate;
  position: ProjectMenuPosition;
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

type ProjectOptionsMenuItemsOptions = Omit<ProjectOptionsMenuOptions, 'position'>;

export function projectOptionsMenuItems({
  t,
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
  onTogglePreviewTab,
  onToggleSingleClickOpen,
  onToggleOpenDirectoriesSingleClick,
  onToggleShowExcludedFiles,
  onToggleCompactDirectories,
  onToggleHidden,
  onApplySortMode,
  onResetManualOrder,
  onToggleFoldersFirst,
}: ProjectOptionsMenuItemsOptions): Array<ProjectMenuItem | null> {
  return [
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
  ];
}

export function projectOptionsMenu(options: ProjectOptionsMenuOptions): ProjectMenu {
  return {
    owner: 'project-options',
    x: options.position.x,
    y: options.position.y,
    title: options.t('editor.options'),
    items: projectOptionsMenuItems(options),
  };
}
