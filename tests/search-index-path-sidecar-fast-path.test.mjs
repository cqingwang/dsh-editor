import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { gunzip } from 'node:zlib';
import { promisify } from 'node:util';

const gunzipAsync = promisify(gunzip);

test('path queries use a persisted path-only sidecar after the content cache is unavailable', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-path-sidecar-root-'));
  const dshHome = await mkdtemp(join(tmpdir(), 'dsh-editor-path-sidecar-home-'));
  const previousDshHome = process.env.DSH_HOME;
  process.env.DSH_HOME = dshHome;
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(dshHome, { recursive: true, force: true }));
  t.after(() => {
    if (previousDshHome === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previousDshHome;
  });

  await mkdir(join(root, 'src'));
  await writeFile(join(root, 'src', 'application.ts'), 'export const application = true;\n', 'utf8');

  const buildHost = await import(
    new URL(`../lib/index.js?path-sidecar-build=${Date.now()}`, import.meta.url)
  );
  await buildHost.rebuildWorkspaceSearchIndex(root, { maxContentBytes: 1024 * 1024 });

  const identity = buildHost.searchIndexIdentity(root);
  const pathFile = `${identity.file.slice(0, -'.json.gz'.length)}.paths.json.gz`;
  const pathPayload = await readFile(pathFile).catch(() => null);
  assert.notEqual(pathPayload, null, 'the rebuild must persist a path-only sidecar');
  const pathText = (await gunzipAsync(pathPayload)).toString('utf8');
  assert.doesNotMatch(pathText, /"content":/u, 'the path sidecar must not store file contents');

  // Leave the path projection intact but make the content cache unusable. Path
  // search must remain available without decoding the 100+ MiB body snapshot.
  await writeFile(identity.file, 'not-a-gzip-index', 'utf8');

  const freshHost = await import(
    new URL(`../lib/index.js?path-sidecar-fast=${Date.now()}`, import.meta.url)
  );
  const watcher = new freshHost.WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  watcher.start();

  const result = await freshHost.workspaceFileOperations.search(root, 'application', {
    respectGitIgnore: true,
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
    searchIndex: true,
    filesOnly: true,
  });
  assert.equal(result.indexFastPath, true);
  assert.deepEqual(
    result.entries.map(({ path, name, kind }) => ({ path, name, kind })),
    [
      {
        path: 'src/application.ts',
        name: 'application.ts',
        kind: 'file',
      },
    ],
  );
});
