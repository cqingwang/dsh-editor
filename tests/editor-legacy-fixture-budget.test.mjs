import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const allowedLegacyFixtures = [];

async function legacyFixtures(path) {
  try {
    return (await readdir(new URL(path, root))).filter((name) => name.endsWith('.legacy.js')).sort();
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

test('legacy JavaScript fixtures stay retired', async () => {
  const topLevel = await legacyFixtures('tests/fixtures/');
  const workspaceOracle = await legacyFixtures('tests/fixtures/legacy/');

  assert.deepEqual(topLevel, allowedLegacyFixtures);
  assert.deepEqual(workspaceOracle, []);
});
