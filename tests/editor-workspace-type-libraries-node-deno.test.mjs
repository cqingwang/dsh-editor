import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

import { loadTypeScriptModule } from './ts-source.mjs';

const host = await import('../lib/index.js');
const editorCoreSource = await readFile(new URL('../src/client/editor-core.ts', import.meta.url), 'utf8');
const editorWorkspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const {
  configureMonacoWorkspaceTypes,
  createWorkspaceTypeLibraryRefreshQueue,
  workspaceChangeInvalidatesTypeLibraries,
} = loadTypeScriptModule(editorCoreSource, [
  'configureMonacoWorkspaceTypes',
  'createWorkspaceTypeLibraryRefreshQueue',
  'workspaceChangeInvalidatesTypeLibraries',
]);

async function createTypeFixture(t, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-types-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const denoConfigName = options.denoConfigName ?? 'deno.json';
  const typescriptConfigName = options.typescriptConfigName ?? 'tsconfig.json';
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({
      dependencies: { zod: '3.24.2', '@scope/exports-only': '1.0.0' },
      devDependencies: { '@types/frida-gum': '19.0.2' },
      workspaces: ['packages/*'],
    }),
  );
  await writeFile(
    join(root, denoConfigName),
    `{
      // Deno's npm resolver uses this explicit type package.
      "imports": {
        "zod": "npm:zod@3.24.2",
        "@scope/exports-only/feature": "npm:@scope/exports-only@1.0.0/feature",
        "@custom/exports-feature": "npm:@scope/exports-only@1.0.0/feature",
        "@modelcontextprotocol/sdk/types.js": "npm:@modelcontextprotocol/sdk@1.6.0/types.js",
        "@std/path": "jsr:@std/path@1.0.8",
        "@std/path/join": "jsr:@std/path@1.0.8/join",
        "@local/": "./types/"
      },
      "compilerOptions": { "types": ["npm:@types/frida-gum@19.0.2"] }
    }`,
  );
  await writeFile(
    join(root, 'deno.lock'),
    JSON.stringify({
      version: '5',
      specifiers: {
        'jsr:@std/path@1.0.8': '1.0.8',
        'npm:typescript@5.9.3': '5.9.3',
      },
    }),
  );
  await writeFile(
    join(root, typescriptConfigName),
    `{
      "compilerOptions": {
        "baseUrl": "src",
        "paths": { "@app/*": ["app/*"], "@types/*": ["types/*"] }
      }
    }`,
  );
  await mkdir(join(root, 'node_modules', '@types', 'frida-gum'), { recursive: true });
  await writeFile(
    join(root, 'node_modules', '@types', 'frida-gum', 'index.d.ts'),
    'declare const Process: { arch: string };\n',
  );
  await mkdir(join(root, 'node_modules', '@modelcontextprotocol', 'sdk', 'dist', 'esm'), { recursive: true });
  await writeFile(
    join(root, 'node_modules', '@modelcontextprotocol', 'sdk', 'package.json'),
    JSON.stringify({
      name: '@modelcontextprotocol/sdk',
      exports: {
        './*': {
          import: './dist/esm/*',
          require: './dist/cjs/*',
        },
      },
      typesVersions: { '*': { '*': ['./dist/esm/*'] } },
    }),
  );
  await writeFile(
    join(root, 'node_modules', '@modelcontextprotocol', 'sdk', 'dist', 'esm', 'index.d.ts'),
    'export interface Server {};\n',
  );
  await writeFile(
    join(root, 'node_modules', '@modelcontextprotocol', 'sdk', 'dist', 'esm', 'types.d.ts'),
    'export interface CallToolRequest {};\n',
  );
  await mkdir(join(root, 'node_modules', 'zod', 'lib'), { recursive: true });
  await writeFile(
    join(root, 'node_modules', 'zod', 'package.json'),
    JSON.stringify({ name: 'zod', types: './index.d.ts' }),
  );
  await writeFile(join(root, 'node_modules', 'zod', 'index.d.ts'), 'export interface ZodType {};\n');
  await writeFile(join(root, 'node_modules', 'zod', 'lib', 'types.d.ts'), 'export interface ZodString {};\n');
  await writeFile(join(root, 'node_modules', 'zod', 'lib', 'types.d.mts'), 'export interface ZodStringMts {};\n');
  await mkdir(join(root, 'node_modules', 'typescript', 'lib'), { recursive: true });
  await writeFile(
    join(root, 'node_modules', 'typescript', 'package.json'),
    JSON.stringify({ name: 'typescript', typings: './lib/typescript.d.ts' }),
  );
  await writeFile(
    join(root, 'node_modules', 'typescript', 'lib', 'typescript.d.ts'),
    'export interface CompilerOptions { strict?: boolean }\n',
  );
  await writeFile(
    join(root, 'node_modules', 'typescript', 'lib', 'lib.es5.d.ts'),
    'interface Array<T> { readonly length: number }\n',
  );
  await mkdir(join(root, 'node_modules', '@scope', 'exports-only', 'dist'), { recursive: true });
  await writeFile(
    join(root, 'node_modules', '@scope', 'exports-only', 'package.json'),
    JSON.stringify({
      name: '@scope/exports-only',
      exports: {
        '.': {
          types: './dist/index.d.ts',
          import: './dist/index.js',
        },
        './feature': {
          types: './dist/feature.d.ts',
          import: './dist/feature.js',
        },
        './cjs-only': {
          types: './dist/cjs-only.d.cts',
          require: './dist/cjs-only.cjs',
        },
        './*': {
          types: './dist/*.d.mts',
          import: './dist/*.mjs',
        },
      },
    }),
  );
  await writeFile(
    join(root, 'node_modules', '@scope', 'exports-only', 'dist', 'index.d.ts'),
    'export interface ExportsOnlyType { value: string }\n',
  );
  await writeFile(
    join(root, 'node_modules', '@scope', 'exports-only', 'dist', 'feature.d.ts'),
    'export interface ExportsOnlyFeature { enabled: boolean }\n',
  );
  await writeFile(
    join(root, 'node_modules', '@scope', 'exports-only', 'dist', 'cjs-only.d.cts'),
    'export interface ExportsOnlyCjs { enabled: boolean }\n',
  );
  await writeFile(
    join(root, 'node_modules', '@scope', 'exports-only', 'dist', 'wild-feature.d.mts'),
    'export interface ExportsOnlyWildcard { enabled: boolean }\n',
  );
  await mkdir(join(root, 'types'), { recursive: true });
  await writeFile(join(root, 'types', 'local-probe.d.ts'), 'interface LocalProbe { value: string }\n');
  await writeFile(join(root, 'types', 'local-probe.d.mts'), 'interface LocalProbeMts { value: string }\n');
  await writeFile(join(root, 'types', 'local-probe.d.cts'), 'interface LocalProbeCts { value: string }\n');
  await mkdir(join(root, 'packages', 'core', 'src'), { recursive: true });
  await writeFile(
    join(root, 'packages', 'core', 'package.json'),
    JSON.stringify({ name: '@probe/core', types: './src/index.d.ts' }),
  );
  await writeFile(
    join(root, 'packages', 'core', 'src', 'index.d.ts'),
    'export interface WorkspacePackageType { value: string }\n',
  );
  return root;
}

