import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { gitLogSearch } from '../lib/index.js';

const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-log-search-'));
  execFileSync('git', ['-C', dir, 'init', '-q', '-b', 'main']);
  git(dir, 'config', 'user.email', 'demo@example.com');
  git(dir, 'config', 'user.name', 'Demo User');
  for (let index = 0; index < 70; index += 1) {
    await writeFile(join(dir, 'history.txt'), `${index}\n`);
    git(dir, 'add', 'history.txt');
    const message = index === 5 ? 'needle-old commit' : `filler commit ${index}`;
    const author = index === 9 ? 'Needle Author' : 'Demo User';
    execFileSync('git', ['-C', dir, 'commit', '-qm', message], {
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: author,
        GIT_AUTHOR_EMAIL: 'demo@example.com',
        GIT_COMMITTER_NAME: 'Demo User',
        GIT_COMMITTER_EMAIL: 'demo@example.com',
      },
    });
  }
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('log search finds old subjects, authors and hash prefixes beyond the first page', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const oldHash = git(dir, 'log', '--format=%H', '--grep=needle-old');

  const bySubject = await gitLogSearch(dir, 'needle-old', 200);
  assert.deepEqual(
    bySubject.commits.map((commit) => commit.subject),
    ['needle-old commit'],
  );
  assert.equal(bySubject.truncated, false);

  const byAuthor = await gitLogSearch(dir, 'Needle Author', 200);
  assert.deepEqual(
    byAuthor.commits.map((commit) => commit.subject),
    ['filler commit 9'],
  );

  const byHash = await gitLogSearch(dir, oldHash.slice(0, 8), 200);
  assert.deepEqual(
    byHash.commits.map((commit) => commit.subject),
    ['needle-old commit'],
  );
});

test('log search respects the separate author filter', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const filtered = await gitLogSearch(dir, 'filler', 200, 'Needle Author');
  assert.deepEqual(
    filtered.commits.map((commit) => commit.subject),
    ['filler commit 9'],
  );
  const subjectWithBroadAuthor = await gitLogSearch(dir, 'needle-old', 200, 'Demo User');
  assert.deepEqual(
    subjectWithBroadAuthor.commits.map((commit) => commit.subject),
    ['needle-old commit'],
  );
});
