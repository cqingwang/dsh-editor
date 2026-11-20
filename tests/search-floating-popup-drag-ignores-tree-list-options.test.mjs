import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const popup = await readFile(new URL('../src/client/components/search/FindToolPopup.tsx', import.meta.url), 'utf8');
const picker = await readFile(
  new URL('../src/client/components/project/WorkspaceDirectoryPicker.tsx', import.meta.url),
  'utf8',
);

test('floating popup dragging ignores interactive tree, list and tab surfaces', () => {
  const selector = popup.match(/const FLOATING_POPUP_MOVE_IGNORE_SELECTOR =\s*'([^']+)';/u)?.[1] ?? '';
  for (const role of ['tree', 'treeitem', 'listbox', 'option', 'tab', 'menuitem', 'button']) {
    assert.match(selector, new RegExp(`\\[role="${role}"\\]`, 'u'));
  }
  assert.doesNotMatch(
    selector,
    /\[role="tablist"\]/u,
    'non-interactive tablist whitespace must remain available as a drag handle',
  );
  assert.match(selector, /\[data-dsh-file-tree\]/u);
  assert.match(popup, /target\.closest\(FLOATING_POPUP_MOVE_IGNORE_SELECTOR\) !== null/u);
});

test('workspace directory picker keeps tree rows interactive inside its draggable surface', () => {
  assert.match(picker, /<PickerSurface>/u);
  assert.match(picker, /onRowPointerDown=\{\(state: FileTreeViewRowState\) => selectTreePath\(state\.row\.path\)\}/u);
});
