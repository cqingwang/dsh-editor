import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('Project View stores IDEA Open Files with Single Click as an off-by-default preference', () => {
  assert.match(
    source,
    /const \[singleClickOpen, setSingleClickOpen\] = React\.useState\(readProjectSingleClickOpen\);/,
  );
  assert.match(source, /\{ id: 'singleClickOpen', label: t\('editor\.openFilesSingleClick'\), shortcut: singleClickOpen \? '✓' : ''/);
  assert.match(source, /window\.localStorage\.setItem\('dsh-editor\.project\.singleClickOpen', next \? '1' : '0'\)/);
});

test('a file row selects on one click and opens on double click unless the preference is enabled', () => {
  const start = source.indexOf("const isDirectory = row.kind === 'directory';");
  assert.notEqual(start, -1);
  const row = source.slice(start, source.indexOf('onContextMenu:', start));
  assert.match(row, /if \(isDirectory\) \{[\s\S]*?if \(row\.root !== true && openDirectoriesSingleClick === true\) onToggle\(row\.path\);/);
  assert.match(row, /else if \(singleClickOpen === true\) onOpenPreview\(row\.path\);/);
  assert.match(row, /onDoubleClick: \(event\) => \{[\s\S]*?if \(isDirectory && openDirectoriesSingleClick !== true\) onToggle\(row\.path\);[\s\S]*?else if \(!isDirectory && singleClickOpen !== true\) onOpen\(row\.path\);/);
  assert.doesNotMatch(row, /setRenameState|onStartRename/);
});

test('the ProjectPanel wiring carries the preference and no stale terminal-origin helper', () => {
  const panel = source.slice(source.indexOf('function ProjectPanel({'), source.indexOf('const visibleRows = React.useMemo'));
  assert.match(panel, /singleClickOpen,/);
  assert.match(panel, /onToggleSingleClickOpen,/);
  assert.doesNotMatch(panel, /const rememberTerminalOrigin = \(\) => \{/);
  assert.match(source, /singleClickOpen,\n\s+onToggleSingleClickOpen,/);
});
