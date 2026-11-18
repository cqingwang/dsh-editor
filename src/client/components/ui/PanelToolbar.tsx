import React from 'react';
import { styles } from '../../ui/styles';
import { Icon } from './Icon';
import { ToolbarButton } from './ToolbarButton';
import { groupCompactActions, panelToolbarFit, selectCompactActions, toolbarActionActive } from './toolbar-model';
function PanelToolbar({
  icon,
  title,
  titleAction = null,
  titleActionStyle = null,
  left = [],
  right = [],
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
}) {
  const ref = React.useRef(null);
  const titleRef = React.useRef(null);
  const badgeRef = React.useRef(null);
  const [fits, setFits] = React.useState({
    left: left.length,
    right: right.length,
  });
  const [menu, setMenu] = React.useState(null);
  const leftKey = left.map((action) => action.id).join('|');
  const rightKey = right.map((action) => action.id).join('|');
  React.useLayoutEffect(() => {
    const node = ref.current;
    if (node === null) return;
    const measure = () => {
      const next = panelToolbarFit(
        node.clientWidth,
        titleRef.current?.offsetWidth ?? 0,
        left.length,
        right.length,
        badgeRef.current?.offsetWidth ?? 0,
        left.filter((action) => action.pinned === true).length,
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
    return () => observer?.disconnect();
  }, [leftKey, rightKey, badge]);

  /* A group's first N actions are the ones that fit. RIGHT is measured
     from its tail, so materialise the kept suffix after the head-kept
     left group. */
  const directLeft = selectCompactActions(left, fits.left);
  const hidden = [
    ...left.filter((action) => directLeft.includes(action) === false),
    ...right.slice(0, right.length - fits.right),
  ];
  const openOverflowMenu = (rect) => {
    setMenu({
      x: Math.max(4, rect.right - 188),
      y: rect.bottom + 4,
      items: groupCompactActions(hidden).map((action) =>
        action === null
          ? null
          : {
              id: action.id,
              label: action.label,
              shortcut: action.active === true ? '✓' : '',
              disabled: action.disabled === true,
              active: typeof action.active === 'boolean' ? action.active : undefined,
              run: () => action.onClick(),
              ariaKeyShortcuts: action.ariaKeyShortcuts,
            },
      ),
    });
  };
  const renderAction = (action) => (
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
    />
  );
  return (
    <div
      ref={ref}
      style={{
        ...styles.panelToolbar,
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
                maxWidth: '45%',
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
      <span style={styles.toolbarSpacer} />
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
      {right.slice(right.length - fits.right).map(renderAction)}
      {hidden.length === 0 ? null : (
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
        />
      )}
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
