import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { rebuildWorkspaceSearchIndex, searchWorkspaceText } from '../lib/index.js';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-equivalence-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-equivalence-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await mkdir(join(root, 'src', 'nested'), { recursive: true });
  await mkdir(join(root, 'docs'), { recursive: true });
  await mkdir(join(root, 'node_modules', 'pkg'), { recursive: true });
  await mkdir(join(root, '.hidden'), { recursive: true });
  await writeFile(join(root, 'src', 'a.ts'), 'shared needle a\n', 'utf8');
  await writeFile(join(root, 'src', 'nested', 'b.ts'), 'shared needle b\n', 'utf8');
  await writeFile(join(root, 'src', 'c.js'), 'shared needle c\n', 'utf8');
  await writeFile(join(root, 'docs', 'd.ts'), 'shared needle d\n', 'utf8');
  await writeFile(join(root, 'node_modules', 'pkg', 'e.ts'), 'shared needle e\n', 'utf8');
  await writeFile(join(root, '.hidden', 'f.ts'), 'shared needle f\n', 'utf8');
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });
  return { root, indexDirectory };
}

const cases = [
  { name: 'File Mask', options: { fileMask: '*.ts' } },
  { name: 'non-recursive Directory scope', options: { directory: 'src', recursive: false } },
  { name: 'recursive Directory scope', options: { directory: 'src' } },
  {
    name: 'include/exclude Scope patterns',
    options: {
      scopeIncludePatterns: ['src/**'],
      scopeExcludePatterns: ['src/nested/**'],
    },
  },
  {
    name: 'search directory rules',
    options: {
      searchDirectoryRules: {
        excludedDirectories: ['src'],
        includedDirectories: ['src/nested'],
      },
    },
  },
  { name: 'include excluded project directories', options: { includeExcluded: true } },
];

test('indexed text search matches live fallback under Scope and File Mask options', async (t) => {
  const { root, indexDirectory } = await fixture(t);
  for (const entry of cases) {
    const common = {
      maxMatches: 50,
      maxBytes: 1024 * 1024,
      ...entry.options,
    };
    const live = await searchWorkspaceText(root, 'shared needle', {
      ...common,
      searchIndex: false,
    });
    const cached = await searchWorkspaceText(root, 'shared needle', {
      ...common,
      searchIndex: true,
      searchIndexDirectory: indexDirectory,
    });
    const locations = (matches) =>
      matches
        .map((match) => `${match.path}:${match.line}:${match.column}`)
        .sort((left, right) => left.localeCompare(right));

    assert.deepEqual(locations(cached.matches), locations(live.matches), entry.name);
  }
});
