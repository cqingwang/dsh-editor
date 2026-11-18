import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('./fixtures/project-panel.legacy.js', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

function extractSource(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`unterminated ${name}`);
}

const orderEntries = new Function(
  `${extractSource('orderProjectEntriesByManual')}\nreturn orderProjectEntriesByManual;`,
)();
const reorderPaths = new Function(`${extractSource('reorderProjectManualPaths')}\nreturn reorderProjectManualPaths;`)();

test('manual order ranks known entries and keeps new entries stable after them', () => {
  const entries = [
    { path: 'a', name: 'a' },
    { path: 'b', name: 'b' },
    { path: 'c', name: 'c' },
  ];
  assert.deepEqual(
    orderEntries(entries, ['c', 'a']).map((entry) => entry.path),
    ['c', 'a', 'b'],
  );
  assert.deepEqual(
    orderEntries(entries, []).map((entry) => entry.path),
    ['a', 'b', 'c'],
  );
});

test('manual reorder moves a contiguous block before or after a sibling', () => {
  const current = ['a', 'b', 'c', 'd'];
  assert.deepEqual(reorderPaths(current, ['b', 'd'], 'c', 'before'), ['a', 'b', 'd', 'c']);
  assert.deepEqual(reorderPaths(current, ['b', 'd'], 'c', 'after'), ['a', 'c', 'b', 'd']);
  assert.deepEqual(reorderPaths(current, ['x'], 'c', 'after'), current);
});

test('Manual Order is exposed in Project Sort By and persisted per workspace', () => {
  assert.match(source, /\['name', 'type', 'modified', 'modified-asc', 'manual'\]/);
  assert.match(source, /const order = \['name', 'type', 'modified', 'modified-asc', 'manual'\]/);
  assert.match(source, /sort_manual: '手动排序'/);
  assert.match(source, /sort_manual: 'Manual Order'/);
  assert.match(source, /dsh-editor\.project\.manualOrder:\$\{root\}/);
  assert.match(
    source,
    /const \[manualOrder, setManualOrder\] = React\.useState\(\(\) => readProjectManualOrder\(root\)\)/,
  );
});

test('flattenRows applies manual order per parent directory', () => {
  const start = source.indexOf('function flattenRows(');
  const end = source.indexOf('\n    /**\n     * Resolve one visible Project row', start);
  const flatten = source.slice(start, end);
  assert.match(flatten, /sortMode = 'name',\s*manualOrder = null/u);
  assert.match(flatten, /const orderMap = manualOrder \?\? \{\}/);
  assert.match(
    flatten,
    /sortMode === 'manual'[\s\S]*?orderProjectEntriesByManual\(frame\.list, orderMap\[frame\.parentPath\]\)/,
  );
  assert.match(
    flatten,
    /stack\.push\(\{[\s\S]*?list: kids,[\s\S]*?depth: frame\.depth \+ 1,[\s\S]*?parentPath: rowEntry\.path,/,
  );
});

test('Manual Order drag only reorders view siblings and never calls the file move path', () => {
  assert.match(source, /onManualReorder: reorderManualProject/);
  assert.match(source, /if \(sortMode !== 'manual'\) onDrop\(sources, ''\)/);
  assert.match(source, /if \(sortMode === 'manual'\) \{[\s\S]*?onManualReorder\(sources, row\.path, edge\)/);
  assert.match(source, /if \(sortMode === 'manual'\) \{[\s\S]*?dropEffect = 'move'/);
  assert.match(source, /manualOrderSameDirectory/);
});
