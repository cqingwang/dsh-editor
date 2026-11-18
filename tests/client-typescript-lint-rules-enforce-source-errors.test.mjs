import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { ESLint } from 'eslint';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function ruleSeverity(value) {
  return Array.isArray(value) ? value[0] : value;
}

test('ESLint keeps unresolved and unused TypeScript symbols as errors', async () => {
  const eslint = new ESLint({ cwd: root });
  const config = await eslint.calculateConfigForFile(join(root, 'src/client/foundation.ts'));
  assert.equal(ruleSeverity(config.rules['no-undef']), 2);
  assert.equal(ruleSeverity(config.rules['@typescript-eslint/no-unused-vars']), 2);
});

test('client TypeScript source does not suppress lint or compiler diagnostics', async () => {
  const sourceFiles = (await readdir(join(root, 'src/client'), { recursive: true }))
    .filter((name) => typeof name === 'string' && (name.endsWith('.ts') || name.endsWith('.tsx')))
    .sort((left, right) => left.localeCompare(right, 'en'));
  const offenders = [];
  for (const name of sourceFiles) {
    const text = await readFile(join(root, 'src/client', name), 'utf8');
    if (/(?:eslint-disable|@ts-ignore|@ts-expect-error|@ts-nocheck)/u.test(text)) offenders.push(name);
  }
  assert.deepEqual(offenders, []);
});

test('business TS/TSX modules do not fake cross-module symbols with ambient declarations', async () => {
  const sourceFiles = (await readdir(join(root, 'src/client'), { recursive: true }))
    .filter(
      (name) =>
        typeof name === 'string' &&
        (name.endsWith('.ts') || name.endsWith('.tsx')) &&
        !name.endsWith('.d.ts'),
    )
    .sort((left, right) => left.localeCompare(right, 'en'));
  const offenders = [];
  for (const name of sourceFiles) {
    const text = await readFile(join(root, 'src/client', name), 'utf8');
    if (/^\s*(?:export\s+)?declare\s+(?:function|const|let|var)\b/mu.test(text)) offenders.push(name);
  }
  assert.deepEqual(offenders, []);
});
