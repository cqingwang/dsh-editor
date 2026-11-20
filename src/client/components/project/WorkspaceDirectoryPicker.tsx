import React from 'react';
import { EDITOR_TEXT_STYLE } from '../editor/editor-style-model';
import { FloatingToolPopup } from '../search/FindToolPopup';
import { Icon, POPUP_ICON_SIZE } from '../ui/Icon';
import { ToolbarButton } from '../ui/ToolbarButton';
import { focusSurfaceWhenReady } from '../ui/focus-surface';
import { POPUP_BORDER } from '../../ui/styles';
import { FileTreeView, type FileTreeViewRowState } from './FileTreeView';
import {
  displayWorkspaceDirectoryPath,
  directoryBaseName,
  directoryPathHasHiddenSegment,
  directoryPathIsWithin,
  directoryPathParent,
  flattenDirectoryTreeRows,
  normalizeHostDirectoryListing,
  resolveWorkspaceDirectoryPath,
  workspaceDirectoryAutocompleteQuery,
  workspaceDirectoryPickerGeometry,
  workspaceDirectorySuggestions,
  type WorkspaceDirectoryEntry,
  type WorkspaceDirectorySuggestion,
} from './workspace-directory-model';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface WorkspaceDirectoryPickerListing {
  path?: unknown;
  home?: unknown;
  entries?: unknown;
}

export interface WorkspaceDirectoryPickerCreatedWorkspace {
  workspaceId?: unknown;
}

export interface WorkspaceDirectoryPickerProps {
  open: boolean;
  t: Translate;
  listDirectory: (path?: string, signal?: AbortSignal) => Promise<WorkspaceDirectoryPickerListing>;
  createWorkspace: (path: string) => Promise<WorkspaceDirectoryPickerCreatedWorkspace>;
  onWorkspaceCreated: (workspaceId: string) => void;
  onClose: () => void;
  returnFocusElement?: HTMLElement | null;
}

interface PickerSurfaceProps {
  onPopupDragStart?: (event: React.PointerEvent<HTMLElement>) => void;
  children: React.ReactNode;
}

function PickerSurface({ onPopupDragStart, children }: PickerSurfaceProps) {
  const handlePointerDown = (event: React.PointerEvent<HTMLElement>): void => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('[data-dsh-workspace-directory-drag]') === null) return;
    onPopupDragStart?.(event);
  };
  return (
    <div
      onPointerDown={handlePointerDown}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
      }}>
      {children}
    </div>
  );
}

function failureText(reason: unknown, t: Translate): string {
  const message = reason instanceof Error && reason.message !== '' ? reason.message : String(reason);
  if (message.includes('workspace directory API HTTP 404')) {
    return t('editor.workspaceDirectoryApiUnavailable');
  }
  return message;
}

/**
 * Web-mode directory chooser for Harness "Add workspace".
 *
 * It owns host directory reads and the create action only. Tree interaction
 * and floating-surface behavior stay in their shared components.
 */
