import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const host = await import('../lib/index.js');

test('global excludes file changes invalidate the page revision cache', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-global-excludes-cache-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const globalFile = join(root, 'global-ignore');
  await execFileAsync('git', ['init', '-q', root]);
  await execFileAsync('git', ['-C', root, 'config', 'core.excludesFile', globalFile]);
  await writeFile(globalFile, '*.global\n', 'utf8');
  await writeFile(join(root, 'drop.global'), 'GLOBAL_IGNORE_NEEDLE old ignored\n', 'utf8');
  await writeFile(join(root, 'visible.txt'), 'GLOBAL_IGNORE_NEEDLE visible\n', 'utf8');

  const context = { searchSessionId: 'global-page', searchRevision: 1 };
  const first = await host.searchWorkspaceText(root, 'GLOBAL_IGNORE_NEEDLE', {
    includeExcluded: true,
    maxMatches: 20,
    ...context,
  });
  assert.deepEqual(first.matches.map((match) => match.path), ['visible.txt']);

  const originalTimes = await stat(globalFile);
  await writeFile(globalFile, '*.change\n', 'utf8');
  await utimes(globalFile, originalTimes.atime, originalTimes.mtime);
  await writeFile(join(root, 'drop.change'), 'GLOBAL_IGNORE_NEEDLE newly ignored\n', 'utf8');
  const refreshed = await host.searchWorkspaceText(root, 'GLOBAL_IGNORE_NEEDLE', {
    includeExcluded: true,
    maxMatches: 20,
    ...context,
  });
  assert.deepEqual(
    refreshed.matches.map((match) => match.path),
    ['drop.global', 'visible.txt'],
  );
});
