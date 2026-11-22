import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

function searchEverywhereEffect() {
  const start = client.indexOf('React.useEffect(() => {\n    if (searchEverywhere === null ||');
  const end = client.indexOf('  }, [\n    searchEverywhereTextQuery,', start);
  assert.ok(start >= 0 && end > start, 'Search Everywhere text-search effect is missing');
  return client.slice(start, end);
}

test('Search Everywhere cancels superseded text searches', () => {
  const effect = searchEverywhereEffect();
  assert.match(effect, /const searchAbort = new AbortController\(\);/u);
  assert.match(effect, /callFs(?:<[^>]+>)?\(\s*\{[\s\S]*?signal: searchAbort\.signal/u);
  assert.match(effect, /window\.clearTimeout\(timer\);\s+searchAbort\.abort\(\);/u);
  assert.match(effect, /failure\?\.name === 'AbortError'[\s\S]*?return;/u);
});

test('Search Everywhere keeps request-id invalidation as a second guard', () => {
  const effect = searchEverywhereEffect();
  assert.match(effect, /const requestId = \+\+searchTextRequestRef\.current/u);
  assert.ok((effect.match(/searchTextRequestRef\.current !== requestId/g) ?? []).length >= 2);
});
