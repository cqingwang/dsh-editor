import assert from 'node:assert/strict';
import { mkdtemp, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { rebuildWorkspaceSearchIndex, searchIndexIdentity } from '../lib/index.js';

test('a newer V8 content sidecar lets a fresh process search without parsing the NDJSON body', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-content-sidecar-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-content-sidecar-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'alpha.ts'), 'CONTENT_SIDECAR_NEEDLE alpha\n', 'utf8');
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });

  const identity = searchIndexIdentity(root, { searchIndexDirectory: indexDirectory });
  assert.equal((await stat(identity.contentFile)).isFile(), true);

  // Keep the portable NDJSON fallback present but unusable. Its old mtime makes
  // the newer content sidecar authoritative, so decoding the corrupt file would
  // make this search fail.
  await writeFile(identity.file, 'not-a-gzip-index', 'utf8');
  await utimes(identity.file, new Date(1), new Date(1));

  const freshHost = await import(
    new URL(`../lib/index.js?content-sidecar=${Date.now()}`, import.meta.url)
  );
  const watcher = new freshHost.WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  watcher.start();
  const result = await freshHost.searchWorkspaceText(root, 'CONTENT_SIDECAR_NEEDLE', {
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    includeExcluded: false,
  });
  assert.deepEqual(
    result.matches.map((match) => match.path),
    ['alpha.ts'],
  );
});
