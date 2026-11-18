import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptSource } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const typescriptSource = await read('src/client/inline-styles.ts');

function loadStyles(source) {
  const code = transpileTypeScriptSource(source);
  return new Function('EDITOR_UI_FONT', `${code}\nreturn styles;`)('font-under-test');
}

test('inline style tokens keep scalar values and representative layout defaults', () => {
  const styles = loadStyles(typescriptSource);

  assert.equal(Object.keys(styles).length, 356);
  assert.equal(styles.root.display, 'flex');
  assert.equal(styles.root.fontFamily, 'font-under-test');
  assert.equal(styles.treeRow.height, 24);
  assert.equal(styles.menuSeparator.height, 0);
  for (const [name, style] of Object.entries(styles)) {
    assert.equal(typeof style, 'object', `${name} must be a style object`);
    for (const [property, value] of Object.entries(style)) {
      assert.ok(
        typeof value === 'string' || typeof value === 'number',
        `${name}.${property} must stay a CSS scalar`,
      );
    }
  }
});
