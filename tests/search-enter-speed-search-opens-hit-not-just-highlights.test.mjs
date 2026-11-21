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
  const start = source.indexOf('const keyAction = projectSpeedSearchKeyAction(event, hits.length)');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 3000);
  assert.match(block, /const hit = hits\.find\(\(row\) => row\.path === selectedPath\) \?\? hits\[0\]/);
  assert.match(block, /selectVisibleRow\(hit, \{\}\);/);
  assert.match(block, /setSearchOpen\(false\);/);
  assert.match(block, /revealInTree\(\{\s+\.\.\.hit,\s+open: expanded\.has\(hit\.path\),\s+\}\)/);
  assert.match(block, /action === 'open'\)\s*\{\s*onOpen\(hit\.path\);/u);
  assert.match(block, /onRevealPath\?\.\(hit\.path\);/u);
});

test('Enter in speed search leaves a folded file hit selected with its ancestors expanded', () => {
  const workspace = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
  const panel = readFileSync(join(root, 'src/client/components/project/ProjectPanel.tsx'), 'utf8');
  const start = panel.indexOf('const keyAction = projectSpeedSearchKeyAction(event, hits.length)');
  assert.notEqual(start, -1);
  const block = panel.slice(start, start + 3000);

  const openAt = block.indexOf('onOpen(hit.path);');
  const revealAt = block.indexOf('onRevealPath?.(hit.path);');
  assert.ok(openAt >= 0 && revealAt > openAt, 'the opened file must be revealed in the real tree');
  assert.match(workspace, /onRevealPath=\{revealInProjectTree\}/u);
});
