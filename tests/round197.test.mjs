import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function diffPreview() {
  return source.slice(source.indexOf('function DiffPreview('), source.indexOf('* Commit tool window: grouped'));
}

test('the diff toolbar measures itself and collapses secondary actions when very narrow', () => {
  const diff = diffPreview();
  assert.match(diff, /const \[diffDirectActionCount, setDiffDirectActionCount\] = React\.useState\(null\);/);
  assert.match(diff, /const diffToolbarRef = React\.useRef\(null\);/);
  assert.match(diff, /new ResizeObserver\(measure\)/);
  assert.match(diff, /diffDirectActionCountForWidth\(width, fixedWidth, diffToolbarActions\)/);
  assert.match(diff, /ref: diffToolbarRef/);
});

test('diff modes stay fixed while unfold, restore history and selection restore remain actions', () => {
  const diff = diffPreview();
  const start = diff.indexOf('const diffToolbarActions =');
  assert.notEqual(start, -1);
  const actions = diff.slice(start, diff.indexOf('const hidden =', start));
  for (const id of ['collapse', 'undo', 'redo', 'selection']) {
    assert.match(actions, new RegExp(`id: '${id}'`));
  }
  assert.doesNotMatch(actions, /id: 'view'/);
  assert.match(actions, /label: t\('editor\.diffUndoRestore'\)/);
  assert.match(actions, /label: t\('editor\.diffSelectionRestore'\)/);
  assert.match(diff, /React\.createElement\(DiffViewModeControl, \{/);
  assert.match(diff, /mode: diffViewModeControl/);
});

test('the compact overflow keeps hunk and close controls visible and reuses ContextMenu', () => {
  const diff = diffPreview();
  assert.match(diff, /directDiffActionEntries\.map/);
  assert.match(diff, /diffActionsCompact\s*\?\s*React\.createElement\(ToolbarButton, \{[\s\S]*?label: t\('editor\.moreActions'\)/);
  assert.match(diff, /React\.createElement\(ContextMenu, \{[\s\S]*?menu: diffActionMenu/);
  assert.match(diff, /diffActionMenu === null \? null : React\.createElement\(ContextMenu/);
  assert.match(diff, /items: hiddenDiffActionEntries\.map/);
  assert.match(diff, /className: 'dsh-editor-hunk-nav dsh-editor-hunk-capsule'/);
  assert.match(diff, /label: t\('editor\.closeDiff'\)/);
});
