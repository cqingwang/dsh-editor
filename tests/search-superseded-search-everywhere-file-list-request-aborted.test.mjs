import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client =
  (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const requestSource = await readFile(
  new URL('../src/client/components/search/use-search-everywhere-file-candidates.ts', import.meta.url),
  'utf8',
);

function requestFunction() {
  const start = requestSource.indexOf('const requestFiles = React.useCallback');
  const end = requestSource.indexOf('  const updateFileMask = React.useCallback', start);
  assert.ok(start >= 0 && end > start, 'requestFiles is missing');
  return requestSource.slice(start, end);
}

test('a superseded Search Everywhere file-list request is aborted', () => {
  const request = requestFunction();
  assert.match(request, /abortRef\.current\?\.abort\(\)/u);
  assert.match(request, /const searchAbort = new AbortController\(\);/u);
  assert.match(request, /abortRef\.current = searchAbort/u);
  assert.match(
    request,
    /callFs(?:<[^>]+>)?\(\s*\{\s*op: 'files',\s*includeExcluded: includeNonProject === true,\s*respectGitIgnore: true,\s*fileMask: normalizedFileMask,\s*searchDirectoryRules,\s*searchIndex: true,?\s*\},\s*\{ signal: searchAbort\.signal \},?\s*\)/u,
  );
  assert.match(request, /failure\?\.name === 'AbortError'[\s\S]*?return;/u);
});

test('workspace changes abort the file-list request before resetting Search Everywhere', () => {
  const effectStart = client.indexOf('const previousWorkspaceSearchRootRef = React.useRef(root);');
  const effectEnd = client.indexOf(
    '}, [cancelWorkspaceSearchRequests, clearSearchEverywhereFileCache, root]);',
    effectStart,
  );
  assert.ok(effectStart >= 0 && effectEnd > effectStart);
  const effect = client.slice(effectStart, effectEnd);
  const cancelStart = client.indexOf('const cancelWorkspaceSearchRequests = React.useCallback(() => {');
  const cancelEnd = client.indexOf('const previousWorkspaceSearchRootRef =', cancelStart);
  assert.ok(cancelStart >= 0 && cancelEnd > cancelStart);
  const cancel = client.slice(cancelStart, cancelEnd);
  assert.match(cancel, /abortSearchEverywhereFileRequests\(\)/u);
  assert.ok(
    effect.indexOf('cancelWorkspaceSearchRequests()') < effect.indexOf('setSearchEverywhere(null)'),
    'workspace requests must be cancelled before the UI reset',
  );
});
