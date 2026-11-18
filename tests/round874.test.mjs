import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('editor-workspace uses TSX with its legacy oracle frozen for tests only', async () => {
  const build = await read('scripts/build-client.mjs');
  const client = await read('lib/client.js');
  const workspace = await read('src/client/editor-workspace.tsx');
  const packageJson = JSON.parse(await read('package.json'));

  assert.equal(existsSync(new URL('../src/client/editor-workspace.js', import.meta.url)), false);
  assert.equal(existsSync(new URL('../tests/fixtures/legacy/editor-workspace.legacy.js', import.meta.url)), true);
  assert.match(build, /'editor-workspace\.tsx'/u);
  assert.doesNotMatch(build, /'editor-workspace\.js'/u);
  assert.match(client, /\/\* ─────────────────────── editor-workspace\.tsx ─────────────────────── \*\//u);
  assert.doesNotMatch(client, /\/\* ─────────────────────── editor-workspace\.js ─────────────────────── \*\//u);
  assert.doesNotMatch(workspace, /React\.createElement/u);
  assert.match(workspace, /<EditorWorkspaceShell[\s\S]*?workspaceId=\{workspaceId\}/u);
  assert.match(workspace, /export \{ EditorWorkspace \};/u);
  assert.equal(existsSync(new URL('../src/client/editor-workspace.js.bak', import.meta.url)), false);
});

test('the historical client oracle is test-only and does not enter the build', async () => {
  const build = await read('scripts/build-client.mjs');
  const packageJson = JSON.parse(await read('package.json'));
  const oracle = await read('tests/client-source-oracle.mjs');

  assert.equal(
    packageJson.scripts.test,
    'node --import ./tests/client-source-oracle.mjs --test --test-concurrency=1 "tests/*.test.mjs"',
  );
  assert.match(oracle, /tests\/fixtures\/legacy\/editor-workspace\.legacy\.js/u);
  assert.match(oracle, /productionClientPath/u);
  assert.doesNotMatch(build, /editor-workspace\.js\.bak/u);
});
