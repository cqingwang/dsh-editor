import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = ((readFileSync(join(root, 'tests/fixtures/commit-panel.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'))) + '\n' + readFileSync(join(root, 'tests/fixtures/commit-log.legacy.js'), 'utf8');

test('the group header opens a group context menu and selects the node first', () => {
  const panel = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function CommitLog('));
  const block = panel.slice(panel.indexOf("'data-dsh-change-group': group.id"), panel.indexOf("id: `stage:${group.id}`"));
  assert.match(panel, /onContextMenu: \(event\) => \{/);
  assert.match(panel, /onSelectGroup\?\.\(group\.id\);\s+setGroupActionMenu\(\{\s+x: event\.clientX,\s+y: event\.clientY,/);
});

test('group actions include the node expand/collapse command', () => {
  const panel = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function CommitLog('));
  assert.match(panel, /id: `toggle:\$\{group\.id\}`/);
  assert.match(panel, /label: groupOpen \? t\('editor\.collapseGroup'\) : t\('editor\.expandGroup'\)/);
  assert.match(panel, /run: \(\) => onToggleDirectory\(groupKey\)/);
});
