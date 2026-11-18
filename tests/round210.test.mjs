import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'tests/fixtures/diff-preview.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

test('Diff stores IDEA Ignore Whitespaces off by default', () => {
  assert.match(source, /diffIgnoreWhitespace: '忽略空白差异',/);
  assert.match(source, /diffIgnoreWhitespace: 'Ignore whitespaces',/);
  assert.match(
    source,
    /const \[ignoreWhitespace, setIgnoreWhitespace\] = React\.useState\(\(\) => readStoredText\('dsh-editor\.diff\.ignoreWhitespace', '0'\) === '1'\);/,
  );
});

test('Monaco receives and updates ignoreTrimWhitespace', () => {
  assert.match(source, /ignoreTrimWhitespace: readStoredText\('dsh-editor\.diff\.ignoreWhitespace', '0'\) === '1',/);
  assert.match(source, /diff\.updateOptions\(\{ ignoreTrimWhitespace: ignoreWhitespace \}\);/);
  assert.match(source, /window\.localStorage\.setItem\('dsh-editor\.diff\.ignoreWhitespace', ignoreWhitespace \? '1' : '0'\)/);
});

test('the Diff Settings submenu exposes an active ignore-whitespace toggle', () => {
  assert.match(
    source,
    /id: 'whitespace',\s+icon: 'ignore',\s+label: t\('editor\.diffIgnoreWhitespace'\),\s+shortcut: ignoreWhitespace \? '✓' : '',/,
  );
});
