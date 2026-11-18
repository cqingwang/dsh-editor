import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('test files use module-feature names instead of round numbers', async () => {
  const entries = await readdir(new URL('tests/', root), { recursive: true });
  const tests = entries
    .filter((name) => typeof name === 'string' && name.endsWith('.test.mjs'))
    .map((name) => (name.includes('/') ? name.slice(name.lastIndexOf('/') + 1) : name));
  const roundFiles = tests.filter((name) => /round\d+/iu.test(name));
  const improperlyNamed = tests.filter(
    (name) =>
      !/^(?:commit|project|terminal|search|editor|plugin|i18n|file|git|client|static)-[a-z0-9]+(?:-[a-z0-9]+)*\.test\.mjs$/u.test(
        name,
      ),
  );
  const moduleFiles = tests.filter((name) =>
    /^(?:commit|project|terminal|search|editor|plugin|i18n|file|git|client|static)-/u.test(name),
  );

  assert.deepEqual(roundFiles, []);
  assert.deepEqual(improperlyNamed, []);
  assert.ok(moduleFiles.length >= 840, `expected the migrated suite, found ${moduleFiles.length} module tests`);
});
