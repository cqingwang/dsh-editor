export { ActivityStripe, type ActivityStripeProps } from './ActivityStripe.tsx';
export { CompactActionBar } from './CompactActionBar.tsx';
export {
  commitMetrics,
  selectionStateOf,
  subtotalOf,
  type ChangeLineCounts,
  type CommitBand,
  type CommitMetrics,
  type CommitSelectionState,
  type LineStats,
} from './commit-model.ts';
export { DiffViewModeControl } from './DiffViewModeControl.tsx';
export {
  diffSideLabels,
  diffViewStateKey,
  transferDiffLine,
  type DiffLineChange,
  type DiffSideLabels,
  type DiffTarget,
  type DiffTargetEntry,
} from './diff-model.ts';
export { DockResizeHandle, type DockResizeHandleProps } from './DockResizeHandle.tsx';
export { EntryIcon, type EntryIconEntry, type EntryIconProps } from './EntryIcon.tsx';
export { fileBadge, type FileBadgeInfo } from './file-badge.ts';
export {
  dialogFocusableElements,
  nextDialogFocusTarget,
  trapDialogFocus,
  type DialogFocusTrapOptions,
} from './focus-trap.ts';
export { focusSurfaceWhenReady, type FocusableSurface, type FocusSurfaceWhenReadyOptions } from './focus-surface.ts';
export { GitStatusBadge, type GitStatusBadgeProps } from './GitStatusBadge.tsx';
export {
  allPathsUnversioned,
  badgeFor,
  canCompareWithHead,
  pathsScheduledForRemoval,
  type GitChange,
  type GitChangeSelection,
  type GitChangeStatusMap,
  type GitStatusMap,
} from './git-change-model.ts';
export { gitStatusInfo, type GitStatusInfo } from './git-status-model.ts';
export { Icon, POPUP_ICON_SIZE, type IconProps } from './Icon.tsx';
export { LineCounts, type LineCountsProps, type LineCountsValue } from './LineCounts.tsx';
export { ContextMenu, type ContextMenuModel, type ContextMenuProps, type MenuAction, type MenuEntry } from './Menu.tsx';
export {
  menuStep,
  submenuGeometry,
  submenuKeyAction,
  submenuSide,
  type MenuKeyState,
  type MenuStepItem,
  type SubmenuGeometry,
  type SubmenuPlacement,
  type SubmenuSideGeometry,
} from './menu-model.ts';
export { PanelToolbar } from './PanelToolbar.tsx';
export { PathLabel, splitPathLabel, type PathLabelParts, type PathLabelProps } from './PathLabel.tsx';
export { ToolbarButton, type ToolbarButtonProps } from './ToolbarButton.tsx';
export { TreeMessage, type TreeMessageProps } from './TreeMessage.tsx';
export {
  groupCompactActions,
  panelToolbarFit,
  selectCompactActions,
  toolbarActionActive,
  type ToolbarActionLike,
} from './toolbar-model.ts';
