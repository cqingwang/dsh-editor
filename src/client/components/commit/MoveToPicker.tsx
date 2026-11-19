import React from 'react';
import { styles } from '../../ui/styles';
import { Icon, POPUP_ICON_SIZE } from '../ui/Icon';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface MoveToPickerState {
  directories?: string[];
  query?: string;
  index?: number;
  loading?: boolean;
  rootName?: string;
  parent?: string;
}

export interface MoveToPickerProps {
  t: Translate;
  state: MoveToPickerState;
  onQuery: (value: string) => void;
  onMove: (direction: -1 | 1, count: number) => void;
  onPick: (directory: string) => void;
  onClose: () => void;
  title?: string;
  placeholder?: string;
  currentLabel?: string;
}

/** IDEA's searchable Move to destination-directory dialog. */
function MoveToPicker({
  t,
  state,
  onQuery,
  onMove,
  onPick,
  onClose,
  title = t('editor.moveTo'),
  placeholder = t('editor.moveToPlaceholder'),
  currentLabel = t('editor.moveToCurrent'),
}: MoveToPickerProps) {
  const directories = state.directories ?? [];
  const query = state.query ?? '';
  const needle = query.trim().toLowerCase();
  const visible = needle === '' ? directories : directories.filter((entry) => entry.toLowerCase().includes(needle));
  const index = Math.max(0, Math.min(state.index ?? 0, Math.max(0, visible.length - 1)));
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    const node = listRef.current;
    node?.querySelector<HTMLElement>('[data-dsh-active="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [index, needle, visible.length]);

  return (
    <div
      style={styles.paletteBackdrop}
      data-dsh-move-to-picker=''
      onMouseDown={onClose}>
      <div
        style={styles.palette}
        role='dialog'
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}>
        <input
          ref={inputRef}
          style={styles.paletteInput}
          autoFocus={true}
          placeholder={placeholder}
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing === true) return;
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              onMove(1, visible.length);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              onMove(-1, visible.length);
            } else if (event.key === 'Enter') {
              event.preventDefault();
              if (visible[index] !== undefined) onPick(visible[index]);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              onClose();
            }
          }}
        />
        <div
          ref={listRef}
          style={styles.paletteList}>
          {state.loading === true && directories.length === 0 ? (
            <div style={styles.treeMessage}>{t('editor.loading')}</div>
          ) : null}
          {state.loading !== true && visible.length === 0 ? (
            <div style={styles.treeMessage}>{t('editor.noMatches')}</div>
          ) : null}
          {visible.map((directory, position) => (
            <div
              key={directory === '' ? '__root__' : directory}
              data-dsh-active={position === index ? 'true' : 'false'}
              className='dsh-editor-palette-row'
              style={{
                ...styles.paletteRow,
                ...(position === index ? styles.paletteRowActive : null),
              }}
              onMouseDown={(event) => {
                event.preventDefault();
                onPick(directory);
              }}>
              <Icon
                name='folder'
                size={POPUP_ICON_SIZE}
              />
              <span style={styles.paletteName}>{directory === '' ? (state.rootName ?? '/') : directory}</span>
              {directory === (state.parent ?? '') ? <span style={styles.paletteDir}>{currentLabel}</span> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { MoveToPicker };
