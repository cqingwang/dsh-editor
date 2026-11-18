import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = ((readFileSync(join(root, 'src/client/components/commit/CommitPanel.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8'))) + '\n' + readFileSync(join(root, 'src/client/components/commit/CommitLog.tsx'), 'utf8');

test('ArrowRight expands a collapsed group and ArrowLeft collapses it', () => {
  const panel = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function CommitLogView('));
  const start = panel.indexOf('data-dsh-change-group={group.id}');
  assert.notEqual(start, -1);
  const block = panel.slice(start, start + 2200);
  assert.match(block, /event\.key === 'ArrowRight'/);
  assert.match(block, /event\.key === 'ArrowLeft'/);
  assert.match(block, /onToggleDirectory\(groupKey\)/);
});

test('an unversioned group selection is cleared when git removes the last member', () => {
  assert.match(source, /const members = splitChanges\(git\?\.changes \?\? \[\]\)\[selectedGroup\] \?\? \[\];/);
  assert.match(source, /selectedGroup === 'unversioned' &&\s+members\.length === 0\s+\) \{\s+setSelectedGroup\(null\);\s+selectedGroupRef\.current = null;/);
  assert.doesNotMatch(source, /if \(members\.length === 0\) \{\s+setSelectedGroup\(null\)/);
});
