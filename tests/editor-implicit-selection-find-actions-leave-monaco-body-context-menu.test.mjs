import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`    function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

function actionBlock(id, nextId) {
  const start = source.indexOf(`id: \`${id}.`);
  const end = source.indexOf(nextId === 'dsh-editor.closeTab'
    ? "id: 'dsh-editor.closeTab'"
    : `id: \`${nextId}.`, start);
  assert.ok(start >= 0 && end > start, `${id} action block missing`);
  return source.slice(start, end);
}

test('implicit selection Find actions leave the Monaco body context menu', () => {
  for (const [id, nextId] of [
    ['dsh-editor.incrementalSearch', 'dsh-editor.findInSelection'],
    ['dsh-editor.findInSelection', 'dsh-editor.replaceInSelection'],
    ['dsh-editor.replaceInSelection', 'dsh-editor.closeTab'],
  ]) {
    const block = actionBlock(id, nextId);
    assert.doesNotMatch(block, /contextMenuGroupId/u);
    assert.doesNotMatch(block, /contextMenuOrder/u);
  }
  assert.match(
    source,
    /filterMonacoContextMenuActions\(editor, \['editor\.action\.quickCommand'\]\)/u,
  );
});

test('Monaco context menu filtering removes Command Palette and restores the controller', () => {
  const filterMonacoContextMenuActions = new Function(
    `${extractFunction('filterMonacoContextMenuActions')}; return filterMonacoContextMenuActions;`,
  )();
  const original = () => [
    { id: 'editor.action.quickCommand' },
    { id: 'editorId:dsh-editor.find' },
    { id: 'editor.action.selectAll' },
  ];
  const controller = { _getMenuActions: original };
  const editor = { getContribution: (id) => id === 'editor.contrib.contextmenu' ? controller : null };
  const restore = filterMonacoContextMenuActions(editor, ['editor.action.quickCommand']);

  assert.deepEqual(controller._getMenuActions({}, 'editorContext').map((action) => action.id), [
    'editorId:dsh-editor.find',
    'editor.action.selectAll',
  ]);
  restore();
  assert.equal(controller._getMenuActions, original);
});

test('the keyboard request uses the live selection as scope and short query', () => {
  const requestFor = new Function(
    `${extractFunction('editorFindSelectionScope')}
     ${extractFunction('editorFindKeyboardRequest')}
     return editorFindKeyboardRequest;`,
  )();
  const model = {
    getOffsetAt: (position) => position.offset,
    getValueInRange: () => 'selected',
  };
  const selectedEditor = {
    getModel: () => model,
    getSelection: () => ({
      isEmpty: () => false,
      getStartPosition: () => ({ offset: 4 }),
      getEndPosition: () => ({ offset: 12 }),
    }),
  };
  assert.deepEqual(requestFor(selectedEditor), {
    scope: { start: 4, end: 12 },
    query: 'selected',
  });
  assert.deepEqual(requestFor({
    getModel: () => model,
    getSelection: () => ({ isEmpty: () => true }),
  }), { scope: null, query: null });
});

test('Cmd/Ctrl+F and Cmd/Ctrl+R switch between selection and whole-file scope', () => {
  const start = source.indexOf('const openEditorFindFromShortcut = React.useCallback');
  const end = source.indexOf('React.useEffect(() => {', start);
  const opener = source.slice(start, end);
  assert.match(opener, /const request = editorFindKeyboardRequest\(editor\)/u);
  assert.match(opener, /if \(request\.scope === null\)/u);
  assert.match(opener, /openEditorFind\(withReplace, null, focusTarget, null\)/u);
  assert.match(opener, /openEditorFindInSelection\(request\.scope, withReplace, request\.query, focusTarget\)/u);

  const shortcutStart = source.indexOf("/* IDEA's editor search family: ⌘F Find");
  const shortcutEnd = source.indexOf('\n      }, [', source.indexOf('React.useEffect(() => {', shortcutStart));
  const shortcut = source.slice(shortcutStart, shortcutEnd);
  assert.match(shortcut, /openEditorFindFromShortcut\(true, 'replace'\)/u);
  assert.match(shortcut, /openEditorFindFromShortcut\(event\.altKey\)/u);
});
