import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('the overflow menu carries the same colour stripe as the tab strip', () => {
  const start = source.indexOf('const tabLayout = overflowTabs(');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 9800);
  /* A coloured tab that arrives from the `»` list must still show its colour. */
  assert.match(block, /swatch: colors\[terminal\.id\]/);
  /* The terminal screen menu is built from the tab's own id, so the colour has
     to come from the same map the strip reads. */
  assert.match(source, /colors\[terminal\.id\] === undefined/);
});

test('a menu swatch renders as a small coloured square before the label', () => {
  const menuStart = source.indexOf('function ContextMenu({');
  assert.notEqual(menuStart, -1);
  const menu = source.slice(menuStart, source.indexOf('function splitChanges(', menuStart));
  assert.match(menu, /item\.swatch === undefined/);
  assert.match(menu, /styles\.menuSwatch, background: item\.swatch/);
  /* Menus without swatches must not gain an empty gutter. */
  assert.match(menu, /item\.swatch === undefined \|\| item\.swatch === null/);
});
