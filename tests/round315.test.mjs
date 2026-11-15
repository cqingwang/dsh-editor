import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

test('remapPathAfterMove handles exact files and moved directory descendants', () => {
  const fn = new Function(`${extractFunction('remapPathAfterMove')}; return remapPathAfterMove;`)();
  assert.equal(fn('note.txt', [['note.txt', 'renamed.txt']]), 'renamed.txt');
  assert.equal(fn('src/deep/file.ts', [['src', 'lib']]), 'lib/deep/file.ts');
  assert.equal(fn('src2/file.ts', [['src', 'lib']]), 'src2/file.ts');
  assert.equal(fn('keep.txt', []), 'keep.txt');
  assert.equal(fn(null, [['a', 'b']]), null);
});

test('rename and move share one editor-path remap callback', () => {
  assert.match(source, /const remapEditorPaths = React\.useCallback\(\(entries\) => \{/);
  const renameStart = source.indexOf('const commitRename = React.useCallback(');
  const rename = source.slice(renameStart, source.indexOf('const selectActivity', renameStart));
  assert.match(rename, /remapEditorPaths\(\[\[renameState\.path, next\]\]\)/);

  const moveStart = source.indexOf('const moveEntry = React.useCallback(');
  const move = source.slice(moveStart, source.indexOf('const resolveConflict', moveStart));
  assert.match(move, /remapEditorPaths\(entries\)/);
});

test('path remap keeps models, preview, diff target and recent files coherent', () => {
  const start = source.indexOf('const remapEditorPaths = React.useCallback(');
  assert.notEqual(start, -1);
  const block = source.slice(start, source.indexOf('const openFile = React.useCallback(', start));
  assert.match(block, /modelsRef\.current\.delete\(path\)/);
  assert.match(block, /modelsRef\.current\.set\(next, model\)/);
  assert.match(block, /previewPathRef\.current = next;/);
  assert.match(block, /setPreviewPath\(next\)/);
  assert.match(block, /setDiffTarget\(/);
  assert.match(block, /setRecentFiles\(/);
  assert.match(block, /writeRecentFiles\(workspace, next\)/);
});
