import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('Diff overflow advertises the real undo and redo shortcuts', () => {
  assert.match(source, /id: 'undo', icon: 'undo', label: t\('editor\.diffUndoRestore'\), group: 'history', shortcut: '⌘Z', disabled: editLocked \|\| diffUnavailable, run: undoRestore/);
  assert.match(source, /id: 'redo', icon: 'redo', label: t\('editor\.diffRedoRestore'\), group: 'history', shortcut: '⇧⌘Z', disabled: editLocked \|\| diffUnavailable, run: redoRestore/);
});
