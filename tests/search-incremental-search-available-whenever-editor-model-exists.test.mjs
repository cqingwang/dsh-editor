import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/editor/EditorFindBar.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8'));
const actionsStart = source.indexOf('const searchEverywhereActions =');
const actionsEnd = source.indexOf('/* Recompute match count', actionsStart);
const actions = source.slice(actionsStart, actionsEnd);

test('Incremental Search is available whenever an editor model exists', () => {
  assert.match(actions, /id: 'incrementalSearch'/);
  assert.match(actions, /label: t\('editor\.incrementalSearchAction'\)/);
  assert.match(actions, /disabled:\s*!hasEditorModel/);
  assert.match(actions, /disabledReason: t\('editor\.findEditorRequired'\)/);
  assert.match(actions, /rememberQuery: false/);
  assert.match(actions, /openEditorFind\(false, findUsagesTarget\.query\)/);
});

test('explicit incremental queries override an existing Find draft and reset scope', () => {
  const open = source.slice(
    source.indexOf('const openEditorFind = React.useCallback'),
    source.indexOf('const openEditorFindInSelection = React.useCallback'),
  );
  assert.match(open, /const hasExplicitQuery = typeof initialQuery === 'string'/u);
  assert.match(open, /const find = hasExplicitQuery \? requestedFind : base\.find/u);
  assert.match(open, /hasExplicitQuery \? null : \(base\.scope \?\? null\)/u);
  assert.match(open, /withReplace,\n\s+scope,/u);
  assert.match(open, /'\[data-dsh-editor-find-input\]'/u);
  assert.match(source, /data-dsh-editor-find-input=''/u);
});

test('Incremental Search is localized in both dictionaries', () => {
  assert.match(source, /incrementalSearchAction: '增量搜索'/);
  assert.match(source, /incrementalSearchHint: '在当前编辑器中打开即时查找'/);
  assert.match(source, /incrementalSearchAction: 'Incremental Search'/);
  assert.match(source, /incrementalSearchHint: 'Open incremental Find in the active editor'/);
});
