import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const model = await readFile(
  new URL('../src/client/components/project/project-selection-model.ts', import.meta.url),
  'utf8',
);
const workspace = await readFile(
  new URL('../src/client/editor-workspace.tsx', import.meta.url),
  'utf8',
);
const { projectFileComparisonActions } = loadTypeScriptModule(model, ['projectFileComparisonActions']);

function actions(batchSize, calls) {
  return projectFileComparisonActions({
    batchSize,
    path: 'README.md',
    compareWithClipboard: (path) => calls.push(`clipboard:${path}`),
    compareWithRevision: (path) => calls.push(`revision:${path}`),
    t: (key) => key,
  });
}

test('Project multi-selection disables comparison actions that only target one path', () => {
  const multiCalls = [];
  const multi = actions(2, multiCalls);
  assert.deepEqual(
    multi.map((action) => [action.id, action.disabled]),
    [
      ['compareClipboard', true],
      ['compareRevision', true],
    ],
  );
  assert.deepEqual(multiCalls, []);

  const singleCalls = [];
  const single = actions(1, singleCalls);
  for (const action of single) action.run();
  assert.deepEqual(singleCalls, ['clipboard:README.md', 'revision:README.md']);
  assert.match(workspace, /projectFileComparisonActions\(\{[\s\S]*?batchSize: batch\.length/u);
});
