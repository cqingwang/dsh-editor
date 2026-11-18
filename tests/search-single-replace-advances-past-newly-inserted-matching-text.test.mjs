import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTypeScriptCallback } from './ts-source.mjs';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

function extract(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`unterminated ${name}`);
}

const replaceAdvanceIndex = new Function(
  `${extract('findToolReplaceAdvanceIndex')}\nreturn findToolReplaceAdvanceIndex;`,
)();

test('Single Replace advances past the newly inserted matching text', () => {
  const rows = [
    { rowKey: 'text:r675.txt:1:1' },
    { rowKey: 'text:r675.txt:2:1' },
    { rowKey: 'text:r675.txt:3:1' },
  ];
  assert.equal(replaceAdvanceIndex(rows, 'text:r675.txt:1:1', 0), 1);
  assert.equal(replaceAdvanceIndex(rows, 'text:r675.txt:3:1', 2), 0);
});

test('Single Replace keeps the natural next index when the replaced row disappears', () => {
  const rows = [
    { rowKey: 'text:r675.txt:2:1' },
    { rowKey: 'text:r675.txt:3:1' },
  ];
  assert.equal(replaceAdvanceIndex(rows, 'text:r675.txt:1:1', 0), 0);
  assert.equal(replaceAdvanceIndex(rows, 'text:r675.txt:1:1', 9), 1);
  assert.equal(replaceAdvanceIndex([], 'missing', 3), 0);
});

test('Single replacement records the replaced row and applies one advance request', async () => {
  let state = {
    query: 'needle',
    replace: 'thread',
    searchGeneration: 2,
    replaceFocusRequest: 0,
    replaceAdvanceRevision: 0,
  };
  const replaceFindToolOccurrence = loadTypeScriptCallback(workspaceSource, 'replaceFindToolOccurrence', {
    findToolContentQuery: (query) => String(query ?? ''),
    findTool: state,
    hasFindToolContentQuery: () => true,
    openFilesRef: { current: [] },
    modelsRef: { current: new Map() },
    textOffsetAtLineColumn: () => 0,
    editorReplaceAt: () => ({ error: null }),
    normalizeTextSearchContextFilter: () => 'anywhere',
    normalizeFileExtensionFilter: () => '',
    findToolScopeIncludePatterns: [],
    findToolScopeExcludePatterns: [],
    claimReplaceAttempt: () => true,
    replaceWriteBusyRef: { current: false },
    releaseReplaceAttempt: () => {},
    callFs: async () => ({ files: ['a.ts'], replacements: 1, operationId: 'op-1' }),
    loadGit: async () => {},
    reloadFile: async () => {},
    rememberCurrentFindQuery: () => {},
    rememberCurrentReplacement: () => {},
    setFindReplaceRedoStack: () => {},
    setFindReplaceUndoStack: () => {},
    boundedReplaceHistory: (current, operation) => [...current, operation],
    flashStatus: () => {},
    searchReplaceCountParams: () => ({ files: 1, replacements: 1 }),
    t: (key) => key,
    setOpenFiles: () => {},
    setFindTool: (updater) => {
      state = updater(state);
    },
  });
  await replaceFindToolOccurrence(
    {
      kind: 'text',
      path: 'a.ts',
      line: 1,
      column: 1,
      rowKey: 'text:a.ts:1:1',
    },
    0,
  );
  assert.equal(state.replaceAdvanceRowKey, 'text:a.ts:1:1');
  assert.equal(state.replaceAdvanceRevision, 1);
});
