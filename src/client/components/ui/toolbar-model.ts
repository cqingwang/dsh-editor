import type { MouseEvent } from 'react';

export interface ToolbarActionLike {
  id: string;
  icon?: string;
  label?: string;
  active?: boolean;
  pinned?: boolean;
  group?: string;
  disabled?: boolean;
  onClick?: (event?: MouseEvent<HTMLElement>) => void;
  ariaKeyShortcuts?: string;
  ariaHasPopup?: boolean | 'menu' | 'dialog' | 'listbox' | 'tree' | 'grid';
  ariaExpanded?: boolean;
}

export function panelToolbarFit(
  width: number,
  titleWidth: number,
  leftCount: number,
  rightCount: number,
  badgeWidth = 0,
  pinnedLeftCount = 0,
): { left: number; right: number } {
  const totalWidth = Math.max(0, Number(width) || 0);
  const totalActions =
    Math.max(0, Math.floor(Number(leftCount) || 0)) + Math.max(0, Math.floor(Number(rightCount) || 0));
  let room = totalWidth - 14 - Math.max(0, Number(titleWidth) || 0);
  let left = Math.max(0, Math.floor(Number(leftCount) || 0));
  let right = Math.max(0, Math.floor(Number(rightCount) || 0));
  const badge = Math.max(0, Number(badgeWidth) || 0);
  const badgeRoom = badge > 0 ? badge + 4 : 0;
  if (totalActions * 25 + badgeRoom <= room) return { left, right };
  /* One "»" button is required once the full set does not fit. */
  room -= 25;
  /* The branch chip is fixed information, not an action that may overflow.
     Reserve it before distributing slots or actions will push it past the
     toolbar edge after consuming the remaining width. */
  room -= badgeRoom;
  /* IDEA's Select Opened File is a primary Project action. Reserve it
     before the trailing window actions so a narrow tool window does not
     hide the target button behind "»". */
  const reservedLeft = Math.min(
    left,
    Math.max(0, Math.floor(Number(pinnedLeftCount) || 0)),
    Math.max(0, Math.floor(room / 25)),
  );
  room -= reservedLeft * 25;
  right = Math.min(right, Math.max(0, Math.floor(room / 25)));
  room -= right * 25;
  left = reservedLeft + Math.min(left - reservedLeft, Math.max(0, Math.floor(room / 25)));
  return { left, right };
}

export function toolbarActionActive(action: { active?: boolean } | null | undefined): boolean | undefined {
  return typeof action?.active === 'boolean' ? action.active : undefined;
}

export function selectCompactActions<T extends ToolbarActionLike>(actions: T[], directLimit: number): T[] {
  const limit = Math.max(0, Math.floor(Number(directLimit) || 0));
  if (actions.length <= limit) return actions;
  if (limit === 0) return [];
  const selected = new Set(actions.filter((action) => action.pinned === true).slice(0, limit));
  let remaining = limit - selected.size;
  for (const action of actions) {
    if (remaining === 0) break;
    if (action.pinned === true || selected.has(action)) continue;
    selected.add(action);
    remaining -= 1;
  }
  return actions.filter((action) => selected.has(action));
}

export function groupCompactActions<T extends ToolbarActionLike>(actions: T[]): Array<T | null> {
  const grouped = [];
  let group = null;
  for (const action of actions) {
    if (group !== null && action.group !== group) grouped.push(null);
    grouped.push(action);
    group = action.group;
  }
  return grouped;
}
