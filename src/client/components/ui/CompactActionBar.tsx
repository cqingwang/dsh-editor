import React from 'react';
import { styles } from '../../ui/styles';
import { ContextMenu } from './Menu';
import { ToolbarButton } from './ToolbarButton';
import {
  groupCompactActions,
  selectCompactActions,
  toolbarActionActive,
  type ToolbarActionLike,
} from './toolbar-model';

interface CompactActionBarProps {
  actions: ToolbarActionLike[];
  t: (key: string, params?: Record<string, unknown>) => string;
  ariaLabel: string;
  style?: React.CSSProperties | null;
  slotWidth?: number;
  className?: string;
}

function CompactActionBar({ actions, t, ariaLabel, style = null, slotWidth = 26, className }: CompactActionBarProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = React.useState(actions.length);
  const [menuPosition, setMenuPosition] = React.useState<{ x: number; y: number } | null>(null);
  const actionsKey = actions.map((action) => action.id).join('|');
  const actionSlotWidth = Math.max(26, Number(slotWidth) || 26);
  React.useLayoutEffect(() => {
    const node = ref.current;
    if (node === null) return;
    const measure = () => {
      const slots = Math.max(0, Math.floor((node.clientWidth - 8) / actionSlotWidth));
      const next = actions.length <= slots ? actions.length : Math.max(0, slots - 1);
      setVisibleCount((current) => (current === next ? current : next));
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(node);
    return () => observer?.disconnect();
    /* `visibleCount` is a dependency: the first measurement runs before the
       overflow button exists, so the available slot count must be measured
       again after that button changes the row's real width. */
  }, [actionSlotWidth, actionsKey, visibleCount]);
  const visibleActions = selectCompactActions(actions, visibleCount);
  const hidden = actions.filter((action) => visibleActions.includes(action) === false);
  const openOverflowMenu = (rect: DOMRect): void => {
    setMenuPosition({
      x: Math.max(4, rect.right - 200),
      y: rect.bottom + 4,
    });
  };
  const overflowMenu =
    menuPosition === null
      ? null
      : {
          ...menuPosition,
          items: groupCompactActions(hidden).map((action) =>
            action === null
              ? null
              : {
                  id: action.id,
                  label: action.label,
                  shortcut: action.active === true ? '✓' : '',
                  disabled: action.disabled === true,
                  active: typeof action.active === 'boolean' ? action.active : undefined,
                  run: () => action.onClick?.(),
                  ariaKeyShortcuts: action.ariaKeyShortcuts,
                },
          ),
        };
  return (
    <div
      ref={ref}
      className={className ?? undefined}
      style={{
        ...styles.commitActionBar,
        ...(style ?? {}),
      }}
      role='toolbar'
      aria-label={ariaLabel}>
      {visibleActions.map((action) => (
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
      ))}
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
          ariaExpanded={menuPosition !== null}
        />
      )}
      {overflowMenu === null ? null : (
        <ContextMenu
          menu={overflowMenu}
          onClose={() => setMenuPosition(null)}
          t={t}
        />
      )}
    </div>
  );
}
export { CompactActionBar };
