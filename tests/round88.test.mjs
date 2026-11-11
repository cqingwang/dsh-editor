import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('the menu advertises ⌥⌘Z, so the key must actually work', () => {
  /* The item has shown the shortcut since round 81, but nothing listened for it:
     a shortcut that is printed but dead is worse than no hint. */
  assert.match(source, /t\('editor\.rollbackWorking'\), shortcut: '⌥⌘Z'/);
  assert.match(source, /if \(!event\.altKey \|\| !meta \|\| event\.shiftKey \|\| event\.key\.toLowerCase\(\) !== 'z'\) return;/);
});

test('the shortcut acts on the change under the editor, not on an arbitrary row', () => {
  const start = source.indexOf("event.key.toLowerCase() !== 'z'");
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 1200);
  assert.match(block, /rollbackWorkingShortcut/);
});

test('an open text field keeps the key for itself', () => {
  const start = source.indexOf('const rollbackWorkingShortcut = React.useCallback(');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 900);
  assert.match(block, /closest\('input, textarea, \[contenteditable="true"\]'\)/);
  assert.match(block, /closest\('\.monaco-editor'\)/);
});
