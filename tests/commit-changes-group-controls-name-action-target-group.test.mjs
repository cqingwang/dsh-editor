import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/commit/CommitPanel.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const locales = await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8');
const commit = source.slice(source.indexOf('function CommitPanel('), source.indexOf('export { CommitPanel };'));

test('Changes group controls name the action and the target group', () => {
  assert.match(
    commit,
    /groupOpen\s+\? t\('editor\.collapseGroupNamed', \{\s+group: group\.label,\s+\}\)\s+: t\('editor\.expandGroupNamed', \{\s+group: group\.label,\s+\}\)/u,
  );
  assert.match(commit, /aria-label=\{t\('editor\.selectGroupFiles', \{\s+group: group\.label,\s+\}\)\}/u);
  assert.match(commit, /label=\{t\('editor\.moreActionsFor', \{\s+group: group\.label,\s+\}\)\}/u);
});

test('the three group-control names exist in both dictionaries', () => {
  for (const [key, zh, en] of [
    ['expandGroupNamed', '展开 {group}', 'Expand {group}'],
    ['collapseGroupNamed', '收起 {group}', 'Collapse {group}'],
    ['selectGroupFiles', '选择 {group} 中的所有文件', 'Select all files in {group}'],
    ['moreActionsFor', '{group}的更多操作', 'More actions for {group}'],
  ]) {
    assert.equal(locales.split(`${key}: '${zh}'`).length - 1, 1, `${key} zh`);
    assert.equal(locales.split(`${key}: '${en}'`).length - 1, 1, `${key} en`);
  }
});
