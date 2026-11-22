import assert from 'node:assert/strict';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

async function waitForFile(file, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const info = await stat(file).catch(() => null);
    if (info !== null && info.isFile()) return info;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return null;
}

test('adaptive text sketches skip files that cannot contain the literal query', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-sketch-root-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-text-sketch-index-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'alpha.ts'), 'ALPHA_SKETCH_NEEDLE\n', 'utf8');
  await writeFile(join(root, 'beta.ts'), 'BETA_SKETCH_NEEDLE\n', 'utf8');
  await writeFile(join(root, 'gamma.ts'), 'GAMMA_SKETCH_NEEDLE\n', 'utf8');

  const host = await import(new URL(`../lib/index.js?sketch-build=${Date.now()}`, import.meta.url));
  const watcher = new host.WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  watcher.start();
  await host.rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });
  const identity = host.searchIndexIdentity(root, { searchIndexDirectory: indexDirectory });
  const options = {
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    searchSessionId: 'sketch-session',
    searchRevision: 1,
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
  };
  const first = await host.searchWorkspaceText(root, 'ALPHA_SKETCH_NEEDLE', options);
  assert.deepEqual(first.matches.map((match) => match.path), ['alpha.ts']);
  assert.ok(first.indexCache.sketchesBuilt >= 3);
  assert.notEqual(await waitForFile(identity.sketchFile), null);

  const second = await host.searchWorkspaceText(root, 'BETA_SKETCH_NEEDLE', {
    ...options,
    searchRevision: 2,
  });
  assert.deepEqual(second.matches.map((match) => match.path), ['beta.ts']);
  assert.ok(second.indexCache.sketchesSkipped >= 2);

  const freshHost = await import(new URL(`../lib/index.js?sketch-read=${Date.now()}`, import.meta.url));
  const freshWatcher = new freshHost.WorkspaceWatcher(root, () => {});
  t.after(() => freshWatcher.close());
  freshWatcher.start();
  await freshHost.updateWorkspaceSearchIndex(root, {
    searchIndexDirectory: indexDirectory,
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
  });
  const persisted = await freshHost.searchWorkspaceText(root, 'GAMMA_SKETCH_NEEDLE', {
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    searchSessionId: 'fresh-sketch-session',
    searchRevision: 9,
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
  });
  assert.deepEqual(persisted.matches.map((match) => match.path), ['gamma.ts']);
  assert.ok(persisted.indexCache.sketchesSkipped >= 2);
});

test('regex searches never use literal trigram sketches', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-sketch-regex-root-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-text-sketch-regex-index-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'alpha.ts'), 'alpha needle 123\n', 'utf8');

  const host = await import(new URL(`../lib/index.js?sketch-regex=${Date.now()}`, import.meta.url));
  const watcher = new host.WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  watcher.start();
  await host.rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });
  const result = await host.searchWorkspaceText(root, 'needle\\s+\\d+', {
    regex: true,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    searchSessionId: 'sketch-regex-session',
    searchRevision: 1,
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
  });
  assert.deepEqual(result.matches.map((match) => match.path), ['alpha.ts']);
  assert.equal(result.indexCache.sketchesSkipped, 0);
});
