import React from 'react';
import { styles } from '../../ui/styles';
import { Icon } from './Icon';
import { ContextMenu, type MenuEntry } from './Menu';
import { ToolbarButton } from './ToolbarButton';
import {
  groupCompactActions,
  panelToolbarFit,
  selectCompactActions,
  toolbarActionActive,
  type ToolbarActionLike,
} from './toolbar-model';

interface PanelToolbarProps {
  icon?: string;
  title?: React.ReactNode;
  titleAction?: React.ReactNode;
  titleActionStyle?: React.CSSProperties | null;
  titleFlexible?: boolean;
  left?: ToolbarActionLike[];
  right?: ToolbarActionLike[];
  trailingRight?: ToolbarActionLike[];
  overflowMenuItems?: MenuEntry[];
  badge?: React.ReactNode;
  t: (key: string, params?: Record<string, unknown>) => string;
  onBadge?: (position: { x: number; y: number }) => void;
  badgeHasPopup?: boolean | 'menu' | 'dialog' | 'listbox' | 'tree' | 'grid';
  badgeExpanded?: boolean;
  ariaLabel?: string;
  dropActive?: boolean;
  onDragEnter?: React.DragEventHandler<HTMLDivElement>;
  onDragLeave?: React.DragEventHandler<HTMLDivElement>;
  onDragOver?: React.DragEventHandler<HTMLDivElement>;
  onDrop?: React.DragEventHandler<HTMLDivElement>;
  dense?: boolean;
}

