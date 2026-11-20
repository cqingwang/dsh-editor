import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');
const gitChangeModelSource = readFileSync(join(root, 'src/client/components/ui/git-change-model.ts'), 'utf8');

test('Compare with HEAD is offered only when HEAD can contain the path', () => {
  const canCompareWithHead = loadTypeScriptFunction(gitChangeModelSource, 'canCompareWithHead');
  for (const status of [' M', 'MM', 'D ', ' D']) {
    assert.equal(canCompareWithHead({ status }), true, `${status} should be comparable`);
  }
  for (const status of ['??', 'A ', 'AM', 'R ', 'C ']) {
    assert.equal(canCompareWithHead({ status }), false, `${status} has no HEAD path`);
  }
  assert.equal(canCompareWithHead(null), false);
});

test('Compare with HEAD reuses the single read-only revision diff target', () => {
  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  assert.match(workspace, /const compareWithHead = React\.useCallback\(\(path\) => \{/);
  assert.match(workspace, /setDiffTarget\(\{ path, revision: 'HEAD', staged: false \}\)/);
  assert.match(workspace, /id: 'compareHead'/);
  assert.match(workspace, /label: t\('editor\.compareWithHead'\)/);
  assert.match(workspace, /disabled: paths\.length > 1 \|\| !changeModel\.canCompareWithHead\(pick\(change\.path\)\)/);
  assert.match(workspace, /run: \(\) => compareWithHead\(change\.path\)/);
});

test('both dictionaries define Compare with HEAD wording', () => {
  assert.ok(source.split('compareWithHead:').length - 1 >= 2, 'compareWithHead must exist in both dictionaries');
});
