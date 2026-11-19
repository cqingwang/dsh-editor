import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

test('Project rows wait until the current root expansion state is restored', () => {
  assert.match(source, /const \[expandedReadyRoot, setExpandedReadyRoot\] = React\.useState\(''\);/u);
  assert.match(
    source,
    /expandedRestoredRef\.current = value\.root \?\? '';[\s\S]*?setExpandedReadyRoot\(workspaceRoot\);/u,
  );
  assert.match(
    source,
    /const expansionReady = root !== '' && expandedReadyRoot === root;[\s\S]*?const visibleProjectRows = expansionReady \? rows : \[\];[\s\S]*?const visibleProjectSourceRows = expansionReady \? projectRows : \[\];/u,
  );
  assert.match(source, /rows=\{visibleProjectRows\}[\s\S]*?projectRows=\{visibleProjectSourceRows\}/u);
});
