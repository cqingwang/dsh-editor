import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const source = await read('src/client/components/commit/commit-log-selection-model.ts');
const { commitLogContextSelection, commitSelectionAfterClick } = loadTypeScriptModule(source, [
  'commitLogContextSelection',
  'commitSelectionAfterClick',
]);

test('commit row selection preserves IDEA plain, meta and shift semantics', () => {
  const order = ['c', 'b', 'a'];
  assert.deepEqual(commitSelectionAfterClick(order, ['b'], 'a', {}, 'b'), {
    selected: ['a'],
    anchor: 'a',
  });
  assert.deepEqual(commitSelectionAfterClick(order, ['b'], 'a', { meta: true }, 'b'), {
    selected: ['b', 'a'],
    anchor: 'a',
  });
  assert.deepEqual(commitSelectionAfterClick(order, ['b', 'a'], 'a', { meta: true }, 'b'), {
    selected: ['b'],
    anchor: 'a',
  });
  assert.deepEqual(commitSelectionAfterClick(order, ['b'], 'a', { shift: true }, 'b'), {
    selected: ['b', 'a'],
    anchor: 'b',
  });
});

test('commit row selection filters invalid order and clears missing targets', () => {
  assert.deepEqual(commitSelectionAfterClick(['a', '', 'b', 'a'], ['x', 'a'], 'missing', {}, 'x'), {
    selected: ['a'],
    anchor: 'a',
  });
  assert.deepEqual(commitSelectionAfterClick([], ['a'], 'a', {}, ''), {
    selected: [],
    anchor: '',
  });
});

test('context selection keeps an existing multi-selection or selects the clicked row', () => {
  assert.deepEqual(commitLogContextSelection(['a', 'b'], 'b'), {
    selectionHashes: ['a', 'b'],
    selectClicked: false,
    anchor: 'b',
  });
  assert.deepEqual(commitLogContextSelection(['a', 'b'], 'c'), {
    selectionHashes: ['c'],
    selectClicked: true,
    anchor: 'c',
  });
});

test('CommitLog uses the dedicated selection model', async () => {
  const log = await read('src/client/components/commit/CommitLog.tsx');
  const findTool = await read('src/client/find-tool.ts');
  const build = await read('scripts/build-client.mjs');
  const client = await read('lib/client.js');

  assert.match(
    log,
    /import \{ commitLogContextSelection, commitSelectionAfterClick \} from '\.\/commit-log-selection-model'/u,
  );
  assert.match(log, /commitLogContextSelection\(selectedCommits, hash\)/u);
  assert.doesNotMatch(findTool, /function commitSelectionAfterClick\(/u);
  assert.match(build, /commit-log-selection-model\.ts/u);
  assert.match(client, /function commitSelectionAfterClick\(/u);
  assert.match(client, /function commitLogContextSelection\(/u);
});
