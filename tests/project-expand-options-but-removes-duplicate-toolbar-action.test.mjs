import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/project/ProjectPanel.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));
const workspaceSource = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const projectPanelSource = readFileSync(join(root, 'src/client/components/project/ProjectPanel.tsx'), 'utf8');
const projectOptionsMenuSource = readFileSync(
  join(root, 'src/client/components/project/project-options-menu.ts'),
  'utf8',
);

test('Project never exposes an expand-all action in the toolbar or Options', () => {
  assert.doesNotMatch(projectPanelSource, /id: 'expandAll'/);
  assert.doesNotMatch(projectPanelSource, /id: 'expandSelected'/);
  assert.doesNotMatch(projectPanelSource, /projectCanExpandSelection|onExpandSelected|editor\.revealSelected/);
  assert.doesNotMatch(projectOptionsMenuSource, /id: 'expandAll'/);
  assert.doesNotMatch(projectOptionsMenuSource, /expandAllAvailable|onExpandAll/);
  assert.doesNotMatch(
    workspaceSource,
    /projectExpandAllAvailable|const expandAll =|onExpandAll|onExpandSelected|expandSelectedTree|projectCanExpandSelection/,
  );
});

test('Project toolbar keeps Collapse All while removing every expand action', () => {
  assert.match(
    projectPanelSource,
    /id: 'collapse',[\s\S]*?label: t\('editor\.collapseAll'\),[\s\S]*?disabled: !canCollapseAll/u,
  );
  assert.match(source, /canCollapseAll: projectCanCollapseAll\(expanded\)/);
});

test('Project Options keeps navigation commands without an expand-all command', () => {
  const optionsCall = workspaceSource.slice(
    workspaceSource.indexOf('projectOptionsMenuItems({'),
    workspaceSource.indexOf('onCreateChange={(value) =>', workspaceSource.indexOf('projectOptionsMenuItems({')),
  );
  assert.match(optionsCall, /onRefresh: \(\) => runProjectOption\(\(\) => void refreshTree\(\)\)/);
  assert.match(optionsCall, /onGotoFile: \(\) => void openQuickOpen\(\)/);
  assert.match(optionsCall, /onRecentFiles: openRecent/);
  assert.doesNotMatch(optionsCall, /onExpandAll/);
});
