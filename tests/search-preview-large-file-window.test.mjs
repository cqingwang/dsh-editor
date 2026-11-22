import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { readTextFilePreview } from '../lib/index.js';

test('large search previews return only the window around the matched line', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-preview-window-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const lineCount = 70_000;
  const targetLine = 35_000;
  const padding = 'x'.repeat(96);
  const lines = Array.from({ length: lineCount }, (_, index) =>
    index + 1 === targetLine ? `        registerDataSetObserver(${padding})` : `line ${index + 1} ${padding}`,
  );
  await writeFile(join(root, 'current.txt'), `${lines.join('\n')}\n`, 'utf8');

  const preview = await readTextFilePreview(root, 'current.txt', targetLine, 3);

  assert.equal(preview.startLine, targetLine - 3);
  assert.equal(preview.endLine, targetLine + 3);
  assert.equal(preview.truncatedBefore, true);
  assert.equal(preview.truncatedAfter, true);
  assert.match(preview.content, /registerDataSetObserver/u);
  assert.ok(preview.content.length < 2_000, 'must not return the whole 6+ MiB file');
  assert.ok(preview.size > 4 * 1024 * 1024);
});

test('Search Everywhere and Find request bounded search previews', async () => {
  const searchEverywhere = await readFile(
    new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url),
    'utf8',
  );
  const findTool = await readFile(
    new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url),
    'utf8',
  );
  for (const source of [searchEverywhere, findTool]) {
    assert.match(source, /op: 'readPreview'/u);
    assert.match(source, /line: active(?:Result)?\.line \?\? 1/u);
    assert.match(source, /radius: 200/u);
  }
});
