import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workspace = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

function effectBlock(marker) {
  const start = workspace.indexOf(marker);
  assert.notEqual(start, -1, `${marker} is missing`);
  const end = workspace.indexOf('}, [', start);
  assert.notEqual(end, -1, `${marker} has no dependency array`);
  const close = workspace.indexOf(']);', end);
  assert.notEqual(close, -1, `${marker} has no closed dependency array`);
  return workspace.slice(start, close + 3);
}

test('Search Everywhere persists Preserve case when that option alone changes', () => {
  const block = effectBlock('if (searchEverywhere !== null) writeSearchOptions(searchEverywhere);');
  assert.match(block, /searchEverywhere\?\.preserveCase/u);
});

test('Find Tool keeps its existing Preserve case persistence dependency', () => {
  const block = effectBlock('if (findTool !== null) writeSearchOptions(findTool);');
  assert.match(block, /findTool\?\.preserveCase/u);
});
