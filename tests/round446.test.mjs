import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('Project Select Opened File exposes its IDEA chord to assistive technology', () => {
  assert.match(source, /function ToolbarButton\(\{[\s\S]*?ariaKeyShortcuts = undefined,/);
  assert.match(source, /'aria-keyshortcuts': ariaKeyShortcuts,/);
  assert.match(source, /ariaKeyShortcuts: action\.ariaKeyShortcuts,/);
  assert.match(source, /id: 'reveal',[\s\S]*?label: t\('editor\.reveal'\),[\s\S]*?disabled: hasActiveFile !== true,[\s\S]*?ariaKeyShortcuts: 'Alt\+F1 1',[\s\S]*?onClick: onReveal,/);
});

test('Project Select Opened File keeps the same disabled semantics as the chord', () => {
  const start = source.indexOf("id: 'reveal'");
  const action = source.slice(start, start + 800);
  assert.match(action, /disabled: hasActiveFile !== true/);
  assert.match(action, /ariaKeyShortcuts: 'Alt\+F1 1'/);
});
