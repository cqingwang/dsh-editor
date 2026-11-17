/* menu.js: dsh-editor client module. Generated into lib/client.js by scripts/build-client.mjs. */
    function submenuKeyAction(key, state) {
      const hasChildren = state?.hasChildren === true;
      const open = state?.open === true;
      if (key === 'ArrowRight') {
        if (!hasChildren) return null;
        return open ? 'first-child' : 'open';
      }
      if (key === 'ArrowLeft') return hasChildren && open ? 'close' : 'back';
      if (key === 'Escape') return open ? 'close' : 'dismiss';
      return null;
    }

    /**
     * Move focus through an open menu's enabled rows, wrapping at the ends.
     *
     * Menus are rendered as buttons, so the same model serves Project Options,
     * Commit actions and every context menu. Separators and disabled rows are
     * intentionally skipped; disabled actions should not swallow arrow keys.
     * @param {Array<{disabled?: boolean}>} items - menu entries in visual order.
     * @param {number} activeIndex - focused row, or -1 when none is focused yet.
     * @param {'ArrowDown'|'ArrowUp'} key - direction.
     * @returns {number} next focusable row, or -1 when the menu has none.
     */
    function menuStep(items, activeIndex, key) {
      const focusable = [];
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        if (item === null || item === undefined || item.disabled === true) continue;
        focusable.push(index);
      }
      if (focusable.length === 0) return -1;
      const current = focusable.indexOf(Number(activeIndex));
      if (current < 0) return key === 'ArrowUp' ? focusable[focusable.length - 1] : focusable[0];
      const delta = key === 'ArrowUp' ? -1 : 1;
      return focusable[(current + delta + focusable.length) % focusable.length];
    }

    /**
     * Decide where a submenu opens and how wide it may get.
     *
     * Anchoring the child at the parent's edge is not enough: a tool window inside a
     * 560px viewport can leave less room than the child's own minimum. The side is
     * the one with more space, and the width is capped to that space so the menu
     * never spills off-screen.
     * @param {{parentLeft?: number, parentRight?: number, viewportWidth?: number, preferredWidth?: number}|null} geometry - measurements.
     * @returns {{side: 'right'|'left', maxWidth: number}} placement decision.
     */
    function submenuGeometry(geometry) {
      const fallback = { side: 'right', maxWidth: 260 };
      if (geometry === null || geometry === undefined) return fallback;
      const left = Number(geometry.parentLeft);
      const right = Number(geometry.parentRight);
      const viewport = Number(geometry.viewportWidth);
      const preferred = Number(geometry.preferredWidth ?? 260);
      if (![left, right, viewport, preferred].every((value) => Number.isFinite(value))) return fallback;
      if (viewport <= 0) return fallback;
      const roomRight = viewport - right - 8;
      const roomLeft = left - 8;
      /* Prefer the right when the child fits there; otherwise take whichever side
         has more room, so a narrow aside still shows a usable menu. */
      const side = roomRight >= preferred ? 'right' : roomLeft > roomRight ? 'left' : 'right';
      const room = side === 'right' ? roomRight : roomLeft;
      return { side, maxWidth: Math.max(140, Math.min(preferred, Math.max(room, 140))) };
    }

    /**
     * Which side a submenu opens on, given only the room to the parent's right.
     *
     * A thin wrapper over {@link submenuGeometry}: the child opens on the right when
     * its preferred width fits there, otherwise on the left (where the parent menu
     * itself proves there is room, since the menu was positioned on-screen first).
     * @param {{parentRight: number, viewportWidth: number, submenuWidth: number}|null} geometry - measurements.
     * @returns {'right'|'left'} the side to open on.
     */
    function submenuSide(geometry) {
      if (geometry === null || geometry === undefined) return 'right';
      const right = Number(geometry.parentRight);
      const viewport = Number(geometry.viewportWidth);
      const preferred = Number(geometry.submenuWidth);
      if (!Number.isFinite(right) || !Number.isFinite(viewport) || !Number.isFinite(preferred)) return 'right';
      if (viewport <= 0) return 'right';
      /* 8px keeps a small gutter against the window edge. */
      return viewport - right - 8 >= preferred ? 'right' : 'left';
    }

    function ContextMenu({ menu, onClose, t }) {
      const ref = React.useRef(null);
      const [position, setPosition] = React.useState({ left: menu.x, top: menu.y });
      /* IDEA nests destructive variants (Rollback) under one entry; the open child
         is tracked by the parent item's id so only one can be open at a time. */
      const [submenu, setSubmenu] = React.useState(null);
      /* The hovered parent item's box, used to decide which side the child opens. */
      const [itemRect, setItemRect] = React.useState(null);
      /* A menu dismissed by Escape or an action must hand keyboard ownership back
         to the control that opened it, not strand focus on a detached button. */
      const returnFocusRef = React.useRef(null);
      /* Actions such as Project Options deliberately move focus to a different
         surface (the tree). They suppress the generic opener restore below. */
      const skipReturnFocusRef = React.useRef(false);

      React.useEffect(() => {
        returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const first = ref.current?.querySelector('button[data-menu-item-id]:not(:disabled)');
        if (first instanceof HTMLElement) first.focus();
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
        setPosition({ left: Math.max(4, left), top: Math.max(4, top) });
      }, [menu]);

      React.useEffect(() => {
        const onPointerDown = (event) => {
          if (ref.current?.contains(event.target)) return;
          onClose();
        };
        const itemButton = (id) => [...(ref.current?.querySelectorAll('button[data-menu-item-id]') ?? [])]
          .find((button) => button.getAttribute('data-menu-item-id') === id) ?? null;
        const topButtons = () => [...(ref.current?.querySelectorAll(':scope > button[data-menu-item-id]:not(:disabled)') ?? [])];
        const childButtons = (id) => {
          const parent = itemButton(id);
          return [...(parent?.querySelector('[role="menu"]')?.querySelectorAll('button[data-menu-item-id]:not(:disabled)') ?? [])];
        };
        const openSubmenu = (item) => {
          const parent = itemButton(item.id);
          if (parent !== null) setItemRect(parent.getBoundingClientRect());
          setSubmenu(item.id);
          /* React commits the child menu after the keydown handler returns. A
             timeout reliably runs after that commit; requestAnimationFrame can
             execute before the child buttons exist. */
          window.setTimeout(() => childButtons(item.id)[0]?.focus(), 0);
        };
        const onKeyDown = (event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            event.stopPropagation();
            const buttons = submenu === null ? topButtons() : childButtons(submenu);
            const index = buttons.indexOf(document.activeElement);
            if (buttons.length === 0) return;
            const delta = event.key === 'ArrowUp' ? -1 : 1;
            buttons[(index + delta + buttons.length) % buttons.length]?.focus();
            return;
          }
          const activeButton = document.activeElement instanceof HTMLElement
            ? document.activeElement.closest('button[data-menu-item-id]')
            : null;
          if (event.key === 'ArrowRight') {
            if (submenu !== null || activeButton === null) return;
            const item = (menu.items ?? []).find((entry) => entry !== null && entry.id === activeButton.getAttribute('data-menu-item-id'));
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

      return React.createElement(
        'div',
        {
          ref,
          className: 'dsh-editor-menu',
          style: {
            ...styles.menu,
            left: position.left,
            top: position.top,
            ...(Number.isFinite(menu.maxHeight)
              ? { maxHeight: Math.max(80, Math.round(menu.maxHeight)), overflowY: 'auto' }
              : null),
          },
          role: 'menu',
          onContextMenu: (event) => event.preventDefault(),
        },
        /* An optional disabled header, used to say how many rows an action affects. */
        menu.title
          ? React.createElement('div', { style: styles.menuTitle, role: 'presentation' }, menu.title)
          : null,
        menu.items.map((item, index) =>
          item === null
            ? React.createElement('div', { key: `sep-${index}`, style: styles.menuSeparator, role: 'separator' })
            : item.kind === 'section'
              ? React.createElement('div', { key: item.id, style: styles.menuSectionLabel, role: 'presentation' }, item.label)
              : React.createElement(
                'button',
                {
                  key: item.id,
                  type: 'button',
                  role: typeof item.active === 'boolean' ? 'menuitemcheckbox' : 'menuitem',
                  'data-menu-item-id': item.id,
                  'aria-label': item.label,
                  'aria-checked': typeof item.active === 'boolean' ? String(item.active) : undefined,
                  'aria-haspopup': Array.isArray(item.items) && item.items.length > 0 ? 'menu' : undefined,
                  'aria-expanded': Array.isArray(item.items) && item.items.length > 0 ? submenu === item.id : undefined,
                  'aria-keyshortcuts': item.ariaKeyShortcuts,
                  className: item.danger ? 'dsh-editor-menu-item dsh-editor-menu-danger' : 'dsh-editor-menu-item',
                  style: { ...styles.menuItem, ...(item.danger ? styles.menuItemDanger : null), ...(item.disabled ? styles.menuItemDisabled : null) },
                  disabled: item.disabled === true,
                  /* Recover focus only from the child popup that hover closes. */
                  onMouseEnter: (event) => {
                    const childHadFocus = document.activeElement instanceof Element
                      && document.activeElement.closest('[role="menu"]') !== ref.current;
                    if (childHadFocus) event.currentTarget.focus();
                    setItemRect(event.currentTarget.getBoundingClientRect());
                    setSubmenu(Array.isArray(item.items) && item.items.length > 0 ? item.id : null);
                  },
                  onClick: (event) => {
                    const parent = event.currentTarget;
                    /* A parent with children only opens them; running it would fire
                       whatever its first child means. */
                    if (Array.isArray(item.items) && item.items.length > 0) {
                      setItemRect(parent.getBoundingClientRect());
                      setSubmenu(item.id);
                      /* Keyboard activation (Enter/Space) reports detail=0. Mouse
                         clicks should not steal focus, but keyboard users must land
                         on the first enabled child after React commits it. */
                      const keyboardActivation = event.detail === 0;
                      if (keyboardActivation) {
                        window.setTimeout(() => {
                          const nested = parent.querySelector('[role="menu"]');
                          nested?.querySelector('button[data-menu-item-id]:not(:disabled)')?.focus();
                        }, 0);
                      }
                      return;
                    }
                    if (item.restoreFocus === false) skipReturnFocusRef.current = true;
                    if (item.keepOpen !== true) onClose();
                    item.run();
                  },
                },
                /* IDEA's terminal lists show the tab's colour next to its name;
                   a menu without swatches must not gain an empty gutter. */
                item.swatch === undefined || item.swatch === null
                  ? null
                  : React.createElement('span', { style: { ...styles.menuSwatch, background: item.swatch } }),
                React.createElement('span', { style: styles.menuLabel }, item.label),
                item.shortcut === undefined || item.shortcut === ''
                  ? null
                  : React.createElement('span', { className: 'dsh-editor-menu-shortcut', style: styles.menuShortcut }, item.shortcut),
                Array.isArray(item.items) && item.items.length > 0
                  ? React.createElement('span', { className: 'dsh-editor-menu-shortcut', style: styles.menuShortcut }, '›')
                  : null,
                Array.isArray(item.items) && item.items.length > 0 && submenu === item.id
                  ? React.createElement(
                      'div',
                      {
                        style: (() => {
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
                        })(),
                        role: 'menu',
                      },
                      item.items.map((child, childIndex) =>
                        child === null
                          ? React.createElement('div', { key: `submenu-sep-${childIndex}`, style: styles.menuSeparator, role: 'separator' })
                          : child.kind === 'section'
                            ? React.createElement('div', { key: child.id, style: styles.menuSectionLabel, role: 'presentation' }, child.label)
                            : React.createElement(
                              'button',
                              {
                                key: child.id,
                                type: 'button',
                                role: typeof child.active === 'boolean' ? 'menuitemcheckbox' : 'menuitem',
                                'data-menu-item-id': child.id,
                                'aria-label': child.label,
                                'aria-checked': typeof child.active === 'boolean' ? String(child.active) : undefined,
                                'aria-haspopup': Array.isArray(child.items) && child.items.length > 0 ? 'menu' : undefined,
                                'aria-expanded': Array.isArray(child.items) && child.items.length > 0 ? submenu === child.id : undefined,
                                'aria-keyshortcuts': child.ariaKeyShortcuts,
                                className: child.danger ? 'dsh-editor-menu-item dsh-editor-menu-danger' : 'dsh-editor-menu-item',
                                style: { ...styles.menuItem, ...(child.danger ? styles.menuItemDanger : null), ...(child.disabled ? styles.menuItemDisabled : null) },
                                disabled: child.disabled === true,
                                onClick: (event) => {
                                  event.stopPropagation();
                                  if (child.disabled === true) return;
                                  if (child.restoreFocus === false) skipReturnFocusRef.current = true;
                                  onClose();
                                  child.run();
                                },
                              },
                              React.createElement('span', { style: styles.menuLabel }, child.label),
                              child.shortcut === undefined || child.shortcut === ''
                                ? null
                                : React.createElement(
                                    'span',
                                    { className: 'dsh-editor-menu-shortcut', style: styles.menuShortcut },
                                    child.shortcut,
                                  ),
                            ),
                      ),
                    )
                  : null,
              ),
        ),
      );
    }

    /**
     * Split porcelain changes into IDEA's staged and working-tree groups.
     * @param {object[]} changes - porcelain changes from the host.
     * @returns {{staged: object[], unstaged: object[]}} grouped changes.
     */
