import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`    function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unbalanced ${name}`);
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
  const panel = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function CommitLog('));
  const start = panel.indexOf('actions: [', panel.indexOf('CompactActionBar'));
  const toolbar = panel.slice(start, panel.indexOf('],\n            }),', start));
  assert.match(toolbar, /id: 'refresh'/);
  assert.match(toolbar, /id: 'stageAllTracked'/);
  assert.match(toolbar, /label: t\('editor\.stageAllTracked'\)/);
  assert.match(toolbar, /disabled: busy \|\| stageAllTrackedPaths\.length === 0/);
  assert.match(toolbar, /onClick: \(\) => onStageAllTracked\?\.\(\)/);
});

test('Stage All is available behind Commit Options and reuses restage', () => {
  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  assert.match(workspace, /const stageEveryChange = React\.useCallback\(async \(trackedOnly = false\) => \{/);
  assert.match(workspace, /const paths = stageAllTargets\(git\?\.changes \?\? \[\], trackedOnly === true\)/);
  assert.match(workspace, /const staged = await restage\(paths, false\)/);
  assert.match(workspace, /setCommitSelection\(\(current\) => new Set\(\[\.\.\.current, \.\.\.paths\]\)\)/);

  const menu = source.slice(
    source.indexOf('const openCommitOptionsMenu = React.useCallback('),
    source.indexOf('const commit = React.useCallback(', source.indexOf('const openCommitOptionsMenu = React.useCallback(')),
  );
  assert.match(menu, /id: 'stageAll'/);
  assert.match(menu, /label: t\('editor\.stageAll'\)/);
  assert.match(menu, /run: \(\) => void stageEveryChange\(false\)/);
});

test('both dictionaries define Stage All wording', () => {
  for (const key of ['stageAll', 'stageAllTracked']) {
    assert.ok(source.split(`${key}:`).length - 1 >= 2, `${key} must exist in both dictionaries`);
  }
});
