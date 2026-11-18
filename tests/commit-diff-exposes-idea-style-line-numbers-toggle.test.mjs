import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/diff/DiffPreview.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

function diffPreview() {
  return source.slice(source.indexOf('function DiffPreview('), source.indexOf('export { DiffPreview };'));
}

test('diff exposes an IDEA-style Show Line Numbers toggle', () => {
  const diff = diffPreview();
  assert.match(
    diff,
    /const \[showLineNumbers, setShowLineNumbers\] = React\.useState\(\s+\(\) => readStoredText\('dsh-editor\.diff\.showLineNumbers', '1'\) !== '0',\s+\)/u,
  );
  assert.match(diff, /lineNumbers: readStoredText\('dsh-editor\.diff\.showLineNumbers', '1'\) !== '0' \? 'on' : 'off'/);
  assert.match(diff, /diff\.updateOptions\(\{\s+lineNumbers: showLineNumbers \? 'on' : 'off',\s+\}\)/u);
  assert.match(diff, /id: 'lineNumbers'/);
  assert.match(diff, /shortcut: showLineNumbers \? '✓' : ''/);
  assert.match(diff, /run: \(\) => setShowLineNumbers\(\(value\) => !value\)/);
});

test('line number preference is workspace-independent and localised', () => {
  assert.match(diffPreview(), /window\.localStorage\.setItem\('dsh-editor\.diff\.showLineNumbers', showLineNumbers \? '1' : '0'\)/);
  assert.ok(source.includes("diffLineNumbers: '显示行号'"));
  assert.ok(source.includes("diffLineNumbers: 'Show Line Numbers'"));
});
