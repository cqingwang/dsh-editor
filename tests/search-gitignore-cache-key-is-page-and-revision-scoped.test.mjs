import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const host = await import('../lib/index.js');

test('Git ignore cache is bounded to one page session and search revision', async (t) => {
  const realGit = (await execFileAsync('which', ['git'])).stdout.trim();
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-gitignore-cache-'));
  const bin = await mkdtemp(join(tmpdir(), 'dsh-editor-gitignore-cache-bin-'));
  const log = join(bin, 'git.log');
  const delayFlag = join(bin, 'delay-next-ls-files');
  const previousPath = process.env.PATH;
  t.after(async () => {
    process.env.PATH = previousPath;
    await rm(root, { recursive: true, force: true });
    await rm(bin, { recursive: true, force: true });
  });

  await execFileAsync('git', ['init', '-q', root]);
  await writeFile(join(root, '.gitignore'), '*.tmp\n', 'utf8');
  await writeFile(join(root, 'drop.tmp'), 'CACHE_NEEDLE drop\n', 'utf8');
  await writeFile(join(root, 'visible.txt'), 'CACHE_NEEDLE visible\n', 'utf8');
  const wrapper = join(bin, 'git');
  await writeFile(
    wrapper,
    `#!/bin/sh\nprintf '%s\\n' "$*" >> ${JSON.stringify(log)}\nif [ -f ${JSON.stringify(delayFlag)} ]; then\n  case " $* " in\n    *" ls-files "*) rm -f ${JSON.stringify(delayFlag)}; sleep 0.25 ;;\n  esac\nfi\nexec ${JSON.stringify(realGit)} "$@"\n`,
    'utf8',
  );
  await chmod(wrapper, 0o755);

  const ignoredReads = async () => {
    const text = await readFile(log, 'utf8').catch(() => '');
    return text.split('\n').filter((line) => line.includes('ls-files') && line.includes('--ignored')).length;
  };
  const search = (options = {}) =>
    host.searchWorkspaceText(root, 'CACHE_NEEDLE', {
      includeExcluded: true,
      maxMatches: 20,
      ...options,
    });

  process.env.PATH = `${bin}:${previousPath}`;
  await search();
  await search();
  assert.equal(await ignoredReads(), 2);

  await rm(log, { force: true });
  const cached = { searchSessionId: 'page-a', searchRevision: 1 };
  await search(cached);
  await search(cached);
  assert.equal(await ignoredReads(), 1);

  await rm(log, { force: true });
  await Promise.all([
    search({ searchSessionId: 'page-parallel', searchRevision: 1 }),
    search({ searchSessionId: 'page-parallel', searchRevision: 1 }),
  ]);
  assert.equal(await ignoredReads(), 1);

  await rm(log, { force: true });
  await writeFile(join(root, '.gitignore'), '*.cache\n', 'utf8');
  await writeFile(join(root, 'drop.cache'), 'CACHE_NEEDLE cache\n', 'utf8');
  const nextRevision = await search({ searchSessionId: 'page-a', searchRevision: 2 });
  assert.deepEqual(
    nextRevision.matches.map((match) => match.path),
    ['drop.tmp', 'visible.txt'],
  );
  assert.equal(await ignoredReads(), 1);

  await rm(log, { force: true });
  await search({ searchSessionId: 'page-a', searchRevision: 1 });
  assert.equal(await ignoredReads(), 1);

  await rm(log, { force: true });
  await search({ searchSessionId: 'page-b', searchRevision: 2 });
  assert.equal(await ignoredReads(), 1);

  await rm(log, { force: true });
  await writeFile(delayFlag, 'delay\n', 'utf8');
  const staleRequest = search({ searchSessionId: 'page-race', searchRevision: 1 });
  await new Promise((resolve) => setTimeout(resolve, 80));
  const latestRequest = search({ searchSessionId: 'page-race', searchRevision: 2 });
  await Promise.all([staleRequest, latestRequest]);
  await rm(log, { force: true });
  await search({ searchSessionId: 'page-race', searchRevision: 1 });
  assert.equal(await ignoredReads(), 1);
});