test('Deno jsonc and jsconfig participate in workspace type discovery', async (t) => {
  const root = await createTypeFixture(t, {
    denoConfigName: 'deno.jsonc',
    typescriptConfigName: 'jsconfig.json',
  });
  const libraries = await host.workspaceFileOperations.typeLibraries(root);

  assert.deepEqual(libraries.types, ['frida-gum']);
  assert.equal(libraries.baseUrl, 'src');
  assert.deepEqual(libraries.paths['@app/*'], ['app/*']);
  assert.ok(libraries.files.some((file) => file.path === 'node_modules/zod/lib/types.d.ts'));
  assert.ok(libraries.files.some((file) => file.path === 'node_modules/zod/lib/types.d.mts'));
  assert.ok(libraries.files.some((file) => file.path === 'node_modules/.dsh-editor/deno.ns.d.ts'));
});

test('the host loads explicit and installed Node/Deno type packages within bounds', async (t) => {
  const root = await createTypeFixture(t);
  const libraries = await host.workspaceFileOperations.typeLibraries(root);

  assert.deepEqual(libraries.types, ['frida-gum']);
  assert.deepEqual(libraries.typeRoots, ['node_modules/@types']);
  assert.equal(libraries.truncated, false);
  assert.equal(libraries.baseUrl, 'src');
  assert.deepEqual(libraries.paths, {
    '@app/*': ['app/*'],
    '@types/*': ['types/*'],
    '@local/*': ['../types/*'],
    'npm:typescript@5.9.3': ['node_modules/.dsh-editor/npm/typescript@5.9.3/index.d.ts'],
    'jsr:@std/path@1.0.8': ['node_modules/.dsh-editor/jsr/@std/path/1.0.8/mod.ts'],
    'jsr:@std/path@1.0.8/join': ['node_modules/.dsh-editor/jsr/@std/path/1.0.8/join.ts'],
    '@std/path': ['node_modules/.dsh-editor/jsr/@std/path/1.0.8/mod.ts'],
    '@std/path/join': ['node_modules/.dsh-editor/jsr/@std/path/1.0.8/join.ts'],
  });
  assert.ok(libraries.files.some((file) => file.path === 'node_modules/@types/frida-gum/index.d.ts'));
  assert.ok(libraries.files.some((file) => file.path === 'node_modules/zod/lib/types.d.ts'));
  assert.ok(libraries.files.some((file) => file.path === 'node_modules/typescript/lib/typescript.d.ts'));
  assert.ok(!libraries.files.some((file) => file.path === 'node_modules/typescript/lib/lib.es5.d.ts'));
  assert.ok(libraries.files.some((file) => file.path === 'types/local-probe.d.ts'));
  assert.ok(libraries.files.some((file) => file.path === 'types/local-probe.d.mts'));
  assert.ok(libraries.files.some((file) => file.path === 'types/local-probe.d.cts'));
  assert.ok(libraries.files.some((file) => file.path === 'node_modules/@probe/core/src/index.d.ts'));
  assert.ok(!libraries.files.some((file) => file.path === 'packages/core/src/index.d.ts'));
  assert.ok(libraries.files.some((file) => file.path === 'node_modules/@modelcontextprotocol/sdk/dist/esm/index.d.ts'));
  assert.ok(libraries.files.some((file) => file.path === 'node_modules/@modelcontextprotocol/sdk/package.json'));
  assert.ok(libraries.files.some((file) => file.path === 'node_modules/@probe/core/package.json'));
  assert.ok(libraries.files.some((file) => file.path === 'node_modules/@scope/exports-only/index.d.ts'));
  assert.ok(libraries.files.some((file) => file.path === 'node_modules/@scope/exports-only/feature.d.ts'));
  assert.ok(libraries.files.some((file) => file.path === 'node_modules/@custom/exports-feature/index.d.ts'));
  const denoTypes = libraries.files.find((file) => file.path === 'node_modules/.dsh-editor/deno.ns.d.ts');
  assert.ok(denoTypes);
  assert.match(denoTypes.content, /declare namespace Deno/u);
  assert.match(denoTypes.content, /class Command/u);
  assert.deepEqual(libraries.paths['jsr:@std/path@1.0.8'], [
    'node_modules/.dsh-editor/jsr/@std/path/1.0.8/mod.ts',
  ]);
  assert.deepEqual(libraries.paths['@std/path'], [
    'node_modules/.dsh-editor/jsr/@std/path/1.0.8/mod.ts',
  ]);
  assert.deepEqual(libraries.paths['@std/path/join'], [
    'node_modules/.dsh-editor/jsr/@std/path/1.0.8/join.ts',
  ]);
  assert.deepEqual(libraries.paths['npm:typescript@5.9.3'], [
    'node_modules/.dsh-editor/npm/typescript@5.9.3/index.d.ts',
  ]);
  assert.ok(
    libraries.files.some((file) => file.path === 'node_modules/.dsh-editor/jsr/@std/path/1.0.8/mod.ts'),
  );
  assert.match(
    libraries.files.find((file) => file.path.endsWith('@types/frida-gum/index.d.ts')).content,
    /declare const Process:/u,
  );
});

