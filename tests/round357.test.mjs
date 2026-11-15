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

test('diff exposes an IDEA-style Show Indent Guides toggle on both editors', () => {
  const diff = diffPreview();
  assert.match(diff, /const \[showIndentGuides, setShowIndentGuides\] = React\.useState\(\(\) => readStoredText\('dsh-editor\.diff\.showIndentGuides', '0'\) === '1'\)/);
  assert.match(diff, /guides: \{ indentation: readStoredText\('dsh-editor\.diff\.showIndentGuides', '0'\) === '1' \}/);
  assert.match(diff, /original\?\.updateOptions\(\{ guides: \{ indentation: showIndentGuides \} \}\)/);
  assert.match(diff, /modified\?\.updateOptions\(\{ guides: \{ indentation: showIndentGuides \} \}\)/);
  assert.match(diff, /id: 'indentGuides'/);
  assert.match(diff, /shortcut: showIndentGuides \? '✓' : ''/);
  assert.match(diff, /run: \(\) => setShowIndentGuides\(\(value\) => !value\)/);
});

test('indent-guide preference is independent and localised', () => {
  const diff = diffPreview();
  assert.match(diff, /window\.localStorage\.setItem\('dsh-editor\.diff\.showIndentGuides', showIndentGuides \? '1' : '0'\)/);
  assert.match(diff, /window\.localStorage\.setItem\('dsh-editor\.diff\.softWrap', softWrap \? '1' : '0'\)/);
  assert.ok(source.includes("diffIndentGuides: '显示缩进参考线'"));
  assert.ok(source.includes("diffIndentGuides: 'Show Indent Guides'"));
});
