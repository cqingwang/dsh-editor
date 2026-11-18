import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const partsDir = new URL('src/client/', root);
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

test('production browser modules are TypeScript-only', async () => {
  const names = await readdir(partsDir);
  const recursiveNames = await readdir(partsDir, { recursive: true });
  const shippingModules = names
    .filter((name) => name.endsWith('.js') || name.endsWith('.ts') || name.endsWith('.tsx'))
    .sort();

  assert.deepEqual(shippingModules, [...moduleOrder].sort());
  assert.ok(shippingModules.every((name) => name.endsWith('.ts') || name.endsWith('.tsx')));
  assert.equal(names.some((name) => name.endsWith('.js')), false);
  assert.equal(recursiveNames.some((name) => name.endsWith('.js.bak')), false);
});

test('the build refuses retired JavaScript modules instead of merging them silently', async () => {
  const build = await read('scripts/build-client.mjs');

  assert.match(build, /legacy JavaScript modules are retired/u);
  assert.doesNotMatch(build, /rename to \.js\.bak/u);
  assert.match(build, /endsWith\('\.ts'\) \|\| name\.endsWith\('\.tsx'\)/u);
  assert.doesNotMatch(
    build,
    /filter\(\(name\) => name\.endsWith\('\.js'\) \|\| name\.endsWith\('\.ts'\) \|\| name\.endsWith\('\.tsx'\)\)/u,
  );
  assert.doesNotMatch(build, /if \(!name\.endsWith\('\.ts'\) && !name\.endsWith\('\.tsx'\)\) return source/u);
});

test('the generated factory contains only the TypeScript module manifest', async () => {
  const client = await read('lib/client.js');
  const markers = [...client.matchAll(/\/\* ─────────────────────── ([^*]+) ─────────────────────── \*\//gu)]
    .map((match) => match[1])
    .filter((name) => name.startsWith('components/') === false && name.includes('/') === false);

  assert.deepEqual(markers.slice(0, moduleOrder.length), moduleOrder);
  assert.ok(markers.every((name) => name.endsWith('.ts') || name.endsWith('.tsx')));
});

test('legacy JavaScript backups are deleted from source and npm packaging', async () => {
  const packageJson = JSON.parse(await read('package.json'));
  const readme = await read('README.md');

  assert.equal(packageJson.files.some((entry) => entry.includes('.js.bak')), false);
  assert.equal(existsSync(new URL('src/client/foundation.js.bak', root)), false);
  assert.doesNotMatch(readme, /\.js\.bak/u);
  assert.doesNotMatch(readme, /浏览器半尚未迁移的 legacy/u);
  assert.doesNotMatch(readme, /尚未迁移的 legacy 业务模块/u);
});
