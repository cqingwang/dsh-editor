import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8')));

function searchEverywhereComponent() {
  return source.slice(source.indexOf('function SearchEverywhere('), source.lastIndexOf('function QuickOpen('));
}

test('Search Everywhere merges dirty Monaco buffers into host text results', () => {
  assert.match(source, /React\.createElement\(SearchEverywhere, \{[\s\S]*?openFiles,/u);
  assert.match(source, /const dirtyFiles = \(Array\.isArray\(openFiles\) \? openFiles : \[\]\)\.filter/u);
  assert.match(source, /const merged = mergeFindToolDirtyMatches\(/u);
  assert.match(source, /textMatches: merged\.matches/u);
  assert.match(source, /textTruncated: value\?\.truncated === true \|\| merged\.truncated/u);
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
    /React\.createElement\(SearchEverywhere, \{[\s\S]*?openFiles,/u,
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
