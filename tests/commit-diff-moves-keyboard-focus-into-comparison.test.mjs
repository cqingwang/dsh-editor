import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptCallback } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceSource = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');

function closeDiffHarness({
  activePath,
  selectedChange = null,
  rememberedRow = null,
  focusRow = null,
  rollbackSession = null,
}) {
  const focused = [];
  const closeDiff = loadTypeScriptCallback(workspaceSource, 'closeDiff', {
    setDiffTarget: () => {},
    setDiffActive: () => {},
    rollbackDiff: { take: () => rollbackSession },
    resumeRollbackDiffSession: (session) =>
      session.resume({
        selectedKeys: session.selectedKeys,
        deleteAdded: session.deleteAdded,
        selectedKey: session.selectedKey,
        scrollTop: session.scrollTop,
      }),
    activePathRef: { current: activePath },
    editorRef: { current: { focus: () => focused.push('editor') } },
    selectedChangeRef: { current: selectedChange },
    diffReturnFocusRef: { current: rememberedRow },
    changeRowRefs: {
      current: new Map([['unstaged:a.ts', focusRow]]),
    },
    window: { setTimeout: (callback) => callback() },
  });
  closeDiff();
  return focused;
}

test('closing a diff over an editor returns keyboard focus to that editor', () => {
  assert.deepEqual(closeDiffHarness({ activePath: 'a.ts' }), ['editor']);
});

test('closing a diff without an editor returns focus to the selected Change row', () => {
  const focused = [];
  const row = {
    isConnected: true,
    focus: () => focused.push('selected-row'),
  };
  closeDiffHarness({
    activePath: null,
    selectedChange: { path: 'a.ts', staged: false },
    focusRow: row,
  });
  assert.deepEqual(focused, ['selected-row']);
});

test('closing a diff prefers the row that originally opened it', () => {
  const focused = [];
  const rememberedRow = {
    isConnected: true,
    focus: () => focused.push('remembered-row'),
  };
  const selectedRow = {
    isConnected: true,
    focus: () => focused.push('selected-row'),
  };
  closeDiffHarness({
    activePath: null,
    selectedChange: { path: 'a.ts', staged: false },
    rememberedRow,
    focusRow: selectedRow,
  });
  assert.deepEqual(focused, ['remembered-row']);
});

test('closing a rollback diff resumes the dialog instead of focusing the editor', () => {
  const resumed = [];
  const focused = closeDiffHarness({
    activePath: 'a.ts',
    rollbackSession: {
      selectedKeys: new Set(['unstaged:a.ts']),
      deleteAdded: false,
      selectedKey: 'unstaged:a.ts',
      scrollTop: 48,
      resume: (initial) => resumed.push({ action: 'rollback-dialog', initial }),
    },
  });
  assert.deepEqual(resumed, [
    {
      action: 'rollback-dialog',
      initial: {
        selectedKeys: new Set(['unstaged:a.ts']),
        deleteAdded: false,
        selectedKey: 'unstaged:a.ts',
        scrollTop: 48,
      },
    },
  ]);
  assert.deepEqual(focused, []);
});
