import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('commit template chips expose IDEA hover and accent focus feedback', () => {
  assert.match(source, /\.dsh-editor-template-chip \{ background: transparent; appearance: none; -webkit-appearance: none; \}/);
  assert.match(source, /\.dsh-editor-template-chip:hover:enabled \{ background: var\(--dsw-alias-interactive-bg-hover\); border-color: var\(--dsw-alias-state-business-primary\) !important; \}/);
  assert.ok(source.includes("'.dsh-editor-template-chip:focus-visible {',"));
  assert.ok(source.includes("'  outline: 1px solid var(--dsw-alias-state-business-primary);',"));
  assert.ok(source.includes("'  outline-offset: 1px;',"));
});

test('the template chip inline style leaves background and outline to CSS', () => {
  const start = source.indexOf('commitTemplateChip: {');
  const end = source.indexOf('\n      },', start);
  const style = source.slice(start, end);
  assert.doesNotMatch(style, /background: 'transparent'/);
  assert.doesNotMatch(style, /outline:/);
});
