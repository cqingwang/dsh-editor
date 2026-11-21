import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const inlineStyles = await readFile(new URL('../src/client/inline-styles.ts', import.meta.url), 'utf8');
const runtimeStyles = await readFile(new URL('../src/client/ui/styles.ts', import.meta.url), 'utf8');

function commitStatusStackBlock(source) {
  const start = source.indexOf('commitStatusStack: {');
  assert.notEqual(start, -1);
  return source.slice(start, source.indexOf('commitNotice:', start));
}

test('Commit status stack is height-bounded and scrolls internally', () => {
  for (const source of [inlineStyles, runtimeStyles]) {
    const block = commitStatusStackBlock(source);
    assert.match(block, /maxHeight: 'min\(38vh, 220px\)'/u);
    assert.match(block, /overflowY: 'auto'/u);
    assert.match(block, /overscrollBehavior: 'contain'/u);
    assert.match(block, /flex: 'none'/u);
  }
});
