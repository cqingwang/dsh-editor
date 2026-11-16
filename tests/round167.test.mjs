import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function commitPanel() {
  return source.slice(source.indexOf('function CommitPanel('), source.indexOf('function NamePrompt('));
}

test('one click selects a change without opening its diff', () => {
  const panel = commitPanel();
  const title = panel.indexOf('title: change.path,');
  const row = panel.slice(title, panel.indexOf("React.createElement('input', {", title));
  assert.match(row, /onClick: \(event\) => onSelectChange\?\.\(\{[\s\S]*?path: change\.path,[\s\S]*?staged: group\.id === 'staged',[\s\S]*?shift: event\.shiftKey,/);
  assert.match(row, /onDoubleClick: \(event\) => \{[\s\S]*?closest\('input, button, a, \[role="checkbox"\]'\) !== null\) return;[\s\S]*?onSelectDiff\?\.\(\{ path: change\.path, staged: group\.id === 'staged' \}\);/);
  assert.match(panel, /'aria-selected': selectedForChange,/);
});

test('the selected change is visibly distinct from the opened diff', () => {
  const panel = commitPanel();
  assert.match(panel, /selectedChange,\n\s+selectedGroup,\n\s+selectedChanges,\n\s+chosenChangeList = \[\],\n\s+collapsedGroups,/);
  const row = panel.slice(panel.indexOf('const selectedForChange'), panel.indexOf("React.createElement('input', {", panel.indexOf('const selectedForChange')));
  assert.match(row, /selectedForChange/);
  assert.match(row, /dsh-editor-commit-row-selected/);
  assert.match(row, /selectedForDiff/);
  assert.match(row, /dsh-editor-commit-row-active/);
});

test('shortcuts act on the newly selected row before the last opened diff', () => {
  const shortcut = source.slice(source.indexOf('const showDiffShortcut = React.useCallback('), source.indexOf("window.addEventListener('keydown', showDiffShortcut"));
  assert.match(shortcut, /selectedChangeRef\.current/);
  assert.match(shortcut, /selectedDiffPathRef\.current/);
});

test('a connected host is reused by its stable parent instead of child count', () => {
  const source = readFileSync(join(root, 'lib/client.js'), 'utf8');
  const block = source.slice(source.indexOf('function ensureHost(body) {'), source.indexOf('function idleHost()'));
  assert.match(block, /if \(hostParent !== null && host\.parentElement !== hostParent\)/);
  assert.match(block, /hostParent\.appendChild\(host\)/);
  assert.match(block, /if \(host !== null && root !== null\)/);
  assert.doesNotMatch(block, /childElementCount/);
  assert.doesNotMatch(source, /discardEmptyHost\(body\);/);
});
