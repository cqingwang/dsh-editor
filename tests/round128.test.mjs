import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('the row renders indent, chevron, icon, then name', () => {
  /* Round 131 dropped the git letter from the tree entirely (IDEA tints the name),
     so the order that matters is the one that keeps the icon column aligned. */
  const start = source.indexOf('row.depth > 0');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 4200);
  const guideAt = block.indexOf('styles.indentGuide');
  const iconAt = block.indexOf('React.createElement(EntryIcon');
  const nameAt = block.indexOf('...styles.treeName,');
  assert.notEqual(guideAt, -1, 'the indent guides must be rendered');
  assert.notEqual(iconAt, -1, 'the entry icon is the position reference');
  assert.notEqual(nameAt, -1, 'the name span is the position reference');
  assert.ok(guideAt < iconAt, 'the guides precede the icon');
  assert.ok(iconAt < nameAt, 'the icon precedes the name');
});

test('the chat column reserves room for the composer', () => {
  /* A sticky composer overlays the last lines: "深度搜索中，用时 3 秒" ended up behind
     the input box. The scroller needs bottom padding equal to the composer height. */
  assert.match(source, /padding-bottom: \d+px !important;/);
});
