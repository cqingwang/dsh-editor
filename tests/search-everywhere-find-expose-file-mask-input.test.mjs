import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile as readSource } from 'node:fs/promises';
import test from 'node:test';

const host = await import('../lib/index.js');
const source = (await readSource(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + await readSource(new URL('../lib/client.js', import.meta.url), 'utf8') + '\n' + await readSource(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));

test('Search Everywhere and Find expose a File Mask input', () => {
  const searchEverywhere = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function FindToolWindowView('),
  );
  const findToolWindow = source.slice(
    source.indexOf('function FindToolWindowView('),
    source.indexOf('const FindToolWindow = FindToolWindowView;'),
  );
  assert.match(searchEverywhere, /t\('editor\.searchFileMask'\)/);
  assert.match(searchEverywhere, /onFileMaskChange/);
  assert.match(findToolWindow, /t\('editor\.searchFileMask'\)/);
  assert.match(findToolWindow, /onFileMaskChange/);
  assert.match(source, /fileMask: normalizeFileExtensionFilter\(searchEverywhere\?\.fileMask\)/);
  assert.match(source, /fileMask: normalizeFileExtensionFilter\(findTool\?\.fileMask\)/);
});

test('File Mask survives handoff and all search/replace requests forward it', () => {
  const searchEverywhere = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function FindToolWindowView('),
  );
  const openFind = source.slice(
    source.indexOf('const openFindTool = React.useCallback'),
    source.indexOf('const findToolOpen ='),
  );
  assert.match(searchEverywhere, /fileMask: state\.fileMask/);
  assert.match(openFind, /normalizeSearchOptions\(initial === null \? readSearchOptions\(\) : initial\)/);
  assert.match(openFind, /\.\.\.savedOptions/);
  assert.match(source, /fileMask: normalizeFileExtensionFilter\(searchEverywhere\.fileMask\)/);
  assert.match(source, /fileMask: normalizeFileExtensionFilter\(findTool\.fileMask\)/);
});

test('workspace text search filters basename, path and exclusion masks', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round483-search-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'src/nested'), { recursive: true });
  await mkdir(join(root, 'docs'), { recursive: true });
  await writeFile(join(root, 'src/a.ts'), 'needle\n', 'utf8');
  await writeFile(join(root, 'src/b.js'), 'needle\n', 'utf8');
  await writeFile(join(root, 'src/nested/d.ts'), 'needle\n', 'utf8');
  await writeFile(join(root, 'docs/c.md'), 'needle\n', 'utf8');

  const typescript = await host.searchWorkspaceText(root, 'needle', {
    maxMatches: 20,
    fileMask: '*.ts',
  });
  assert.deepEqual(typescript.matches.map((match) => match.path).sort(), [
    'src/a.ts',
    'src/nested/d.ts',
  ]);

  const underSource = await host.searchWorkspaceText(root, 'needle', {
    maxMatches: 20,
    fileMask: 'src/**',
  });
  assert.deepEqual(underSource.matches.map((match) => match.path).sort(), [
    'src/a.ts',
    'src/b.js',
    'src/nested/d.ts',
  ]);

  const excluded = await host.searchWorkspaceText(root, 'needle', {
    maxMatches: 20,
    fileMask: '*.ts,!src/nested/**',
  });
  assert.deepEqual(excluded.matches.map((match) => match.path), ['src/a.ts']);

  await assert.rejects(
    () => host.searchWorkspaceText(root, 'needle', { fileMask: '[*' }),
    /unsupported file mask syntax/u,
  );
});

test('replace operations reject targets outside the active mask', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round483-replace-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'src'), { recursive: true });
  const tsPath = join(root, 'src/a.ts');
  const jsPath = join(root, 'src/b.js');
  await writeFile(tsPath, 'needle\n', 'utf8');
  await writeFile(jsPath, 'needle\n', 'utf8');
  const tsInfo = await stat(tsPath);
  const jsInfo = await stat(jsPath);

  const masked = await host.replaceWorkspaceText(
    root,
    'needle',
    'value',
    [{ path: 'src/a.ts', mtime: tsInfo.mtimeMs }],
    { fileMask: '*.ts' },
  );
  assert.equal(masked.replacements, 1);
  assert.equal(await readFile(tsPath, 'utf8'), 'value\n');
  assert.equal(await readFile(jsPath, 'utf8'), 'needle\n');

  await assert.rejects(
    () => host.replaceWorkspaceText(
      root,
      'needle',
      'other',
      [{ path: 'src/b.js', mtime: jsInfo.mtimeMs }],
      { fileMask: '*.ts' },
    ),
    /target does not match file mask/u,
  );
  assert.equal(await readFile(jsPath, 'utf8'), 'needle\n');
});
