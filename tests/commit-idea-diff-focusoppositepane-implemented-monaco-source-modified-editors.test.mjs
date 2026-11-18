import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'tests/fixtures/diff-preview.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

function diffPreview() {
  return source.slice(source.indexOf('function DiffPreview('), source.indexOf('* Commit tool window: grouped'));
}

test('IDEA Diff.FocusOppositePane is implemented with Monaco source/modified editors', () => {
  const diff = diffPreview();
  assert.match(diff, /const focusOppositeDiffPane = React\.useCallback\(\(\) => \{/);
  assert.match(diff, /diffRef\.current\?\.getOriginalEditor\?\.\(\)/);
  assert.match(diff, /diffRef\.current\?\.getModifiedEditor\?\.\(\)/);
  assert.match(diff, /getDomNode\?\.\(\)/);
  assert.match(diff, /focusOppositeDiffPane\(\);/);
});

test('⌃⇧Tab is claimed only inside the diff surface', () => {
  const diff = diffPreview();
  const start = diff.indexOf('const onKeyDown = (event) => {');
  const end = diff.indexOf("window.addEventListener('keydown', onKeyDown, true);", start);
  const handler = diff.slice(start, end);
  assert.match(
    handler,
    /insideDiffPane[\s\S]*?event\.ctrlKey[\s\S]*?event\.shiftKey[\s\S]*?event\.key === 'Tab'[\s\S]*?focusOppositeDiffPane\(\);/,
  );
});

test('side-by-side diff advertises Focus Opposite Pane as a toolbar action', () => {
  const diff = diffPreview();
  assert.match(
    diff,
    /sideBySide[\s\S]*?id: 'focusOppositePane'[\s\S]*?icon: 'switchPane'[\s\S]*?label: t\('editor\.diffFocusOppositePane'\)[\s\S]*?shortcut: '⌃⇧⇥'[\s\S]*?run: focusOppositeDiffPane/,
  );
  assert.ok(source.split('diffFocusOppositePane:').length - 1 >= 2);
});
