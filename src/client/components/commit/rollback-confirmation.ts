import { styles } from '../../ui/styles';
import { dialogFocusableElements } from '../ui/focus-trap';
import { commitSelectionAfterClick } from './commit-log-selection-model';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export type RollbackDialogGroup = 'staged' | 'unstaged' | 'unversioned' | 'all';

export interface RollbackDialogEntry {
  path: string;
  group: RollbackDialogGroup;
  added?: boolean;
}

/** Stable dialog identity: the same path can exist in more than one band. */
export function rollbackDialogEntryKey(entry: RollbackDialogEntry): string {
  return `${entry.group}:${entry.path}`;
}

/** Restore the dialog's keyboard row without inventing an out-of-range index. */
export function rollbackDialogInitialIndex(entries: readonly RollbackDialogEntry[], selectedKey?: string): number {
  const index = entries.findIndex((entry) => rollbackDialogEntryKey(entry) === selectedKey);
  return index < 0 ? 0 : index;
}

/** Toggle inclusion for every selected row, checking all when any is excluded. */
export function rollbackDialogToggleInclusion(selectedKeys: ReadonlySet<string>, keys: Iterable<string>): Set<string> {
  const next = new Set(selectedKeys);
  const targets = [...keys];
  const include = targets.some((key) => !next.has(key));
  for (const key of targets) {
    if (include) next.add(key);
    else next.delete(key);
  }
  return next;
}

/**
 * Keep row-owned navigation keys out of the dialog's capture-phase guard.
 *
 * The backdrop listens in capture mode so Escape and Tab cannot leak into the
 * editor. That guard must not swallow the keys the focused row handles itself,
 * otherwise Arrow/Home/End navigation and Space inclusion never run.
 */
export function rollbackDialogRowOwnsKey(
  key: unknown,
  target: { closest?: (selector: string) => unknown } | null | undefined,
): boolean {
  if (typeof key !== 'string' || target === null || target === undefined || typeof target.closest !== 'function')
    return false;
  if (target.closest('[data-dsh-rollback-confirm-row]') === null) return false;
  return (
    key === ' ' || key === 'Spacebar' || key === 'ArrowDown' || key === 'ArrowUp' || key === 'Home' || key === 'End'
  );
}

export type RollbackDialogResult =
  | { action: 'rollback'; entries: RollbackDialogEntry[]; deleteAdded: boolean }
  | { action: 'cancel' }
  | {
      action: 'showDiff';
      entry: RollbackDialogEntry;
      entries: RollbackDialogEntry[];
      selectedEntries: RollbackDialogEntry[];
      deleteAdded: boolean;
      scrollTop: number;
    };

export interface RollbackDialogInitial {
  selectedKeys?: ReadonlySet<string>;
  deleteAdded?: boolean;
  selectedKey?: string;
  scrollTop?: number;
}

/** Resume on the row shown in the diff; a fresh dialog keeps Cancel as its safe focus. */
export function rollbackDialogInitialFocusTarget(initial: RollbackDialogInitial): 'row' | 'cancel' {
  return typeof initial.selectedKey === 'string' && initial.selectedKey !== '' ? 'row' : 'cancel';
}

export interface RollbackDialogOptions {
  staged?: boolean;
  unversioned?: boolean;
  all?: boolean;
}

/** Normalize the three mutually exclusive rollback modes. */
export function rollbackDialogOptions(options: RollbackDialogOptions): [boolean, boolean, boolean] {
  return [options?.staged === true, options?.unversioned === true, options?.all === true];
}

/**
 * Classify one rollback target using the same band semantics as the Host.
 *
 * Staged rollback only touches the index, unversioned rollback deletes files,
 * and the default working-tree rollback restores tracked files from the index.
 */
