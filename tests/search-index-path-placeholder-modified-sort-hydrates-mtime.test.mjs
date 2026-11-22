import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';

import { workspaceFileOperations } from '../lib/index.js';

test('modified filename ordering hydrates path-only index metadata before sorting', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-modified-paths-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-modified-paths-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'aaa-decoy.ts'), 'decoy\n', 'utf8');
  await writeFile(join(root, 'placeholder-a-old.ts'), 'old\n', 'utf8');
  await writeFile(join(root, 'placeholder-z-new.ts'), 'new\n', 'utf8');
  await utimes(
    join(root, 'aaa-decoy.ts'),
    new Date('2024-01-01'),
    new Date('2024-01-01'),
  );
  await utimes(
    join(root, 'placeholder-a-old.ts'),
    new Date('2020-01-01'),
    new Date('2020-01-01'),
  );
  await utimes(
    join(root, 'placeholder-z-new.ts'),
    new Date('2023-01-01'),
    new Date('2023-01-01'),
  );
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
          JSON.stringify({ path: 'placeholder-a-old.ts', entry: { kind: 'path' } }),
          JSON.stringify({ path: 'placeholder-z-new.ts', entry: { kind: 'path' } }),
          '',
        ].join('\n'),
      ),
    ),
  );

  const result = await workspaceFileOperations.search(root, 'placeholder-', {
    respectGitIgnore: true,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    maxVisited: 1,
    sort: 'modified',
    foldersFirst: true,
  });
  assert.deepEqual(
    result.entries.map((entry) => entry.path),
    ['placeholder-z-new.ts', 'placeholder-a-old.ts'],
  );
});
