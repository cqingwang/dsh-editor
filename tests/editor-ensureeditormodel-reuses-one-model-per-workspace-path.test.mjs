import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');
const editorCoreSource = readFileSync(join(root, 'src/client/editor-core.ts'), 'utf8');

function loadEnsureEditorModel() {
  return new Function(
    'safeLanguage',
    'configureMonacoLanguageWhenReady',
    `${transpileTypeScriptFunction(editorCoreSource, 'ensureEditorModel')}; return ensureEditorModel;`,
  )(
    () => 'typescript',
    () => Promise.resolve(true),
  );
}

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
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

function fakeMonaco() {
  const createdModels = [];
  const editors = [];
  const monaco = {
    KeyMod: { CtrlCmd: 1, Alt: 2, WinCtrl: 3 },
    KeyCode: { KeyS: 10, KeyF: 11, KeyL: 12, KeyW: 13 },
    Uri: { parse: (value) => ({ value }) },
    languages: {
      getLanguages: () => [{ id: 'typescript' }],
      typescript: {
        ModuleResolutionKind: { NodeJs: 2 },
        ModuleKind: { ESNext: 99 },
        ScriptTarget: { ESNext: 99 },
        JsxEmit: { ReactJSX: 4 },
        typescriptDefaults: { setDiagnosticsOptions() {}, setCompilerOptions() {} },
        javascriptDefaults: { setDiagnosticsOptions() {}, setCompilerOptions() {} },
      },
    },
    editor: {
      create(container, options) {
        const actions = [];
        const editor = {
          container,
          options,
          model: null,
          disposed: 0,
          actions,
          addAction(spec) {
            actions.push(spec);
            return {
              dispose() {
                spec.disposed = (spec.disposed ?? 0) + 1;
              },
            };
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
          setModel(model) {
            this.model = model;
          },
          getModel() {
            return this.model;
          },
          dispose() {
            this.disposed += 1;
          },
        };
        editors.push(editor);
        return editor;
      },
      createModel(content, language, uri) {
        const model = {
          content,
          language,
          uri,
          disposed: 0,
          dispose() {
            this.disposed += 1;
          },
        };
        createdModels.push(model);
        return model;
      },
    },
  };
  return { monaco, editors, createdModels };
}

test('ensureEditorModel reuses one model per workspace path', () => {
  const { monaco, createdModels } = fakeMonaco();
  const ensureEditorModel = loadEnsureEditorModel();
  const models = new Map();
  const first = ensureEditorModel(monaco, models, 'src/a.ts', 'export {};');
  const second = ensureEditorModel(monaco, models, 'src/a.ts', 'different input is ignored once cached');
  assert.equal(first, second);
  assert.equal(createdModels.length, 1);
  assert.equal(first.content, 'export {};');
  assert.equal(first.language, 'typescript');
});

test('two editor groups share a model and disposing one never disposes it', () => {
  const { monaco, editors } = fakeMonaco();
  const ensureEditorModel = loadEnsureEditorModel();
  const create = new Function(
    'detectTheme',
    'ensureEditorTheme',
    'EDITOR_UI_FONT',
    `let codeEditorGroupSequence = 0;
     const EDITOR_CODE_FONT_SIZE = 13;
     const EDITOR_CODE_LINE_HEIGHT = 20;
     ${extractFunction('isMacPlatform')}
     ${extractFunction('ideaControlKeyModifier')}
     ${extractFunction('findUsagesSearchTarget')}
     ${extractFunction('filterMonacoContextMenuActions')}
     ${extractFunction('createCodeEditorGroup')};
     return createCodeEditorGroup;`,
  )(
    () => 'vs',
    () => 'dsh-editor-idea-light',
    '"Trebuchet MS", sans-serif',
  );
  const models = new Map();
  const model = ensureEditorModel(monaco, models, 'src/a.ts', 'shared');
  const handlers = {
    onSave() {},
    onFind() {},
    onSaveAll() {},
    onGotoLine() {},
    onCloseTab() {},
  };
  const left = create(monaco, {}, handlers);
  const right = create(monaco, {}, handlers);
  left.editor.setModel(model);
  right.editor.setModel(model);
  assert.equal(left.editor.getModel(), right.editor.getModel());
  left.dispose();
  assert.equal(left.editor.disposed, 1);
  assert.equal(right.editor.disposed, 0);
  assert.equal(model.disposed, 0);
  right.dispose();
  assert.equal(right.editor.disposed, 1);
  assert.equal(model.disposed, 0);
  assert.equal(editors.length, 2);
});

test('editor group actions forward IDEA shortcuts and dispose once', () => {
  const { monaco, editors } = fakeMonaco();
  const create = new Function(
    'detectTheme',
    'ensureEditorTheme',
    'EDITOR_UI_FONT',
    `let codeEditorGroupSequence = 0;
     const EDITOR_CODE_FONT_SIZE = 13;
     const EDITOR_CODE_LINE_HEIGHT = 20;
     ${extractFunction('isMacPlatform')}
     ${extractFunction('ideaControlKeyModifier')}
     ${extractFunction('findUsagesSearchTarget')}
     ${extractFunction('filterMonacoContextMenuActions')}
     ${extractFunction('createCodeEditorGroup')};
     return createCodeEditorGroup;`,
  )(
    () => 'vs',
    () => 'dsh-editor-idea-light',
    '"Trebuchet MS", sans-serif',
  );
  const calls = [];
  const group = create(
    monaco,
    {},
    {
      onSave: () => calls.push('save'),
      onFind: () => calls.push('find'),
      onSaveAll: () => calls.push('saveAll'),
      onGotoLine: () => calls.push('goto'),
      onCloseTab: () => calls.push('close'),
    },
  );
  const action = (id) => editors[0].actions.find((entry) => entry.id === id);
  action('dsh-editor.save').run();
  action('dsh-editor.find').run();
  action('dsh-editor.saveAll').run();
  action('dsh-editor.gotoLine').run();
  action('dsh-editor.closeTab').run();
  assert.deepEqual(calls, ['save', 'find', 'saveAll', 'goto', 'close']);
  group.dispose();
  group.dispose();
  assert.equal(editors[0].disposed, 1);
  for (const spec of editors[0].actions) assert.equal(spec.disposed, 1);
});

test('EditorWorkspace creates its current editor through the reusable group helper', () => {
  const effect = source.slice(
    source.indexOf('/* Create Monaco once the container exists. */'),
    source.indexOf("/* Bind the active file's model to the editor. */"),
  );
  assert.match(effect, /createCodeEditorGroup\(monaco, containerRef\.current/);
  assert.match(effect, /editorRef\.current = editor/);
  assert.match(effect, /group\.dispose\(\)/);
});
