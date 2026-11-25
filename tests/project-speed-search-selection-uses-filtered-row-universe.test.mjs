import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTypeScriptModule } from './ts-source.mjs';

const panel = await readFile(new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url), 'utf8');
const terminal = await readFile(new URL('../src/client/terminal.ts', import.meta.url), 'utf8');
const selectionModel = await readFile(
  new URL('../src/client/components/project/project-selection-model.ts', import.meta.url),
  'utf8',
);
const workspace = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

test('recursive Project search rows select against their filtered row universe', () => {
  assert.match(panel, /const selectVisibleRow = React\.useCallback\(\s*\(row: ProjectRow, event: [^)]*\): void =>/u);
  assert.match(panel, /search\.trim\(\) === '' \? undefined : visibleRows/u);
  assert.match(panel, /onSelect\(row, event, selectionRows\)/u);
  assert.match(panel, /onRowPointerDown=\{\(state, event\) => \{[\s\S]*?selectVisibleRow\(row, event\)/u);
  assert.match(panel, /selectSearchHit[\s\S]*?selectVisibleRow\(row, \{\}\)/u);
  assert.match(panel, /const hit = hits\.find[\s\S]*?selectVisibleRow\(hit, \{\}\)/u);
});

test('EditorWorkspace accepts the filtered rows for one selection gesture', () => {
  assert.match(
    workspace,
    /const selectRow = React\.useCallback\(\s*\(row: ProjectRow, event: ProjectTreeSelectionModifiers, selectionRows\?: ProjectRow\[\]\)/u,
  );
  assert.match(workspace, /rows: selectionRows \?\? rows/u);
});

test('Project search context menus reuse the filtered rows for batch actions', () => {
  assert.match(panel, /selectionRows: search\.trim\(\) === '' \? undefined : visibleRows/u);
  assert.match(workspace, /selectionRows \?\? rows/u);
  assert.match(workspace, /ProjectTreeContextMenuPayload/u);
});

test('cancelling Project speed search restores the pre-search selection', () => {
  assert.match(panel, /const searchReturnSelectionRef = React\.useRef/u);
  assert.match(panel, /if \(!searchOpen \|\| searchReturnSelectionRef\.current !== null\) return;/u);
  assert.match(
    panel,
    /const previous = searchReturnSelectionRef\.current;[\s\S]*?onApplySelection\(previous\.selection, previous\.primary, previous\.primary\)/u,
  );
  assert.match(panel, /searchReturnSelectionRef\.current = null;/u);
});

test('filtered Project speed search opens without expanding the hidden real tree', () => {
  const helpers = loadTypeScriptModule(terminal, ['projectSpeedSearchShouldRevealInTree']);
  assert.equal(helpers.projectSpeedSearchShouldRevealInTree(false), true);
  assert.equal(helpers.projectSpeedSearchShouldRevealInTree(true), false);
  assert.match(panel, /if \(projectSpeedSearchShouldRevealInTree\(filteredView\)\) onRevealPath\?\.\(hit\.path\);/u);
});

test('switching Project view restores the pre-search selection when it is still visible', () => {
  const helpers = loadTypeScriptModule(selectionModel, ['projectSpeedSearchSelectionAfterViewChange']);
  const restored = helpers.projectSpeedSearchSelectionAfterViewChange(
    { selection: new Set(['src/util.ts']), primary: 'src/util.ts' },
    [
      { path: 'src/util.ts', kind: 'file' },
      { path: 'README.md', kind: 'file' },
    ],
  );
  assert.deepEqual([...restored.selection], ['src/util.ts']);
  assert.equal(restored.primary, 'src/util.ts');
});

test('switching Project view leaves a hidden pre-search selection to filtered fallback', () => {
  const helpers = loadTypeScriptModule(selectionModel, ['projectSpeedSearchSelectionAfterViewChange']);
  const restored = helpers.projectSpeedSearchSelectionAfterViewChange(
    { selection: new Set(['src/util.ts']), primary: 'src/util.ts' },
    [{ path: 'README.md', kind: 'file' }],
  );
  assert.equal(restored, null);
});

test('ProjectPanel restores the pre-search selection before filtered-view reconciliation', () => {
  assert.match(
    panel,
    /const previous = searchReturnSelectionRef\.current;[\s\S]*?const requestId = \+\+projectViewSearchRestoreRef\.current;[\s\S]*?projectSpeedSearchSelectionAfterViewChange\(previous, rows\)[\s\S]*?onApplySelection\(restored\.selection, restored\.primary, restored\.primary\)/u,
  );
});
