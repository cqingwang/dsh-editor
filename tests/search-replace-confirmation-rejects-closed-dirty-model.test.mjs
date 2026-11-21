import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

test('a dirty model removed while confirmation is open blocks the whole write', async () => {
  const unavailableDirtyReplacePath = loadTypeScriptFunction(commitSource, 'unavailableDirtyReplacePath');
  const replaceFailureSettlement = loadTypeScriptFunction(commitSource, 'replaceFailureSettlement');
  const confirm = new Function(
    'releaseReplaceAttempt',
    'replaceFailureSettlement',
    'unavailableDirtyReplacePath',
    `${loadTypeScriptFunction(commitSource, 'confirmFindReplaceAndGeneration')}
return confirmFindReplaceAndGeneration;`,
  )(
    (guard) => {
      if (guard !== null) guard.current = false;
    },
    replaceFailureSettlement,
    unavailableDirtyReplacePath,
  );

  const model = { getValue: () => 'Token', isDisposed: () => false };
  const models = new Map([['dirty.ts', model]]);
  const guard = { current: true };
  let state = {
    query: 'Token',
    textMatches: [{ path: 'dirty.ts' }, { path: 'clean.ts' }],
    replaceBusy: false,
    error: null,
    errorSource: null,
    replaceFocusRequest: 0,
  };
  const accepted = await confirm(
    async () => {
      models.delete('dirty.ts');
      return true;
    },
    () => true,
    guard,
    (update) => {
      state = update(state);
    },
    [{ path: 'dirty.ts', model, before: 'Token', text: 'Token_DONE', count: 1 }],
    models,
    (key, params) => `${key}:${params.path}`,
  );

  assert.equal(accepted, false);
  assert.equal(guard.current, false);
  assert.equal(state.error, 'editor.searchReplaceDirtyClosed:dirty.ts');
  assert.equal(state.replaceFocusRequest, 1);
});

test('a dirty model changed while confirmation is open blocks the whole write', async () => {
  const unavailableDirtyReplacePath = loadTypeScriptFunction(commitSource, 'unavailableDirtyReplacePath');
  const replaceFailureSettlement = loadTypeScriptFunction(commitSource, 'replaceFailureSettlement');
  const confirm = new Function(
    'releaseReplaceAttempt',
    'replaceFailureSettlement',
    'unavailableDirtyReplacePath',
    `${loadTypeScriptFunction(commitSource, 'confirmFindReplaceAndGeneration')}
return confirmFindReplaceAndGeneration;`,
  )(
    (guard) => {
      if (guard !== null) guard.current = false;
    },
    replaceFailureSettlement,
    unavailableDirtyReplacePath,
  );

  let content = 'Token';
  const model = { getValue: () => content, isDisposed: () => false };
  const guard = { current: true };
  let state = {
    query: 'Token',
    textMatches: [{ path: 'dirty.ts' }, { path: 'clean.ts' }],
    replaceBusy: false,
    error: null,
    errorSource: null,
    replaceFocusRequest: 0,
  };
  const accepted = await confirm(
    async () => {
      content = 'Token changed';
      return true;
    },
    () => true,
    guard,
    (update) => {
      state = update(state);
    },
    [{ path: 'dirty.ts', model, before: 'Token', text: 'Token_DONE', count: 1 }],
    new Map([['dirty.ts', model]]),
    (key, params) => `${key}:${params.path}`,
  );

  assert.equal(accepted, false);
  assert.equal(guard.current, false);
  assert.equal(state.error, 'editor.searchReplaceDirtyClosed:dirty.ts');
});

test('disposed or replaced dirty models are rejected while the live plan is accepted', () => {
  const unavailableDirtyReplacePath = loadTypeScriptFunction(commitSource, 'unavailableDirtyReplacePath');
  const model = { getValue: () => 'Token', isDisposed: () => false };
  const replacement = { getValue: () => 'Token', isDisposed: () => false };
  assert.equal(
    unavailableDirtyReplacePath([{ path: 'dirty.ts', model, before: 'Token' }], new Map([['dirty.ts', model]])),
    null,
  );
  assert.equal(unavailableDirtyReplacePath([{ path: 'dirty.ts', model, before: 'Token' }], new Map()), 'dirty.ts');
  assert.equal(
    unavailableDirtyReplacePath([{ path: 'dirty.ts', model, before: 'Token' }], new Map([['dirty.ts', replacement]])),
    'dirty.ts',
  );
  assert.equal(
    unavailableDirtyReplacePath(
      [{ path: 'dirty.ts', model: { ...model, isDisposed: () => true }, before: 'Token' }],
      new Map([['dirty.ts', { ...model, isDisposed: () => true }]]),
    ),
    'dirty.ts',
  );
  assert.equal(
    unavailableDirtyReplacePath(
      [{ path: 'dirty.ts', model: { getValue: () => 'Token changed' }, before: 'Token' }],
      new Map([['dirty.ts', { getValue: () => 'Token changed' }]]),
    ),
    'dirty.ts',
  );
});

test('dirty commit refuses a model changed after confirmation but during host I/O', () => {
  const commitFindToolDirtyPlans = loadTypeScriptFunction(commitSource, 'commitFindToolDirtyPlans');
  let content = 'Token changed';
  const model = {
    getValue: () => content,
    getFullModelRange: () => ({}),
    pushStackElement: () => {},
    pushEditOperations: () => {},
  };
  assert.throws(
    () => commitFindToolDirtyPlans([{ path: 'dirty.ts', model, before: 'Token', text: 'Token_DONE', count: 1 }]),
    /dirty buffer changed since it was planned: dirty\.ts/u,
  );
  assert.equal(content, 'Token changed');
});

