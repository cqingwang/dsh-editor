import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('TreeMessage is a reusable accessible tree status component', async () => {
  const message = await read('src/client/components/ui/TreeMessage.tsx');
  const index = await read('src/client/components/ui/index.tsx');

  assert.match(message, /export interface TreeMessageProps/u);
  assert.match(message, /role = 'status'/u);
  assert.match(message, /live = 'polite'/u);
  assert.match(message, /aria-live=\{live\}/u);
  assert.match(message, /aria-atomic='true'/u);
  assert.match(message, /aria-busy=\{busy \? true : undefined\}/u);
  assert.match(message, /data-dsh-tree-message=\{state\}/u);
  assert.match(index, /TreeMessage/u);
});

test('Project tree maps loading, errors, misses and truncation to semantic states', async () => {
  const panel = await read('src/client/components/project/ProjectPanel.tsx');

  assert.match(panel, /state='loading'[\s\S]*?busy=\{true\}/u);
  assert.match(panel, /state='empty'/u);
  assert.match(panel, /state='error'[\s\S]*?role='alert'[\s\S]*?live='assertive'/u);
  assert.match(panel, /state='search-error'[\s\S]*?role='alert'[\s\S]*?live='assertive'/u);
  assert.match(panel, /state='no-matches'/u);
  assert.match(panel, /state='truncated'/u);
});

test('TreeMessage is present in the built client UI prelude', async () => {
  const build = await read('scripts/build-client.mjs');
  const client = await read('lib/client.js');

  assert.match(build, /'TreeMessage'/u);
  assert.match(client, /function TreeMessage\(/u);
  assert.match(client, /data-dsh-tree-message/u);
});
