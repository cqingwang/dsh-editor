import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const controllerSource = await readFile(new URL('../src/client/controller.ts', import.meta.url), 'utf8');
const editorCoreSource = await readFile(new URL('../src/client/editor-core.ts', import.meta.url), 'utf8');
const source = [workspaceSource, controllerSource, editorCoreSource].join('\n');

function extractFunction(name) {
  return transpileTypeScriptFunction(source, name);
}

function helpers() {
  return new Function(
    `${extractFunction('basename')};` +
      `${extractFunction('harnessPathMention')};` +
      `${extractFunction('harnessReferencePlan')};` +
      'return { harnessPathMention, harnessReferencePlan };',
  )();
}

function insertionHarness() {
  return new Function(
    `${extractFunction('basename')};` +
      `${extractFunction('harnessPathMention')};` +
      `${extractFunction('harnessReferencePlan')};` +
      `${extractFunction('focusHarnessComposer')};` +
      `${extractFunction('insertHarnessTextFallback')};` +
      `${extractFunction('insertHarnessReferencesIntoComposer')};` +
      'return insertHarnessReferencesIntoComposer;',
  )();
}

function composerHarness(draft = '', rev = 7) {
  const calls = [];
  const state = {
    draft,
    draftRev: rev,
  };
  const input = {
    state: {
      getSnapshot: () => ({ ...state }),
    },
    insertText(text, span) {
      calls.push({ kind: 'insertText', text, span: { ...span } });
      if (span.draftRev !== state.draftRev || span.start < 0 || span.start > state.draft.length) return false;
      state.draft = state.draft.slice(0, span.start) + text + state.draft.slice(span.end);
      state.draftRev += 1;
      return true;
    },
    insertReference(reference, span) {
      calls.push({ kind: 'insertReference', reference: { ...reference }, span: { ...span } });
      if (span.draftRev !== state.draftRev || span.start < 0 || span.start > state.draft.length) return false;
      const tail = state.draft.slice(span.end, span.end + 1);
      const inserted = tail === ' ' ? reference.clipboardText : `${reference.clipboardText} `;
      state.draft = state.draft.slice(0, span.start) + inserted + state.draft.slice(span.end);
      state.draftRev += 1;
      return true;
    },
    submit() {
      calls.push({ kind: 'submit' });
    },
  };
  return { calls, input, state };
}

test('Harness mentions use DSH @ path syntax and quote whitespace', () => {
  const { harnessPathMention } = helpers();
  assert.equal(harnessPathMention('src/app.js'), '@src/app.js');
  assert.equal(harnessPathMention('docs/my notes.txt'), '@"docs/my notes.txt"');
  assert.equal(harnessPathMention('docs', true), '@docs/');
  assert.equal(harnessPathMention('docs/my notes', true), '@"docs/my notes/"');
});

test('Harness reference plan carries file identity and an exact line-column suffix', () => {
  const { harnessReferencePlan } = helpers();
  const plan = harnessReferencePlan({
    path: 'docs/my notes.txt',
    root: '/repo',
    isDirectory: false,
    line: 12,
    column: 4,
  });
  assert.equal(plan.reference.source, 'reference');
  assert.equal(plan.reference.clipboardText, '@"docs/my notes.txt" L12:4');
  assert.equal(plan.reference.ref, '@"docs/my notes.txt"');
  assert.equal(plan.reference.appearance, 'file');
  assert.equal(plan.reference.label, 'my notes.txt L12:4');
  assert.equal(plan.positionText, 'L12:4');
  assert.equal(plan.plainText, '@"docs/my notes.txt" L12:4');
});

test('Project root references use the absolute workspace path', () => {
  const { harnessReferencePlan } = helpers();
  const plan = harnessReferencePlan({
    path: '',
    root: '/repo',
    isDirectory: true,
  });
  assert.equal(plan.reference.clipboardText, '@/repo/');
  assert.equal(plan.reference.appearance, 'folder');
  assert.equal(plan.plainText, '@/repo/');
});

test('composer insertion appends without replacing the existing draft and never submits', async () => {
  const insertHarnessReferencesIntoComposer = insertionHarness();
  const { calls, input, state } = composerHarness('keep this draft');
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
        return { getAttribute: () => 'session-round717' };
      }
      return null;
    },
  };
  const inserted = await insertHarnessReferencesIntoComposer(
    context,
    {
      entries: [{ path: 'src/app.js', isDirectory: false }],
      line: 8,
      column: 3,
    },
    { document: documentRef },
  );
  assert.equal(inserted, true);
  assert.equal(state.draft, 'keep this draft @src/app.js L8:3 ');
  assert.deepEqual(
    calls.map((call) => call.kind),
    ['insertText', 'insertReference'],
  );
  assert.equal(calls[0].span.start, 'keep this draft'.length);
  assert.equal(calls[0].span.end, 'keep this draft'.length);
  assert.equal(calls[1].span.start, 'keep this draft '.length);
  assert.equal(
    calls.some((call) => call.kind === 'submit'),
    false,
  );
});

test('Harness action is first in Project and every editor tab menu', () => {
  const projectMenu = source.slice(
    source.indexOf('const buildTreeMenu = React.useCallback('),
    source.indexOf('/* Move one entry into a directory by drag-and-drop'),
  );
  assert.match(projectMenu, /items: \[\s*buildHarnessPathAction\(/u);
  assert.match(
    source,
    /id: 'harnessReference',[\s\S]*?label: `\$\{t\('editor\.harness'\)\}->`[\s\S]*?restoreFocus: false,/u,
  );
  assert.match(source, /buildHarnessPathAction\(\[\{ path: file\.path, isDirectory: false \}\]\)/u);
  assert.match(source, /buildHarnessPathAction\(\[\{ path: splitTab, isDirectory: false \}\]\)/u);
  assert.match(source, /buildHarnessPathAction\(\[\{ path: diffTarget\.path, isDirectory: false \}\]\)/u);
});

test('Editor receives the official composer insertion bridge', () => {
  assert.match(
    workspaceSource,
    /function EditorWorkspace\(\{[\s\S]*?onInsertHarnessReference,\s*\}:\s*EditorWorkspaceProps\)/u,
  );
  assert.match(controllerSource, /onInsertHarnessReference: \(request\) => insertHarnessReferencesIntoComposer\(ctx, request\)/u);
  assert.match(controllerSource, /input\.insertReference/u);
  assert.match(controllerSource, /input\.insertText/u);
  assert.doesNotMatch(
    controllerSource.slice(
      controllerSource.indexOf('async function insertHarnessReferencesIntoComposer('),
      controllerSource.indexOf('function createController('),
    ),
    /\.submit\(/u,
  );
});
