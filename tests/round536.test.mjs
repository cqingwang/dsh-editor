import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const actionsStart = source.indexOf('const searchEverywhereActions = React.useMemo');
const actionsEnd = source.indexOf('/* Recompute match count', actionsStart);
const actions = source.slice(actionsStart, actionsEnd);

function actionSource(id, nextId) {
  return actions.slice(actions.indexOf(`id: '${id}'`), actions.indexOf(`id: '${nextId}'`));
}

test('Find Selection in Files is exposed as a workspace text-search action', () => {
  assert.match(actions, /id: 'findSelectionInFiles'/);
  assert.match(actions, /label: t\('editor\.findSelectionInFilesAction'\)/);
  assert.match(actions, /description: t\('editor\.findSelectionInFilesHint'\)/);
  assert.match(actions, /rememberQuery: false/);
});

test('Find Selection in Files reuses the selection/caret query in workspace Find', () => {
  const action = actionSource('findSelectionInFiles', 'findUsages');
  assert.match(action, /disabled: findUsagesTarget\.query === ''/);
  assert.match(action, /findUsagesTarget\.reason === 'editor'/);
  assert.match(action, /editor\.findEditorRequired/);
  assert.match(action, /editor\.findUsagesSymbolRequired/);
  assert.match(action, /openFindTool\(findUsagesTarget\.query, 'find'\)/);
  assert.doesNotMatch(action, /openEditorFind/);
});

test('Find Selection in Files is localized in both dictionaries', () => {
  assert.match(source, /findSelectionInFilesAction: '在文件中查找'/);
  assert.match(source, /findSelectionInFilesSynonym: '在文件中查找所选内容'/);
  assert.match(source, /findSelectionInFilesHint: '在整个工作区查找当前选中文本或光标处标识符'/);
  assert.match(source, /findSelectionInFilesAction: 'Find in Files'/);
  assert.match(source, /findSelectionInFilesSynonym: 'Find Selection in Files'/);
  assert.match(source, /findSelectionInFilesHint: 'Find the selection or symbol text in the whole workspace'/);
});
