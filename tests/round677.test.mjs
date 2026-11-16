import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));

test('Building the browser client automatically runs the regression suite', () => {
  assert.equal(packageJson.scripts['build:client'], 'node scripts/build-client.mjs');
  assert.equal(packageJson.scripts['postbuild:client'], 'npm test');
  assert.equal(packageJson.scripts.test, 'node --test --test-concurrency=1 "tests/*.test.mjs"');
});
