import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const panelSource = await readFile(
  new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url),
  'utf8',
);

test('cancelling the Project view menu returns focus to the tree', () => {
  assert.match(
    panelSource,
    /const closeProjectViewMenu = React\.useCallback\(\(\) => \{\s+setViewMenu\(null\);\s+window\.setTimeout\(\(\) => \{[\s\S]*?treeRef\.current\?\.focus\(\);[\s\S]*?\}, 0\);\s+\}, \[searchOpen, treeRef\]\);/u,
  );
  assert.match(panelSource, /onClose=\{closeProjectViewMenu\}/u);
  assert.match(panelSource, /run: \(\) => onProjectViewChange\(definition\.id\)/u);
});
