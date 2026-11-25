import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptCallback } from './ts-source.mjs';
import { loadTypeScriptFunction } from './ts-source.mjs';

import { gitGraph } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = [
  readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8'),
  readFileSync(join(root, 'src/client/components/commit/CommitLog.tsx'), 'utf8'),
  readFileSync(join(root, 'src/client/components/diff/AnnotatePreview.tsx'), 'utf8'),
  readFileSync(join(root, 'src/client/components/commit/CommitGraphRow.tsx'), 'utf8'),
  readFileSync(join(root, 'src/client/components/commit/CommitLogFlatRow.tsx'), 'utf8'),
  readFileSync(join(root, 'src/client/find-tool.ts'), 'utf8'),
].join('\n');
const read = (path) => readFileSync(join(root, path), 'utf8');

/** Three linear commits plus an annotated and a lightweight tag. */
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r46-'));
  const git = (...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim();
  execFileSync('git', ['-C', dir, 'init', '-q', '-b', 'main']);
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  for (const name of ['one', 'two', 'three']) {
    await writeFile(join(dir, `${name}.txt`), `${name}\n`);
    git('add', '.');
    git('commit', '-qm', `commit ${name}`);
  }
  const second = git('rev-parse', 'HEAD~1');
  git('tag', '-a', 'v1', '-m', 'release one', second);
  git('tag', 'light', 'HEAD');
  return { dir, second, head: git('rev-parse', 'HEAD'), cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('a tag badge walks the commit the tag points at', async (t) => {
  const { dir, second, head, cleanup } = await fixture();
  t.after(cleanup);
  const all = await gitGraph(dir, { limit: 50 });
  assert.equal(all.at, null);
  assert.deepEqual(all.tagList.map((tag) => tag.name).sort(), ['light', 'v1']);
  /* Annotated tags are peeled; the tag object id is not a commit. */
  assert.equal(all.tagList.find((tag) => tag.name === 'v1').hash, second);
  assert.equal(all.tagList.find((tag) => tag.name === 'light').hash, head);

  const tagged = await gitGraph(dir, { limit: 50, at: second });
  assert.equal(tagged.at, second);
  assert.deepEqual(
    tagged.entries.map((entry) => entry.subject),
    ['commit two', 'commit one'],
  );
  /* Revisions must be full object ids, or a ref name would become an argument. */
  await assert.rejects(() => gitGraph(dir, { limit: 20, at: 'main' }), /bad revision/);
  await assert.rejects(() => gitGraph(dir, { limit: 20, at: '--all' }), /bad revision/);
  await assert.rejects(() => gitGraph(dir, { limit: 20, at: 'HEAD~1' }), /bad revision/);
});

test('a tag scope wins over a branch scope when both arrive', async (t) => {
  const { dir, second, cleanup } = await fixture();
  t.after(cleanup);
  /* The client sends one or the other; if a stale branch value survives a badge
     click, the more specific revision must decide the walk, not the branch. */
  const scoped = await gitGraph(dir, { limit: 50, branch: 'main', at: second });
  assert.equal(scoped.branch, 'main');
  assert.equal(scoped.at, second);
  assert.deepEqual(
    scoped.entries.map((entry) => entry.subject),
    ['commit two', 'commit one'],
  );
});

/** Load the shipping `refScopeOf` so badge semantics are asserted, not strings. */
function loadRefScope() {
  return loadTypeScriptFunction(readFileSync(join(root, 'src/client/find-tool.ts'), 'utf8'), 'refScopeOf');
}

const refScopeOf = loadRefScope();
const graph = {
  branchList: ['main', 'feature/x'],
  tagList: [
    { name: 'v1', hash: 'a'.repeat(40) },
    { name: 'v2', hash: 'b'.repeat(40) },
  ],
};

test('clicking a branch badge filters to that branch', () => {
  assert.deepEqual(refScopeOf('main', graph), { branch: 'main', at: '' });
  assert.deepEqual(refScopeOf('feature/x', graph), { branch: 'feature/x', at: '' });
  /* A remote-tracking badge is not a local branch; IDEA checks out nothing here,
     so the graph stays where it is rather than pretending to filter. */
  assert.deepEqual(refScopeOf('origin/main', graph), { branch: '', at: '' });
});

test('clicking a tag badge scopes the walk to the tagged commit', () => {
  assert.deepEqual(refScopeOf('tag: v1', graph), { branch: '', at: 'a'.repeat(40) });
  /* An unknown tag or an empty badge is a no-op, not an empty scope that would
     silently reload the same view. */
  assert.deepEqual(refScopeOf('tag: nope', graph), { branch: '', at: '' });
  assert.deepEqual(refScopeOf('', graph), { branch: '', at: '' });
  assert.deepEqual(refScopeOf('tag: v1', null), { branch: '', at: '' });
});

test('the graph shows a scope chip and clickable badges', () => {
  const row = read('src/client/components/commit/CommitGraphRow.tsx');
  const toolbar = read('src/client/components/commit/CommitLogToolbar.tsx');
  assert.match(row, /className='dsh-editor-graph-ref'/);
  assert.match(row, /onClick=\{\(event\) => \{[\s\S]*?event\.stopPropagation\(\);[\s\S]*?onPickRef\?\.\(ref\);/);
  assert.match(toolbar, /graphAtChip/);
  assert.match(row, /graphFilterByRef/);
  /* The chip must be dismissible, otherwise a tag scope is a trap. */
  assert.match(toolbar, /onClick=\{\(\) => onGraphBranch\(''\)\}/);
});

test('annotate rows jump into the commit log', async () => {
  const client = read('src/client/editor-workspace.tsx');
  const calls = [];
  const openCommitFromAnnotate = loadTypeScriptCallback(client, 'openCommitFromAnnotate', {
    setActivity: (value) => calls.push(['activity', value]),
    setPanelVisible: (value) => calls.push(['panel', value]),
    switchCommitMode: (value) => calls.push(['mode', value]),
    setHistoryPath: (value) => calls.push(['history', value]),
    loadLog: async () => calls.push(['loadLog']),
    showCommit: async (hash) => calls.push(['showCommit', hash]),
  });
  openCommitFromAnnotate('abcdef0123456789');
  assert.deepEqual(calls, [
    ['activity', 'commit'],
    ['panel', true],
    ['mode', 'log'],
    ['history', null],
    ['loadLog'],
    ['showCommit', 'abcdef0123456789'],
  ]);
});

test('both log views mark the commit the detail pane shows', () => {
  const client = source;
  /* One selection, two renderings: a row picked in either view is marked in both. */
  assert.match(
    client,
    /const \[\s*selectedCommit,\s*setSelectedCommit,?\s*\] = React\.useState<string \| null>\(readStoredCommitSelection\)/,
  );
  assert.match(client, /setSelectedCommit\(hash\);/);
  assert.match(client, /selectionIncluded=\{selectedCommits\.includes\(commit\.hash\)\}/);
  assert.match(client, /aria-selected=\{selectionIncluded\}/);
  assert.match(client, /selected=\{graphHover \?\? graphCursor \?\? selected\}/);
  /* Walking the graph with the keyboard loads the detail pane, like IDEA's log. */
  assert.match(client, /const next = commitLogGraphMove\(graphRows, graphCursor, graphHover, delta\);/);
  assert.match(client, /onShow\?\.\(next\.hash\);/);
});

test('re-opening an open file keeps the Annotate reading mode', () => {
  const client = source;
  const start = client.indexOf('const openFile = React.useCallback(');
  assert.notEqual(start, -1);
  const block = client.slice(start, start + 900);
  /* The early return for an already-open file must not reset annotateTarget. */
  assert.match(block, /if \(existing !== undefined\) \{\n\s+\/\*/);
  assert.equal(/setAnnotateTarget\(null\)/.test(block), false);
  /* Opening a NEW file still takes the surface from the diff: two surfaces cannot
     share the area. The diff TAB survives (Commit: <name>), so it is deactivated
     rather than discarded. */
  assert.match(block, /setDiffActive\(false\);/);
});

test('a double-click cannot open the same file twice', () => {
  const client = source;
  /* Two clicks fire two reads before either resolves; both appends used to land. */
  assert.match(client, /const openingRef\s*=\s*React\.useRef(?:<[^()]*>)?\(new Set\(\)\);/);
  assert.match(client, /if \(existing === undefined && openingRef\.current\.has\(path\)\) \{/);
  assert.match(client, /current\.some\(\(entry\) => entry\.path === path\) \? current : \[file, \.\.\.current\]/);
  assert.match(client, /openingRef\.current\.delete\(path\);/);
});
