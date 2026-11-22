import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const candidates = await readFile(
  new URL('../src/client/components/search/use-search-everywhere-file-candidates.ts', import.meta.url),
  'utf8',
);
const host = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8');

test('Search Everywhere requests the persisted file-list fast path', () => {
  assert.match(candidates, /op: 'files',[\s\S]*?searchIndex: true,[\s\S]*?signal: searchAbort\.signal/u);
  assert.match(host, /case 'files':[\s\S]*?searchIndex: body\?\.searchIndex === true/u);
});

test('a complete fresh index supplies the bounded initial file list without a live walk', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-indexed-files-root-'));
  const dshHome = await mkdtemp(join(tmpdir(), 'dsh-editor-indexed-files-home-'));
  const previousDshHome = process.env.DSH_HOME;
  process.env.DSH_HOME = dshHome;
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(dshHome, { recursive: true, force: true }));
  t.after(() => {
    if (previousDshHome === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previousDshHome;
  });
  await mkdir(join(root, 'src'));
  await mkdir(join(root, 'docs'));
  await writeFile(join(root, 'src', 'a.ts'), 'export {};\n', 'utf8');
  await writeFile(join(root, 'src', 'b.ts'), 'export {};\n', 'utf8');
  await writeFile(join(root, 'src', 'noise.md'), '# noise\n', 'utf8');
  await writeFile(join(root, 'docs', 'ignored.ts'), 'export {};\n', 'utf8');
  const searchDirectoryRules = {
    excludedDirectories: ['docs'],
    includedDirectories: [],
  };

  const buildHost = await import(
    new URL(`../lib/index.js?indexed-files-build=${Date.now()}`, import.meta.url)
  );
  await buildHost.rebuildWorkspaceSearchIndex(root, { searchDirectoryRules });
  const freshHost = await import(
    new URL(`../lib/index.js?indexed-files-fast-path=${Date.now()}`, import.meta.url)
  );
  const watcher = new freshHost.WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  watcher.start();

  const cached = await freshHost.workspaceFileOperations.files(root, 1, {
    respectGitIgnore: true,
    searchDirectoryRules,
    fileMask: '*.ts',
    searchIndex: true,
  });
  assert.equal(cached.indexFastPath, true);
  assert.equal(cached.files.length, 1);
  assert.equal(cached.files.every((path) => path.startsWith('src/') && path.endsWith('.ts')), true);
  assert.equal(cached.truncated, true);
  assert.equal(cached.scopeComplete, true);
});

test('without a live watcher the file list falls back to a fresh walk', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-indexed-files-fallback-root-'));
  const dshHome = await mkdtemp(join(tmpdir(), 'dsh-editor-indexed-files-fallback-home-'));
  const previousDshHome = process.env.DSH_HOME;
  process.env.DSH_HOME = dshHome;
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(dshHome, { recursive: true, force: true }));
  t.after(() => {
    if (previousDshHome === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previousDshHome;
  });
  await writeFile(join(root, 'a.ts'), 'export {};\n', 'utf8');

  const buildHost = await import(
    new URL(`../lib/index.js?indexed-files-fallback-build=${Date.now()}`, import.meta.url)
  );
  await buildHost.rebuildWorkspaceSearchIndex(root);
  const freshHost = await import(
    new URL(`../lib/index.js?indexed-files-fallback=${Date.now()}`, import.meta.url)
  );
  const live = await freshHost.workspaceFileOperations.files(root, 2000, {
    respectGitIgnore: true,
    searchIndex: true,
  });
  assert.equal(live.indexFastPath, undefined);
  assert.deepEqual(live.files, ['a.ts']);
});
