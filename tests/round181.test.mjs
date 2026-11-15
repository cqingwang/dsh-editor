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

test('the diff uses Monaco hideUnchangedRegions with IDEA-like context', () => {
  const diff = diffPreview();
  assert.match(diff, /const \[collapseUnchanged, setCollapseUnchanged\] = React\.useState/);
  assert.match(diff, /hideUnchangedRegions: \{/);
  assert.match(diff, /minimumLineCount: 4/);
  assert.match(diff, /contextLineCount: 2/);
  assert.match(diff, /revealLineCount: 10/);
  assert.match(diff, /dsh-editor\.diff\.collapseUnchanged/);
});

test('the diff toolbar toggles unchanged regions and persists the choice', () => {
  const diff = diffPreview();
  assert.match(diff, /label: collapseUnchanged \? t\('editor\.diffShowUnchanged'\) : t\('editor\.diffCollapseUnchanged'\)/);
  assert.match(diff, /run: \(\) => setCollapseUnchanged\(\(value\) => !value\)/);
  assert.match(diff, /localStorage\.setItem\('dsh-editor\.diff\.collapseUnchanged', collapseUnchanged \? '1' : '0'\)/);
  assert.match(source, /diffCollapseUnchanged: '折叠未修改区域'/);
  assert.match(source, /diffShowUnchanged: '展开未修改区域'/);
});

test('side-by-side and unchanged-region preferences remain independent', () => {
  const diff = diffPreview();
  assert.match(diff, /dsh-editor\.diff\.sideBySide/);
  assert.match(diff, /dsh-editor\.diff\.collapseUnchanged/);
  assert.match(diff, /diff\.updateOptions\(\{ renderSideBySide: sideBySide \}\)/);
  assert.match(diff, /diff\.updateOptions\(\{[\s\S]*?hideUnchangedRegions/);
});
