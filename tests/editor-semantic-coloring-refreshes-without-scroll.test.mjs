import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const editorCore = readFileSync(join(root, 'src/client/editor-core.ts'), 'utf8');
const workspace = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');

function loadRefreshHelper() {
  return new Function(
    `${transpileTypeScriptFunction(editorCore, 'requestEditorSemanticTokens')}; return requestEditorSemanticTokens;`,
  )();
}

function loadLexicalHelper() {
  return new Function(
    `${transpileTypeScriptFunction(editorCore, 'semanticTokenLineWindow')};
     ${transpileTypeScriptFunction(editorCore, 'requestEditorLexicalTokens')};
     return requestEditorLexicalTokens;`,
  )();
}

function loadWhenReadyHelper() {
  return new Function(
    'window',
    `const requestedSemanticModels = new WeakMap();
     const pendingSemanticModels = new WeakMap();
     const IDEA_SEMANTIC_LANGUAGE_IDS = ['typescript', 'java', 'csharp'];
     const SEMANTIC_TOKEN_REFRESH_FIRST_RETRY_MS = 16;
     const SEMANTIC_TOKEN_REFRESH_RETRY_MS = 50;
     const SEMANTIC_TOKEN_REFRESH_MAX_ATTEMPTS = 6;
     const SEMANTIC_TOKEN_REFRESH_MIN_ATTEMPTS = 4;
     ${transpileTypeScriptFunction(editorCore, 'semanticTokenLineWindow')};
     ${transpileTypeScriptFunction(editorCore, 'requestEditorLexicalTokens')};
     ${transpileTypeScriptFunction(editorCore, 'requestEditorSemanticTokens')};
     ${transpileTypeScriptFunction(editorCore, 'modelHasSomeSemanticTokens')};
     ${transpileTypeScriptFunction(editorCore, 'requestEditorSemanticTokensWhenReady')};
     return requestEditorSemanticTokensWhenReady;`,
  );
}

function loadScrollRefreshHelpers() {
  const frames = [];
  const cancelledFrames = [];
  const requestedEditors = [];
  const lexicalEditors = [];
  const window = {
    requestAnimationFrame(callback) {
      frames.push(callback);
      return frames.length;
    },
    cancelAnimationFrame(frame) {
      cancelledFrames.push(frame);
    },
    setTimeout() {
      throw new Error('setTimeout fallback should not run while requestAnimationFrame exists');
    },
    clearTimeout() {},
  };
  const helpers = new Function(
    'window',
    'requestEditorSemanticTokens',
    'requestEditorLexicalTokens',
    `const scheduledSemanticTokenFrames = new WeakMap();
     ${transpileTypeScriptFunction(editorCore, 'scheduleEditorSemanticTokens')};
     ${transpileTypeScriptFunction(editorCore, 'cancelScheduledEditorSemanticTokens')};
     return { scheduleEditorSemanticTokens, cancelScheduledEditorSemanticTokens };`,
  )(
    window,
    (editor) => {
      requestedEditors.push(editor);
      return true;
    },
    (editor) => {
      lexicalEditors.push(editor);
      return true;
    },
  );
  return { ...helpers, frames, cancelledFrames, requestedEditors, lexicalEditors };
}

test('the editor can explicitly request the visible semantic-token range', () => {
  const request = loadRefreshHelper();
  let requests = 0;
  const editor = {
    getContribution(id) {
      assert.equal(id, 'editor.contrib.viewportSemanticTokens');
      return {
        _tokenizeViewportNow() {
          requests += 1;
        },
      };
    },
  };
  assert.equal(request(editor), true);
  assert.equal(requests, 1);
  assert.equal(request(null), false);
  assert.equal(request({ getContribution: () => ({}) }), false);
});

