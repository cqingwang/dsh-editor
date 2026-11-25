import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const dialogSource = read('src/client/components/commit/rollback-confirmation.ts');
const workspaceSource = read('src/client/editor-workspace.tsx');
const localeSource = read('src/client/locales.ts');
const diffSource = read('src/client/diff.ts');

test('rollback targets keep IDEA staged, working-tree and unversioned bands', () => {
  const classify = loadTypeScriptFunction(dialogSource, 'rollbackDialogGroupForChange');
  assert.equal(classify('M', true, false), 'staged');
  assert.equal(classify('M', false, false), 'unstaged');
  assert.equal(classify('??', false, false), 'unversioned');
  assert.equal(classify('M', false, true), 'unversioned');
  assert.equal(classify(' M', false, false, true), 'unstaged');
  assert.equal(classify('M ', false, false, true), 'staged');
  assert.equal(classify('??', false, false, true), 'unversioned');
  assert.equal(classify('MM', false, false, true), 'all');
});

test('rollback selection keys preserve staged and working-tree identities', () => {
  const keys = loadTypeScriptFunction(dialogSource, 'rollbackSelectionKeys');
  assert.deepEqual(
    [
      ...keys([
        { path: 'src/app.ts', group: 'staged' },
        { path: 'src/util.ts', group: 'unstaged' },
        { path: 'src/new.ts', group: 'unversioned' },
      ]),
    ],
    ['staged:src/app.ts', 'unstaged:src/util.ts', 'unstaged:src/new.ts'],
  );
  assert.deepEqual([...keys([{ path: 'src/app.ts', group: 'all' }])], ['staged:src/app.ts', 'unstaged:src/app.ts']);
});

test('rollback dialog identities keep the same path distinct across bands', () => {
  const key = loadTypeScriptFunction(dialogSource, 'rollbackDialogEntryKey');
  assert.equal(key({ path: 'src/app.ts', group: 'staged' }), 'staged:src/app.ts');
  assert.equal(key({ path: 'src/app.ts', group: 'unstaged' }), 'unstaged:src/app.ts');
  assert.equal(key({ path: 'src/new.ts', group: 'unversioned' }), 'unversioned:src/new.ts');
});

test('rollback confirmation copy follows the discarded band', () => {
  const confirmKey = loadTypeScriptFunction(dialogSource, 'rollbackConfirmKey');
  assert.equal(confirmKey(true, false, false), 'editor.rollbackAllConfirm');
  assert.equal(confirmKey(false, true, false), 'editor.rollbackStagedConfirm');
  assert.equal(confirmKey(false, false, true), 'editor.rollbackUnversionedConfirm');
  assert.equal(confirmKey(false, false, false), 'editor.rollbackConfirm');
});

test('rollback confirmation copy follows the actual dialog rows', () => {
  const confirmKey = loadTypeScriptFunction(dialogSource, 'rollbackDialogConfirmKey');
  assert.equal(confirmKey([{ path: 'src/util.ts', group: 'unstaged' }], true, false, false), 'editor.rollbackConfirm');
  assert.equal(confirmKey([{ path: 'src/util.ts', group: 'staged' }], true, false, false), 'editor.rollbackConfirm');
  assert.equal(confirmKey([{ path: 'src/util.ts', group: 'all' }], true, false, false), 'editor.rollbackAllConfirm');
  assert.equal(
    confirmKey([{ path: 'src/new.ts', group: 'unversioned' }], true, false, false),
    'editor.rollbackUnversionedConfirm',
  );
});

test('added-file deletion is offered only when an added row exists', () => {
  const canDelete = loadTypeScriptFunction(dialogSource, 'rollbackDialogCanDeleteAdded');
  assert.equal(canDelete([{ path: 'src/app.ts', group: 'all', added: false }]), false);
  assert.equal(canDelete([{ path: 'src/new.ts', group: 'all', added: true }]), true);
});

test('added-file deletion follows the selected rows, not just the dialog contents', () => {
  assert.match(
    dialogSource,
    /const selectedEntries = entries\.filter\(\(entry\) => selectedKeys\.has\(rollbackDialogEntryKey\(entry\)\)\);/u,
  );
  assert.match(dialogSource, /deleteAddedCheckbox\.disabled = !rollbackDialogCanDeleteAdded\(selectedEntries\);/u);
  assert.match(dialogSource, /if \(deleteAddedCheckbox\.disabled\) deleteAddedCheckbox\.checked = false;/u);
});

