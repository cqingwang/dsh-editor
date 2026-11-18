import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('CommitLogToolbar is a reusable TSX toolbar component', async () => {
  const component = await read('src/client/components/commit/CommitLogToolbar.tsx');

  assert.match(component, /interface CommitLogToolbarProps/u);
  assert.match(component, /function CommitLogToolbar\(/u);
  assert.match(component, /t\('editor\.logFilterHint'\)/u);
  assert.match(component, /event\.key === 'Escape'[\s\S]*?onFilterChange\(''\)[\s\S]*?onFilterVisibleChange\(false\)/u);
  assert.match(component, /filterInputRef\.current\?\.focus\(\)/u);
  assert.match(component, /t\('editor\.graphBranch'\)/u);
  assert.match(component, /t\('editor\.graphAtChip'/u);
  assert.match(component, /t\('editor\.logAuthor'\)/u);
  assert.match(component, /label=\{t\('editor\.logFilter'\)\}/u);
  assert.match(component, /label=\{t\('editor\.logGraph'\)\}/u);
  assert.match(component, /label=\{t\('editor\.refresh'\)\}/u);
  assert.doesNotMatch(component, /React\.createElement/u);
  assert.match(component, /export \{ CommitLogToolbar \};/u);
});

test('CommitLog delegates the list toolbar and graph toggle behavior', async () => {
  const log = await read('src/client/components/commit/CommitLog.tsx');
  const build = await read('scripts/build-client.mjs');
  const client = await read('lib/client.js');

  assert.match(log, /import \{ CommitLogToolbar \} from '\.\/CommitLogToolbar'/u);
  assert.match(log, /<CommitLogToolbar[\s\S]*?filterVisible=\{showFilter\}[\s\S]*?onToggleGraph=\{toggleGraphMode\}/u);
  assert.match(log, /const toggleGraphMode = \(\) => \{[\s\S]*?onLoadGraph\?\.\([\s\S]*?listRef\.current\?\.focus\?\.\(\)/u);
  assert.doesNotMatch(log, /label=\{t\('editor\.logGraph'\)\}/u);
  assert.match(build, /CommitLogToolbar\.tsx/u);
  assert.match(client, /function CommitLogToolbar\(/u);
});
