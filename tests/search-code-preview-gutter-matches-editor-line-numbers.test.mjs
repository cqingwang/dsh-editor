import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const inlineStyles = await readFile(new URL('../src/client/inline-styles.ts', import.meta.url), 'utf8');
const injectedCss = await readFile(new URL('../src/client/injected-css.ts', import.meta.url), 'utf8');
const findTool = await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8');
const searchEverywhere = await readFile(
  new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url),
  'utf8',
);

test('Find and Search Everywhere reuse one code-preview gutter style', () => {
  assert.match(findTool, /style=\{styles\.codePreviewGutter\}/u);
  assert.match(searchEverywhere, /style=\{styles\.codePreviewGutter\}/u);
  assert.match(
    inlineStyles,
    /codePreviewGutter: \{[\s\S]*?fontFamily: EDITOR_CODE_FONT,[\s\S]*?fontSize: EDITOR_FONT_SIZE_SCALE\.caption,[\s\S]*?fontWeight: EDITOR_BASE_FONT_WEIGHT,/u,
  );
});

test('preview gutters use the same compact line-number size as Monaco', () => {
  assert.match(
    injectedCss,
    /\.monaco-editor \.margin-view-overlays \.line-numbers \{[\s\S]*?font-size: var\(--dsh-editor-font-size-caption, 10px\) !important;/u,
  );
  assert.match(inlineStyles, /codePreviewGutter: \{[\s\S]*?fontSize: EDITOR_FONT_SIZE_SCALE\.caption/u);
});
