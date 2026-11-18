import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'tests/fixtures/diff-preview.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

function diffKeyboardHandler() {
  const start = source.indexOf('const onKeyDown = (event) => {', source.indexOf('function DiffPreview('));
  assert.notEqual(start, -1);
  const end = source.indexOf('window.addEventListener(\'keydown\', onKeyDown, true);', start);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('diff shortcuts yield to Terminal, trees and other interactive controls', () => {
  const handler = diffKeyboardHandler();
  assert.match(handler, /const shortcutTarget = event\.target instanceof Element \? event\.target : null;/);
  assert.match(handler, /const insideDiffPane = shortcutTarget\?\.closest\('\.dsh-editor-diff-pane'\) !== null;/);
  assert.match(
    handler,
    /const foreignKeyboardSurface = shortcutTarget\?\.closest\('\[data-dsh-editor-terminal\], \[role="tree"\], input, textarea, select, \[contenteditable="true"\]'\) !== null;/,
  );
  assert.match(handler, /if \(!insideDiffPane && foreignKeyboardSurface\) return;/);
});

test('the foreign-surface gate runs before any diff shortcut prevents the event', () => {
  const handler = diffKeyboardHandler();
  const gate = handler.indexOf('if (!insideDiffPane && foreignKeyboardSurface) return;');
  const firstPrevent = handler.indexOf('event.preventDefault();');
  assert.notEqual(gate, -1);
  assert.notEqual(firstPrevent, -1);
  assert.ok(gate < firstPrevent, 'the gate must precede the first preventDefault');
});

test('diff undo, redo, close and F7 keep using the same guarded target', () => {
  const handler = diffKeyboardHandler();
  assert.ok((handler.match(/shortcutTarget\?\.closest\('input, textarea\[data-dsh-diff-find\], \[contenteditable="true"\]'\)/g) ?? []).length >= 3);
  assert.match(handler, /if \(event\.key !== 'F7'\) return;[\s\S]*?event\.preventDefault\(\);[\s\S]*?walkHunk\(event\.shiftKey \? 'previous' : 'next'\);/);
});
