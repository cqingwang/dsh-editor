import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const panel =
  (await readFile(new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/project/FileTreeView.tsx', import.meta.url), 'utf8'));

test('Project caches toolbar drop resolution and view definitions', () => {
  assert.match(
    panel,
    /const toolbarDropDirectory = React\.useMemo\(\s*\(\) => projectToolbarDropDirectory\(projectRows, selectedPath\),\s*\[projectRows, selectedPath\],\s*\);/u,
  );
  assert.match(panel, /const viewDefinitions = React\.useMemo\(\(\) => projectViewDefinitions\(t\), \[t\]\);/u);
});

test('Project derives each file status colour once per row', () => {
  assert.match(panel, /const projectRowPresentationByPath = React\.useMemo\(/u);
  assert.match(panel, /statusColor: treeNameColor\(\{\s+status,\s+selected: false,\s+\}\)/u);
  assert.match(panel, /!selected && statusColor !== null \? \{ color: statusColor \}/u);
  assert.doesNotMatch(panel, /treeNameColor\(\{\s+status,\s+selected,\s+\}\) === null/u);
});
