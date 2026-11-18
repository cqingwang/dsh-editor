import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const model = await read('src/client/components/editor/editor-path-model.ts');

function loadResolver() {
  return new Function(
    `${transpileTypeScriptFunction(model, 'dirname')}
${transpileTypeScriptFunction(model, 'resolveMarkdownLink')}
return resolveMarkdownLink;`,
  )();
}

test('Markdown link resolver is self-contained in the TS path model', async () => {
  const component = await read('src/client/components/editor/MarkdownPreviewPane.tsx');

  assert.match(model, /export function dirname\(/u);
  assert.match(model, /export function resolveMarkdownLink\(/u);
  assert.match(component, /resolveMarkdownLink\(path, target\)/u);
});

test('Markdown local links resolve safely without escaping the workspace', () => {
  const resolveMarkdownLink = loadResolver();

  assert.equal(resolveMarkdownLink('docs/guide/README.md', '../image.png'), 'docs/image.png');
  assert.equal(resolveMarkdownLink('README.md', 'docs/note%20one.md#section'), 'docs/note one.md');
  assert.equal(resolveMarkdownLink('README.md', 'docs\\windows\\note.md?plain=1'), 'docs/windows/note.md');
  assert.equal(resolveMarkdownLink('README.md', 'https://example.com'), null);
  assert.equal(resolveMarkdownLink('README.md', '//example.com/a.md'), null);
  assert.equal(resolveMarkdownLink('README.md', '#section'), null);
  assert.equal(resolveMarkdownLink('README.md', '../../../outside.md'), null);
  assert.equal(resolveMarkdownLink(null, 'docs/a.md'), null);
});
