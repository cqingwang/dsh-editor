import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { gitBlame, parseBlamePorcelain } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

/** A file whose lines come from two different commits and authors. */
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r44-'));
  execFileSync('git', ['-C', dir, 'init', '-q', '-b', 'main']);
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'alice@example.com']);
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'Alice']);
  await writeFile(join(dir, 'a.txt'), 'line1\nline2\n');
  execFileSync('git', ['-C', dir, 'add', '.']);
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'first commit']);
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'Bob']);
  await writeFile(join(dir, 'a.txt'), 'line1\nline2\nline3\n');
  execFileSync('git', ['-C', dir, 'commit', '-qam', 'second commit']);
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('blame attributes each line to the commit that introduced it', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const value = await gitBlame(dir, { path: 'a.txt' });
  assert.deepEqual(value.lines.map((row) => [row.line, row.author]), [[1, 'Alice'], [2, 'Alice'], [3, 'Bob']]);
  assert.deepEqual(value.lines.map((row) => row.summary), ['first commit', 'first commit', 'second commit']);
  assert.equal(value.truncated, false);
  /* The date is an ISO instant so the panel can format it consistently. */
  assert.match(value.lines[0].date, /^\d{4}-\d{2}-\d{2}T/u);
});

test('blame windows the request and reports truncation', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const single = await gitBlame(dir, { path: 'a.txt', startLine: 3, endLine: 3 });
  assert.deepEqual(single.lines.map((row) => row.line), [3]);
  assert.equal(single.truncated, false);

  /* Beyond one window the host clamps instead of streaming the whole file. */
  const wide = await gitBlame(dir, { path: 'a.txt', startLine: 1, endLine: 5000 });
  assert.equal(wide.truncated, true);
  assert.ok(wide.lines.length <= 200);
});

test('blame refuses an empty or escaping path', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await assert.rejects(() => gitBlame(dir, { path: '' }), /a path is required/);
  await assert.rejects(() => gitBlame(dir, { path: '../outside.txt' }), /escapes the workspace/);
});

test('the porcelain parser carries metadata forward for repeated commits', () => {
  /* git emits the author block once per commit; later lines repeat only the header. */
  const output = [
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 1 1 1',
    'author Alice',
    'author-time 1700000000',
    'summary first commit',
    '\tline one',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 2 2 1',
    '\tline two',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb 3 3 1',
    'author Bob',
    'author-time 1700000100',
    'summary second commit',
    '\tline three',
  ].join('\n');
  const rows = parseBlamePorcelain(output);
  assert.deepEqual(rows.map((row) => [row.line, row.author, row.summary]), [
    [1, 'Alice', 'first commit'],
    [2, 'Alice', 'first commit'],
    [3, 'Bob', 'second commit'],
  ]);
  /* A truncated answer must not throw; unknown lines are skipped. */
  assert.deepEqual(parseBlamePorcelain(''), []);
  assert.deepEqual(parseBlamePorcelain('garbage'), []);
});

test('annotate replaces the editor area and the diff closes it', () => {
  const client = read('lib/client.js');
  assert.match(client, /function AnnotatePreview\(\{ t, target, lines, loading, truncated, onClose, onOpenCommit, selected \}\)/);
  assert.match(client, /const toggleAnnotate = React\.useCallback\(async \(\) => \{/);
  /* Annotate and diff both take the editor area, so only one may be open. */
  assert.match(client, /setDiffTarget\(null\);\n\s+setAnnotateTarget\(\{ path \}\);/);
  /* The shared file-surface flag hides both editor groups for diff/annotate/terminal. */
  assert.match(client, /const fileSurfaceVisible = \(activeFile !== null \|\| splitFile !== null\)[\s\S]*?diffOpen === false[\s\S]*?annotateTarget === null[\s\S]*?editorTerminals\.length === 0/);
  assert.match(client, /display: fileSurfaceVisible \? 'flex' : 'none'/);
  assert.match(client, /t\('editor\.annotateTruncated'\)/);
});
