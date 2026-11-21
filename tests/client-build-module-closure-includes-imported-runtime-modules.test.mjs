import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  collectClientModuleClosure,
  findMissingSeparatelyBundledEntries,
  findUnbundledRuntimeModules,
} from '../scripts/client-bundle-closure.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function writeFixtureFile(root, name, content) {
  const path = join(root, name);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}

test('client bundle closure finds imported runtime modules missing their own output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-module-closure-'));
  try {
    await writeFixtureFile(
      root,
      'main.ts',
      ["import { value } from './component';", "import type { Shape } from './types';", 'console.log(value);'].join(
        '\n',
      ),
    );
    await writeFixtureFile(root, 'component.ts', 'export const value = 1;\n');
    await writeFixtureFile(root, 'types.ts', 'export type Shape = { value: number };\n');
    await writeFixtureFile(root, 'ui/index.tsx', "export { Card } from './Card';\n");
    await writeFixtureFile(root, 'ui/Card.tsx', 'export function Card() { return null; }\n');

    const closure = collectClientModuleClosure(root, ['main.ts', 'ui/index.tsx']);
    assert.deepEqual([...closure].sort(), ['component.ts', 'main.ts', 'ui/Card.tsx', 'ui/index.tsx']);

    const missing = findUnbundledRuntimeModules({
      clientDir: root,
      entryModules: ['main.ts', 'ui/index.tsx'],
      includedModules: ['main.ts'],
      separatelyBundledEntries: ['ui/index.tsx'],
    });
    assert.deepEqual(missing, ['component.ts']);

    assert.deepEqual(
      findUnbundledRuntimeModules({
        clientDir: root,
        entryModules: ['main.ts', 'ui/index.tsx'],
        includedModules: ['main.ts', 'component.ts'],
        separatelyBundledEntries: ['ui/index.tsx'],
      }),
      [],
    );
    assert.deepEqual(
      findMissingSeparatelyBundledEntries({
        clientDir: root,
        separatelyBundledEntries: ['ui/missing.tsx'],
      }),
      ['ui/missing.tsx'],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('production client build emits every imported runtime module', async () => {
  const clientDir = join(root, 'src', 'client');
  const entryModules = (await readdir(clientDir))
    .filter((name) => (name.endsWith('.ts') || name.endsWith('.tsx')) && !name.endsWith('.d.ts'))
    .sort();
  const client = await readFile(join(root, 'lib', 'client.js'), 'utf8');
  const emittedModules = [...client.matchAll(/\/\* ─+ ([^\s]+\.(?:ts|tsx)) ─+ \*\//gu)].map((match) => match[1]);
  const buildSource = await readFile(join(root, 'scripts', 'build-client.mjs'), 'utf8');
  assert.match(buildSource, /findUnbundledRuntimeModules/u);
  assert.match(buildSource, /entryPoints: \[separateBundleEntryPath\]/u);
  assert.match(buildSource, /separatelyBundledEntries: \[separateBundleEntryModule\]/u);

  assert.deepEqual(
    findUnbundledRuntimeModules({
      clientDir,
      entryModules,
      includedModules: emittedModules,
      separatelyBundledEntries: ['components/ui/index.tsx'],
    }),
    [],
  );
  assert.deepEqual(
    findMissingSeparatelyBundledEntries({
      clientDir,
      separatelyBundledEntries: ['components/ui/index.tsx'],
    }),
    [],
  );
});

test('production package ships the helper required by the client build', async () => {
  const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  assert.ok(packageJson.files.includes('scripts/client-bundle-closure.mjs'));
});