function WorkspaceDirectoryPicker({
  open,
  t,
  listDirectory,
  createWorkspace,
  onWorkspaceCreated,
  onClose,
  returnFocusElement = null,
}: WorkspaceDirectoryPickerProps) {
  const [geometry, setGeometry] = React.useState(() =>
    workspaceDirectoryPickerGeometry(window.innerWidth, window.innerHeight),
  );
  const [rootPath, setRootPath] = React.useState('');
  const [rootName, setRootName] = React.useState('');
  const [pathDraft, setPathDraft] = React.useState('');
  const [childrenByPath, setChildrenByPath] = React.useState<Map<string, WorkspaceDirectoryEntry[]>>(new Map());
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = React.useState<string | null>(null);
  const [showHidden, setShowHidden] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [suggestions, setSuggestions] = React.useState<WorkspaceDirectorySuggestion[]>([]);
  const [suggestionIndex, setSuggestionIndex] = React.useState(-1);
  const [suggestionsOpen, setSuggestionsOpen] = React.useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = React.useState(false);
  const [suggestionError, setSuggestionError] = React.useState<string | null>(null);
  const requestRef = React.useRef(0);
  const abortRef = React.useRef<AbortController | null>(null);
  const suggestionRequestRef = React.useRef(0);
  const suggestionAbortRef = React.useRef<AbortController | null>(null);
  const focusRequestRef = React.useRef<(() => void) | null>(null);
  const homePathRef = React.useRef('');
  const treeRef = React.useRef<HTMLDivElement | null>(null);
  const rowRefs = React.useRef<Map<string, HTMLElement>>(new Map());
  const pathInputRef = React.useRef<HTMLInputElement | null>(null);
  const suggestionListRef = React.useRef<HTMLDivElement | null>(null);
  const composingRef = React.useRef(false);

  const loadRootDirectory = React.useCallback(
    async (path?: string): Promise<void> => {
      const requestedPath =
        path === undefined || path === '' ? undefined : resolveWorkspaceDirectoryPath(path, homePathRef.current);
      const requestId = ++requestRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      try {
        const listing = normalizeHostDirectoryListing(
          await listDirectory(requestedPath, controller.signal),
          requestedPath ?? '',
        );
        if (requestRef.current !== requestId) return;
        if (listing.path === '') throw new Error(t('editor.workspaceDirectoryPathRequired'));
        const nextChildren = new Map<string, WorkspaceDirectoryEntry[]>([[listing.path, listing.entries]]);
        homePathRef.current = listing.home;
        setRootPath(listing.path);
        setRootName(listing.path === listing.home ? '~' : directoryBaseName(listing.path) || listing.path);
        setPathDraft(displayWorkspaceDirectoryPath(listing.path, listing.home));
        setChildrenByPath(nextChildren);
        setExpanded(new Set([listing.path]));
        setSelectedPath(listing.path);
        window.setTimeout(() => treeRef.current?.focus(), 0);
      } catch (reason) {
        if (requestRef.current !== requestId || controller.signal.aborted) return;
        setError(t('editor.workspaceDirectoryLoadFailed', { message: failureText(reason, t) }));
      } finally {
        if (requestRef.current === requestId) {
          setLoading(false);
          if (abortRef.current === controller) abortRef.current = null;
        }
      }
    },
    [listDirectory, t],
  );

  const focusTreePath = React.useCallback((path: string): void => {
    focusRequestRef.current?.();
    focusRequestRef.current = focusSurfaceWhenReady(
      () => {
        const row = rowRefs.current.get(path);
        if (row === undefined) return null;
        row?.scrollIntoView?.({ block: 'nearest' });
        return treeRef.current;
      },
      {
        maxAttempts: 40,
        onExhausted: () => {
          focusRequestRef.current = null;
          treeRef.current?.focus();
        },
      },
    );
  }, []);

  React.useEffect(() => {
    const requestId = ++suggestionRequestRef.current;
    suggestionAbortRef.current?.abort();
    suggestionAbortRef.current = null;
    if (!open || suggestionsOpen !== true) {
      setSuggestionsLoading(false);
      setSuggestionError(null);
      return undefined;
    }
    const query = workspaceDirectoryAutocompleteQuery(pathDraft, homePathRef.current);
    if (query === null) {
      setSuggestions([]);
      setSuggestionIndex(-1);
      setSuggestionsLoading(false);
      setSuggestionError(null);
      setSuggestionsOpen(false);
      return undefined;
    }
    const controller = new AbortController();
    suggestionAbortRef.current = controller;
    setSuggestionsLoading(true);
    setSuggestionError(null);
    const timer = window.setTimeout(() => {
      void listDirectory(query.requestPath, controller.signal)
        .then((value) => {
          if (suggestionRequestRef.current !== requestId || controller.signal.aborted) return;
          const listing = normalizeHostDirectoryListing(value, query.requestPath);
          const next = workspaceDirectorySuggestions(
            listing.entries,
            query.prefix,
            listing.home || homePathRef.current,
            showHidden,
          );
          setSuggestions(next);
          setSuggestionIndex(next.length === 0 ? -1 : 0);
        })
        .catch((reason) => {
          if (suggestionRequestRef.current !== requestId || controller.signal.aborted) return;
          if (reason?.name === 'AbortError' || reason?.name === 'CanceledError') return;
          setSuggestions([]);
          setSuggestionIndex(-1);
          setSuggestionError(t('editor.workspaceDirectoryLoadFailed', { message: failureText(reason, t) }));
        })
        .finally(() => {
          if (suggestionRequestRef.current !== requestId || controller.signal.aborted) return;
          setSuggestionsLoading(false);
          if (suggestionAbortRef.current === controller) suggestionAbortRef.current = null;
        });
    }, 120);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
      if (suggestionAbortRef.current === controller) suggestionAbortRef.current = null;
    };
  }, [listDirectory, open, pathDraft, showHidden, suggestionsOpen]);

  React.useEffect(() => {
    if (!suggestionsOpen || suggestionIndex < 0) return;
    const activeOption = suggestionListRef.current?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]');
    activeOption?.scrollIntoView?.({ block: 'nearest' });
  }, [suggestionIndex, suggestions, suggestionsOpen]);

  React.useEffect(() => {
    if (!open) {
      composingRef.current = false;
      requestRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
      suggestionRequestRef.current += 1;
      suggestionAbortRef.current?.abort();
      suggestionAbortRef.current = null;
      focusRequestRef.current?.();
      focusRequestRef.current = null;
      return;
    }
    setGeometry(workspaceDirectoryPickerGeometry(window.innerWidth, window.innerHeight));
    setRootPath('');
    setRootName('');
    homePathRef.current = '';
    setPathDraft('');
    setChildrenByPath(new Map());
    setExpanded(new Set());
    setSelectedPath(null);
    setShowHidden(false);
    setError(null);
    setSuggestions([]);
    setSuggestionIndex(-1);
    setSuggestionsOpen(false);
    setSuggestionsLoading(false);
    setSuggestionError(null);
    void loadRootDirectory();
  }, [loadRootDirectory, open]);

  React.useEffect(
    () => () => {
      abortRef.current?.abort();
      suggestionAbortRef.current?.abort();
      focusRequestRef.current?.();
    },
    [],
  );

  const toggleDirectory = React.useCallback(
    async (path: string): Promise<void> => {
      if (expanded.has(path)) {
        setExpanded((current) => {
          const next = new Set(current);
          next.delete(path);
          return next;
        });
        return;
      }
      setExpanded((current) => new Set([...current, path]));
      if (childrenByPath.has(path)) return;
      setLoading(true);
      setError(null);
      try {
        const listing = normalizeHostDirectoryListing(await listDirectory(path), path);
        setChildrenByPath((current) => {
          const next = new Map(current);
          next.set(path, listing.entries);
          return next;
        });
      } catch (reason) {
        setError(t('editor.workspaceDirectoryLoadFailed', { message: failureText(reason, t) }));
        setExpanded((current) => {
          const next = new Set(current);
          next.delete(path);
          return next;
        });
      } finally {
        setLoading(false);
      }
    },
    [childrenByPath, expanded, listDirectory, t],
  );

  const treeRows = React.useMemo(
    () =>
      flattenDirectoryTreeRows({
        rootPath,
        rootName,
        expanded,
        showHidden,
        childrenByPath,
      }),
    [childrenByPath, expanded, rootName, rootPath, showHidden],
  );
  const selection = React.useMemo(() => new Set(selectedPath === null ? [] : [selectedPath]), [selectedPath]);
  const statusContent =
    error !== null ? (
      <div
        role='alert'
        style={{
          margin: '8px 10px',
          padding: '8px 10px',
          border: '1px solid var(--dsw-alias-state-error-primary)',
          borderRadius: 4,
          color: 'var(--dsw-alias-state-error-primary)',
          ...EDITOR_TEXT_STYLE.body,
        }}>
        {error}
      </div>
    ) : loading && treeRows.length === 0 ? (
      <div
        role='status'
        style={{
          padding: '18px 12px',
          color: 'var(--dsw-alias-label-secondary)',
          textAlign: 'center',
          ...EDITOR_TEXT_STYLE.body,
        }}>
        {t('editor.workspaceDirectoryLoading')}
      </div>
    ) : null;
  const selectSuggestion = (suggestion: WorkspaceDirectorySuggestion): void => {
    setPathDraft(suggestion.displayPath);
    setSelectedPath(suggestion.path);
    setSuggestionsOpen(false);
    setSuggestionIndex(-1);
    pathInputRef.current?.focus();
  };
  const selectTreePath = (path: string): void => {
    setSelectedPath(path);
    setPathDraft(displayWorkspaceDirectoryPath(path, homePathRef.current));
    setSuggestionsOpen(false);
  };
  const revealDirectoryPath = async (pathValue: string): Promise<void> => {
    const requestedPath = resolveWorkspaceDirectoryPath(pathValue, homePathRef.current);
    if (requestedPath === '') {
      setError(t('editor.workspaceDirectoryPathRequired'));
      pathInputRef.current?.focus();
      return;
    }
    const requestId = ++requestRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setSuggestionsOpen(false);
    try {
      const targetListing = normalizeHostDirectoryListing(
        await listDirectory(requestedPath, controller.signal),
        requestedPath,
      );
      if (requestRef.current !== requestId) return;
      if (targetListing.path === '') throw new Error(t('editor.workspaceDirectoryPathRequired'));
      homePathRef.current = targetListing.home;
      const displayedPath = displayWorkspaceDirectoryPath(targetListing.path, targetListing.home);
      setPathDraft(displayedPath);
      setSelectedPath(targetListing.path);
      if (directoryPathHasHiddenSegment(targetListing.path)) setShowHidden(true);
      if (rootPath === '' || !directoryPathIsWithin(rootPath, targetListing.path)) {
        setRootPath(targetListing.path);
        setRootName(
          targetListing.path === targetListing.home ? '~' : directoryBaseName(targetListing.path) || targetListing.path,
        );
        setChildrenByPath(new Map([[targetListing.path, targetListing.entries]]));
        setExpanded(new Set([targetListing.path]));
        focusTreePath(targetListing.path);
        return;
      }
      const nextChildren = new Map(childrenByPath);
      const chain: string[] = [];
      let cursor = targetListing.path;
      while (cursor !== rootPath) {
        chain.unshift(cursor);
        const parent = directoryPathParent(cursor);
        if (parent === cursor || !directoryPathIsWithin(rootPath, parent)) break;
        cursor = parent;
      }
      for (const ancestor of chain.slice(0, -1)) {
        if (nextChildren.has(ancestor)) continue;
        const value = await listDirectory(ancestor, controller.signal);
        if (requestRef.current !== requestId || controller.signal.aborted) return;
        const listing = normalizeHostDirectoryListing(value, ancestor);
        nextChildren.set(listing.path || ancestor, listing.entries);
      }
      nextChildren.set(targetListing.path, targetListing.entries);
      setChildrenByPath(nextChildren);
      setExpanded((current) => new Set([...current, rootPath, ...chain]));
      focusTreePath(targetListing.path);
    } catch (reason) {
      if (requestRef.current !== requestId || controller.signal.aborted) return;
      if (reason?.name === 'AbortError' || reason?.name === 'CanceledError') return;
      setError(t('editor.workspaceDirectoryLoadFailed', { message: failureText(reason, t) }));
    } finally {
      if (requestRef.current === requestId) {
        setLoading(false);
        if (abortRef.current === controller) abortRef.current = null;
      }
    }
  };
  const submitPath = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const nextPath = pathDraft.trim();
    if (nextPath === '') {
      setError(t('editor.workspaceDirectoryPathRequired'));
      pathInputRef.current?.focus();
      return;
    }
    void revealDirectoryPath(nextPath);
  };
  const enterPathDirectory = (): void => {
    if (pathDraft.trim() === '' || creating) return;
    void revealDirectoryPath(pathDraft.trim());
  };
  const addWorkspace = async (): Promise<void> => {
    if (selectedPath === null || creating) return;
    setCreating(true);
    setError(null);
    try {
      const workspace = await createWorkspace(selectedPath);
      const workspaceId = typeof workspace.workspaceId === 'string' ? workspace.workspaceId : '';
      onWorkspaceCreated(workspaceId);
      onClose();
    } catch (reason) {
      setError(t('editor.workspaceDirectoryCreateFailed', { message: failureText(reason, t) }));
    } finally {
      setCreating(false);
    }
  };

  return (
    <FloatingToolPopup
      open={open}
      kind='workspaceDirectory'
      geometry={geometry}
      backdrop={true}
      trapFocus={true}
      ariaLabel={t('editor.workspaceDirectoryTitle')}
      returnFocusElement={returnFocusElement}
      onRequestClose={() => {
        if (!creating) onClose();
      }}
      onBackdropMouseDown={(event) => {
        if (event.target === event.currentTarget && !creating) onClose();
      }}
      onGeometryChange={setGeometry}
      surfaceStyle={{
        display: 'flex',
        flexDirection: 'column',
        color: 'var(--dsw-alias-label-primary)',
        ...EDITOR_TEXT_STYLE.body,
      }}>
      <PickerSurface>
        <div
          data-dsh-workspace-directory-drag=''
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: 'none',
            minHeight: 38,
            padding: '4px 8px 4px 12px',
            borderBottom: '1px solid var(--dsw-alias-border-l3)',
            background: 'var(--dsw-alias-bg-layer-1)',
            cursor: 'move',
            userSelect: 'none',
          }}>
          <Icon
            name='project'
            size={POPUP_ICON_SIZE}
          />
          <span
            style={{
              flex: '1 1 auto',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: 600,
              ...EDITOR_TEXT_STYLE.title,
            }}>
            {t('editor.workspaceDirectoryTitle')}
          </span>
          <ToolbarButton
            icon='close'
            label={t('editor.workspaceDirectoryCancel')}
            onClick={onClose}
            disabled={creating}
          />
        </div>
        <form
          onSubmit={submitPath}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: 'none',
            padding: '8px 10px',
            borderBottom: '1px solid var(--dsw-alias-border-l3)',
          }}>
          <label
            htmlFor='dsh-workspace-directory-path'
            style={{
              flex: 'none',
              color: 'var(--dsw-alias-label-secondary)',
              ...EDITOR_TEXT_STYLE.label,
            }}>
            {t('editor.workspaceDirectoryPath')}
          </label>
          <div
            style={{
              position: 'relative',
              flex: '1 1 auto',
              minWidth: 0,
            }}>
            <input
              id='dsh-workspace-directory-path'
              ref={pathInputRef}
              value={pathDraft}
              role='combobox'
              aria-autocomplete='list'
              aria-expanded={suggestionsOpen && suggestions.length > 0}
              aria-controls='dsh-workspace-directory-suggestions'
              aria-activedescendant={
                suggestionIndex >= 0 && suggestions[suggestionIndex] !== undefined
                  ? `dsh-workspace-directory-suggestion-${encodeURIComponent(suggestions[suggestionIndex].path)}`
                  : undefined
              }
              onCompositionStart={() => {
                composingRef.current = true;
                setSuggestions([]);
                setSuggestionIndex(-1);
                setSuggestionsLoading(false);
                setSuggestionError(null);
                setSuggestionsOpen(false);
              }}
              onCompositionEnd={(event) => {
                composingRef.current = false;
                setPathDraft(event.currentTarget.value);
                setSelectedPath(null);
                setSuggestions([]);
                setSuggestionIndex(-1);
                setSuggestionsLoading(true);
                setSuggestionError(null);
                setSuggestionsOpen(true);
              }}
              onChange={(event) => {
                setPathDraft(event.target.value);
                setSelectedPath(null);
                if (composingRef.current) {
                  setSuggestions([]);
                  setSuggestionIndex(-1);
                  setSuggestionsLoading(false);
                  setSuggestionError(null);
                  setSuggestionsOpen(false);
                  return;
                }
                setSuggestions([]);
                setSuggestionIndex(-1);
                setSuggestionsLoading(true);
                setSuggestionError(null);
                setSuggestionsOpen(true);
              }}
              onFocus={() => setSuggestionsOpen(true)}
              onBlur={(event) => {
                const next = event.relatedTarget;
                if (next instanceof Node && event.currentTarget.parentElement?.contains(next) === true) return;
                setSuggestionsOpen(false);
              }}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing === true) return;
                if (event.key === 'Escape' && suggestionsOpen) {
                  event.preventDefault();
                  event.stopPropagation();
                  setSuggestionsOpen(false);
                  return;
                }
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  if (suggestions.length === 0) {
                    setSuggestionsOpen(true);
                    return;
                  }
                  event.preventDefault();
                  const direction = event.key === 'ArrowDown' ? 1 : -1;
                  setSuggestionIndex((current) => {
                    const count = suggestions.length;
                    if (count === 0) return -1;
                    return current < 0 ? (direction > 0 ? 0 : count - 1) : (current + direction + count) % count;
                  });
                  return;
                }
                if (event.key === 'Enter' && suggestionsOpen && suggestionIndex >= 0) {
                  const suggestion = suggestions[suggestionIndex];
                  if (suggestion === undefined) return;
                  event.preventDefault();
                  selectSuggestion(suggestion);
                }
              }}
              spellCheck={false}
              style={{
                width: '100%',
                minWidth: 0,
                height: 28,
                padding: '0 8px',
                border: '1px solid var(--dsw-alias-border-l2, var(--dsw-alias-border-l3))',
                borderRadius: 4,
                outline: 'none',
                background: 'var(--dsw-alias-bg-base)',
                color: 'var(--dsw-alias-label-primary)',
                ...EDITOR_TEXT_STYLE.input,
              }}
            />
            {suggestionsOpen ? (
              <div
                id='dsh-workspace-directory-suggestions'
                ref={suggestionListRef}
                role='listbox'
                aria-label={t('editor.workspaceDirectorySuggestions')}
                aria-busy={suggestionsLoading ? 'true' : undefined}
                data-dsh-workspace-directory-suggestions=''
                style={{
                  position: 'absolute',
                  zIndex: 30,
                  top: 'calc(100% + 4px)',
                  left: 0,
                  right: 0,
                  maxHeight: 190,
                  overflowY: 'auto',
                  padding: 4,
                  border: POPUP_BORDER,
                  borderRadius: 6,
                  background: 'var(--dsw-alias-bg-base)',
                  boxShadow: '0 10px 28px rgba(0, 0, 0, 0.24)',
                }}>
                {suggestionsLoading && suggestions.length === 0 ? (
                  <div
                    role='status'
                    style={{
                      padding: '6px 8px',
                      color: 'var(--dsw-alias-label-tertiary)',
                      ...EDITOR_TEXT_STYLE.metadata,
                    }}>
                    {t('editor.workspaceDirectoryLoading')}
                  </div>
                ) : suggestionError !== null ? (
                  <div
                    role='alert'
                    style={{
                      padding: '6px 8px',
                      color: 'var(--dsw-alias-state-error-primary)',
                      whiteSpace: 'normal',
                      overflowWrap: 'anywhere',
                      ...EDITOR_TEXT_STYLE.metadata,
                    }}>
                    {suggestionError}
                  </div>
                ) : suggestions.length === 0 ? (
                  <div
                    style={{
                      padding: '6px 8px',
                      color: 'var(--dsw-alias-label-tertiary)',
                      ...EDITOR_TEXT_STYLE.metadata,
                    }}>
                    {t('editor.workspaceDirectoryNoSuggestions')}
                  </div>
                ) : (
                  suggestions.map((suggestion, index) => (
                    <button
                      key={suggestion.path}
                      id={`dsh-workspace-directory-suggestion-${encodeURIComponent(suggestion.path)}`}
                      type='button'
                      role='option'
                      tabIndex={-1}
                      aria-selected={index === suggestionIndex}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectSuggestion(suggestion)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        width: '100%',
                        minHeight: 28,
                        padding: '4px 8px',
                        border: 'none',
                        borderRadius: 4,
                        background:
                          index === suggestionIndex
                            ? 'var(--dsw-alias-button-ghost-active-fill, var(--dsw-alias-interactive-bg-hover-solid))'
                            : 'transparent',
                        color: 'var(--dsw-alias-label-primary)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        ...EDITOR_TEXT_STYLE.control,
                      }}>
                      <Icon
                        name='folder'
                        size={POPUP_ICON_SIZE}
                      />
                      <span
                        style={{
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                        {suggestion.displayPath}
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
          <div
            data-dsh-workspace-directory-actions=''
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 4,
              flex: '0 0 auto',
              marginLeft: 'auto',
            }}>
            <button
              type='button'
              aria-label={t('editor.workspaceDirectoryEnter')}
              title={t('editor.workspaceDirectoryEnter')}
              disabled={pathDraft.trim() === '' || creating}
              onClick={enterPathDirectory}
              style={{
                width: 28,
                height: 28,
                padding: 0,
                border: '1px solid var(--dsw-alias-border-l3)',
                borderRadius: 4,
                background: 'var(--dsw-alias-bg-base)',
                color: 'var(--dsw-alias-label-primary)',
                cursor: pathDraft.trim() === '' || creating ? 'default' : 'pointer',
                opacity: pathDraft.trim() === '' || creating ? 0.45 : 1,
                ...EDITOR_TEXT_STYLE.control,
              }}>
              →
            </button>
            <ToolbarButton
              icon='refresh'
              label={t('editor.refresh')}
              onClick={() =>
                void loadRootDirectory(
                  pathDraft.trim() === ''
                    ? undefined
                    : resolveWorkspaceDirectoryPath(pathDraft.trim(), homePathRef.current),
                )
              }
              disabled={loading || creating}
            />
            <button
              type='button'
              aria-label={t('editor.workspaceDirectoryShowHidden')}
              title={t('editor.workspaceDirectoryShowHidden')}
              aria-pressed={showHidden}
              onClick={() => setShowHidden((value) => !value)}
              style={{
                height: 28,
                padding: '0 8px',
                border: '1px solid var(--dsw-alias-border-l3)',
                borderRadius: 4,
                background: showHidden ? 'var(--dsw-alias-button-ghost-active-fill)' : 'transparent',
                color: 'var(--dsw-alias-label-secondary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                ...EDITOR_TEXT_STYLE.label,
              }}>
              {t('editor.workspaceDirectoryShowHiddenShort')}
            </button>
          </div>
        </form>
        <FileTreeView
          t={t}
          ariaLabel={t('editor.workspaceDirectoryTree')}
          rows={treeRows}
          expanded={expanded}
          selection={selection}
          primaryPath={selectedPath}
          treeRef={treeRef}
          rowRefs={rowRefs}
          ariaBusy={loading}
          statusContent={statusContent}
          positionForRow={(row, rowIndex) => ({
            level: row.depth + 1,
            posinset: rowIndex + 1,
            setsize: treeRows.length,
          })}
          onRowPointerDown={(state: FileTreeViewRowState) => selectTreePath(state.row.path)}
          onRowClick={(state: FileTreeViewRowState) => selectTreePath(state.row.path)}
          onRowDoubleClick={(state: FileTreeViewRowState, event) => {
            event.stopPropagation();
            if (state.isDirectory) void toggleDirectory(state.row.path);
          }}
          onToggleRow={(row) => void toggleDirectory(row.path)}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: 'none',
            padding: '8px 10px',
            borderTop: '1px solid var(--dsw-alias-border-l3)',
            background: 'var(--dsw-alias-bg-layer-1)',
          }}>
          <span
            title={selectedPath ?? ''}
            style={{
              flex: '1 1 auto',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'var(--dsw-alias-label-tertiary)',
              ...EDITOR_TEXT_STYLE.metadata,
            }}>
            {selectedPath ?? ''}
          </span>
          <button
            type='button'
            onClick={onClose}
            disabled={creating}
            style={{
              height: 28,
              padding: '0 12px',
              border: '1px solid var(--dsw-alias-border-l3)',
              borderRadius: 4,
              background: 'var(--dsw-alias-bg-base)',
              color: 'var(--dsw-alias-label-primary)',
              cursor: creating ? 'default' : 'pointer',
              ...EDITOR_TEXT_STYLE.control,
            }}>
            {t('editor.workspaceDirectoryCancel')}
          </button>
          <button
            type='button'
            onClick={() => void addWorkspace()}
            disabled={selectedPath === null || loading || creating}
            style={{
              height: 28,
              padding: '0 12px',
              border: '1px solid var(--dsw-alias-state-business-primary)',
              borderRadius: 4,
              background: 'var(--dsw-alias-state-business-primary)',
              color: '#fff',
              cursor: selectedPath === null || loading || creating ? 'default' : 'pointer',
              opacity: selectedPath === null || loading || creating ? 0.55 : 1,
              ...EDITOR_TEXT_STYLE.control,
            }}>
            {creating ? t('editor.workspaceDirectoryCreating') : t('editor.workspaceDirectoryAdd')}
          </button>
        </div>
      </PickerSurface>
    </FloatingToolPopup>
  );
}

export { WorkspaceDirectoryPicker };
