import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/diff/DiffPreview.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

function diffPreview() {
  return source.slice(source.indexOf('function DiffPreview('), source.indexOf('export { DiffPreview };'));
}

function diffKeyboardHandler() {
  const diff = diffPreview();
  const start = diff.indexOf('const onKeyDown = (event) => {');
  assert.notEqual(start, -1);
  const end = diff.indexOf("window.addEventListener('keydown', onKeyDown, true);", start);
  assert.notEqual(end, -1);
  return diff.slice(start, end);
}

test('one diff target issues exactly one git request', () => {
  const requests = source.match(/callGit\(request, \{\s+signal: diffAbort\.signal,\s+\}\)/g) ?? [];
  assert.equal(requests.length, 1);
  assert.match(diffPreview(), /callGit\(request, \{\s+signal: diffAbort\.signal,\s+\}\)\s+\.then\(\(value\) => \{/u);
});

test('read-only diffs never claim the block undo or redo shortcuts', () => {
  const handler = diffKeyboardHandler();
  assert.match(handler, /const editableHistory = diffReadOnly === false && editLocked === false;/);
  assert.match(
    handler,
    /if \(\s+editableHistory &&\s+\(event\.metaKey \|\| event\.ctrlKey\) &&[\s\S]*?undoRestore\(\);/u,
  );
  assert.match(handler, /if \(\s*editableHistory &&[\s\S]*?redoRestore\(\);/);
});

test('read-only diffs keep search, hunk navigation and close shortcuts', () => {
  const handler = diffKeyboardHandler();
  assert.match(handler, /searchInChanges\(\);/);
  assert.match(handler, /walkHunk\(event\.shiftKey \? 'previous' : 'next'\);/);
  assert.match(handler, /onClose\(\);/);
});

test('Monaco disables writable restore controls for comparison targets', () => {
  const diff = diffPreview();
  assert.match(
    diff,
    /const writable =\s+typeof target\.clipboardText !== 'string' &&\s+typeof target\.revision !== 'string' &&\s+typeof target\.commit !== 'string';/u,
  );
  assert.match(diff, /const canEdit = diffEditingEnabled\(\{[\s\S]*?writable,[\s\S]*?swapped: swapSidesRef\.current,[\s\S]*?locked: editLockedRef\.current,/);
  assert.match(diff, /readOnly: canEdit === false,[\s\S]*?renderMarginRevertIcon: canEdit,/);
  assert.match(diff, /\.\.\.\(diffReadOnly === false && swapSides === false\s+\? \[[\s\S]*?id: 'undo'[\s\S]*?id: 'redo'/);
});
