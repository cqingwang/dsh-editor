import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const panel = await readFile(
  new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url),
  'utf8',
);
const selectionModel = await readFile(
  new URL('../src/client/components/project/project-selection-model.ts', import.meta.url),
  'utf8',
);
const workspace = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const helpers = loadTypeScriptModule(selectionModel, [
  'projectPrimaryHiddenByCollapse',
  'projectSelectionAfterDirectoryCollapse',
]);

test('only a descendant primary path is hidden by collapsing its directory', () => {
  assert.equal(helpers.projectPrimaryHiddenByCollapse('src', 'src/app.js'), true);
  assert.equal(helpers.projectPrimaryHiddenByCollapse('src', 'src2/app.js'), false);
  assert.equal(helpers.projectPrimaryHiddenByCollapse('src', 'src'), false);
  assert.equal(helpers.projectPrimaryHiddenByCollapse('src', null), false);
});

test('collapsing a directory removes only hidden descendants', () => {
  assert.deepEqual(
    [...helpers.projectSelectionAfterDirectoryCollapse(
      new Set(['README.md', 'src/nav-main.js', 'src/nav-target.js', 'src2/keep.js']),
      'src',
    )],
    ['README.md', 'src2/keep.js', 'src'],
  );
  assert.deepEqual(
    [...helpers.projectSelectionAfterDirectoryCollapse(
      new Set(['README.md', 'src/nav-main.js', 'src2/keep.js']),
      'src',
      false,
    )],
    ['README.md', 'src2/keep.js'],
  );
  assert.deepEqual(
    [...helpers.projectSelectionAfterDirectoryCollapse(new Set(['src', 'src/nav-main.js']), 'src', false)],
    ['src'],
  );
});

test('collapsing a directory applies the cropped selection for hidden descendants', () => {
  assert.match(panel, /projectPrimaryHiddenByCollapse/u);
  assert.match(panel, /projectSelectionAfterDirectoryCollapse/u);
  assert.match(panel, /onApplySelection/u);
  const block = panel.slice(panel.indexOf('onToggleRow={(row) =>'), panel.indexOf('onToggleRow={(row) =>') + 900);
  assert.match(block, /const primaryHidden = projectPrimaryHiddenByCollapse\(row\.path, selectedPath\);/u);
  assert.match(
    block,
    /const hiddenSelected = \[\.\.\.selection\]\.some\(\(path\) => projectPrimaryHiddenByCollapse\(row\.path, path\)\);/u,
  );
  assert.match(block, /const nextSelection = projectSelectionAfterDirectoryCollapse\(selection, row\.path, primaryHidden\);/u);
  assert.match(block, /const nextPrimary = primaryHidden \|\| selectedPath === null \? row\.path : selectedPath;/u);
  assert.match(block, /if \(onApplySelection !== undefined\) onApplySelection\(nextSelection, nextPrimary, nextPrimary\);/u);
  assert.match(block, /else if \(primaryHidden\) selectVisibleRow\(row, \{\}\);/u);
  assert.match(block, /onToggle\(row\.path\);/u);
  assert.match(workspace, /onApplySelection=\{applyTreeSelection\}/u);
});
