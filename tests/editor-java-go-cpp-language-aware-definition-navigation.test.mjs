import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const source = await readFile(new URL('../src/client/code-navigation.ts', import.meta.url), 'utf8');
const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const navigation = loadTypeScriptModule(source, [
  'definitionLanguageCandidates',
  'definitionSearchScopePatterns',
  'definitionSearchQuery',
  'findDefinitionInText',
  'resolveWorkspaceDefinition',
]);

test('Java imports resolve package roots and static method imports', () => {
  const content = [
    'package com.acme.app;',
    'import com.acme.service.Helper;',
    'import static com.acme.util.Util.format;',
    'class Main {',
    '  void run() { Helper.work(); format("ok"); }',
    '}',
  ].join('\n');
  const sourcePath = 'src/main/java/com/acme/app/Main.java';

  const methodCandidates = navigation.definitionLanguageCandidates(content, sourcePath, 'work');
  assert.ok(
    methodCandidates.some(
      (candidate) =>
        candidate.path === 'src/main/java/com/acme/service/Helper.java' && candidate.symbol === 'work',
    ),
  );

  const typeCandidates = navigation.definitionLanguageCandidates(content, sourcePath, 'Helper');
  assert.ok(
    typeCandidates.some(
      (candidate) =>
        candidate.path === 'src/main/java/com/acme/service/Helper.java' && candidate.symbol === undefined,
    ),
  );

  const staticCandidates = navigation.definitionLanguageCandidates(content, sourcePath, 'format');
  assert.ok(
    staticCandidates.some(
      (candidate) =>
        candidate.path === 'src/main/java/com/acme/util/Util.java' && candidate.symbol === 'format',
    ),
  );
});

test('C and C++ includes become direct declaration candidates', () => {
  const content = '#include "../include/helper.h"\n#include <acme/runtime.hpp>\nint main() { return helper(); }\n';
  const candidates = navigation.definitionLanguageCandidates(content, 'src/app/main.cpp', 'helper');

  assert.ok(
    candidates.some(
      (candidate) => candidate.path === 'src/include/helper.h' && candidate.symbol === 'helper',
    ),
  );
  assert.ok(
    candidates.some(
      (candidate) => candidate.path === 'acme/runtime.hpp' && candidate.symbol === 'helper',
    ),
  );
});

test('Go import paths provide bounded search scope without assuming a module root', () => {
  const content = [
    'package api',
    'import "example.com/acme/project/internal/store"',
    'func Load() { store.Fetch() }',
  ].join('\n');
  const patterns = navigation.definitionSearchScopePatterns(content, 'services/api/load.go');

  assert.ok(patterns.includes('internal/store/**'));
  assert.ok(patterns.includes('**/internal/store/**'));
  assert.ok(navigation.definitionSearchQuery('Fetch', 'services/api/load.go').length <= 256);
});

test('Java, C++ and C declarations include methods and header prototypes', () => {
  assert.equal(
    navigation.findDefinitionInText(
      'public class Helper {\n  public <T> java.util.List<T> work(T value) { return null; }\n}\n',
      'work',
      'Helper.java',
    )?.line,
    2,
  );
  assert.equal(
    navigation.findDefinitionInText(
      'void Widget::paint() {}\n',
      'paint',
      'widget.cpp',
    )?.column,
    14,
  );
  assert.deepEqual(
    navigation.findDefinitionInText(
      'int helper(int value);\n',
      'helper',
      'helper.h',
    ),
    {
      path: 'helper.h',
      line: 1,
      column: 5,
      endColumn: 11,
    },
  );
});

test('Workspace resolution follows Java, Go and C language imports before global search', async () => {
  const javaResult = await navigation.resolveWorkspaceDefinition({
    path: 'src/main/java/com/acme/app/Main.java',
    content: 'package com.acme.app;\nimport com.acme.service.Helper;\nclass Main { void run() { Helper.work(); } }\n',
    symbol: 'work',
    readFile: async (path) =>
      path === 'src/main/java/com/acme/service/Helper.java'
        ? 'package com.acme.service;\nclass Helper { void work() {} }\n'
        : null,
    searchText: async () => {
      throw new Error('Java import should resolve directly');
    },
  });
  assert.deepEqual(javaResult, {
    path: 'src/main/java/com/acme/service/Helper.java',
    line: 2,
    column: 21,
    endColumn: 25,
  });

  const goSearches = [];
  const goResult = await navigation.resolveWorkspaceDefinition({
    path: 'services/api/load.go',
    content: 'package api\nimport "example.com/acme/project/internal/store"\nfunc Load() { store.Fetch() }\n',
    symbol: 'Fetch',
    readFile: async (path) =>
      path === 'internal/store/store.go' ? 'package store\nfunc Fetch() {}\n' : null,
    searchText: async (query, options) => {
      goSearches.push({ query, options });
      return [{ path: 'internal/store/store.go', line: 2, column: 6 }];
    },
  });
  assert.ok(goSearches[0].options.scopeIncludePatterns.includes('**/internal/store/**'));
  assert.deepEqual(goResult, {
    path: 'internal/store/store.go',
    line: 2,
    column: 6,
    endColumn: 11,
  });

  const cResult = await navigation.resolveWorkspaceDefinition({
    path: 'src/app/main.c',
    content: '#include "../include/helper.h"\nint main() { return helper(1); }\n',
    symbol: 'helper',
    readFile: async (path) =>
      path === 'src/include/helper.h' ? '#pragma once\nint helper(int value);\n' : null,
    searchText: async () => {
      throw new Error('C include should resolve directly');
    },
  });
  assert.deepEqual(cResult, {
    path: 'src/include/helper.h',
    line: 2,
    column: 5,
    endColumn: 11,
  });
});

test('The editor forwards language search scopes to the host text search', () => {
  assert.match(workspaceSource, /searchText: async \(query: string, options\?: DefinitionSearchOptions\)/u);
  assert.match(workspaceSource, /scopeIncludePatterns: options\?\.scopeIncludePatterns/u);
});
