import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const terminalSource = readFileSync(join(root, 'src/client/terminal.ts'), 'utf8');
const workspaceSource = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const projectPanelSource =
  readFileSync(join(root, 'src/client/components/project/ProjectPanel.tsx'), 'utf8') +
  '\n' +
  readFileSync(join(root, 'src/client/components/project/FileTreeView.tsx'), 'utf8');

test('Project View stores IDEA Open Files with Single Click as an off-by-default preference', () => {
  assert.match(
    workspaceSource,
    /const \[\s*singleClickOpen,\s*setSingleClickOpen,\s*\]\s*=\s*React\.useState\(readProjectSingleClickOpen\)/,
  );
  assert.match(
    workspaceSource,
    /window\.localStorage\.setItem\('dsh-editor\.project\.singleClickOpen', next \? '1' : '0'\)/,
  );
  assert.match(terminalSource, /readStoredText\('dsh-editor\.project\.singleClickOpen', '0'\)/);
});

test('a file row selects on one click and opens on double click unless the preference is enabled', () => {
  const start = projectPanelSource.indexOf('onRowClick={(state, event) => {');
  assert.notEqual(start, -1);
  const row = projectPanelSource.slice(start, projectPanelSource.indexOf('onRowContextMenu=', start));
  assert.match(
    row,
    /if \(isDirectory\) \{[\s\S]*?if \(row\.root !== true && openDirectoriesSingleClick === true\) onToggle\(row\.path\);/,
  );
  assert.match(row, /else if \(singleClickOpen === true\) onOpenPreview\(row\.path\);/);
  assert.match(
    row,
    /onRowDoubleClick=\{\(state, event\) => \{[\s\S]*?if \(isDirectory && openDirectoriesSingleClick !== true\) onToggle\(row\.path\);[\s\S]*?else if \(!isDirectory && singleClickOpen !== true\) onOpenEditSource\(row\.path\);/,
  );
  assert.doesNotMatch(row, /setRenameState|onStartRename/);
});

test('the ProjectPanel wiring carries the preference and no stale terminal-origin helper', () => {
  const panel = projectPanelSource.slice(
    projectPanelSource.indexOf('function ProjectPanel({'),
    projectPanelSource.indexOf('const visibleRows = React.useMemo'),
  );
  assert.match(panel, /singleClickOpen,/);
  assert.doesNotMatch(panel, /const rememberTerminalOrigin = \(\) => \{/);
  assert.match(projectPanelSource, /onToggleSingleClickOpen: \(\) => void;/);
  assert.match(workspaceSource, /singleClickOpen=\{singleClickOpen\}/);
  assert.match(workspaceSource, /onToggleSingleClickOpen=\{\(\) => toggleSingleClickOpen\(\)\}/);
});
