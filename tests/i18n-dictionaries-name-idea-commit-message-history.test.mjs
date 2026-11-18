import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = ((readFileSync(join(root, 'src/client/components/commit/CommitPanel.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'))) + '\n' + readFileSync(join(root, 'src/client/components/commit/CommitLog.tsx'), 'utf8');
const locales = readFileSync(join(root, 'src/client/locales.ts'), 'utf8');
const iconSource = readFileSync(join(root, 'src/client/components/ui/Icon.tsx'), 'utf8');

function commitPanel() {
  const start = source.indexOf('function CommitPanel(');
  assert.notEqual(start, -1);
  const end = source.indexOf('function CommitLogView(', start);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('both dictionaries name IDEA Commit Message History', () => {
  assert.match(locales, /commitMessageHistory: '提交信息历史',/);
  assert.match(locales, /commitMessageHistory: 'Commit Message History',/);
  assert.match(iconSource, /case 'history':/);
});

test('the Commit composer exposes a disabled-aware history button', () => {
  const panel = commitPanel();
  assert.match(panel, /const \[historyMenu, setHistoryMenu\] = React\.useState\(null\)/);
  assert.match(panel, /icon: 'history'/);
  assert.match(panel, /label: t\('editor\.commitMessageHistory'\)/);
  assert.match(panel, /disabled: history\.length === 0/);
  assert.match(panel, /setHistoryMenu\(\{/);
});

test('the history menu reuses stored messages and selects one directly', () => {
  const panel = commitPanel();
  assert.match(panel, /history\.map\(\(entry, index\) =>/);
  assert.match(panel, /label: entry\.split\('\\n'\)\[0\]/);
  assert.match(panel, /onPickHistory\?\.\(index\)/);
  assert.match(panel, /<ContextMenu\s+menu=\{historyMenu\}/u);
  assert.match(source, /onPickHistory: \(index\) => selectHistoryMessage\(index\)/);
});

test('selecting a history entry records the draft and updates the arrow-walk index', () => {
  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  const block = workspace.slice(
    workspace.indexOf('const selectHistoryMessage = React.useCallback('),
    workspace.indexOf('const restoreClearedMessage = React.useCallback(', workspace.indexOf('const selectHistoryMessage = React.useCallback(')),
  );
  assert.notEqual(block.length, 0);
  assert.match(block, /if \(draftBeforeRecall\.current === null && historyIndex === -1\) draftBeforeRecall\.current = commitMessage/);
  assert.match(block, /setHistoryIndex\(index\)/);
  assert.match(block, /setCommitMessage\(messageHistory\[index\]\)/);
});
