import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'tests/fixtures/diff-preview.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

/**
 * The whole DiffPreview function, independent of its current length.
 *
 * This used to be `slice(start, start + 6000)`; each feature enlarged the
 * function until the cleanup fell outside the window and three unrelated
 * assertions failed. Slice to the next declaration instead.
 * @returns {string} the component source.
 */
function diffPreviewSource() {
  const start = source.indexOf('function DiffPreview({');
  assert.notEqual(start, -1);
  const next = source.indexOf('* Commit tool window: grouped', start);
  assert.notEqual(next, -1);
  return source.slice(start, next);
}

test('the diff pane detaches the old models before disposing them', () => {
  /* Directly disposing a model the diff editor still holds logs
     "TextModel got disposed before DiffEditorWidget model got reset" and leaves the
     widget briefly pointing at dead models. Clearing the editor first is the
     documented order. */
  const block = diffPreviewSource();
  assert.match(block, /diff\.setModel\(null\);\n\s+if \(previous\?\.modified\?\.__dshRestoreListener != null\)/);
  assert.match(block, /previous\?\.original\?\.dispose\?\.\(\);/);
});

test('the unmount path also detaches before disposing', () => {
  const block = diffPreviewSource();
  assert.match(block, /diff\.setModel\(null\);/);
  /* The cleanup runs on unmount, where the widget is still alive. */
  assert.match(block, /diff\.dispose\(\);/);
});

test('the unmount cleanup detaches before disposing too', () => {
  /* The warning fired on the unmount path as well as the swap path; both need
     `setModel(null)` first. */
  const block = diffPreviewSource();
  const cleanup = block.slice(block.indexOf('return () => {'), block.indexOf('}, [monacoReady]);'));
  assert.match(cleanup, /diff\.setModel\(null\);/);
  assert.match(cleanup, /models\?\.original\?\.dispose\?\.\(\);/);
});
