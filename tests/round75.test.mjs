import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('⌘1..⌘9 switches the tab of the FOCUSED pane, not always the left one', () => {
  /* With a split open, ⌘2 in the right pane used to swap the left pane's tab and
     leave the caret in the right one: the visible change happened somewhere else. */
  const start = source.indexOf("/* IDEA switches terminal tabs with ⌘1–⌘9");
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 1800);
  assert.match(block, /focusedPaneRef\.current === 'right'/);
  assert.match(block, /setSplitId\(target\.id\)/);
});

test('switching a pane to its own current tab is a no-op, not a double stream', () => {
  const start = source.indexOf("/* IDEA switches terminal tabs with ⌘1–⌘9");
  const block = source.slice(start, start + 1400);
  /* Binding the same terminal to both panes would open two streams on one PTY. */
  assert.match(block, /if \(target\.id === splitIdRef\.current\) return;/);
});

test('picking the other pane\'s terminal swaps the panes instead of collapsing the split', () => {
  /* Two panes bound to one id trips the guard that hides a doubled stream, so the
     dock closed and the shortcut looked like it "lost" the split. */
  const start = source.indexOf("/* IDEA switches terminal tabs with ⌘1–⌘9");
  const block = source.slice(start, start + 1600);
  assert.match(block, /if \(target\.id === activeRef\.current\) \{/);
  assert.match(block, /setActiveId\(splitIdRef\.current\);/);
  assert.match(block, /setSplitId\(target\.id\);/);
});
