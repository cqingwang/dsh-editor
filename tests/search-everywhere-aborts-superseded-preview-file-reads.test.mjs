import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const searchEverywhere = client.slice(
  client.indexOf('function SearchEverywhere('),
  client.indexOf('function FindToolWindowView('),
);

test('Search Everywhere aborts superseded Preview file reads', () => {
  const start = searchEverywhere.indexOf('React.useEffect(() => {\n    if (!previewOpen)');
  const end = searchEverywhere.indexOf(
    '  }, [previewOpen, activeResult?.rowKey, activeResult?.dirty, openFiles]);',
    start,
  );
  assert.ok(start >= 0 && end > start, 'Preview effect is missing');
  const effect = searchEverywhere.slice(start, end);
  assert.match(effect, /const previewAbort = new AbortController\(\);/u);
  assert.match(
    effect,
    /callFs(?:<[^>]+>)?\(\s+\{\s+op: 'read',\s+path: activeResult\.path,\s+\},\s+\{\s+signal: previewAbort\.signal,\s+\},\s+\)/u,
  );
  assert.match(effect, /failure\?\.name === 'AbortError'[\s\S]*?return;/u);
  assert.match(effect, /cancelled = true;\s+previewAbort\.abort\(\);/u);
});

test('Search Everywhere keeps the existing result identity guard', () => {
  assert.match(searchEverywhere, /if \(cancelled\) return;/gu);
});
