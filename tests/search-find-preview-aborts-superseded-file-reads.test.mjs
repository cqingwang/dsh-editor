import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));
const findTool = client.slice(
  client.lastIndexOf('function FindToolWindowView('),
  client.indexOf('const FindToolWindow = FindToolWindowView;', client.lastIndexOf('function FindToolWindowView(')),
);

test('Find Preview aborts superseded file reads', () => {
  const start = findTool.indexOf('React.useEffect(() => {\n    if (!previewOpen || active === null');
  const end = findTool.indexOf(
    '  }, [previewOpen, active?.rowKey, active?.mtime, activeLivePreviewContent, state.loading, t]);',
    start,
  );
  assert.ok(start >= 0 && end > start, 'Find Preview effect is missing');
  const effect = findTool.slice(start, end);
  assert.match(effect, /const previewAbort = new AbortController\(\);/u);
  assert.match(
    effect,
    /callFs(?:<[^>]+>)?\(\s+\{\s+op: 'read',\s+path: active\.path,\s+\},\s+\{\s+signal: previewAbort\.signal,\s+\},\s+\)/u,
  );
  assert.match(effect, /failure\?\.name === 'AbortError'[\s\S]*?return;/u);
  assert.match(effect, /cancelled = true;\s+previewAbort\.abort\(\);/u);
});

test('Find Preview keeps its active-row identity guard', () => {
  assert.match(findTool, /if \(cancelled\) return;/gu);
});
