import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('./fixtures/diff-preview.legacy.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const diff = source.slice(source.indexOf('function DiffPreview('), source.indexOf('* Commit tool window: grouped'));

test('the Diff overflow builder is shared by click and keyboard entry points', () => {
  assert.match(diff, /const openDiffActionMenu = \(rect\) => \{/);
  const calls = diff.match(/openDiffActionMenu\(event\.currentTarget\.getBoundingClientRect\(\)\)/g) ?? [];
  assert.ok(calls.length >= 3, `click, Shift+F10 and ContextMenu must share the builder; found ${calls.length}`);
  assert.match(diff, /event\.key === 'ContextMenu' \|\| \(event\.shiftKey === true && event\.key === 'F10'\)/);
  assert.match(diff, /onContextMenu: \(event\) => \{/);
});

test('the Diff overflow opener exposes popup and expanded state', () => {
  assert.match(diff, /ariaHasPopup: 'menu'/);
  assert.match(diff, /ariaExpanded: diffActionMenu !== null/);
});

test('Diff overflow toggle items retain checkbox semantics', () => {
  assert.match(diff, /shortcut: action\.shortcut \?\? \(action\.active === true \? '✓' : ''\)/);
  assert.match(diff, /active: typeof action\.active === 'boolean' \? action\.active : undefined/);
});
