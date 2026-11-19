import React from 'react';
import { styles } from '../../ui/styles';
import { EDITOR_CODE_FONT, EDITOR_FONT_SIZE_SCALE } from '../editor/editor-style-model';
import { ContextMenu } from '../ui/Menu';
import { Icon, POPUP_ICON_SIZE } from '../ui/Icon';
import { ToolbarButton } from '../ui/ToolbarButton';
import { SearchFileResultItem } from './SearchFileResultItem';
import {
  filterUsageMatches,
  normalizeUsageMatchIndex,
  searchEverywhereOptionId,
  searchResultContextItems,
  usageMatchRowKey,
} from '../../commit';
import { basename } from '../../editor-core';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface UsageMatch {
  path: string;
  line: number;
  column: number;
  preview?: string;
  [key: string]: unknown;
}

export interface ShowUsagesState {
  matches: UsageMatch[];
  filter: string;
  index: number;
  query: string;
  loading?: boolean;
  error: string | null;
  [key: string]: unknown;
}

export interface ShowUsagesPopupProps {
  t: Translate;
  state: ShowUsagesState;
  onFilterChange: (filter: string) => void;
  onMove: (index: number) => void;
  onOpen: (match: UsageMatch) => void;
  onPin: () => void;
  onOpenInRightSplit: (
    path: string,
    location: {
      path: string;
      line: number;
      column: number;
    },
  ) => void;
  onRevealResult: (path: string) => void;
  onNotify: (message: string) => void;
  onClose: () => void;
}

