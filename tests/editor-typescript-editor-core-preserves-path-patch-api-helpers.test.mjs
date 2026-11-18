import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const editorCore = await read('src/client/editor-core.ts');
const compilerOptions = JSON.parse(await read('tsconfig.client.json')).compilerOptions;
const helpers = loadTypeScriptModule(editorCore, [
  'abbreviatePath',
  'ancestorsOf',
  'basename',
  'commitPatchDownloadName',
  'configureMonacoLanguageDiagnostics',
  'fileApiMissingOperation',
  'patchDownloadName',
  'prefetchDirectorySubtrees',
  'remapPathAfterMove',
  'searchTextFailureMessage',
  'splitRootLabel',
]);

test('TypeScript editor-core preserves path, patch and API helpers', () => {
  assert.equal(helpers.basename('src/nested/app.ts'), 'app.ts');
  assert.equal(helpers.basename('README.md'), 'README.md');
  assert.deepEqual(helpers.ancestorsOf('src/nested/app.ts'), ['src', 'src/nested']);
  assert.deepEqual(helpers.ancestorsOf(''), []);
  assert.equal(helpers.abbreviatePath('/Users/chan/project', '/Users/chan'), '~/project');
  assert.deepEqual(helpers.splitRootLabel('/Users/chan/project/', '/Users/chan'), {
    name: 'project',
    path: '~/project/',
  });
  assert.equal(helpers.remapPathAfterMove('src/old/app.ts', [['src/old', 'src/new']]), 'src/new/app.ts');
  assert.equal(helpers.remapPathAfterMove('src/app.ts', [['src/old', 'src/new']]), 'src/app.ts');
  assert.equal(
    helpers.commitPatchDownloadName('abcdef1234567890', 'fix: keep / safe?'),
    'dsh-editor-abcdef1-fix-keep-safe.patch',
  );
  assert.match(
    helpers.patchDownloadName(new Date(2026, 0, 2, 3, 4, 5)),
    /^dsh-editor-changes-20260102-030405\.patch$/u,
  );
  assert.equal(
    helpers.fileApiMissingOperation({ ok: false, error: { message: 'unknown operation "searchText"' } }, 'searchText'),
    true,
  );
  assert.equal(
    helpers.fileApiMissingOperation({ ok: false, error: { message: 'unknown operation "write"' } }, 'searchText'),
    false,
  );
  assert.equal(
    helpers.searchTextFailureMessage(new Error('unknown operation "searchText"'), (key) => key),
    'editor.searchTextServiceUnavailable',
  );
});

test('TypeScript editor-core prefetch stays bounded and does not expand descendants', async () => {
  const listings = {
    src: [
      { path: 'src/lib', kind: 'directory' },
      { path: 'src/app.ts', kind: 'file' },
    ],
    'src/lib': [{ path: 'src/lib/core.ts', kind: 'file' }],
  };
  const calls = [];
  const result = await helpers.prefetchDirectorySubtrees(
    ['src'],
    { children: {} },
    async (path) => {
      calls.push(path);
      return listings[path] ?? [];
    },
    200,
    1,
  );
  assert.deepEqual(calls, ['src']);
  assert.deepEqual(Object.keys(result.children), ['src']);
  assert.equal('expanded' in result, false);
  assert.equal(result.visited, 1);
  assert.equal(result.truncated, false);
});

test('TypeScript editor-core configures Monaco diagnostics without removing syntax checks', () => {
  const calls = [];
  const defaults = {
    setDiagnosticsOptions: (value) => calls.push(['diagnostics', value]),
    setCompilerOptions: (value) => calls.push(['compiler', value]),
  };
  const monaco = {
    languages: {
      typescript: {
        ModuleResolutionKind: { NodeJs: 2 },
        ModuleKind: { ESNext: 99 },
        ScriptTarget: { ESNext: 99 },
        JsxEmit: { ReactJSX: 4 },
        typescriptDefaults: defaults,
        javascriptDefaults: defaults,
      },
    },
  };
  assert.equal(helpers.configureMonacoLanguageDiagnostics(monaco, compilerOptions), true);
  assert.equal(
    calls.some(
      ([kind, value]) =>
        kind === 'diagnostics' && value.noSyntaxValidation === false && value.diagnosticCodesToIgnore.includes(2307),
    ),
    true,
  );
  const compiler = calls.find(([kind]) => kind === 'compiler')?.[1];
  assert.equal(compiler.jsx, 4);
  assert.equal(compiler.jsxImportSource, 'react');
  assert.equal(compiler.target, 99);
  assert.equal('lib' in compiler, false);
  assert.equal(compiler.downlevelIteration, true);
  assert.equal(helpers.configureMonacoLanguageDiagnostics({ languages: {} }), false);
});
