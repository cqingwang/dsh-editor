export interface KeyboardShortcutEvent {
  key?: unknown;
  repeat?: unknown;
  metaKey?: unknown;
  ctrlKey?: unknown;
  altKey?: unknown;
  shiftKey?: unknown;
  isComposing?: unknown;
}

export interface EditorActionRecord {
  at: string;
  type: string;
  key: string;
  role: string;
  label: string;
  rowKey: string;
}

export interface EditorDiagnosticRecord {
  at: string;
  sequence: number;
  page: string;
  event: string;
  details: Record<string, unknown>;
}

export type IdeaUsageActionId = 'findUsages' | 'showUsages' | 'findUsagesSettings';

export const React = require('react');
export const { createRoot } = require('react-dom/client');
/* The host's own file artwork; unavailable on an older host, in which case
   the existing file-extension badges remain the fallback. */
export const primitives = (() => {
  try {
    return require('@deepseek-ai/dsh-client-ui-primitives');
  } catch {
    return null;
  }
})();

/** Locale namespace owned by this plugin. */
export const NS = 'dsh-editor';
/** Last operational Editor events, kept in memory for the current page. */
const editorDiagnosticRing: EditorDiagnosticRecord[] = [];
/** Recent user interactions used only as context for Editor runtime errors. */
export const editorActionRing: EditorActionRecord[] = [];
let editorDiagnosticSequence = 0;

/**
 * Monaco rejects internal cancellation promises when a diff/editor is
 * disposed or restores view state. Those promises have no owner left to
 * observe them, so the browser otherwise prints a misleading
 * "Uncaught (in promise) Canceled" even though disposal succeeded.
 * @param {unknown} reason - unhandled rejection reason.
 * @param {string} stack - captured reason stack.
 * @returns {boolean} true only for Monaco's own cancellation rejection.
 */
export function isMonacoCancellation(
  reason: { message?: string; stack?: string; name?: string } | string | null | undefined,
  stack: unknown,
): boolean {
  const candidate = typeof reason === 'object' && reason !== null ? reason : null;
  const message = typeof reason === 'string' ? reason : (candidate?.message ?? String(reason ?? ''));
  const normalizedMessage = message.trim();
  const rejectionStack = typeof stack === 'string' ? stack : (candidate?.stack ?? '');
  if (!rejectionStack.includes('monaco/vs/editor/editor.main.js')) return false;
  const name = candidate?.name ?? '';
  if (name !== '' && name !== 'Error' && name !== 'Canceled' && name !== 'CanceledError') return false;
  return (
    normalizedMessage === 'Canceled' ||
    normalizedMessage === 'Canceled: Canceled' ||
    candidate?.name === 'Canceled' ||
    candidate?.name === 'CanceledError'
  );
}

/**
 * Detect a bare double-Shift gesture. The gesture no longer carries its own
 * search mode; callers route it to the same Find in Files handler as
 * Cmd/Ctrl+Shift+F.
 * @param {number} previousAt - previous Shift timestamp, or zero.
 * @param {KeyboardEvent|object} event - current keydown.
 * @param {number} now - monotonic timestamp.
 * @param {number} [windowMs=400] - maximum tap gap.
 * @returns {{lastAt: number, open: boolean}} next detector state.
 */
export function doubleShiftAction(
  previousAt: unknown,
  event: KeyboardShortcutEvent | null | undefined,
  now: unknown,
  windowMs = 400,
): { lastAt: number; open: boolean } {
  const bareShift =
    event?.key === 'Shift' &&
    event?.repeat !== true &&
    event?.metaKey !== true &&
    event?.ctrlKey !== true &&
    event?.altKey !== true;
  if (!bareShift) return { lastAt: 0, open: false };
  const previous = Number(previousAt);
  const current = Number(now);
  if (!Number.isFinite(current)) return { lastAt: 0, open: false };
  if (Number.isFinite(previous) && previous > 0 && current >= previous && current - previous <= windowMs) {
    return { lastAt: 0, open: true };
  }
  return { lastAt: current, open: false };
}

