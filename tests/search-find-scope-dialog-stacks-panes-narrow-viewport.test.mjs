import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const editor = await read('src/client/components/search/FindScopeEditor.tsx');
const injectedCss = await read('src/client/injected-css.ts');

test('Find Scope dialog exposes responsive list and body classes', () => {
  assert.match(editor, /className='dsh-editor-find-scope-body'/u);
  assert.match(editor, /className='dsh-editor-find-scope-list'/u);
});

test('narrow Viewports stack the scope list above the form', () => {
  assert.match(
    injectedCss,
    /@media \(max-width: 520px\) \{[\s\S]*?\.dsh-editor-find-scope-body \{[\s\S]*?flex-direction: column !important;/u,
  );
  assert.match(
    injectedCss,
    /\.dsh-editor-find-scope-list \{[\s\S]*?width: auto !important;[\s\S]*?max-height: 180px;[\s\S]*?border-right: none !important;[\s\S]*?border-bottom: 1px solid var\(--dsw-alias-border-l3\) !important;/u,
  );
});
