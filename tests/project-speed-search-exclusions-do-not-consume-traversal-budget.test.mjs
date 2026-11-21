import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const host = await import('../lib/index.js');

test('Git ignored entries do not consume the Project speed-search traversal budget', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-speed-search-git-budget-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await execFileAsync('git', ['init', '-q', root]);
  await writeFile(join(root, '.gitignore'), '*.tmp\n', 'utf8');
  await writeFile(join(root, '0-ignored.tmp'), '', 'utf8');
  await writeFile(join(root, '1-visible-speed-budget.txt'), '', 'utf8');

  const result = await host.workspaceFileOperations.search(root, 'speed-budget', {
    showHidden: true,
    showExcluded: true,
    respectGitIgnore: true,
    maxVisited: 2,
  });

  assert.deepEqual(result.entries.map((entry) => entry.path), ['1-visible-speed-budget.txt']);
  assert.equal(result.truncated, false);
});

test('user-excluded directories do not consume the Project speed-search traversal budget', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-speed-search-rules-budget-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '0-excluded'));
  await writeFile(join(root, '0-excluded', 'hidden-speed-budget.txt'), '', 'utf8');
  await writeFile(join(root, '1-visible-speed-budget.txt'), '', 'utf8');

  const result = await host.workspaceFileOperations.search(root, 'speed-budget', {
    showHidden: true,
    showExcluded: true,
    searchDirectoryRules: { excludedDirectories: ['0-excluded'] },
    maxVisited: 1,
  });

  assert.deepEqual(result.entries.map((entry) => entry.path), ['1-visible-speed-budget.txt']);
  assert.equal(result.truncated, false);
});
