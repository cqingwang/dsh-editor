import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { menuSource } from './ui-sources.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'tests/fixtures/terminal-panel.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

test('the overflow menu carries the same colour stripe as the tab strip', () => {
  const start = source.indexOf('const tabLayout = overflowTabs(');
  assert.notEqual(start, -1);
  const end = source.indexOf('\n    function ', start + 1);
  assert.notEqual(end, -1);
  const block = source.slice(start, end);
  /* A coloured tab that arrives from the `»` list must still show its colour. */
  assert.match(block, /swatch: colors\[terminal\.id\]/);
  /* The terminal screen menu is built from the tab's own id, so the colour has
     to come from the same map the strip reads. */
  assert.match(source, /colors\[terminal\.id\] === undefined/);
});

test('a menu swatch renders as a small coloured square before the label', () => {
  assert.match(menuSource, /item\.swatch === undefined/);
  assert.match(menuSource, /styles\.menuSwatch,[\s\S]*?background: item\.swatch/);
  /* Menus without swatches must not gain an empty gutter. */
  assert.match(menuSource, /item\.swatch === undefined \|\| item\.swatch === null/);
});
