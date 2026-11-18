import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const model = await readFile(
  new URL('../src/client/components/editor/markdown-scroll-model.ts', import.meta.url),
  'utf8',
);

const scrollRatio = loadTypeScriptFunction(model, 'markdownScrollRatio');
const scrollTopForRatio = loadTypeScriptFunction(model, 'markdownScrollTopForRatio');

test('Markdown scroll ratios clamp invalid and overscrolled values', () => {
  assert.equal(scrollRatio({ scrollTop: 0, scrollHeight: 1000, clientHeight: 500 }), 0);
  assert.equal(scrollRatio({ scrollTop: 250, scrollHeight: 1000, clientHeight: 500 }), 0.5);
  assert.equal(scrollRatio({ scrollTop: 500, scrollHeight: 1000, clientHeight: 500 }), 1);
  assert.equal(scrollRatio({ scrollTop: 900, scrollHeight: 1000, clientHeight: 500 }), 1);
  assert.equal(scrollRatio({ scrollTop: -20, scrollHeight: 1000, clientHeight: 500 }), 0);
  assert.equal(scrollRatio({ scrollTop: 2, scrollHeight: 400, clientHeight: 500 }), 0);
});

test('Markdown scroll positions round-trip through the normalized ratio', () => {
  assert.equal(scrollTopForRatio(0.5, { scrollHeight: 1000, clientHeight: 500 }), 250);
  assert.equal(scrollTopForRatio(1.4, { scrollHeight: 1000, clientHeight: 500 }), 500);
  assert.equal(scrollTopForRatio(-1, { scrollHeight: 1000, clientHeight: 500 }), 0);
  assert.equal(scrollTopForRatio(0.4, { scrollHeight: 400, clientHeight: 500 }), 0);
});

test('split Markdown mode wires cycle-safe editor and preview scrolling', () => {
  assert.match(source, /markdownPreviewRef/);
  assert.match(source, /onDidScrollChange/);
  assert.match(source, /addEventListener\('scroll'/);
  assert.match(source, /markdownScrollRatio/);
  assert.match(source, /markdownScrollTopForRatio/);
  assert.match(source, /effectiveMarkdownMode !== 'split'/);
});
