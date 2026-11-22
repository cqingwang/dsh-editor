import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  clearWorkspaceSearchIndex,
  rebuildWorkspaceSearchIndex,
  searchWorkspaceText,
  workspaceSearchIndexStatus,
} from '../lib/index.js';

test('concurrent clear and rebuild leave only a cleared state or a complete valid snapshot', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-mutation-race-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-mutation-race-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  for (let index = 0; index < 40; index += 1) {
    await writeFile(join(root, `race-${String(index).padStart(2, '0')}.ts`), `export const value = ${index};\n`);
  }

  await Promise.all([
    rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory }),
    clearWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory }),
  ]);
  await new Promise((resolve) => setTimeout(resolve, 60));

  const status = await workspaceSearchIndexStatus(root, { searchIndexDirectory: indexDirectory });
  if (status.exists) assert.equal(status.files, 40);
  else assert.equal(status.files, 0);
  assert.deepEqual(
    (await readdir(indexDirectory)).filter((name) => name.endsWith('.tmp')),
    [],
  );
});

test('search survives simultaneous clear and rebuild without corrupting the final index', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-search-mutation-race-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-search-mutation-race-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  for (let index = 0; index < 40; index += 1) {
    await writeFile(
      join(root, `race-${String(index).padStart(2, '0')}.ts`),
      `export const value = ${index}; // SEARCH_MUTATION_RACE_NEEDLE\n`,
    );
  }

  const [search] = await Promise.all([
    searchWorkspaceText(root, 'SEARCH_MUTATION_RACE_NEEDLE', {
      maxMatches: 200,
      searchIndex: true,
      searchIndexDirectory: indexDirectory,
    }),
    rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory }),
    clearWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory }),
  ]);
  assert.ok(Array.isArray(search.matches));
  await new Promise((resolve) => setTimeout(resolve, 60));

  const status = await workspaceSearchIndexStatus(root, { searchIndexDirectory: indexDirectory });
  if (status.exists) assert.equal(status.files, 40);
  else assert.equal(status.files, 0);
  assert.deepEqual(
    (await readdir(indexDirectory)).filter((name) => name.endsWith('.tmp')),
    [],
  );
});
