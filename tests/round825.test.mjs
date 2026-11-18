import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('CommitGraph is a reusable TSX commit component', async () => {
  const component = await read('src/client/components/commit/CommitGraph.tsx');
  const row = await read('src/client/components/commit/CommitGraphRow.tsx');

  assert.match(component, /export interface CommitGraphProps/u);
  assert.match(component, /function CommitGraphView\(/u);
  assert.match(component, /import \{ CommitGraphRow \} from '\.\/CommitGraphRow'/u);
  assert.match(component, /<CommitGraphRow/u);
  assert.match(row, /data-dsh-graph-hash=\{entry\.hash\}/u);
  assert.match(row, /aria-haspopup='menu'/u);
  assert.match(component, /const CommitGraph = CommitGraphView;/u);
  assert.match(component, /export \{ CommitGraph \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
  assert.match(component, /return \(\n    <div\n      style=\{styles\.commitGraph\}/u);
});

test('build embeds CommitGraph and removes the legacy definition', async () => {
  const build = await read('scripts/build-client.mjs');
  const legacy = await read('src/client/find-tool.ts');
  const fixture = await read('tests/fixtures/commit-graph.legacy.js');
  const client = await read('lib/client.js');

  assert.match(build, /CommitGraph\.tsx/u);
  assert.match(build, /CommitGraphRow\.tsx/u);
  assert.match(build, /commitGraphRowModule/u);
  assert.match(build, /commitGraphModule/u);
  assert.doesNotMatch(legacy, /function CommitGraph\(/u);
  assert.match(fixture, /function CommitGraph\(/u);
  assert.match(client, /function CommitGraphView\(/u);
  assert.match(client, /function CommitGraphRow\(/u);
  assert.doesNotMatch(client, /function CommitGraph\(/u);
  assert.match(client, /React\.createElement\(CommitGraph/);
});

test('CommitGraph fixture has a stable boundary', async () => {
  const fixture = await read('tests/fixtures/commit-graph.legacy.js');
  const start = fixture.indexOf('function CommitGraph(');
  const boundary = fixture.indexOf('/* COMMIT_GRAPH_BOUNDARY */');

  assert.ok(start >= 0);
  assert.ok(boundary > start);
});
