import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const source = await read('src/client/components/commit/stash-shelve-menu.ts');
const { stashMenu, shelveMenu } = loadTypeScriptModule(source, ['stashMenu', 'shelveMenu']);
const t = (key) => key;

function itemById(menu, id) {
  return menu.items.find((item) => item?.id === id) ?? null;
}

test('stash menu preserves empty stack and entry actions', () => {
  const calls = [];
  const empty = stashMenu({
    t,
    position: { x: 10, y: 20 },
    entries: [],
    hasChanges: false,
    onRunStash: (operation, ref) => calls.push([operation, ref]),
  });
  assert.equal(empty.x, 10);
  assert.equal(empty.y, 20);
  assert.equal(itemById(empty, 'save')?.disabled, true);
  assert.equal(itemById(empty, 'pop')?.label, 'editor.stashEmpty');
  assert.equal(itemById(empty, 'pop')?.disabled, true);
  assert.equal(itemById(empty, 'apply:stash@{0}'), null);

  const populated = stashMenu({
    t,
    position: { x: 30, y: 40 },
    entries: [
      { ref: 'stash@{0}', subject: 'latest' },
      { ref: 'stash@{1}', subject: 'older' },
    ],
    hasChanges: true,
    onRunStash: (operation, ref) => calls.push([operation, ref]),
  });
  assert.equal(itemById(populated, 'save')?.disabled, false);
  assert.equal(itemById(populated, 'pop')?.label, 'editor.stashPop');
  assert.equal(itemById(populated, 'apply:stash@{0}')?.label, 'editor.stashApply');
  assert.equal(itemById(populated, 'drop:stash@{1}')?.danger, true);
  itemById(populated, 'save').run();
  itemById(populated, 'pop').run();
  itemById(populated, 'apply:stash@{0}').run();
  itemById(populated, 'drop:stash@{1}').run();
  assert.deepEqual(calls, [
    ['save', undefined],
    ['pop', undefined],
    ['apply', 'stash@{0}'],
    ['drop', 'stash@{1}'],
  ]);
});

test('shelve menu preserves empty stack and selected-path save action', () => {
  const calls = [];
  const empty = shelveMenu({
    t,
    position: { x: 12, y: 24 },
    entries: [],
    selectedPaths: [],
    onRunShelve: (operation, ref, paths) => calls.push([operation, ref, paths]),
  });
  assert.equal(itemById(empty, 'shelveSave')?.disabled, true);
  assert.equal(itemById(empty, 'empty')?.disabled, true);
  assert.equal(itemById(empty, 'shelveApply:stash@{0}'), null);

  const populated = shelveMenu({
    t,
    position: { x: 36, y: 48 },
    entries: [{ ref: 'shelve@{0}', subject: 'saved' }],
    selectedPaths: ['src/a.ts', 'src/b.ts'],
    onRunShelve: (operation, ref, paths) => calls.push([operation, ref, paths]),
  });
  assert.equal(itemById(populated, 'shelveSave')?.disabled, false);
  assert.equal(itemById(populated, 'shelveApply:shelve@{0}')?.label, 'editor.stashApply');
  assert.equal(itemById(populated, 'shelveDrop:shelve@{0}')?.danger, true);
  itemById(populated, 'shelveSave').run();
  itemById(populated, 'shelveApply:shelve@{0}').run();
  itemById(populated, 'shelveDrop:shelve@{0}').run();
  assert.deepEqual(calls, [
    ['save', undefined, ['src/a.ts', 'src/b.ts']],
    ['apply', 'shelve@{0}', undefined],
    ['drop', 'shelve@{0}', undefined],
  ]);
});

test('editor workspace reuses the extracted stash and shelve menu builders', async () => {
  const workspace = await read('src/client/editor-workspace.tsx');
  const build = await read('scripts/build-client.mjs');
  const client = await read('lib/client.js');

  assert.match(workspace, /declare const stashMenu:/u);
  assert.match(workspace, /declare const shelveMenu:/u);
  assert.match(workspace, /stashMenu\(\{/u);
  assert.match(workspace, /shelveMenu\(\{/u);
  assert.match(workspace, /onRunStash: \(operation, ref\) => void runStash\(operation, ref\)/u);
  assert.match(workspace, /onRunShelve: \(operation, ref, paths\) => void runShelve\(operation, ref, paths\)/u);
  assert.match(build, /stash-shelve-menu\.ts/u);
  assert.match(client, /function stashMenu\(/u);
  assert.match(client, /function shelveMenu\(/u);
});
