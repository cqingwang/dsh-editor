import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('Editor gutter, divider, content surface and gap share one rule set', () => {
  assert.match(source, /'\[data-dsh-editor-gutter-surface="idea"\] \{'/);
  assert.match(source, /--dsh-editor-gutter-fill: var\(--dsw-alias-interactive-bg-hover-solid\)/);
  assert.match(source, /--dsh-editor-gutter-divider: var\(--dsw-alias-border-l3\)/);
  assert.match(source, /--dsh-editor-content-fill: var\(--dsw-alias-bg-base\)/);
  assert.match(source, /--dsh-editor-gutter-gap: 2px/);
  assert.match(
    source,
    /'\.monaco-editor \.margin \{'[\s\S]*?var\(--dsh-editor-gutter-divider\)[\s\S]*?var\(--dsh-editor-content-fill\)/,
  );
});

test('Search and Find previews reuse the shared code-preview classes', () => {
  assert.ok((source.match(/className: 'dsh-editor-code-preview'/g) ?? []).length >= 2);
  assert.match(source, /className: 'dsh-editor-code-preview-line'/);
  assert.match(source, /className: 'dsh-editor-code-preview-gutter'/);
  assert.match(source, /className: 'dsh-editor-code-preview-code'/);
  assert.match(source, /'\.dsh-editor-code-preview \{'/);
  assert.match(source, /'\.dsh-editor-code-preview-gutter \{'/);
  assert.match(source, /monaco\.editor\.\s*colorize\(\s*text,\s*codePreviewLanguage\(monaco, path\)/u);
  assert.ok((source.match(/React\.createElement\(\s*CodePreviewCode,/g) ?? []).length >= 2);
});

test('The Project, Terminal and Harness activity rail uses the shared grey surface', () => {
  const stripe = source.slice(source.indexOf('      stripe: {'), source.indexOf('      stripeItem: {'));
  assert.match(stripe, /background: 'var\(--dsw-alias-interactive-bg-hover-solid\)'/);
  assert.doesNotMatch(stripe, /background: 'var\(--dsw-alias-bg-layer-1\)'/);
});
