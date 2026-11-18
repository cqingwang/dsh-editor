import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptCallback, loadTypeScriptFunction } from './ts-source.mjs';

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

test('rename and move share one editor-path remap callback', async () => {
  const remaps = [];
  const remapEditorPaths = (entries) => remaps.push(entries);
  const commitRename = loadTypeScriptCallback(source, 'commitRename', {
    renameState: { path: 'src/a.ts', value: 'renamed.ts' },
    t: (key) => key,
    setTreeError: () => {},
    callFs: async () => {},
    remapEditorPaths,
    dirname,
    remapProjectExpandedPathsForMoves: () => {},
    remapProjectManualOrderForMoves: () => {},
    setRenameState: () => {},
    setSelectedPath: () => {},
    refreshTree: async () => {},
    loadGit: async () => {},
  });
  await commitRename();
  assert.deepEqual(remaps, [[['src/a.ts', 'src/renamed.ts']]]);

  const moveEntry = loadTypeScriptCallback(source, 'moveEntry', {
    rows: [],
    callFs: async () => [],
    planMoves: () => ({ moves: [{ from: 'src/a.ts', to: 'lib/a.ts' }], conflicts: [], intoSelf: [] }),
    dirname,
    basename: (path) => path.split('/').at(-1),
    describeMoveResult: () => ({ blocked: undefined, done: 1, target: 'lib' }),
    describeMoved: () => '',
    t: (key) => key,
    remapEditorPaths,
    remapProjectExpandedPathsForMoves: () => {},
    remapProjectManualOrderForMoves: () => {},
    applyTreeSelection: () => {},
    refreshTree: async () => {},
    loadGit: async () => {},
    setTreeError: () => {},
  });
  await moveEntry('src/a.ts', 'lib');
  assert.deepEqual(remaps.at(-1), [['src/a.ts', 'lib/a.ts']]);
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
