import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTypeScriptCallback } from './ts-source.mjs';

const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

function loadOpenFindTool(terminalStates) {
  let findState = null;
  const openFindTool = loadTypeScriptCallback(workspaceSource, 'openFindTool', {
    findToolContentQuery: (query) => String(query ?? '').trim(),
    completeFindFiles: () => [],
    completeFindMatches: () => [],
    normalizeSearchOptions: (value) => value ?? {},
    readSearchOptions: () => ({}),
    readFindScope: () => ({ mode: 'project', preset: 'projectFiles', directory: '' }),
    readFindDirectoryRecursive: () => true,
    rootRef: { current: '' },
    findDockState: {
      claimFindDockSlot: () => terminalStates.push(false),
    },
    setTerminalOpen: (value) => terminalStates.push(value),
    setSearchEverywhere: () => {},
    setFindTool: (value) => {
      findState = value;
    },
    findToolHandoffSequenceRef: { current: 0 },
    findToolDraftRef: { current: { query: '', replace: '' } },
    findToolReopenDraft: (_draft, query) => ({ query, replace: '' }),
    window: { setTimeout: (callback) => callback() },
    document: { querySelector: () => null },
  });
  return {
    openFindTool,
    state: () => findState,
  };
}

test('popup Find leaves the Terminal dock open while an explicit dock transfer claims its slot', () => {
  const terminalStates = [];
  const harness = loadOpenFindTool(terminalStates);

  harness.openFindTool('needle', 'find', null, 'query', 'popup');
  assert.deepEqual(terminalStates, []);
  assert.equal(harness.state().surface, 'popup');

  harness.openFindTool('needle', 'find', null, 'query', 'dock');
  assert.deepEqual(terminalStates, [false]);
  assert.equal(harness.state().surface, 'dock');
});

test('recalling Replace in Files as a popup does not close the Terminal dock', () => {
  const terminalStates = [];
  let state = {
    query: 'needle',
    mode: 'find',
    surface: 'popup',
    files: [],
    matches: [],
    truncated: false,
    loading: false,
    error: null,
    index: 0,
    searchGeneration: 1,
    loadedGeneration: 1,
  };
  const openReplaceInFilesFromEditor = loadTypeScriptCallback(workspaceSource, 'openReplaceInFilesFromEditor', {
    currentCodeEditor: () => null,
    selectedEditorFindQuery: () => '',
    findTool: state,
    openFindTool: () => {
      throw new Error('an existing Find surface must be reused');
    },
    setTerminalOpen: (value) => terminalStates.push(value),
    setFindTool: (update) => {
      state = update(state);
    },
    window: { setTimeout: (callback) => callback() },
    document: { querySelector: () => null },
  });

  openReplaceInFilesFromEditor();

  assert.deepEqual(terminalStates, []);
  assert.equal(state.mode, 'replace');
  assert.equal(state.surface, 'popup');
});