test('Rollback Changes is an alertdialog with file list, Show Diff and safe initial focus', () => {
  assert.match(dialogSource, /export function confirmRollback\(/u);
  assert.match(dialogSource, /dialog\.setAttribute\('role', 'alertdialog'\)/u);
  assert.match(dialogSource, /dialog\.setAttribute\('aria-modal', 'true'\)/u);
  assert.match(dialogSource, /backdrop\.dataset\.dshRollbackConfirm = ''/u);
  assert.match(dialogSource, /showDiffButton\.dataset\.dshRollbackConfirmShowDiff = ''/u);
  assert.match(dialogSource, /selectAllCheckbox\.dataset\.dshRollbackConfirmSelectAll = ''/u);
  assert.match(dialogSource, /checkbox\.dataset\.dshRollbackConfirmInclude = ''/u);
  assert.match(dialogSource, /cancelButton\.dataset\.dshRollbackConfirmCancel = ''/u);
  assert.match(dialogSource, /rollbackButton\.dataset\.dshRollbackConfirmAccept = ''/u);
  assert.match(dialogSource, /deleteAddedCheckbox\.dataset\.dshRollbackConfirmDeleteAdded = ''/u);
  assert.match(dialogSource, /list\.setAttribute\('role', 'listbox'\)/u);
  assert.match(dialogSource, /dialogFocusableElements\(dialog\)/u);
  assert.match(
    dialogSource,
    /rollbackDialogInitialFocusTarget\(initial\) === 'row' \? rows\[selectedIndex\] : cancelButton/u,
  );
  assert.match(dialogSource, /action: 'showDiff'/u);
  assert.match(
    dialogSource,
    /selectedEntries: entries\.filter\(\(entry\) => selectedKeys\.has\(rollbackDialogEntryKey\(entry\)\)\)/u,
  );
  assert.match(dialogSource, /deleteAdded: deleteAddedCheckbox\.checked && !deleteAddedCheckbox\.disabled/u);
  assert.match(dialogSource, /finish\(\{ action: 'cancel' \}\)/u);
  assert.match(
    dialogSource,
    /entries: entries\.filter\(\(entry\) => selectedKeys\.has\(rollbackDialogEntryKey\(entry\)\)\)/u,
  );
  assert.match(dialogSource, /rollbackButton\.disabled = selectedKeys\.size === 0/u);
});

test('Rollback dialog rows toggle inclusion with Space and keep one tab stop', () => {
  assert.match(dialogSource, /event\.key === ' ' \|\| event\.key === 'Spacebar'/u);
  assert.match(
    dialogSource,
    /rollbackDialogRowOwnsKey\(event\.key, event\.target instanceof Element \? event\.target : null\)\) return;/u,
  );
  assert.match(dialogSource, /checkbox\.tabIndex = -1/u);
  assert.match(dialogSource, /rollbackDialogToggleInclusion\(selectedKeys, keys\)/u);
  assert.match(dialogSource, /row\.tabIndex = rowIndex === selectedIndex \? 0 : -1/u);
  assert.match(
    dialogSource,
    /checkbox\.addEventListener\('click', \(event\) => \{\s+event\.stopPropagation\(\);\s+selectRow\(index, false\);\s+\}\);/u,
  );
  assert.match(dialogSource, /meta: event\.metaKey === true \|\| event\.ctrlKey === true/u);
  assert.match(dialogSource, /shift: event\.shiftKey === true/u);
});

test('Rollback dialog row navigation keys reach the row handler', () => {
  const ownsKey = loadTypeScriptFunction(dialogSource, 'rollbackDialogRowOwnsKey');
  const rowTarget = {
    closest(selector) {
      return selector === '[data-dsh-rollback-confirm-row]' ? {} : null;
    },
  };
  const outsideTarget = {
    closest() {
      return null;
    },
  };
  for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', ' ', 'Spacebar']) {
    assert.equal(ownsKey(key, rowTarget), true, `${key} belongs to the row`);
  }
  assert.equal(ownsKey('Escape', rowTarget), false);
  assert.equal(ownsKey('Tab', rowTarget), false);
  assert.equal(ownsKey('ArrowDown', outsideTarget), false);
  assert.match(
    dialogSource,
    /if \(rollbackDialogRowOwnsKey\(event\.key, event\.target instanceof Element \? event\.target : null\)\) return;/u,
  );
});

test('Rollback dialog resumes focus on the row shown in the diff', () => {
  const focusTarget = loadTypeScriptFunction(dialogSource, 'rollbackDialogInitialFocusTarget');
  assert.equal(focusTarget({}), 'cancel');
  assert.equal(focusTarget({ selectedKey: 'unstaged:src/util.ts' }), 'row');
  assert.match(
    dialogSource,
    /rollbackDialogInitialFocusTarget\(initial\) === 'row' \? rows\[selectedIndex\] : cancelButton/u,
  );
});