export function rollbackDialogGroupForChange(
  status: unknown,
  stagedOnly: boolean,
  unversionedOnly: boolean,
  all = false,
): RollbackDialogGroup {
  if (stagedOnly) return 'staged';
  if (unversionedOnly || status === '??') return 'unversioned';
  if (all) {
    const porcelain = typeof status === 'string' ? status : '';
    const staged = porcelain[0] !== undefined && porcelain[0] !== ' ' && porcelain[0] !== '?';
    const unstaged = porcelain[1] !== undefined && porcelain[1] !== ' ';
    if (staged && unstaged) return 'all';
    if (staged) return 'staged';
    if (unstaged) return 'unstaged';
    return 'all';
  }
  return 'unstaged';
}

/** Build the dialog rows from the same change snapshot the rollback will use. */
export function rollbackDialogEntries(
  paths: string[],
  changesByPath: ReadonlyMap<string, { status?: string }>,
  stagedOnly: boolean,
  unversionedOnly: boolean,
  all = false,
): RollbackDialogEntry[] {
  return paths.map((path) => ({
    path,
    group: rollbackDialogGroupForChange(changesByPath.get(path)?.status, stagedOnly, unversionedOnly, all),
    added: changesByPath.get(path)?.status?.[0] === 'A',
  }));
}

/**
 * Convert the dialog's selected rows back into Changes-list identities.
 *
 * The Changes list uses `staged:` and `unstaged:` namespaces; unversioned
 * files live in the working-tree namespace even though the dialog labels them
 * separately. Keeping this mapping beside the dialog classification prevents
 * rollback reconciliation from depending on a stale DOM selection.
 */
export function rollbackSelectionKeys(entries: readonly RollbackDialogEntry[]): Set<string> {
  const keys = new Set<string>();
  for (const entry of entries) {
    if (entry.group === 'all') {
      keys.add(`staged:${entry.path}`);
      keys.add(`unstaged:${entry.path}`);
    } else {
      keys.add(`${entry.group === 'staged' ? 'staged' : 'unstaged'}:${entry.path}`);
    }
  }
  return keys;
}

/** Pick the confirmation copy for the rollback band being discarded. */
export function rollbackConfirmKey(all: boolean, stagedOnly: boolean, unversionedOnly: boolean): string {
  if (all) return 'editor.rollbackAllConfirm';
  if (stagedOnly) return 'editor.rollbackStagedConfirm';
  if (unversionedOnly) return 'editor.rollbackUnversionedConfirm';
  return 'editor.rollbackConfirm';
}

/**
 * Pick the confirmation copy from the rows the dialog actually shows.
 *
 * A toolbar rollback requests both bands for every selected path, but a file
 * that only has a working-tree edit must not claim that staged content will be
 * discarded. The row classification is the authoritative description here.
 */
export function rollbackDialogConfirmKey(
  entries: readonly RollbackDialogEntry[],
  all: boolean,
  stagedOnly: boolean,
  unversionedOnly: boolean,
): string {
  if (stagedOnly) return 'editor.rollbackStagedConfirm';
  if (unversionedOnly) return 'editor.rollbackUnversionedConfirm';
  if (!all) return 'editor.rollbackConfirm';
  const groups = new Set(entries.map((entry) => entry.group));
  if (groups.size === 1 && groups.has('unversioned')) return 'editor.rollbackUnversionedConfirm';
  if (groups.size === 1 && groups.has('all')) return 'editor.rollbackAllConfirm';
  return 'editor.rollbackConfirm';
}

/** Project dialog rows into the diff's file-navigation identities. */
export function rollbackNavigationEntries(
  entries: readonly RollbackDialogEntry[],
): Array<{ path: string; staged: boolean }> {
  return entries.map((entry) => ({ path: entry.path, staged: entry.group === 'staged' }));
}

/** The added-file deletion option is meaningful only when an added row exists. */
export function rollbackDialogCanDeleteAdded(entries: readonly RollbackDialogEntry[]): boolean {
  return entries.some((entry) => entry.added === true);
}

