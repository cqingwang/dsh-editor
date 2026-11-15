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

/** A repository with a real branch fork plus a tag. */
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r42-'));
  execFileSync('git', ['-C', dir, 'init', '-q', '-b', 'main']);
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@example.com']);
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'Test']);
  await writeFile(join(dir, 'a.txt'), '1\n');
  execFileSync('git', ['-C', dir, 'add', '.']);
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'root commit']);
  execFileSync('git', ['-C', dir, 'tag', 'v1']);
  execFileSync('git', ['-C', dir, 'checkout', '-qb', 'feature']);
  await writeFile(join(dir, 'b.txt'), '2\n');
  execFileSync('git', ['-C', dir, 'add', '.']);
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'feature work']);
  execFileSync('git', ['-C', dir, 'checkout', '-q', 'main']);
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('the graph reports parents, refs and both branch heads', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const graph = await gitGraph(dir, 20);
  const bySubject = new Map(graph.entries.map((entry) => [entry.subject, entry]));
  assert.equal(bySubject.get('root commit').parents.length, 0);
  assert.equal(bySubject.get('feature work').parents.length, 1);
  /* Both branches are reachable because the walk uses --all. */
  assert.deepEqual(graph.branches, ['feature', 'main']);
  assert.deepEqual(graph.tags, ['tag: v1']);
  /* Plumbing prefixes must be stripped or the badges read like git internals. */
  assert.equal(graph.entries.some((entry) => entry.refs.some((ref) => ref.includes('refs/'))), false);
});

test('the graph is bounded by the requested limit', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const graph = await gitGraph(dir, 1);
  assert.equal(graph.entries.length, 1);
  /* Out-of-range limits are clamped rather than passed through to git. */
  const huge = await gitGraph(dir, 10_000);
  assert.ok(huge.entries.length <= 200);
});

test('the graph survives a repository with no commits', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r42-empty-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  execFileSync('git', ['-C', dir, 'init', '-q', '-b', 'main']);
  const graph = await gitGraph(dir, 20);
  assert.deepEqual(graph.entries, []);
  assert.deepEqual(graph.branches, []);
});

test('the log tab toggles into graph mode and back', () => {
  const client = read('lib/client.js');
  assert.match(client, /function CommitGraph\(\{ t, graph, onShow, selected, onSelect, folded, onToggleFolded, onPickRef, onContextMenu \}\)/);
  assert.match(client, /const \[graphMode, setGraphMode\] = React\.useState\(false\);/);
  assert.match(client, /t\('editor\.logGraph'\)/);
  /* Graph mode replaces the flat list rather than appending to it. */
  assert.match(client, /graphMode\s+\?\s+React\.createElement\(CommitGraph/);
  assert.match(client, /graphMode \? null : visible\.map/);
  /* A merge row is drawn differently from an ordinary one. */
  assert.match(client, /isMerge \? 'graphMerge' : 'graphNode'/);
});

test('the graph loads on demand, not with every log refresh', () => {
  const client = read('lib/client.js');
  assert.match(client, /const loadGraph = React\.useCallback\(async \(branch, at\) => \{/);
  assert.match(client, /op: 'graph', limit: 80, branch: branchValue, at: atValue/);
  /* Toggling on triggers the load; the flat log never does. */
  assert.match(client, /if \(next\) \{\n\s+onLoadGraph\?\.\(graph\?\.branch \?\? '', graph\?\.at \?\? ''\);/);
});