test('virtual export proxies resolve Deno npm subpaths instead of falling back to any', async (t) => {
  const root = await createTypeFixture(t);
  const libraries = await host.workspaceFileOperations.typeLibraries(root);
  const options = {
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ESNext,
  };
  const resolveWith = (fileEntries, specifier = '@modelcontextprotocol/sdk/types.js', compilerOptions = {}) => {
    const files = new Map(fileEntries.map((file) => [file.path, file.content]));
    const virtualHost = {
      fileExists(path) {
        return files.has(path);
      },
      readFile(path) {
        return files.get(path);
      },
      directoryExists(path) {
        const prefix = path === '' ? '' : `${path}/`;
        return [...files.keys()].some((file) => file.startsWith(prefix));
      },
      realpath(path) {
        return path;
      },
      getCurrentDirectory() {
        return '';
      },
      getDirectories() {
        return [];
      },
    };
    return ts.resolveModuleName(specifier, 'src/type-probe.ts', { ...options, ...compilerOptions }, virtualHost).resolvedModule;
  };

  const withoutMetadata = libraries.files.filter(
    (file) => file.path !== 'node_modules/@modelcontextprotocol/sdk/package.json',
  );
  assert.equal(
    resolveWith(withoutMetadata)?.resolvedFileName,
    'node_modules/@modelcontextprotocol/sdk/types.d.ts',
  );
  assert.equal(
    resolveWith(libraries.files)?.resolvedFileName,
    'node_modules/@modelcontextprotocol/sdk/dist/esm/types.d.ts',
  );
  assert.equal(
    resolveWith(libraries.files, '@scope/exports-only')?.resolvedFileName,
    'node_modules/@scope/exports-only/index.d.ts',
  );
  assert.equal(
    resolveWith(libraries.files, '@scope/exports-only/feature')?.resolvedFileName,
    'node_modules/@scope/exports-only/feature.d.ts',
  );
  assert.equal(
    resolveWith(libraries.files, '@scope/exports-only/cjs-only')?.resolvedFileName,
    'node_modules/@scope/exports-only/cjs-only.d.ts',
  );
  assert.equal(
    resolveWith(libraries.files, '@scope/exports-only/wild-feature')?.resolvedFileName,
    'node_modules/@scope/exports-only/wild-feature.d.ts',
  );
  assert.equal(
    resolveWith(libraries.files, '@custom/exports-feature')?.resolvedFileName,
    'node_modules/@custom/exports-feature/index.d.ts',
  );
  assert.equal(
    resolveWith(libraries.files, 'jsr:@std/path@1.0.8', {
      baseUrl: '',
      paths: libraries.paths,
    })?.resolvedFileName,
    'node_modules/.dsh-editor/jsr/@std/path/1.0.8/mod.ts',
  );
  assert.equal(
    resolveWith(libraries.files, '@std/path/join', {
      baseUrl: '',
      paths: libraries.paths,
    })?.resolvedFileName,
    'node_modules/.dsh-editor/jsr/@std/path/1.0.8/join.ts',
  );
  assert.equal(
    resolveWith(libraries.files, '@local/local-probe', {
      baseUrl: libraries.baseUrl,
      paths: libraries.paths,
    })?.resolvedFileName,
    'types/local-probe.d.ts',
  );
  assert.match(
    libraries.files.find((file) => file.path === 'node_modules/@scope/exports-only/index.d.ts').content,
    /export \* from "\.\/dist\/index\.js";/u,
  );
  assert.match(
    libraries.files.find((file) => file.path === 'node_modules/@custom/exports-feature/index.d.ts').content,
    /export \* from "\.\.\/\.\.\/@scope\/exports-only\/dist\/feature\.js";/u,
  );
  assert.equal(
    resolveWith(libraries.files, 'npm:typescript@5.9.3', {
      baseUrl: '',
      paths: libraries.paths,
    })?.resolvedFileName,
    'node_modules/.dsh-editor/npm/typescript@5.9.3/index.d.ts',
  );
});