test('the editor forces lexical tokens through the visible viewport runway', () => {
  const request = loadLexicalHelper();
  const forcedLines = [];
  const model = {
    getLineCount: () => 10000,
    tokenization: {
      forceTokenization(lineNumber) {
        assert.equal(this, model.tokenization);
        forcedLines.push(lineNumber);
      },
    },
  };
  const editor = {
    getModel: () => model,
    getVisibleRangesPlusViewportAboveBelow: () => [{ startLineNumber: 5000, endLineNumber: 5031 }],
  };
  assert.equal(request(editor), true);
  assert.deepEqual(forcedLines, [5031]);
  assert.equal(request(null), false);
  assert.equal(request({ getModel: () => ({ tokenization: {} }) }), false);
});

test('lexical tokenization expands a plain visible range by one screen above and below', () => {
  const request = loadLexicalHelper();
  const forcedLines = [];
  const model = {
    getLineCount: () => 1000,
    tokenization: {
      forceTokenization(lineNumber) {
        assert.equal(this, model.tokenization);
        forcedLines.push(lineNumber);
      },
    },
  };
  request({
    getModel: () => model,
    getVisibleRanges: () => [{ startLineNumber: 100, endLineNumber: 129 }],
  });
  assert.deepEqual(forcedLines, [159]);
});

test('semantic range window covers one visible screen above and below', () => {
  const semanticTokenLineWindow = new Function(
    `${transpileTypeScriptFunction(editorCore, 'semanticTokenLineWindow')}; return semanticTokenLineWindow;`,
  )();
  assert.deepEqual(semanticTokenLineWindow(100, 129, 1000), { startLine: 70, endLine: 159 });
  assert.deepEqual(semanticTokenLineWindow(2, 20, 50), { startLine: 1, endLine: 39 });
  assert.deepEqual(semanticTokenLineWindow(40, 50, 50), { startLine: 29, endLine: 50 });
});

test('semantic refresh completes only after the minimum post-layout attempts and deduplicates a model', () => {
  const timers = [];
  const requestWhenReady = loadWhenReadyHelper()({
    setTimeout(callback, delay) {
      timers.push({ callback, delay });
    },
  });
  let requests = 0;
  const firstModel = {
    id: 'first',
    semanticTokens: false,
    getLanguageId: () => 'typescript',
    tokenization: {
      hasSomeSemanticTokens() {
        return this === undefined ? false : firstModel.semanticTokens;
      },
    },
  };
  let activeModel = firstModel;
  const editor = {
    getModel: () => activeModel,
    getContribution: () => ({
      _tokenizeViewportNow() {
        requests += 1;
      },
    }),
  };
  requestWhenReady(editor, activeModel);
  requestWhenReady(editor, activeModel);
  assert.equal(requests, 1);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 16);
  firstModel.semanticTokens = true;
  timers[0].callback();
  assert.equal(requests, 2);
  assert.equal(timers.length, 2);
  timers[1].callback();
  assert.equal(requests, 3);
  assert.equal(timers.length, 3);
  timers[2].callback();
  assert.equal(requests, 4);
  assert.equal(timers.length, 4);
  timers[3].callback();
  assert.equal(requests, 4);
  assert.equal(timers.length, 4);
  requestWhenReady(editor, firstModel);
  assert.equal(requests, 4);
  assert.equal(timers.length, 4);
  activeModel = {
    id: 'second',
    getLanguageId: () => 'typescript',
    tokenization: { hasSomeSemanticTokens: () => false },
  };
  requestWhenReady(editor, activeModel);
  assert.equal(requests, 5);
  assert.equal(timers.length, 5);
});

