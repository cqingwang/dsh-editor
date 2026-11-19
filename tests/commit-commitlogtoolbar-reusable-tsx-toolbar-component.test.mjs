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
  assert.match(component, /filterInputRef\.current\?\.focus\(\)/u);
  assert.match(component, /t\('editor\.graphBranch'\)/u);
  assert.match(component, /t\('editor\.graphAtChip'/u);
  assert.match(component, /t\('editor\.logAuthor'\)/u);
  assert.match(component, /label=\{t\('editor\.logFilter'\)\}/u);
  assert.match(component, /label=\{t\('editor\.logGraph'\)\}/u);
  assert.match(component, /label=\{t\('editor\.refresh'\)\}/u);
  assert.match(component, /icon='search'[\s\S]*?active=\{filterVisible\}/u);
  assert.match(component, /icon='graph'[\s\S]*?active=\{graphMode\}/u);
  assert.doesNotMatch(component, /React\.createElement/u);
  assert.match(component, /export \{ CommitLogToolbar \};/u);
});

test('Escape clears the Log query without closing its field', async () => {
  const component = await read('src/client/components/commit/CommitLogToolbar.tsx');
  const escapeStart = component.indexOf("if (event.key === 'Escape')");
  assert.notEqual(escapeStart, -1);
  const escapeBlock = component.slice(escapeStart, component.indexOf('}', escapeStart) + 1);

  assert.match(escapeBlock, /onFilterChange\(''\)/u);
  assert.doesNotMatch(escapeBlock, /onFilterVisibleChange\(false\)/u);
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
