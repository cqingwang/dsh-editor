import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceSource = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const projectPanelSource = readFileSync(join(root, 'src/client/components/project/ProjectPanel.tsx'), 'utf8');

test('Project View stores IDEA Open Directories with Single Click off by default', () => {
  assert.match(
    workspaceSource,
    /const \[\s*openDirectoriesSingleClick,\s*setOpenDirectoriesSingleClick,\s*\]\s*=\s*React\.useState\(\(\) => readStoredText\('dsh-editor\.project\.openDirectoriesSingleClick', '0'\) === '1'\)/,
  );
  assert.match(
    workspaceSource,
    /window\.localStorage\.setItem\('dsh-editor\.project\.openDirectoriesSingleClick', next \? '1' : '0'\)/,
  );
});

test('a directory row selects on one click and toggles on double click by default', () => {
  const start = projectPanelSource.indexOf("const isDirectory = row.kind === 'directory';");
  const row = projectPanelSource.slice(start, projectPanelSource.indexOf('onContextMenu:', start));
  assert.match(row, /if \(isDirectory\) \{[\s\S]*?if \(row\.root !== true && openDirectoriesSingleClick === true\) onToggle\(row\.path\);/);
  assert.match(row, /onDoubleClick=\{\(event\) => \{[\s\S]*?if \(isDirectory && openDirectoriesSingleClick !== true\) onToggle\(row\.path\);/);
});

test('the directory chevron remains a direct one-click toggle', () => {
  const start = projectPanelSource.indexOf('{row.root ? null : isDirectory ? (');
  assert.notEqual(start, -1);
  const chevron = projectPanelSource.slice(start, projectPanelSource.indexOf('<EntryIcon', start));
  assert.match(chevron, /role='button'/);
  assert.match(chevron, /tabIndex=\{-1\}/);
  assert.match(chevron, /onClick=\{\(event\) => \{[\s\S]*?event\.stopPropagation\(\);[\s\S]*?onToggle\(row\.path\);/);
});

test('the ProjectPanel wiring carries the directory preference', () => {
  const panel = projectPanelSource.slice(
    projectPanelSource.indexOf('function ProjectPanel({'),
    projectPanelSource.indexOf('const visibleRows = React.useMemo'),
  );
  assert.match(panel, /openDirectoriesSingleClick,/);
  assert.match(projectPanelSource, /onToggleOpenDirectoriesSingleClick: \(\) => void;/);
  assert.match(workspaceSource, /openDirectoriesSingleClick=\{openDirectoriesSingleClick\}/);
  assert.match(
    workspaceSource,
    /onToggleOpenDirectoriesSingleClick=\{\(\) => toggleOpenDirectoriesSingleClick\(\)\}/,
  );
});
