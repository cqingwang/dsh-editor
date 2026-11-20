import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('The editor tab strip uses the IDEA grey surface', () => {
  const tabStrip = source.slice(
    source.indexOf('      tabStrip: {'),
    source.indexOf('      tab: {', source.indexOf('      tabStrip: {')),
  );
  const tab = source.slice(
    source.indexOf('      tab: {'),
    source.indexOf('      /* IDEA\'s `»` for file tabs that do not fit. */', source.indexOf('      tab: {')),
  );
  const splitHeader = source.slice(
    source.indexOf('      editorSplitHeader: {'),
    source.indexOf('      editorSplitTitle: {'),
  );
  assert.match(tabStrip, /background: 'var\(--dsw-alias-interactive-bg-hover-solid\)'/);
  assert.doesNotMatch(tabStrip, /background: 'var\(--dsw-alias-bg-base\)'/);
  assert.match(tab, /background: 'transparent'/);
  assert.match(splitHeader, /background: 'var\(--dsw-alias-interactive-bg-hover-solid\)'/);
});

test('Every Monaco gutter shares the grey surface, divider and content gap', () => {
  assert.match(
    source,
    /'\.monaco-editor \.margin \{',[\s\S]*?var\(--dsh-editor-gutter-divider\)[\s\S]*?var\(--dsh-editor-content-fill\)[\s\S]*?border-right: none !important;[\s\S]*?box-sizing: border-box !important;/,
  );
  assert.match(source, /'data-dsh-editor-gutter-surface': 'idea'/);
});

test('The gutter rule is global to every Monaco instance in the Editor surface', () => {
  assert.match(source, /'\.monaco-editor \.margin \{'/);
  assert.doesNotMatch(source, /\[data-dsh-editor-workspace\] \.monaco-editor \.margin\s*\{/);
  assert.match(source, /\[data-dsh-editor-workspace\] \.monaco-editor \.margin-view-overlays/);
});
