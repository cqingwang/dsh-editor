import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const groupStart = source.indexOf('function createCodeEditorGroup(');
const groupEnd = source.indexOf('\n    /**\n     * Reuse one workspace model', groupStart);
const group = source.slice(groupStart, groupEnd);

test('Replace and Incremental Search remain executable without context-menu duplicates', () => {
  const replace = group.slice(
    group.indexOf('id: `dsh-editor.replace.${groupId}`'),
    group.indexOf('id: `dsh-editor.incrementalSearch.${groupId}`'),
  );
  const incremental = group.slice(
    group.indexOf('id: `dsh-editor.incrementalSearch.${groupId}`'),
    group.indexOf("id: 'dsh-editor.closeTab'"),
  );
  assert.match(replace, /label: actionsHandlers\.replaceLabel \?\? 'Replace…'/);
  assert.match(replace, /precondition: findUsagesPrecondition/);
  assert.doesNotMatch(replace, /contextMenuGroupId|contextMenuOrder/);
  assert.match(replace, /actionsHandlers\.onReplace\?\.\(editor\)/);

  assert.match(incremental, /label: actionsHandlers\.incrementalSearchLabel \?\? 'Incremental Search'/);
  assert.match(incremental, /precondition: findUsagesPrecondition/);
  assert.doesNotMatch(incremental, /contextMenuGroupId|contextMenuOrder/);
  assert.match(incremental, /actionsHandlers\.onIncrementalSearch\?\.\(editor\)/);
});

test('both editor groups pass localized Replace and Incremental Search entries', () => {
  assert.equal((source.match(/replaceLabel: t\('editor\.replaceAction'\)/g) ?? []).length, 2);
  assert.equal((source.match(/incrementalSearchLabel: t\('editor\.incrementalSearchAction'\)/g) ?? []).length, 2);
  assert.equal((source.match(/onReplace: \(editor\) => editorFindContextRunnerRef\.current\?\.\(editor, true, 'replace'\)/g) ?? []).length, 2);
  assert.equal((source.match(/onIncrementalSearch: \(editor\) => editorFindContextRunnerRef\.current\?\.\(editor, false, 'query'\)/g) ?? []).length, 2);
});

test('context Replace and Incremental Search reuse the editor Find state', () => {
  const runner = source.slice(
    source.indexOf("editorFindContextRunnerRef.current = (editor, withReplace = false, focusTarget = 'query') => {"),
    source.indexOf('}, [openEditorFind]);', source.indexOf('editorFindContextRunnerRef.current = (editor, withReplace = false')),
  );
  assert.match(runner, /const target = findUsagesSearchTarget\(editor\)/);
  assert.match(runner, /openEditorFind\(withReplace, target\.query, focusTarget\)/);

  const opener = source.slice(
    source.indexOf('const openEditorFind = React.useCallback'),
    source.indexOf('React.useEffect(() => {\n        editorFindContextRunnerRef.current'),
  );
  assert.match(opener, /focusTarget = 'query'/);
  assert.match(opener, /focusTarget === 'replace'/);
  assert.match(opener, /'\[data-dsh-editor-find-replace-input\]'/);
  assert.match(source, /'data-dsh-editor-find-replace-input': ''/);
});
