export interface MenuKeyState {
  hasChildren?: boolean;
  open?: boolean;
}

export interface MenuStepItem {
  disabled?: boolean;
}

export interface MenuTypeaheadItem extends MenuStepItem {
  label?: string;
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

export interface SubmenuVerticalPlacementGeometry {
  parentTop?: number;
  parentBottom?: number;
  viewportHeight?: number;
}

export interface SubmenuVerticalPlacement {
  side: 'up' | 'down';
  maxHeight: number;
}

/**
 * Cap a context menu to the current viewport.
 *
 * Business callers may request a smaller menu, but no caller owns the viewport
 * boundary. Keep the same 8px edge margin used by menu positioning.
 */
export function contextMenuMaxHeight(viewportHeight?: number, requestedMaxHeight?: number): number {
  const viewport = Number(viewportHeight);
  const available = Number.isFinite(viewport) && viewport > 0 ? Math.max(1, Math.floor(viewport - 8)) : 480;
  const requested = Number(requestedMaxHeight);
  if (!Number.isFinite(requested)) return available;
  const requestedFloor = Math.min(80, available);
  return Math.min(available, Math.max(requestedFloor, Math.round(requested)));
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

export type MenuStepKey = 'ArrowDown' | 'ArrowUp' | 'Home' | 'End' | 'PageDown' | 'PageUp';

/** Move focus through an open menu's enabled rows, wrapping at the ends. */
export function menuStep(
  items: Array<MenuStepItem | null | undefined>,
  activeIndex: number,
  key: MenuStepKey,
  pageSize = 8,
): number {
  const focusable: number[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item === null || item === undefined || item.disabled === true) continue;
    focusable.push(index);
  }
  if (focusable.length === 0) return -1;
  if (key === 'Home') return focusable[0];
  if (key === 'End') return focusable[focusable.length - 1];
  const current = focusable.indexOf(Number(activeIndex));
  if (current < 0) return key === 'ArrowUp' || key === 'PageUp' ? focusable[focusable.length - 1] : focusable[0];
  if (key === 'PageUp' || key === 'PageDown') {
    const page = Math.max(1, Math.floor(Number(pageSize) || 8));
    const offset = key === 'PageUp' ? -page : page;
    return focusable[Math.max(0, Math.min(focusable.length - 1, current + offset))];
  }
  const delta = key === 'ArrowUp' ? -1 : 1;
  return focusable[(current + delta + focusable.length) % focusable.length];
}

/** Find the next enabled menu item whose label starts with the typed prefix. */
export function menuTypeaheadTarget(
  items: Array<MenuTypeaheadItem | null | undefined>,
  activeIndex: number,
  query: string,
): number {
  if (typeof query !== 'string' || query === '' || query.trim() === '') return -1;
  const prefix = query.toLocaleLowerCase();
  const current = Number(activeIndex);
  const active = Number.isInteger(current) && current >= 0 ? items[current] : undefined;
  if (
    query.length > 1 &&
    active !== null &&
    active !== undefined &&
    active.disabled !== true &&
    (active.label ?? '').toLocaleLowerCase().startsWith(prefix)
  ) {
    return current;
  }
  const candidates: number[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item === null || item === undefined || item.disabled === true) continue;
    if ((item.label ?? '').toLocaleLowerCase().startsWith(prefix)) candidates.push(index);
  }
  if (candidates.length === 0) return -1;
  return candidates.find((index) => index > current) ?? candidates[0];
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

/** Decide whether a submenu opens above or below its parent row. */
export function submenuVerticalGeometry(geometry?: SubmenuVerticalPlacementGeometry | null): SubmenuVerticalPlacement {
  const fallback: SubmenuVerticalPlacement = { side: 'down', maxHeight: 480 };
  if (geometry === null || geometry === undefined) return fallback;
  const top = Number(geometry.parentTop);
  const bottom = Number(geometry.parentBottom);
  const viewport = Number(geometry.viewportHeight);
  if (![top, bottom, viewport].every((value) => Number.isFinite(value)) || viewport <= 0) return fallback;
  const roomAbove = Math.max(1, Math.floor(bottom - 8));
  const roomBelow = Math.max(1, Math.floor(viewport - top - 8));
  const side = roomAbove > roomBelow ? 'up' : 'down';
  return {
    side,
    maxHeight: side === 'up' ? roomAbove : roomBelow,
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
