import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

/** Evaluate one shipping function by brace balance (same technique as round46/49). */
function load(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} is missing from lib/client.js`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

const subtotalOf = load('subtotalOf');

test('a directory subtotal adds up the files below it', () => {
  const changes = [
    { path: 'src/a.ts', stagedLines: { additions: 3, deletions: 1 } },
    { path: 'src/b.ts', stagedLines: { additions: 10, deletions: 0 } },
  ];
  assert.deepEqual(subtotalOf(changes, 'staged'), { additions: 13, deletions: 1 });
});

test('each band sums its own side instead of mixing index and working tree', () => {
  /* The same file can appear in both bands; the numbers must not be combined. */
  const changes = [
    { path: 'a.ts', stagedLines: { additions: 5, deletions: 2 }, unstagedLines: { additions: 7, deletions: 4 } },
    { path: 'b.ts', unstagedLines: { additions: 1, deletions: 0 } },
  ];
  assert.deepEqual(subtotalOf(changes, 'staged'), { additions: 5, deletions: 2 });
  assert.deepEqual(subtotalOf(changes, 'unstaged'), { additions: 8, deletions: 4 });
});

test('binary rows contribute nothing, and an unknown sum stays blank', () => {
  /* A binary change has no line numbers; counting it as +0 −0 would be a lie. */
  assert.deepEqual(
    subtotalOf([{ path: 'logo.png', stagedLines: { binary: true } }, { path: 'a.ts', stagedLines: { additions: 2, deletions: 3 } }], 'staged'),
    { additions: 2, deletions: 3 },
  );
  /* Untracked files carry no numstat reading at all. */
  assert.equal(subtotalOf([{ path: 'new.txt' }], 'unstaged'), undefined);
  assert.equal(subtotalOf([], 'staged'), undefined);
  assert.equal(subtotalOf(undefined, 'staged'), undefined);
});

test('the directory row and the group header share one subtotal helper', () => {
  /* The group header used to inline the sum; two implementations drift. */
  assert.match(source, /const groupTotals = \(group\) => subtotalOf\(group\.changes, group\.id\);/);
  /* The collapsible directory row shows the same reading as the group header. */
  const dirStart = source.indexOf("if (row.kind === 'directory') {");
  /* Round 140 grew the directory row ("N files" label + parent path), so the
     window that has to contain the subtotal reading got wider. */
  const dirBlock = source.slice(dirStart, dirStart + 6400);
  assert.match(dirBlock, /React\.createElement\(LineCounts, \{ counts: subtotalOf\(row\.changes, group\.id\) \}\)/);
});

/** Load a helper that has no dependencies on other module-scope helpers. */
const visibleTabCount = load('visibleTabCount');
const overflowTabs = load('overflowTabs');

test('the tab strip keeps tabs legible and overflows the rest', () => {
  /* Plenty of room: every tab stays. */
  assert.equal(visibleTabCount(900, 4), 4);
  /* Narrow dock: only what fits at ~92px per tab, never zero. */
  assert.equal(visibleTabCount(300, 8), 2);
  assert.equal(visibleTabCount(40, 8), 1);
  /* Before the first layout pass the width is 0: show everything rather than
     hiding tabs behind a chevron that has not been measured into existence. */
  assert.equal(visibleTabCount(0, 5), 5);
  assert.equal(visibleTabCount(Number.NaN, 3), 3);
  assert.equal(visibleTabCount(500, 0), 0);
});

test('the overflow list never hides the tab the user is looking at', () => {
  const tabs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const wide = overflowTabs(tabs, 4, 'd');
  assert.deepEqual(wide.visible.map((tab) => tab.id), ['a', 'b', 'c', 'd']);
  assert.deepEqual(wide.hidden, []);

  /* `d` is active but does not fit: it takes the last visible slot. */
  const narrow = overflowTabs(tabs, 2, 'd');
  assert.deepEqual(narrow.visible.map((tab) => tab.id), ['a', 'd']);
  assert.deepEqual(narrow.hidden.map((tab) => tab.id), ['b', 'c']);
  /* No hidden tab is rendered twice. */
  assert.equal(new Set([...narrow.visible, ...narrow.hidden].map((tab) => tab.id)).size, 4);
  /* An unknown/absent active id leaves the leading run alone. */
  assert.deepEqual(overflowTabs(tabs, 2, null).visible.map((tab) => tab.id), ['a', 'b']);
  assert.deepEqual(overflowTabs([], 3, null), { visible: [], hidden: [] });
});
