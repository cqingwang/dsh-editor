import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../src/client/components/commit/CommitPanel.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/project/FileTreeView.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const commit = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function groupActionMenuItems('));

test('Project tree items expose their real depth as aria-level', () => {
  assert.match(
    source,
    /role: 'treeitem',\s+'aria-level': position\.level,\s+'aria-posinset': position\.posinset,\s+'aria-setsize': position\.setsize/,
  );
});

test('Changes groups and entries expose stable tree levels', () => {
  assert.match(
    commit,
    /role: 'treeitem',\s+tabIndex: selectedGroup === group\.id \? 0 : -1,\s+'aria-selected': selectedGroup === group\.id,\s+'aria-expanded': groupOpen,\s+'aria-level': 1,/,
  );
  assert.match(commit, /'data-dsh-change-directory': row\.path,\s+'aria-level': row\.depth \+ 2,/);
  assert.match(
    commit,
    /role: 'treeitem',\s+'aria-level': row\.depth \+ 2,\s+'aria-posinset': rowIndex \+ 1,\s+'aria-setsize': rows\.length,\s+'aria-selected': selectedForChange/,
  );
});
