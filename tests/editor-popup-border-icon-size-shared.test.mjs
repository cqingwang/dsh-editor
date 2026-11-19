import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const uiStyles = await read('src/client/ui/styles.ts');
const inlineStyles = await read('src/client/inline-styles.ts');
const icon = await read('src/client/components/ui/Icon.tsx');
const uiIndex = await read('src/client/components/ui/index.tsx');
const toolbar = await read('src/client/components/ui/ToolbarButton.tsx');
const compact = await read('src/client/components/ui/CompactActionBar.tsx');
const searchEverywhere = await read('src/client/components/search/SearchEverywhere.tsx');
const findTool = await read('src/client/components/search/FindToolWindow.tsx');
const showUsages = await read('src/client/components/search/ShowUsagesPopup.tsx');
const moveTo = await read('src/client/components/commit/MoveToPicker.tsx');
const buildScript = await read('scripts/build-client.mjs');
const floatingPopup = await read('src/client/components/search/FindToolPopup.tsx');

test('all popup surfaces reuse one visible border token', () => {
  for (const source of [uiStyles, inlineStyles]) {
    assert.match(source, /const POPUP_BORDER = '1px solid var\(--dsw-alias-border-l2\)'/u);
    assert.match(source, /palette: \{[\s\S]*?border: POPUP_BORDER/u);
    assert.match(source, /namePrompt: \{[\s\S]*?border: POPUP_BORDER/u);
    assert.match(source, /menu: \{[\s\S]*?border: POPUP_BORDER/u);
    assert.match(source, /submenu: \{[\s\S]*?border: POPUP_BORDER/u);
    assert.match(source, /searchEverywhereTooltip: \{[\s\S]*?border: POPUP_BORDER/u);
    assert.match(source, /gotoLinePopup: \{[\s\S]*?border: POPUP_BORDER/u);
  }
  assert.match(
    floatingPopup,
    /const FLOATING_TOOL_POPUP_SURFACE_STYLE: React\.CSSProperties = \{[\s\S]*?border: POPUP_BORDER,[\s\S]*?borderRadius: 8,[\s\S]*?background: 'var\(--dsw-alias-bg-base\)',[\s\S]*?boxShadow:/u,
  );
  assert.match(floatingPopup, /\.\.\.FLOATING_TOOL_POPUP_SURFACE_STYLE,/u);
  assert.doesNotMatch(searchEverywhere, /style=\{\{\s*\.\.\.styles\.palette,/u);
});

test('popup icons use the shared 16px size through reusable controls', () => {
  assert.match(icon, /export const POPUP_ICON_SIZE = 16/u);
  assert.match(uiIndex, /POPUP_ICON_SIZE/u);
  assert.match(icon, /flex: 'none'/u);
  assert.match(icon, /display: 'block'/u);
  assert.match(buildScript, /'POPUP_ICON_SIZE'/u);
  assert.match(toolbar, /iconSize\?: number/u);
  assert.match(toolbar, /size=\{iconSize\}/u);
  assert.match(compact, /iconSize\?: number/u);
  assert.match(compact, /iconSize=\{iconSize\}/u);
  for (const source of [searchEverywhere, findTool, showUsages, moveTo]) {
    assert.match(source, /POPUP_ICON_SIZE/u);
  }
});