test('late dirty-plan drift is localized and preserves partial-success wording', () => {
  const replaceFailureMessage = loadTypeScriptFunction(commitSource, 'replaceFailureMessage');
  const searchReplaceFailureMessage = new Function(
    'searchTextFailureMessage',
    'replaceFailureMessage',
    `${loadTypeScriptFunction(commitSource, 'searchReplaceFailureMessage')}
return searchReplaceFailureMessage;`,
  )(() => 'host search failure', replaceFailureMessage);
  const failure = new Error('dirty buffer changed since it was planned: dirty.ts');
  const t = (key, params) => (params === undefined ? key : `${key}:${params.path ?? params.message}`);
  assert.equal(searchReplaceFailureMessage(failure, 0, t), 'editor.searchReplaceDirtyClosed:dirty.ts');
  assert.equal(
    searchReplaceFailureMessage(failure, 1, t),
    'editor.searchReplacePartialFailure:editor.searchReplaceDirtyClosed:dirty.ts',
  );
});

test('both Replace All paths validate dirty plans after confirmation', () => {
  const searchReplace = workspaceSource.slice(
    workspaceSource.indexOf('const replaceInFiles = React.useCallback'),
    workspaceSource.indexOf('const replaceInFindTool = React.useCallback'),
  );
  const findReplace = workspaceSource.slice(
    workspaceSource.indexOf('const replaceInFindTool = React.useCallback'),
    workspaceSource.indexOf('const replaceFindToolOccurrence = React.useCallback'),
  );
  for (const block of [searchReplace, findReplace]) {
    assert.match(
      block,
      /confirmFindReplaceAndGeneration\([\s\S]*?set(?:SearchEverywhere|FindTool),\s+dirtyPlans,\s+modelsRef\.current,\s+t,/u,
    );
  }
});

test('Undo and Redo dirty plans carry their expected pre-image', () => {
  const undo = workspaceSource.slice(
    workspaceSource.indexOf('const undoFindReplace = React.useCallback'),
    workspaceSource.indexOf('const dismissExternal = React.useCallback'),
  );
  const redo = workspaceSource.slice(
    workspaceSource.indexOf('const redoFindReplace ='),
    workspaceSource.indexOf('const dismissExternal = React.useCallback'),
  );
  assert.match(undo, /before: entry\.afterContent,\s+text: entry\.beforeContent,/u);
  assert.match(redo, /before: entry\.beforeContent,\s+text: entry\.afterContent,/u);
});

test('Undo and Redo report clean-host partial success when dirty commit fails', () => {
  const undo = workspaceSource.slice(
    workspaceSource.indexOf('const undoFindReplace = React.useCallback'),
    workspaceSource.indexOf('const dismissExternal = React.useCallback'),
  );
  const redo = workspaceSource.slice(
    workspaceSource.indexOf('const redoFindReplace ='),
    workspaceSource.indexOf('const dismissExternal = React.useCallback'),
  );
  for (const block of [undo, redo]) {
    assert.match(block, /let hostChanged: string\[\] = \[\],\s+dirtyCommitted = false;/u);
    assert.match(block, /hostChanged = Array\.isArray\(value\?\.files\) \? value\.files : \[\];/u);
    assert.match(block, /searchReplaceFailureMessage\(failure, hostChanged\.length, t\)/u);
    assert.match(block, /refreshHostReplaceChanges\(hostChanged\)\.catch\(\(\) => \{\}\)/u);
  }
});

test('partial Undo and Redo degrade the retried operation to dirty-only', () => {
  const dirtyOnlyReplaceHistoryTail = loadTypeScriptFunction(commitSource, 'dirtyOnlyReplaceHistoryTail');
  const history = [
    {
      operationId: 'host-op',
      clean: true,
      dirty: [{ path: 'dirty.ts', beforeContent: 'before', afterContent: 'after' }],
      files: ['dirty.ts', 'clean.ts'],
      replacements: 2,
    },
  ];
  assert.deepEqual(dirtyOnlyReplaceHistoryTail(history), [
    {
      operationId: '',
      clean: false,
      dirty: [{ path: 'dirty.ts', beforeContent: 'before', afterContent: 'after' }],
      files: ['dirty.ts'],
      replacements: 2,
    },
  ]);
  const undo = workspaceSource.slice(
    workspaceSource.indexOf('const undoFindReplace = React.useCallback'),
    workspaceSource.indexOf('const dismissExternal = React.useCallback'),
  );
  const redo = workspaceSource.slice(
    workspaceSource.indexOf('const redoFindReplace ='),
    workspaceSource.indexOf('const dismissExternal = React.useCallback'),
  );
  for (const block of [undo, redo]) {
    assert.match(block, /let hostChanged: string\[\] = \[\],\s+dirtyCommitted = false;/u);
    assert.match(block, /dirtyCommitted = true;/u);
    assert.match(block, /!dirtyCommitted/u);
    assert.match(block, /dirtyOnlyReplaceHistoryTail/u);
    assert.match(block, /setFindReplace(?:Undo|Redo)Stack/u);
  }
});
