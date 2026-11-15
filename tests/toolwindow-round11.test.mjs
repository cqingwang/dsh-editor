import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

test('project tree supports meta and shift extended selection', () => {
  const client = read('lib/client.js');
  assert.match(client, /const selectRow = React\.useCallback/);
  assert.match(client, /event\.shiftKey === true && selectionAnchor\.current !== null/);
  assert.match(client, /setSelection\(new Set\(rows\.slice\(start, end \+ 1\)/);
  assert.match(client, /treeRowSelectedSoft/);
  assert.match(client, /onSelect: selectRow/);
});

test('multi-row selection drives batch delete and batch copy', () => {
  const client = read('lib/client.js');
  assert.match(client, /const removeEntries = React\.useCallback/);
  assert.match(client, /editor\.deleteSelectedConfirm/);
  assert.match(client, /editor\.copySelectedPaths/);
  assert.match(client, /const selectedRows = selection\.has\(row\.path\)/);
  assert.match(client, /const batch = selectedRows\.length > 1 \? selectedRows : \[\]/);
});

test('terminal tabs follow the shell OSC title unless renamed by hand', () => {
  const client = read('lib/client.js');
  const hub = read('lib/terminal.js');
  const host = read('lib/index.js');
  assert.match(client, /emulator\.onTitleChange/);
  assert.match(client, /const syncTerminalTitle = React\.useCallback/);
  assert.match(client, /renamedRef\.current\.add/);
  assert.match(client, /op: 'rename', id, title, auto: true/);
  assert.match(hub, /manualTitle/);
  assert.match(hub, /if \(auto === true && terminal\.meta\.manualTitle === true\) return terminal\.describe\(\);/);
  assert.match(host, /body\?\.auto === true/);
});

test('terminal dock owns find and tab shortcuts', () => {
  const client = read('lib/client.js');
  assert.match(client, /function terminalMatches/);
  assert.match(client, /function countTerminalMatches/);
  assert.match(client, /function moveTerminalSelection/);
  assert.match(client, /'data-dsh-editor-terminal'/);
  assert.match(client, /closest\('\[data-dsh-terminal-pane\]'\)/);
  assert.match(client, /closest\('\[data-dsh-editor-terminal\]'\)/);
  assert.match(client, /Meta\+1|meta && !event\.altKey && !event\.shiftKey && \/\^\[1-9\]\$\/u/);
  assert.match(client, /event\.key === 'ArrowLeft' \|\| event\.key === 'ArrowRight'/);
});

test('tool-window toolbars keep the title and collapse their actions', () => {
  const client = read('lib/client.js');
  const toolbar = client.slice(client.indexOf('function PanelToolbar'), client.indexOf('/** One 24px panel toolbar button. */'));
  assert.match(toolbar, /panelToolbarFit/);
  assert.match(toolbar, /editor\.moreActions/);
  assert.match(toolbar, /badge/);
  assert.doesNotMatch(toolbar, /flex: '0 1 auto',\n\s+minWidth: 12/);
});
