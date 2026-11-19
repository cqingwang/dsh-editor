import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(
  new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url),
  'utf8',
);

test('Search Everywhere derives provider results only from their real inputs', () => {
  assert.match(component, /const actionMatches: SearchResult\[\] = React\.useMemo\(/u);
  assert.match(component, /const fileMatches: SearchResult\[\] = React\.useMemo\(/u);
  assert.match(component, /const textResults: SearchResult\[\] = React\.useMemo\(/u);
  assert.match(component, /const historyResults: SearchResult\[\] = React\.useMemo\(/u);
  assert.match(component, /const results: SearchResult\[\] = React\.useMemo\(/u);
});
