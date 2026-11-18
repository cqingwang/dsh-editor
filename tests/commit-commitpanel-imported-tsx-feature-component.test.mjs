import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('CommitPanel is an imported TSX feature component', async () => {
  const panel = await read('src/client/components/commit/CommitPanel.tsx');

  assert.match(panel, /export interface CommitPanelProps/u);
  assert.match(panel, /import \{ CompactActionBar \}/u);
  assert.match(panel, /import \{ PanelToolbar \}/u);
  assert.match(panel, /<PanelToolbar/u);
  assert.match(panel, /<CompactActionBar/u);
  assert.doesNotMatch(panel, /React\.createElement/u);
});

test('build embeds CommitPanel TSX and legacy commit.js has no duplicate component', async () => {
  const build = await read('scripts/build-client.mjs');
  const legacy = await read('src/client/commit.ts');
  const fixture = await read('src/client/components/commit/CommitPanel.tsx');

  assert.match(build, /CommitPanel\.tsx/u);
  assert.match(build, /commitPanelModule/u);
  assert.doesNotMatch(legacy, /function CommitPanel\(/u);
  assert.match(fixture, /function CommitPanel\(/u);
});
