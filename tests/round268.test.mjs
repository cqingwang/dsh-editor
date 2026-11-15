import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('right-clicking a group focuses the group node before opening its menu', () => {
  const panel = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function CommitLog('));
  const start = panel.indexOf('onContextMenu: (event) => {', panel.indexOf("'data-dsh-change-group': group.id"));
  const block = panel.slice(start, start + 500);
  assert.match(block, /event\.currentTarget\.focus\?\.\(\)/);
  assert.ok(block.indexOf('event.currentTarget.focus?.()') < block.indexOf('onSelectGroup?.(group.id)'));
});
