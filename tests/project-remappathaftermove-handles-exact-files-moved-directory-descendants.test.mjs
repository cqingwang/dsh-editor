import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const coreSource = readFileSync(join(root, 'src/client/editor-core.ts'), 'utf8');
const remapPathAfterMove = loadTypeScriptFunction(coreSource, 'remapPathAfterMove');

test('remapPathAfterMove handles exact files and moved directory descendants', () => {
  assert.equal(remapPathAfterMove('note.txt', [['note.txt', 'renamed.txt']]), 'renamed.txt');
  assert.equal(remapPathAfterMove('src/deep/file.ts', [['src', 'lib']]), 'lib/deep/file.ts');
  assert.equal(remapPathAfterMove('src2/file.ts', [['src', 'lib']]), 'src2/file.ts');
  assert.equal(remapPathAfterMove('keep.txt', []), 'keep.txt');
  assert.equal(remapPathAfterMove(null, [['a', 'b']]), null);
});

test('rename and move share one editor-path remap callback', () => {
  assert.match(source, /const remapEditorPaths = React\.useCallback\(\(entries\) => \{/);
  const renameStart = source.indexOf('const commitRename = React.useCallback(');
  const rename = source.slice(renameStart, source.indexOf('const selectActivity', renameStart));
  assert.match(rename, /remapEditorPaths\(\[\[renameState\.path, next\]\]\)/);

  const moveStart = source.indexOf('const moveEntry =');
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
