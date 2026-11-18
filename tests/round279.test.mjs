import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = ((readFileSync(join(root, 'tests/fixtures/commit-panel.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'))) + '\n' + readFileSync(join(root, 'tests/fixtures/commit-log.legacy.js'), 'utf8');

test('the group menu exposes a danger rollback action for checked members', () => {
  const panel = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function CommitLog('));
  assert.match(panel, /onRollbackGroup,/);
  assert.match(panel, /id: 'rollbackGroup'/);
  assert.match(panel, /danger: true/);
  assert.match(panel, /disabled: selectedInGroup\.length === 0/);
  assert.match(panel, /run: \(\) => onRollbackGroup\?\.\(group\.id, selectedInGroup\)/);
});

test('rollbackGroup dispatches by change band', () => {
  assert.match(source, /onRollbackGroup: \(group, paths\) => \{/);
  assert.match(source, /group === 'staged'.*rollback\(paths, \{ staged: true \}\)/);
  assert.match(source, /group === 'unversioned'.*rollback\(paths, \{ unversioned: true \}\)/);
  assert.match(source, /void rollback\(paths\)/);
});
