import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const declaration = client.indexOf(`function ${name}(`);
  assert.notEqual(declaration, -1, `${name} is missing`);
  const asyncStart = client.lastIndexOf('async ', declaration);
  const start = asyncStart >= 0 && declaration - asyncStart === 'async '.length ? asyncStart : declaration;
  const openParen = client.indexOf('(', declaration);
  let parenDepth = 0;
  let closeParen = -1;
  for (let index = openParen; index < client.length; index += 1) {
    if (client[index] === '(') parenDepth += 1;
    if (client[index] === ')') parenDepth -= 1;
    if (parenDepth === 0) {
      closeParen = index;
      break;
    }
  }
  assert.notEqual(closeParen, -1, `${name} has no closing parameter list`);
  const bodyStart = client.indexOf('{', closeParen);
  let depth = 0;
  for (let index = bodyStart; index < client.length; index += 1) {
    if (client[index] === '{') depth += 1;
    if (client[index] === '}') depth -= 1;
    if (depth === 0) return client.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
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
  const start = client.indexOf('React.useEffect(() => {\n        if (!findToolOpen');
  const end = client.indexOf('      }, [\n        findToolOpen,', start);
  assert.ok(start >= 0 && end > start);
  const effect = client.slice(start, end);
  assert.match(effect, /const searchAbort = new AbortController\(\);/u);
  assert.match(effect, /callFs\(\s*\{[\s\S]*?signal: searchAbort\.signal/u);
  assert.match(effect, /window\.clearTimeout\(timer\);\s+searchAbort\.abort\(\);/u);
  assert.match(effect, /failure\?\.name === 'AbortError'[\s\S]*?return;/u);
});