test('binding a visible model forces lexical tokens before semantic tokens', () => {
  const timers = [];
  const requestWhenReady = loadWhenReadyHelper()({
    setTimeout(callback, delay) {
      timers.push({ callback, delay });
    },
  });
  const events = [];
  const model = {
    getLanguageId: () => 'typescript',
    getLineCount: () => 200,
    tokenization: {
      forceTokenization(lineNumber) {
        assert.equal(this, model.tokenization);
        events.push(`lexical:${lineNumber}`);
      },
      hasSomeSemanticTokens: () => false,
    },
  };
  const editor = {
    getModel: () => model,
    getVisibleRangesPlusViewportAboveBelow: () => [{ startLineNumber: 10, endLineNumber: 40 }],
    getContribution: () => ({
      _tokenizeViewportNow() {
        events.push('semantic');
      },
    }),
  };
  requestWhenReady(editor, model);
  assert.deepEqual(events, ['lexical:40', 'semantic']);
});

test('semantic refresh retries when the contribution exists but tokens were not applied', () => {
  const timers = [];
  const requestWhenReady = loadWhenReadyHelper()({
    setTimeout(callback, delay) {
      timers.push({ callback, delay });
    },
  });
  const model = {
    id: 'first',
    semanticTokens: false,
    getLanguageId: () => 'typescript',
    tokenization: {
      hasSomeSemanticTokens: () => model.semanticTokens,
    },
  };
  let requests = 0;
  const editor = {
    getModel: () => model,
    getContribution: () => null,
  };
  requestWhenReady(editor, model);
  assert.equal(requests, 0);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 16);
  editor.getContribution = () => ({
    _tokenizeViewportNow() {
      requests += 1;
    },
  });
  timers[0].callback();
  assert.equal(requests, 1);
  assert.equal(timers.length, 2);
  assert.equal(timers[1].delay, 50);
  model.semanticTokens = true;
  timers[1].callback();
  assert.equal(requests, 2);
  assert.equal(timers.length, 3);
  timers[2].callback();
  assert.equal(requests, 3);
  assert.equal(timers.length, 4);
  timers[3].callback();
  assert.equal(requests, 3);
});

test('semantic refresh does not schedule work for languages without the shared provider', () => {
  const timers = [];
  const requestWhenReady = loadWhenReadyHelper()({
    setTimeout(callback, delay) {
      timers.push({ callback, delay });
    },
  });
  let requests = 0;
  const model = {
    getLanguageId: () => 'plaintext',
    tokenization: { hasSomeSemanticTokens: () => false },
  };
  requestWhenReady(
    {
      getModel: () => model,
      getContribution: () => ({
        _tokenizeViewportNow() {
          requests += 1;
        },
      }),
    },
    model,
  );
  assert.equal(requests, 0);
  assert.deepEqual(timers, []);
});

test('semantic refresh retries are bounded when no tokens ever arrive', () => {
  const timers = [];
  const requestWhenReady = loadWhenReadyHelper()({
    setTimeout(callback, delay) {
      timers.push({ callback, delay });
    },
  });
  let requests = 0;
  const model = {
    getLanguageId: () => 'java',
    tokenization: { hasSomeSemanticTokens: () => false },
  };
  const editor = {
    getModel: () => model,
    getContribution: () => ({
      _tokenizeViewportNow() {
        requests += 1;
      },
    }),
  };
  requestWhenReady(editor, model);
  while (timers.length > 0) timers.shift().callback();
  assert.equal(requests, 6);
  assert.deepEqual(timers, []);
});

test('a stale semantic retry cannot follow the editor to a newer model', () => {
  const timers = [];
  const requestWhenReady = loadWhenReadyHelper()({
    setTimeout(callback, delay) {
      timers.push({ callback, delay });
    },
  });
  let requests = 0;
  const first = {
    getLanguageId: () => 'java',
    tokenization: { hasSomeSemanticTokens: () => false },
  };
  const second = {
    getLanguageId: () => 'java',
    tokenization: { hasSomeSemanticTokens: () => false },
  };
  let activeModel = first;
  const editor = {
    getModel: () => activeModel,
    getContribution: () => ({
      _tokenizeViewportNow() {
        requests += 1;
      },
    }),
  };
  requestWhenReady(editor, first);
  activeModel = second;
  timers[0].callback();
  assert.equal(requests, 1);
  requestWhenReady(editor, second);
  assert.equal(requests, 2);
});

