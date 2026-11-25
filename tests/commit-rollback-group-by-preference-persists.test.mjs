import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dialogSource = readFileSync(join(root, 'src/client/components/commit/rollback-confirmation.ts'), 'utf8');

function loadPreferenceFunctions() {
  const readCode = transpileTypeScriptFunction(dialogSource, 'readRollbackDialogGroupByDirectory');
  const writeCode = transpileTypeScriptFunction(dialogSource, 'writeRollbackDialogGroupByDirectory');
  return new Function(
    `${readCode}\n${writeCode}\nreturn { readRollbackDialogGroupByDirectory, writeRollbackDialogGroupByDirectory };`,
  )();
}

test('Rollback directory grouping preference survives dialog reopen', () => {
  const values = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  };
  try {
    const { readRollbackDialogGroupByDirectory, writeRollbackDialogGroupByDirectory } = loadPreferenceFunctions();
    assert.equal(readRollbackDialogGroupByDirectory(), false);
    writeRollbackDialogGroupByDirectory(true);
    assert.equal(readRollbackDialogGroupByDirectory(), true);
    writeRollbackDialogGroupByDirectory(false);
    assert.equal(readRollbackDialogGroupByDirectory(), false);
  } finally {
    delete globalThis.window;
  }
});

test('Rollback dialog reads and writes the directory grouping preference', () => {
  assert.match(dialogSource, /initial\.groupByDirectory \?\? readRollbackDialogGroupByDirectory\(\)/u);
  assert.match(dialogSource, /writeRollbackDialogGroupByDirectory\(groupByDirectory\)/u);
});
