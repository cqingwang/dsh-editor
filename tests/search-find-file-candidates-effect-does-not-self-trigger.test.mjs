import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const editorSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

function fileCandidatesEffect() {
  const marker = "React.useEffect(() => {\n    if (!findToolOpen || findToolSearchScopeMode !== 'files') return undefined;";
  const start = editorSource.indexOf(marker);
  assert.ok(start >= 0, 'Find file-candidates effect is missing');
  const dependencyStart = editorSource.indexOf('\n  }, [\n', start);
  assert.ok(dependencyStart > start, 'Find file-candidates dependency array is missing');
  const end = editorSource.indexOf('\n  ]);', dependencyStart);
  assert.ok(end > start, 'Find file-candidates effect dependencies are missing');
  return editorSource.slice(dependencyStart, end + '\n  ]);'.length);
}

test('Find file-candidates effect depends on request inputs, not its derived scope state', () => {
  const effect = fileCandidatesEffect();
  const dependencies = effect;

  assert.match(dependencies, /findTool\?\.includeExcluded/u);
  assert.match(dependencies, /findTool\?\.fileMask/u);
  assert.match(dependencies, /searchRevision/u);
  assert.match(dependencies, /searchDirectoryRules/u);
  assert.doesNotMatch(
    dependencies,
    /findToolFileCandidatesScope/u,
    'derived candidate-scope state must not retrigger the workspace file traversal',
  );
});
