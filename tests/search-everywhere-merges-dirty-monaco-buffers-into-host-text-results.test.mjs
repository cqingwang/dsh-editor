import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { extractFunctionSource, loadTypeScriptExpression } from './ts-source.mjs';

const searchEverywhereSource = await readFile(
  new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url),
  'utf8',
);
const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const terminalSource = await readFile(new URL('../src/client/terminal.ts', import.meta.url), 'utf8');
const source = [
  searchEverywhereSource,
  workspaceSource,
  await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'),
].join('\n');

function searchEverywhereComponent() {
  return searchEverywhereSource.slice(searchEverywhereSource.indexOf('function SearchEverywhere('));
}

test('Search Everywhere merges dirty Monaco buffers into host text results', () => {
  const merge = loadTypeScriptExpression(terminalSource, extractFunctionSource(terminalSource, 'mergeFindToolDirtyMatches'), {
    findToolPathMatchesScope: () => true,
    fileExtensionFilterMatches: () => true,
    textSearchFileMatches: (path, _content, query, _options, mtime) => ({
      matches: [
        {
          path,
          line: 1,
          column: 5,
          preview: 'new needle',
          dirty: true,
          mtime,
        },
      ],
      truncated: false,
    }),
  });
  const result = merge(
    [{ path: 'a.ts', line: 1, column: 1, preview: 'old needle' }],
    [{ path: 'a.ts', content: 'new needle\n', mtime: 1 }],
    'needle',
    {},
    {},
    200,
  );
  assert.deepEqual(result.matches, [
    {
      path: 'a.ts',
      line: 1,
      column: 5,
      preview: 'new needle',
      dirty: true,
      mtime: 1,
    },
  ]);
  assert.equal(result.truncated, false);
});

test('Dirty Search Everywhere text results preview the live Monaco content', () => {
  const dialog = searchEverywhereComponent();
  assert.match(
    dialog,
    /activeResult\.kind === 'text' && activeResult\.dirty === true/u,
  );
  assert.match(
    dialog,
    /\(Array\.isArray\(openFiles\) \? openFiles : \[\]\)\.find\(\(file\) => file\?\.path === activeResult\.path\)/u,
  );
  assert.match(
    dialog,
    /setPreviewState\(\{\s+loading: false,\s+kind: activeResult\.kind,\s+path: activeResult\.path,\s+content:/u,
  );
});

test('Editor passes the shared dirty-state reference into Search Everywhere', () => {
  assert.match(
    source,
    /<SearchEverywhere[\s\S]*?openFiles=\{openFiles\}/u,
  );
});

test('Dirty merge keeps the same options and bounded cap as Find in Files', () => {
  const merge = source.slice(
    source.indexOf('const merged = mergeFindToolDirtyMatches('),
    source.indexOf('setSearchEverywhere((current) =>', source.indexOf('const merged = mergeFindToolDirtyMatches(')),
  );
  assert.match(merge, /caseSensitive: searchEverywhere\?\.caseSensitive === true/u);
  assert.match(merge, /wholeWords: searchEverywhere\?\.wholeWords === true/u);
  assert.match(merge, /regex: searchEverywhere\?\.regex === true/u);
  assert.match(merge, /fileMask: searchEverywhere\?\.fileMask/u);
  assert.match(merge, /200,/u);
});
