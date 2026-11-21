import React from 'react';
import { guideKind } from '../../terminal';
import { styles } from '../../ui/styles';
import { EntryIcon } from '../ui/EntryIcon';
import { Icon } from '../ui/Icon';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface FileTreeViewRow {
  path: string;
  name?: string;
  kind?: string;
  depth?: number;
  root?: boolean;
  continues?: boolean[];
  searchOpen?: boolean;
}

export interface FileTreeViewRowPosition {
  level: number;
  posinset: number;
  setsize: number;
}

export interface FileTreeViewRowState<Row extends FileTreeViewRow = FileTreeViewRow> {
  row: Row;
  rowIndex: number;
  isDirectory: boolean;
  open: boolean;
  selected: boolean;
  primary: boolean;
  position: FileTreeViewRowPosition;
}

export interface FileTreeViewRowDecoration {
  className?: string;
  style?: React.CSSProperties;
  iconClassName?: string;
  title?: string;
  ariaDescription?: string;
  draggable?: boolean;
  onDragStart?: React.DragEventHandler<HTMLDivElement>;
  onDragEnd?: React.DragEventHandler<HTMLDivElement>;
  onDragEnter?: React.DragEventHandler<HTMLDivElement>;
  onDragOver?: React.DragEventHandler<HTMLDivElement>;
  onDragLeave?: React.DragEventHandler<HTMLDivElement>;
  onDrop?: React.DragEventHandler<HTMLDivElement>;
}

export interface FileTreeViewProps<Row extends FileTreeViewRow> {
  t: Translate;
  ariaLabel: string;
  rows: Row[];
  expanded: ReadonlySet<string>;
  selection: ReadonlySet<string>;
  primaryPath: string | null;
  treeRef: React.RefObject<HTMLDivElement | null>;
  rowRefs: React.RefObject<Map<string, HTMLElement>>;
  ariaBusy?: boolean;
  treeClassName?: string;
  treeStyle?: React.CSSProperties;
  treeDataAttributes?: Record<string, string | undefined>;
  statusContent?: React.ReactNode;
  positionForRow?: (row: Row, rowIndex: number) => FileTreeViewRowPosition;
  openForRow?: (row: Row) => boolean;
  decorateRow?: (state: FileTreeViewRowState<Row>) => FileTreeViewRowDecoration | null;
  renderName?: (state: FileTreeViewRowState<Row>) => React.ReactNode;
  renderInlineEditor?: (row: Row) => React.ReactNode | null;
  renderTrailing?: (state: FileTreeViewRowState<Row>) => React.ReactNode;
  onTreeKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  onTreeContextMenu?: React.MouseEventHandler<HTMLDivElement>;
  onTreeDragEnter?: React.DragEventHandler<HTMLDivElement>;
  onTreeDragOver?: React.DragEventHandler<HTMLDivElement>;
  onTreeDragLeave?: React.DragEventHandler<HTMLDivElement>;
  onTreeDrop?: React.DragEventHandler<HTMLDivElement>;
  onRowPointerDown?: (state: FileTreeViewRowState<Row>, event: React.MouseEvent<HTMLDivElement>) => void;
  onRowClick?: (state: FileTreeViewRowState<Row>, event: React.MouseEvent<HTMLDivElement>) => void;
  onRowDoubleClick?: (state: FileTreeViewRowState<Row>, event: React.MouseEvent<HTMLDivElement>) => void;
  onRowContextMenu?: (state: FileTreeViewRowState<Row>, event: React.MouseEvent<HTMLDivElement>) => void;
  onToggleRow?: (row: Row) => void;
}

function defaultPosition<Row extends FileTreeViewRow>(
  row: Row,
  rowIndex: number,
  rowCount: number,
): FileTreeViewRowPosition {
  return {
    level: (row.depth ?? 0) + 1,
    posinset: rowIndex + 1,
    setsize: rowCount,
  };
}

function defaultOpen<Row extends FileTreeViewRow>(row: Row, expanded: ReadonlySet<string>): boolean {
  return row.searchOpen === true || expanded.has(row.path);
}

/**
 * Controlled file-tree renderer shared by Project and external path pickers.
 *
 * The component owns tree semantics and row visuals only. Selection meaning,
 * file operations, project views, drag targets and search live with callers.
 */
