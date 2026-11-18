import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/project/ProjectPanel.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

test('Enter in speed search opens the hit, not just highlights it', () => {
  /* IDEA's speed search is a navigation tool: typing then Enter must take you to
     the file. Selecting the row and stopping there leaves the editor unchanged. */
  const start = source.indexOf("else if (event.key === 'Enter')");
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 1300);
  assert.match(block, /const hit = hits\.find\(\(row\) => row\.path === selectedPath\) \?\? hits\[0\]/);
  assert.match(block, /onSelect\(hit, \{\}\);/);
  assert.match(block, /setSearchOpen\(false\);/);
  assert.match(block, /revealInTree\(\{\s+\.\.\.hit,\s+open: expanded\.has\(hit\.path\),\s+\}\)/);
  assert.match(block, /action === 'open'\) onOpen\(hit\.path\)/);
});
