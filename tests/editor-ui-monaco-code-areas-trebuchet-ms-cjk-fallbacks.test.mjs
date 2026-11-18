import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction, transpileTypeScriptFunction } from './ts-source.mjs';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const previewSource = await readFile(
  new URL('../src/client/components/editor/MarkdownPreviewPane.tsx', import.meta.url),
  'utf8',
);
const mainPaneSource = await readFile(
  new URL('../src/client/components/editor/EditorMainPane.tsx', import.meta.url),
  'utf8',
);
const pathModelSource = await readFile(
  new URL('../src/client/components/editor/editor-path-model.ts', import.meta.url),
  'utf8',
);
const documentModelSource = await readFile(
  new URL('../src/client/components/editor/editor-document-model.ts', import.meta.url),
  'utf8',
);

test('Editor UI and Monaco code areas use Trebuchet MS with CJK fallbacks', () => {
  assert.match(source, /const EDITOR_UI_FONT = '"Trebuchet MS", "PingFang SC"/);
  assert.match(source, /fontFamily: EDITOR_UI_FONT/);
  assert.match(source, /\[data-dsh-editor-workspace\][\s\S]*?font-family: "Trebuchet MS"/);
});

const normalizeMarkdownMode = loadTypeScriptFunction(documentModelSource, 'normalizeMarkdownMode');
const isMarkdownPath = loadTypeScriptFunction(documentModelSource, 'isMarkdownPath');
const resolveMarkdownLink = new Function(
  `${transpileTypeScriptFunction(pathModelSource, 'dirname')}
${transpileTypeScriptFunction(pathModelSource, 'resolveMarkdownLink')}
return resolveMarkdownLink;`,
)();

test('Markdown mode accepts only the three IDEA modes', () => {
  assert.equal(normalizeMarkdownMode('code'), 'code');
  assert.equal(normalizeMarkdownMode('split'), 'split');
  assert.equal(normalizeMarkdownMode('preview'), 'preview');
  assert.equal(normalizeMarkdownMode('invalid'), 'code');
  assert.equal(normalizeMarkdownMode(null), 'code');
});

test('Markdown detection is extension-based and case-insensitive', () => {
  assert.equal(isMarkdownPath('README.md'), true);
  assert.equal(isMarkdownPath('docs/Guide.MARKDOWN'), true);
  assert.equal(isMarkdownPath('page.mdx'), true);
  assert.equal(isMarkdownPath('src/index.ts'), false);
  assert.equal(isMarkdownPath(''), false);
});

test('Markdown local links resolve relative to the document and cannot escape the workspace', () => {
  assert.equal(resolveMarkdownLink('docs/guide/README.md', '../image.png'), 'docs/image.png');
  assert.equal(resolveMarkdownLink('README.md', 'docs/note%20one.md#section'), 'docs/note one.md');
  assert.equal(resolveMarkdownLink('README.md', 'https://example.com'), null);
  assert.equal(resolveMarkdownLink('README.md', '#section'), null);
  assert.equal(resolveMarkdownLink('README.md', '../../../outside.md'), null);
});

test('the Markdown editor exposes the three IDEA mode buttons and persists the choice', () => {
  assert.match(source, /dsh-editor\.markdown\.mode/);
  assert.match(source, /markdownModeCode/);
  assert.match(source, /markdownModeSplit/);
  assert.match(source, /markdownModePreview/);
  assert.match(source, /role: 'group'/);
});

test('Markdown preview reuses the host MarkdownText primitive', () => {
  assert.match(previewSource, /function MarkdownPreviewPane\(/);
  assert.match(previewSource, /primitives\?\.MarkdownText/);
  assert.match(previewSource, /<MarkdownText/);
  assert.match(previewSource, /data-dsh-markdown-preview/);
});

test('the code area keeps both surfaces mounted for code, split and preview modes', () => {
  assert.match(mainPaneSource, /data-dsh-markdown-editor-pane/);
  assert.match(source, /editorHidden: activeImage \|\| effectiveMarkdownMode === 'preview'/);
  assert.match(source, /data-dsh-markdown-preview-pane/);
  assert.match(source, /effectiveMarkdownMode === 'preview'/);
  assert.match(source, /markdownPreviewVisible/);
});
