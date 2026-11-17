import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const partsDir = join(root, 'src', 'client');
const moduleOrder = [
  'foundation.js',
  'locales.js',
  'domain-core.js',
  'code-navigation.js',
  'inline-styles.js',
  'editor-core.js',
  'ui-primitives.js',
  'project.js',
  'menu.js',
  'diff.js',
  'commit.js',
  'search-everywhere.js',
  'find-tool.js',
  'terminal.js',
  'editor-workspace.js',
  'injected-css.js',
  'controller.js',
];

test('The browser client source is split into ordered business modules', async () => {
  const files = (await readdir(partsDir)).filter((name) => name.endsWith('.js')).sort();
  assert.deepEqual(files, [...moduleOrder].sort());
  for (const name of moduleOrder) {
    assert.doesNotMatch(name, /^\d+-/u, `${name} must not use a numeric filename prefix`);
    const source = await readFile(join(partsDir, name), 'utf8');
    assert.doesNotMatch(source, /^\s*(?:import|export)\s/mu, `${name} must stay inside the factory scope`);
    assert.ok(source.trim().length > 0, `${name} must not be empty`);
  }
});

test('The generated client contains every business module in order', async () => {
  const client = await readFile(join(root, 'lib', 'client.js'), 'utf8');
  const positions = moduleOrder.map((name) => client.indexOf(`/* ─────────────────────── ${name} ─────────────────────── */`));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(positions, [...positions].sort((left, right) => left - right));
  assert.match(client, /^window\.__ModuleLoader__\.load\(\{/u);
  assert.match(client, /factory: \(require\) => \{/u);
});

test('lib/client.js is generated from the current modules', () => {
  const output = execFileSync(process.execPath, ['scripts/build-client.mjs', '--check'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.match(output, /17 modules verified/);
});

test('Every source module remains reviewable instead of regrowing one monolith', async () => {
  for (const name of moduleOrder) {
    const source = await readFile(join(partsDir, name), 'utf8');
    const lineCount = source.split('\n').length;
    assert.ok(lineCount <= 11000, `${name} has ${lineCount} lines`);
  }
});
