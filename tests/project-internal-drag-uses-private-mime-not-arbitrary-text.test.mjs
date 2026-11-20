import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const project = await readFile(new URL('../src/client/project.ts', import.meta.url), 'utf8');
const panel = await readFile(new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url), 'utf8');
const dragMime = project.match(/export const PROJECT_TREE_DRAG_MIME = '([^']+)';/u)?.[1] ?? '';

test('only the private Project MIME marks an internal tree drag', () => {
  assert.equal(dragMime, 'application/x-dsh-editor-project-paths');
  const includes = new Function(
    'PROJECT_TREE_DRAG_MIME',
    `${transpileTypeScriptFunction(project, 'dataTransferIncludesProjectTreePaths')}; return dataTransferIncludesProjectTreePaths;`,
  )(dragMime);
  assert.equal(includes({ types: ['text/plain', 'Files'] }), false);
  assert.equal(includes({ types: [dragMime] }), true);
  assert.equal(includes(undefined), false);
});

test('internal tree drops read only the private path payload', () => {
  const readPaths = new Function(
    'PROJECT_TREE_DRAG_MIME',
    `${transpileTypeScriptFunction(project, 'readProjectTreeDragPaths')}; return readProjectTreeDragPaths;`,
  )(dragMime);
  assert.deepEqual(
    readPaths({
      types: [dragMime],
      getData: (type) => (type === dragMime ? 'src/a.ts\nsrc/b.ts' : 'unrelated chat text'),
    }),
    ['src/a.ts', 'src/b.ts'],
  );
  assert.deepEqual(
    readPaths({
      types: ['text/plain'],
      getData: () => 'src/a.ts',
    }),
    [],
  );
  assert.deepEqual(
    readPaths({
      getData: () => 'src/a.ts',
    }),
    [],
  );
});

test('Project rows publish the private MIME and ignore arbitrary text drags', () => {
  assert.match(panel, /const text = payload\.join\('\\n'\);\s+event\.dataTransfer\?\.setData\(PROJECT_TREE_DRAG_MIME, text\);/u);
  assert.match(panel, /event\.dataTransfer\?\.setData\('text\/plain', text\);/u);
  assert.doesNotMatch(panel, /types\?\.includes\('text\/plain'\)/u);
  assert.doesNotMatch(panel, /getData\('text\/plain'\)/u);
  assert.match(panel, /dataTransferIncludesProjectTreePaths\(event\.dataTransfer\)/u);
  assert.match(panel, /readProjectTreeDragPaths\(event\.dataTransfer\)/u);
});
