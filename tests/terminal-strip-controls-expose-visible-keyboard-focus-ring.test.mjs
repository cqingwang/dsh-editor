import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/client/injected-css.ts', import.meta.url), 'utf8');

function cssRule(selector) {
  const start = source.indexOf(`'${selector}:focus-visible`);
  assert.notEqual(start, -1, `missing focus-visible rule for ${selector}`);
  const end = source.indexOf("'}'", start);
  assert.notEqual(end, -1, `unterminated focus-visible rule for ${selector}`);
  return source.slice(start, end);
}

test('Terminal tabs, overflow and close controls expose an inset accent focus ring', () => {
  for (const selector of [
    '.dsh-editor-terminal-tab',
    '.dsh-editor-terminal-overflow',
    '.dsh-editor-terminal-tab > button',
  ]) {
    const declarations = cssRule(selector);
    assert.match(declarations, /outline: 1px solid var\(--dsw-alias-state-business-primary\) !important;/u);
    assert.match(declarations, /outline-offset: -[12]px !important;/u);
  }
});

test('forced-colors maps Terminal strip focus feedback to the system Highlight', () => {
  const forcedColors = source.slice(source.indexOf('@media (forced-colors: active)'));
  assert.match(
    forcedColors,
    /\.dsh-editor-terminal-tab:focus-visible,[\s\S]*?\.dsh-editor-terminal-overflow:focus-visible,[\s\S]*?\.dsh-editor-terminal-tab > button:focus-visible \{ outline-color: Highlight !important; \}/u,
  );
});
