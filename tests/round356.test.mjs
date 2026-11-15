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

test('diff exposes an IDEA-style Soft-Wrap toggle on both editors', () => {
  const diff = diffPreview();
  assert.match(diff, /const \[softWrap, setSoftWrap\] = React\.useState\(\(\) => readStoredText\('dsh-editor\.diff\.softWrap', '0'\) === '1'\)/);
  assert.match(diff, /wordWrap: readStoredText\('dsh-editor\.diff\.softWrap', '0'\) === '1' \? 'on' : 'off'/);
  assert.match(diff, /original\?\.updateOptions\(\{ wordWrap: softWrap \? 'on' : 'off' \}\)/);
  assert.match(diff, /modified\?\.updateOptions\(\{ wordWrap: softWrap \? 'on' : 'off' \}\)/);
  assert.match(diff, /id: 'softWrap'/);
  assert.match(diff, /shortcut: softWrap \? '✓' : ''/);
  assert.match(diff, /run: \(\) => setSoftWrap\(\(value\) => !value\)/);
});

test('soft-wrap preference is independent from line numbers', () => {
  const diff = diffPreview();
  assert.match(diff, /window\.localStorage\.setItem\('dsh-editor\.diff\.softWrap', softWrap \? '1' : '0'\)/);
  assert.match(diff, /window\.localStorage\.setItem\('dsh-editor\.diff\.showLineNumbers', showLineNumbers \? '1' : '0'\)/);
  assert.ok(source.includes("diffSoftWrap: '自动换行'"));
  assert.ok(source.includes("diffSoftWrap: 'Soft-Wrap'"));
});
