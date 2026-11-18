import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EntryIcon and fileBadge are reusable TS/TSX UI modules', async () => {
  const entryIcon = await read('src/client/components/ui/EntryIcon.tsx');
  const badgeModel = await read('src/client/components/ui/file-badge.ts');
  const barrel = await read('src/client/components/ui/index.tsx');

  assert.match(entryIcon, /export function EntryIcon\(/u);
  assert.match(entryIcon, /<HostFileTypeIcon/u);
  assert.doesNotMatch(entryIcon, /React\.createElement/u);
  assert.match(badgeModel, /export function fileBadge\(/u);
  assert.match(barrel, /export \{ EntryIcon/u);
  assert.match(barrel, /export \{ fileBadge/u);
});

test('the build exports EntryIcon and removes the legacy implementation', async () => {
  const build = await read('scripts/build-client.mjs');
  const legacy = await read('tests/fixtures/legacy/ui-primitives.legacy.js');

  assert.match(build, /'EntryIcon',\s+'fileBadge',/u);
  assert.doesNotMatch(legacy, /function EntryIcon\(/u);
  assert.doesNotMatch(legacy, /function fileBadge\(/u);
});
