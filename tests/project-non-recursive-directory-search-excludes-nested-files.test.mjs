import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { loadTypeScriptCallback } from './ts-source.mjs';

const host = await import('../lib/index.js');
const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const source =
  workspaceSource +
  '\n' +
  (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8'));
const hostSource = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8');

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round713-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'scope', 'nested'), { recursive: true });
  await writeFile(join(root, 'scope', 'top.txt'), 'R713_DIRECT_TOKEN top\n', 'utf8');
  await writeFile(join(root, 'scope', 'nested', 'deep.txt'), 'R713_DIRECT_TOKEN deep\n', 'utf8');
  return root;
}

test('non-recursive Directory search excludes nested files', async (t) => {
  const root = await fixture(t);
  const recursive = await host.searchWorkspaceText(root, 'R713_DIRECT_TOKEN', {
    directory: 'scope',
    recursive: true,
  });
  assert.deepEqual(
    [...new Set(recursive.matches.map((match) => match.path))].sort(),
    ['scope/nested/deep.txt', 'scope/top.txt'],
  );

  const direct = await host.searchWorkspaceText(root, 'R713_DIRECT_TOKEN', {
    directory: 'scope',
    recursive: false,
  });
  assert.deepEqual([...new Set(direct.matches.map((match) => match.path))], ['scope/top.txt']);
});

test('host pruning and path filtering honor recursive=false', () => {
  assert.match(hostSource, /const recursive = options\?\.recursive !== false/u);
  assert.match(hostSource, /if \(recursive !== false\) queue\.push\(entry\.path\);/u);
  assert.match(hostSource, /scope\.recursive === false/u);
});

test('Find UI persists recursive state and invalidates requests when toggled', () => {
  assert.match(source, /function readFindDirectoryRecursive\(root(?::\s*[^)]+)?\)(?::\s*[^{]+)?/u);
  assert.match(
    source,
    /function writeFindDirectoryRecursive\(root(?::\s*[^,)]+)?,\s*recursive(?::\s*[^)]+)?\)(?::\s*[^{]+)?/u,
  );
  assert.match(source, /dsh-editor\.find\.directoryRecursive:/u);
  assert.match(
    source,
    /searchScopeRecursive: readFindDirectoryRecursive\(rootRef\.current\)/u,
  );
  let state = {
    query: 'needle',
    replace: '',
    searchScopeMode: 'directory',
    searchScopeRecursive: true,
    searchGeneration: 3,
  };
  const changeFindDirectoryRecursive = loadTypeScriptCallback(workspaceSource, 'changeFindDirectoryRecursive', {
    rootRef: { current: '/repo' },
    writeFindDirectoryRecursive: (_root, recursive) => recursive,
    hasFindToolContentQuery: () => true,
    setFindTool: (updater) => {
      state = updater(state);
    },
  });
  changeFindDirectoryRecursive(false);
  assert.equal(state.searchScopeRecursive, false);
  assert.equal(state.loading, true);
  assert.equal(state.searchGeneration, 4);
  assert.equal(state.loadedGeneration, -1);
});

test('Find requests, dirty merging and host route forward recursive', () => {
  assert.match(
    source,
    /recursive: findTool\?\.searchScopeMode === 'directory'\s+\? findTool\?\.searchScopeRecursive !== false\s+: true,/u,
  );
  assert.match(source, /preset: findToolSearchScopePreset,\s+recursive: findTool\?\.searchScopeRecursive !== false/u);
  assert.match(hostSource, /recursive: body\?\.recursive !== false/u);
});

test('Directory scope renders an aria-pressed recursive toggle', () => {
  const findTool = source.slice(
    source.indexOf('function FindToolWindowView('),
    source.indexOf('const FindToolWindow = FindToolWindowView;'),
  );
  assert.match(findTool, /searchScopeRecursive !== false/u);
  assert.match(findTool, /aria-pressed=\{scopeRecursive === true\}/u);
  assert.match(findTool, /t\('editor\.findScopeSearchRecursively'\)/u);
  assert.match(findTool, /onDirectoryRecursiveChange\?\.\(next\)/u);
  assert.match(source, /findScopeSearchRecursively: '在子目录中递归搜索'/u);
  assert.match(source, /findScopeSearchRecursively: 'Search recursively in subdirectories'/u);
});
