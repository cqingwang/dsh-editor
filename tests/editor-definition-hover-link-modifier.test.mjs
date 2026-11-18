import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const editorCore = await read('src/client/editor-core.ts');
const injectedCss = await read('src/client/injected-css.ts');

test('Command or Control hover paints a pointer link decoration over identifiers', () => {
  assert.match(editorCore, /const definitionHoverDecorations = editor\.createDecorationsCollection\?\.\(\[\]\)/u);
  assert.match(editorCore, /editor\.onMouseMove\?\.\(\(event\) =>/u);
  assert.match(editorCore, /browserEvent\?\.metaKey === true \|\| browserEvent\?\.ctrlKey === true/u);
  assert.match(editorCore, /getWordAtPosition\?\.\(position\)/u);
  assert.match(editorCore, /inlineClassName: 'dsh-editor-definition-link'/u);
  assert.match(editorCore, /new monaco\.Range\(/u);
});

test('The link decoration follows modifier keydown/keyup and clears on leave or dispose', () => {
  assert.match(editorCore, /event\.key === 'Meta' \|\| event\.key === 'Control'/u);
  assert.match(editorCore, /refreshDefinitionHover\(true\)/u);
  assert.match(editorCore, /refreshDefinitionHover\(false\)/u);
  assert.match(editorCore, /definitionHoverContainer\?\.addEventListener\('mouseleave', clearDefinitionHover\)/u);
  assert.match(editorCore, /definitionHoverDecorations\?\.clear\?\.\(\)/u);
  assert.match(editorCore, /definitionHoverWindow\?\.removeEventListener\('keydown', onDefinitionModifierKeyDown, true\)/u);
  assert.match(editorCore, /definitionHoverWindow\?\.removeEventListener\('keyup', onDefinitionModifierKeyUp, true\)/u);
});

test('Definition hover CSS uses a visible IDEA-like underline and pointer cursor', () => {
  assert.match(
    injectedCss,
    /\.monaco-editor \.view-lines \.dsh-editor-definition-link \{[\s\S]*?cursor: pointer !important;[\s\S]*?text-decoration: underline !important;[\s\S]*?text-underline-offset: 2px;/u,
  );
});