function groupLabel(t: Translate, group: RollbackDialogGroup): string {
  if (group === 'staged') return t('editor.rollbackDialogStaged');
  if (group === 'unversioned') return t('editor.rollbackDialogUnversioned');
  if (group === 'all') return t('editor.rollbackDialogAll');
  return t('editor.rollbackDialogUnstaged');
}

/**
 * Show IDEA's Rollback Changes dialog.
 *
 * The dialog lists every target, keeps Cancel as the safe initial focus, and
 * returns Show Diff as a separate result so the caller can close the modal and
 * open the normal diff surface, matching IDEA's behavior.
 */
export function confirmRollback(
  t: Translate,
  entries: RollbackDialogEntry[],
  message: string,
  initial: RollbackDialogInitial = {},
): Promise<RollbackDialogResult> {
  if (typeof document === 'undefined' || document.body === null || entries.length === 0) {
    return Promise.resolve({ action: 'cancel' });
  }
  return new Promise<RollbackDialogResult>((resolve) => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const backdrop = document.createElement('div');
    backdrop.dataset.dshRollbackConfirm = '';
    Object.assign(backdrop.style, styles.paletteBackdrop);
    backdrop.style.alignItems = 'center';
    backdrop.style.paddingTop = '0';

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    const titleId = 'dsh-rollback-confirm-title';
    const messageId = 'dsh-rollback-confirm-message';
    dialog.setAttribute('aria-labelledby', titleId);
    dialog.setAttribute('aria-describedby', messageId);
    Object.assign(dialog.style, styles.namePrompt);
    dialog.style.width = 'min(560px, calc(100vw - 32px))';
    dialog.style.maxHeight = 'min(72vh, 640px)';
    dialog.style.overflow = 'hidden';

    const title = document.createElement('div');
    title.id = titleId;
    title.textContent = t('editor.rollbackDialogTitle');
    Object.assign(title.style, styles.namePromptTitle);
    title.style.flex = 'none';

    const messageNode = document.createElement('div');
    messageNode.id = messageId;
    messageNode.textContent = message;
    Object.assign(messageNode.style, styles.searchEverywhereMessage);
    messageNode.style.flex = 'none';
    messageNode.style.textAlign = 'left';
    messageNode.style.whiteSpace = 'pre-wrap';
    messageNode.style.overflowWrap = 'anywhere';

    const toolbar = document.createElement('div');
    toolbar.style.display = 'flex';
    toolbar.style.alignItems = 'center';
    toolbar.style.gap = '6px';
    toolbar.style.flex = 'none';
    const filesLabel = document.createElement('span');
    filesLabel.textContent = t('editor.rollbackDialogFiles');
    filesLabel.style.color = 'var(--dsw-alias-label-tertiary)';
    filesLabel.style.fontSize = '10px';
    filesLabel.style.flex = '1 1 auto';
    const selectAllLabel = document.createElement('label');
    selectAllLabel.style.display = 'inline-flex';
    selectAllLabel.style.alignItems = 'center';
    selectAllLabel.style.gap = '4px';
    selectAllLabel.style.color = 'var(--dsw-alias-label-secondary)';
    selectAllLabel.style.fontSize = '10px';
    const selectAllCheckbox = document.createElement('input');
    selectAllCheckbox.type = 'checkbox';
    selectAllCheckbox.dataset.dshRollbackConfirmSelectAll = '';
    selectAllCheckbox.setAttribute('aria-label', t('editor.rollbackDialogSelectAll'));
    selectAllCheckbox.checked = true;
    selectAllLabel.append(selectAllCheckbox, document.createTextNode(t('editor.rollbackDialogSelectAll')));
    const showDiffButton = document.createElement('button');
    showDiffButton.type = 'button';
    showDiffButton.dataset.dshRollbackConfirmShowDiff = '';
    showDiffButton.textContent = t('editor.rollbackDialogShowDiff');
    Object.assign(showDiffButton.style, styles.commitSecondary);
    showDiffButton.style.flex = '0 0 auto';
    showDiffButton.style.minWidth = '84px';
    toolbar.append(filesLabel, selectAllLabel, showDiffButton);

    const list = document.createElement('div');
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', t('editor.rollbackDialogFiles'));
    Object.assign(list.style, styles.paletteList);
    list.style.border = '0.5px solid var(--dsw-alias-border-l3)';
    list.style.borderRadius = '4px';
    list.style.background = 'var(--dsw-alias-bg-base)';
    list.style.flex = '1 1 auto';
    list.style.minHeight = '120px';
    list.style.maxHeight = '320px';

    let selectedIndex = rollbackDialogInitialIndex(entries, initial.selectedKey);
    let selectionAnchorKey = rollbackDialogEntryKey(entries[selectedIndex]);
    let selectedRowKeys = new Set([selectionAnchorKey]);
    const selectedKeys = new Set(
      initial.selectedKeys === undefined
        ? entries.map(rollbackDialogEntryKey)
        : entries
            .filter((entry) => initial.selectedKeys?.has(rollbackDialogEntryKey(entry)) === true)
            .map(rollbackDialogEntryKey),
    );
    const rows: HTMLDivElement[] = [];
    const rowCheckboxes = new Map<string, HTMLInputElement>();
    const rowByKey = new Map<string, HTMLDivElement>();
    let syncSelectionControls = (): void => {};
    const selectRow = (index: number, focus: boolean, modifiers: { meta?: boolean; shift?: boolean } = {}): void => {
      selectedIndex = Math.max(0, Math.min(entries.length - 1, index));
      const order = entries.map(rollbackDialogEntryKey);
      const targetKey = order[selectedIndex];
      const result = commitSelectionAfterClick(order, [...selectedRowKeys], targetKey, modifiers, selectionAnchorKey);
      selectedRowKeys = new Set(result.selected);
      selectionAnchorKey = result.anchor;
      rows.forEach((row, rowIndex) => {
        const selected = selectedRowKeys.has(order[rowIndex]);
        row.tabIndex = rowIndex === selectedIndex ? 0 : -1;
        Object.assign(row.style, selected ? styles.paletteRowActive : styles.paletteRow);
        row.style.width = '100%';
        row.style.border = 'none';
        row.style.textAlign = 'left';
        row.style.font = 'inherit';
      });
      if (focus) rows[selectedIndex]?.focus();
    };

    for (const [index, entry] of entries.entries()) {
      const entryKey = rollbackDialogEntryKey(entry);
      const row = document.createElement('div');
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', selectedKeys.has(entryKey) ? 'true' : 'false');
      row.dataset.dshRollbackConfirmRow = '';
      row.dataset.dshRollbackPath = entry.path;
      row.dataset.dshRollbackGroup = entry.group;
      row.dataset.dshRollbackKey = entryKey;
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.tabIndex = -1;
      checkbox.checked = selectedKeys.has(entryKey);
      checkbox.dataset.dshRollbackConfirmInclude = '';
      checkbox.setAttribute('aria-label', t('editor.rollbackDialogInclude', { path: entry.path }));
      checkbox.addEventListener('click', (event) => {
        event.stopPropagation();
        selectRow(index, false);
      });
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selectedKeys.add(entryKey);
        else selectedKeys.delete(entryKey);
        row.setAttribute('aria-selected', checkbox.checked ? 'true' : 'false');
        syncSelectionControls();
      });
      rowCheckboxes.set(entryKey, checkbox);
      rowByKey.set(entryKey, row);
      const group = document.createElement('span');
      group.textContent = groupLabel(t, entry.group);
      group.style.flex = '0 0 82px';
      group.style.color = 'var(--dsw-alias-label-tertiary)';
      group.style.fontSize = '10px';
      const path = document.createElement('span');
      path.textContent = entry.path;
      path.style.minWidth = '0';
      path.style.overflow = 'hidden';
      path.style.textOverflow = 'ellipsis';
      path.style.whiteSpace = 'nowrap';
      path.style.fontFamily = 'var(--dsh-editor-font-code, monospace)';
      row.append(checkbox, group, path);
      row.addEventListener('click', (event) =>
        selectRow(index, false, {
          meta: event.metaKey === true || event.ctrlKey === true,
          shift: event.shiftKey === true,
        }),
      );
      row.addEventListener('keydown', (event) => {
        if (event.key === ' ' || event.key === 'Spacebar') {
          event.preventDefault();
          event.stopPropagation();
          const keys =
            selectedRowKeys.size > 0 ? selectedRowKeys : new Set([rollbackDialogEntryKey(entries[selectedIndex])]);
          const next = rollbackDialogToggleInclusion(selectedKeys, keys);
          selectedKeys.clear();
          for (const key of next) selectedKeys.add(key);
          for (const [key, rowCheckbox] of rowCheckboxes) {
            rowCheckbox.checked = selectedKeys.has(key);
            rowByKey.get(key)?.setAttribute('aria-selected', rowCheckbox.checked ? 'true' : 'false');
          }
          syncSelectionControls();
          return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          event.stopPropagation();
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? entries.length - 1
                : selectedIndex + (event.key === 'ArrowDown' ? 1 : -1);
          selectRow(next, true, { shift: event.shiftKey === true });
        }
      });
      rows.push(row);
      list.append(row);
    }
    selectAllCheckbox.addEventListener('change', () => {
      if (selectAllCheckbox.checked) {
        for (const entry of entries) selectedKeys.add(rollbackDialogEntryKey(entry));
      } else {
        selectedKeys.clear();
      }
      for (const [key, checkbox] of rowCheckboxes) {
        checkbox.checked = selectAllCheckbox.checked;
        rowByKey.get(key)?.setAttribute('aria-selected', selectAllCheckbox.checked ? 'true' : 'false');
      }
      syncSelectionControls();
    });
    selectRow(selectedIndex, false);

    const buttons = document.createElement('div');
    Object.assign(buttons.style, styles.namePromptButtons);
    buttons.style.flex = 'none';
    const deleteAddedLabel = document.createElement('label');
    deleteAddedLabel.style.display = 'inline-flex';
    deleteAddedLabel.style.alignItems = 'center';
    deleteAddedLabel.style.gap = '4px';
    deleteAddedLabel.style.color = 'var(--dsw-alias-label-secondary)';
    deleteAddedLabel.style.fontSize = '10px';
    deleteAddedLabel.style.flex = 'none';
    const deleteAddedCheckbox = document.createElement('input');
    deleteAddedCheckbox.type = 'checkbox';
    deleteAddedCheckbox.dataset.dshRollbackConfirmDeleteAdded = '';
    deleteAddedCheckbox.setAttribute('aria-label', t('editor.rollbackDialogDeleteAdded'));
    deleteAddedCheckbox.disabled = !rollbackDialogCanDeleteAdded(entries);
    deleteAddedCheckbox.checked = initial.deleteAdded === true && !deleteAddedCheckbox.disabled;
    deleteAddedLabel.append(deleteAddedCheckbox, document.createTextNode(t('editor.rollbackDialogDeleteAdded')));
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.dataset.dshRollbackConfirmCancel = '';
    cancelButton.textContent = t('editor.rollbackDialogCancel');
    Object.assign(cancelButton.style, styles.commitSecondary);
    cancelButton.style.minWidth = '84px';
    const rollbackButton = document.createElement('button');
    rollbackButton.type = 'button';
    rollbackButton.dataset.dshRollbackConfirmAccept = '';
    rollbackButton.textContent = t('editor.rollbackDialogRollback');
    Object.assign(rollbackButton.style, styles.commitPrimary);
    rollbackButton.style.minWidth = '84px';
    buttons.append(cancelButton, rollbackButton);
    syncSelectionControls = (): void => {
      const allSelected = selectedKeys.size === entries.length;
      const selectedEntries = entries.filter((entry) => selectedKeys.has(rollbackDialogEntryKey(entry)));
      deleteAddedCheckbox.disabled = !rollbackDialogCanDeleteAdded(selectedEntries);
      if (deleteAddedCheckbox.disabled) deleteAddedCheckbox.checked = false;
      selectAllCheckbox.checked = allSelected;
      selectAllCheckbox.indeterminate = selectedKeys.size > 0 && !allSelected;
      rollbackButton.disabled = selectedKeys.size === 0;
      rollbackButton.title = selectedKeys.size === 0 ? t('editor.rollbackDialogNoSelection') : '';
    };
    syncSelectionControls();

    dialog.append(title, messageNode, toolbar, list, deleteAddedLabel, buttons);
    backdrop.append(dialog);

    let settled = false;
    const finish = (result: RollbackDialogResult): void => {
      if (settled) return;
      settled = true;
      backdrop.removeEventListener('keydown', onKeyDown, true);
      backdrop.remove();
      if (result.action !== 'showDiff' && previousFocus !== null && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
      resolve(result);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (rollbackDialogRowOwnsKey(event.key, event.target instanceof Element ? event.target : null)) return;
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        finish({ action: 'cancel' });
        return;
      }
      if (event.key === 'Enter' && event.target === cancelButton) {
        event.preventDefault();
        finish({ action: 'cancel' });
        return;
      }
      if (event.key === 'Enter' && event.target === rollbackButton) {
        event.preventDefault();
        finish({
          action: 'rollback',
          entries: entries.filter((entry) => selectedKeys.has(rollbackDialogEntryKey(entry))),
          deleteAdded: deleteAddedCheckbox.checked && !deleteAddedCheckbox.disabled,
        });
        return;
      }
      if (event.key === 'Enter' && event.target === showDiffButton) {
        event.preventDefault();
        finish({
          action: 'showDiff',
          entry: entries[selectedIndex],
          entries,
          selectedEntries: entries.filter((entry) => selectedKeys.has(rollbackDialogEntryKey(entry))),
          deleteAdded: deleteAddedCheckbox.checked && !deleteAddedCheckbox.disabled,
          scrollTop: list.scrollTop,
        });
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = dialogFocusableElements(dialog);
      const currentIndex = focusables.indexOf(document.activeElement as HTMLElement);
      if (currentIndex < 0) return;
      event.preventDefault();
      const direction = event.shiftKey === true ? -1 : 1;
      focusables[(currentIndex + direction + focusables.length) % focusables.length]?.focus();
    };
    backdrop.addEventListener('keydown', onKeyDown, true);
    backdrop.addEventListener('mousedown', (event) => {
      if (event.target === backdrop) finish({ action: 'cancel' });
    });
    cancelButton.addEventListener('click', () => finish({ action: 'cancel' }));
    rollbackButton.addEventListener('click', () =>
      finish({
        action: 'rollback',
        entries: entries.filter((entry) => selectedKeys.has(rollbackDialogEntryKey(entry))),
        deleteAdded: deleteAddedCheckbox.checked && !deleteAddedCheckbox.disabled,
      }),
    );
    showDiffButton.addEventListener('click', () =>
      finish({
        action: 'showDiff',
        entry: entries[selectedIndex],
        entries,
        selectedEntries: entries.filter((entry) => selectedKeys.has(rollbackDialogEntryKey(entry))),
        deleteAdded: deleteAddedCheckbox.checked && !deleteAddedCheckbox.disabled,
        scrollTop: list.scrollTop,
      }),
    );
    document.body.append(backdrop);
    list.scrollTop = Math.max(0, Number(initial.scrollTop) || 0);
    window.setTimeout(() => {
      const target = rollbackDialogInitialFocusTarget(initial) === 'row' ? rows[selectedIndex] : cancelButton;
      target?.focus();
    }, 0);
  });
}
