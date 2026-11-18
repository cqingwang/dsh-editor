import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const controller = await read('src/client/controller.ts');
const mention = new Function(
  'basename',
  `${transpileTypeScriptFunction(controller, 'harnessPathMention')}
return harnessPathMention;`,
)((path) => path.split('/').at(-1) ?? '');
const referencePlan = new Function(
  'basename',
  `${transpileTypeScriptFunction(controller, 'harnessPathMention')}
${transpileTypeScriptFunction(controller, 'harnessReferencePlan')}
return harnessReferencePlan;`,
)((path) => path.split('/').at(-1) ?? '');

test('TypeScript controller preserves Harness mention and reference planning', () => {
  assert.equal(mention('src/app.ts'), '@src/app.ts');
  assert.equal(mention('docs/my file.md'), '@"docs/my file.md"');
  assert.equal(mention('docs', true), '@docs/');
  assert.equal(mention('bad\npath'), '');
  assert.equal(mention(''), '');

  assert.deepEqual(
    referencePlan({
      root: '/workspace/project',
      path: 'src/app.ts',
      line: 3,
      column: 2,
      endLine: 4,
      endColumn: 7,
    }),
    {
      reference: {
        source: 'reference',
        ref: '@src/app.ts',
        label: 'app.ts L3:2-L4:7',
        appearance: 'file',
        clipboardText: '@src/app.ts L3:2-L4:7',
      },
      positionText: 'L3:2-L4:7',
      plainText: '@src/app.ts L3:2-L4:7',
    },
  );
  assert.deepEqual(
    referencePlan({
      root: '/workspace/project',
      path: 'docs',
      isDirectory: true,
    })?.reference.clipboardText,
    '@docs/',
  );
  assert.equal(referencePlan({ path: 'bad\npath' }), null);
});

test('controller.js is deleted from source and frozen as a test oracle', async () => {
  const build = await read('scripts/build-client.mjs');
  const client = await read('lib/client.js');
  const packageJson = JSON.parse(await read('package.json'));

  assert.equal(existsSync(new URL('../src/client/controller.js', import.meta.url)), false);
  assert.equal(existsSync(new URL('../tests/fixtures/legacy/controller.legacy.js', import.meta.url)), true);
  assert.match(build, /'controller\.ts'/u);
  assert.doesNotMatch(build, /'controller\.js'/u);
  assert.match(client, /\/\* ─────────────────────── controller\.ts ─────────────────────── \*\//u);
  assert.doesNotMatch(client, /\/\* ─────────────────────── controller\.js ─────────────────────── \*\//u);
  assert.equal(existsSync(new URL('../src/client/controller.js.bak', import.meta.url)), false);
});
