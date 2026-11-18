import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceSource = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const findToolSource = readFileSync(join(root, 'src/client/find-tool.ts'), 'utf8');
const source = workspaceSource + '\n' + findToolSource;
const tabStripSource = readFileSync(join(root, 'src/client/components/editor/EditorTabStrip.tsx'), 'utf8');

test('the editor tab strip overflows into `»` instead of squeezing every tab', () => {
  /* The terminal dock already learned this (round 50); the file tabs kept
     scrolling sideways, which hides the file you just opened. */
  /* The layout is computed once per render and consumed by the strip. */
  /* Round 148: the Commit diff owns a pinned tab, so the strip overflows one
     list that starts with that key and continues with the open files. */
  assert.match(source, /const fileTabLayout = overflowTabs\(allTabs, visibleTabCount\(tabStripWidth, allTabs\.length\), activeTabKey, tabKey\);/);
  assert.match(source, /<EditorTabStrip/);
  assert.match(source, /children=\{fileTabLayout\.visible\.map\(\(entry\) => fileTabElement\(entry\)\)\}/);
  assert.match(tabStripSource, /t\('editor\.tabsOverflow', \{ count: hiddenCount \}\)/);
  /* The strip needs the same measurement the terminal dock uses. */
  assert.match(source, /const \[tabStripWidth, setTabStripWidth\] =\s*React\.useState\(0\);/);
  assert.match(source, /dsh-editor\.tabStripOverflow|tabStripOverflowRef|new ResizeObserver\(measure\)/);
});

test('hidden file tabs keep their full titles in the dropdown', () => {
  const start = source.indexOf('onOverflow={(event) => {');
  assert.notEqual(start, -1);
  const block = source.slice(start, source.indexOf('children={fileTabLayout.visible.map', start));
  /* Menu labels come from the file paths, so two `index.ts` stay distinguishable. */
  assert.match(block, /label: entry\.dirty \? `\$\{entry\.path\} •` : entry\.path/);
  assert.match(block, /setActivePath\(entry\.path\)/);
});

/** Load `visibleTabCount` and `overflowTabs` in one scope. */
const tabHelpers = (() => {
  const load = (name) => {
    return transpileTypeScriptFunction(findToolSource, name);
  };
  const body = `${load('visibleTabCount')}\n${load('overflowTabs')}`;
  return new Function(`${body}; return { visibleTabCount, overflowTabs };`)();
})();

test('file tabs overflow by PATH, not by a terminal id they do not have', () => {
  /* The shipping bug: `overflowTabs` read `.id`, file tabs carry `.path`, every
     file compared equal to every other and `hidden` was always empty. */
  const files = [{ path: 'a.ts' }, { path: 'b.ts' }, { path: 'c.ts' }];
  const layout = tabHelpers.overflowTabs(files, 2, 'c.ts', (file) => file.path);
  assert.deepEqual(layout.visible.map((file) => file.path), ['a.ts', 'c.ts']);
  assert.deepEqual(layout.hidden.map((file) => file.path), ['b.ts']);
  /* Terminal tabs keep working through the default accessor. */
  const terminals = [{ id: 't1' }, { id: 't2' }, { id: 't3' }];
  const dock = tabHelpers.overflowTabs(terminals, 2, 't3');
  assert.deepEqual(dock.visible.map((terminal) => terminal.id), ['t1', 't3']);
  assert.deepEqual(dock.hidden.map((terminal) => terminal.id), ['t2']);
});
