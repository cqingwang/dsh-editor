import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/commit/CommitPanel.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

function commitPanel() {
  return source.slice(source.indexOf('function CommitPanel('), source.indexOf('function NamePrompt('));
}

function changeMenu() {
  const start = source.indexOf('const buildChangeMenu = React.useCallback(');
  const end = source.indexOf('const buildChangeDirMenu = React.useCallback(', start);
  return source.slice(start, end);
}

test('unversioned group action uses IDEA Add to VCS wording', () => {
  const panel = commitPanel();
  assert.match(panel, /label: removalOnlyInGroup[\s\S]*?group\.id === 'unversioned'[\s\S]*?t\('editor\.addToVcs'\)/);
  assert.match(panel, /if \(removalOnlyInGroup\) onStage\(removableInGroup\);/);
  assert.match(panel, /else if \(group\.id === 'staged'\) onUnstage\(selectedInGroup\);\s*else onStage\(selectedInGroup\);/);
  assert.ok(source.includes("addToVcs: '添加到 VCS'"));
  assert.ok(source.includes("addToVcs: 'Add to VCS'"));
});

test('untracked file row menu offers Add to VCS instead of generic stage wording', () => {
  const menu = changeMenu();
  assert.match(menu, /allUnversioned\s*\?\s*batchLabel\('editor\.addToVcs', 'editor\.addToVcsCount'\)/);
  assert.match(menu, /run: \(\) => void restage\(removalOnly \? removablePaths : paths, allStaged\)/);
  assert.ok(source.includes("addToVcsCount: '添加 {count} 个文件到 VCS'"));
  assert.ok(source.includes("addToVcsCount: 'Add {count} Files to VCS'"));
});
