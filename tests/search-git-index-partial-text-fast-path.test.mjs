import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { searchWorkspaceText } from '../lib/index.js';

function initRepository(root) {
  execFileSync('git', ['-C', root, 'init', '-q']);
  execFileSync('git', ['-C', root, 'config', 'user.name', 'Test']);
  execFileSync('git', ['-C', root, 'config', 'user.email', 'test@example.com']);
}

test('the All-tab text provider can return a bounded Git-index preview immediately', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-git-text-fast-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  initRepository(root);
  await writeFile(join(root, 'tracked.ts'), 'const value = FAST_GIT_NEEDLE;\n', 'utf8');
  await writeFile(join(root, 'untracked.ts'), '// FAST_GIT_NEEDLE\n', 'utf8');
  execFileSync('git', ['-C', root, 'add', 'tracked.ts']);

  const result = await searchWorkspaceText(root, 'FAST_GIT_NEEDLE', {
    fastPartialTextSearch: true,
    maxMatches: 40,
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
  });
  assert.equal(result.fastPartialTextSearch, true);
  assert.equal(result.truncated, true);
  assert.deepEqual(
    result.matches.map((match) => match.path).sort(),
    ['tracked.ts', 'untracked.ts'],
  );
});

test('a non-Git workspace falls back to the complete workspace scan', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-git-text-fallback-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'ordinary.ts'), 'FALLBACK_ONLY_NEEDLE\n', 'utf8');

  const result = await searchWorkspaceText(root, 'FALLBACK_ONLY_NEEDLE', {
    fastPartialTextSearch: true,
    maxMatches: 40,
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
  });
  assert.equal(result.fastPartialTextSearch, undefined);
  assert.deepEqual(result.matches.map((match) => match.path), ['ordinary.ts']);
});

test('custom Scope patterns keep the complete workspace scan authoritative', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-git-text-scope-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  initRepository(root);
  await writeFile(join(root, 'tracked.ts'), 'SCOPED_GIT_NEEDLE\n', 'utf8');
  execFileSync('git', ['-C', root, 'add', 'tracked.ts']);

  const result = await searchWorkspaceText(root, 'SCOPED_GIT_NEEDLE', {
    fastPartialTextSearch: true,
    maxMatches: 40,
    scopeIncludePatterns: ['*.md'],
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
  });
  assert.equal(result.fastPartialTextSearch, undefined);
  assert.deepEqual(result.matches, []);
});

test('Search Everywhere enables the partial Git preview only on the All tab', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
  assert.match(source, /fastPartialTextSearch: searchEverywhere\?\.tab === 'all',/u);
});
