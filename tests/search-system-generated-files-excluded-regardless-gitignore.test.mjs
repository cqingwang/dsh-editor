import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const host = await import('../lib/index.js');

async function createFixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-system-generated-search-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await execFileAsync('git', ['init', '-q', root]);
  await writeFile(join(root, '.gitignore'), 'ignored-only/\n', 'utf8');
  await writeFile(join(root, 'visible.txt'), 'SYSTEM_CACHE_NEEDLE visible\n', 'utf8');
  await writeFile(join(root, '.DS_Store'), 'SYSTEM_CACHE_NEEDLE macOS root\n', 'utf8');
  await writeFile(join(root, 'Thumbs.db'), 'SYSTEM_CACHE_NEEDLE Windows root\n', 'utf8');
  await mkdir(join(root, 'nested'), { recursive: true });
  await writeFile(join(root, 'nested', '.ds_store'), 'SYSTEM_CACHE_NEEDLE macOS nested\n', 'utf8');
  await writeFile(join(root, 'nested', 'ehthumbs.db'), 'SYSTEM_CACHE_NEEDLE Windows nested\n', 'utf8');
  await writeFile(join(root, 'nested', 'ehthumbs_vista.db'), 'SYSTEM_CACHE_NEEDLE Windows Vista\n', 'utf8');
  await writeFile(join(root, 'nested', 'desktop.ini'), 'SYSTEM_CACHE_NEEDLE Windows metadata\n', 'utf8');
  await mkdir(join(root, 'nested', 'build'), { recursive: true });
  await writeFile(join(root, 'nested', 'build', 'main.o'), 'SYSTEM_CACHE_NEEDLE object file\n', 'utf8');
  await writeFile(join(root, 'nested', 'module.class'), 'SYSTEM_CACHE_NEEDLE class file\n', 'utf8');
  await writeFile(join(root, 'nested', 'object.obj'), 'SYSTEM_CACHE_NEEDLE obj file\n', 'utf8');
  await execFileAsync('git', ['-C', root, 'add', 'visible.txt']);
  await execFileAsync('git', [
    '-C',
    root,
    'add',
    '-f',
    '.DS_Store',
    'Thumbs.db',
    'nested/.ds_store',
    'nested/ehthumbs.db',
    'nested/ehthumbs_vista.db',
    'nested/desktop.ini',
    'nested/build/main.o',
    'nested/module.class',
    'nested/object.obj',
  ]);
  return root;
}

test('system-generated files stay out of file lists and unbounded text searches', async (t) => {
  const root = await createFixture(t);
  const files = await host.workspaceFileOperations.files(root, 100, {
    includeExcluded: true,
    respectGitIgnore: true,
  });
  assert.ok(files.files.includes('visible.txt'));
  assert.ok(!files.files.some((path) => /(?:^|\/)\.ds_store$/iu.test(path)));
  assert.ok(!files.files.some((path) => /(?:^|\/)(?:e?h?thumbs(?:_vista)?|desktop)\.(?:db|ini)$/iu.test(path)));
  assert.ok(!files.files.some((path) => /\.(?:o|obj|class)$/iu.test(path)));

  const text = await host.searchWorkspaceText(root, 'SYSTEM_CACHE_NEEDLE', {
    includeExcluded: true,
    maxMatches: 20,
  });
  assert.deepEqual(text.matches.map((match) => match.path), ['visible.txt']);

  const namedThumbs = await host.workspaceFileOperations.search(root, 'thumbs', {
    showHidden: true,
    showExcluded: true,
  });
  assert.deepEqual(namedThumbs.entries, []);

  const tracked = await host.searchWorkspaceText(root, 'SYSTEM_CACHE_NEEDLE', {
    gitScope: 'tracked',
    maxMatches: 20,
  });
  assert.deepEqual(tracked.matches.map((match) => match.path), ['visible.txt']);
});

test('system-generated files stay out of explicit search scopes and replacement targets', async (t) => {
  const root = await createFixture(t);
  const scoped = await host.searchWorkspaceText(root, 'SYSTEM_CACHE_NEEDLE', {
    includeExcluded: true,
    maxMatches: 20,
    allowedPaths: [
      'visible.txt',
      '.DS_Store',
      'Thumbs.db',
      'nested/ehthumbs.db',
      'nested/desktop.ini',
      'nested/build/main.o',
      'nested/module.class',
      'nested/object.obj',
    ],
  });
  assert.deepEqual(scoped.matches.map((match) => match.path), ['visible.txt']);

  for (const path of [
    '.DS_Store',
    'Thumbs.db',
    'nested/.ds_store',
    'nested/ehthumbs.db',
    'nested/desktop.ini',
    'nested/build/main.o',
    'nested/module.class',
    'nested/object.obj',
  ]) {
    await assert.rejects(
      host.replaceWorkspaceText(root, 'SYSTEM_CACHE_NEEDLE', 'changed', [{ path, mtime: 0 }], {
        includeExcluded: true,
      }),
      /target is outside search scope/u,
    );
  }
});

test('system-generated files do not consume file or text-search budgets', async (t) => {
  const root = await createFixture(t);
  const systemFiles = [];
  for (let index = 0; index < 80; index += 1) {
    const directory = `cache-${String(index).padStart(3, '0')}`;
    await mkdir(join(root, directory));
    for (const name of ['.DS_Store', 'Thumbs.db']) {
      await writeFile(join(root, directory, name), 'SYSTEM_CACHE_NEEDLE cache\n', 'utf8');
      systemFiles.push(`${directory}/${name}`);
    }
  }
  await execFileAsync('git', ['-C', root, 'add', '-f', ...systemFiles]);

  const files = await host.workspaceFileOperations.files(root, 2, {
    includeExcluded: true,
    respectGitIgnore: true,
  });
  assert.deepEqual(files.files, ['visible.txt']);
  assert.equal(files.truncated, false);

  const text = await host.searchWorkspaceText(root, 'SYSTEM_CACHE_NEEDLE', {
    includeExcluded: true,
    maxMatches: 2,
  });
  assert.deepEqual(text.matches.map((match) => match.path), ['visible.txt']);
  assert.equal(text.truncated, false);

  const tracked = await host.searchWorkspaceText(root, 'SYSTEM_CACHE_NEEDLE', {
    gitScope: 'tracked',
    maxMatches: 2,
  });
  assert.deepEqual(tracked.matches.map((match) => match.path), ['visible.txt']);
  assert.equal(tracked.truncated, false);
});
