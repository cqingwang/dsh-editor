import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('deleting a directory names the unsaved files it will take with it', () => {
  const start = source.indexOf('const removeEntry = React.useCallback(');
  assert.notEqual(start, -1);
  const block = source.slice(start, source.indexOf('const checkExternalChanges', start));
  /* IDEA's delete dialog lists the affected dirty tabs before it asks. */
  assert.match(block, /const unsaved = dirtyUnder\(row\.path\);/);
  assert.ok(block.includes("t('editor.deleteDirty', { count: unsaved.length, files: unsaved.join(', ') })"), 'the delete warning must name the files');
});

test('batch delete names the dirty files too', () => {
  const start = source.indexOf('const removeEntries = React.useCallback(');
  assert.notEqual(start, -1);
  const block = source.slice(start, source.indexOf('const removeEntry = React.useCallback(', start));
  assert.match(block, /dirtyUnder\(/);
  assert.match(block, /t\('editor\.deleteDirty', \{ count: /);
});

test('the helper collects unsaved tabs under one path, not the whole dock', () => {
  const start = source.indexOf('const dirtyUnder = React.useCallback(');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 700);
  assert.match(block, /file\.dirty === true/);
  assert.match(block, /file\.path === path \|\| file\.path\.startsWith\(`\$\{path\}\/`\)/);
});

test('both dictionaries carry the warning', () => {
  assert.equal(source.split('deleteDirty:').length - 1, 2);
});
