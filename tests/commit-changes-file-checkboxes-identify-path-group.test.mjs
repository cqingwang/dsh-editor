import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('./fixtures/commit-panel.legacy.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const commit = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function groupActionMenuItems('));

test('Changes file checkboxes identify both the path and its group', () => {
  assert.match(commit, /'aria-label': t\('editor\.includeFileInCommit', \{ path: change\.path, group: group\.label \}\)/);
});

test('directory checkboxes name the real stage, unstage or VCS action', () => {
  assert.match(commit, /group\.id === 'staged'\s+\? t\('editor\.unstageDirectoryFiles', \{ path: row\.path \}\)\s+: group\.id === 'unversioned'\s+\? t\('editor\.addDirectoryToVcs', \{ path: row\.path \}\)\s+: t\('editor\.stageDirectoryFiles', \{ path: row\.path \}\)/);
});

test('the new selection names exist in both dictionaries', () => {
  for (const [key, zh, en] of [
    ['includeFileInCommit', '将 {path}（{group}）包含到提交', 'Include {path} from {group} in commit'],
    ['stageDirectoryFiles', '暂存目录 {path} 中的所有文件', 'Stage all files in directory {path}'],
    ['unstageDirectoryFiles', '取消暂存目录 {path} 中的所有文件', 'Unstage all files in directory {path}'],
    ['addDirectoryToVcs', '将目录 {path} 中的所有文件添加到 VCS', 'Add all files in directory {path} to VCS'],
  ]) {
    assert.equal(source.split(`${key}: '${zh}'`).length - 1, 1, `${key} zh`);
    assert.equal(source.split(`${key}: '${en}'`).length - 1, 1, `${key} en`);
  }
});
