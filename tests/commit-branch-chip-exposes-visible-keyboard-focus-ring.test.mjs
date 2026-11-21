import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const toolbarSource = await read('src/client/components/ui/PanelToolbar.tsx');
const injectedCssSource = await read('src/client/injected-css.ts');

test('the shared PanelToolbar branch popup exposes the themed branch-button class', () => {
  assert.match(toolbarSource, /className='dsh-editor-branch-button'/u);
  assert.match(toolbarSource, /aria-haspopup=\{badgeHasPopup\}/u);
  assert.match(toolbarSource, /aria-expanded=\{badgeHasPopup === undefined \? undefined : badgeExpanded === true\}/u);
});

test('the branch popup has a visible accent focus ring and forced-colors mapping', () => {
  assert.match(injectedCssSource, /'\.dsh-editor-branch-button:focus-visible \{'/u);
  assert.match(
    injectedCssSource,
    /\.dsh-editor-branch-button:focus-visible \{[\s\S]*?outline: 1px solid var\(--dsw-alias-state-business-primary\) !important;[\s\S]*?outline-offset: 1px !important;/u,
  );
  assert.match(
    injectedCssSource,
    /@media \(forced-colors: active\)[\s\S]*?\.dsh-editor-branch-button:focus-visible \{ outline-color: Highlight !important; \}/u,
  );
});
