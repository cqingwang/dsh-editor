import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extract(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  return source.slice(start, index + 1);
}

test('Editor UI and Monaco code areas use Trebuchet MS with CJK fallbacks', () => {
  assert.match(source, /const EDITOR_UI_FONT = '"Trebuchet MS", "PingFang SC"/);
  assert.match(source, /fontFamily: EDITOR_UI_FONT/);
  assert.match(source, /\[data-dsh-editor-workspace\][\s\S]*?font-family: "Trebuchet MS"/);
});

const normalizeMarkdownMode = new Function(
  `const MARKDOWN_MODES = new Set(['code', 'split', 'preview']);\n${extract('normalizeMarkdownMode')}\nreturn normalizeMarkdownMode;`,
)();
const isMarkdownPath = new Function(
  `${extract('isMarkdownPath')}\nreturn isMarkdownPath;`,
)();
const resolveMarkdownLink = new Function(
  `function dirname(path) { const index = path.lastIndexOf('/'); return index < 0 ? '' : path.slice(0, index); }\n${extract('resolveMarkdownLink')}\nreturn resolveMarkdownLink;`,
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
  assert.match(source, /function MarkdownPreviewPane\(/);
  assert.match(source, /primitives\?\.MarkdownText/);
  assert.match(source, /React\.createElement\(MarkdownText, \{/);
  assert.match(source, /data-dsh-markdown-preview/);
});

test('the code area keeps both surfaces mounted for code, split and preview modes', () => {
  assert.match(source, /data-dsh-markdown-editor-pane/);
  assert.match(source, /data-dsh-markdown-preview-pane/);
  assert.match(source, /effectiveMarkdownMode === 'preview'/);
  assert.match(source, /markdownPreviewVisible/);
});
