import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('graph rows expose the shared commit menu on right click', () => {
  const start = source.indexOf('function CommitGraph(');
  const graph = source.slice(start, source.indexOf('function scrollGraphRowIntoView(', start));
  assert.match(source, /function CommitGraph\(\{[^}]*onContextMenu[^}]*\}\)/);
  assert.match(graph, /onContextMenu: \(event\) => \{/);
  assert.match(graph, /event\.preventDefault\(\)/);
  assert.match(graph, /event\.stopPropagation\(\)/);
  assert.match(graph, /onShow\?\.\(entry\.hash\)/);
  assert.match(graph, /onContextMenu\?\.\(\{\s+commit: entry,\s+x: event\.clientX,\s+y: event\.clientY,?\s+\}\)/);
});

test('right click synchronises graph cursor before opening the menu', () => {
  const start = source.indexOf('graphMode\n              ? React.createElement(CommitGraph');
  const call = source.slice(start, source.indexOf('graphMode ? null : commits.length', start));
  assert.match(call, /onContextMenu: \(payload\) => \{/);
  assert.match(call, /setGraphCursor\(payload\.commit\.hash\)/);
  assert.match(call, /setGraphHover\(null\)/);
  assert.match(call, /onContextMenu\?\.\(payload\)/);
});
