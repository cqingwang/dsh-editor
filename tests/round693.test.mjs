import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`    function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

test('TypeScript module-not-found false positives are targeted without disabling semantics', () => {
  const configure = new Function(
    `${extractFunction('configureMonacoLanguageDiagnostics')}; return configureMonacoLanguageDiagnostics;`,
  )();
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
        typescriptDefaults: defaults('typescript'),
        javascriptDefaults: defaults('javascript'),
      },
    },
  };
  assert.equal(configure(monaco), true);
  for (const kind of ['typescript', 'javascript']) {
    const diagnostics = calls.find((entry) => entry.kind === kind && entry.type === 'diagnostics');
    assert.deepEqual(diagnostics.options.diagnosticCodesToIgnore, [2307, 2792]);
    assert.notEqual(diagnostics.options.noSemanticValidation, true);
    assert.notEqual(diagnostics.options.noSyntaxValidation, true);
    const compiler = calls.find((entry) => entry.kind === kind && entry.type === 'compiler');
    assert.equal(compiler.options.moduleResolution, 2);
    assert.equal(compiler.options.module, 99);
  }
});

test('Monaco loader applies the diagnostic configuration before resolving', () => {
  const loader = source.slice(source.indexOf('function loadMonaco()'), source.indexOf('/** The label and color used by one file-type badge. */'));
  assert.match(loader, /configureMonacoLanguageDiagnostics\(window\.monaco\)/);
  assert.ok(
    loader.indexOf('configureMonacoLanguageDiagnostics(window.monaco)')
      < loader.indexOf('resolve(window.monaco)'),
  );
});
