import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTypeScriptFunction } from './ts-source.mjs';

const findToolSource = await readFile(new URL('../src/client/find-tool.ts', import.meta.url), 'utf8');
const toolbarModelSource = await readFile(
  new URL('../src/client/components/ui/toolbar-model.ts', import.meta.url),
  'utf8',
);
const findWindowSource = await readFile(
  new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url),
  'utf8',
);

test('available replace history displaces lower-priority dock actions', () => {
  const findToolReplaceHistoryActionPinned = loadTypeScriptFunction(
    findToolSource,
    'findToolReplaceHistoryActionPinned',
  );
  const selectCompactActions = loadTypeScriptFunction(toolbarModelSource, 'selectCompactActions');
  const actions = [
    { id: 'rerun', pinned: true },
    { id: 'undoReplace', pinned: findToolReplaceHistoryActionPinned(false, true) },
    { id: 'settings', pinned: true },
    { id: 'groupBy', pinned: true },
  ];

  assert.deepEqual(
    selectCompactActions(actions, 2).map((action) => action.id),
    ['rerun', 'undoReplace'],
  );
  assert.equal(findToolReplaceHistoryActionPinned(true, false), true);
  assert.equal(findToolReplaceHistoryActionPinned(false, false), false);
});

test('Find wires Undo and Redo availability into their toolbar priority', () => {
  assert.match(
    findWindowSource,
    /pinned: findToolReplaceHistoryActionPinned\(floating, canUndoLastReplace === true\)/u,
  );
  assert.match(
    findWindowSource,
    /pinned: findToolReplaceHistoryActionPinned\(floating, canRedoLastReplace === true\)/u,
  );
});
