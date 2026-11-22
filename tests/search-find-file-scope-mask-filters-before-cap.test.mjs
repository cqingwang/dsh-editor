import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const host = await import('../lib/index.js');
const searchScopeSource = await readFile(
  new URL('../src/client/components/search/search-scope.ts', import.meta.url),
  'utf8',
);

test('Find file-scope typed search reaches indexed paths beyond the base file budget', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-find-file-scope-mask-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (let index = 0; index < 2001; index += 1) {
    await writeFile(join(root, `noise-${String(index).padStart(4, '0')}.md`), '# noise\n', 'utf8');
  }
  await writeFile(join(root, 'zz-visible.ts'), 'export const visible = true;\n', 'utf8');

  const unfiltered = await host.workspaceFileOperations.files(root, 2000, {
    includeExcluded: true,
    respectGitIgnore: true,
  });
  assert.equal(unfiltered.truncated, true);
  assert.equal(unfiltered.files.includes('zz-visible.ts'), false);

  const findToolFileCandidatesRequest = loadTypeScriptFunction(
    searchScopeSource,
    'findToolFileCandidatesRequest',
  );
  const request = findToolFileCandidatesRequest(
    true,
    '*.ts',
    { excludedDirectories: [], includedDirectories: [] },
    'visible',
  );
  assert.deepEqual(request, {
    op: 'search',
    query: 'visible',
    showHidden: true,
    showExcluded: true,
    sort: 'name',
    foldersFirst: false,
    includeExcluded: true,
    respectGitIgnore: true,
    fileMask: '*.ts',
    matchPath: true,
    filesOnly: true,
    searchDirectoryRules: {
      excludedDirectories: [],
      includedDirectories: [],
    },
  });

  const found = await host.workspaceFileOperations.search(root, 'visible', request);
  assert.deepEqual(found.entries.map((entry) => entry.path), ['zz-visible.ts']);
  assert.equal(found.truncated, false);
});