/**
 * Return the visible Editor workspace that owns Editor-wide search
 * shortcuts. Focus may be in the chat, a toolbar, or the document body;
 * the Editor being visible is the only interaction boundary.
 * @param {Document} documentRef - current document.
 * @returns {Element|null} active, laid-out Editor workspace.
 */
export function visibleEditorWorkspace(
  documentRef: { querySelector?: (selector: string) => Element | null } | null | undefined,
): Element | null {
  const host =
    documentRef?.querySelector?.(
      '[data-dsh-editor-host]:not([data-dsh-editor-host-idle]) [data-dsh-editor-workspace]',
    ) ?? null;
  if (host === null || host.isConnected === false) return null;
  return (host.getClientRects?.().length ?? 0) > 0 ? host : null;
}

/**
 * Detect the macOS keymap family without depending on user-agent wording.
 * @param {unknown} platform - `navigator.platform`-like value.
 * @returns {boolean} whether IDEA's macOS Control-based occurrences keys apply.
 */
export function isMacPlatform(platform: unknown): boolean {
  return /mac|iphone|ipad|ipod/iu.test(String(platform ?? ''));
}

/**
 * Map IDEA's Control modifier onto Monaco without turning it into Cmd on macOS.
 * @param {object} monaco - Monaco global namespace.
 * @param {string} platform - browser platform string.
 * @returns {number} platform-correct Control modifier bit.
 */
export function ideaControlKeyModifier(
  monaco: { KeyMod: { WinCtrl: number; CtrlCmd: number } },
  platform: unknown,
): number {
  return isMacPlatform(platform) ? monaco.KeyMod.WinCtrl : monaco.KeyMod.CtrlCmd;
}

/**
 * Return the IDEA-primary visible shortcut for the usage family.
 * @param {'findUsages'|'showUsages'|'findUsagesSettings'} actionId - action.
 * @param {boolean} macPlatform - whether the macOS keymap applies.
 * @returns {string} visible shortcut glyphs.
 */
export function ideaUsageFamilyShortcut(actionId: IdeaUsageActionId | string, macPlatform: boolean): string {
  if (macPlatform) {
    if (actionId === 'findUsages') return '⌃U';
    if (actionId === 'showUsages') return '⌃⌥U';
    if (actionId === 'findUsagesSettings') return '⌃⇧⌥U';
  }
  if (actionId === 'findUsages') return '⌥F7';
  if (actionId === 'showUsages') return '⌃⌥F7';
  if (actionId === 'findUsagesSettings') return '⌃⇧⌥F7';
  return '';
}

/**
 * Match the executable primary and alternate chords of IDEA's usage family.
 * @param {KeyboardEvent|object} event - current keyboard event.
 * @param {boolean} macPlatform - whether the macOS keymap applies.
 * @returns {'findUsages'|'showUsages'|'findUsagesSettings'|null} matched action.
 */
export function ideaUsageFamilyShortcutAction(
  event: KeyboardShortcutEvent | null | undefined,
  macPlatform: boolean,
): IdeaUsageActionId | null {
  if (event === null || typeof event !== 'object') return null;
  if (event.isComposing === true) return null;
  const key = String(event.key ?? '').toLowerCase();
  if (macPlatform && key === 'u') {
    if (event.ctrlKey !== true || event.metaKey === true) return null;
    if (event.altKey !== true) return event.shiftKey === true ? null : 'findUsages';
    return event.shiftKey === true ? 'findUsagesSettings' : 'showUsages';
  }
  if (key !== 'f7' || event.altKey !== true) return null;
  if (macPlatform) {
    if (event.metaKey === true) {
      if (event.ctrlKey === true) return null;
      return event.shiftKey === true ? 'findUsagesSettings' : 'showUsages';
    }
    if (event.ctrlKey === true || event.shiftKey === true) return null;
    return 'findUsages';
  }
  if (event.metaKey === true) return null;
  if (event.ctrlKey !== true) {
    return event.shiftKey === true ? null : 'findUsages';
  }
  return event.shiftKey === true ? 'findUsagesSettings' : 'showUsages';
}

