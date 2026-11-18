import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Parse one shipping file with Node, without executing it.
 *
 * Every other test in this suite asserts on SOURCE TEXT, so a file with an
 * unbalanced brace still "passes" everywhere and only fails in the browser — the
 * whole plugin fails to import and the UI shows "Failed to load plugins". Round
 * 144 hit exactly that: an edit ate a block-comment terminator and left
 * client.js unparseable while 580 tests were green. `--check` parses without
 * running, so it catches that class of damage here instead of at runtime.
 * @param {string} file - path relative to the package root.
 * @returns {void} throws when the file has a syntax error.
 */
function assertParses(file) {
  const path = join(root, file);
  /* Non-empty first: `node --check` on a missing/empty file would pass trivially. */
  assert.ok(readFileSync(path, 'utf8').length > 1000, `${file} looks empty`);
  try {
    execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' });
  } catch (error) {
    throw new Error(`${file} does not parse: ${error.stderr?.toString() ?? error.message}`);
  }
}

test('the browser bundle parses', () => {
  assertParses('lib/client.js');
});

test('the host bundle parses', () => {
  assertParses('lib/index.js');
});

test('the terminal hub parses', () => {
  assertParses('lib/terminal.js');
});

test('the locale files are valid JSON', () => {
  for (const file of ['locale/zh.json', 'locale/en.json']) {
    const value = JSON.parse(readFileSync(join(root, file), 'utf8'));
    assert.ok(value !== null && typeof value === 'object', `${file} must hold an object`);
  }
});