test('rapidly switching five models confines retries to the final visible model', () => {
  const timers = [];
  const requestWhenReady = loadWhenReadyHelper()({
    setTimeout(callback, delay) {
      timers.push({ callback, delay });
    },
  });
  const models = Array.from({ length: 5 }, (_, index) => ({
    id: `model-${index}`,
    getLanguageId: () => 'typescript',
    tokenization: { hasSomeSemanticTokens: () => false },
  }));
  let activeModel = models[0];
  const requestedModels = [];
  const editor = {
    getModel: () => activeModel,
    getContribution: () => ({
      _tokenizeViewportNow() {
        requestedModels.push(activeModel.id);
      },
    }),
  };
  for (const model of models) {
    activeModel = model;
    requestWhenReady(editor, model);
  }
  while (timers.length > 0) timers.shift().callback();
  assert.deepEqual(requestedModels, [
    'model-0',
    'model-1',
    'model-2',
    'model-3',
    'model-4',
    'model-4',
    'model-4',
    'model-4',
    'model-4',
    'model-4',
  ]);
  assert.deepEqual(timers, []);
});

test('binding a visible model requests semantic tokens without waiting for scroll', () => {
  assert.equal((workspace.match(/requestEditorSemanticTokensWhenReady\(editor, model\);/gu) ?? []).length, 2);
  assert.match(editorCore, /requestedSemanticModels\.get\(editor\) === model/u);
  assert.match(editorCore, /pendingSemanticModels\.get\(editor\) === model/u);
  assert.match(editorCore, /modelHasSomeSemanticTokens\(model\)/u);
  assert.match(editorCore, /SEMANTIC_TOKEN_REFRESH_RETRY_MS/u);
});

test('scroll refresh requests the new viewport once on the next animation frame', () => {
  const { scheduleEditorSemanticTokens, frames, requestedEditors, lexicalEditors } = loadScrollRefreshHelpers();
  const model = { id: 'visible' };
  const editor = { getModel: () => model };
  assert.equal(scheduleEditorSemanticTokens(null), false);
  assert.equal(scheduleEditorSemanticTokens(editor), true);
  assert.equal(scheduleEditorSemanticTokens(editor), false);
  assert.equal(scheduleEditorSemanticTokens(editor), false);
  assert.equal(frames.length, 1);
  assert.deepEqual(requestedEditors, []);
  frames[0]();
  assert.deepEqual(lexicalEditors, [editor]);
  assert.deepEqual(requestedEditors, [editor]);
  assert.equal(scheduleEditorSemanticTokens(editor), true);
  assert.equal(frames.length, 2);
});

test('scroll refresh skips an editor whose model has already been detached', () => {
  const { scheduleEditorSemanticTokens, frames, requestedEditors } = loadScrollRefreshHelpers();
  const editor = { getModel: () => null };
  scheduleEditorSemanticTokens(editor);
  frames[0]();
  assert.deepEqual(requestedEditors, []);
});

test('editor disposal cancels a pending scroll refresh', () => {
  const { scheduleEditorSemanticTokens, cancelScheduledEditorSemanticTokens, cancelledFrames, requestedEditors } =
    loadScrollRefreshHelpers();
  const editor = { getModel: () => ({ id: 'visible' }) };
  scheduleEditorSemanticTokens(editor);
  cancelScheduledEditorSemanticTokens(editor);
  assert.deepEqual(cancelledFrames, [1]);
  assert.deepEqual(requestedEditors, []);
});

test('the editor group wires scroll refresh through the shared scheduler', () => {
  assert.match(
    editorCore,
    /editor\.onDidScrollChange\?\.\(\(\) => \{\s+clearDefinitionHover\(\);\s+scheduleEditorSemanticTokens\(editor\);\s+\}\)/u,
  );
  assert.match(editorCore, /cancelScheduledEditorSemanticTokens\(editor\);/u);
});
