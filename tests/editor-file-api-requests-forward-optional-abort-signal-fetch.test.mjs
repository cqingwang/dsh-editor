import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const editorCoreSource = await readFile(new URL('../src/client/editor-core.ts', import.meta.url), 'utf8');
const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const client = [editorCoreSource, workspaceSource].join('\n');

function extractFunction(name) {
  return transpileTypeScriptFunction(editorCoreSource, name);
}

test('file API requests forward an optional abort signal to fetch', () => {
  const requestFileApi = new Function(
    'fetch',
    'currentSessionId',
    'currentEditorWorkspaceId',
    `${extractFunction('requestFileApi')}\nreturn async (payload, options) => requestFileApi(payload, options);`,
  )(
    async (url, options) => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, value: { signal: options.signal } }),
    }),
    () => 'session',
    () => '',
  );
  return requestFileApi({ op: 'searchText' }, { signal: 'abort-signal' }).then(({ data }) => {
    assert.equal(data.value.signal, 'abort-signal');
  });
});

test('callFs forwards request options without changing existing callers', () => {
  const callFs = extractFunction('callFs');
  assert.match(callFs, /function callFs\(payload, options = \{\}\)/u);
  assert.match(callFs, /requestFileApi\(payload, options\)/u);
});

test('Find aborts in-flight text searches when its generation is replaced', () => {
  const start = workspaceSource.indexOf('React.useEffect(() => {\n    if (!findToolOpen');
  const end = workspaceSource.indexOf('  }, [\n    findToolOpen,', start);
  assert.ok(start >= 0 && end > start);
  const effect = workspaceSource.slice(start, end);
  assert.match(effect, /const searchAbort = new AbortController\(\);/u);
  assert.match(effect, /callFs\(\s*\{[\s\S]*?signal: searchAbort\.signal/u);
  assert.match(effect, /window\.clearTimeout\(timer\);\s+searchAbort\.abort\(\);/u);
  assert.match(effect, /failure\?\.name === 'AbortError'[\s\S]*?return;/u);
});
