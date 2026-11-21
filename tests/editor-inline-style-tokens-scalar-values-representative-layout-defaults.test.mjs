import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule, transpileTypeScriptSource } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const typescriptSource = await read('src/client/inline-styles.ts');
const styleModel = await read('src/client/components/editor/editor-style-model.ts');
const typography = loadTypeScriptModule(styleModel, [
  'EDITOR_UI_FONT',
  'EDITOR_CODE_FONT',
  'EDITOR_CODE_FONT_SIZE',
  'EDITOR_BASE_FONT_WEIGHT',
  'EDITOR_CODE_LINE_HEIGHT',
  'EDITOR_FONT_SIZE_SCALE',
  'EDITOR_RESPONSIVE_FONT_SIZE',
  'EDITOR_TEXT_STYLE',
]);

function loadStyles(source) {
  const code = transpileTypeScriptSource(source);
  return new Function(
    'EDITOR_UI_FONT',
    'EDITOR_CODE_FONT',
    'EDITOR_CODE_FONT_SIZE',
    'EDITOR_BASE_FONT_WEIGHT',
    'EDITOR_CODE_LINE_HEIGHT',
    'EDITOR_FONT_SIZE_SCALE',
    'EDITOR_RESPONSIVE_FONT_SIZE',
    'EDITOR_TEXT_STYLE',
    `${code}\nreturn styles;`,
  )(
    'font-under-test',
    typography.EDITOR_CODE_FONT,
    typography.EDITOR_CODE_FONT_SIZE,
    typography.EDITOR_BASE_FONT_WEIGHT,
    typography.EDITOR_CODE_LINE_HEIGHT,
    typography.EDITOR_FONT_SIZE_SCALE,
    typography.EDITOR_RESPONSIVE_FONT_SIZE,
    typography.EDITOR_TEXT_STYLE,
  );
}

test('inline style tokens keep scalar values and representative layout defaults', () => {
  const styles = loadStyles(typescriptSource);

  assert.equal(Object.keys(styles).length, 383);
  assert.equal(styles.root.display, 'flex');
  assert.equal(styles.root.fontFamily, 'font-under-test');
  assert.equal(styles.treeRow.height, 24);
  assert.equal(styles.menuSeparator.height, 0);
  assert.equal(styles.annotateCode.fontSize, typography.EDITOR_CODE_FONT_SIZE);
  assert.equal(styles.annotateCode.fontWeight, typography.EDITOR_BASE_FONT_WEIGHT);
  assert.equal(styles.annotateCode.lineHeight, `${typography.EDITOR_CODE_LINE_HEIGHT}px`);
  for (const [name, style] of Object.entries(styles)) {
    assert.equal(typeof style, 'object', `${name} must be a style object`);
    for (const [property, value] of Object.entries(style)) {
      assert.ok(typeof value === 'string' || typeof value === 'number', `${name}.${property} must stay a CSS scalar`);
    }
  }
});
