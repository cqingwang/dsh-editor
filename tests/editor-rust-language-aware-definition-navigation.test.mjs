import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const source = await readFile(new URL('../src/client/code-navigation.ts', import.meta.url), 'utf8');
const navigation = loadTypeScriptModule(source, [
  'definitionLanguageCandidates',
  'definitionSearchScopePatterns',
  'findDefinitionInText',
  'resolveWorkspaceDefinition',
]);

test('Rust mod declarations resolve sibling module files', () => {
  const candidates = navigation.definitionLanguageCandidates(
    'mod helper;\npub(crate) mod service;\nfn main() { helper::run(); }\n',
    'src/main.rs',
    'helper',
  );
  assert.ok(candidates.some((candidate) => candidate.path === 'src/helper.rs' && candidate.line === 1));
  assert.ok(candidates.some((candidate) => candidate.path === 'src/helper/mod.rs' && candidate.line === 1));
});

test('Rust crate, super and aliased use paths become declaration candidates', () => {
  const content = [
    'mod service;',
    'mod util;',
    'use crate::service::Helper;',
    'use super::util::run as execute;',
    'fn main() { Helper::new(); execute(); }',
  ].join('\n');
  const helperCandidates = navigation.definitionLanguageCandidates(content, 'src/app/main.rs', 'Helper');
  assert.ok(
    helperCandidates.some(
      (candidate) => candidate.path === 'src/service.rs' && candidate.symbol === 'Helper',
    ),
  );
  const executeCandidates = navigation.definitionLanguageCandidates(content, 'src/app/main.rs', 'execute');
  assert.ok(
    executeCandidates.some(
      (candidate) => candidate.path === 'src/util.rs' && candidate.symbol === 'run',
    ),
  );
});

test('Rust use paths produce bounded search scopes', () => {
  const patterns = navigation.definitionSearchScopePatterns(
    'use crate::service::{Helper, run};\n',
    'src/app/main.rs',
  );
  assert.ok(patterns.includes('src/service.rs'));
  assert.ok(patterns.includes('src/service/**'));
});

test('Rust declarations cover public async functions, structs and macros', () => {
  assert.equal(
    navigation.findDefinitionInText(
      'pub(crate) async fn fetch_value() {}\n',
      'fetch_value',
      'src/lib.rs',
    )?.line,
    1,
  );
  assert.equal(
    navigation.findDefinitionInText(
      'pub struct Service;\n',
      'Service',
      'src/lib.rs',
    )?.column,
    12,
  );
  assert.equal(
    navigation.findDefinitionInText(
      'macro_rules! helper {\n  () => {};\n}\n',
      'helper',
      'src/lib.rs',
    )?.line,
    1,
  );
});

test('Workspace resolution follows Rust use imports before global search', async () => {
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'src/app/main.rs',
    content: 'use crate::service::Helper;\nfn main() { Helper::new(); }\n',
    symbol: 'Helper',
    readFile: async (path) =>
      path === 'src/service.rs' ? 'pub struct Helper;\nimpl Helper { pub fn new() {} }\n' : null,
    searchText: async () => {
      throw new Error('Rust import should resolve directly');
    },
  });
  assert.deepEqual(result, {
    path: 'src/service.rs',
    line: 1,
    column: 12,
    endColumn: 18,
  });
});
