import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'tests/fixtures/diff-preview.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

function diffPreview() {
  return source.slice(source.indexOf('function DiffPreview('), source.indexOf('* Commit tool window: grouped'));
}

test('combined diff offers a toggle for all files', () => {
  const diff = diffPreview();
  assert.match(diff, /const allCombinedCollapsed = combinedFiles\.length > 0 && collapsedCombinedFiles\.size === combinedFiles\.length/);
  assert.match(diff, /const toggleAllCombinedFiles = React\.useCallback\(/);
  assert.match(diff, /new Set\(combinedFilesRef\.current\.map\(\(_, index\) => index\)\)/);
  assert.match(diff, /id: 'collapseAllCombinedFiles'/);
  assert.match(diff, /allCombinedCollapsed \? t\('editor\.expandAllCombinedFiles'\) : t\('editor\.collapseAllCombinedFiles'\)/);
  assert.ok(source.includes("collapseAllCombinedFiles: '折叠所有文件'"));
  assert.ok(source.includes("expandAllCombinedFiles: '展开所有文件'"));
  assert.ok(source.includes("collapseAllCombinedFiles: 'Collapse All Files'"));
  assert.ok(source.includes("expandAllCombinedFiles: 'Expand All Files'"));
});

test('Reload clears combined collapse and hidden-area state', () => {
  const diff = diffPreview();
  const reset = diff.slice(diff.indexOf('setCollapsedCombinedFiles(new Set());') - 500, diff.indexOf('}, [target, reloadGeneration]);', diff.indexOf('setCollapsedCombinedFiles(new Set());')) + 40);
  assert.match(reset, /setHiddenAreas\?\.\(\[\]\)/);
  assert.match(reset, /\}, \[target, reloadGeneration\]\);/);
});

test('all-file collapse updates the toolbar label and only disables without a model', () => {
  const diff = diffPreview();
  const action = diff.slice(diff.indexOf("id: 'collapseAllCombinedFiles'"), diff.indexOf("id: 'collapseCombinedFile'", diff.indexOf("id: 'collapseAllCombinedFiles'")));
  assert.match(action, /active: allCombinedCollapsed/);
  assert.match(action, /run: toggleAllCombinedFiles/);
  assert.match(action, /disabled: diffUnavailable/);
});
