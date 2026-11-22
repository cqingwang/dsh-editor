import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import {
  rebuildWorkspaceSearchIndex,
  searchWorkspaceText,
  workspaceFileOperations,
  workspaceSearchIndexStatus,
} from '../lib/index.js';

const execFileAsync = promisify(execFile);

test('project index excludes Git metadata, ignored paths, heavy directories and OS files by default', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-default-excludes-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-default-excludes-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await execFileAsync('git', ['init', '-q', root]);
  await writeFile(join(root, '.gitignore'), 'ignored.txt\n', 'utf8');
  await writeFile(join(root, '.gitattributes'), 'DEFAULT_METADATA_NEEDLE attributes\n', 'utf8');
  await writeFile(join(root, '.gitmodules'), 'DEFAULT_METADATA_NEEDLE submodules\n', 'utf8');
  await writeFile(join(root, '.gitkeep'), 'DEFAULT_METADATA_NEEDLE keep\n', 'utf8');
  await writeFile(join(root, '.DS_Store'), 'DEFAULT_METADATA_NEEDLE finder\n', 'utf8');
  await writeFile(join(root, 'ignored.txt'), 'DEFAULT_METADATA_NEEDLE ignored\n', 'utf8');
  await writeFile(join(root, 'visible.ts'), 'DEFAULT_METADATA_NEEDLE visible\n', 'utf8');
  await mkdir(join(root, 'node_modules', 'pkg'), { recursive: true });
  await writeFile(join(root, 'node_modules', 'pkg', 'index.js'), 'DEFAULT_METADATA_NEEDLE dependency\n', 'utf8');

  const rebuilt = await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });
  assert.equal(rebuilt.files, 1);
  const status = await workspaceSearchIndexStatus(root, { searchIndexDirectory: indexDirectory });
  assert.equal(status.files, 1);

  const text = await searchWorkspaceText(root, 'DEFAULT_METADATA_NEEDLE', {
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    maxMatches: 20,
  });
  assert.deepEqual(text.matches.map((match) => match.path), ['visible.ts']);

  for (const query of ['gitignore', 'gitattributes', 'gitmodules', 'gitkeep', 'ds_store']) {
    const entries = await workspaceFileOperations.search(root, query, {
      showHidden: true,
      showExcluded: true,
      respectGitIgnore: true,
      searchIndex: true,
      searchIndexDirectory: indexDirectory,
      filesOnly: true,
    });
    assert.deepEqual(entries.entries, [], `${query} must stay outside the default search/index scope`);
  }
});
