import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const commit = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function groupActionMenuItems('));

test('Changes group controls name the action and the target group', () => {
  assert.match(commit, /groupOpen\s+\? t\('editor\.collapseGroupNamed', \{ group: group\.label \}\)\s+: t\('editor\.expandGroupNamed', \{ group: group\.label \}\)/);
  assert.match(commit, /'aria-label': t\('editor\.selectGroupFiles', \{ group: group\.label \}\)/);
  assert.match(commit, /label: t\('editor\.moreActionsFor', \{ group: group\.label \}\)/);
});

test('the three group-control names exist in both dictionaries', () => {
  for (const [key, zh, en] of [
    ['expandGroupNamed', '展开 {group}', 'Expand {group}'],
    ['collapseGroupNamed', '收起 {group}', 'Collapse {group}'],
    ['selectGroupFiles', '选择 {group} 中的所有文件', 'Select all files in {group}'],
    ['moreActionsFor', '{group}的更多操作', 'More actions for {group}'],
  ]) {
    assert.equal(source.split(`${key}: '${zh}'`).length - 1, 1, `${key} zh`);
    assert.equal(source.split(`${key}: '${en}'`).length - 1, 1, `${key} en`);
  }
});
