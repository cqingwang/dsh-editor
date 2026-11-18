import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('round-numbered test files are retired in favour of module prefixes', async () => {
  const tests = (await readdir(new URL('tests/', root))).filter((name) => name.endsWith('.test.mjs'));
  const roundFiles = tests.filter((name) => /^round\d+[a-z]*\.test\.mjs$/u.test(name));
  const moduleFiles = tests.filter((name) =>
    /^(?:commit|project|terminal|search|editor|plugin|i18n)-/u.test(name),
  );

  assert.deepEqual(roundFiles, []);
  assert.ok(moduleFiles.length >= 800, `expected the migrated suite, found ${moduleFiles.length} module tests`);
});
