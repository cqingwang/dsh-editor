import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [sharedStyles, inlineStyles, injectedCss] = await Promise.all([
  readFile(new URL('../src/client/ui/styles.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/client/inline-styles.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/client/injected-css.ts', import.meta.url), 'utf8'),
]);

function selectedSoftBackground(source) {
  const match = source.match(/treeRowSelectedSoft:\s*\{\s*background:\s*'([^']+)'/u);
  assert.ok(match, 'treeRowSelectedSoft background is missing');
  return match[1];
}

test('extended Project selections use a selection tint instead of the neutral hover surface', () => {
  const expected =
    'color-mix(in srgb, var(--dsw-alias-state-business-primary) 20%, transparent)';
  assert.equal(selectedSoftBackground(sharedStyles), expected);
  assert.equal(selectedSoftBackground(inlineStyles), expected);
});

test('hovering an extended Project selection has its own stronger selection layer', () => {
  assert.match(
    injectedCss,
    /\.dsh-editor-tree-row-extended:hover \{ background: color-mix\(in srgb, var\(--dsw-alias-state-business-primary\) 32%, transparent\) !important; color: var\(--dsw-alias-label-primary\) !important; \}/u,
  );
});
