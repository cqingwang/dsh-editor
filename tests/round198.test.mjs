import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('Project View stores IDEA Open Directories with Single Click off by default', () => {
  assert.match(
    source,
    /const \[openDirectoriesSingleClick, setOpenDirectoriesSingleClick\] = React\.useState\(\(\) => readStoredText\('dsh-editor\.project\.openDirectoriesSingleClick', '0'\) === '1'\);/,
  );
  assert.match(source, /\{ id: 'openDirectoriesSingleClick', label: t\('editor\.openDirectoriesSingleClick'\), shortcut: openDirectoriesSingleClick \? '✓' : ''/);
  assert.match(source, /window\.localStorage\.setItem\('dsh-editor\.project\.openDirectoriesSingleClick', next \? '1' : '0'\)/);
});

test('a directory row selects on one click and toggles on double click by default', () => {
  const start = source.indexOf("const isDirectory = row.kind === 'directory';");
  const row = source.slice(start, source.indexOf('onContextMenu:', start));
  assert.match(row, /if \(isDirectory\) \{[\s\S]*?if \(openDirectoriesSingleClick === true\) onToggle\(row\.path\);/);
  assert.match(row, /onDoubleClick: \(event\) => \{[\s\S]*?if \(isDirectory && openDirectoriesSingleClick !== true\) onToggle\(row\.path\);/);
});

test('the directory chevron remains a direct one-click toggle', () => {
  const start = source.indexOf("isDirectory\n                ? React.createElement(");
  assert.notEqual(start, -1);
  const chevron = source.slice(start, source.indexOf('/* Files keep the column', start));
  assert.match(chevron, /role: 'button'/);
  assert.match(chevron, /tabIndex: -1/);
  assert.match(chevron, /onClick: \(event\) => \{/);
  assert.match(chevron, /event\.stopPropagation\(\);/);
  assert.match(chevron, /onToggle\(row\.path\);/);
});

test('the ProjectPanel wiring carries the directory preference', () => {
  const panel = source.slice(source.indexOf('function ProjectPanel({'), source.indexOf('const visibleRows = React.useMemo'));
  assert.match(panel, /openDirectoriesSingleClick,/);
  assert.match(panel, /onToggleOpenDirectoriesSingleClick,/);
  assert.match(source, /openDirectoriesSingleClick,\n\s+onToggleOpenDirectoriesSingleClick,/);
});
