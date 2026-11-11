import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('the editor tab strip overflows into `»` instead of squeezing every tab', () => {
  /* The terminal dock already learned this (round 50); the file tabs kept
     scrolling sideways, which hides the file you just opened. */
  /* The layout is computed once per render and consumed by the strip. */
  /* Round 148: the Commit diff owns a pinned tab, so the strip overflows one
     list that starts with that key and continues with the open files. */
  assert.match(source, /const fileTabLayout = overflowTabs\(allTabs, visibleTabCount\(tabStripWidth, allTabs\.length\), activeTabKey, \(entry\) => \(entry === DIFF_TAB_KEY \? DIFF_TAB_KEY : entry\.path\)\);/);
  const start = source.indexOf("ref: fileTabStripRef",);
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 1800);
  assert.match(block, /fileTabLayout\.visible\.map/);
  assert.match(block, /t\('editor\.tabsOverflow', \{ count: fileTabLayout\.hidden\.length \}\)/);
  /* The strip needs the same measurement the terminal dock uses. */
  assert.match(source, /const \[tabStripWidth, setTabStripWidth\] = React\.useState\(0\);/);
  assert.match(source, /dsh-editor\.tabStripOverflow|tabStripOverflowRef|new ResizeObserver\(measure\)/);
});

test('hidden file tabs keep their full titles in the dropdown', () => {
  const start = source.indexOf('ref: fileTabStripRef');
  assert.notEqual(start, -1);
  /* Round 148 grew the strip by the pinned diff tab; the slice still has to reach
     the overflow menu, so it is taken up to the menu's closing brace. */
  const block = source.slice(start, start + 4000);
  /* Menu labels come from the file paths, so two `index.ts` stay distinguishable. */
  assert.match(block, /label: entry\.dirty \? `\$\{entry\.path\} •` : entry\.path/);
  assert.match(block, /setActivePath\(entry\.path\)/);
});

/** Load `visibleTabCount` and `overflowTabs` in one scope. */
const tabHelpers = (() => {
  const load = (name) => {
    const start = source.indexOf(`    function ${name}(`);
    assert.notEqual(start, -1, `${name} is missing`);
    let index = source.indexOf('{', start);
    let depth = 0;
    for (; index < source.length; index += 1) {
      if (source[index] === '{') depth += 1;
      else if (source[index] === '}') {
        depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
      }
    }
    throw new Error(`unbalanced braces in ${name}`);
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
