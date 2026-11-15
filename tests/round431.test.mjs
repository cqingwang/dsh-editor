import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const commit = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function groupActionMenuItems('));

function extractFunction(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  return source.slice(start, index + 1);
}

test('projectTreePosition reports level and sibling position from visible rows', () => {
  const projectTreePosition = new Function(`${extractFunction('projectTreePosition')}; return projectTreePosition;`)();
  const rows = [
    { kind: 'directory', depth: 0 },
    { kind: 'directory', depth: 1 },
    { kind: 'file', depth: 2 },
    { kind: 'file', depth: 2 },
    { kind: 'file', depth: 1 },
  ];
  assert.deepEqual(projectTreePosition(rows, 0), { level: 1, posinset: 1, setsize: 1 });
  assert.deepEqual(projectTreePosition(rows, 1), { level: 2, posinset: 1, setsize: 2 });
  assert.deepEqual(projectTreePosition(rows, 2), { level: 3, posinset: 1, setsize: 2 });
  assert.deepEqual(projectTreePosition(rows, 3), { level: 3, posinset: 2, setsize: 2 });
  assert.deepEqual(projectTreePosition(rows, 4), { level: 2, posinset: 2, setsize: 2 });
});

test('Project rows expose the computed position set', () => {
  assert.match(source, /const projectRowPosition = projectTreePosition\(visibleRows, rowIndex\)/);
  assert.match(source, /'aria-posinset': projectRowPosition\.posinset/);
  assert.match(source, /'aria-setsize': projectRowPosition\.setsize/);
});

test('Changes groups and entries expose their own sibling positions', () => {
  assert.match(commit, /visibleGroups\.map\(\(group, groupIndex\) => renderGroup\(group, groupIndex\)\)/);
  assert.match(commit, /'aria-posinset': groupIndex \+ 1,\s+'aria-setsize': visibleGroups\.length/);
  assert.match(commit, /rows\.map\(\(row, rowIndex\) => \{/);
  assert.match(commit, /'aria-posinset': rowIndex \+ 1,\s+'aria-setsize': rows\.length/);
});
