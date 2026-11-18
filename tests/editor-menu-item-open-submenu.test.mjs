import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/ui/Menu.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

test('a menu item can open a submenu', () => {
  /* IDEA nests "Rollback" under one entry with two choices; two flat siblings read
     like two unrelated destructive actions. */
  const start = source.indexOf('export function ContextMenu(');
  assert.notEqual(start, -1);
  const end = source.indexOf('export { ContextMenu };', start);
  const block = end < 0 ? source.slice(start) : source.slice(start, end);
  assert.match(block, /Array\.isArray\(item\.items\) && item\.items\.length > 0/);
  assert.match(block, /setSubmenu\(/);
  /* Round 90 added the parent-item measurement inside the same handler. */
  assert.match(block, /onMouseEnter=\{\(event\) => \{[\s\S]{0,500}?setSubmenu\(/);
});

test('the parent item shows a chevron instead of a shortcut', () => {
  const start = source.indexOf('export function ContextMenu(');
  const block = source.slice(start, start + 12000);
  assert.match(block, />\s+›\s+<\/span>/);
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
