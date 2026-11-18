import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const model = await read('src/client/components/editor/markdown-scroll-model.ts');

test('Markdown scroll model clamps invalid ratios and box measurements', () => {
  const ratio = loadTypeScriptFunction(model, 'markdownScrollRatio');
  const top = loadTypeScriptFunction(model, 'markdownScrollTopForRatio');

  assert.equal(ratio({ scrollTop: 250, scrollHeight: 1000, clientHeight: 500 }), 0.5);
  assert.equal(ratio({ scrollTop: 900, scrollHeight: 1000, clientHeight: 500 }), 1);
  assert.equal(ratio({ scrollTop: 2, scrollHeight: 400, clientHeight: 500 }), 0);
  assert.equal(top(0.5, { scrollHeight: 1000, clientHeight: 500 }), 250);
  assert.equal(top(1.4, { scrollHeight: 1000, clientHeight: 500 }), 500);
  assert.equal(top(-1, { scrollHeight: 1000, clientHeight: 500 }), 0);
});
