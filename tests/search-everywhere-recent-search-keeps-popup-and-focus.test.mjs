import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url),
  'utf8',
);

const historyStart = source.indexOf('const historyResults: SearchResult[] = React.useMemo(');
const historyEnd = source.indexOf('const results: SearchResult[] = React.useMemo(', historyStart);
const historyResults = source.slice(historyStart, historyEnd);

test('recent search rows keep Search Everywhere open while restoring the query', () => {
  assert.ok(historyStart >= 0 && historyEnd > historyStart, 'historyResults must remain a real result builder');
  assert.match(historyResults, /keepOpen: true/u);
  assert.match(historyResults, /run: \(\) => \{/u);
  assert.match(historyResults, /onQuery\(entry\);/u);
  assert.match(historyResults, /searchInputRef\.current\?\.focus\?\.\(\)/u);
});
