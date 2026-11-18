import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { gitCombinedDiff, gitShowCommit } from '../lib/index.js';

const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();

async function localComparisonFixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-commit-local-'));
  execFileSync('git', ['-C', dir, 'init', '-q', '-b', 'main']);
  git(dir, 'config', 'user.email', 't@example.com');
  git(dir, 'config', 'user.name', 'T');
  await writeFile(join(dir, 'changed.txt'), 'committed changed\n');
  await writeFile(join(dir, 'deleted.txt'), 'committed deleted\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'compare base');
  const hash = git(dir, 'rev-parse', 'HEAD');
  await writeFile(join(dir, 'changed.txt'), 'newer committed value\n');
  git(dir, 'commit', '-qam', 'newer commit');
  await writeFile(join(dir, 'changed.txt'), 'local changed\n');
  await unlink(join(dir, 'deleted.txt'));
  await writeFile(join(dir, 'unrelated.txt'), 'not in commit\n');
  return { dir, hash, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

test('commitLocalDiffEntries keeps only paths affected by the commit', async (t) => {
  const { dir, hash, cleanup } = await localComparisonFixture();
  t.after(cleanup);
  const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  const fn = new Function(`${extractFunction(client, 'commitLocalDiffEntries')}; return commitLocalDiffEntries;`)();
  const detail = await gitShowCommit(dir, hash);
  const entries = fn(detail, hash);

  assert.deepEqual(entries.map((entry) => entry.path).sort(), ['changed.txt', 'deleted.txt']);
  assert.ok(entries.every((entry) => entry.revision === hash));
  assert.ok(entries.every((entry) => entry.heading.includes('local')));
  assert.equal(entries.some((entry) => entry.path === 'unrelated.txt'), false);
});

test('combined diff can show commit versions against local working files', async (t) => {
  const { dir, hash, cleanup } = await localComparisonFixture();
  t.after(cleanup);
  const detail = await gitShowCommit(dir, hash);
  const value = await gitCombinedDiff(dir, '', {
    entries: [
      { path: 'changed.txt', revision: hash, heading: 'changed.txt · local' },
      { path: 'deleted.txt', revision: hash, heading: 'deleted.txt · local' },
    ],
  });
  const changed = value.files.find((file) => file.path === 'changed.txt');
  const deleted = value.files.find((file) => file.path === 'deleted.txt');

  assert.equal(detail.files.length, 2);
  assert.match(value.original, /committed changed/);
  assert.match(value.modified, /local changed/);
  assert.equal(changed?.missing, false);
  assert.equal(deleted?.missing, true);
  assert.match(value.original, /committed deleted/);
  assert.doesNotMatch(value.modified, /committed deleted/);
  assert.equal(value.combined, true);
  assert.equal(value.files.length, 2);
});

test('Commit Log exposes Compare with Local through the combined diff model', async () => {
  const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  const menuStart = client.indexOf('const buildLogMenu = React.useCallback');
  const menuEnd = client.indexOf('/* Rollback discards edits', menuStart);
  const menu = client.slice(menuStart, menuEnd);
  const actionStart = client.indexOf('const compareCommitWithLocal = React.useCallback');
  const actionEnd = client.indexOf('const createCommitPatch = React.useCallback', actionStart);
  const action = client.slice(actionStart, actionEnd);

  assert.match(menu, /id: 'compareWithLocalCommit'/);
  assert.match(menu, /label: t\('editor\.compareWithLocalCommitAction'\)/);
  assert.match(menu, /void compareCommitWithLocal\(commit\.hash\)/);
  assert.match(action, /callGit\(\{ op: 'show', hash \}\)/);
  assert.match(action, /commitLocalDiffEntries\(detail, hash, t\('editor\.currentVersion'\)\)/);
  assert.match(action, /setDiffTarget\(\{\s*combined: true,\s*entries,\s*commitWithLocal: hash,\s*staged: false,/);
  assert.match(action, /setDiffActive\(true\)/);
  assert.match(client, /compareWithLocalCommitAction: '与本地比较'/);
  assert.match(client, /compareWithLocalCommitAction: 'Compare with Local'/);
  assert.match(client, /commitWithLocal/);
  assert.match(client, /target\?\.combined === true[\s\S]*?typeof target\?\.commitWithLocal === 'string'/);
});
