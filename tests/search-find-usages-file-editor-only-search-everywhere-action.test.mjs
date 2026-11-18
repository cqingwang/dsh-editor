import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8'));
const actionsStart = source.indexOf('const searchEverywhereActions =');
const actionsEnd = source.indexOf('/* Recompute match count', actionsStart);
const actions = source.slice(actionsStart, actionsEnd);

test('Find Usages in File is an editor-only Search Everywhere action', () => {
  assert.match(actions, /id: 'findUsagesInFile'/);
  assert.match(actions, /label: t\('editor\.findUsagesInFileAction'\)/);
  assert.match(actions, /description: t\('editor\.findUsagesInFileHint'\)/);
  assert.match(actions, /disabled:\s*findUsagesTarget\.query === ''/);
  assert.match(actions, /openEditorFind\(false, findUsagesTarget\.query\)/);
  const action = actions.slice(actions.indexOf("id: 'findUsagesInFile'"), actions.indexOf("id: 'findNextWordOccurrence'"));
  assert.doesNotMatch(action, /openFindTool/u);
});

test('Find Usages in File keeps editor/symbol disabled reasons', () => {
  const action = actions.slice(actions.indexOf("id: 'findUsagesInFile'"), actions.indexOf("id: 'findNextWordOccurrence'"));
  assert.match(action, /findUsagesTarget\.reason === 'editor'/);
  assert.match(action, /editor\.findEditorRequired/);
  assert.match(action, /editor\.findUsagesSymbolRequired/);
});

test('the editor Find opener accepts a preselected usage query without dropping options', () => {
  const open = source.slice(source.indexOf('const openEditorFind = React.useCallback'), source.indexOf('/* IDEA\'s editor search family'));
  assert.match(open, /const openEditorFind = React\.useCallback\(\s*\(withReplace = false, initialQuery = null, focusTarget = 'query', scopeOverride = undefined\) => \{/);
  assert.match(open, /const requestedFind = typeof initialQuery === 'string' \? initialQuery\.trim\(\) : ''/);
  assert.match(open, /const hasExplicitQuery = typeof initialQuery === 'string'/);
  assert.match(open, /const find = hasExplicitQuery \? requestedFind : base\.find/);
  assert.match(open, /hasExplicitQuery \? null : \(base\.scope \?\? null\)/);
  assert.match(open, /editorFindResult\(model\.getValue\(\), find, \{ \.\.\.base, scope \}\)/);
});

test('Find Usages in File is localized in both dictionaries', () => {
  assert.match(source, /findUsagesInFileAction: '在文件中查找用法'/);
  assert.match(source, /findUsagesInFileHint: '在当前编辑器中查找选中文本或光标处标识符的出现位置'/);
  assert.match(source, /findUsagesInFileAction: 'Find Usages in File'/);
  assert.match(source, /findUsagesInFileHint: 'Find occurrences of the selection or symbol at caret in the active editor'/);
});
