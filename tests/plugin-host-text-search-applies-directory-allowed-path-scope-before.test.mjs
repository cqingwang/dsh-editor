import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { workspaceFileOperations } from '../lib/index.js';

const source = [
  await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8'),
  await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'),
].join('\n');

test('Host text search applies directory and allowed-path scope before the match cap', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round643-'));
  try {
    await mkdir(join(root, 'scoped'), { recursive: true });
    await writeFile(join(root, 'a-outside.txt'), `${'needle\n'.repeat(40)}`, 'utf8');
    await writeFile(join(root, 'scoped', 'inside.txt'), 'scoped needle\n', 'utf8');

    const project = await workspaceFileOperations.searchText(root, 'needle', { maxMatches: 5 });
    assert.deepEqual([...new Set(project.matches.map((match) => match.path))], ['a-outside.txt']);

    const directory = await workspaceFileOperations.searchText(root, 'needle', {
      maxMatches: 5,
      directory: 'scoped',
    });
    assert.deepEqual(directory.matches.map((match) => match.path), ['scoped/inside.txt']);

    const allowed = await workspaceFileOperations.searchText(root, 'needle', {
      maxMatches: 5,
      allowedPaths: ['scoped/inside.txt'],
    });
    assert.deepEqual(allowed.matches.map((match) => match.path), ['scoped/inside.txt']);

    const escaped = await workspaceFileOperations.searchText(root, 'needle', {
      maxMatches: 5,
      directory: '..',
    });
    assert.deepEqual(escaped.matches, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Persistent Find forwards its live scope to the host search request', () => {
  assert.match(source, /const savedScope = readFindScope\(rootRef\.current\)/);
  assert.match(source, /searchScopeMode: savedScope\.mode/);
  assert.match(source, /searchScopePreset: savedScope\.preset/);
  assert.match(source, /searchScopeDirectory: savedScope\.directory/);
  assert.match(source, /const changeFindToolScope = React\.useCallback/);
  assert.match(source, /directory: findTool\?\.searchScopeMode === 'directory'/);
  assert.match(source, /findTool\?\.searchScopeMode === 'scope'/);
  assert.match(source, /onScopeChange=\{changeFindToolScope\}/);
});

test('Changing Find scope invalidates the prior scoped result generation', () => {
  assert.match(source, /const selectFindScopeMode = \(mode\) =>/);
  assert.match(source, /const selectFindScopePreset = \(preset\) =>/);
  assert.match(source, /onScopeChange\(\{[\s\S]*?mode:[\s\S]*?preset:[\s\S]*?directory:/);
  assert.match(source, /searchGeneration: \(current\.searchGeneration \?\? 0\) \+ 1/);
  assert.match(source, /loadedGeneration: -1/);
});

test('Shift+Replace in Files preserves scope while using the live selection or clearing the query', () => {
  assert.match(source, /const openBlankReplaceInFilesFromEditor = React\.useCallback/);
  const blankReplace = source.slice(
    source.indexOf('const openBlankReplaceInFilesFromEditor = React.useCallback'),
    source.indexOf('/** Single shortcut body shared by double Shift'),
  );
  assert.match(blankReplace, /\.\.\.current/);
  assert.match(blankReplace, /const selectedQuery = selectedEditorFindQuery\(currentCodeEditor\(\)\)/);
  assert.match(blankReplace, /query: selectedQuery/);
  assert.match(blankReplace, /mode: 'replace'/);
  assert.doesNotMatch(blankReplace, /searchScopeMode:/);
  assert.match(source, /openBlankReplaceInFilesFromEditor\(\)/);
});
