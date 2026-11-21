import React from 'react';

export interface FindToolSession<T> {
  id: string;
  state: T;
}

export interface FindToolSessionSet<T> {
  sessions: FindToolSession<T>[];
  activeId: string | null;
}

export type FindToolSessionAction<T> =
  | {
      type: 'set';
      id: string;
      updater: React.SetStateAction<T | null>;
    }
  | { type: 'open'; id: string; state: T }
  | { type: 'select'; id: string }
  | { type: 'close'; id: string }
  | { type: 'closeAll' };

/**
 * Keep each Find search as an independent tab.
 *
 * The active search still uses the existing state setters and lifecycle.
 * Closing an active tab activates its nearest surviving neighbor; setting the
 * active state to null is the explicit close-all operation used by the tool
 * window close path.
 */
export function findToolSessionReducer<T>(
  state: FindToolSessionSet<T>,
  action: FindToolSessionAction<T>,
): FindToolSessionSet<T> {
  if (action.type === 'closeAll') return { sessions: [], activeId: null };
  if (action.type === 'open') {
    const sessions = [
      ...state.sessions.filter((session) => session.id !== action.id),
      { id: action.id, state: action.state },
    ];
    return { sessions, activeId: action.id };
  }
  if (action.type === 'select') {
    return state.sessions.some((session) => session.id === action.id) ? { ...state, activeId: action.id } : state;
  }
  if (action.type === 'close') {
    if (!state.sessions.some((session) => session.id === action.id)) return state;
    const activeIndex = state.sessions.findIndex((session) => session.id === state.activeId);
    const closingIndex = state.sessions.findIndex((session) => session.id === action.id);
    const sessions = state.sessions.filter((session) => session.id !== action.id);
    if (action.id !== state.activeId) return { ...state, sessions };
    const nextIndex = Math.min(closingIndex >= 0 ? closingIndex : activeIndex, sessions.length - 1);
    return { sessions, activeId: sessions[nextIndex]?.id ?? null };
  }

  const activeIndex = state.sessions.findIndex((session) => session.id === state.activeId);
  const current = activeIndex < 0 ? null : state.sessions[activeIndex].state;
  const next =
    typeof action.updater === 'function'
      ? (action.updater as (current: T | null) => T | null)(current)
      : action.updater;
  if (next === null) return state.sessions.length === 0 ? state : { sessions: [], activeId: null };
  if (activeIndex < 0) {
    return {
      sessions: [...state.sessions, { id: action.id, state: next }],
      activeId: action.id,
    };
  }
  if (Object.is(next, current)) return state;
  return {
    ...state,
    sessions: state.sessions.map((session, index) => (index === activeIndex ? { ...session, state: next } : session)),
  };
}

export interface FindToolSessions<T> {
  active: T | null;
  activeId: string | null;
  sessions: FindToolSession<T>[];
  setActive: React.Dispatch<React.SetStateAction<T | null>>;
  open: (state: T) => void;
  select: (id: string) => void;
  close: (id: string) => void;
  closeAll: () => void;
}

/** Browser-local tab identities only need to be unique within this workspace. */
function nextFindToolSessionId(sequence: number): string {
  return `find-${Date.now().toString(36)}-${sequence.toString(36)}`;
}

export function useFindToolSessions<T>(): FindToolSessions<T> {
  const sequenceRef = React.useRef(0);
  const [state, dispatch] = React.useReducer(findToolSessionReducer<T>, {
    sessions: [],
    activeId: null,
  });
  const active = state.sessions.find((session) => session.id === state.activeId)?.state ?? null;
  const setActive = React.useCallback<React.Dispatch<React.SetStateAction<T | null>>>((updater) => {
    dispatch({
      type: 'set',
      id: nextFindToolSessionId(++sequenceRef.current),
      updater,
    });
  }, []);
  const open = React.useCallback((next: T) => {
    dispatch({
      type: 'open',
      id: nextFindToolSessionId(++sequenceRef.current),
      state: next,
    });
  }, []);
  const select = React.useCallback((id: string) => dispatch({ type: 'select', id }), []);
  const close = React.useCallback((id: string) => dispatch({ type: 'close', id }), []);
  const closeAll = React.useCallback(() => dispatch({ type: 'closeAll' }), []);
  return {
    active,
    activeId: state.activeId,
    sessions: state.sessions,
    setActive,
    open,
    select,
    close,
    closeAll,
  };
}

export interface FindToolTabActions {
  onSelectFindToolTab: (id: string) => void;
  onCloseFindToolTab: (id: string) => void;
}

export function findToolFocusSelector(surface: 'popup' | 'dock', focusTarget: 'query' | 'replace'): string {
  return surface === 'dock'
    ? '[data-dsh-find-tool-window] [data-dsh-find-session-tab][aria-selected="true"]'
    : focusTarget === 'replace'
      ? '[data-dsh-find-replace-input]'
      : '[data-dsh-find-tool-window] input[role="combobox"]';
}

export function focusFindToolCurrentSurface(): void {
  window.setTimeout(() => {
    const target =
      document.querySelector<HTMLElement>(
        '[data-dsh-find-tool-window] [data-dsh-find-session-tab][aria-selected="true"]',
      ) ?? document.querySelector<HTMLElement>('[data-dsh-find-tool-window] input[role="combobox"]');
    target?.focus?.();
  }, 0);
}

/** Close only a transient popup while preserving an older dock session. */
export function closeFindPopupSession<T extends { surface?: unknown }>(sessions: FindToolSessions<T>): boolean {
  if (sessions.active?.surface !== 'popup' || sessions.sessions.length <= 1) return false;
  sessions.close(sessions.activeId ?? '');
  focusFindToolCurrentSurface();
  return true;
}

export function useFindToolTabActions<T extends { query?: unknown; searchGeneration?: unknown }>(
  sessions: FindToolSessions<T>,
  closeAll: () => void,
): FindToolTabActions {
  const focusQuery = React.useCallback(() => {
    window.setTimeout(
      () =>
        document
          .querySelector<HTMLElement>('[data-dsh-find-tool-window] [data-dsh-find-session-tab][aria-selected="true"]')
          ?.focus?.(),
      0,
    );
  }, []);
  const onSelectFindToolTab = React.useCallback(
    (id: string) => {
      sessions.select(id);
      focusQuery();
    },
    [focusQuery, sessions.select],
  );
  const onCloseFindToolTab = React.useCallback(
    (id: string) => {
      if (sessions.sessions.length <= 1) {
        closeAll();
        return;
      }
      sessions.close(id);
      focusQuery();
    },
    [closeAll, focusQuery, sessions.close, sessions.sessions.length],
  );
  return { onSelectFindToolTab, onCloseFindToolTab };
}
