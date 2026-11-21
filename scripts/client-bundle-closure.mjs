import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { parse } from '@babel/parser';

function posixPath(value) {
  return value.split(sep).join('/');
}

function moduleInsideClient(clientDir, absolutePath) {
  const clientRelative = relative(clientDir, absolutePath);
  if (clientRelative === '' || clientRelative.startsWith('..') || resolve(clientDir, clientRelative) !== absolutePath) {
    return '';
  }
  return posixPath(clientRelative);
}

function resolveSourceModule(clientDir, fromModule, specifier) {
  if (!specifier.startsWith('.')) return '';
  const absoluteBase = resolve(dirname(join(clientDir, fromModule)), specifier);
  const extension = extname(absoluteBase);
  const candidates =
    extension === '.ts' || extension === '.tsx'
      ? [absoluteBase]
      : [`${absoluteBase}.ts`, `${absoluteBase}.tsx`, join(absoluteBase, 'index.ts'), join(absoluteBase, 'index.tsx')];
  const resolvedPath = candidates.find((candidate) => existsSync(candidate)) ?? '';
  return resolvedPath === '' ? '' : moduleInsideClient(clientDir, resolvedPath);
}

function importHasRuntimeBinding(node) {
  if (node.importKind === 'type') return false;
  if (node.specifiers.length === 0) return true;
  return node.specifiers.some((specifier) => specifier.importKind !== 'type');
}

function runtimeDependencies(clientDir, moduleName) {
  const source = readFileSync(join(clientDir, moduleName), 'utf8');
  const ast = parse(source, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
  const dependencies = new Set();
  for (const statement of ast.program.body) {
    if (statement.type === 'ImportDeclaration' && importHasRuntimeBinding(statement)) {
      const dependency = resolveSourceModule(clientDir, moduleName, statement.source.value);
      if (dependency !== '') dependencies.add(dependency);
      continue;
    }
    if (
      (statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportAllDeclaration') &&
      statement.source !== undefined &&
      statement.source !== null &&
      statement.exportKind !== 'type'
    ) {
      const dependency = resolveSourceModule(clientDir, moduleName, statement.source.value);
      if (dependency !== '') dependencies.add(dependency);
    }
  }
  return [...dependencies];
}

/** Collect the runtime TypeScript module closure reachable from the supplied entries. */
export function collectClientModuleClosure(clientDir, entryModules) {
  const closure = new Set();
  const queue = [...new Set(entryModules)];
  while (queue.length > 0) {
    const moduleName = queue.shift();
    if (moduleName === undefined || closure.has(moduleName)) continue;
    closure.add(moduleName);
    queue.push(...runtimeDependencies(clientDir, moduleName));
  }
  return closure;
}

/** Find configured separate bundle entries whose source file does not exist. */
export function findMissingSeparatelyBundledEntries({ clientDir, separatelyBundledEntries }) {
  return [...new Set(separatelyBundledEntries)].filter((moduleName) => !existsSync(join(clientDir, moduleName))).sort();
}

/**
 * Find imported runtime modules that are neither emitted with their own bundle marker
 * nor covered by a separately bundled module graph.
 */
export function findUnbundledRuntimeModules({
  clientDir,
  entryModules,
  includedModules,
  separatelyBundledEntries = [],
}) {
  const required = collectClientModuleClosure(clientDir, entryModules);
  const separatelyBundled = collectClientModuleClosure(clientDir, separatelyBundledEntries);
  const included = new Set(includedModules);
  return [...required].filter((moduleName) => !included.has(moduleName) && !separatelyBundled.has(moduleName)).sort();
}
