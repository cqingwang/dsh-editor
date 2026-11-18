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

test('Markdown mode switch reuses the document model type', async () => {
  const component = await read('src/client/components/editor/MarkdownModeSwitch.tsx');
  const build = await read('scripts/build-client.mjs');
  const domainCore = await read('tests/fixtures/legacy/domain-core.legacy.js');

  assert.match(model, /export type MarkdownMode = 'code' \| 'split' \| 'preview'/u);
  assert.match(component, /import type \{ MarkdownMode \} from '\.\/editor-document-model'/u);
  assert.match(build, /editor-document-model\.ts/u);
  assert.match(build, /editorDocumentModelModule/u);
  assert.doesNotMatch(domainCore, /const MARKDOWN_MODES/u);
  assert.doesNotMatch(domainCore, /function normalizeMarkdownMode\(/u);
  assert.doesNotMatch(domainCore, /function isMarkdownPath\(/u);
});
