import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const source = await read('src/client/components/commit/commit-log-flat-controller.ts');
const { commitLogFlatKeyIntent } = loadTypeScriptModule(source, ['commitLogFlatKeyIntent']);

test('flat Log keyboard intent maps context and select-all chords', () => {
  assert.deepEqual(commitLogFlatKeyIntent('ContextMenu', false, false, false), { type: 'context' });
  assert.deepEqual(commitLogFlatKeyIntent('F10', false, false, true), { type: 'context' });
  assert.deepEqual(commitLogFlatKeyIntent('a', true, false, false), { type: 'selectAll' });
  assert.deepEqual(commitLogFlatKeyIntent('A', false, true, false), { type: 'selectAll' });
  assert.equal(commitLogFlatKeyIntent('a', false, false, false), null);
});

test('flat Log keyboard intent maps relation and row navigation', () => {
  assert.deepEqual(commitLogFlatKeyIntent('ArrowRight', false, false, false), {
    type: 'relation',
    direction: 'parents',
  });
  assert.deepEqual(commitLogFlatKeyIntent('ArrowLeft', false, false, false), {
    type: 'relation',
    direction: 'children',
  });
  assert.deepEqual(commitLogFlatKeyIntent('ArrowDown', false, false, false), {
    type: 'action',
    action: 'next',
  });
  assert.deepEqual(commitLogFlatKeyIntent('ArrowUp', false, false, false), {
    type: 'action',
    action: 'previous',
  });
  assert.deepEqual(commitLogFlatKeyIntent('Home', false, false, false), {
    type: 'action',
    action: 'first',
  });
  assert.deepEqual(commitLogFlatKeyIntent('End', false, false, false), {
    type: 'action',
    action: 'last',
  });
  assert.deepEqual(commitLogFlatKeyIntent('Enter', false, false, false), {
    type: 'action',
    action: 'current',
  });
  assert.equal(commitLogFlatKeyIntent('x', false, false, false), null);
});

test('CommitLog uses the extracted flat controller', async () => {
  const log = await read('src/client/components/commit/CommitLog.tsx');
  const build = await read('scripts/build-client.mjs');
  const client = await read('lib/client.js');

  assert.match(log, /commitLogFlatKeyIntent\(/u);
  assert.match(log, /commitLogFlatListCommand\(/u);
  assert.match(log, /command\?\.type === 'context'/u);
  assert.match(log, /command\?\.type === 'selectAll'/u);
  assert.match(log, /command\?\.type === 'relation'/u);
  assert.match(log, /command\?\.type !== 'row'/u);
  assert.match(build, /commit-log-flat-controller\.ts/u);
  assert.match(client, /function commitLogFlatKeyIntent\(/u);
});
