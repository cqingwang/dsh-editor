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
