export interface MenuKeyState {
  hasChildren?: boolean;
  open?: boolean;
}

export interface MenuStepItem {
  disabled?: boolean;
}

export interface SubmenuGeometry {
  parentLeft?: number;
  parentRight?: number;
  viewportWidth?: number;
  preferredWidth?: number;
}

export interface SubmenuPlacement {
  side: 'right' | 'left';
  maxWidth: number;
}

export interface SubmenuSideGeometry {
  parentRight?: number;
  viewportWidth?: number;
  submenuWidth?: number;
}

export function submenuKeyAction(key: string, state?: MenuKeyState | null): string | null {
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

/** Move focus through an open menu's enabled rows, wrapping at the ends. */
export function menuStep(
  items: Array<MenuStepItem | null | undefined>,
  activeIndex: number,
  key: 'ArrowDown' | 'ArrowUp',
): number {
  const focusable: number[] = [];
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

/** Decide where a submenu opens and how wide it may get. */
export function submenuGeometry(geometry?: SubmenuGeometry | null): SubmenuPlacement {
  const fallback: SubmenuPlacement = { side: 'right', maxWidth: 260 };
  if (geometry === null || geometry === undefined) return fallback;
  const left = Number(geometry.parentLeft);
  const right = Number(geometry.parentRight);
  const viewport = Number(geometry.viewportWidth);
  const preferred = Number(geometry.preferredWidth ?? 260);
  if (![left, right, viewport, preferred].every((value) => Number.isFinite(value))) return fallback;
  if (viewport <= 0) return fallback;
  const roomRight = viewport - right - 8;
  const roomLeft = left - 8;
  const side = roomRight >= preferred ? 'right' : roomLeft > roomRight ? 'left' : 'right';
  const room = side === 'right' ? roomRight : roomLeft;
  return {
    side,
    maxWidth: Math.max(140, Math.min(preferred, Math.max(room, 140))),
  };
}

/** Which side a submenu opens on, given only the room to the parent's right. */
export function submenuSide(geometry?: SubmenuSideGeometry | null): 'right' | 'left' {
  if (geometry === null || geometry === undefined) return 'right';
  const right = Number(geometry.parentRight);
  const viewport = Number(geometry.viewportWidth);
  const preferred = Number(geometry.submenuWidth);
  if (!Number.isFinite(right) || !Number.isFinite(viewport) || !Number.isFinite(preferred)) return 'right';
  if (viewport <= 0) return 'right';
  return viewport - right - 8 >= preferred ? 'right' : 'left';
}
