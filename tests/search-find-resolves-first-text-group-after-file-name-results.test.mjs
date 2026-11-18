import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('./fixtures/find-tool.legacy.js', import.meta.url), 'utf8'));

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
  const end = source.indexOf('/* QUICK_OPEN_BOUNDARY */');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('Find resolves the first text group after file-name results', () => {
  const nextGroup = extract('findToolNextTextGroupPath');
  const rows = [
    { kind: 'file', path: 'app.js', rowKey: 'file:app.js' },
    { kind: 'text', path: 'README.md', rowKey: 'text:README.md:1:1' },
  ];
  assert.equal(nextGroup(rows, 0), 'README.md');
  assert.equal(nextGroup([rows[0]], 0), null);
  assert.equal(nextGroup(rows, 1), null);
});

test('Find occurrence Home and End select the visible result boundaries', () => {
  const panel = findTool();
  assert.match(panel, /event\.key === 'Home'[\s\S]{0,180}focusOccurrenceByIndex\(0\)/);
  assert.match(panel, /event\.key === 'End'[\s\S]{0,180}focusOccurrenceByIndex\(occurrences\.length - 1\)/);
});

test('file result down crosses into the first text group header', () => {
  const panel = findTool();
  assert.match(panel, /rowKey\.startsWith\('file:'\)/);
  assert.match(panel, /findToolNextTextGroupPath\(occurrences, position\)/);
  assert.match(panel, /focusGroupButton\(nextTextGroupPath\)/);
});

test('Find boundary routing keeps text-group arrows and replacement shortcuts', () => {
  const panel = findTool();
  assert.match(panel, /findToolGroupBoundaryTarget\(groups, rowKey, event\.key\)/);
  assert.match(panel, /openFindResult\(occurrences\[position\]\)/);
  assert.match(panel, /onReplaceOccurrence\(active, activeIndex\)/);
});
