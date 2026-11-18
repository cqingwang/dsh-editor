import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'tests/fixtures/project-panel.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));
const workspaceSource = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const projectPanelSource = readFileSync(join(root, 'src/client/components/project/ProjectPanel.tsx'), 'utf8');
const projectOptionsMenuSource = readFileSync(
  join(root, 'src/client/components/project/project-options-menu.ts'),
  'utf8',
);

test('Project keeps Expand All in Options but removes the duplicate toolbar action', () => {
  assert.equal((projectOptionsMenuSource.match(/id: 'expandAll'/g) ?? []).length, 1);
  assert.match(
    projectOptionsMenuSource,
    /id: 'expandAll',[\s\S]*?label: t\('editor\.expandAll'\),[\s\S]*?disabled: !expandAllAvailable,[\s\S]*?restoreFocus: false,/,
  );
  assert.doesNotMatch(projectPanelSource, /id: 'expandAll'/);
  assert.doesNotMatch(projectPanelSource, /icon: 'expand', label: t\('editor\.expandAll'\)/);
});

test('Project toolbar still keeps Expand Selected and Collapse All', () => {
  assert.match(
    projectPanelSource,
    /id: 'expandSelected',[\s\S]*?label: t\('editor\.revealSelected'\),[\s\S]*?disabled: !projectCanExpandSelection/u,
  );
  assert.match(
    projectPanelSource,
    /id: 'collapse',[\s\S]*?label: t\('editor\.collapseAll'\),[\s\S]*?disabled: !canCollapseAll/u,
  );
  assert.match(source, /canCollapseAll: projectCanCollapseAll\(expanded\)/);
});

test('Project Options resolves Expand All from the EditorWorkspace state', () => {
  assert.match(
    source,
    /const projectExpandAllAvailable = projectTreeActionsAvailable\s+&& projectCanExpandAll\(entries, children, expanded\);/,
  );
  assert.match(
    workspaceSource,
    /expandAllAvailable: projectExpandAllAvailable,/,
  );
  assert.match(
    projectOptionsMenuSource,
    /id: 'expandAll',[\s\S]*?label: t\('editor\.expandAll'\),[\s\S]*?disabled: !expandAllAvailable,/,
  );
  assert.doesNotMatch(projectOptionsMenuSource, /disabled: !canExpandAll,/);
});
