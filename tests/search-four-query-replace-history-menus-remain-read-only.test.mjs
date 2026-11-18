import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('./fixtures/search-everywhere.legacy.js', import.meta.url), 'utf8') + '\n' + (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('./fixtures/find-tool.legacy.js', import.meta.url), 'utf8')));
const searchEverywhereFixture = await readFile(new URL('./fixtures/search-everywhere.legacy.js', import.meta.url), 'utf8');

test('all four query/replace history menus remain read-only', () => {
  const searchEverywhere = searchEverywhereFixture;
  const findTool = source.slice(
    source.indexOf('function FindToolWindow('),
    source.indexOf('/* QUICK_OPEN_BOUNDARY */'),
  );
  const editorWorkspace = source.slice(
    source.indexOf('function EditorWorkspace('),
    source.indexOf('function clampChatPercent('),
  );
  const editorHistoryOpen = editorWorkspace.slice(
    editorWorkspace.indexOf('const openEditorFindHistory'),
    editorWorkspace.indexOf('const jumpToMatch', editorWorkspace.indexOf('const openEditorFindHistory')),
  );
  const editorHistoryRender = editorWorkspace.slice(
    editorWorkspace.indexOf('editorFindHistoryMenu === null'),
    editorWorkspace.indexOf('EditorErrorBanner', editorWorkspace.indexOf('editorFindHistoryMenu === null')),
  );
  for (const block of [searchEverywhere, findTool, editorHistoryOpen, editorHistoryRender]) {
    assert.doesNotMatch(block, /deleteHistory|clearHistory|Clear History|Delete History/iu);
    assert.doesNotMatch(block, /id: 'delete-history'|id: 'clear-history'/u);
  }
});

test('query and replacement history retain their replay owners', () => {
  const searchEverywhere = searchEverywhereFixture;
  const findTool = source.slice(
    source.indexOf('function FindToolWindow('),
    source.indexOf('/* QUICK_OPEN_BOUNDARY */'),
  );
  const editorWorkspace = source.slice(
    source.indexOf('function EditorWorkspace('),
    source.indexOf('function clampChatPercent('),
  );
  assert.match(searchEverywhere, /onQuery\(value\);/);
  assert.match(searchEverywhere, /onReplaceChange\(value\);/);
  assert.match(searchEverywhere, /searchInputRef\.current\?\.focus\?\.\(\)/);
  assert.match(searchEverywhere, /replaceInputRef\.current\?\.focus\?\.\(\)/);
  assert.match(findTool, /if \(kind === 'query'\) onQuery\(value\);/);
  assert.match(findTool, /else onReplace\(value\);/);
  assert.match(findTool, /replaceInputRef\.current \?\? queryInputRef\.current/);
  assert.match(editorWorkspace, /updateFind\(\{ find: value \}\)/);
  assert.match(editorWorkspace, /replace: value/);
});

test('field history popups preserve opener and input focus', () => {
  assert.match(source, /menu\.fallbackFocus\?\.\(\)/);
  assert.match(source, /fallbackFocus: kind === 'query'/);
  assert.match(source, /replaceInputRef\.current \?\? queryInputRef\.current/);
  assert.match(source, /data-dsh-editor-find-history-menu/);
  assert.match(source, /data-dsh-find-history-menu/);
});
