import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { compactActionBarSource, panelToolbarSource } from './ui-sources.mjs';

const source = (await readFile(new URL('../src/client/components/ui/Menu.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

test('toolbar overflow preserves active state and a visible current marker', () => {
  assert.match(panelToolbarSource, /items: groupCompactActions\(hidden\)\.map/);
  assert.match(panelToolbarSource, /shortcut: action\.active === true \? '✓' : ''/);
  assert.match(panelToolbarSource, /active: typeof action\.active === 'boolean' \? action\.active : undefined/);

  assert.match(compactActionBarSource, /shortcut: action\.active === true \? '✓' : ''/);
  assert.match(compactActionBarSource, /active: typeof action\.active === 'boolean' \? action\.active : undefined/);

  assert.match(source, /shortcut: action\.shortcut \?\? \(action\.active === true \? '✓' : ''\)/);
  assert.match(source, /active: typeof action\.active === 'boolean' \? action\.active : undefined,/);
});

test('menu entries expose toggle state with menuitemcheckbox semantics', () => {
  const menu = source;
  assert.match(menu, /role=\{typeof item\.active === 'boolean' \? 'menuitemcheckbox' : 'menuitem'\}/);
  assert.match(menu, /aria-checked=\{typeof item\.active === 'boolean' \? item\.active : undefined\}/);
  assert.match(menu, /role=\{typeof child\.active === 'boolean' \? 'menuitemcheckbox' : 'menuitem'\}/);
  assert.match(menu, /aria-checked=\{typeof child\.active === 'boolean' \? child\.active : undefined\}/);
});

test('keyboard menu traversal targets all actionable menu roles', () => {
  const menu = source;
  assert.match(menu, /querySelectorAll<HTMLButtonElement>\('button\[data-menu-item-id\]:not\(:disabled\)'\)/);
  assert.match(menu, /closest<HTMLButtonElement>\('button\[data-menu-item-id\]'\)/);
});
