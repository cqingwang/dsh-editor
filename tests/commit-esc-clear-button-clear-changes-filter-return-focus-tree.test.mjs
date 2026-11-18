import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = ((readFileSync(join(root, 'src/client/components/commit/CommitPanel.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'))) + '\n' + readFileSync(join(root, 'src/client/components/commit/CommitLog.tsx'), 'utf8');

function commitPanel() {
  const start = source.indexOf('function CommitPanel({');
  assert.notEqual(start, -1);
  const end = source.indexOf('function CommitLogView({', start);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('Esc and the clear button clear the Changes filter and return focus to the tree', () => {
  const panel = commitPanel();
  assert.match(panel, /const clearChangeFilter = \(\) => \{/);
  assert.match(panel, /onPathQuery\?\.\(''\)/);
  assert.match(panel, /changeRowRefs\?\.current\?\.get/);
  assert.match(panel, /scrollRefs\?\.changes\?\.current/);
  assert.match(panel, /window\.setTimeout\(\(\) => \{[\s\S]{0,500}?\.focus\?\.\(\)/);
  assert.match(panel, /event\.key === 'Escape'[\s\S]{0,300}?clearChangeFilter\(\)/);
  assert.match(panel, /onClick: \(\) => clearChangeFilter\(\)/);
});

test('the filter clear action prefers the selected row and falls back to the tree container', () => {
  const panel = commitPanel();
  const start = panel.indexOf('const clearChangeFilter = () => {');
  const end = panel.indexOf('};', start) + 2;
  const block = panel.slice(start, end);
  assert.match(block, /selectedChange === null\s+\? null/);
  assert.match(block, /const target = row !== null && row\.isConnected \? row : tree/);
});
