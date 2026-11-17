import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function diffPreview() {
  return source.slice(source.indexOf('function DiffPreview('), source.indexOf('* Commit tool window: grouped'));
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
  const requests = source.match(/callGit\(request, \{ signal: diffAbort\.signal \}\)/g) ?? [];
  assert.equal(requests.length, 1);
  assert.match(diffPreview(), /callGit\(request, \{ signal: diffAbort\.signal \}\)\s+\.then\(\(value\) => \{/);
});

test('read-only diffs never claim the block undo or redo shortcuts', () => {
  const handler = diffKeyboardHandler();
  assert.match(handler, /const editableHistory = diffReadOnly === false && editLocked === false;/);
  assert.match(handler, /if \(editableHistory && \(event\.metaKey \|\| event\.ctrlKey\)[^]*?undoRestore\(\);/);
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
  assert.match(diff, /const writable = typeof target\.clipboardText !== 'string' && typeof target\.revision !== 'string' && typeof target\.commit !== 'string';/);
  assert.match(diff, /const canEdit = diffEditingEnabled\(\{[\s\S]*?writable,[\s\S]*?swapped: swapSidesRef\.current,[\s\S]*?locked: editLockedRef\.current,/);
  assert.match(diff, /readOnly: canEdit === false,[\s\S]*?renderMarginRevertIcon: canEdit,/);
  assert.match(diff, /\.\.\.\(diffReadOnly === false && swapSides === false\s+\? \[[\s\S]*?id: 'undo'[\s\S]*?id: 'redo'/);
});
