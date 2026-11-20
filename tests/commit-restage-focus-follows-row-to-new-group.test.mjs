import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const modelSource = await readFile(new URL('../src/client/components/ui/git-change-model.ts', import.meta.url), 'utf8');
const workspace = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const helpers = loadTypeScriptModule(modelSource, ['selectionAfterRestage']);

test('restage selection follows every path into its new staged or unstaged group', () => {
  const moved = helpers.selectionAfterRestage(
    [
      { path: 'a.ts', status: ' M' },
      { path: 'b.ts', status: 'A ' },
      { path: 'c.ts', status: 'AM' },
    ],
    ['a.ts', 'b.ts', 'c.ts'],
    'b.ts',
  );
  assert.deepEqual([...moved.selection], ['unstaged:a.ts', 'staged:b.ts', 'staged:c.ts', 'unstaged:c.ts']);
  assert.deepEqual(moved.primary, { path: 'b.ts', staged: true });
});

test('restage focus migration is applied only when a business action requests it', () => {
  assert.match(
    workspace,
    /const restage = React\.useCallback\(\s+async \(paths: string\[\], staged: boolean, focusPath\?: string\)/u,
  );
  assert.match(workspace, /changeModel\.movedRows\(value\?\.changes \?\? \[\], paths, focusPath\)/u);
  assert.match(workspace, /changeModel\.remainingCommitPaths\(current, value\?\.changes\)/u);
  assert.match(workspace, /setSelectedChanges\(moved\.selection\);/u);
  assert.match(workspace, /groupByFocusRef\.current = moved\.primary as DiffTarget \| null;/u);
  assert.match(workspace, /window\.setTimeout\(\(\) => revealChangeRow\(moved\.primary as DiffTarget \| null\), 0\);/u);
  assert.match(workspace, /\}, \[collapsedGroups, git, groupBy\]\);/u);
  assert.match(workspace, /restage\(removalOnly \? removablePaths : paths, allStaged, change\.path\)/u);
});
