import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';

import { searchWorkspaceText } from '../lib/index.js';

test('a path-only index placeholder is read from disk and upgraded to cached content', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-path-upgrade-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-path-upgrade-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  const content = 'PATH_PLACEHOLDER_CONTENT\n';
  await writeFile(join(root, 'placeholder.ts'), content, 'utf8');
  const indexFile = join(
    indexDirectory,
    `${createHash('sha256').update(resolve(root)).digest('hex')}.json.gz`,
  );
  await writeFile(
    indexFile,
    gzipSync(
      Buffer.from(
        [
          JSON.stringify({
            format: 'dsh-editor-search-index-ndjson',
            version: 2,
            root: resolve(root),
            updatedAt: Date.now(),
            contentBytes: 0,
          }),
          JSON.stringify({ path: 'placeholder.ts', entry: { kind: 'path' } }),
          '',
        ].join('\n'),
      ),
    ),
  );

  const first = await searchWorkspaceText(root, 'PATH_PLACEHOLDER_CONTENT', {
    maxMatches: 20,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  });
  assert.deepEqual(
    first.matches.map((match) => match.path),
    ['placeholder.ts'],
  );
  assert.equal(first.indexCache.hits, 0);
  assert.equal(first.indexCache.misses, 1);
  assert.equal(first.indexCache.saved, true);

  const second = await searchWorkspaceText(root, 'PATH_PLACEHOLDER_CONTENT', {
    maxMatches: 20,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  });
  assert.deepEqual(
    second.matches.map((match) => match.path),
    ['placeholder.ts'],
  );
  assert.equal(second.indexCache.hits, 1);
  assert.equal(second.indexCache.misses, 0);
});
