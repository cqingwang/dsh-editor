import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');

test('Find responses are current only when request id and workspace both match', () => {
  const helper = new Function(
    `${transpileTypeScriptFunction(commitSource, 'findToolRequestIsCurrent')}; return findToolRequestIsCurrent;`,
  )();
  assert.equal(helper(4, '/workspace/a', 4, '/workspace/a'), true);
  assert.equal(helper(4, '/workspace/a', 5, '/workspace/a'), false);
  assert.equal(helper(4, '/workspace/a', 4, '/workspace/b'), false);
});

test('Find search responses capture and revalidate their workspace root', () => {
  const effect = source.slice(
    source.indexOf('if (!findToolOpen || findTool.loadedGeneration === findTool.searchGeneration)'),
    source.indexOf("/* IDEA's Find Action chord opens Search Everywhere"),
  );
  assert.match(effect, /const requestRoot = rootRef\.current/);
  assert.match(
    effect,
    /findToolRequestIsCurrent\(\s*requestId,\s*requestRoot,\s*findToolRequestRef\.current,\s*rootRef\.current\s*\)/,
  );
  assert.ok((effect.match(/findToolRequestIsCurrent\(/g) ?? []).length >= 2);
});

test('Workspace changes invalidate an in-flight Find request before closing it', () => {
  const cancelStart = source.indexOf('const cancelWorkspaceSearchRequests = React.useCallback');
  const cancelEnd = source.indexOf('const previousWorkspaceSearchRootRef', cancelStart);
  assert.ok(cancelStart >= 0 && cancelEnd > cancelStart, 'workspace cancellation block is missing');
  const cancelBlock = source.slice(cancelStart, cancelEnd);

  const effect = source.slice(
    source.indexOf('if (workspaceSearchSurfacesShouldReset(previousWorkspaceRoot, root))'),
    source.indexOf("setRecentReplacements(root === '' ? [] : readReplaceHistory(root));")
      + "setRecentReplacements(root === '' ? [] : readReplaceHistory(root));".length,
  );
  assert.match(effect, /cancelWorkspaceSearchRequests\(\);/u);
  assert.match(
    cancelBlock,
    /findToolRequestRef\.current \+= 1;/u,
  );
  assert.ok(effect.indexOf('cancelWorkspaceSearchRequests()') < effect.indexOf('setFindTool(null)'));
});
