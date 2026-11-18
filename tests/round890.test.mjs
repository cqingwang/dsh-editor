import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const source = await read('src/client/components/commit/commit-log-view-preferences.ts');
const { commitLogFilterToggle, commitLogGraphFoldToggle, commitLogGraphToggle } = loadTypeScriptModule(source, [
  'commitLogFilterToggle',
  'commitLogGraphFoldToggle',
  'commitLogGraphToggle',
]);

test('CommitLog graph toggle derives load and focus behavior', () => {
  assert.deepEqual(commitLogGraphToggle(false), {
    enabled: true,
    loadGraph: true,
    focusList: true,
  });
  assert.deepEqual(commitLogGraphToggle(true), {
    enabled: false,
    loadGraph: false,
    focusList: false,
  });
});

test('CommitLog fold and filter toggles derive cleanup behavior', () => {
  assert.deepEqual(commitLogGraphFoldToggle(false), {
    folded: true,
    clearHover: true,
  });
  assert.deepEqual(commitLogGraphFoldToggle(true), {
    folded: false,
    clearHover: true,
  });
  assert.deepEqual(commitLogFilterToggle(false), {
    visible: true,
    focusInput: true,
    clearFilter: false,
  });
  assert.deepEqual(commitLogFilterToggle(true), {
    visible: false,
    focusInput: false,
    clearFilter: true,
  });
});

test('CommitLog and toolbar use the extracted view preference model', async () => {
  const log = await read('src/client/components/commit/CommitLog.tsx');
  const toolbar = await read('src/client/components/commit/CommitLogToolbar.tsx');
  const build = await read('scripts/build-client.mjs');
  const client = await read('lib/client.js');

  assert.match(log, /commitLogGraphToggle\(graphMode\)/u);
  assert.match(log, /commitLogGraphFoldToggle\(graphFolded\)/u);
  assert.match(toolbar, /commitLogFilterToggle\(filterVisible\)/u);
  assert.match(build, /commit-log-view-preferences\.ts/u);
  assert.match(client, /function commitLogGraphToggle\(/u);
  assert.match(client, /function commitLogFilterToggle\(/u);
});
