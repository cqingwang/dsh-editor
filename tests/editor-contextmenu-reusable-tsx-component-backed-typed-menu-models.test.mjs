import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('ContextMenu is a reusable TSX component backed by typed menu models', async () => {
  const menu = await read('src/client/components/ui/Menu.tsx');
  const model = await read('src/client/components/ui/menu-model.ts');
  const barrel = await read('src/client/components/ui/index.tsx');

  assert.match(menu, /export function ContextMenu\(/u);
  assert.match(menu, /return \(\s*<div/u);
  assert.doesNotMatch(menu, /React\.createElement/u);
  for (const name of ['submenuKeyAction', 'menuStep', 'submenuGeometry', 'submenuSide']) {
    assert.match(model, new RegExp(`export function ${name}\\(`, 'u'));
  }
  assert.match(barrel, /export \{ ContextMenu/u);
  assert.match(barrel, /menuStep,/u);
});