/**
 * Match IDEA's Find Next / Previous primary and macOS alternate chords.
 * @param {KeyboardEvent|object} event - current keyboard event.
 * @param {boolean} macPlatform - whether the macOS keymap applies.
 * @returns {-1|0|1} previous, no match, or next.
 */
export function ideaFindStepShortcutAction(
  event: KeyboardShortcutEvent | null | undefined,
  macPlatform: boolean,
): -1 | 0 | 1 {
  if (event === null || typeof event !== 'object') return 0;
  if (event.isComposing === true || event.metaKey === true || event.altKey === true) return 0;
  const key = String(event.key ?? '').toLowerCase();
  const step = event.shiftKey === true ? -1 : 1;
  if (key === 'f3' && event.ctrlKey !== true) return step;
  if (macPlatform && key === 'l' && event.ctrlKey === true) return step;
  return 0;
}

/**
 * Match IDEA's Show Search History chord.
 * @param {KeyboardEvent|object} event - current keyboard event.
 * @returns {boolean} whether the event opens query history.
 */
export function searchHistoryShortcutMatches(event: KeyboardShortcutEvent | null | undefined): boolean {
  if (event === null || typeof event !== 'object' || event.isComposing === true) return false;
  return (
    event.altKey === true &&
    event.metaKey !== true &&
    event.ctrlKey !== true &&
    event.shiftKey !== true &&
    event.key === 'ArrowDown'
  );
}

/**
 * Cycle a modular focus index for the Search Everywhere dialog.
 * @param {number} length - focusable element count.
 * @param {number} index - current element index.
 * @param {boolean} backward - whether Shift+Tab applies.
 * @returns {number|null} next index, or null for an empty list.
 */
export function searchEverywhereNextFocusIndex(length: unknown, index: unknown, backward: unknown): number | null {
  const count = Math.max(0, Math.floor(Number(length) || 0));
  if (count === 0) return null;
  const current = Number(index);
  const valid = Number.isInteger(current) && current >= 0 && current < count;
  if (!valid) return backward === true ? count - 1 : 0;
  return backward === true ? (current - 1 + count) % count : (current + 1) % count;
}

/**
 * Resolve the Workspace that owns one live Conversation session.
 *
 * DSH keeps session and Workspace identity separate. The Editor must follow
 * the Workspace that owns the currently rendered session, even when the user
 * changes Workspaces through the host picker instead of the Editor command.
 * @param items Workspace snapshot items.
 * @param sessionId Live `data-conversation-session` value.
 * @returns Matching Workspace id, or an empty string when the snapshot cannot resolve it.
 */
export function workspaceIdForConversationSession(items: unknown, sessionId: unknown): string {
  const id = typeof sessionId === 'string' ? sessionId : '';
  if (id === '' || !Array.isArray(items)) return '';
  for (const item of items) {
    if (item === null || typeof item !== 'object') continue;
    const workspaceId = typeof item.workspaceId === 'string' ? item.workspaceId : '';
    const sessionIds = Array.isArray(item.sessionIds) ? item.sessionIds : [];
    if (workspaceId !== '' && sessionIds.includes(id)) return workspaceId;
  }
  return '';
}

/**
 * Resolve a Workspace from a user-visible menu label when the label is unique.
 *
 * Host picker menu rows do not expose Workspace ids in the DOM. A unique title
 * lets the Editor switch in the same click instead of waiting for the Session
 * stream and briefly rendering the previous Workspace. Duplicate titles stay
 * unresolved and fall back to the session-based binding.
 * @param items Workspace snapshot items.
 * @param title Visible picker label.
 * @returns Unique matching Workspace id, or an empty string when ambiguous.
 */
export function workspaceIdForUniqueTitle(items: unknown, title: unknown): string {
  const label = typeof title === 'string' ? title.trim() : '';
  if (label === '' || !Array.isArray(items)) return '';
  const matches: string[] = [];
  for (const item of items) {
    if (item === null || typeof item !== 'object') continue;
    const workspaceId = typeof item.workspaceId === 'string' ? item.workspaceId : '';
    const workspaceTitle = typeof item.title === 'string' ? item.title.trim() : '';
    if (workspaceId !== '' && workspaceTitle === label) matches.push(workspaceId);
  }
  return matches.length === 1 ? matches[0] : '';
}

