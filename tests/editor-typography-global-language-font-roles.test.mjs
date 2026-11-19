import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const model = await read('src/client/components/editor/editor-style-model.ts');
const injectedCss = await read('src/client/injected-css.ts');
const controller = await read('src/client/controller.ts');
const inlineStyles = await read('src/client/inline-styles.ts');
const uiStyles = await read('src/client/ui/styles.ts');
const entryIcon = await read('src/client/components/ui/EntryIcon.tsx');

function styleBlock(source, startKey, endKey) {
  const start = source.indexOf(`${startKey}: {`);
  const end = source.indexOf(`${endKey}: {`, start);
  assert.ok(start >= 0 && end > start, `${startKey} block is missing`);
  return source.slice(start, end);
}

test('editor typography has one language-aware family, scale and semantic role source', () => {
  assert.match(model, /--dsh-editor-font-ui/u);
  assert.match(model, /--dsh-editor-font-code/u);
  assert.match(model, /EDITOR_FONT_SIZE_SCALE/u);
  assert.match(model, /EDITOR_RESPONSIVE_FONT_SIZE/u);
  assert.match(entryIcon, /EDITOR_FONT_SIZE_SCALE\.badgeCompact/u);
  assert.match(entryIcon, /EDITOR_FONT_SIZE_SCALE\.badge/u);
  assert.doesNotMatch(controller, /font-size:\s*\d/u);
  assert.doesNotMatch(injectedCss, /font-size:\s*\d/u);
  assert.match(model, /EDITOR_TEXT_STYLE/u);
  assert.match(model, /EditorTextRole/u);
  assert.match(injectedCss, /:root:lang\(zh\)[\s\S]*--dsh-editor-font-ui/u);
  assert.match(injectedCss, /:root:lang\(ja\)[\s\S]*--dsh-editor-font-ui/u);
  assert.match(injectedCss, /:root:lang\(ko\)[\s\S]*--dsh-editor-font-ui/u);
  assert.match(injectedCss, /--dsh-editor-font-code/u);
});

test('shared style sheets reference global font scale instead of numeric font sizes', () => {
  for (const source of [inlineStyles, uiStyles]) {
    assert.match(source, /EDITOR_FONT_SIZE_SCALE/u);
    assert.match(source, /EDITOR_CODE_FONT/u);
    assert.doesNotMatch(source, /fontSize: \d+/u);
    assert.doesNotMatch(source, /fontSize: 'clamp/u);
    assert.doesNotMatch(source, /fontFamily: 'ui-monospace/u);
  }
});

test('Find and Search Everywhere use the same semantic input and label typography', () => {
  const findInput = styleBlock(inlineStyles, 'findToolInput', 'findToolMultilineInput');
  const searchInput = styleBlock(inlineStyles, 'searchEverywhereInput', 'searchEverywhereHint');
  const findToolbar = styleBlock(inlineStyles, 'findToolToolbar', 'findToolPopupToolbar');
  const searchHint = styleBlock(inlineStyles, 'searchEverywhereHint', 'searchEverywhereReplaceRow');
  assert.match(findInput, /EDITOR_TEXT_STYLE\.input/u);
  assert.match(searchInput, /EDITOR_TEXT_STYLE\.input/u);
  assert.match(findToolbar, /EDITOR_TEXT_STYLE\.label/u);
  assert.match(searchHint, /EDITOR_TEXT_STYLE\.label/u);
});
