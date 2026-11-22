import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const findTool = await read('src/client/find-tool.ts');
const commit = await read('src/client/commit.ts');
const workspace = await read('src/client/editor-workspace.tsx');
const windowSource = await read('src/client/components/search/FindToolWindow.tsx');
const locales = await read('src/client/locales.ts');

test('Find file scope filters workspace paths instead of file contents', () => {
  globalThis.basename = (path) => path.slice(path.lastIndexOf('/') + 1);
  const { findFilePathMatches } = loadTypeScriptModule(findTool, ['findFilePathMatches']);
  const files = [
    'README.md',
    'src/client/find-tool.ts',
    'src/client/components/search/FindToolWindow.tsx',
    'tests/search-find-file-scope-filters-file-paths.test.mjs',
  ];

  assert.deepEqual(findFilePathMatches(files, ''), []);
  assert.deepEqual(findFilePathMatches(files, 'FindToolWindow.tsx', { caseSensitive: true }), [
    'src/client/components/search/FindToolWindow.tsx',
  ]);
  assert.deepEqual(findFilePathMatches(files, '.ts', { fileMask: '*.ts' }), [
    'src/client/find-tool.ts',
  ]);
});

test('Find scope replaces the disabled Module mode with an actionable File mode', () => {
  const { findToolScopeModeTarget } = loadTypeScriptModule(commit, ['findToolScopeModeTarget']);

  assert.equal(findToolScopeModeTarget('project', 'ArrowRight'), 'files');
  assert.equal(findToolScopeModeTarget('files', 'ArrowRight'), 'directory');
  assert.equal(findToolScopeModeTarget('directory', 'ArrowRight'), 'scope');
  assert.equal(findToolScopeModeTarget('scope', 'ArrowRight'), 'project');
  assert.equal(findToolScopeModeTarget('project', 'End'), 'scope');
  assert.equal(findToolScopeModeTarget('files', 'Home'), 'project');

  assert.match(locales, /findScopeFile: '文件'/u);
  assert.match(locales, /findScopeFile: 'File'/u);
  const scopeModes = windowSource.slice(
    windowSource.indexOf('const scopeModeOptions = ['),
    windowSource.indexOf('const replaceMode ='),
  );
  assert.doesNotMatch(scopeModes, /id: 'module'/u);
  assert.match(scopeModes, /id: 'files'[\s\S]*?disabled: false/u);
});

test('Find file scope loads file candidates and keeps click-to-preview semantics', () => {
  assert.match(workspace, /findToolSearchScopeMode !== 'files'[\s\S]*?findToolFileCandidatesRequest\(/u);
  assert.match(
    workspace,
    /findToolFileCandidatesRequest\([\s\S]*?normalizeFileExtensionFilter\(findTool\?\.fileMask\)/u,
  );
  assert.match(workspace, /findFilePathMatches\(candidatePaths, requestQuery/u);
  assert.match(workspace, /matches: \[\][\s\S]*?loadedGeneration: generation/u);
  assert.doesNotMatch(windowSource, /onClick=\{[^}]*openFindResult/u);
  assert.match(windowSource, /onDoubleClick=\{\(\) => openFindResult\(result\)\}/u);
  assert.match(windowSource, /if \(floating\) onClose\(\);/u);
  assert.match(windowSource, /findFileFilterPlaceholder/u);
});
