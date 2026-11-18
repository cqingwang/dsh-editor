import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = ((readFileSync(join(root, 'tests/fixtures/commit-panel.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'tests/fixtures/context-menu.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'))) + '\n' + readFileSync(join(root, 'tests/fixtures/commit-log.legacy.js'), 'utf8');

test('Change group actions are disabled when the group has no checked files', () => {
  const panel = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function CommitLog('));
  const actions = panel.slice(panel.indexOf('const groupActions = ['), panel.indexOf('return React.createElement(', panel.indexOf('const groupActions = [')));
  const stageAction = actions.slice(
    actions.indexOf('id: removalOnlyInGroup ? `removeDeleted:${group.id}` : `stage:${group.id}`'),
    actions.indexOf('...(removableInGroup.length > 0'),
  );
  assert.match(stageAction, /disabled: selectedInGroup\.length === 0/);
  assert.doesNotMatch(stageAction, /disabled: group\.changes\.length === 0/);
});

test('a group with no enabled action keeps focus on its overflow opener', () => {
  const menu = source.slice(source.indexOf('function ContextMenu('), source.indexOf('/**\n     * A tool-window splitter'));
  assert.match(menu, /querySelector\('button\[data-menu-item-id\]:not\(:disabled\)'\)/);
  assert.match(menu, /if \(first instanceof HTMLElement\) first\.focus\(\)/);
  assert.match(menu, /disabled: item\.disabled === true/);
});
