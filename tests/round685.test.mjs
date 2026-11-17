import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

const names = [
  'escapeDefinitionRegex',
  'normalizeNavigationPath',
  'navigationDirname',
  'navigationBasename',
  'navigationExtension',
  'navigationPathForModel',
  'namedImportBinding',
  'javascriptImportBinding',
  'pythonImportSpecifier',
  'definitionImportTarget',
  'definitionCandidateExtensions',
  'definitionModuleCandidates',
  'definitionPositionAtOffset',
  'definitionRegexes',
  'findDefinitionInText',
  'definitionSearchQuery',
  'rankDefinitionSearchMatches',
  'normalizeNavigationLocation',
  'navigationHistoryRecord',
  'navigationHistoryStep',
  'resolveWorkspaceDefinition',
];
const moduleStart = source.indexOf('/* code-navigation.js:');
const moduleEnd = source.indexOf('/* ─────────────────────── inline-styles.js', moduleStart);
assert.ok(moduleStart >= 0 && moduleEnd > moduleStart, 'code-navigation module should be generated');
const navigation = new Function(
  `${source.slice(moduleStart, moduleEnd)}\nreturn { ${names.join(', ')} };`,
)();

test('JavaScript named imports map local identifiers to their source module', () => {
  const content = "import { TerminalHub, encodeSse as encode } from './terminal.js';\n";
  assert.deepEqual(navigation.definitionImportTarget(content, 'TerminalHub'), {
    kind: 'named',
    importedName: 'TerminalHub',
    specifier: './terminal.js',
    language: 'javascript',
  });
  assert.deepEqual(navigation.definitionImportTarget(content, 'encode'), {
    kind: 'named',
    importedName: 'encodeSse',
    specifier: './terminal.js',
    language: 'javascript',
  });
});

test('Default, namespace and Python imports resolve to their target modules', () => {
  assert.equal(
    navigation.definitionImportTarget("import Hub from './hub';", 'Hub')?.kind,
    'default',
  );
  assert.equal(
    navigation.definitionImportTarget("import * as runtime from './runtime.js';", 'runtime')?.kind,
    'namespace',
  );
  assert.deepEqual(
    navigation.definitionImportTarget("from .terminal import TerminalHub\n", 'TerminalHub'),
    {
      kind: 'named',
      importedName: 'TerminalHub',
      specifier: './terminal',
      relative: true,
      language: 'python',
    },
  );
});

test('Relative module candidates respect explicit and extensionless imports', () => {
  assert.deepEqual(
    navigation.definitionModuleCandidates('lib/index.js', './terminal.js', 'javascript'),
    ['lib/terminal.js'],
  );
  const extensionless = navigation.definitionModuleCandidates('src/main.ts', './util', 'javascript');
  assert.ok(extensionless.includes('src/util.ts'));
  assert.ok(extensionless.includes('src/util.js'));
  assert.ok(extensionless.includes('src/util/index.ts'));
});

test('Monaco file URIs become decoded workspace paths', () => {
  assert.equal(
    navigation.navigationPathForModel({ uri: { path: '/src/with%20space/main.js' } }),
    'src/with space/main.js',
  );
});

