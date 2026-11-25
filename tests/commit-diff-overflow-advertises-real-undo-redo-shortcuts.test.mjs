import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/diff/DiffPreview.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

test('Diff overflow advertises the real undo and redo shortcuts', () => {
  assert.match(
    source,
    /id: 'undo',\s+icon: 'undo',\s+label: t\('editor\.diffUndoRestore'\),\s+group: 'history',\s+shortcut: '⌘Z',\s+disabled: editLocked \|\| diffUnavailable \|\| !canUndo,\s+run: undoRestore/u,
  );
  assert.match(
    source,
    /id: 'redo',\s+icon: 'redo',\s+label: t\('editor\.diffRedoRestore'\),\s+group: 'history',\s+shortcut: '⇧⌘Z',\s+disabled: editLocked \|\| diffUnavailable \|\| !canRedo,\s+run: redoRestore/u,
  );
});
