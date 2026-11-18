import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('ShowUsagesPopup is a reusable TSX search component', async () => {
  const popup = await read('src/client/components/search/ShowUsagesPopup.tsx');

  assert.match(popup, /export interface ShowUsagesPopupProps/u);
  assert.match(popup, /data-dsh-show-usages=''/u);
  assert.match(popup, /role='dialog'/u);
  assert.match(popup, /role='listbox'/u);
  assert.match(popup, /<ContextMenu/u);
  assert.match(popup, /<ToolbarButton/u);
  assert.match(popup, /event\.key === 'ContextMenu'/u);
  assert.match(popup, /event\.key === 'ArrowDown'/u);
  assert.match(popup, /event\.key === 'Escape'/u);
  assert.doesNotMatch(popup, /React\.createElement/u);
});

test('build embeds ShowUsagesPopup after the retired search module is removed', async () => {
  const build = await read('scripts/build-client.mjs');
  const legacy = await read('tests/fixtures/legacy/search-everywhere.legacy.js');
  const fixture = await read('tests/fixtures/search-everywhere.legacy.js');

  assert.match(build, /ShowUsagesPopup\.tsx/u);
  assert.match(build, /showUsagesPopupModule/u);
  assert.doesNotMatch(build, /['"]search-everywhere\.js['"]/u);
  assert.match(legacy, /function ShowUsagesPopup\(/u);
  assert.match(fixture, /function ShowUsagesPopup\(/u);
});

test('retired search reference files stay outside the npm package', async () => {
  const packageJson = JSON.parse(await read('package.json'));

  assert.equal(packageJson.files.some((entry) => entry.includes('.js.bak')), false);
  assert.equal(existsSync(new URL('../src/client/search-everywhere.js.bak', import.meta.url)), false);
});