function ShowUsagesPopup({
  t,
  state,
  onFilterChange,
  onMove,
  onOpen,
  onPin,
  onOpenInRightSplit,
  onRevealResult,
  onNotify,
  onClose,
}: ShowUsagesPopupProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const [resultMenu, setResultMenu] = React.useState<Record<string, unknown> | null>(null);
  const LISTBOX_ID = 'dsh-editor-show-usages-listbox';
  const matches: UsageMatch[] = filterUsageMatches(state.matches, state.filter);
  const activeIndex = normalizeUsageMatchIndex(matches, state.index);
  const active = matches[activeIndex] ?? null;
  const status =
    state.loading === true
      ? t('editor.loading')
      : state.error !== null
        ? state.error
        : matches.length === 0
          ? t('editor.showUsagesEmpty')
          : t('editor.searchResultCount', { count: matches.length });

  React.useEffect(() => {
    inputRef.current?.focus?.();
  }, []);

  React.useEffect(() => {
    listRef.current?.querySelector?.('[data-show-usages-active="1"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, state.filter, state.matches]);

  const move = (direction: number) => {
    if (matches.length === 0) return;
    onMove((activeIndex + direction + matches.length) % matches.length);
  };

  const openUsageMenuAt = (x: number, y: number, match: UsageMatch | null) => {
    if (match === null) return;
    setResultMenu({
      x,
      y,
      title: basename(match.path),
      items: searchResultContextItems({
        t,
        result: { ...match, kind: 'text' },
        onCloseMenu: () => setResultMenu(null),
        onOpenEditor: () => onOpen(match),
        onOpenInRightSplit: () => {
          onClose();
          onOpenInRightSplit(match.path, {
            path: match.path,
            line: match.line,
            column: match.column,
          });
        },
        onRevealResult: () => {
          onClose();
          onRevealResult(match.path);
        },
        onNotify,
      }),
    });
  };

  const openUsageMenu = (event: React.MouseEvent<HTMLDivElement>, match: UsageMatch) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus?.();
    onMove(matches.indexOf(match));
    openUsageMenuAt(event.clientX, event.clientY, match);
  };

  const openActiveUsageMenu = () => {
    if (active === null) return;
    const rect = listRef.current?.querySelector?.('[data-show-usages-active="1"]')?.getBoundingClientRect?.();
    openUsageMenuAt(rect?.left ?? 20, rect?.bottom ?? 20, active);
  };

  const handleUsageKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ContextMenu' || (event.shiftKey === true && event.key === 'F10')) {
      event.preventDefault();
      event.stopPropagation();
      openActiveUsageMenu();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (active !== null) onOpen(active);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div
      style={{
        ...styles.paletteBackdrop,
        paddingTop: '8vh',
      }}
      onMouseDown={onClose}
      data-dsh-show-usages=''>
      <div
        style={{
          ...styles.palette,
          ...styles.searchEverywhere,
        }}
        role='dialog'
        aria-modal='true'
        aria-label={t('editor.showUsagesTitle', { query: state.query })}
        onMouseDown={(event) => event.stopPropagation()}>
        <div style={styles.searchEverywhereSearchRow}>
          <Icon
            name='search'
            size={POPUP_ICON_SIZE}
          />
          <input
            ref={inputRef}
            style={styles.searchEverywhereInput}
            value={state.filter}
            placeholder={t('editor.showUsagesFilterPlaceholder')}
            aria-label={t('editor.showUsagesFilterPlaceholder')}
            role='combobox'
            aria-autocomplete='list'
            aria-controls={LISTBOX_ID}
            aria-activedescendant={active === null ? undefined : searchEverywhereOptionId(usageMatchRowKey(active))}
            onChange={(event) => onFilterChange(event.target.value)}
            onKeyDown={handleUsageKeyDown}
          />
          <ToolbarButton
            icon='findWindow'
            label={t('editor.openInFindToolWindow')}
            disabled={state.loading === true || state.matches.length === 0}
            onClick={onPin}
          />
        </div>
        <div
          role='status'
          aria-live='polite'
          aria-atomic='true'
          style={styles.screenReaderOnly}>
          {status}
        </div>
        {state.loading === true ? (
          <div style={styles.findToolMessage}>{t('editor.loading')}</div>
        ) : state.error !== null ? (
          <div
            style={styles.searchEverywhereError}
            role='alert'>
            {state.error}
          </div>
        ) : matches.length === 0 ? (
          <div style={styles.findToolMessage}>{t('editor.showUsagesEmpty')}</div>
        ) : null}
        <div
          ref={listRef}
          id={LISTBOX_ID}
          role='listbox'
          aria-label={t('editor.showUsagesTitle', { query: state.query })}
          aria-activedescendant={active === null ? undefined : searchEverywhereOptionId(usageMatchRowKey(active))}
          style={styles.searchEverywhereList}
          tabIndex={0}
          onKeyDown={handleUsageKeyDown}>
          {matches.map((match, position) => (
            <div
              key={usageMatchRowKey(match)}
              id={searchEverywhereOptionId(usageMatchRowKey(match))}
              role='option'
              aria-selected={position === activeIndex}
              data-dsh-show-usages-option=''
              data-show-usages-active={position === activeIndex ? '1' : '0'}
              style={{
                ...styles.searchEverywhereRow,
                background: position === activeIndex ? 'var(--dsw-alias-state-business-primary)' : 'transparent',
                cursor: 'pointer',
              }}
              tabIndex={position === activeIndex ? 0 : -1}
              onMouseEnter={() => onMove(position)}
              onContextMenu={(event) => openUsageMenu(event, match)}
              onClick={() => onOpen(match)}>
              <SearchFileResultItem
                path={match.path}
                name={`${match.path}:${match.line}:${match.column}`}
                detail={match.preview ?? ''}
                nameStyle={{
                  flex: '0 1 45%',
                  color: 'var(--dsw-alias-label-primary)',
                  fontFamily: EDITOR_CODE_FONT,
                  fontSize: EDITOR_FONT_SIZE_SCALE.label,
                }}
                detailStyle={{
                  flex: '1 1 auto',
                  color: 'var(--dsw-alias-label-secondary)',
                  fontSize: EDITOR_FONT_SIZE_SCALE.body,
                }}
              />
            </div>
          ))}
        </div>
        {resultMenu === null ? null : (
          <ContextMenu
            t={t}
            menu={resultMenu as never}
            onClose={() => setResultMenu(null)}
          />
        )}
      </div>
    </div>
  );
}

export { ShowUsagesPopup };
