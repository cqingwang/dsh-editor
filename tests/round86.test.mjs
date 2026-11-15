import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('a menu item can open a submenu', () => {
  /* IDEA nests "Rollback" under one entry with two choices; two flat siblings read
     like two unrelated destructive actions. */
  const start = source.indexOf('function ContextMenu({ menu, onClose, t })');
  assert.notEqual(start, -1);
  const end = source.indexOf('function groupDiffToolbarActions(', start);
  assert.notEqual(end, -1);
  const block = source.slice(start, end);
  assert.match(block, /Array\.isArray\(item\.items\) && item\.items\.length > 0/);
  assert.match(block, /setSubmenu\(/);
  /* Round 90 added the parent-item measurement inside the same handler. */
  assert.match(block, /onMouseEnter: \(event\) => \{[\s\S]{0,400}?setSubmenu\(/);
});

test('the parent item shows a chevron instead of a shortcut', () => {
  const start = source.indexOf('function ContextMenu({ menu, onClose, t })');
  const block = source.slice(start, start + 12000);
  assert.match(block, /'›'/);
});

test('the change menu nests both discards under one Rollback entry', () => {
  const start = source.indexOf('const buildChangeMenu = React.useCallback(');
  assert.notEqual(start, -1);
  const end = source.indexOf('const buildChangeDirMenu = React.useCallback(', start);
  assert.notEqual(end, -1);
  const block = source.slice(start, end);
  assert.match(block, /t\('editor\.rollback'\)/);
  assert.match(block, /items: \[/);
  /* The two actions keep their distinct labels and payloads. */
  assert.match(block, /rollbackStaged/);
  assert.match(block, /rollbackWorking/);
});
