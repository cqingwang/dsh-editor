import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const diffSource = readFileSync(join(root, 'src/client/diff.ts'), 'utf8');
const menuSource = readFileSync(join(root, 'src/client/components/commit/commit-options-menu.ts'), 'utf8');
const source = [
  readFileSync(join(root, 'src/client/components/commit/CommitPanel.tsx'), 'utf8'),
  readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8'),
  readFileSync(join(root, 'src/client/components/commit/CommitLog.tsx'), 'utf8'),
  diffSource,
  menuSource,
  readFileSync(join(root, 'src/client/locales.ts'), 'utf8'),
].join('\n');

function extractFunction(name) {
  return transpileTypeScriptFunction(diffSource, name);
}

test('Stage All targets every working-side change and can exclude untracked files', () => {
  const stageAllTargets = new Function(
    `'use strict';\n${extractFunction('splitChanges')}\n${extractFunction('stageAllTargets')}\nreturn stageAllTargets;`,
  )();
  const changes = [
    { path: 'staged-only.txt', status: 'M ' },
    { path: 'working.txt', status: ' M' },
    { path: 'both.txt', status: 'MM' },
    { path: 'new.txt', status: '??' },
  ];
  assert.deepEqual(stageAllTargets(changes, false), ['working.txt', 'both.txt', 'new.txt']);
  assert.deepEqual(stageAllTargets(changes, true), ['working.txt', 'both.txt']);
});

test('IDEA Stage All Tracked is a direct Changes toolbar action', () => {
  const panel = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function CommitLogView('));
  assert.ok(panel.indexOf("id: 'refresh'") < panel.indexOf("id: 'stageAllTracked'"));
  assert.match(panel, /id: 'stageAllTracked'[\s\S]*?label: t\('editor\.stageAllTracked'\)/);
  assert.match(panel, /disabled: busy \|\| stageAllTrackedPaths\.length === 0/);
  assert.match(panel, /onClick: \(\) => onStageAllTracked\?\.\(\)/);
});

test('Stage All is available behind Commit Options and reuses restage', () => {
  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  assert.match(workspace, /const stageEveryChange = React\.useCallback\(\s*async \(trackedOnly = false\) => \{/);
  assert.match(workspace, /const paths = stageAllTargets\(git\?\.changes \?\? \[\], trackedOnly === true\)/);
  assert.match(workspace, /const staged = await restage\(paths, false\)/);
  assert.match(workspace, /setCommitSelection\(\(current\) => new Set\(\[\.\.\.current, \.\.\.paths\]\)\)/);

  const menu = menuSource.slice(
    menuSource.indexOf('export function commitOptionsMenu('),
    menuSource.indexOf('export function stashMenu('),
  );
  assert.match(menu, /id: 'stageAll'/);
  assert.match(menu, /label: t\('editor\.stageAll'\)/);
  assert.match(menu, /run: onStageAll,/);
  assert.match(workspace, /onStageAll: \(\) => void stageEveryChange\(false\)/);
});

test('both dictionaries define Stage All wording', () => {
  for (const key of ['stageAll', 'stageAllTracked']) {
    assert.ok(source.split(`${key}:`).length - 1 >= 2, `${key} must exist in both dictionaries`);
  }
});
