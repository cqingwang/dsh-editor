import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('FindToolWindow is a reusable TSX search component', async () => {
  const component = await read('src/client/components/search/FindToolWindow.tsx');

  assert.match(component, /export interface FindToolWindowProps/u);
  assert.match(component, /function FindToolWindowView\(/u);
  assert.match(component, /data-dsh-find-tool-window=''/u);
  assert.match(component, /data-dsh-find-tool-surface=/u);
  assert.match(component, /<QueryField/u);
  assert.match(component, /<ReplaceField/u);
  assert.match(component, /<MoveToPicker/u);
  assert.match(component, /<FindScopeEditor/u);
  assert.match(component, /const FindToolWindow = FindToolWindowView;/u);
  assert.match(component, /export \{ FindToolWindow \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
  assert.match(component, /return \(\n    <div\n      style=/u);
});

test('build embeds FindToolWindow and removes the legacy definition', async () => {
  const build = await read('scripts/build-client.mjs');
  const legacy = await read('src/client/find-tool.ts');
  const client = await read('lib/client.js');

  assert.match(build, /FindToolWindow\.tsx/u);
  assert.match(build, /findToolWindowModule/u);
  assert.doesNotMatch(legacy, /function FindToolWindow\(/u);
  assert.match(client, /function FindToolWindowView\(/u);
  assert.doesNotMatch(client, /function FindToolWindow\(/u);
  assert.match(client, /const FindToolWindow = FindToolWindowView;/u);
});

test('FindToolWindow and QuickOpen are independent tab components', async () => {
  const findTool = await read('src/client/components/search/FindToolWindow.tsx');
  const quickOpen = await read('src/client/components/search/QuickOpen.tsx');

  assert.ok(findTool.indexOf('function FindToolWindowView(') >= 0);
  assert.ok(findTool.indexOf('const FindToolWindow = FindToolWindowView;') > 0);
  assert.ok(quickOpen.indexOf('function QuickOpen(') >= 0);
});
