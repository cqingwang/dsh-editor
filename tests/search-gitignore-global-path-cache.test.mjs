import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const host = await import('../lib/index.js');

test('the global excludes config path is reused within one search revision', async (t) => {
  const realGit = (await execFileAsync('which', ['git'])).stdout.trim();
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-global-path-cache-'));
  const bin = await mkdtemp(join(tmpdir(), 'dsh-editor-global-path-cache-bin-'));
  const globalFile = join(root, 'global-ignore');
  const log = join(bin, 'git.log');
  const previousPath = process.env.PATH;
  t.after(async () => {
    process.env.PATH = previousPath;
    await rm(root, { recursive: true, force: true });
    await rm(bin, { recursive: true, force: true });
  });

  await execFileAsync(realGit, ['init', '-q', root]);
  await execFileAsync(realGit, ['-C', root, 'config', 'core.excludesFile', globalFile]);
  await writeFile(globalFile, '*.ignored\n', 'utf8');
  await writeFile(join(root, 'drop.ignored'), 'GLOBAL_PATH_NEEDLE ignored\n', 'utf8');
  await writeFile(join(root, 'visible.txt'), 'GLOBAL_PATH_NEEDLE visible\n', 'utf8');
  const wrapper = join(bin, 'git');
  await writeFile(
    wrapper,
    `#!/bin/sh\nprintf '%s\\n' "$*" >> ${JSON.stringify(log)}\nexec ${JSON.stringify(realGit)} "$@"\n`,
    'utf8',
  );
  await chmod(wrapper, 0o755);
  process.env.PATH = `${bin}:${previousPath}`;

  const configReads = async () => {
    const text = await readFile(log, 'utf8').catch(() => '');
    return text
      .split('\n')
      .filter((line) => line.includes('config') && line.includes('core.excludesFile')).length;
  };
  const search = (searchRevision, searchSessionId = 'global-path-page') =>
    host.searchWorkspaceText(root, 'GLOBAL_PATH_NEEDLE', {
      includeExcluded: true,
      maxMatches: 20,
      searchSessionId,
      searchRevision,
    });

  assert.deepEqual(
    (await search(1)).matches.map((match) => match.path),
    ['visible.txt'],
  );
  assert.equal(await configReads(), 1);
  await search(1);
  assert.equal(await configReads(), 1);

  await search(2);
  assert.equal(await configReads(), 2);

  await writeFile(globalFile, '*.changed\n', 'utf8');
  await writeFile(join(root, 'drop.changed'), 'GLOBAL_PATH_NEEDLE changed\n', 'utf8');
  const refreshed = await search(2);
  assert.equal(await configReads(), 2);
  assert.deepEqual(
    refreshed.matches.map((match) => match.path),
    ['drop.ignored', 'visible.txt'],
  );

  await search(2, 'global-path-other-page');
  assert.equal(await configReads(), 3);
});