function FileTreeView<Row extends FileTreeViewRow>({
  t,
  ariaLabel,
  rows,
  expanded,
  selection,
  primaryPath,
  treeRef,
  rowRefs,
  ariaBusy,
  treeClassName,
  treeStyle,
  treeDataAttributes,
  statusContent,
  positionForRow,
  openForRow,
  decorateRow,
  renderName,
  renderInlineEditor,
  renderTrailing,
  onTreeKeyDown,
  onTreeContextMenu,
  onTreeDragEnter,
  onTreeDragOver,
  onTreeDragLeave,
  onTreeDrop,
  onRowPointerDown,
  onRowClick,
  onRowDoubleClick,
  onRowContextMenu,
  onToggleRow,
}: FileTreeViewProps<Row>) {
  const treeDomId = React.useId().replaceAll(':', '');
  const rowDomId = (rowIndex: number): string => `${treeDomId}-row-${rowIndex}`;
  const primaryRowIndex = rows.findIndex((row) => row.kind !== 'placeholder' && row.path === primaryPath);
  const activeDescendantId = primaryRowIndex < 0 ? undefined : rowDomId(primaryRowIndex);
  return (
    <div
      className={treeClassName === undefined ? 'dsh-editor-tool-scroll' : `dsh-editor-tool-scroll ${treeClassName}`}
      ref={treeRef}
      tabIndex={0}
      style={{ ...styles.treeScroll, ...treeStyle }}
      data-dsh-file-tree=''
      {...treeDataAttributes}
      onKeyDown={onTreeKeyDown}
      onContextMenu={onTreeContextMenu}
      role='tree'
      aria-multiselectable={true}
      aria-activedescendant={activeDescendantId}
      aria-busy={ariaBusy ? 'true' : undefined}
      aria-label={ariaLabel}
      onDragEnter={onTreeDragEnter}
      onDragOver={onTreeDragOver}
      onDragLeave={onTreeDragLeave}
      onDrop={onTreeDrop}>
      {statusContent}
      {rows.map((row, rowIndex) => {
        if (row.kind === 'placeholder') {
          return (
            <div
              key={row.path}
              className='dsh-editor-tree-row dsh-editor-tree-row-placeholder'
              data-dsh-placeholder={row.path}
              style={{
                ...styles.treeRow,
                paddingLeft: 8 + (row.depth ?? 0) * 14,
                color: 'var(--dsw-alias-label-tertiary)',
                fontStyle: 'italic',
                cursor: 'default',
              }}>
              {t('editor.emptyDirectory')}
            </div>
          );
        }
        const selected = selection.has(row.path);
        const primary = row.path === primaryPath;
        const isDirectory = row.kind === 'directory';
        const open = openForRow === undefined ? defaultOpen(row, expanded) : openForRow(row);
        const position =
          positionForRow === undefined ? defaultPosition(row, rowIndex, rows.length) : positionForRow(row, rowIndex);
        const state: FileTreeViewRowState<Row> = {
          row,
          rowIndex,
          isDirectory,
          open,
          selected,
          primary,
          position,
        };
        const decoration = decorateRow?.(state) ?? null;
        return (
          <div
            key={row.path === '' ? '__root__' : row.path}
            ref={(element) => {
              if (element !== null) rowRefs.current.set(row.path, element);
              else rowRefs.current.delete(row.path);
            }}
            className={
              decoration?.className ??
              (selected
                ? primary
                  ? 'dsh-editor-tree-row dsh-editor-tree-row-selected'
                  : 'dsh-editor-tree-row dsh-editor-tree-row-selected dsh-editor-tree-row-extended'
                : 'dsh-editor-tree-row')
            }
            style={{
              ...styles.treeRow,
              ...(selected ? (primary ? styles.treeRowSelected : styles.treeRowSelectedSoft) : null),
              ...decoration?.style,
            }}
            title={decoration?.title ?? row.path}
            id={rowDomId(rowIndex)}
            data-dsh-file-tree-row-index={rowIndex}
            role='treeitem'
            aria-level={position.level}
            aria-posinset={position.posinset}
            aria-setsize={position.setsize}
            aria-expanded={isDirectory ? open : undefined}
            aria-selected={selected}
            aria-description={decoration?.ariaDescription}
            onClick={onRowClick === undefined ? undefined : (event) => onRowClick(state, event)}
            onMouseDown={
              onRowPointerDown === undefined
                ? undefined
                : (event) => {
                    const target = event.target instanceof Element ? event.target : null;
                    if (target?.closest('[data-dsh-tree-disclosure]') !== null) return;
                    onRowPointerDown(state, event);
                  }
            }
            onDoubleClick={onRowDoubleClick === undefined ? undefined : (event) => onRowDoubleClick(state, event)}
            onContextMenu={onRowContextMenu === undefined ? undefined : (event) => onRowContextMenu(state, event)}
            draggable={decoration?.draggable}
            onDragStart={decoration?.onDragStart}
            onDragEnd={decoration?.onDragEnd}
            onDragEnter={decoration?.onDragEnter}
            onDragOver={decoration?.onDragOver}
            onDragLeave={decoration?.onDragLeave}
            onDrop={decoration?.onDrop}>
            {(row.depth ?? 0) > 0
              ? Array.from({ length: row.depth ?? 0 }, (_, index) => {
                  const kind = guideKind({
                    continues: row.continues,
                    index,
                    depth: row.depth ?? 0,
                  });
                  return (
                    <span
                      key={index}
                      style={kind === 'line' ? styles.indentGuide : styles.indentGuideStop}
                    />
                  );
                })
              : null}
            {row.root ? null : isDirectory ? (
              <span
                style={{
                  ...styles.chevron,
                  color: selected ? '#fff' : 'var(--dsw-alias-label-tertiary)',
                }}
                role='button'
                tabIndex={-1}
                data-dsh-tree-disclosure=''
                aria-label={open ? t('editor.collapseFolder') : t('editor.expandFolder')}
                title={open ? t('editor.collapseFolder') : t('editor.expandFolder')}
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleRow?.(row);
                }}>
                <Icon
                  name={open ? 'chevronDown' : 'chevronRight'}
                  size={12}
                />
              </span>
            ) : (
              <span
                style={{
                  ...styles.chevron,
                  opacity: 0,
                }}
              />
            )}
            {decoration?.iconClassName === undefined ? (
              <EntryIcon
                entry={row}
                expanded={open}
              />
            ) : (
              <span
                className={decoration.iconClassName}
                data-dsh-tree-icon-decoration=''
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 'none',
                }}>
                <EntryIcon
                  entry={row}
                  expanded={open}
                />
              </span>
            )}
            {renderInlineEditor?.(row) ??
              (renderName === undefined ? (
                <span
                  style={{
                    ...styles.treeName,
                    ...(row.root ? styles.treeRootName : null),
                    ...(row.root ? styles.treeRootLabel : null),
                    ...(selected ? { color: '#fff' } : null),
                  }}>
                  {row.name ?? row.path}
                </span>
              ) : (
                renderName(state)
              ))}
            {renderTrailing?.(state)}
          </div>
        );
      })}
    </div>
  );
}

export { FileTreeView };
