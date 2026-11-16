import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { gitGraph } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

/** Two branches whose tips are distinct commits on `main`. */
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r45-'));
  execFileSync('git', ['-C', dir, 'init', '-q', '-b', 'main']);
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@example.com']);
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'Test']);
  await writeFile(join(dir, 'a.txt'), '1\n');
  execFileSync('git', ['-C', dir, 'add', '.']);
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'root commit']);
  execFileSync('git', ['-C', dir, 'checkout', '-qb', 'feature']);
  await writeFile(join(dir, 'b.txt'), '2\n');
  execFileSync('git', ['-C', dir, 'add', '.']);
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'feature work']);
  execFileSync('git', ['-C', dir, 'checkout', '-q', 'main']);
  await writeFile(join(dir, 'c.txt'), '3\n');
  execFileSync('git', ['-C', dir, 'add', '.']);
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'main work']);
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('a branch filter walks only that branch but keeps every branch choice', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const all = await gitGraph(dir, { limit: 50 });
  assert.deepEqual(all.entries.map((entry) => entry.subject).sort(), ['feature work', 'main work', 'root commit']);
  assert.deepEqual(all.branchList.sort(), ['feature', 'main']);
  assert.equal(all.branch, null);

  const feature = await gitGraph(dir, { limit: 50, branch: 'feature' });
  assert.deepEqual(feature.entries.map((entry) => entry.subject), ['feature work', 'root commit']);
  assert.equal(feature.branch, 'feature');
  /* The dropdown must still offer `main`; after filtering, the decorations no
     longer mention it and the user could not switch back. */
  assert.deepEqual(feature.branchList.sort(), ['feature', 'main']);
  assert.equal(feature.entries.some((entry) => entry.subject === 'main work'), false);
});

test('the graph marks the checked-out commit so HEAD is distinguishable', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const graph = await gitGraph(dir, { limit: 50 });
  const headCommit = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  assert.equal(graph.head, headCommit);
  const mainWork = graph.entries.find((entry) => entry.subject === 'main work');
  assert.equal(mainWork.hash, headCommit);
});

test('a branch name that git does not know is rejected, not passed as an option', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await assert.rejects(() => gitGraph(dir, { limit: 20, branch: '--orphan=x' }), /unknown branch/);
  await assert.rejects(() => gitGraph(dir, { limit: 20, branch: 'nope' }), /unknown branch/);
  /* An empty filter means "all refs", which is the unfiltered view. */
  const unfiltered = await gitGraph(dir, { limit: 20, branch: '   ' });
  assert.equal(unfiltered.branch, null);
  assert.equal(unfiltered.entries.length, 3);
});

test('the graph toolbar exposes a branch picker and HEAD badge', () => {
  const client = read('lib/client.js');
  assert.match(client, /t\('editor\.graphBranch'\)/);
  assert.match(client, /t\('editor\.graphAllBranches'\)/);
  assert.match(client, /onChange: \(event\) => onGraphBranch\?\.\(event\.target\.value\)/);
  assert.match(client, /isHead \? React\.createElement\('span', \{ style: styles\.commitGraphHead, key: 'HEAD' \}, 'HEAD'\)/);
  /* The filtered empty state must not look like "this repo has no commits". */
  assert.match(client, /t\('editor\.graphNoCommitsOnBranch'\)/);
});

test('the graph rows are reachable with the keyboard', () => {
  const client = read('lib/client.js');
  assert.match(client, /const moveGraphCursor = \(delta, shiftKey = false\) => \{/);
  assert.match(client, /onKeyDown: graphMode/);
  assert.match(client, /if \(event\.key === 'ArrowDown' \|\| event\.key === 'ArrowUp'\)/);
  assert.match(client, /onShow\?\.\(graphRows\[graphIndex\]\.hash\)/);
  /* The active row scrolls itself into view; a keyboard cursor off-screen is useless. */
  assert.match(client, /ref: active \? scrollGraphRowIntoView : null/);
  /* A hovered row wins over the cursor so the two never fight over the highlight. */
  assert.match(client, /selected: graphHover \?\? graphCursor/);
  /* Moving by keyboard takes the highlight away from the pointer, and leaving the
     list drops the hover: otherwise the two fight and the cursor looks stuck. */
  assert.match(client, /setGraphHover\(null\);\n\s+setGraphCursor\(graphRows\[clamped\]\.hash\);/);
  assert.match(client, /onMouseLeave: \(\) => onSelect\?\.\(null\)/);
  /* The first arrow key continues from the hovered row, not from the top. */
  assert.match(client, /const hoverIndex = graphHover === null \? -1 : graphRows\.findIndex/);
});
