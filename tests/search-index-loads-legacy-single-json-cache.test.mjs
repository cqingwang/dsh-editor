import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';

import { searchWorkspaceText } from '../lib/index.js';

test('legacy v1 single-JSON gzip cache remains searchable', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-legacy-index-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-legacy-index-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  const file = join(root, 'legacy.ts');
  const content = 'LEGACY_INDEX_CONTENT\n';
  await writeFile(file, content, 'utf8');
  const info = await stat(file);
  const indexFile = join(
    indexDirectory,
    `${createHash('sha256').update(resolve(root)).digest('hex')}.json.gz`,
  );
  await writeFile(
    indexFile,
    gzipSync(
      Buffer.from(
        JSON.stringify({
          version: 1,
          root: resolve(root),
          updatedAt: Date.now(),
          contentBytes: Buffer.byteLength(content),
          files: {
            'legacy.ts': {
              dev: info.dev,
              ino: info.ino,
              mtimeMs: info.mtimeMs,
              size: info.size,
              content,
            },
          },
        }),
      ),
    ),
  );

  const result = await searchWorkspaceText(root, 'LEGACY_INDEX_CONTENT', {
    maxMatches: 20,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  });

  assert.deepEqual(
    result.matches.map((match) => match.path),
    ['legacy.ts'],
  );
  assert.equal(result.indexCache.hits, 1);
});

test('legacy cache entries without filesystem identity refresh before reuse', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-legacy-index-no-identity-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-legacy-index-no-identity-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  const file = join(root, 'legacy.ts');
  const content = 'LEGACY_IDENTITYLESS_CONTENT\n';
  await writeFile(file, content, 'utf8');
  const info = await stat(file);
  const indexFile = join(
    indexDirectory,
    `${createHash('sha256').update(resolve(root)).digest('hex')}.json.gz`,
  );
  await writeFile(
    indexFile,
    gzipSync(
      Buffer.from(
        JSON.stringify({
          version: 1,
          root: resolve(root),
          updatedAt: Date.now(),
          contentBytes: Buffer.byteLength(content),
          files: {
            'legacy.ts': {
              mtimeMs: info.mtimeMs,
              size: info.size,
              content,
            },
          },
        }),
      ),
    ),
  );

  const result = await searchWorkspaceText(root, 'LEGACY_IDENTITYLESS_CONTENT', {
    maxMatches: 20,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  });

  assert.deepEqual(
    result.matches.map((match) => match.path),
    ['legacy.ts'],
  );
  assert.equal(result.indexCache.hits, 0);
  assert.equal(result.indexCache.misses, 1);
  assert.equal(result.indexCache.saved, true);
});
