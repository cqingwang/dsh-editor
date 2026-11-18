import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const groupStart = source.indexOf('function createCodeEditorGroup(');
const groupEnd = source.indexOf('\n    /**\n     * Reuse one workspace model', groupStart);
const group = source.slice(groupStart, groupEnd);

test('Monaco context menu exposes in-file usage search and highlighting', () => {
  const find = group.slice(
    group.indexOf('id: `dsh-editor.findUsagesInFile.${groupId}`'),
    group.indexOf('id: `dsh-editor.highlightUsagesInFile.${groupId}`'),
  );
  const highlight = group.slice(
    group.indexOf('id: `dsh-editor.highlightUsagesInFile.${groupId}`'),
    group.indexOf("id: 'dsh-editor.closeTab'"),
  );
  assert.match(find, /label: actionsHandlers\.findUsagesInFileLabel \?\? 'Find Usages in File'/);
  assert.match(find, /precondition: findUsagesPrecondition/);
  assert.match(find, /contextMenuGroupId: 'navigation'/);
  assert.match(find, /contextMenuOrder: 1\.8/);
  assert.match(find, /actionsHandlers\.onFindUsagesInFile\?\.\(editor\)/);

  assert.match(highlight, /label: actionsHandlers\.highlightUsagesInFileLabel \?\? 'Highlight Usages in File'/);
  assert.match(highlight, /precondition: findUsagesPrecondition/);
  assert.match(highlight, /contextMenuGroupId: 'navigation'/);
  assert.match(highlight, /contextMenuOrder: 1\.9/);
  assert.match(highlight, /runSearchCommand\('editor\.action\.wordHighlight\.trigger'\)/);
});

test('both editor groups pass localized in-file usage labels and handlers', () => {
  assert.equal((source.match(/findUsagesInFileLabel: t\('editor\.findUsagesInFileAction'\)/g) ?? []).length, 2);
  assert.equal((source.match(/highlightUsagesInFileLabel: t\('editor\.highlightUsagesInFileAction'\)/g) ?? []).length, 2);
  assert.equal((source.match(/onFindUsagesInFile: \(editor\) => editorFindContextRunnerRef\.current\?\.\(editor\)/g) ?? []).length, 2);
});

test('Find Usages in File reuses the editor Find query path without an early hook reference', () => {
  const runner = source.slice(
    source.indexOf("editorFindContextRunnerRef.current = (editor, withReplace = false, focusTarget = 'query') => {"),
    source.indexOf('}, [openEditorFind]);', source.indexOf('editorFindContextRunnerRef.current = (editor, withReplace = false')),
  );
  assert.match(runner, /const target = findUsagesSearchTarget\(editor\)/);
  assert.match(runner, /editorFindContextRunnerRef\.current = \(editor, withReplace = false, focusTarget = 'query'\)/);
  assert.match(runner, /if \(target\.query !== ''\) openEditorFind\(withReplace, target\.query, focusTarget\)/);
  const mainGroup = source.indexOf('const group = createCodeEditorGroup(monaco, containerRef.current');
  const splitGroup = source.indexOf('const group = createCodeEditorGroup(monaco, splitContainerRef.current');
  const mainEnd = source.indexOf('const editor = group.editor;', mainGroup);
  const splitEnd = source.indexOf('const editor = group.editor;', splitGroup);
  assert.doesNotMatch(
    source.slice(mainGroup, mainEnd),
    /openEditorFind/u,
  );
  assert.doesNotMatch(
    source.slice(splitGroup, splitEnd),
    /openEditorFind/u,
  );
});

test('editor Find focus also survives Monaco context-menu focus restoration', () => {
  const opener = source.slice(
    source.indexOf('const openEditorFind = React.useCallback'),
    source.indexOf('React.useEffect(() => {\n        editorFindContextRunnerRef.current'),
  );
  assert.match(opener, /Monaco restores editor focus after a context-menu action returns/);
  assert.match(opener, /focusTarget === 'replace'/);
  assert.match(opener, /document\.querySelector\(selector\)\?\.focus\?\.\(\)/);
  assert.match(opener, /}, 40\);/);
});
