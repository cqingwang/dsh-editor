import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const source = await readFile(new URL('../src/client/code-navigation.ts', import.meta.url), 'utf8');
const navigation = loadTypeScriptModule(source, [
  'definitionImportTarget',
  'definitionModuleCandidates',
  'findDefinitionInText',
  'navigationHistoryRecord',
  'navigationHistoryStep',
  'navigationPathForModel',
  'resolveWorkspaceDefinition',
]);

test('TypeScript code-navigation module keeps import and URI behavior', () => {
  assert.deepEqual(
    navigation.definitionImportTarget(
      "import { TerminalHub, encodeSse as encode } from './terminal.js';\n",
      'encode',
    ),
    {
      kind: 'named',
      importedName: 'encodeSse',
      specifier: './terminal.js',
      language: 'javascript',
    },
  );
  assert.deepEqual(
    navigation.definitionModuleCandidates('lib/index.js', './terminal.js', 'javascript'),
    ['lib/terminal.js'],
  );
  assert.equal(
    navigation.navigationPathForModel({ uri: { path: '/src/with%20space/main.js' } }),
    'src/with space/main.js',
  );
});

test('TypeScript code-navigation module keeps history and declaration behavior', async () => {
  const origin = { path: './src/index.js', line: 4, column: 10 };
  const target = { path: 'src/terminal.js', line: 2, column: 14 };
  const history = navigation.navigationHistoryRecord({ back: [], forward: [] }, origin);
  const back = navigation.navigationHistoryStep(history, target, 'back');
  assert.deepEqual(back.target, { path: 'src/index.js', line: 4, column: 10 });
  assert.deepEqual(back.history.forward, [target]);

  assert.deepEqual(
    navigation.findDefinitionInText(
      'export class TerminalHub {}\nexport function encodeSse() {}\n',
      'encodeSse',
      'terminal.ts',
    ),
    {
      path: 'terminal.ts',
      line: 2,
      column: 17,
      endColumn: 26,
    },
  );

  const definition = await navigation.resolveWorkspaceDefinition({
    path: 'lib/index.js',
    content: "import { TerminalHub } from './terminal.js';\nTerminalHub();\n",
    symbol: 'TerminalHub',
    readFile: async (path) => (path === 'lib/terminal.js' ? 'export class TerminalHub {}\n' : null),
  });
  assert.deepEqual(definition, {
    path: 'lib/terminal.js',
    line: 1,
    column: 14,
    endColumn: 25,
  });
});

test('code-navigation.js is deleted from source and frozen as a test oracle', async () => {
  const build = await readFile(new URL('../scripts/build-client.mjs', import.meta.url), 'utf8');
  const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

  assert.equal(existsSync(new URL('../src/client/code-navigation.js', import.meta.url)), false);
  assert.equal(existsSync(new URL('../tests/fixtures/legacy/code-navigation.legacy.js', import.meta.url)), true);
  assert.match(build, /'code-navigation\.ts'/u);
  assert.doesNotMatch(build, /'code-navigation\.js'/u);
  assert.match(client, /\/\* ─────────────────────── code-navigation\.ts ─────────────────────── \*\//u);
  assert.doesNotMatch(client, /\/\* ─────────────────────── code-navigation\.js ─────────────────────── \*\//u);
  assert.equal(existsSync(new URL('../src/client/code-navigation.js.bak', import.meta.url)), false);
});
