import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptSource } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const typescriptSource = await read('src/client/inline-styles.ts');
const legacySource = await read('tests/fixtures/legacy/inline-styles.legacy.js');

function loadStyles(source, transpile) {
  const code = transpile ? transpileTypeScriptSource(source) : source;
  return new Function('EDITOR_UI_FONT', `${code}\nreturn styles;`)('font-under-test');
}

test('inline-styles.ts preserves the legacy style sheet exactly', () => {
  const styles = loadStyles(typescriptSource, true);
  const legacyStyles = loadStyles(legacySource, false);

  assert.deepEqual(styles, legacyStyles);
  assert.equal(Object.keys(styles).length, 355);
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

test('inline-styles.js is deleted from source and frozen as a test oracle', async () => {
  const build = await read('scripts/build-client.mjs');
  const client = await read('lib/client.js');
  const packageJson = JSON.parse(await read('package.json'));

  assert.equal(existsSync(new URL('../src/client/inline-styles.js', import.meta.url)), false);
  assert.equal(existsSync(new URL('../tests/fixtures/legacy/inline-styles.legacy.js', import.meta.url)), true);
  assert.match(build, /'inline-styles\.ts'/u);
  assert.doesNotMatch(build, /'inline-styles\.js'/u);
  assert.match(client, /\/\* ─────────────────────── inline-styles\.ts ─────────────────────── \*\//u);
  assert.doesNotMatch(client, /\/\* ─────────────────────── inline-styles\.js ─────────────────────── \*\//u);
  assert.equal(existsSync(new URL('../src/client/inline-styles.js.bak', import.meta.url)), false);
});
