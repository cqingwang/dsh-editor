import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/project/ProjectPanel.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));
const projectPanelSource = readFileSync(join(root, 'src/client/components/project/ProjectPanel.tsx'), 'utf8');

test('clicking Project tree background keeps the current IDEA selection', () => {
  assert.doesNotMatch(source, /onClearSelection\?\.\(\);/);
  assert.doesNotMatch(source, /onClearSelection: clearTreeSelection/);
  assert.doesNotMatch(source, /\n      onClearSelection,/);
});

test('the tree background remains available for workspace-root drop', () => {
  const start = projectPanelSource.indexOf("role='tree'");
  assert.notEqual(start, -1, 'Project tree shell is missing');
  const tree = projectPanelSource.slice(start);
  assert.match(tree, /onDragOver=\{\(event\) => \{[\s\S]*?event\.preventDefault\(\);/);
  assert.match(tree, /dataTransfer\.dropEffect = externalFiles \? 'copy' : 'move'/);
  assert.match(tree, /onDrop=\{\(event\) => \{[\s\S]*?uploadExternalWorkspaceDrop\(event, ''\);/);
});