test('Declarations resolve across common languages', () => {
  assert.deepEqual(
    navigation.findDefinitionInText('export class TerminalHub {}\nexport function encodeSse() {}\n', 'encodeSse', 'terminal.js'),
    { path: 'terminal.js', line: 2, column: 17, endColumn: 26 },
  );
  assert.equal(
    navigation.findDefinitionInText('class Hub:\n    pass\n', 'Hub', 'hub.py')?.line,
    1,
  );
  assert.equal(
    navigation.findDefinitionInText('pub fn encode_sse() {}\n', 'encode_sse', 'lib.rs')?.column,
    8,
  );
  assert.equal(
    navigation.findDefinitionInText('func TerminalHub() {}\n', 'TerminalHub', 'hub.go')?.line,
    1,
  );
  assert.equal(
    navigation.findDefinitionInText('public class TerminalHub {}\n', 'TerminalHub', 'TerminalHub.java')?.line,
    1,
  );
  assert.equal(
    navigation.findDefinitionInText('public String encodeSse(String input) { return input; }\n', 'encodeSse', 'TerminalHub.java')?.column,
    15,
  );
  assert.equal(
    navigation.findDefinitionInText('export class TerminalHub {\n  encodeSse() {}\n}\n', 'encodeSse', 'terminal.ts')?.line,
    2,
  );
  assert.equal(
    navigation.findDefinitionInText('int encode_sse(const char *input) { return 0; }\n', 'encode_sse', 'terminal.c')?.column,
    5,
  );
  assert.equal(
    navigation.findDefinitionInText('func encodeSse(input: String) -> String { return input }\n', 'encodeSse', 'terminal.swift')?.column,
    6,
  );
});

test('The workspace resolver follows an import before using global search', async () => {
  const reads = [];
  const searches = [];
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'lib/index.js',
    content: "import { TerminalHub, encodeSse } from './terminal.js';\nTerminalHub();\n",
    symbol: 'TerminalHub',
    readFile: async (path) => {
      reads.push(path);
      if (path !== 'lib/terminal.js') throw new Error('missing');
      return 'export class TerminalHub {}\nexport function encodeSse() {}\n';
    },
    searchText: async (query) => {
      searches.push(query);
      return [];
    },
  });
  assert.deepEqual(reads, ['lib/terminal.js']);
  assert.deepEqual(searches, []);
  assert.deepEqual(result, {
    path: 'lib/terminal.js',
    line: 1,
    column: 14,
    endColumn: 25,
  });
});

test('Unresolved imported symbols fall back to workspace declaration search', async () => {
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'src/main.rs',
    content: 'fn main() { helper(); }\n',
    symbol: 'helper',
    readFile: async (path) => path === 'src/helper.rs' ? 'pub fn helper() {}\n' : Promise.reject(new Error('missing')),
    searchText: async () => [{ path: 'src/helper.rs', line: 1, column: 1, preview: 'pub fn helper' }],
  });
  assert.deepEqual(result, {
    path: 'src/helper.rs',
    line: 1,
    column: 8,
    endColumn: 14,
  });
});

test('Custom return-type methods are searchable, then confirmed as declarations', async () => {
  const queries = [];
  const result = await navigation.resolveWorkspaceDefinition({
    path: 'src/Api.cs',
    content: 'public class Api { public void Run() { Build(); } }\n',
    symbol: 'Build',
    readFile: async (path) => path === 'src/Payload.cs'
      ? 'public class Payload { public Payload Build() { return this; } }\n'
      : Promise.reject(new Error('missing')),
    searchText: async (query) => {
      queries.push(query);
      return [{ path: 'src/Payload.cs', line: 1, column: 1, preview: 'public Payload Build()' }];
    },
  });
  assert.ok(queries[0].includes('\\bBuild\\s*'));
  assert.deepEqual(result, {
    path: 'src/Payload.cs',
    line: 1,
    column: 39,
    endColumn: 44,
  });
});

test('The editor wires Cmd/Ctrl-click, Cmd/Ctrl+B and F12 to declaration navigation', () => {
  assert.match(source, /id: 'dsh-editor\.goToDefinition'/u);
  assert.match(source, /monaco\.KeyMod\.CtrlCmd \| monaco\.KeyCode\.F12/u);
  assert.match(source, /monaco\.KeyMod\.CtrlCmd \| monaco\.KeyCode\.KeyB/u);
  assert.match(source, /editor\.onMouseDown\?\.\(\(event\) =>/u);
  assert.match(source, /browserEvent\?\.metaKey !== true && browserEvent\?\.ctrlKey !== true/u);
  assert.match(source, /onGoToDefinition: goToDefinitionAt/u);
  assert.match(source, /goToDefinitionAction: '转到声明'/u);
  assert.match(source, /goToDefinitionAction: 'Go to Declaration'/u);
});
