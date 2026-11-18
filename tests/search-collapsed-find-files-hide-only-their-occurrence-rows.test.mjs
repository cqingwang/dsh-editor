import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));

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

function extract(name) {
  return new Function(`${extractSource(name)}; return ${name};`)();
}

test('collapsed find files hide only their occurrence rows', () => {
  const rowsFor = new Function(
    `${extractSource('dirname')}\n${extractSource('groupFindMatches')}\n${extractSource('normalizeFindGroupBy')}\n${extractSource('orderFindToolGroups')}\n${extractSource('findToolVisibleRows')}\nreturn findToolVisibleRows;`,
  )();
  const matches = [
    { path: 'b.txt', line: 2, column: 1, preview: 'b' },
    { path: 'a.txt', line: 1, column: 1, preview: 'a' },
    { path: 'b.txt', line: 5, column: 1, preview: 'b2' },
  ];
  const files = [{ path: 'c.md', title: 'c.md' }];
  const expanded = rowsFor(files, matches, new Set());
  assert.deepEqual(expanded.rows.map((row) => row.rowKey), [
    'file:c.md',
    'text:b.txt:2:1',
    'text:b.txt:5:1',
    'text:a.txt:1:1',
  ]);
  const collapsed = rowsFor(files, matches, new Set(['b.txt']));
  assert.deepEqual(collapsed.rows.map((row) => row.rowKey), [
    'file:c.md',
    'text:a.txt:1:1',
  ]);
  assert.equal(collapsed.groups.length, 2);
});

test('Find tool window exposes group collapse, expand/collapse all and source preview', () => {
  const dialog = source.slice(source.lastIndexOf('function FindToolWindowView('), source.indexOf('const FindToolWindow = FindToolWindowView;', source.lastIndexOf('function FindToolWindowView(')));
  assert.match(dialog, /const \[collapsedFiles, setCollapsedFiles\] = React\.useState/);
  assert.match(dialog, /const \[previewOpen, setPreviewOpen\] = React\.useState/);
  assert.match(dialog, /findToolExpandFile/);
  assert.match(dialog, /findToolCollapseFile/);
  assert.match(dialog, /t\('editor\.expandAll'\)/);
  assert.match(dialog, /t\('editor\.collapseAll'\)/);
  assert.match(dialog, /t\('editor\.findToolPreviewSource'\)/);
  assert.match(dialog, /data-dsh-find-preview=''/);
  assert.match(dialog, /callFs\(\s+\{\s+op: 'read',\s+path: active\.path,\s+\},\s+\{\s+signal: previewAbort\.signal,\s+\},\s+\)/u);
  assert.match(dialog, /searchEverywherePreviewWindow\(/);
});