test('Rollback dialog batch inclusion checks all or clears all selected rows', () => {
  const toggle = loadTypeScriptFunction(dialogSource, 'rollbackDialogToggleInclusion');
  assert.deepEqual([...toggle(new Set(['a']), ['a', 'b'])], ['a', 'b']);
  assert.deepEqual([...toggle(new Set(['a', 'b']), ['a', 'b'])], []);
  assert.deepEqual([...toggle(new Set(['a', 'b']), ['b'])], ['a']);
});

test('Rollback dialog aria-selected follows inclusion instead of keyboard focus', () => {
  assert.match(
    dialogSource,
    /row\.setAttribute\('aria-selected', selectedKeys\.has\(entryKey\) \? 'true' : 'false'\);/u,
  );
  assert.match(dialogSource, /row\.setAttribute\('aria-selected', checkbox\.checked \? 'true' : 'false'\);/u);
  assert.match(
    dialogSource,
    /rowByKey\.get\(key\)\?\.setAttribute\('aria-selected', selectAllCheckbox\.checked \? 'true' : 'false'\);/u,
  );
  const selectRow = dialogSource.slice(
    dialogSource.indexOf('const selectRow ='),
    dialogSource.indexOf('for (const [index, entry] of entries.entries())'),
  );
  assert.doesNotMatch(selectRow, /aria-selected/u);
});

test('Rollback dialog initial inclusion drives row checkboxes and aria-selected', () => {
  assert.match(dialogSource, /checkbox\.checked = selectedKeys\.has\(entryKey\);/u);
  assert.match(dialogSource, /initial\.selectedKeys === undefined/u);
});

test('Commit rollback uses the shared dialog and opens the selected diff', () => {
  const start = workspaceSource.indexOf('const rollback = React.useCallback(');
  const end = workspaceSource.indexOf('/* IDEA\'s "Add to .gitignore"', start);
  assert.ok(start >= 0 && end > start);
  const block = workspaceSource.slice(start, end);
  assert.match(block, /confirmRollback\(t, entries, t\(confirmKey, \{ count: paths\.length \}\), initial\)/u);
  assert.match(block, /decision\.action === 'showDiff'/u);
  assert.match(block, /const selectedPaths = decision\.entries\.map\(\(entry\) => entry\.path\)/u);
  assert.match(block, /const deleteAdded = decision\.deleteAdded === true;/u);
  assert.match(block, /paths: selectedPaths/u);
  assert.match(
    block,
    /\.\.\.\(all \? \{ all: true, \.\.\.\(deleteAdded \? \{ deleteAdded: true \} : \{\}\) \} : \{\}\)/u,
  );
  assert.match(block, /rollbackDiffTarget\(decision\.entry, decision\.entries\)/u);
  assert.doesNotMatch(block, /window\.confirm/u);
});

test('rollback Show Diff keeps file navigation inside the dialog scope', () => {
  const sequence = loadTypeScriptFunction(diffSource, 'diffNavigationSequence');
  const navigationEntries = loadTypeScriptFunction(dialogSource, 'rollbackNavigationEntries');
  const fallback = [
    { path: 'src/a.ts', staged: false },
    { path: 'src/b.ts', staged: false },
  ];
  assert.deepEqual(
    sequence(
      [
        { path: 'src/a.ts', staged: false },
        { path: 'src/b.ts', staged: true },
      ],
      fallback,
    ),
    [
      { path: 'src/a.ts', staged: false },
      { path: 'src/b.ts', staged: true },
    ],
  );
  assert.equal(sequence([], fallback), fallback);
  assert.equal(sequence([{ path: '' }], fallback), fallback);
  assert.deepEqual(
    navigationEntries([
      { path: 'src/a.ts', group: 'staged' },
      { path: 'src/b.ts', group: 'unstaged' },
      { path: 'src/c.ts', group: 'unversioned' },
    ]),
    [
      { path: 'src/a.ts', staged: true },
      { path: 'src/b.ts', staged: false },
      { path: 'src/c.ts', staged: false },
    ],
  );
});

test('Rollback dialog copy exists in both dictionaries', () => {
  for (const key of [
    'rollbackDialogTitle',
    'rollbackDialogFiles',
    'rollbackDialogSelectAll',
    'rollbackDialogInclude',
    'rollbackDialogNoSelection',
    'rollbackDialogShowDiff',
    'rollbackDialogRollback',
    'rollbackDialogCancel',
    'rollbackDialogStaged',
    'rollbackDialogUnstaged',
    'rollbackDialogUnversioned',
    'rollbackDialogAll',
    'rollbackDialogDeleteAdded',
    'rollbackSelectedCount',
    'rollbackAllConfirm',
  ]) {
    const matches = [...localeSource.matchAll(new RegExp(`${key}:`, 'g'))];
    assert.equal(matches.length, 2, `${key} must exist once in zh and once in en`);
  }
});
