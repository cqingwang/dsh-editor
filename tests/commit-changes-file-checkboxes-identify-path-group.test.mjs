import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/commit/CommitPanel.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const locales = await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8');
const commit = source.slice(source.indexOf('function CommitPanel('), source.indexOf('export { CommitPanel };'));

test('Changes file checkboxes identify both the path and its group', () => {
  assert.match(commit, /aria-label=\{t\('editor\.includeFileInCommit', \{\s+path: change\.path,\s+group: group\.label,\s+\}\)\}/u);
});

test('directory checkboxes name the real stage, unstage or VCS action', () => {
  assert.match(
    commit,
    /group\.id === 'staged'\s+\? t\('editor\.unstageDirectoryFiles', \{\s+path: row\.path,\s+\}\)\s+: group\.id === 'unversioned'\s+\? t\('editor\.addDirectoryToVcs', \{\s+path: row\.path,\s+\}\)\s+: t\('editor\.stageDirectoryFiles', \{\s+path: row\.path,\s+\}\)/u,
  );
});

test('the new selection names exist in both dictionaries', () => {
  for (const [key, zh, en] of [
    ['includeFileInCommit', '将 {path}（{group}）包含到提交', 'Include {path} from {group} in commit'],
    ['stageDirectoryFiles', '暂存目录 {path} 中的所有文件', 'Stage all files in directory {path}'],
    ['unstageDirectoryFiles', '取消暂存目录 {path} 中的所有文件', 'Unstage all files in directory {path}'],
    ['addDirectoryToVcs', '将目录 {path} 中的所有文件添加到 VCS', 'Add all files in directory {path} to VCS'],
  ]) {
    assert.equal(locales.split(`${key}: '${zh}'`).length - 1, 1, `${key} zh`);
    assert.equal(locales.split(`${key}: '${en}'`).length - 1, 1, `${key} en`);
  }
});
