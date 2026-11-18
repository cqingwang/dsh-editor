import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('all Monaco editing surfaces share the global 20px code line height', () => {
  assert.match(source, /const EDITOR_CODE_LINE_HEIGHT = 20;/u);
  assert.equal((source.match(/lineHeight: EDITOR_CODE_LINE_HEIGHT/gu) ?? []).length, 3);
  assert.doesNotMatch(source, /lineHeight: 19,/u);
});
