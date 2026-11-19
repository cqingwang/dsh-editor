import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const foundation = await readFile(new URL('../src/client/foundation.ts', import.meta.url), 'utf8');
const workspace = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

test('workspace search surfaces reset only for a real workspace change', () => {
  const shouldReset = new Function(
    `${transpileTypeScriptFunction(foundation, 'workspaceSearchSurfacesShouldReset')};
     return workspaceSearchSurfacesShouldReset;`,
  )();
  assert.equal(shouldReset('', '/workspace/a'), false);
  assert.equal(shouldReset('/workspace/a', '/workspace/a'), false);
  assert.equal(shouldReset('/workspace/a', '/workspace/b'), true);
  assert.equal(shouldReset('/workspace/a', ''), true);
});

test('initial root acquisition cannot erase an already-open Find popup', () => {
  assert.match(workspace, /const previousWorkspaceSearchRootRef = React\.useRef\(root\);/u);
  const resetEffect = workspace.slice(
    workspace.indexOf('const previousWorkspaceSearchRootRef = React.useRef(root);'),
    workspace.indexOf(
      "setRecentReplacements(root === '' ? [] : readReplaceHistory(root));",
      workspace.indexOf('const previousWorkspaceSearchRootRef = React.useRef(root);'),
    ),
  );
  assert.match(resetEffect, /const previousWorkspaceRoot = previousWorkspaceSearchRootRef\.current;/u);
  assert.match(resetEffect, /previousWorkspaceSearchRootRef\.current = root;/u);
  assert.match(
    resetEffect,
    /if \(workspaceSearchSurfacesShouldReset\(previousWorkspaceRoot, root\)\) \{[\s\S]*?cancelWorkspaceSearchRequests\(\)[\s\S]*?setSearchEverywhere\(null\)[\s\S]*?setShowUsages\(null\)[\s\S]*?setFindTool\(null\)/u,
  );
  assert.match(
    workspace,
    /React\.useEffect\(\(\) => \{\s+return \(\) => cancelWorkspaceSearchRequests\(\);\s+\}, \[cancelWorkspaceSearchRequests\]\);/u,
  );
});
