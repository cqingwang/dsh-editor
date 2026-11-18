import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('./fixtures/find-tool.legacy.js', import.meta.url), 'utf8'));
const findTool = client.slice(
  client.indexOf('function FindToolWindow('),
  client.indexOf('/* QUICK_OPEN_BOUNDARY */'),
);

test('Find Preview aborts superseded file reads', () => {
  const start = findTool.indexOf('React.useEffect(() => {\n        if (!previewOpen || active === null');
  const end = findTool.indexOf('      }, [previewOpen, active?.rowKey, state.loading]);', start);
  assert.ok(start >= 0 && end > start, 'Find Preview effect is missing');
  const effect = findTool.slice(start, end);
  assert.match(effect, /const previewAbort = new AbortController\(\);/u);
  assert.match(effect, /callFs\(\{ op: 'read', path: active\.path \}, \{ signal: previewAbort\.signal \}\)/u);
  assert.match(effect, /failure\?\.name === 'AbortError'[\s\S]*?return;/u);
  assert.match(effect, /cancelled = true;\s+previewAbort\.abort\(\);/u);
});

test('Find Preview keeps its active-row identity guard', () => {
  assert.match(findTool, /if \(cancelled\) return;/gu);
});
