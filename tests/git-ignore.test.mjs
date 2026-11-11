import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import { gitIgnore, gitStatus } from '../lib/index.js';

const run = promisify(execFile);

/** Throwaway repository with one tracked file. */
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-ignore-'));
  await run('git', ['-C', dir, 'init', '-q', '-b', 'main']);
  await run('git', ['-C', dir, 'config', 'user.email', 'editor@example.test']);
  await run('git', ['-C', dir, 'config', 'user.name', 'Editor Test']);
  await writeFile(join(dir, 'tracked.txt'), 'one\n');
  await run('git', ['-C', dir, 'add', '-A']);
  await run('git', ['-C', dir, 'commit', '-qm', 'initial commit']);
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('add to gitignore appends once and is idempotent', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(dir, 'local.env'), 'SECRET=1\n');

  const first = await gitIgnore(dir, ['local.env']);
  assert.deepEqual(first.added, ['local.env']);
  assert.deepEqual(first.ignored, []);

  const second = await gitIgnore(dir, ['local.env']);
  assert.deepEqual(second.added, []);
  assert.deepEqual(second.ignored, ['local.env']);

  const written = await readFile(join(dir, '.gitignore'), 'utf8');
  assert.equal(written, 'local.env\n');

  const status = await gitStatus(dir);
  assert.equal(status.changes.some((change) => change.path === 'local.env'), false);
});

test('gitignore entries carry the repository prefix of a nested workspace', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await mkdir(join(dir, 'packages', 'app'), { recursive: true });
  await writeFile(join(dir, 'packages', 'app', 'tmp.log'), 'x\n');

  await gitIgnore(join(dir, 'packages', 'app'), ['tmp.log']);

  const written = await readFile(join(dir, '.gitignore'), 'utf8');
  assert.equal(written, 'packages/app/tmp.log\n');
});
