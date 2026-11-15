import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('ArrowRight expands a collapsed group and ArrowLeft collapses it', () => {
  const panel = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function CommitLog('));
  const block = panel.slice(panel.indexOf("'data-dsh-change-group': group.id"), panel.indexOf('React.createElement(', panel.indexOf("'data-dsh-change-group': group.id") + 400));
  assert.match(block, /event\.key === 'ArrowRight'/);
  assert.match(block, /event\.key === 'ArrowLeft'/);
  assert.match(block, /onToggleDirectory\(groupKey\)/);
});

test('an unversioned group selection is cleared when git removes the last member', () => {
  assert.match(source, /const members = splitChanges\(git\?\.changes \?\? \[\]\)\[selectedGroup\] \?\? \[\];/);
  assert.match(source, /if \(selectedGroup === 'unversioned' && members\.length === 0\) \{\s+setSelectedGroup\(null\);\s+selectedGroupRef\.current = null;\s+\}/);
  assert.doesNotMatch(source, /if \(members\.length === 0\) \{\s+setSelectedGroup\(null\)/);
});
