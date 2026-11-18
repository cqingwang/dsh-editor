import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function resolveConflictSource() {
  const start = source.indexOf('const resolveConflict = React.useCallback(');
  assert.notEqual(start, -1);
  const end = source.indexOf('const buildChangeMenu = React.useCallback(', start);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('resolving a conflict explicitly selects the resulting staged row', () => {
  const block = resolveConflictSource();
  assert.match(block, /const resolvedPaths = new Set\(paths\)/);
  assert.match(block, /const next = \(value\?\.changes \?\? \[\]\)\.find/);
  assert.match(block, /next\.status\[0\] !== ' ' && next\.status\[0\] !== '\?'/);
  assert.match(block, /setSelectedChange\(\{ path: next\.path, staged \}\)/);
  assert.match(block, /setSelectedChanges\(new Set\(\[`\$\{staged \? 'staged' : 'unstaged'\}:\$\{next\.path\}`\]\)\)/);
});

test('resolving a conflict returns keyboard focus to the refreshed Changes row', () => {
  const block = resolveConflictSource();
  assert.match(block, /await refreshTree\(\)/);
  assert.match(block, /window\.setTimeout\(\(\) => \{/);
  assert.match(block, /changeRowRefs\.current\.get/);
  assert.match(block, /\.focus\?\.\(\)/);
});
