import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const source = await read('src/client/components/commit/commit-log-graph-controller.ts');
const { commitLogGraphCursor, commitLogGraphKeyIntent, commitLogGraphMove } = loadTypeScriptModule(source, [
  'commitLogGraphCursor',
  'commitLogGraphKeyIntent',
  'commitLogGraphMove',
]);
const rows = [{ hash: 'a' }, { hash: 'b' }, { hash: 'c' }];

test('graph cursor stays on a valid row or falls back to the first row', () => {
  assert.equal(commitLogGraphCursor(rows, 'b'), 'b');
  assert.equal(commitLogGraphCursor(rows, 'missing'), 'a');
  assert.equal(commitLogGraphCursor(rows, null), 'a');
  assert.equal(commitLogGraphCursor([], 'a'), null);
});

test('graph movement clamps ends and prefers the cursor before hover', () => {
  assert.deepEqual(commitLogGraphMove(rows, null, null, 1), { hash: 'a', index: 0 });
  assert.deepEqual(commitLogGraphMove(rows, null, null, -1), { hash: 'c', index: 2 });
  assert.deepEqual(commitLogGraphMove(rows, 'b', 'a', 1), { hash: 'c', index: 2 });
  assert.deepEqual(commitLogGraphMove(rows, null, 'b', -1), { hash: 'a', index: 0 });
  assert.deepEqual(commitLogGraphMove(rows, 'c', null, 1), { hash: 'c', index: 2 });
  assert.deepEqual(commitLogGraphMove(rows, 'a', null, -1), { hash: 'a', index: 0 });
  assert.equal(commitLogGraphMove([], null, null, 1), null);
});

test('graph key intent maps IDEA navigation chords', () => {
  assert.deepEqual(commitLogGraphKeyIntent('ContextMenu', false), { type: 'context' });
  assert.deepEqual(commitLogGraphKeyIntent('F10', true), { type: 'context' });
  assert.deepEqual(commitLogGraphKeyIntent('ArrowRight', false), {
    type: 'relation',
    direction: 'parents',
  });
  assert.deepEqual(commitLogGraphKeyIntent('ArrowLeft', false), {
    type: 'relation',
    direction: 'children',
  });
  assert.deepEqual(commitLogGraphKeyIntent('ArrowDown', false), { type: 'move', delta: 1 });
  assert.deepEqual(commitLogGraphKeyIntent('ArrowUp', false), { type: 'move', delta: -1 });
  assert.deepEqual(commitLogGraphKeyIntent('Home', false), { type: 'first' });
  assert.deepEqual(commitLogGraphKeyIntent('End', false), { type: 'last' });
  assert.deepEqual(commitLogGraphKeyIntent('Enter', false), { type: 'current' });
  assert.equal(commitLogGraphKeyIntent('x', false), null);
});

test('CommitLog uses the extracted graph controller', async () => {
  const log = await read('src/client/components/commit/CommitLog.tsx');
  const build = await read('scripts/build-client.mjs');
  const client = await read('lib/client.js');

  assert.match(log, /commitLogGraphCursor\(graphRows, graphCursor\)/u);
  assert.match(log, /commitLogGraphMove\(graphRows, graphCursor, graphHover, delta\)/u);
  assert.match(log, /commitLogGraphKeyIntent\(event\.key, event\.shiftKey === true\)/u);
  assert.match(build, /commit-log-graph-controller\.ts/u);
  assert.match(client, /function commitLogGraphCursor\(/u);
  assert.match(client, /function commitLogGraphMove\(/u);
});
