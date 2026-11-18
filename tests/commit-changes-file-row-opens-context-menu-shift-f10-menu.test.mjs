import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = ((readFileSync(join(root, 'tests/fixtures/commit-panel.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'))) + '\n' + readFileSync(join(root, 'tests/fixtures/commit-log.legacy.js'), 'utf8');

test('a Changes file row opens its context menu from Shift+F10 or the menu key', () => {
  const panel = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function CommitLog('));
  const start = panel.indexOf("'data-dsh-change-path': change.path");
  const block = panel.slice(start, start + 2600);
  assert.match(block, /event\.key === 'ContextMenu'/);
  assert.match(block, /event\.shiftKey && event\.key === 'F10'/);
  assert.match(block, /onContextMenu\(\{/);
  assert.match(block, /selectedChanges: insideSelection/);
});
