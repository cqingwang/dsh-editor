import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const source = await read('src/client/components/commit/commit-log-list-command-model.ts');
const { commitLogFlatListCommand, commitLogGraphListCommand } = loadTypeScriptModule(source, [
  'commitLogFlatListCommand',
  'commitLogGraphListCommand',
]);
const rows = [{ hash: 'a' }, { hash: 'b' }, { hash: 'c' }];

test('graph list commands preserve context, relation and movement intent', () => {
  assert.deepEqual(commitLogGraphListCommand({ type: 'context' }, rows, 'b'), {
    type: 'context',
  });
  assert.deepEqual(commitLogGraphListCommand({ type: 'relation', direction: 'children' }, rows, 'b'), {
    type: 'relation',
    direction: 'children',
  });
  assert.deepEqual(commitLogGraphListCommand({ type: 'move', delta: -1 }, rows, 'b'), {
    type: 'move',
    delta: -1,
  });
});

test('graph list commands validate current row and select first or last rows', () => {
  assert.deepEqual(commitLogGraphListCommand({ type: 'current' }, rows, 'b'), {
    type: 'show',
    hash: 'b',
  });
  assert.equal(commitLogGraphListCommand({ type: 'current' }, rows, null), null);
  assert.equal(commitLogGraphListCommand({ type: 'current' }, rows, 'missing'), null);
  assert.deepEqual(commitLogGraphListCommand({ type: 'first' }, rows, null), {
    type: 'select',
    hash: 'a',
  });
  assert.deepEqual(commitLogGraphListCommand({ type: 'last' }, rows, null), {
    type: 'select',
    hash: 'c',
  });
  assert.equal(commitLogGraphListCommand({ type: 'first' }, [], null), null);
  assert.equal(commitLogGraphListCommand(null, rows, null), null);
});

test('flat list commands preserve select-all, relation and row actions', () => {
  assert.deepEqual(commitLogFlatListCommand({ type: 'context' }, rows), {
    type: 'context',
  });
  assert.deepEqual(commitLogFlatListCommand({ type: 'selectAll' }, rows), {
    type: 'selectAll',
    hashes: ['a', 'b', 'c'],
  });
  assert.deepEqual(commitLogFlatListCommand({ type: 'relation', direction: 'parents' }, rows), {
    type: 'relation',
    direction: 'parents',
  });
  assert.deepEqual(commitLogFlatListCommand({ type: 'action', action: 'next' }, rows), {
    type: 'row',
    action: 'next',
  });
  assert.equal(commitLogFlatListCommand({ type: 'action' }, rows), null);
  assert.equal(commitLogFlatListCommand(null, rows), null);
});

test('CommitLog delegates list key intent to the command model', async () => {
  const log = await read('src/client/components/commit/CommitLog.tsx');
  const build = await read('scripts/build-client.mjs');
  const client = await read('lib/client.js');

  assert.match(log, /commitLogGraphListCommand\(/u);
  assert.match(log, /commitLogFlatListCommand\(/u);
  assert.match(log, /command\?\.type === 'context'/u);
  assert.match(log, /command\?\.type === 'selectAll'/u);
  assert.match(log, /command\?\.type === 'relation'/u);
  assert.match(log, /command\?\.type !== 'row'/u);
  assert.match(build, /commit-log-list-command-model\.ts/u);
  assert.match(client, /function commitLogGraphListCommand\(/u);
  assert.match(client, /function commitLogFlatListCommand\(/u);
});
