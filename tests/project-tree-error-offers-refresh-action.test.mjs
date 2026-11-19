import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url),
  'utf8',
);

test('Project tree errors expose a direct refresh action that returns focus to the tree', () => {
  const start = source.indexOf("state='error'");
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 1200);

  assert.match(block, /onClick=\{\(\) => \{[\s\S]*?onRefresh\(\);[\s\S]*?treeRef\.current\?\.focus\(\)/u);
  assert.match(block, /\{t\('editor\.refresh'\)\}/u);
});
