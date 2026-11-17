import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf(') {', start) + 2;
  assert.ok(bodyStart > 1, `${name} has no function body`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

function planHarness() {
  return new Function(
    `${extractFunction('basename')};`
      + `${extractFunction('harnessPathMention')};`
      + `${extractFunction('harnessReferencePlan')};`
      + 'return harnessReferencePlan;',
  )();
}

function editorHarness() {
  return new Function(
    `${extractFunction('normalizeNavigationPath')};`
      + `${extractFunction('navigationPathForModel')};`
      + `${extractFunction('harnessEditorLocation')};`
      + 'return harnessEditorLocation;',
  )();
}

function insertionHarness() {
  return new Function(
    `${extractFunction('basename')};`
      + `${extractFunction('harnessPathMention')};`
      + `${extractFunction('harnessReferencePlan')};`
      + `${extractFunction('focusHarnessComposer')};`
      + `${extractFunction('insertHarnessTextFallback')};`
      + `${extractFunction('insertHarnessReferencesIntoComposer')};`
      + 'return insertHarnessReferencesIntoComposer;',
  )();
}

test('Harness reference plan carries a selected line-column range', () => {
  const harnessReferencePlan = planHarness();
  const plan = harnessReferencePlan({
    path: 'src/app.js',
    root: '/repo',
    isDirectory: false,
    line: 5,
    column: 2,
    endLine: 7,
    endColumn: 9,
  });
  assert.equal(plan.positionText, 'L5:2-L7:9');
  assert.equal(plan.reference.clipboardText, '@src/app.js L5:2-L7:9');
  assert.equal(plan.reference.label, 'app.js L5:2-L7:9');
  assert.equal(plan.plainText, '@src/app.js L5:2-L7:9');
});

test('a collapsed range remains a single caret position', () => {
  const harnessReferencePlan = planHarness();
  const plan = harnessReferencePlan({
    path: 'src/app.js',
    root: '/repo',
    isDirectory: false,
    line: 5,
    column: 2,
    endLine: 5,
    endColumn: 2,
  });
  assert.equal(plan.positionText, 'L5:2');
  assert.equal(plan.reference.clipboardText, '@src/app.js L5:2');
});

test('Monaco editor location reads the caret or the normalized selected range', () => {
  const harnessEditorLocation = editorHarness();
  const model = { uri: { path: '/src/app.js' } };
  const caret = harnessEditorLocation({
    getModel: () => model,
    getPosition: () => ({ lineNumber: 4, column: 3 }),
    getSelection: () => ({
      isEmpty: () => true,
      startLineNumber: 4,
      startColumn: 3,
      endLineNumber: 4,
      endColumn: 3,
    }),
  });
  assert.deepEqual(caret, {
    path: 'src/app.js',
    line: 4,
    column: 3,
    endLine: null,
    endColumn: null,
  });

  const selected = harnessEditorLocation({
    getModel: () => model,
    getPosition: () => ({ lineNumber: 7, column: 9 }),
    getSelection: () => ({
      isEmpty: () => false,
      startLineNumber: 7,
      startColumn: 9,
      endLineNumber: 3,
      endColumn: 1,
    }),
  });
  assert.deepEqual(selected, {
    path: 'src/app.js',
    line: 3,
    column: 1,
    endLine: 7,
    endColumn: 9,
  });
});

test('Project and editor tab menus expose one direct Harness action', () => {
  const projectMenu = source.slice(
    source.indexOf('const buildTreeMenu = React.useCallback('),
    source.indexOf('/* Move one entry into a directory by drag-and-drop'),
  );
  assert.match(projectMenu, /items: \[\s*buildHarnessPathAction\(/u);
  assert.doesNotMatch(source, /buildHarnessMenuItems/u);
  assert.match(source, /id: 'harnessReference',[\s\S]*?label: `\$\{t\('editor\.harness'\)\}->`/u);
  assert.match(projectMenu, /\[\{ path: row\.path, isDirectory \}\]/u);
  assert.match(projectMenu, /buildHarnessPathAction\(harnessEntries\)/u);
  assert.match(source, /buildHarnessPathAction\(\[\{ path: file\.path, isDirectory: false \}\]\)/u);
  assert.match(source, /buildHarnessPathAction\(\[\{ path: splitTab, isDirectory: false \}\]\)/u);
  assert.match(source, /buildHarnessPathAction\(\[\{ path: diffTarget\.path, isDirectory: false \}\]\)/u);
  assert.doesNotMatch(source, /sendPathToHarness/u);
  assert.doesNotMatch(source, /sendSelectedPathsToHarness/u);
  assert.doesNotMatch(source, /sendPathWithPositionToHarness/u);
});

test('Monaco body context menu registers the direct Harness action', () => {
  assert.match(source, /id: `dsh-editor\.sendHarnessReference\.\$\{groupId\}`/u);
  assert.match(source, /sendHarnessReferenceLabel: `\$\{t\('editor\.harness'\)\}->`/u);
  assert.match(source, /contextMenuGroupId: 'navigation'/u);
  assert.match(source, /contextMenuOrder: -100/u);
  assert.match(source, /actionsHandlers\.onSendHarnessReference\?\.\(editorInstance\)/u);
  assert.equal((source.match(/onSendHarnessReference: sendHarnessEditorReference/g) ?? []).length, 2);
});

test('editor requests forward the selected range to the composer bridge', () => {
  assert.match(source, /line: position\?\.line \?\? null,[\s\S]*?column: position\?\.column \?\? null,[\s\S]*?endLine: position\?\.endLine \?\? null,[\s\S]*?endColumn: position\?\.endColumn \?\? null,/u);
  assert.match(source, /const sendHarnessEditorReference = React\.useCallback\(\(editor\) => \{/u);
  assert.match(source, /const location = harnessEditorLocation\(editor\);/u);
  assert.match(source, /void sendHarnessReference\(\[\{ path: location\.path, isDirectory: false \}\], location\)/u);
});

test('the composer bridge prefers the public addFiles verb without submitting', async () => {
  const insertHarnessReferencesIntoComposer = insertionHarness();
  const calls = [];
  const input = {
    state: {
      getSnapshot: () => ({ draft: 'keep', draftRev: 9 }),
    },
    addFiles(references, ids) {
      calls.push({ kind: 'addFiles', references, ids });
      return true;
    },
    insertReference() {
      calls.push({ kind: 'insertReference' });
      return false;
    },
    submit() {
      calls.push({ kind: 'submit' });
    },
  };
  const context = {
    get(name) {
      if (name === 'sessions') return { scope: (sessionId) => ({ sessionId }) };
      if (name === 'conversation') return { input: { for: () => input } };
      return undefined;
    },
  };
  const documentRef = {
    querySelector(selector) {
      if (selector === '[data-conversation-region="chat"]') {
        return { getAttribute: () => 'session-round719' };
      }
      return null;
    },
    getSelection: () => null,
  };
  const inserted = await insertHarnessReferencesIntoComposer(context, {
    entries: [{ path: 'src/app.js', isDirectory: false }],
    line: 3,
    column: 1,
    endLine: 5,
    endColumn: 7,
  }, { document: documentRef });
  assert.equal(inserted, true);
  assert.deepEqual(calls.map((call) => call.kind), ['addFiles']);
  assert.equal(calls[0].references[0].clipboardText, '@src/app.js L3:1-L5:7');
  assert.deepEqual(calls[0].ids, []);
});