test('Monaco installs workspace declarations as extra libs and disposes stale generations', () => {
  const compilerCalls = [];
  const added = [];
  const disposed = [];
  const defaults = {
    addExtraLib(content, uri) {
      added.push({ content, uri });
      return { dispose: () => disposed.push(uri) };
    },
    setCompilerOptions(options) {
      compilerCalls.push(options);
    },
    setDiagnosticsOptions() {},
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
  const libraries = {
    files: [
      {
        path: 'node_modules/@types/frida-gum/index.d.ts',
        content: 'declare const Process: { arch: string };\n',
      },
    ],
    types: ['frida-gum'],
    typeRoots: ['node_modules/@types'],
  };
  assert.equal(configureMonacoWorkspaceTypes(monaco, libraries), 1);
  assert.ok(added.some((entry) => entry.uri === 'file:///node_modules/%40types/frida-gum/index.d.ts'));
  const compiler = compilerCalls.at(-1);
  assert.deepEqual(compiler.types, ['frida-gum']);
  assert.deepEqual(compiler.typeRoots, ['file:///node_modules/%40types']);
  assert.equal(compiler.baseUrl, 'file:///');

  configureMonacoWorkspaceTypes(monaco, libraries);
  assert.ok(disposed.includes('file:///node_modules/%40types/frida-gum/index.d.ts'));

  configureMonacoWorkspaceTypes(monaco, {
    ...libraries,
    baseUrl: 'src',
    paths: { '@app/*': ['app/*'] },
  });
  const aliasCompiler = compilerCalls.at(-1);
  assert.equal(aliasCompiler.baseUrl, 'file:///src');
  assert.deepEqual(aliasCompiler.paths, { '@app/*': ['app/*'] });
});

test('type library refresh bursts coalesce and preserve one trailing refresh', async () => {
  const requests = [];
  let scheduled = null;
  const settle = async () => {
    for (let index = 0; index < 4; index += 1) await Promise.resolve();
  };
  const queue = createWorkspaceTypeLibraryRefreshQueue(
    () =>
      new Promise((resolve) => {
        requests.push(resolve);
      }),
    (callback, delay) => {
      scheduled = { callback, delay };
      return requests.length + 1;
    },
    () => {},
  );

  queue.schedule();
  queue.schedule();
  queue.schedule();
  assert.equal(requests.length, 0);
  assert.equal(scheduled.delay, 120);
  scheduled.callback();
  await settle();
  assert.equal(requests.length, 1);

  queue.schedule();
  scheduled.callback();
  assert.equal(requests.length, 1);
  requests[0]();
  await settle();
  assert.equal(requests.length, 2);
  requests[1]();
  await settle();
});

test('cancelling the type library refresh queue drops the pending timer', async () => {
  const requests = [];
  let scheduled = null;
  const cleared = [];
  const queue = createWorkspaceTypeLibraryRefreshQueue(
    () =>
      new Promise((resolve) => {
        requests.push(resolve);
      }),
    (callback, delay) => {
      scheduled = { callback, delay };
      return 17;
    },
    (handle) => cleared.push(handle),
  );

  queue.schedule();
  queue.cancel();
  assert.deepEqual(cleared, [17]);
  scheduled.callback();
  await Promise.resolve();
  assert.equal(requests.length, 0);
});

test('the editor requests workspace type libraries after Monaco and workspace are ready', () => {
  assert.match(editorCoreSource, /op: 'typeLibraries'/u);
  assert.match(editorWorkspaceSource, /requestWorkspaceTypeLibraries\(window\.monaco, controller\.signal\)/u);
  assert.match(
    editorWorkspaceSource,
    /refreshWorkspaceTypesForChange\(window\.monaco, event\.paths, changedDirectories\)/u,
  );
  assert.match(
    editorCoreSource,
    /if \(libraries === null \|\| libraries === undefined\) cancelWorkspaceTypeLibrariesRefresh\(monaco\)/u,
  );
  assert.match(editorWorkspaceSource, /configureMonacoWorkspaceTypes\(window\.monaco, null\)/u);
});

test('dependency installation changes invalidate workspace type libraries', () => {
  for (const path of [
    'package.json',
    'deno.json',
    'deno.jsonc',
    'deno.lock',
    'pnpm-lock.yaml',
    'packages/app/tsconfig.json',
    'node_modules',
    'node_modules/@types/frida-gum/index.d.ts',
    'types/local-probe.d.ts',
    'types/local-probe.d.mts',
    'types/local-probe.d.cts',
  ]) {
    assert.equal(workspaceChangeInvalidatesTypeLibraries([path]), true, path);
  }
  assert.equal(workspaceChangeInvalidatesTypeLibraries(['src/index.ts']), false);
});
