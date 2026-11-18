import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = (await readFile(new URL('../src/client/components/diff/DiffPreview.tsx', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const diffStart = client.indexOf('function DiffPreview(');
const diff = client.slice(diffStart, client.indexOf('export { DiffPreview };', diffStart));

test('git requests accept an external abort signal without losing timeout protection', () => {
  const callGit = client.slice(
    client.indexOf('async function callGit('),
    client.indexOf('/** Pick a Monaco theme', client.indexOf('async function callGit(')),
  );
  assert.match(callGit, /async function callGit(?:<[^>]+>)?\(\s*payload,\s*options = \{\},?\s*\)/u);
  assert.match(callGit, /options\.signal\?\.addEventListener\('abort', abortExternal, \{ once: true \}\)/u);
  assert.match(callGit, /options\.signal\?\.removeEventListener\('abort', abortExternal\)/u);
  assert.match(callGit, /let timedOut = false;/u);
  assert.match(callGit, /if \(timedOut\) throw new Error\('git request timed out after 20 seconds'\);/u);
});

test('aborting the external signal rejects the in-flight git request', async () => {
  const callGitSource = client.slice(
    client.indexOf('async function callGit('),
    client.indexOf('/** Pick a Monaco theme', client.indexOf('async function callGit(')),
  );
  const callGit = new Function(
    'currentSessionId',
    'currentEditorWorkspaceId',
    'fetch',
    'window',
    `${callGitSource}\nreturn callGit;`,
  )(
    () => 'session',
    () => '',
    async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    }),
    { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout },
  );
  const external = new AbortController();
  const request = callGit({ op: 'diff' }, { signal: external.signal });
  external.abort();
  await assert.rejects(request, (failure) => failure?.name === 'AbortError');
});

test('DiffPreview aborts a superseded git diff load', () => {
  const marker = diff.indexOf('const previousViewKey = diffViewKeyRef.current;');
  const start = diff.lastIndexOf('React.useEffect(() => {', marker);
  const end = diff.indexOf(
    '  }, [captureDiffViewState, persistRestored, reloadGeneration, restoreDiffViewState, target]);',
    start,
  );
  assert.ok(start >= 0 && end > start, 'Diff load effect is missing');
  const effect = diff.slice(start, end);
  assert.match(effect, /const diffAbort = new AbortController\(\);/u);
  assert.match(effect, /callGit(?:<[^>]+>)?\(request, \{\s+signal: diffAbort\.signal,\s+\}\)/u);
  assert.match(effect, /failure\?\.name === 'AbortError'[\s\S]*?return;/u);
  assert.match(effect, /cancelled = true;\s+diffAbort\.abort\(\);/u);
});
