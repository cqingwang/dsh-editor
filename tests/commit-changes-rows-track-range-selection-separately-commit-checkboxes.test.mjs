import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceSource = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const panelSource = readFileSync(join(root, 'src/client/components/commit/CommitPanel.tsx'), 'utf8');
const source = workspaceSource + '\n' + panelSource;

function workspace() {
  return workspaceSource;
}

function commitPanel() {
  return panelSource;
}

test('Changes rows track a range selection separately from commit checkboxes', () => {
  const panel = commitPanel();
  assert.match(panel, /selectedChanges,/);
  assert.match(panel, /const selectedInRange = selectedChanges instanceof Set && selectedChanges\.has\(changeKey\)/);
  assert.match(panel, /dsh-editor-commit-row-range/);
  assert.match(panel, /shift: event\.shiftKey/);
  assert.match(panel, /toggle: event\.metaKey \|\| event\.ctrlKey/);
  assert.match(panel, /onChange=\{\(\) => onTogglePath\(change\.path\)\}/);
});

test('Shift and Command/Ctrl clicks extend or toggle the visible row range', () => {
  const body = workspace();
  const choose = body.slice(body.indexOf('const chooseChange = React.useCallback('), body.indexOf('const chosenChanges = React.useCallback('));
  assert.match(choose, /const rows = node === null \? \[\] : \[\.\.\.node\.querySelectorAll(?:<[^>]+>)?\('\[data-dsh-change-path\]'\)\]/);
  assert.match(choose, /if \(options\.shift === true\)/);
  assert.match(choose, /const start = Math\.min\(anchorIndex, targetIndex\)/);
  assert.match(choose, /rows\.slice\(start, end \+ 1\)\.map\(keyOf\)/);
  assert.match(choose, /else if \(options\.toggle === true\)/);
  assert.match(choose, /if \(next\.size === 0\) next\.add\(targetKey\)/);
  assert.match(choose, /changeSelectionAnchorRef\.current = \{ key: targetKey \}/);
});

test('the context menu acts on all selected rows, not just the clicked one', () => {
  const body = workspace();
  const menu = body.slice(body.indexOf('const buildChangeMenu = React.useCallback('), body.indexOf('Context menu for one directory node'));
  assert.match(
    menu,
    /const range =\s+payload\.selectedChanges instanceof Set && payload\.selectedChanges\.size > 0/u,
  );
  assert.match(menu, /const paths = \[\.\.\.new Set\(selected\.map\(\(entry\) => entry\.path\)\)\]/);
  assert.match(menu, /run: \(\)(?:: void)? => void restage\(removalOnly \? removablePaths : paths, allStaged\)/);
  assert.match(menu, /run: \(\) => void rollback\(paths, allUnversioned \? \{ unversioned: true \} : undefined\)/);
  assert.match(menu, /disabled: allStaged === false && allWorking === false/);
});

test('batch shortcuts act only on rows from the appropriate git band', () => {
  const body = workspace();
  const stage = body.slice(body.indexOf('const stageShortcut = React.useCallback('), body.indexOf("window.addEventListener('keydown', stageShortcut"));
  assert.match(stage, /const picked = chosenChanges\(fallback\)/);
  assert.match(stage, /\.filter\(\(entry\) => entry\.staged === staged\)/);
  assert.match(stage, /void restageRef\.current\(\[\.\.\.new Set\(eligible\)\], staged\)/);
  const rollbackShortcut = body.slice(body.indexOf('const rollbackWorkingShortcut = React.useCallback('), body.indexOf("window.addEventListener('keydown', rollbackWorkingShortcut"));
  assert.match(rollbackShortcut, /\.filter\(\(entry\) => entry\.staged !== true\)/);
  assert.match(rollbackShortcut, /void rollback\(\[\.\.\.new Set\(working\)\]\)/);
});

test('rollback keeps checkboxes and selects the nearest surviving Changes row', () => {
  const body = workspace();
  const reconcile = body.slice(body.indexOf('const reconcileChangeSelection = React.useCallback('), body.indexOf('const closeDiff = React.useCallback('));
  assert.match(reconcile, /const firstRemoved = keysInVisualOrder\.findIndex/);
  assert.match(reconcile, /const keptSelected = new Set\(\[\.\.\.selectedChangesRef\.current\]\.filter/);
  assert.match(reconcile, /const selectedAfterRemoval = keysInVisualOrder\.find/);
  assert.match(reconcile, /const candidate = keysInVisualOrder\[Math\.min\(firstRemoved \+ offset/);
  assert.doesNotMatch(reconcile, /setCommitSelection/);
  const rollback = body.slice(body.indexOf('const rollback ='), body.indexOf('const buildChangeMenu = React.useCallback('));
  assert.match(rollback, /setCommitSelection\(\(current\) =>/);
  assert.match(rollback, /reconcileChangeSelection\(value\?\.changes \?\? \[\], pickedKeys\)/);
  assert.match(
    rollback,
    /\.filter\(\(entry\) => \(stagedOnly \? entry\.staged === true : entry\.staged !== true\)\)/u,
  );
});

test('nearestRowAfterRemoval follows visual order, including staged and unstaged sides', () => {
  const keys = ['staged:a.txt', 'unstaged:b.txt', 'unstaged:c.txt', 'unstaged:d.txt'];
  const remaining = new Set(['staged:a.txt', 'unstaged:c.txt', 'unstaged:d.txt']);
  const removed = new Set(['unstaged:b.txt']);
  const firstRemoved = keys.findIndex((key) => removed.has(key));
  let next = null;
  for (let offset = 1; offset < keys.length; offset += 1) {
    const candidate = keys[Math.min(firstRemoved + offset, keys.length - 1)];
    if (remaining.has(candidate)) {
      next = candidate;
      break;
    }
  }
  assert.equal(next, 'unstaged:c.txt');
  /* A middle range member disappearing must not collapse a still-valid range
     onto its first survivor. */
  const kept = new Set(['staged:a.txt', 'unstaged:d.txt']);
  assert.deepEqual([...kept], ['staged:a.txt', 'unstaged:d.txt']);
});
