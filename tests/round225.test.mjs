import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function menuSource() {
  const start = source.indexOf('const buildChangeMenu = React.useCallback(');
  assert.notEqual(start, -1);
  const end = source.indexOf('const buildChangeDirMenu = React.useCallback(', start);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('Commit file rows offer IDEA compare-with-revision and compare-with-clipboard', () => {
  const menu = menuSource();
  const revision = menu.indexOf("id: 'compareRevision'");
  const head = menu.indexOf("id: 'compareHead'");
  const clipboard = menu.indexOf("id: 'compareClipboard'");
  const stage = menu.indexOf("id: removalOnly ? 'removeDeleted' : 'stage'");
  assert.ok(revision >= 0 && head > revision && clipboard > head);
  assert.ok(stage >= 0 && revision > stage, 'IDEA VersionControls actions stay below the local-change groups');
  assert.match(menu, /label: t\('editor\.compareWithRevision'\),[\s\S]*?compareWithRevision\(change\.path\)/);
  assert.match(menu, /label: t\('editor\.compareWithClipboard'\),[\s\S]*?compareWithClipboard\(change\.path\)/);
});

test('compare actions are single-file only and wired into the menu dependencies', () => {
  const menu = menuSource();
  assert.match(menu, /id: 'compareRevision',[\s\S]*?disabled: paths\.length > 1/);
  assert.match(menu, /id: 'compareClipboard',[\s\S]*?disabled: paths\.length > 1/);
  assert.match(menu, /\[compareWithClipboard, compareWithHead, compareWithRevision, copySelectedPatch, createSelectedPatch, currentCodeEditor, currentCodePath, openFile, openInTerminal, addToGitignore,/);
});
