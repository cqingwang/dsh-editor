import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'tests/fixtures/diff-preview.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));
const iconSource = readFileSync(join(root, 'src/client/components/ui/Icon.tsx'), 'utf8');

test('Diff stores IDEA Show Whitespaces off by default', () => {
  assert.match(source, /diffShowWhitespaces: '显示空白字符',/);
  assert.match(source, /diffShowWhitespaces: 'Show whitespaces',/);
  assert.match(
    source,
    /const \[showWhitespaces, setShowWhitespaces\] = React\.useState\(\(\) => readStoredText\('dsh-editor\.diff\.showWhitespaces', '0'\) === '1'\);/,
  );
});

test('Monaco renders all whitespace only while the toggle is active', () => {
  assert.match(source, /renderWhitespace: readStoredText\('dsh-editor\.diff\.showWhitespaces', '0'\) === '1' \? 'all' : 'none',/);
  assert.match(source, /const original = diff\.getOriginalEditor\?\.\(\);/);
  assert.match(source, /const modified = diff\.getModifiedEditor\?\.\(\);/);
  assert.match(source, /original\?\.updateOptions\(\{ renderWhitespace \}\);/);
  assert.match(source, /modified\?\.updateOptions\(\{ renderWhitespace \}\);/);
  assert.match(source, /window\.localStorage\.setItem\('dsh-editor\.diff\.showWhitespaces', showWhitespaces \? '1' : '0'\)/);
});

test('the Diff Settings submenu exposes an independent whitespace rendering toggle', () => {
  assert.match(
    source,
    /id: 'showWhitespaces',\s+icon: 'whitespace',\s+label: t\('editor\.diffShowWhitespaces'\),\s+shortcut: showWhitespaces \? '✓' : '',/,
  );
  assert.match(iconSource, /case 'whitespace':/);
});
