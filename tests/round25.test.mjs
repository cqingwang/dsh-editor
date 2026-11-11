import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { gitDiffWithRevision } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

/** Two commits on one file, then a divergent working copy. */
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r25-'));
  execFileSync('git', ['-C', dir, 'init', '-q', '-b', 'main']);
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@example.com']);
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'Test']);
  await writeFile(join(dir, 'a.txt'), 'v1\n');
  execFileSync('git', ['-C', dir, 'add', '.']);
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'v1']);
  await writeFile(join(dir, 'a.txt'), 'v2\n');
  execFileSync('git', ['-C', dir, 'commit', '-qam', 'v2']);
  await writeFile(join(dir, 'a.txt'), 'working\n');
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('compare-with-revision shows the revision against the working file', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const head = await gitDiffWithRevision(dir, '', { hash: 'HEAD', path: 'a.txt' });
  /* This is NOT the commit's own change (v1→v2); it is revision → working tree. */
  assert.equal(head.original, 'v2\n');
  assert.equal(head.modified, 'working\n');

  const older = await gitDiffWithRevision(dir, '', { hash: 'HEAD~1', path: 'a.txt' });
  assert.equal(older.original, 'v1\n');
  assert.equal(older.modified, 'working\n');
});

test('a revision lacking the file is refused, not rendered as a deletion', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(dir, 'later.txt'), 'later\n');
  execFileSync('git', ['-C', dir, 'add', '.']);
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'later']);
  await assert.rejects(
    () => gitDiffWithRevision(dir, '', { hash: 'HEAD~2', path: 'later.txt' }),
    /does not contain this file/,
  );
});

test('compare-with-revision validates both the revision and the path', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await assert.rejects(() => gitDiffWithRevision(dir, '', { hash: '--all', path: 'a.txt' }), /invalid commit id/);
  await assert.rejects(() => gitDiffWithRevision(dir, '', { hash: 'HEAD', path: '../x' }), /escapes the workspace/);
  await assert.rejects(() => gitDiffWithRevision(dir, '', { hash: 'HEAD', path: '' }), /a path is required/);
});

test('the diff editor tells revision, commit and clipboard targets apart', () => {
  const client = read('lib/client.js');
  /* Order: clipboard, then revision, then commit, then staged. */
  const clipboardAt = client.indexOf("typeof target.clipboardText === 'string'");
  const revisionAt = client.indexOf("typeof target.revision === 'string'");
  const commitAt = client.indexOf("typeof target.commit === 'string'", revisionAt);
  assert.ok(clipboardAt > 0 && revisionAt > clipboardAt && commitAt > revisionAt);
  assert.match(client, /op: 'diffWithRevision', hash: target\.revision, path: target\.path/);
  assert.match(client, /t\('editor\.compareRevisionMode', \{ hash: target\.revision\.slice\(0, 7\) \}\)/);
});

test('the tree offers compare-with-revision through the commit log, not a free-form hash', () => {
  const client = read('lib/client.js');
  assert.match(client, /id: 'compareRevision',/);
  assert.match(client, /const compareWithRevision = React\.useCallback\(async \(path\) => \{/);
  /* A picker avoids turning a typo into an "invalid commit id" after two round trips.
     Round 49 replaced the 20-row submenu with a searchable dialog, so the page is
     larger — the point (choose from real commits, never type a hash) is unchanged. */
  assert.match(client, /const value = await callGit\(\{ op: 'log', limit: 100 \}\);/);
  assert.match(client, /if \(typeof hash === 'string' && hash !== ''\) setDiffTarget\(\{ path, revision: hash, staged: false \}\)/);
});

test('terminal tabs are remembered per session and rebuilt after a host restart', () => {
  const client = read('lib/client.js');
  assert.match(client, /function readTerminalProfile\(\) \{/);
  assert.match(client, /dsh-editor\.terminal\.profile:\$\{currentSessionId\(\)\}/);
  /* The remembered JSON is untrusted local state: malformed entries are dropped. */
  assert.match(client, /\.filter\(\(entry\) => entry !== null && typeof entry === 'object' && typeof entry\.shell === 'string' && entry\.shell !== ''\)/);
  assert.match(client, /const restoreTerminals = React\.useCallback\(/);
  /* A shell that no longer exists falls back to the default instead of aborting. */
  assert.match(client, /const created = await createTerminal\(exists \? entry\.shell : undefined\);/);
  assert.match(client, /if \(remembered\.length > 0\) \{\n\s+void restoreTerminals\(remembered\);/);
});
