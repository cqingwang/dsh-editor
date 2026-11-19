import type React from 'react';
import { searchEverywhereNextFocusIndex } from '../../foundation';

const DIALOG_FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex="0"]:not([disabled])';

type DialogFocusRoot = Element | Document;

/** Collect visible, keyboard-reachable controls in DOM order. */
export function dialogFocusableElements(root: DialogFocusRoot | null | undefined): HTMLElement[] {
  if (root === null || root === undefined) return [];
  return [...new Set(root.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE_SELECTOR))].filter(
    (element) =>
      element.tabIndex >= 0 &&
      element.getAttribute('aria-hidden') !== 'true' &&
      (element.getClientRects?.().length ?? 0) > 0,
  );
}

/** Resolve the next focus target without touching the DOM. */
export function nextDialogFocusTarget<T extends HTMLElement>(
  focusables: readonly T[],
  activeElement: Element | null | undefined,
  backward: unknown,
  focusWhenOutside = false,
): T | null {
  if (focusables.length === 0) return null;
  const currentIndex =
    activeElement === null || activeElement === undefined ? -1 : focusables.indexOf(activeElement as T);
  if (currentIndex < 0 && focusWhenOutside !== true) return null;
  const nextIndex = searchEverywhereNextFocusIndex(focusables.length, currentIndex, backward);
  return nextIndex === null ? null : (focusables[nextIndex] ?? null);
}

export interface DialogFocusTrapOptions {
  focusWhenOutside?: boolean;
}

/** Handle one Tab/Shift+Tab event inside a dialog surface. */
export function trapDialogFocus(
  event: React.KeyboardEvent<Element>,
  root: DialogFocusRoot | null | undefined,
  options: DialogFocusTrapOptions = {},
): boolean {
  if (event.key !== 'Tab') return false;
  const focusables = dialogFocusableElements(root);
  const activeElement = typeof document === 'undefined' ? null : document.activeElement;
  const target = nextDialogFocusTarget(
    focusables,
    activeElement,
    event.shiftKey === true,
    options.focusWhenOutside === true,
  );
  if (target === null) return false;
  event.preventDefault();
  event.stopPropagation();
  target.focus();
  return true;
}