function PanelToolbar({
  icon,
  title,
  titleAction = null,
  titleActionStyle = null,
  titleFlexible = false,
  left = [],
  right = [],
  trailingRight = [],
  overflowMenuItems = [],
  badge = null,
  t,
  onBadge,
  badgeHasPopup = undefined,
  badgeExpanded = undefined,
  ariaLabel = null,
  dropActive = false,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  dense = false,
}: PanelToolbarProps) {
  const ref = React.useRef(null);
  const titleRef = React.useRef(null);
  const badgeRef = React.useRef(null);
  const [fits, setFits] = React.useState({
    left: left.length,
    right: right.length + trailingRight.length,
  });
  const [menu, setMenu] = React.useState(null);
  const leftKey = left.map((action) => action.id).join('|');
  const combinedRight = [...right, ...trailingRight];
  const rightKey = combinedRight.map((action) => action.id).join('|');
  const overflowKey = overflowMenuItems.map((item) => item?.id ?? 'separator').join('|');
  const actionSlotWidth = dense ? 22 : 25;
  React.useLayoutEffect(() => {
    const node = ref.current;
    if (node === null) return;
    const measure = () => {
      const next = panelToolbarFit(
        node.clientWidth,
        titleFlexible ? 0 : (titleRef.current?.offsetWidth ?? 0),
        left.length,
        combinedRight.length,
        badgeRef.current?.offsetWidth ?? 0,
        left.filter((action) => action.pinned === true).length,
        actionSlotWidth,
        overflowMenuItems.length,
      );
      const nextLeft = next.left;
      const nextRight = next.right;
      setFits((current) =>
        current.left === nextLeft && current.right === nextRight
          ? current
          : {
              left: nextLeft,
              right: nextRight,
            },
      );
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(node);
    if (titleRef.current !== null) observer?.observe(titleRef.current);
    return () => observer?.disconnect();
  }, [actionSlotWidth, badge, leftKey, overflowKey, rightKey, titleFlexible]);

  /* A group's first N actions are the ones that fit. RIGHT is measured
     from its tail, so materialise the kept suffix after the head-kept
     left group. */
  const directLeft = selectCompactActions(left, fits.left);
  const hidden = [
    ...left.filter((action) => directLeft.includes(action) === false),
    ...combinedRight.slice(0, combinedRight.length - fits.right),
  ];
  const directRight = combinedRight.slice(combinedRight.length - fits.right);
  const directTrailingCount = Math.min(trailingRight.length, directRight.length);
  const directRightBeforeTrailing = directRight.slice(0, directRight.length - directTrailingCount);
  const directTrailing = directRight.slice(directRight.length - directTrailingCount);
  const hiddenMenuEntries: MenuEntry[] = groupCompactActions(hidden).map((action) =>
    action === null
      ? null
      : {
          id: action.id,
          label: action.label ?? action.id,
          shortcut: action.active === true ? '✓' : '',
          disabled: action.disabled === true,
          active: typeof action.active === 'boolean' ? action.active : undefined,
          run: () => action.onClick?.(),
          ariaKeyShortcuts: action.ariaKeyShortcuts,
        },
  );
  const overflowMenuEntries: MenuEntry[] = [
    ...hiddenMenuEntries,
    ...(hiddenMenuEntries.length > 0 && overflowMenuItems.length > 0 ? [null] : []),
    ...overflowMenuItems,
  ];
  const openOverflowMenu = (rect: DOMRect) => {
    setMenu({
      x: Math.max(4, rect.right - 188),
      y: rect.bottom + 4,
      items: overflowMenuEntries,
    });
  };
  const renderAction = (action: ToolbarActionLike) => (
    <ToolbarButton
      key={action.id}
      icon={action.icon}
      label={action.label}
      disabled={action.disabled === true}
      active={toolbarActionActive(action)}
      onClick={action.onClick}
      ariaKeyShortcuts={action.ariaKeyShortcuts}
      ariaHasPopup={action.ariaHasPopup}
      ariaExpanded={action.ariaExpanded}
      style={dense ? { width: 22 } : null}
    />
  );
  return (
    <div
      ref={ref}
      style={{
        ...styles.panelToolbar,
        gap: dense ? 0 : 1,
        ...(dropActive
          ? {
              boxShadow: 'inset 0 -2px 0 var(--dsw-alias-state-business-primary)',
            }
          : null),
      }}
      role='toolbar'
      aria-label={ariaLabel}
      aria-orientation='horizontal'
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}>
      <span
        ref={titleRef}
        style={
          titleAction === null
            ? styles.panelTitle
            : {
                ...styles.panelTitle,
                ...(titleFlexible
                  ? {
                      flex: '1 1 0%',
                      maxWidth: 'none',
                      marginRight: 0,
                    }
                  : {
                      maxWidth: '45%',
                    }),
                ...(titleActionStyle ?? null),
              }
        }>
        {icon === undefined ? null : (
          <Icon
            name={icon}
            size={14}
          />
        )}
        {titleAction ?? title}
      </span>
      {directLeft.map(renderAction)}
      <span
        style={{
          ...styles.toolbarSpacer,
          ...(titleFlexible
            ? {
                flex: '0 0 auto',
              }
            : null),
          minWidth: dense ? 2 : 4,
        }}
      />
      {badge === null ? null : onBadge === undefined ? (
        <span
          ref={badgeRef}
          style={styles.branchChip}>
          {badge}
        </span>
      ) : (
        <button
          ref={badgeRef}
          type='button'
          className='dsh-editor-branch-button'
          style={{
            ...styles.branchChip,
            border: 'none',
            cursor: 'pointer',
          }}
          title={t('editor.branchPopup')}
          aria-label={t('editor.branchPopup')}
          aria-haspopup={badgeHasPopup}
          aria-expanded={badgeHasPopup === undefined ? undefined : badgeExpanded === true}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            onBadge({
              x: rect.left,
              y: rect.bottom + 4,
            });
          }}>
          {badge}
        </button>
      )}
      {directRightBeforeTrailing.map(renderAction)}
      {hidden.length === 0 && overflowMenuItems.length === 0 ? null : (
        <ToolbarButton
          icon='more'
          label={t('editor.moreActions')}
          onClick={(event) => {
            openOverflowMenu(event.currentTarget.getBoundingClientRect());
          }}
          onKeyDown={(event) => {
            if (event.key === 'ContextMenu' || (event.shiftKey === true && event.key === 'F10')) {
              event.preventDefault();
              event.stopPropagation();
              openOverflowMenu(event.currentTarget.getBoundingClientRect());
            }
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openOverflowMenu(event.currentTarget.getBoundingClientRect());
          }}
          ariaHasPopup='menu'
          ariaExpanded={menu !== null}
          style={dense ? { width: 22 } : null}
        />
      )}
      {directTrailing.map(renderAction)}
      {menu === null ? null : (
        <ContextMenu
          menu={menu}
          onClose={() => setMenu(null)}
          t={t}
        />
      )}
    </div>
  );
}
export { PanelToolbar };