/**
 * Reset workspace-bound search surfaces only after a real workspace change.
 *
 * The first non-empty root is the initial host handshake, not a user switch.
 * Treating it as a reset closes Find opened immediately after the Editor
 * workspace becomes visible.
 * @param {string} previousRoot - root observed by the previous effect run.
 * @param {string} nextRoot - root from the current render.
 * @returns {boolean} whether stale workspace search state must be discarded.
 */
export function workspaceSearchSurfacesShouldReset(previousRoot: string, nextRoot: string): boolean {
  return previousRoot !== '' && previousRoot !== nextRoot;
}

/**
 * Match IDEA's Find Action chord from the default and macOS keymaps.
 * @param {KeyboardEvent|object} event - current keyboard event.
 * @param {boolean} macPlatform - whether the macOS keymap applies.
 * @returns {boolean} whether this event opens Find Action.
 */
export function findActionShortcutMatches(
  event: KeyboardShortcutEvent | null | undefined,
  macPlatform: boolean,
): boolean {
  if (event === null || typeof event !== 'object') return false;
  if (event.isComposing === true || event.altKey === true || event.shiftKey !== true) return false;
  const key = String(event.key ?? '').toLowerCase();
  if (macPlatform) {
    return event.metaKey === true && event.ctrlKey !== true && (key === 'a' || key === 'p');
  }
  return event.ctrlKey === true && event.metaKey !== true && key === 'a';
}

/**
 * Display the working Find Action chord.
 *
 * Harness reserves Cmd+Shift+A for archive at the native host layer, so the
 * macOS surface advertises IDEA's equivalent Cmd+Shift+P chord. The global
 * matcher still accepts both chords when the host delivers them.
 * @param {boolean} macPlatform - whether the macOS keymap applies.
 * @returns {string} localized display shortcut.
 */
export function findActionShortcutLabel(macPlatform: boolean): string {
  return macPlatform ? '⇧⌘P' : '⌃⇧A';
}

/**
 * Remember a small, content-safe description of the latest interaction.
 *
 * This ring is persisted only when the Editor reports a runtime error. It deliberately ignores
 * editable content and single printable keystrokes.
 * @param {Event} event - captured click or keydown event.
 * @returns {void}
 */
export function recordDiagnosticAction(
  event: Event & {
    key?: string;
    metaKey?: boolean;
    ctrlKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
  },
): void {
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('input, textarea, [contenteditable="true"]') !== null) return;
  const actionTarget = target?.closest('button, [role="tab"], [role="menuitem"], [data-row-key]') ?? null;
  const key = event.type === 'keydown' ? (event.key ?? '') : '';
  const keyboardShortcut =
    event.type === 'keydown' && (event.metaKey || event.ctrlKey || event.altKey || event.key.length > 1);
  if (actionTarget === null && !keyboardShortcut) return;
  const visible = (actionTarget?.getAttribute('aria-label') ?? actionTarget?.textContent ?? '')
    .trim()
    .replace(/\s+/gu, ' ');
  const modifiers = [
    event.metaKey ? 'Meta' : '',
    event.ctrlKey ? 'Control' : '',
    event.altKey ? 'Alt' : '',
    event.shiftKey ? 'Shift' : '',
  ].filter(Boolean);
  editorActionRing.push({
    at: new Date().toISOString(),
    type: event.type,
    key: key === '' ? '' : `${modifiers.join('+')}${modifiers.length > 0 ? '+' : ''}${key}`,
    role: actionTarget?.getAttribute('role') ?? actionTarget?.tagName?.toLowerCase() ?? '',
    label: visible.slice(0, 80),
    rowKey: actionTarget?.getAttribute?.('data-row-key')?.slice(0, 100) ?? '',
  });
  if (editorActionRing.length > 12) {
    editorActionRing.splice(0, editorActionRing.length - 12);
  }
}

