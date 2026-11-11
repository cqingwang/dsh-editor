import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('the diff pane detaches the old models before disposing them', () => {
  /* Directly disposing a model the diff editor still holds logs
     "TextModel got disposed before DiffEditorWidget model got reset" and leaves the
     widget briefly pointing at dead models. Clearing the editor first is the
     documented order. */
  const start = source.indexOf('function DiffPreview({ t, target, monacoReady, onClose })');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 6000);
  assert.match(block, /diff\.setModel\(null\);\n\s+previous\?\.original\?\.dispose\(\);/);
});

test('the unmount path also detaches before disposing', () => {
  const start = source.indexOf('function DiffPreview({ t, target, monacoReady, onClose })');
  const block = source.slice(start, start + 6000);
  assert.match(block, /diff\.setModel\(null\);/);
  /* The cleanup runs on unmount, where the widget is still alive. */
  assert.match(block, /diff\.dispose\(\);/);
});

test('the unmount cleanup detaches before disposing too', () => {
  /* The warning fired on the unmount path as well as the swap path; both need
     `setModel(null)` first. */
  const start = source.indexOf('function DiffPreview({ t, target, monacoReady, onClose })');
  const block = source.slice(start, start + 6000);
  const cleanup = block.slice(block.indexOf('return () => {'), block.indexOf('}, [monacoReady]);'));
  assert.match(cleanup, /diff\.setModel\(null\);/);
  assert.match(cleanup, /models\?\.original\?\.dispose\(\);/);
});
