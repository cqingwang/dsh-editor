import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const host = await import('../lib/index.js');

test('tracked files inside Git-ignored directories stay outside every search surface', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-tracked-ignored-search-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await execFileAsync('git', ['init', '-q', root]);
  await writeFile(join(root, '.gitignore'), 'ignored-dir/\n', 'utf8');
  await writeFile(join(root, 'visible.txt'), 'TRACKED_IGNORED_NEEDLE visible\n', 'utf8');
  await mkdir(join(root, 'ignored-dir'));
  await writeFile(
    join(root, 'ignored-dir', 'tracked-needle.txt'),
    'TRACKED_IGNORED_NEEDLE hidden despite the index\n',
    'utf8',
  );
  await execFileAsync('git', ['-C', root, 'add', '.gitignore', 'visible.txt']);
  await execFileAsync('git', ['-C', root, 'add', '-f', 'ignored-dir/tracked-needle.txt']);

  const named = await host.workspaceFileOperations.search(root, 'tracked-needle', {
    showHidden: true,
    showExcluded: true,
    respectGitIgnore: true,
  });
  assert.deepEqual(named.entries, []);

  const text = await host.searchWorkspaceText(root, 'TRACKED_IGNORED_NEEDLE', {
    includeExcluded: true,
    maxMatches: 20,
  });
  assert.deepEqual(text.matches.map((match) => match.path), ['visible.txt']);

  const trackedScope = await host.searchWorkspaceText(root, 'TRACKED_IGNORED_NEEDLE', {
    gitScope: 'tracked',
    maxMatches: 20,
  });
  assert.deepEqual(trackedScope.matches.map((match) => match.path), ['visible.txt']);
});
