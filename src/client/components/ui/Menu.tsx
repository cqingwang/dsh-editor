import React from 'react';
import { styles } from '../../ui/styles';
import { submenuGeometry } from './menu-model';

export interface MenuAction {
  id: string;
  label: string;
  kind?: 'section' | string;
  items?: MenuEntry[];
  active?: boolean;
  ariaKeyShortcuts?: string;
  danger?: boolean;
  disabled?: boolean;
  keepOpen?: boolean;
  restoreFocus?: boolean;
  run?: () => void;
  shortcut?: string;
  swatch?: string;
}

export type MenuEntry = MenuAction | null;

export interface ContextMenuModel {
  x: number;
  y: number;
  items: MenuEntry[];
  title?: string;
  maxHeight?: number;
  fallbackFocus?: () => void;
}

export interface ContextMenuProps {
  menu: ContextMenuModel;
  onClose: () => void;
  t?: (key: string, params?: Record<string, unknown>) => string;
}

export function ContextMenu({ menu, onClose }: ContextMenuProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = React.useState({
    left: menu.x,
    top: menu.y,
  });
  /* IDEA nests destructive variants under one entry; only one child may open. */
  const [submenu, setSubmenu] = React.useState<string | null>(null);
  /* The hovered parent item's box decides which side the child opens on. */
  const [itemRect, setItemRect] = React.useState<DOMRect | null>(null);
  const returnFocusRef = React.useRef<HTMLElement | null>(null);
  const skipReturnFocusRef = React.useRef(false);

  React.useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = ref.current?.querySelector<HTMLButtonElement>('button[data-menu-item-id]:not(:disabled)');
    first?.focus();
    return () => {
      if (skipReturnFocusRef.current) return;
      const previous = returnFocusRef.current;
      if (previous !== null && previous.isConnected) previous.focus();
      else menu.fallbackFocus?.();
    };
  }, []);

  React.useLayoutEffect(() => {
    const node = ref.current;
    if (node === null) return;
    const rect = node.getBoundingClientRect();
    const left = Math.min(menu.x, window.innerWidth - rect.width - 8);
    const top = Math.min(menu.y, window.innerHeight - rect.height - 8);
    setPosition({
      left: Math.max(4, left),
      top: Math.max(4, top),
    });
  }, [menu]);

  React.useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current?.contains(event.target as Node)) return;
      onClose();
    };
    const itemButton = (id: string): HTMLButtonElement | null =>
      [...(ref.current?.querySelectorAll<HTMLButtonElement>('button[data-menu-item-id]') ?? [])].find(
        (button) => button.getAttribute('data-menu-item-id') === id,
      ) ?? null;
    const topButtons = (): HTMLButtonElement[] => [
      ...(ref.current?.querySelectorAll<HTMLButtonElement>(':scope > button[data-menu-item-id]:not(:disabled)') ?? []),
    ];
    const childButtons = (id: string): HTMLButtonElement[] => {
      const parent = itemButton(id);
      return [
        ...(parent
          ?.querySelector('[role="menu"]')
          ?.querySelectorAll<HTMLButtonElement>('button[data-menu-item-id]:not(:disabled)') ?? []),
      ];
    };
    const openSubmenu = (item: MenuAction) => {
      const parent = itemButton(item.id);
      if (parent !== null) setItemRect(parent.getBoundingClientRect());
      setSubmenu(item.id);
      /* React commits the child menu after keydown returns; timeout is reliable. */
      window.setTimeout(() => childButtons(item.id)[0]?.focus(), 0);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        const buttons = submenu === null ? topButtons() : childButtons(submenu);
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (buttons.length === 0) return;
        const delta = event.key === 'ArrowUp' ? -1 : 1;
        buttons[(index + delta + buttons.length) % buttons.length]?.focus();
        return;
      }
      const activeButton =
        document.activeElement instanceof HTMLElement
          ? document.activeElement.closest<HTMLButtonElement>('button[data-menu-item-id]')
          : null;
      if (event.key === 'ArrowRight') {
        if (submenu !== null || activeButton === null) return;
        const item = (menu.items ?? []).find(
          (entry) => entry !== null && entry.id === activeButton.getAttribute('data-menu-item-id'),
        ) as MenuAction | undefined;
        if (!Array.isArray(item?.items) || item.items.length === 0) return;
        event.preventDefault();
        event.stopPropagation();
        openSubmenu(item);
        return;
      }
      if (event.key === 'ArrowLeft' && submenu !== null) {
        event.preventDefault();
        event.stopPropagation();
        const parentId = submenu;
        setSubmenu(null);
        window.setTimeout(() => itemButton(parentId)?.focus(), 0);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (submenu === null) {
          onClose();
          return;
        }
        const parentId = submenu;
        setSubmenu(null);
        window.setTimeout(() => itemButton(parentId)?.focus(), 0);
      }
    };
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [menu.items, onClose, submenu]);

  return (
    <div
      ref={ref}
      className='dsh-editor-menu'
      style={{
        ...styles.menu,
        left: position.left,
        top: position.top,
        ...(Number.isFinite(menu.maxHeight)
          ? {
              maxHeight: Math.max(80, Math.round(menu.maxHeight ?? 0)),
              overflowY: 'auto',
            }
          : null),
      }}
      role='menu'
      onContextMenu={(event) => event.preventDefault()}>
      {/* An optional disabled header says how many rows an action affects. */}
      {menu.title ? (
        <div
          style={styles.menuTitle}
          role='presentation'>
          {menu.title}
        </div>
      ) : null}
      {menu.items.map((item, index) =>
        item === null ? (
          <div
            key={`sep-${index}`}
            style={styles.menuSeparator}
            role='separator'
          />
        ) : item.kind === 'section' ? (
          <div
            key={item.id}
            style={styles.menuSectionLabel}
            role='presentation'>
            {item.label}
          </div>
        ) : (
          <button
            key={item.id}
            type='button'
            role={typeof item.active === 'boolean' ? 'menuitemcheckbox' : 'menuitem'}
            data-menu-item-id={item.id}
            aria-label={item.label}
            aria-checked={typeof item.active === 'boolean' ? String(item.active) : undefined}
            aria-haspopup={Array.isArray(item.items) && item.items.length > 0 ? 'menu' : undefined}
            aria-expanded={Array.isArray(item.items) && item.items.length > 0 ? submenu === item.id : undefined}
            aria-keyshortcuts={item.ariaKeyShortcuts}
            className={item.danger ? 'dsh-editor-menu-item dsh-editor-menu-danger' : 'dsh-editor-menu-item'}
            style={{
              ...styles.menuItem,
              ...(item.danger ? styles.menuItemDanger : null),
              ...(item.disabled ? styles.menuItemDisabled : null),
            }}
            disabled={item.disabled === true}
            onMouseEnter={(event) => {
              const childHadFocus =
                document.activeElement instanceof Element &&
                document.activeElement.closest('[role="menu"]') !== ref.current;
              if (childHadFocus) event.currentTarget.focus();
              setItemRect(event.currentTarget.getBoundingClientRect());
              setSubmenu(Array.isArray(item.items) && item.items.length > 0 ? item.id : null);
            }}
            onClick={(event) => {
              const parent = event.currentTarget;
              if (Array.isArray(item.items) && item.items.length > 0) {
                setItemRect(parent.getBoundingClientRect());
                setSubmenu(item.id);
                /* Keyboard activation reports detail=0 and must land on the first child. */
                if (event.detail === 0) {
                  window.setTimeout(() => {
                    parent
                      .querySelector('[role="menu"]')
                      ?.querySelector<HTMLButtonElement>('button[data-menu-item-id]:not(:disabled)')
                      ?.focus();
                  }, 0);
                }
                return;
              }
              if (item.restoreFocus === false) skipReturnFocusRef.current = true;
              if (item.keepOpen !== true) onClose();
              item.run?.();
            }}>
            {/* A menu without swatches must not gain an empty colour gutter. */}
            {item.swatch === undefined || item.swatch === null ? null : (
              <span
                style={{
                  ...styles.menuSwatch,
                  background: item.swatch,
                }}
              />
            )}
            <span style={styles.menuLabel}>{item.label}</span>
            {item.shortcut === undefined || item.shortcut === '' ? null : (
              <span
                className='dsh-editor-menu-shortcut'
                style={styles.menuShortcut}>
                {item.shortcut}
              </span>
            )}
            {Array.isArray(item.items) && item.items.length > 0 ? (
              <span
                className='dsh-editor-menu-shortcut'
                style={styles.menuShortcut}>
                ›
              </span>
            ) : null}
            {Array.isArray(item.items) && item.items.length > 0 && submenu === item.id ? (
              <div
                style={(() => {
                  const placement = submenuGeometry({
                    parentLeft: itemRect?.left ?? 0,
                    parentRight: itemRect?.right ?? 0,
                    viewportWidth: window.innerWidth,
                    preferredWidth: 260,
                  });
                  return {
                    ...styles.submenu,
                    ...(placement.side === 'left' ? styles.submenuLeft : null),
                    maxWidth: `${Math.round(placement.maxWidth)}px`,
                  };
                })()}
                role='menu'>
                {item.items.map((child, childIndex) =>
                  child === null ? (
                    <div
                      key={`submenu-sep-${childIndex}`}
                      style={styles.menuSeparator}
                      role='separator'
                    />
                  ) : child.kind === 'section' ? (
                    <div
                      key={child.id}
                      style={styles.menuSectionLabel}
                      role='presentation'>
                      {child.label}
                    </div>
                  ) : (
                    <button
                      key={child.id}
                      type='button'
                      role={typeof child.active === 'boolean' ? 'menuitemcheckbox' : 'menuitem'}
                      data-menu-item-id={child.id}
                      aria-label={child.label}
                      aria-checked={typeof child.active === 'boolean' ? String(child.active) : undefined}
                      aria-haspopup={Array.isArray(child.items) && child.items.length > 0 ? 'menu' : undefined}
                      aria-expanded={
                        Array.isArray(child.items) && child.items.length > 0 ? submenu === child.id : undefined
                      }
                      aria-keyshortcuts={child.ariaKeyShortcuts}
                      className={child.danger ? 'dsh-editor-menu-item dsh-editor-menu-danger' : 'dsh-editor-menu-item'}
                      style={{
                        ...styles.menuItem,
                        ...(child.danger ? styles.menuItemDanger : null),
                        ...(child.disabled ? styles.menuItemDisabled : null),
                      }}
                      disabled={child.disabled === true}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (child.disabled === true) return;
                        if (child.restoreFocus === false) skipReturnFocusRef.current = true;
                        onClose();
                        child.run?.();
                      }}>
                      <span style={styles.menuLabel}>{child.label}</span>
                      {child.shortcut === undefined || child.shortcut === '' ? null : (
                        <span
                          className='dsh-editor-menu-shortcut'
                          style={styles.menuShortcut}>
                          {child.shortcut}
                        </span>
                      )}
                    </button>
                  ),
                )}
              </div>
            ) : null}
          </button>
        ),
      )}
    </div>
  );
}
