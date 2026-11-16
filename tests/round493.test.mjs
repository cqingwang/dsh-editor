import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

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
  const start = source.indexOf('function FindToolWindow(');
  const end = source.indexOf('function QuickOpen(', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('Find file group focus moves within the visible group order', () => {
  const target = extract('findToolGroupTarget');
  const groups = [{ path: 'a.txt' }, { path: 'b.txt' }, { path: 'c.txt' }];
  assert.equal(target(groups, 'a.txt', 'ArrowDown'), 'b.txt');
  assert.equal(target(groups, 'b.txt', 'ArrowUp'), 'a.txt');
  assert.equal(target(groups, 'a.txt', 'ArrowUp'), 'a.txt');
  assert.equal(target(groups, 'c.txt', 'ArrowDown'), 'c.txt');
  assert.equal(target(groups, 'b.txt', 'Home'), 'a.txt');
  assert.equal(target(groups, 'b.txt', 'End'), 'c.txt');
  assert.equal(target([], 'a.txt', 'ArrowDown'), null);
});

test('Find group ids are stable and encode path punctuation', () => {
  const groupId = extract('findToolGroupId');
  assert.equal(groupId('src/a.ts'), groupId('src/a.ts'));
  assert.notEqual(groupId('src/a/b.ts'), groupId('src/a-b.ts'));
  assert.match(groupId('docs/a b.md'), /^dsh-editor-find-group-[A-Za-z0-9%._~()'!*;-]+$/);
});

test('Find renders each text group with a keyboard-controlled roving header', () => {
  const panel = findTool();
  assert.match(panel, /const \[focusedGroupPath, setFocusedGroupPath\] = React\.useState\(null\)/);
  assert.match(panel, /const groupButtonRefs = React\.useRef\(new Map\(\)\)/);
  assert.match(panel, /role: 'group'/);
  assert.match(panel, /id: findToolGroupId\(group\.path\)/);
  assert.match(panel, /data-dsh-find-group-path': group\.path/);
  assert.match(panel, /tabIndex: rovingGroupPath === group\.path \? 0 : -1/);
  assert.match(panel, /'aria-expanded': collapsedFiles\.has\(group\.path\) === false/);
  assert.match(panel, /'aria-controls': findToolGroupId\(group\.path\)/);
  assert.match(panel, /onKeyDown: \(event\) => handleGroupKeyDown\(event, group\)/);
});

test('Find group keys collapse, expand, activate and move without hidden rows', () => {
  const panel = findTool();
  assert.match(panel, /event\.key === 'ArrowLeft'/);
  assert.match(panel, /event\.key === 'ArrowRight'/);
  assert.match(panel, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(panel, /findToolGroupTarget\(groups, rovingGroupPath, event\.key\)/);
  assert.match(panel, /toggleGroup\(group\.path\)/);
  assert.match(panel, /focusGroupButton\(targetPath\)/);
});

test('collapsing a group re-clamps the active occurrence through the parent index', () => {
  const panel = findTool();
  assert.match(
    panel,
    /if \(state\.index !== activeIndex\) onMove\(0, occurrences\.length, activeIndex\)/,
  );
  assert.match(panel, /active === null \? undefined : findToolOptionId\(active\.rowKey\)/);
});
