import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('the indent guides come BEFORE the chevron, so depth moves the arrow', () => {
  /* The guides were rendered after the chevron: every row's arrow sat at the same
     left edge and the hierarchy was only visible as trailing whitespace, so a nested
     folder looked like a sibling. */
  /* Anchor on the drop handler that ends the row's event props: the render follows. */
  const start = source.indexOf('onDrop(sources, row.path);');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 1200);
  const guidesAt = block.indexOf('styles.indentGuide');
  const chevronAt = block.indexOf('styles.chevron');
  assert.notEqual(guidesAt, -1, 'the indent guides must still be rendered');
  assert.notEqual(chevronAt, -1, 'the chevron must still be rendered');
  assert.ok(guidesAt < chevronAt, 'guides must precede the chevron');
});

test('a file row still reserves the chevron column', () => {
  /* Files get an invisible 12px chevron; without it their icon would sit one step
     left of the folders at the same depth. */
  const start = source.indexOf('onDrop(sources, row.path);');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 2200);
  /* The invisible chevron placeholder keeps the icon column aligned for files. */
  assert.match(block, /styles\.chevron, opacity: 0/);
});

test('the indent step matches the placeholder row', () => {
  /* `paddingLeft: 8 + row.depth * 14` for "(empty)" and the guide width must agree,
     or an empty folder's label sits at a different depth than its siblings. */
  const placeholder = /paddingLeft: 8 \+ row\.depth \* (\d+)/.exec(source);
  assert.notEqual(placeholder, null);
  const guide = /indentGuide: \{[\s\S]*?width: (\d+)/.exec(source);
  assert.notEqual(guide, null);
  assert.equal(Number(placeholder[1]), Number(guide[1]), 'indent step and guide width must match');
});
