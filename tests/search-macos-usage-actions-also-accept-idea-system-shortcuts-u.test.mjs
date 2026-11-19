import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const source = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const foundationSource = await readFile(new URL('../src/client/foundation.ts', import.meta.url), 'utf8');
const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const editorCoreSource = await readFile(new URL('../src/client/editor-core.ts', import.meta.url), 'utf8');
const terminalSource = await readFile(new URL('../src/client/terminal.ts', import.meta.url), 'utf8');
const implementationSource = [foundationSource, commitSource, editorCoreSource, terminalSource].join('\n');

function extractFunction(name, text = implementationSource) {
  return transpileTypeScriptFunction(text, name);
}

function createGroupHarness(platform) {
  const actions = [];
  const editor = {
    addAction(spec) {
      actions.push(spec);
      return { dispose() {} };
    },
    createContextKey() {
      return { set() {} };
    },
    getSelection() {
      return null;
    },
    getPosition() {
      return null;
    },
    onDidChangeCursorSelection() {
      return { dispose() {} };
    },
    onDidChangeModel() {
      return { dispose() {} };
    },
    getAction() {
      return null;
    },
    focus() {},
    dispose() {},
  };
  const monaco = {
    KeyMod: { CtrlCmd: 1, Alt: 2, Shift: 4, WinCtrl: 8 },
    KeyCode: {
      KeyS: 10,
      KeyF: 11,
      KeyL: 12,
      KeyW: 13,
      KeyE: 14,
      KeyU: 21,
      F3: 61,
      F7: 65,
    },
    editor: { create: () => editor },
  };
  const create = new Function(
    'navigator',
    'detectTheme',
    'ensureEditorTheme',
    'EDITOR_UI_FONT',
    `let codeEditorGroupSequence = 0;
     const EDITOR_CODE_FONT_SIZE = 13;
     const EDITOR_CODE_LINE_HEIGHT = 20;
     ${extractFunction('isMacPlatform')}
     ${extractFunction('ideaControlKeyModifier')}
     ${extractFunction('findUsagesSearchTarget', commitSource)}
     ${extractFunction('editorFindSelectionScope')}
     ${extractFunction('filterMonacoContextMenuActions')}
     ${extractFunction('createCodeEditorGroup')};
     return createCodeEditorGroup;`,
  )(
    { platform },
    () => 'vs',
    () => 'dsh-editor-idea-light',
    'monospace',
  );
  create(monaco, {}, {});
  return actions;
}

test('macOS usage actions also accept IDEA System Shortcuts U chords', () => {
  const actions = createGroupHarness('MacIntel');
  const find = actions.find((entry) => entry.id.startsWith('dsh-editor.findUsagesInFile'));
  const highlight = actions.find((entry) => entry.id.startsWith('dsh-editor.highlightUsagesInFile'));
  assert.deepEqual(find.keybindings, [1 | 65, 8 | 4 | 21]);
  assert.deepEqual(highlight.keybindings, [1 | 4 | 65, 1 | 8 | 21]);
});

test('non-macOS usage actions keep the single default keymap chord', () => {
  const actions = createGroupHarness('Linux x86_64');
  const find = actions.find((entry) => entry.id.startsWith('dsh-editor.findUsagesInFile'));
  const highlight = actions.find((entry) => entry.id.startsWith('dsh-editor.highlightUsagesInFile'));
  assert.deepEqual(find.keybindings, [1 | 65]);
  assert.deepEqual(highlight.keybindings, [1 | 4 | 65]);
});

test('alternate chords stay out of the visible Actions shortcut metadata', () => {
  const actionsStart = source.indexOf('const searchEverywhereActions =');
  const actionsEnd = source.indexOf('/* Recompute match count', actionsStart);
  const actions = source.slice(actionsStart, actionsEnd);
  assert.match(actions, /id: 'findUsagesInFile'[\s\S]*?shortcut: '⌘F7'/);
  assert.match(actions, /id: 'highlightUsagesInFile'[\s\S]*?shortcut: '⇧⌘F7'/);
  assert.doesNotMatch(actions, /⌃⇧U|⌃⌘U/);
});

test('U alternates are Monaco-scoped and avoid a second global listener', () => {
  const groupStart = editorCoreSource.indexOf('function createCodeEditorGroup(');
  const groupEnd = editorCoreSource.indexOf('/**\n * Reuse one workspace model', groupStart);
  const group = editorCoreSource.slice(groupStart, groupEnd);
  assert.equal((group.match(/monaco\.KeyCode\.KeyU/g) ?? []).length, 2);
  assert.doesNotMatch(source, /event\.key\.toLowerCase\(\) === 'u'[\s\S]{0,160}findUsagesInFile/);
});
