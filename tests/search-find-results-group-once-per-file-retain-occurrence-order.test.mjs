import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));

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

test('find results group once per file and retain occurrence order', () => {
  const group = extract('groupFindMatches');
  const matches = [
    { path: 'b.txt', line: 3, column: 2, preview: 'b1' },
    { path: 'a.txt', line: 1, column: 1, preview: 'a1' },
    { path: 'b.txt', line: 9, column: 5, preview: 'b2' },
    { path: '', line: 1, column: 1, preview: 'invalid' },
  ];
  const grouped = group(matches);
  assert.deepEqual(
    grouped.map((entry) => entry.path),
    ['b.txt', 'a.txt'],
  );
  assert.deepEqual(
    grouped.map((entry) => entry.matches.map((match) => match.preview)),
    [['b1', 'b2'], ['a1']],
  );
});

test('Search Everywhere can hand current results to the persistent Find tool window', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.lastIndexOf('function QuickOpen('));
  assert.match(dialog, /t\('editor\.openInFindToolWindow'\)/);
  assert.match(dialog, /onOpenInFindToolWindow\(/);
  assert.match(dialog, /data-dsh-search-open-find-tool-window/);
  assert.match(dialog, /disabled: effectiveQuery === '',/);
});

test('Find and Replace in Files use the IDEA-style search popup', () => {
  assert.match(source, /const openFindTool = React\.useCallback/);
  assert.match(source, /function FindToolWindowView\(/);
  assert.match(source, /'data-dsh-find-tool-window': ''/);
  assert.match(source, /data-dsh-find-tool-popup/);
  assert.match(source, /findToolPopup: \{[\s\S]*?position: 'fixed'/);
  assert.match(source, /groupFindMatches\(/);
  assert.match(source, /t\('editor\.previousOccurrence'\)/);
  assert.match(source, /t\('editor\.nextOccurrence'\)/);
  assert.match(source, /openFindTool\('', 'find'\)/);
  assert.match(source, /openFindTool\('', 'replace'\)/);
});

test('persistent replace reuses the guarded host operation', () => {
  const replace = source.slice(
    source.indexOf('const replaceInFindTool = React.useCallback'),
    source.indexOf('const dismissExternal = React.useCallback'),
  );
  assert.match(replace, /op: 'replaceText'/);
  assert.match(replace, /openFilesRef\.current/);
  assert.match(replace, /searchReplaceDirty/);
  assert.match(replace, /confirmSearchReplace/);
  assert.match(replace, /reloadFile\(path\)/);
});
