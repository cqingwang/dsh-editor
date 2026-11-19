import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction, transpileTypeScriptFunction } from './ts-source.mjs';

const source = await readFile(new URL('../src/client/editor-core.ts', import.meta.url), 'utf8');
const compilerOptions = JSON.parse(
  await readFile(new URL('../tsconfig.client.json', import.meta.url), 'utf8'),
).compilerOptions;
const configureMonacoLanguageDiagnostics = loadTypeScriptFunction(source, 'configureMonacoLanguageDiagnostics');

test('TypeScript module-not-found false positives are targeted without disabling semantics', () => {
  const calls = [];
  const defaults = (kind) => ({
    setDiagnosticsOptions: (options) => calls.push({ kind, type: 'diagnostics', options }),
    setCompilerOptions: (options) => calls.push({ kind, type: 'compiler', options }),
  });
  const monaco = {
    languages: {
      typescript: {
        ModuleResolutionKind: { NodeJs: 2 },
        ModuleKind: { ESNext: 99 },
        ScriptTarget: { ESNext: 99 },
        JsxEmit: { ReactJSX: 4 },
        typescriptDefaults: defaults('typescript'),
        javascriptDefaults: defaults('javascript'),
      },
    },
  };
  assert.equal(configureMonacoLanguageDiagnostics(monaco, compilerOptions), true);
  for (const kind of ['typescript', 'javascript']) {
    const diagnostics = calls.find((entry) => entry.kind === kind && entry.type === 'diagnostics');
    assert.deepEqual(diagnostics.options.diagnosticCodesToIgnore, [2307, 2792]);
    assert.equal(diagnostics.options.noSuggestionDiagnostics, true);
    assert.notEqual(diagnostics.options.noSemanticValidation, true);
    assert.notEqual(diagnostics.options.noSyntaxValidation, true);
    const compiler = calls.find((entry) => entry.kind === kind && entry.type === 'compiler');
    assert.equal(compiler.options.moduleResolution, 2);
    assert.equal(compiler.options.module, 99);
    assert.equal(compiler.options.target, 99);
    assert.equal('lib' in compiler.options, false);
    assert.equal(compiler.options.jsx, 4);
    assert.equal(compiler.options.jsxImportSource, 'react');
    assert.equal(compiler.options.downlevelIteration, true);
  }
});

test('the build injects the same TypeScript options read from tsconfig.client.json', async () => {
  const bundle = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  const injected = {
    target: compilerOptions.target,
    jsx: compilerOptions.jsx,
    jsxImportSource: compilerOptions.jsxImportSource,
    downlevelIteration: compilerOptions.downlevelIteration,
    allowSyntheticDefaultImports: compilerOptions.allowSyntheticDefaultImports,
    resolveJsonModule: compilerOptions.resolveJsonModule,
  };
  assert.ok(bundle.includes(`globalThis.__dshEditorTypeScriptConfig = ${JSON.stringify(injected)};`));
});

test('Monaco loader waits for the TypeScript contribution before resolving', () => {
  const loader = source.slice(
    source.indexOf('function loadMonaco()'),
    source.indexOf('/** The label and color used by one file-type badge. */'),
  );
  assert.match(loader, /configureMonacoLanguageWhenReady\(window\.monaco\)/);
  assert.doesNotMatch(loader, /'vs\/language\/typescript\/tsMode'/);
  assert.ok(
    loader.indexOf('configureMonacoLanguageWhenReady(window.monaco)') < loader.indexOf('resolve(window.monaco)'),
  );
});

test('Monaco configuration retries until the TS language service is available', async () => {
  const configureWhenReady = new Function(
    'window',
    'ensureIdeaLightSemanticTokens',
    `${transpileTypeScriptFunction(source, 'configureMonacoLanguageDiagnostics')}
     ${transpileTypeScriptFunction(source, 'configureMonacoLanguageWhenReady')}
     return configureMonacoLanguageWhenReady;`,
  )({ setTimeout }, () => true);
  let checks = 0;
  const monaco = {
    get languages() {
      checks += 1;
      if (checks < 2) return {};
      if (checks === 2) return { typescript: {} };
      return { typescript: typescriptNamespace() };
    },
  };
  assert.equal(await configureWhenReady(monaco, compilerOptions, 3, 0), true);
  assert.equal(checks, 3);
});

function typescriptNamespace() {
  return {
    ModuleResolutionKind: { NodeJs: 2 },
    ModuleKind: { ESNext: 99 },
    ScriptTarget: { ESNext: 99 },
    JsxEmit: { ReactJSX: 4 },
    typescriptDefaults: { setDiagnosticsOptions() {}, setCompilerOptions() {} },
    javascriptDefaults: { setDiagnosticsOptions() {}, setCompilerOptions() {} },
  };
}
