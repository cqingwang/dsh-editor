import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const styleModelSource = await read('src/client/components/editor/editor-style-model.ts');
const editorCoreSource = await read('src/client/editor-core.ts');
const injectedCssSource = await read('src/client/injected-css.ts');
const { EDITOR_GUTTER_LAYOUT: gutter } = loadTypeScriptModule(styleModelSource, ['EDITOR_GUTTER_LAYOUT']);

test('the shared gutter layout keeps digits readable while reducing horizontal chrome', () => {
  assert.equal(gutter.lineNumbersMinChars, 3);
  assert.equal(gutter.lineDecorationsWidth, 2);
  assert.equal(gutter.foldIconFontSize, 10);
  assert.equal(gutter.foldIconMarginLeft, 0);
  assert.match(editorCoreSource, /lineNumbersMinChars: EDITOR_GUTTER_LAYOUT\.lineNumbersMinChars/u);
  assert.match(editorCoreSource, /lineDecorationsWidth: EDITOR_GUTTER_LAYOUT\.lineDecorationsWidth/u);
});

test('line numbers and folding icons render one compact visual size', () => {
  assert.match(
    injectedCssSource,
    /\.monaco-editor \.margin-view-overlays \.line-numbers \{[\s\S]*?font-size: var\(--dsh-editor-font-size-caption, 10px\) !important;/u,
  );
  assert.match(
    injectedCssSource,
    /\.monaco-editor \.margin-view-overlays \.codicon-folding-expanded,[\s\S]*?font-size: \$\{EDITOR_GUTTER_LAYOUT\.foldIconFontSize\}px !important;[\s\S]*?margin-left: \$\{EDITOR_GUTTER_LAYOUT\.foldIconMarginLeft\}px !important;/u,
  );
});

test('sticky scroll reuses the same compact line-number and folding geometry', () => {
  const stickyFoldRuleStart = injectedCssSource.indexOf(
    "'.monaco-editor .sticky-line-number .codicon-folding-expanded,'",
  );
  assert.notEqual(stickyFoldRuleStart, -1);
  const stickyFoldRuleEnd = injectedCssSource.indexOf("    '}',", stickyFoldRuleStart);
  assert.notEqual(stickyFoldRuleEnd, -1);
  const stickyFoldRule = injectedCssSource.slice(stickyFoldRuleStart, stickyFoldRuleEnd);

  assert.match(
    injectedCssSource,
    /\.monaco-editor \.sticky-line-number,[\s\S]*?\.monaco-editor \.sticky-line-number-inner \{[\s\S]*?font-size: var\(--dsh-editor-font-size-caption, 10px\) !important;/u,
  );
  assert.match(
    stickyFoldRule,
    /font-size: \$\{EDITOR_GUTTER_LAYOUT\.foldIconFontSize\}px !important;[\s\S]*?margin-left: \$\{EDITOR_GUTTER_LAYOUT\.foldIconMarginLeft\}px !important;[\s\S]*?cursor: pointer !important;/u,
  );
});
