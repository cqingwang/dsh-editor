import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { searchIndexIdentity, writeWorkspaceSearchIndex } from '../lib/index.js';

test('an aborted index write preserves the previous snapshot and removes temporary output', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-abort-write-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-abort-write-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'target.ts'), 'export const target = "old";\n', 'utf8');

  const identity = searchIndexIdentity(root, { searchIndexDirectory: indexDirectory });
  await writeWorkspaceSearchIndex(identity, {
    version: 2,
    root: identity.root,
    updatedAt: 1,
    contentBytes: 31,
    files: {
      'target.ts': {
        mtimeMs: 1,
        size: 32,
        content: 'export const target = "old";\n',
      },
    },
  });
  const previous = await readFile(identity.file);

  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    writeWorkspaceSearchIndex(
      identity,
      {
        version: 2,
        root: identity.root,
        updatedAt: 2,
        contentBytes: 31,
        files: {
          'target.ts': {
            mtimeMs: 2,
            size: 32,
            content: 'export const target = "new";\n',
          },
        },
      },
      controller.signal,
    ),
    (error) => error?.name === 'AbortError',
  );

  assert.deepEqual(await readFile(identity.file), previous);
  const storeEntries = await readdir(indexDirectory);
  assert.equal(
    storeEntries.some((name) => name.endsWith('.tmp')),
    false,
  );

  const inFlightController = new AbortController();
  const largeFiles = {};
  for (let index = 0; index < 12_000; index += 1) {
    largeFiles[`large-${index}.ts`] = {
      mtimeMs: index,
      size: 2048,
      content: `export const value${index} = "${'x'.repeat(2000)}";\n`,
    };
  }
  const abortTimer = setTimeout(() => inFlightController.abort(), 1);
  await assert.rejects(
    writeWorkspaceSearchIndex(
      identity,
      {
        version: 2,
        root: identity.root,
        updatedAt: 3,
        contentBytes: 24_000_000,
        files: largeFiles,
      },
      inFlightController.signal,
    ),
    (error) => error?.name === 'AbortError',
  );
  clearTimeout(abortTimer);

  assert.deepEqual(await readFile(identity.file), previous);
  assert.equal(
    (await readdir(indexDirectory)).some((name) => name.endsWith('.tmp')),
    false,
  );
});
