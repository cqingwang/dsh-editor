import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = ((readFileSync(join(root, 'tests/fixtures/commit-panel.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'))) + '\n' + readFileSync(join(root, 'tests/fixtures/commit-log.legacy.js'), 'utf8');

test('the group node opens its context menu with Shift+F10 or the menu key', () => {
  const panel = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function CommitLog('));
  const start = panel.indexOf('onKeyDown: (event) => {', panel.indexOf("'data-dsh-change-group': group.id"));
  const block = panel.slice(start, start + 1000);
  assert.match(block, /event\.key === 'ContextMenu'/);
  assert.match(block, /event\.shiftKey && event\.key === 'F10'/);
  assert.match(block, /setGroupActionMenu\(\{/);
  assert.match(block, /items: groupMenuItems/);
});
