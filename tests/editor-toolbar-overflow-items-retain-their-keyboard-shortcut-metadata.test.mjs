import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { compactActionBarSource, panelToolbarSource } from './ui-sources.mjs';

const source = (await readFile(new URL('../src/client/components/ui/Menu.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

test('toolbar overflow items retain their keyboard shortcut metadata', () => {
  assert.match(panelToolbarSource, /run: \(\) => action\.onClick\(\),\s+ariaKeyShortcuts: action\.ariaKeyShortcuts,/);

  assert.match(compactActionBarSource, /run: \(\) => action\.onClick\(\),\s+ariaKeyShortcuts: action\.ariaKeyShortcuts,/);
  assert.match(compactActionBarSource, /onClick=\{action\.onClick\}[\s\S]*?ariaKeyShortcuts=\{action\.ariaKeyShortcuts\}/);
});

test('ContextMenu exposes aria-keyshortcuts on top-level and submenu actions', () => {
  const menu = source;
  assert.equal(menu.match(/aria-keyshortcuts=\{item\.ariaKeyShortcuts\}/g)?.length, 1);
  assert.equal(menu.match(/aria-keyshortcuts=\{child\.ariaKeyShortcuts\}/g)?.length, 1);
});
