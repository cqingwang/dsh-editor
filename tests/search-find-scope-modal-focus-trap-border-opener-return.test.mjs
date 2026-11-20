import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const scopeEditor = await read('src/client/components/search/FindScopeEditor.tsx');
const findTool = await read('src/client/components/search/FindToolWindow.tsx');

test('Find Scope dialog reuses the shared modal focus trap', () => {
  assert.match(scopeEditor, /import \{ trapDialogFocus \} from '\.\.\/ui\/focus-trap';/u);
  assert.match(
    scopeEditor,
    /if \(trapDialogFocus\(event, event\.currentTarget, \{ focusWhenOutside: true \}\)\) return;/u,
  );
});

test('Find Scope dialog uses the shared visible popup border', () => {
  assert.match(scopeEditor, /import \{ POPUP_BORDER, styles \} from '\.\.\/\.\.\/ui\/styles';/u);
  assert.match(scopeEditor, /border: POPUP_BORDER/u);
  assert.doesNotMatch(scopeEditor, /border: '1px solid var\(--dsw-alias-border-l2\)'/u);
});

test('closing Edit Scopes returns focus to its opener', () => {
  assert.match(findTool, /const scopeEditorButtonRef = React\.useRef<HTMLButtonElement \| null>\(null\);/u);
  assert.match(findTool, /ref=\{scopeEditorButtonRef\}[\s\S]{0,160}?title=\{t\('editor\.findEditScopes'\)\}/u);
  assert.match(
    findTool,
    /const closeScopeEditor = React\.useCallback\(\(\) => \{\s+setScopeEditorOpen\(false\);\s+window\.setTimeout\(\(\) => scopeEditorButtonRef\.current\?\.focus\?\.\(\), 0\);\s+\}, \[\]\);/u,
  );
  assert.match(findTool, /onClose=\{closeScopeEditor\}/u);
});
