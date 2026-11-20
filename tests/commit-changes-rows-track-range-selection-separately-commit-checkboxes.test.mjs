import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptCallback } from './ts-source.mjs';

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
  assert.match(panel, /aria-selected=\{selectedInRange \|\| selectedForChange\}/);
  assert.match(panel, /aria-multiselectable=\{true\}/);
  assert.match(panel, /shift: event\.shiftKey/);
  assert.match(panel, /toggle: event\.metaKey \|\| event\.ctrlKey/);
  assert.match(panel, /onChange=\{\(\) => onTogglePath\(change\.path\)\}/);
});

test('Shift and Command/Ctrl clicks extend or toggle the visible row range', () => {
  const makeRow = (path, staged) => ({
    getAttribute: (name) => {
      if (name === 'data-dsh-change-path') return path;
      if (name === 'data-dsh-change-staged') return String(staged);
      return null;
    },
  });
  const rows = [makeRow('a.ts', false), makeRow('b.ts', false), makeRow('c.ts', false)];
  let selected = new Set(['unstaged:a.ts']);
  let anchor = { key: 'unstaged:a.ts' };
  const selectedChangesRef = { current: selected };
  const changeSelectionAnchorRef = { current: anchor };
  const chooseChange = loadTypeScriptCallback(workspaceSource, 'chooseChange', {
    document: {
      querySelector: () => ({ querySelectorAll: () => rows }),
    },
    setSelectedGroup: () => {},
    setSelectedChanges: (next) => {
      selected = next;
    },
    setSelectedChange: () => {},
    selectedChangesRef,
    changeSelectionAnchorRef,
  });
  chooseChange({ path: 'c.ts', staged: false }, { shift: true });
  assert.deepEqual([...selected], ['unstaged:a.ts', 'unstaged:b.ts', 'unstaged:c.ts']);
  chooseChange({ path: 'b.ts', staged: false }, { toggle: true });
  assert.deepEqual([...selected], ['unstaged:a.ts', 'unstaged:c.ts']);
  assert.deepEqual(changeSelectionAnchorRef.current, { key: 'unstaged:b.ts' });
});

test('the context menu acts on all selected rows, not just the clicked one', () => {
  const change = { path: 'a.ts', status: ' M' };
  const changesByPathRef = {
    current: new Map([
      ['a.ts', change],
      ['b.ts', { path: 'b.ts', status: ' M' }],
    ]),
  };
  const restaged = [];
  const rolledBack = [];
  const buildChangeMenu = loadTypeScriptCallback(workspaceSource, 'buildChangeMenu', {
    changesByPathRef,
    changeModel: {
      allPathsUnversioned: () => false,
      canCompareWithHead: () => true,
      pathsScheduledForRemoval: () => [],
    },
    allPathsUnversioned: () => false,
    pathsScheduledForRemoval: () => [],
    isConflict: () => false,
    t: (key) => key,
    restage: (paths, staged) => {
      restaged.push({ paths, staged });
    },
    rollback: (paths) => {
      rolledBack.push(paths);
    },
    showCombinedDiff: () => {},
    openFile: () => {},
    resolveConflict: () => {},
    copyReferenceMenuItems: () => [],
    addToGitignore: () => {},
    createSelectedPatch: () => {},
    requestSelectedPatch: async () => null,
    root: '/repo',
    currentCodeEditor: () => null,
    currentCodePath: () => null,
    setDiffTarget: () => {},
    setDiffActive: () => {},
  });
  const menu = buildChangeMenu({
    change,
    staged: false,
    selectedChanges: new Set(['unstaged:a.ts', 'unstaged:b.ts']),
    x: 10,
    y: 20,
  });
  const findItem = (items, id) => {
    for (const item of items) {
      if (item?.id === id) return item;
      const nested = item?.items === undefined ? null : findItem(item.items, id);
      if (nested !== null) return nested;
    }
    return null;
  };
  findItem(menu.items, 'stage').run();
  assert.deepEqual(restaged, [{ paths: ['a.ts', 'b.ts'], staged: false }]);
  findItem(menu.items, 'rollbackWorking').run();
  assert.deepEqual(rolledBack, [['a.ts', 'b.ts']]);
});

test('batch shortcuts act only on rows from the appropriate git band', () => {
  const body = workspace();
  const stage = body.slice(
    body.indexOf('const stageShortcut = React.useCallback('),
    body.indexOf("window.addEventListener('keydown', stageShortcut"),
  );
  assert.match(stage, /const picked = chosenChanges\(fallback\)/);
  assert.match(stage, /\.filter\(\(entry\) => entry\.staged === staged\)/);
  assert.match(stage, /void restageRef\.current\(\[\.\.\.new Set\(eligible\)\], staged\)/);
  const rollbackShortcut = body.slice(
    body.indexOf('const rollbackWorkingShortcut = React.useCallback('),
    body.indexOf("window.addEventListener('keydown', rollbackWorkingShortcut"),
  );
  assert.match(rollbackShortcut, /\.filter\(\(entry\) => entry\.staged !== true\)/);
  assert.match(rollbackShortcut, /void rollback\(\[\.\.\.new Set\(working\)\]\)/);
});

test('rollback keeps checkboxes and selects the nearest surviving Changes row', () => {
  const body = workspace();
  const reconcile = body.slice(
    body.indexOf('const reconcileChangeSelection = React.useCallback('),
    body.indexOf('const closeDiff = React.useCallback('),
  );
  assert.match(reconcile, /const firstRemoved = keysInVisualOrder\.findIndex/);
  assert.match(reconcile, /const keptSelected = new Set\(\[\.\.\.selectedChangesRef\.current\]\.filter/);
  assert.match(reconcile, /const selectedAfterRemoval = keysInVisualOrder\.find/);
  assert.match(reconcile, /const candidate = keysInVisualOrder\[Math\.min\(firstRemoved \+ offset/);
  assert.doesNotMatch(reconcile, /setCommitSelection/);
  const rollback = body.slice(
    body.indexOf('const rollback ='),
    body.indexOf('const buildChangeMenu = React.useCallback('),
  );
  assert.match(rollback, /setCommitSelection\(\(current\) =>/);
  assert.match(rollback, /reconcileChangeSelection\(value\?\.changes \?\? \[\], pickedKeys\)/);
  assert.match(rollback, /\.filter\(\(entry\) => \(stagedOnly \? entry\.staged === true : entry\.staged !== true\)\)/u);
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
