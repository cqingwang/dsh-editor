import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const project =
  (await readFile(new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/project/FileTreeView.tsx', import.meta.url), 'utf8'));

test('Project row presentation is cached independently of selection', () => {
  assert.match(project, /const projectRowPresentationByPath = React\.useMemo\(/u);
  assert.match(project, /directoryTint\(changesByDirectory\.get\(row\.path\)\)/u);
  assert.match(project, /treeNameColor\(\{\s*status,\s*selected: false,\s*\}\)/u);
  assert.match(project, /\[changesByDirectory, expanded, gitChanges, projectRowPositions, visibleRows\]/u);

  const rowsStart = project.indexOf('const renderProjectRowName =');
  const rowsEnd = project.indexOf('const renderProjectRowInlineEditor =', rowsStart);
  assert.ok(rowsStart > 0);
  assert.ok(rowsEnd > rowsStart);
  const rows = project.slice(rowsStart, rowsEnd);
  assert.match(rows, /projectRowPresentationByPath\.get\(row\.path\)/u);
  assert.doesNotMatch(rows, /gitChanges\.get|treeNameColor\(|directoryTint\(/u);
});
