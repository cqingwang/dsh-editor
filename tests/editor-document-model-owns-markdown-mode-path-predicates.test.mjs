import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const model = await read('src/client/components/editor/editor-document-model.ts');

test('editor document model owns Markdown mode and path predicates', () => {
  const normalizeMarkdownMode = loadTypeScriptFunction(model, 'normalizeMarkdownMode');
  const isMarkdownPath = loadTypeScriptFunction(model, 'isMarkdownPath');

  assert.equal(normalizeMarkdownMode('code'), 'code');
  assert.equal(normalizeMarkdownMode('split'), 'split');
  assert.equal(normalizeMarkdownMode('preview'), 'preview');
  assert.equal(normalizeMarkdownMode('invalid'), 'code');
  assert.equal(normalizeMarkdownMode(null), 'code');
  assert.equal(isMarkdownPath('README.md'), true);
  assert.equal(isMarkdownPath('docs/Guide.MARKDOWN'), true);
  assert.equal(isMarkdownPath('page.mdx'), true);
  assert.equal(isMarkdownPath('src/index.ts'), false);
});
