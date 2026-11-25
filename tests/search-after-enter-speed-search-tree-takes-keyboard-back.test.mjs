import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/client/components/project/ProjectPanel.tsx'), 'utf8');

test('after Enter in speed search a file hit hands the keyboard to the editor', () => {
  /* IDEA's speed search is a navigation tool: a file hit is EditSource, so the
     editor owns the keyboard after the file opens. A directory hit stays in the
     tree because expansion and arrow navigation continue from that row. */
  const start = source.indexOf('const hit = hits.find');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 2600);
  assert.match(block, /onOpenEditSource\(hit\.path\)/u);
  assert.doesNotMatch(block, /onOpen\(hit\.path\)/u);
  assert.match(block, /if \(!opened\) window\.setTimeout\(\(\) => treeRef\.current\?\.focus\(\), 0\)/u);
  assert.match(block, /if \(focusTree\) window\.setTimeout\(\(\) => treeRef\.current\?\.focus\(\), 0\)/u);
  assert.match(block, /if \(action === 'expand'\) onToggle\(hit\.path\)/u);
});
