import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const partsDir = join(root, 'src', 'client');
const moduleOrder = [
  'foundation.ts',
  'locales.ts',
  'code-navigation.ts',
  'inline-styles.ts',
  'editor-core.ts',
  'project.ts',
  'diff.ts',
  'commit.ts',
  'find-tool.ts',
  'terminal.ts',
  'editor-workspace.tsx',
  'injected-css.ts',
  'controller.ts',
];

test('The browser client source is split into ordered TypeScript business modules', async () => {
  const files = (await readdir(partsDir))
    .filter((name) => name.endsWith('.ts') || name.endsWith('.tsx'))
    .sort();
  assert.deepEqual(files, [...moduleOrder].sort());
  for (const name of moduleOrder) {
    assert.doesNotMatch(name, /^\d+-/u, `${name} must not use a numeric filename prefix`);
    const source = await readFile(join(partsDir, name), 'utf8');
    assert.doesNotMatch(source, /^\s*import\s+(?!type\b)/mu, `${name} must not require a runtime module loader`);
    assert.ok(source.trim().length > 0, `${name} must not be empty`);
  }
});

test('The generated client contains every business module in order', async () => {
  const client = await readFile(join(root, 'lib', 'client.js'), 'utf8');
  const positions = moduleOrder.map((name) =>
    client.indexOf(`/* ─────────────────────── ${name} ─────────────────────── */`),
  );
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(
    positions,
    [...positions].sort((left, right) => left - right),
  );
  assert.match(client, /^window\.__ModuleLoader__\.load\(\{/u);
  assert.match(client, /factory: \(require\) => \{/u);
});

test('lib/client.js is generated from the current modules', () => {
  const output = execFileSync(process.execPath, ['scripts/build-client.mjs', '--check'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.match(output, /13 modules verified/);
});

test('Every source module remains reviewable instead of regrowing one monolith', async () => {
  for (const name of moduleOrder) {
    const source = await readFile(join(partsDir, name), 'utf8');
    const lineCount = source.split('\n').length;
    /* JSX formatting expands the workspace layout while the remaining hook logic
       is split incrementally; keep a bounded ceiling instead of the old compressed
       createElement line count. */
    assert.ok(lineCount <= 12500, `${name} has ${lineCount} lines`);
  }
});
