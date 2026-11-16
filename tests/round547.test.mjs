import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const groupStart = source.indexOf('function createCodeEditorGroup(');
const groupEnd = source.indexOf('\n    /**\n     * Reuse one workspace model', groupStart);
const group = source.slice(groupStart, groupEnd);

test('Monaco context menu exposes workspace Find and Replace actions', () => {
  const find = group.slice(
    group.indexOf('id: `dsh-editor.findInFiles.${groupId}`'),
    group.indexOf('id: `dsh-editor.replaceInFiles.${groupId}`'),
  );
  const replace = group.slice(
    group.indexOf('id: `dsh-editor.replaceInFiles.${groupId}`'),
    group.indexOf("id: 'dsh-editor.closeTab'"),
  );
  assert.match(find, /label: actionsHandlers\.findInFilesLabel \?\? 'Find in Files…'/);
  assert.match(find, /precondition: findUsagesPrecondition/);
  assert.match(find, /contextMenuGroupId: 'navigation'/);
  assert.match(find, /contextMenuOrder: 1\.6/);
  assert.match(find, /actionsHandlers\.onFindInFiles\?\.\(editor\)/);

  assert.match(replace, /label: actionsHandlers\.replaceInFilesLabel \?\? 'Replace in Files…'/);
  assert.match(replace, /precondition: findUsagesPrecondition/);
  assert.match(replace, /contextMenuGroupId: 'navigation'/);
  assert.match(replace, /contextMenuOrder: 1\.7/);
  assert.match(replace, /actionsHandlers\.onReplaceInFiles\?\.\(editor\)/);
});

test('both editor groups hand context searches to the shared Find tool ref', () => {
  assert.equal((source.match(/onFindInFiles: \(editor\) => findToolContextRunnerRef\.current\?\.\(editor, 'find'\)/g) ?? []).length, 2);
  assert.equal((source.match(/onReplaceInFiles: \(editor\) => findToolContextRunnerRef\.current\?\.\(editor, 'replace'\)/g) ?? []).length, 2);
  assert.equal((source.match(/findInFilesLabel: t\('editor\.findInFilesAction'\)/g) ?? []).length, 2);
  assert.equal((source.match(/replaceInFilesLabel: t\('editor\.replaceInFilesAction'\)/g) ?? []).length, 2);
});

test('the ref resolves the invoking editor without an early openFindTool reference', () => {
  const runner = source.slice(
    source.indexOf('findToolContextRunnerRef.current = (editor, mode) => {'),
    source.indexOf('}, [openFindTool]);', source.indexOf('findToolContextRunnerRef.current = (editor, mode) => {')),
  );
  assert.match(runner, /const target = findUsagesSearchTarget\(editor\)/);
  assert.match(runner, /openFindTool\(target\.query, replace \? 'replace' : 'find', null, replace \? 'replace' : 'query'\)/);
  const mainGroup = source.indexOf('const group = createCodeEditorGroup(monaco, containerRef.current');
  const splitGroup = source.indexOf('const group = createCodeEditorGroup(monaco, splitContainerRef.current');
  assert.doesNotMatch(
    source.slice(mainGroup, source.indexOf('}, [closeDiff, monacoReady', mainGroup)),
    /openFindTool/u,
  );
  assert.doesNotMatch(
    source.slice(splitGroup, source.indexOf('}, [closeSplitTab, monacoReady', splitGroup)),
    /openFindTool/u,
  );
});

test('Find tool focus waits for Monaco to finish restoring the editor', () => {
  const opener = source.slice(
    source.indexOf('const openFindTool = React.useCallback'),
    source.indexOf('const openFindUsages = React.useCallback'),
  );
  assert.match(opener, /Monaco restores editor focus after a context-menu action returns/);
  assert.match(opener, /document\.querySelector\(target\)\?\.focus\?\.\(\)/);
  assert.match(opener, /}, 40\);/);
});
