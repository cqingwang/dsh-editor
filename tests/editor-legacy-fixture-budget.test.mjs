import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const allowedLegacyFixtures = [];

test('legacy fixture budget cannot grow while tests migrate to TSX boundaries', async () => {
  const topLevel = (await readdir(new URL('tests/fixtures/', root)))
    .filter((name) => name.endsWith('.legacy.js'))
    .sort();
  const workspaceOracle = (await readdir(new URL('tests/fixtures/legacy/', root)))
    .filter((name) => name.endsWith('.legacy.js'))
    .sort();

  assert.deepEqual(topLevel, allowedLegacyFixtures);
  assert.deepEqual(workspaceOracle, ['editor-workspace.legacy.js']);
});