/**
 * Persist a small operational diagnostic without chat or file content.
 * Reporting is deliberately best-effort: a failed log request must never
 * affect the Editor or recursively create another diagnostic.
 * @param {string} event - stable event name.
 * @param {object} [details] - measured host/layout state.
 * @param {'info'|'warn'|'error'} [level] - console severity.
 * @returns {void}
 */
export function reportEditorDiagnostic(
  event: unknown,
  details: Record<string, unknown> = {},
  level: 'info' | 'warn' | 'error' = 'warn',
): void {
  const record: EditorDiagnosticRecord = {
    at: new Date().toISOString(),
    sequence: ++editorDiagnosticSequence,
    page: window.location?.pathname ?? '',
    event: typeof event === 'string' ? event : 'unknown',
    details: details !== null && typeof details === 'object' ? details : {},
  };
  editorDiagnosticRing.push(record);
  if (editorDiagnosticRing.length > 50) {
    editorDiagnosticRing.splice(0, editorDiagnosticRing.length - 50);
  }
  const label = `[dsh-editor:diag] ${record.event}`;
  if (level === 'error') console.error(label, record);
  else if (level === 'warn') console.warn(label, record);
  else console.info(label, record);
  try {
    void fetch('api/dsh-editor/diagnostics', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ records: [record] }),
    }).catch(() => {});
  } catch {
    /* diagnostics are strictly best-effort */
  }
}

export interface VisibilityGatedPollOptions {
  documentRef?: Document;
  windowRef?: Window;
}

/**
 * Run one asynchronous refresh at a time only while the page is visible.
 *
 * Background tabs should not keep waking a poll callback merely to discover
 * that they are hidden. Visibility changes restart the poll immediately when
 * the page returns, and the next timeout is scheduled only after the previous
 * task settles.
 * @param task - bounded refresh or status check.
 * @param delay - delay between completed runs, in milliseconds.
 * @param options - injectable document/window for deterministic tests.
 * @returns cleanup that stops the timeout and visibility listener.
 */
export function startVisibilityGatedPoll(
  task: () => void | Promise<void>,
  delay: number,
  options: VisibilityGatedPollOptions = {},
): () => void {
  if (typeof task !== 'function') return () => {};
  const documentRef = options.documentRef ?? document;
  const windowRef = options.windowRef ?? window;
  const interval = Math.max(16, Number.isFinite(delay) && delay > 0 ? Math.round(delay) : 1000);
  let timer: number | null = null;
  let running = false;
  let stopped = false;

  const cancelTimer = (): void => {
    if (timer === null) return;
    windowRef.clearTimeout(timer);
    timer = null;
  };
  const schedule = (): void => {
    cancelTimer();
    if (stopped || documentRef.visibilityState === 'hidden') return;
    timer = windowRef.setTimeout(() => {
      timer = null;
      void run();
    }, interval);
  };
  const run = async (): Promise<void> => {
    if (stopped || running || documentRef.visibilityState === 'hidden') return;
    running = true;
    try {
      await task();
    } catch {
      /* callers own domain-specific error reporting */
    } finally {
      running = false;
      schedule();
    }
  };
  const onVisibilityChange = (): void => {
    if (documentRef.visibilityState === 'hidden') {
      cancelTimer();
      return;
    }
    void run();
  };

  documentRef.addEventListener('visibilitychange', onVisibilityChange);
  schedule();
  return () => {
    stopped = true;
    cancelTimer();
    documentRef.removeEventListener('visibilitychange', onVisibilityChange);
  };
}

/** xterm constructors, loaded at most once. */
/* The host can remount the workspace during layout updates; the selected
   IDEA tool window is user context and must not silently fall back to Project. */
let lastEditorActivity = 'project';

/** Read the last active IDEA-style tool window for remount persistence. */
export function readLastEditorActivity(): string {
  return lastEditorActivity;
}

/** Remember the active tool window without importing a mutable binding. */
export function writeLastEditorActivity(activity: string): void {
  lastEditorActivity = activity;
}
/** Tab label is intentionally identical in both languages. */
export const VIEW_LABEL = 'Editor';
