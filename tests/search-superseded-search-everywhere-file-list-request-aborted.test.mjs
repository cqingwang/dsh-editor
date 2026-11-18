import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

function requestFunction() {
  const start = client.indexOf('const requestSearchEverywhereFiles = React.useCallback((includeNonProject) => {');
  const end = client.indexOf('      }, []);', start);
  assert.ok(start >= 0 && end > start, 'requestSearchEverywhereFiles is missing');
  return client.slice(start, end);
}

test('a superseded Search Everywhere file-list request is aborted', () => {
  const request = requestFunction();
  assert.match(request, /searchEverywhereFilesAbortRef\.current\?\.abort\(\)/u);
  assert.match(request, /const searchAbort = new AbortController\(\);/u);
  assert.match(request, /searchEverywhereFilesAbortRef\.current = searchAbort/u);
  assert.match(request, /callFs\(\s*\{ op: 'files', includeExcluded: includeNonProject === true \},\s*\{ signal: searchAbort\.signal \},?\s*\)/u);
  assert.match(request, /failure\?\.name === 'AbortError'[\s\S]*?return;/u);
});

test('workspace changes abort the file-list request before resetting Search Everywhere', () => {
  const effectStart = client.indexOf('React.useEffect(() => {\n        searchEverywhereFilesRequestRef.current += 1;');
  const effectEnd = client.indexOf('      }, [root]);', effectStart);
  assert.ok(effectStart >= 0 && effectEnd > effectStart);
  const effect = client.slice(effectStart, effectEnd);
  assert.match(effect, /searchEverywhereFilesAbortRef\.current\?\.abort\(\)/u);
});
