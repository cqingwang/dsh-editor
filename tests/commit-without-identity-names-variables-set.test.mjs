import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { gitCommit, gitInspect, gitStatus } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

/** A repository whose identity can be cleared per test. */
async function fixture({ identity = true } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r24-'));
  execFileSync('git', ['-C', dir, 'init', '-q', '-b', 'main']);
  execFileSync('git', ['-C', dir, 'config', 'user.name', identity ? 'Test' : '']);
  execFileSync('git', ['-C', dir, 'config', 'user.email', identity ? 'test@example.com' : '']);
  await writeFile(join(dir, 'a.txt'), 'one\n');
  execFileSync('git', ['-C', dir, 'add', '.']);
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('a commit without an identity names the variables to set', async (t) => {
  const { dir, cleanup } = await fixture({ identity: false });
  t.after(cleanup);
  const inspection = await gitInspect(dir, ['a.txt']);
  assert.deepEqual(inspection.identity, { name: '', email: '' });
  await assert.rejects(
    () => gitCommit(dir, { message: 'x', paths: ['a.txt'] }),
    /user\.name \/ user\.email are not configured/,
  );
});

test('inspect reports the identity so the panel can warn before typing', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const inspection = await gitInspect(dir, ['a.txt']);
  assert.deepEqual(inspection.identity, { name: 'Test', email: 'test@example.com' });
  /* The pre-commit checks still run alongside it. */
  assert.deepEqual(inspection.conflicts, []);
});

test('committing unchanged files reports "nothing to commit" in words', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await gitCommit(dir, { message: 'first', paths: ['a.txt'] });
  await assert.rejects(() => gitCommit(dir, { message: 'again', paths: ['a.txt'] }), /nothing to commit/);
});

test('status reports an in-progress merge and clears it after abort', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await gitCommit(dir, { message: 'base', paths: ['a.txt'] });
  execFileSync('git', ['-C', dir, 'checkout', '-qb', 'other']);
  await writeFile(join(dir, 'a.txt'), 'other\n');
  execFileSync('git', ['-C', dir, 'commit', '-qam', 'other']);
  execFileSync('git', ['-C', dir, 'checkout', '-q', 'main']);
  await writeFile(join(dir, 'a.txt'), 'main\n');
  execFileSync('git', ['-C', dir, 'commit', '-qam', 'main']);

  assert.equal((await gitStatus(dir)).operation, null);
  try {
    execFileSync('git', ['-C', dir, 'merge', 'other'], { stdio: 'pipe' });
  } catch {
    /* the conflict is the point */
  }
  assert.equal((await gitStatus(dir)).operation, 'merge');
  execFileSync('git', ['-C', dir, 'merge', '--abort']);
  assert.equal((await gitStatus(dir)).operation, null);
});

test('the panel drops the subject warning row but names an in-progress operation', () => {
  const client = `${read('src/client/components/commit/CommitPanel.tsx')}\n${read('lib/client.js')}`;
  assert.doesNotMatch(client, /COMMIT_SUBJECT_HARD_LIMIT/);
  assert.doesNotMatch(client, /editor\.commitSubjectTruncated/);
  assert.match(client, /t\('editor\.identityMissing'\)/);
  assert.match(
    client,
    /t\('editor\.operationInProgress', \{\s+operation: git\.operation,\s+\}\)/u,
  );
});
