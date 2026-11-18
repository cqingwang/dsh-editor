import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));

function extract(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  assert.fail(`unterminated ${name}`);
}

function findTool() {
  const start = source.indexOf('function FindToolWindowView(');
  const end = source.indexOf('const FindToolWindow = FindToolWindowView;');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

const groups = [
  {
    path: 'a.txt',
    matches: [
      { path: 'a.txt', line: 1, column: 1 },
      { path: 'a.txt', line: 2, column: 1 },
    ],
  },
  {
    path: 'b.txt',
    matches: [
      { path: 'b.txt', line: 3, column: 1 },
    ],
  },
];

test('Find occurrence boundaries route back to the owning group or next group', () => {
  const target = extract('findToolGroupBoundaryTarget');
  assert.deepEqual(target(groups, 'text:a.txt:1:1', 'ArrowUp'), { kind: 'group', path: 'a.txt' });
  assert.deepEqual(target(groups, 'text:a.txt:2:1', 'ArrowDown'), { kind: 'group', path: 'b.txt' });
  assert.deepEqual(target(groups, 'text:b.txt:3:1', 'ArrowUp'), { kind: 'group', path: 'b.txt' });
  assert.equal(target(groups, 'text:b.txt:3:1', 'ArrowDown'), null);
  assert.equal(target(groups, 'text:a.txt:2:1', 'ArrowUp'), null);
});

test('Find occurrence rows provide roving focus and synchronise the active option', () => {
  const panel = findTool();
  assert.match(panel, /const occurrenceRefs = React\.useRef\(new Map\(\)\)/);
  assert.match(panel, /tabIndex: position === activeIndex \? 0 : -1/);
  assert.match(panel, /onFocus: \(\) => onMove\(0, occurrences\.length, position\)/);
  assert.match(panel, /onKeyDown: \(event\) => handleOccurrenceKeyDown\(event, rowKey, position\)/);
});

test('Find group down enters its first visible occurrence', () => {
  const panel = findTool();
  assert.match(
    panel,
    /event\.key === 'ArrowDown'[\s\S]{0,420}group\.matches\[0\][\s\S]{0,500}focusOccurrenceByIndex/,
  );
});

test('Find occurrence arrows preserve group boundaries and open/close shortcuts', () => {
  const panel = findTool();
  assert.match(panel, /findToolGroupBoundaryTarget\(groups, rowKey, event\.key\)/);
  assert.match(panel, /target\.kind === 'group'[\s\S]{0,200}focusGroupButton\(target\.path\)/);
  assert.match(panel, /focusAdjacentOccurrence\(position, event\.key === 'ArrowUp' \? -1 : 1\)/);
  assert.match(panel, /event\.key === 'Enter'[\s\S]{0,180}openFindResult\(occurrences\[position\]\)/);
  assert.match(panel, /event\.key === 'Escape'[\s\S]{0,120}onClose\(\)/);
});
