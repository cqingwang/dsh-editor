import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('./fixtures/search-everywhere.legacy.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const actionsStart = source.indexOf('const searchEverywhereActions = React.useMemo');
const actionsEnd = source.indexOf('/* Recompute match count', actionsStart);
const actions = source.slice(actionsStart, actionsEnd);

test('Highlight Usages in File is exposed as an IDEA action', () => {
  assert.match(actions, /id: 'highlightUsagesInFile'/);
  assert.match(actions, /label: t\('editor\.highlightUsagesInFileAction'\)/);
  assert.match(actions, /description: t\('editor\.highlightUsagesInFileHint'\)/);
  assert.match(actions, /rememberQuery: false/);
  const usagesInFile = actions.indexOf("id: 'findUsagesInFile'");
  const highlight = actions.indexOf("id: 'highlightUsagesInFile'");
  const nextOccurrence = actions.indexOf("id: 'findNextWordOccurrence'");
  assert.ok(usagesInFile > 0 && highlight > usagesInFile && nextOccurrence > highlight);
});

test('Highlight Usages in File reuses the selection/caret availability model', () => {
  const action = actions.slice(actions.indexOf("id: 'highlightUsagesInFile'"), actions.indexOf("id: 'findNextWordOccurrence'"));
  assert.match(action, /disabled: findUsagesTarget\.query === ''/);
  assert.match(action, /findUsagesTarget\.reason === 'editor'/);
  assert.match(action, /editor\.findEditorRequired/);
  assert.match(action, /editor\.findUsagesSymbolRequired/);
});

test('Highlight Usages in File invokes Monaco word highlight and returns focus', () => {
  const action = actions.slice(actions.indexOf("id: 'highlightUsagesInFile'"), actions.indexOf("id: 'findNextWordOccurrence'"));
  assert.match(action, /closeSearchEverywhere\(\)/);
  assert.match(action, /activeSourceEditor\.focus\?\.\(\)/);
  assert.match(action, /activeSourceEditor\.getAction\?\.\('editor\.action\.wordHighlight\.trigger'\)/);
  assert.match(action, /\.run\?\.\(\)/);
});

test('Highlight Usages in File is localized in both dictionaries', () => {
  assert.match(source, /highlightUsagesInFileAction: '在文件中高亮用法'/);
  assert.match(source, /highlightUsagesInFileHint: '在当前编辑器中高亮选中文本或光标处标识符的出现位置'/);
  assert.match(source, /highlightUsagesInFileAction: 'Highlight Usages in File'/);
  assert.match(source, /highlightUsagesInFileHint: 'Highlight occurrences of the selection or symbol at caret in the active editor'/);
});
