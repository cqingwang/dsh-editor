import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const source = await readFile(
  new URL('../src/client/components/editor/editor-theme-model.ts', import.meta.url),
  'utf8',
);
const editorCoreSource = await readFile(new URL('../src/client/editor-core.ts', import.meta.url), 'utf8');
const helpers = loadTypeScriptModule(source, [
  'clipIdeaLightSemanticTokensToRange',
  'collectIdeaLightHeuristicSemanticTokens',
  'encodeIdeaLightSemanticTokens',
  'ideaLightSemanticTokenClass',
  'ideLightTextStyleRanges',
  'mergeIdeaLightSemanticTokens',
]);

test('semantic tokens are emitted in Monaco delta encoding order', () => {
  const encoded = helpers.encodeIdeaLightSemanticTokens([
    { line: 2, startCharacter: 4, length: 3, tokenType: 4 },
    { line: 0, startCharacter: 1, length: 5, tokenType: 2 },
    { line: 2, startCharacter: 9, length: 2, tokenType: 3 },
  ]);
  assert.deepEqual(Array.from(encoded), [0, 1, 5, 2, 0, 2, 4, 3, 4, 0, 0, 5, 2, 3, 0]);
});

test('overlapping semantic tokens keep the higher-priority classification', () => {
  const merged = helpers.mergeIdeaLightSemanticTokens([
    { line: 1, startCharacter: 2, length: 6, tokenType: 7, priority: 10 },
    { line: 1, startCharacter: 2, length: 4, tokenType: 3, priority: 20 },
    { line: 1, startCharacter: 7, length: 2, tokenType: 4, priority: 5 },
  ]);
  assert.deepEqual(merged, [
    { line: 1, startCharacter: 2, length: 4, tokenType: 3, priority: 20 },
    { line: 1, startCharacter: 7, length: 2, tokenType: 4, priority: 5 },
  ]);
});

test('TypeScript lexical hints identify methods, properties and local variables', () => {
  const tokens = helpers.collectIdeaLightHeuristicSemanticTokens(
    [
      'import {runtime_io} from "./runtime";',
      'class Box<TValue> {',
      '  value: TValue;',
      '  read(input: string) {',
      '    return this.value;',
      '  }',
      '}',
      'export const run = (value: string) => {',
      '  const local = runtime_io.ready(value);',
      '  return local;',
      '};',
    ].join('\n'),
  );
  const tokenNames = tokens.map((token) => token.tokenType);
  assert.ok(tokenNames.includes('ideaGlobalVariable'));
  assert.ok(tokenNames.includes('ideaVariable'));
  assert.ok(tokenNames.includes('ideaParameter'));
  assert.ok(tokenNames.includes('ideaClass'));
  assert.ok(tokenNames.includes('ideaTypeParameter'));
  assert.ok(tokenNames.includes('ideaProperty'));
  assert.ok(tokenNames.includes('ideaMethod'));
  assert.ok(tokenNames.includes('ideaFunction'));
});

test('Shell functions, assignments and variable references receive semantic colors', () => {
  const text = [
    '#!/usr/bin/env bash',
    'color_variable="value"',
    'color_function() {',
    '  printf \'%s\\n\' "$color_variable"',
    '}',
    'color_function',
  ].join('\n');
  const tokens = helpers.mergeIdeaLightSemanticTokens(helpers.collectIdeaLightHeuristicSemanticTokens(text, 'shell'));
  const lines = text.split('\n');
  const values = tokens.map((token) => ({
    value: lines[token.line]?.slice(token.startCharacter, token.startCharacter + token.length),
    tokenType: token.tokenType,
  }));
  assert.deepEqual(
    values.filter((token) => token.value !== ''),
    [
      { value: 'color_variable', tokenType: 'ideaVariable' },
      { value: 'color_function', tokenType: 'ideaFunction' },
      { value: 'color_variable', tokenType: 'ideaVariable' },
      { value: 'color_function', tokenType: 'ideaFunction' },
    ],
  );
});

test('Shell language ids are registered with the shared semantic token provider', () => {
  assert.match(editorCoreSource, /'shell',\s*'bash',\s*'sh',/u);
});

test('Shell local/export, arrays and parameter expansion keep semantic roles', () => {
  const text = [
    'local color_local="${color_variable:-fallback}"',
    'export color_export="$color_variable"',
    'color_array=("$color_variable")',
    'printf \'%s\\n\' "${color_array[0]}"',
  ].join('\n');
  const tokens = helpers.mergeIdeaLightSemanticTokens(
    helpers.collectIdeaLightHeuristicSemanticTokens(text, 'shell'),
  );
  const lines = text.split('\n');
  const values = tokens.map((token) => ({
    value: lines[token.line]?.slice(token.startCharacter, token.startCharacter + token.length),
    tokenType: token.tokenType,
  }));
  for (const value of ['color_local', 'color_export', 'color_array']) {
    assert.ok(
      values.some((token) => token.value === value && token.tokenType === 'ideaVariable'),
      `${value} should be a variable`,
    );
  }
  assert.ok(
    values.filter((token) => token.value === 'color_variable' && token.tokenType === 'ideaVariable').length >= 3,
  );
});

test('class, interface, struct and related declaration targets receive semantic tokens', () => {
  const text = [
    'export class UserProfile {}',
    'interface UserShape {}',
    'export enum UserRole {}',
    'export type UserId = string;',
    'export struct NativeRecord {}',
    'trait Renderable {}',
    'protocol Codable {}',
    'object Registry {}',
    'record Point(int x, int y) {}',
    'type GoRecord struct {}',
    'type GoContract interface {}',
    'using FileHandle = int;',
  ].join('\n');
  const tokens = helpers.mergeIdeaLightSemanticTokens(helpers.collectIdeaLightHeuristicSemanticTokens(text));
  const lines = text.split('\n');
  const declarations = tokens
    .filter((token) => ['ideaClass', 'ideaInterface', 'ideaEnum', 'ideaTypeAlias'].includes(token.tokenType))
    .map((token) => ({
      value: (lines[token.line] ?? '').slice(token.startCharacter, token.startCharacter + token.length),
      tokenType: token.tokenType,
    }));
  assert.deepEqual(declarations, [
    { value: 'UserProfile', tokenType: 'ideaClass' },
    { value: 'UserShape', tokenType: 'ideaInterface' },
    { value: 'UserRole', tokenType: 'ideaEnum' },
    { value: 'UserId', tokenType: 'ideaTypeAlias' },
    { value: 'NativeRecord', tokenType: 'ideaClass' },
    { value: 'Renderable', tokenType: 'ideaInterface' },
    { value: 'Codable', tokenType: 'ideaInterface' },
    { value: 'Registry', tokenType: 'ideaClass' },
    { value: 'Point', tokenType: 'ideaClass' },
    { value: 'GoRecord', tokenType: 'ideaClass' },
    { value: 'GoContract', tokenType: 'ideaInterface' },
    { value: 'FileHandle', tokenType: 'ideaTypeAlias' },
  ]);
});

test('typed-language fields, methods, parameters and locals use the shared IDEA token categories', () => {
  const text = [
    'public class JavaVisible {',
    '  private String fieldValue;',
    '  public String renderJava(String inputValue) {',
    '    String localValue = inputValue;',
    '    return localValue;',
    '  }',
    '}',
    'class KotlinVisible(val kotlinField: String) {',
    '  fun renderKotlin(kotlinInput: String): String {',
    '    val kotlinLocal = kotlinInput',
    '    return kotlinLocal',
    '  }',
    '}',
    'public class CSharpVisible { public string CSharpField { get; set; } public string RenderCSharp(string csharpInput) { var csharpLocal = csharpInput; return csharpLocal; } }',
    'struct SwiftVisible {',
    '  let swiftField: String',
    '  func renderSwift(swiftInput: String) -> String {',
    '    let swiftLocal = swiftInput',
    '    return swiftLocal',
    '  }',
    '}',
  ].join('\n');
  const tokens = helpers.mergeIdeaLightSemanticTokens(helpers.collectIdeaLightHeuristicSemanticTokens(text));
  const lines = text.split('\n');
  const declarations = tokens
    .map((token) => ({
      value: (lines[token.line] ?? '').slice(token.startCharacter, token.startCharacter + token.length),
      tokenType: token.tokenType,
    }))
    .filter((token) =>
      [
        'fieldValue',
        'renderJava',
        'inputValue',
        'localValue',
        'kotlinField',
        'renderKotlin',
        'kotlinInput',
        'kotlinLocal',
        'CSharpField',
        'RenderCSharp',
        'csharpInput',
        'csharpLocal',
        'swiftField',
        'renderSwift',
        'swiftInput',
        'swiftLocal',
      ].includes(token.value),
    );
  assert.deepEqual(declarations, [
    { value: 'fieldValue', tokenType: 'ideaProperty' },
    { value: 'renderJava', tokenType: 'ideaMethod' },
    { value: 'inputValue', tokenType: 'ideaParameter' },
    { value: 'localValue', tokenType: 'ideaVariable' },
    { value: 'localValue', tokenType: 'ideaVariable' },
    { value: 'kotlinField', tokenType: 'ideaProperty' },
    { value: 'renderKotlin', tokenType: 'ideaMethod' },
    { value: 'kotlinInput', tokenType: 'ideaParameter' },
    { value: 'kotlinLocal', tokenType: 'ideaVariable' },
    { value: 'kotlinLocal', tokenType: 'ideaVariable' },
    { value: 'CSharpField', tokenType: 'ideaProperty' },
    { value: 'RenderCSharp', tokenType: 'ideaMethod' },
    { value: 'csharpInput', tokenType: 'ideaParameter' },
    { value: 'csharpLocal', tokenType: 'ideaVariable' },
    { value: 'csharpLocal', tokenType: 'ideaVariable' },
    { value: 'swiftField', tokenType: 'ideaProperty' },
    { value: 'renderSwift', tokenType: 'ideaMethod' },
    { value: 'swiftInput', tokenType: 'ideaParameter' },
    { value: 'swiftLocal', tokenType: 'ideaVariable' },
    { value: 'swiftLocal', tokenType: 'ideaVariable' },
  ]);
});

test('range semantic tokens are clipped to the requested document window', () => {
  const clipped = helpers.clipIdeaLightSemanticTokensToRange(
    [
      { line: 2, startCharacter: 0, length: 8, tokenType: 'ideaClass', priority: 1 },
      { line: 5, startCharacter: 3, length: 9, tokenType: 'ideaMethod', priority: 1 },
      { line: 7, startCharacter: 0, length: 4, tokenType: 'ideaClass', priority: 1 },
    ],
    {
      startLine: 5,
      startCharacter: 2,
      endLine: 8,
      endCharacter: 8,
    },
    3,
  );
  assert.deepEqual(clipped, [
    { line: 5, startCharacter: 2, length: 6, tokenType: 'ideaClass', priority: 1 },
    { line: 8, startCharacter: 3, length: 5, tokenType: 'ideaMethod', priority: 1 },
  ]);
});

test('type parameter hints color declarations without coloring their bounds', () => {
  const text = 'function renderUser<T extends User, K extends keyof User>(user: T) { return user; }';
  const tokens = helpers.collectIdeaLightHeuristicSemanticTokens(text);
  const typeParameters = tokens
    .filter((token) => token.tokenType === 'ideaTypeParameter')
    .map((token) => text.slice(token.startCharacter, token.startCharacter + token.length));
  assert.deepEqual(typeParameters, ['T', 'K']);
});

test('JSX component tags receive the IDEA custom-tag token without coloring HTML tags', () => {
  const text = 'const node = <UserCard user={user}><div /></UserCard>;';
  const tokens = helpers.collectIdeaLightHeuristicSemanticTokens(text);
  const jsxTags = tokens
    .filter((token) => token.tokenType === 'ideaJsxComponent')
    .map((token) => text.slice(token.startCharacter, token.startCharacter + token.length));
  assert.deepEqual(jsxTags, ['UserCard', 'UserCard']);
});

test('decorators receive the IDEA annotation token', () => {
  const text = '@Component({ selector: "panel" }) class Panel { @Input() value: string; }';
  const tokens = helpers.collectIdeaLightHeuristicSemanticTokens(text);
  const annotations = tokens
    .filter((token) => token.tokenType === 'ideaAnnotation')
    .map((token) => text.slice(token.startCharacter, token.startCharacter + token.length));
  assert.deepEqual(annotations, ['Component', 'Input']);
});

test('qualified return type members keep the class token instead of property coloring', () => {
  const text = 'function renderUser<T extends User>(user: T): React.ReactNode { return null; }';
  const tokens = helpers.mergeIdeaLightSemanticTokens(helpers.collectIdeaLightHeuristicSemanticTokens(text));
  const reactNodeTokens = tokens.filter((token) => {
    const value = text.slice(token.startCharacter, token.startCharacter + token.length);
    return value === 'ReactNode';
  });
  assert.deepEqual(
    reactNodeTokens.map((token) => token.tokenType),
    ['ideaClass'],
  );
});

test('interface, type-literal and object-literal keys receive property coloring', () => {
  const text = [
    'interface UserShape {',
    '  readonly userId: string;',
    '  displayName?: string;',
    '  renderValue(input: string): string;',
    '}',
    'type UserConfig = { retryCount: number; timeoutMs: number };',
    'const runtimeConfig = { baseUrl: "/api", retryCount: 3 };',
  ].join('\n');
  const tokens = helpers.mergeIdeaLightSemanticTokens(helpers.collectIdeaLightHeuristicSemanticTokens(text));
  const lines = text.split('\n');
  const declarations = tokens
    .map((token) => ({
      value: (lines[token.line] ?? '').slice(token.startCharacter, token.startCharacter + token.length),
      tokenType: token.tokenType,
    }))
    .filter((token) =>
      ['userId', 'displayName', 'renderValue', 'retryCount', 'timeoutMs', 'baseUrl'].includes(token.value),
    );
  assert.deepEqual(declarations, [
    { value: 'userId', tokenType: 'ideaProperty' },
    { value: 'displayName', tokenType: 'ideaProperty' },
    { value: 'renderValue', tokenType: 'ideaMethod' },
    { value: 'retryCount', tokenType: 'ideaProperty' },
    { value: 'timeoutMs', tokenType: 'ideaProperty' },
    { value: 'baseUrl', tokenType: 'ideaProperty' },
    { value: 'retryCount', tokenType: 'ideaProperty' },
  ]);
});

test('destructuring aliases use property and variable colors, while enum members use constants', () => {
  const text = [
    'const { profile: selectedProfile, count } = source;',
    'enum Status { Ready = 1, Done, Failed = "failed" }',
    'enum State { READY, DONE(1); State() {} }',
    'enum Event { case started, finished }',
  ].join('\n');
  const tokens = helpers.mergeIdeaLightSemanticTokens(helpers.collectIdeaLightHeuristicSemanticTokens(text));
  const lines = text.split('\n');
  const declarations = tokens
    .map((token) => ({
      value: (lines[token.line] ?? '').slice(token.startCharacter, token.startCharacter + token.length),
      tokenType: token.tokenType,
    }))
    .filter((token) =>
      [
        'profile',
        'selectedProfile',
        'count',
        'Ready',
        'Done',
        'Failed',
        'READY',
        'DONE',
        'started',
        'finished',
      ].includes(token.value),
    );
  assert.deepEqual(declarations, [
    { value: 'profile', tokenType: 'ideaProperty' },
    { value: 'selectedProfile', tokenType: 'ideaVariable' },
    { value: 'count', tokenType: 'ideaVariable' },
    { value: 'Ready', tokenType: 'ideaConstant' },
    { value: 'Done', tokenType: 'ideaConstant' },
    { value: 'Failed', tokenType: 'ideaConstant' },
    { value: 'READY', tokenType: 'ideaConstant' },
    { value: 'DONE', tokenType: 'ideaConstant' },
    { value: 'started', tokenType: 'ideaConstant' },
    { value: 'finished', tokenType: 'ideaConstant' },
  ]);
});

test('imports, object methods, accessors, nested destructuring and untyped class fields use declaration colors', () => {
  const text = [
    'import defaultExport, { foo as bar } from "./module";',
    'const service = {',
    '  renderValue(input) { return input; },',
    '  async loadData() {},',
    '  get currentValue() { return this.value; },',
    '  set currentValue(value) { this.value = value; },',
    '};',
    'class CacheStore {',
    '  static count = 0;',
    '  private cache = new Map();',
    '  #secret = "hidden";',
    '  readonly ready: boolean;',
    '  constructor(private readonly ownerId: string) {}',
    '  static { this.count += 1; }',
    '}',
    'const [[first], { profile: selectedProfile, nested: [, second] }] = rows;',
    'enum State { IDLE, RUNNING = "running" }',
  ].join('\n');
  const tokens = helpers.mergeIdeaLightSemanticTokens(helpers.collectIdeaLightHeuristicSemanticTokens(text));
  const lines = text.split('\n');
  const declarations = tokens
    .map((token) => ({
      value: (lines[token.line] ?? '').slice(token.startCharacter, token.startCharacter + token.length),
      tokenType: token.tokenType,
    }))
    .filter((token) =>
      [
        'defaultExport',
        'foo',
        'bar',
        'renderValue',
        'loadData',
        'currentValue',
        'count',
        'cache',
        'secret',
        'ready',
        'ownerId',
        'first',
        'profile',
        'selectedProfile',
        'nested',
        'second',
        'IDLE',
        'RUNNING',
      ].includes(token.value),
    );
  assert.deepEqual(declarations, [
    { value: 'defaultExport', tokenType: 'ideaGlobalVariable' },
    { value: 'foo', tokenType: 'ideaGlobalVariable' },
    { value: 'bar', tokenType: 'ideaGlobalVariable' },
    { value: 'renderValue', tokenType: 'ideaMethod' },
    { value: 'loadData', tokenType: 'ideaMethod' },
    { value: 'currentValue', tokenType: 'ideaMethod' },
    { value: 'currentValue', tokenType: 'ideaMethod' },
    { value: 'count', tokenType: 'ideaProperty' },
    { value: 'cache', tokenType: 'ideaProperty' },
    { value: 'secret', tokenType: 'ideaProperty' },
    { value: 'ready', tokenType: 'ideaProperty' },
    { value: 'ownerId', tokenType: 'ideaParameter' },
    { value: 'count', tokenType: 'ideaProperty' },
    { value: 'first', tokenType: 'ideaVariable' },
    { value: 'profile', tokenType: 'ideaProperty' },
    { value: 'selectedProfile', tokenType: 'ideaVariable' },
    { value: 'nested', tokenType: 'ideaProperty' },
    { value: 'second', tokenType: 'ideaVariable' },
    { value: 'IDLE', tokenType: 'ideaConstant' },
    { value: 'RUNNING', tokenType: 'ideaConstant' },
  ]);
});

test('class field templates do not promote method locals or static-block locals to properties', () => {
  const text = [
    'class CacheStore {',
    '  actualField = 1;',
    '  renderLocal() {',
    '    const methodLocal = this.actualField;',
    '    return methodLocal;',
    '  }',
    '  static {',
    '    const blockLocal = 1;',
    '    this.blockTotal = blockLocal;',
    '  }',
    '}',
  ].join('\n');
  const tokens = helpers.mergeIdeaLightSemanticTokens(helpers.collectIdeaLightHeuristicSemanticTokens(text));
  const lines = text.split('\n');
  const properties = tokens
    .filter((token) => token.tokenType === 'ideaProperty')
    .map((token) => (lines[token.line] ?? '').slice(token.startCharacter, token.startCharacter + token.length));
  assert.deepEqual(properties, ['actualField', 'actualField', 'blockTotal']);
});

test('Rust visibility-qualified functions color parameters without treating pointer const as a variable', () => {
  const text = [
    '#[no_mangle]',
    'pub extern "C" fn session_request(holder: *mut HttpSession, url: *const u8, headers: *const u8, body: *const u8, timeout: u64) -> *mut c_char {',
    '  let session = Box::new(HttpSession::new());',
    '  Box::into_raw(session)',
    '}',
    'pub struct HttpSession {',
    '  name: String,',
    '  client: Client,',
    '}',
    'impl HttpSession {',
    '  pub(crate) fn fetch(&mut self, url: String, headers: Option<String>, timeout: u64) -> String {',
    '    let local = url;',
    '    local',
    '  }',
    '}',
  ].join('\n');
  const tokens = helpers.mergeIdeaLightSemanticTokens(helpers.collectIdeaLightHeuristicSemanticTokens(text));
  const lines = text.split('\n');
  const declarations = tokens
    .map((token) => ({
      value: (lines[token.line] ?? '').slice(token.startCharacter, token.startCharacter + token.length),
      tokenType: token.tokenType,
    }))
    .filter((token) =>
      [
        'session_request',
        'holder',
        'url',
        'headers',
        'body',
        'timeout',
        'u8',
        'HttpSession',
        'name',
        'client',
        'fetch',
        'local',
      ].includes(token.value),
    );
  assert.deepEqual(declarations, [
    { value: 'session_request', tokenType: 'ideaMethod' },
    { value: 'holder', tokenType: 'ideaParameter' },
    { value: 'url', tokenType: 'ideaParameter' },
    { value: 'headers', tokenType: 'ideaParameter' },
    { value: 'body', tokenType: 'ideaParameter' },
    { value: 'timeout', tokenType: 'ideaParameter' },
    { value: 'HttpSession', tokenType: 'ideaClass' },
    { value: 'name', tokenType: 'ideaProperty' },
    { value: 'client', tokenType: 'ideaProperty' },
    { value: 'fetch', tokenType: 'ideaMethod' },
    { value: 'url', tokenType: 'ideaParameter' },
    { value: 'headers', tokenType: 'ideaParameter' },
    { value: 'timeout', tokenType: 'ideaParameter' },
    { value: 'local', tokenType: 'ideaVariable' },
  ]);
  assert.equal(
    declarations.some((token) => token.value === 'u8' && token.tokenType === 'ideaVariable'),
    false,
  );
});

test('Rust lifetimes do not mask the declarations that follow them', () => {
  const text = [
    "pub struct Reader<'a> {",
    "  value: &'a str,",
    '}',
    '',
    "impl<'a> Reader<'a> {",
    "  pub fn value(&self, input: &'a str) -> &'a str {",
    '    let local = input;',
    '    local',
    '  }',
    '}',
    '',
    "pub trait Source<'a> {",
    "  fn read(&mut self, key: &'a str) -> &'a str;",
    '}',
  ].join('\n');
  const tokens = helpers.mergeIdeaLightSemanticTokens(helpers.collectIdeaLightHeuristicSemanticTokens(text, 'rust'));
  const lines = text.split('\n');
  const declarations = tokens
    .map((token) => ({
      value: (lines[token.line] ?? '').slice(token.startCharacter, token.startCharacter + token.length),
      tokenType: token.tokenType,
    }))
    .filter((token) => ['Reader', 'value', 'self', 'input', 'local', 'Source', 'read', 'key'].includes(token.value));
  assert.deepEqual(declarations, [
    { value: 'Reader', tokenType: 'ideaClass' },
    { value: 'value', tokenType: 'ideaProperty' },
    { value: 'Reader', tokenType: 'ideaClass' },
    { value: 'value', tokenType: 'ideaMethod' },
    { value: 'self', tokenType: 'ideaParameter' },
    { value: 'input', tokenType: 'ideaParameter' },
    { value: 'local', tokenType: 'ideaVariable' },
    { value: 'Source', tokenType: 'ideaInterface' },
    { value: 'read', tokenType: 'ideaMethod' },
    { value: 'self', tokenType: 'ideaParameter' },
    { value: 'key', tokenType: 'ideaParameter' },
  ]);
});

test('single-quoted strings keep masking identifiers in non-Rust languages', () => {
  const text = "const label = 'value: string'; const actual = true;";
  const tokens = helpers.mergeIdeaLightSemanticTokens(helpers.collectIdeaLightHeuristicSemanticTokens(text));
  const propertyValues = tokens
    .filter((token) => token.tokenType === 'ideaProperty')
    .map((token) => text.slice(token.startCharacter, token.startCharacter + token.length));
  assert.deepEqual(propertyValues, []);
});

test('Rust generic parameters and where constraints use type-parameter coloring', () => {
  const text = [
    "pub trait Source<'a, T>",
    'where',
    '    T: Clone,',
    '{',
    "    fn read(&mut self, key: &'a str) -> Option<T>;",
    '}',
    '',
    "pub struct Reader<'a, T>",
    'where',
    '    T: Clone,',
    '{',
    "    value: &'a T,",
    '}',
    '',
    "impl<'a, T> Reader<'a, T>",
    'where',
    '    T: Clone,',
    '{',
    "    pub fn read(&mut self, key: &'a str) -> Option<T> {",
    '        let local = self.value;',
    '        None',
    '    }',
    '}',
  ].join('\n');
  const tokens = helpers.mergeIdeaLightSemanticTokens(helpers.collectIdeaLightHeuristicSemanticTokens(text, 'rust'));
  const lines = text.split('\n');
  const declarations = tokens.map((token) => ({
    value: (lines[token.line] ?? '').slice(token.startCharacter, token.startCharacter + token.length),
    tokenType: token.tokenType,
  }));
  assert.deepEqual(
    declarations.filter((token) => token.value === 'T').map((token) => token.tokenType),
    Array.from({ length: 6 }, () => 'ideaTypeParameter'),
  );
  assert.deepEqual(
    declarations.filter((token) => ['Source', 'Reader', 'value', 'read', 'key', 'local'].includes(token.value)),
    [
      { value: 'Source', tokenType: 'ideaInterface' },
      { value: 'read', tokenType: 'ideaMethod' },
      { value: 'key', tokenType: 'ideaParameter' },
      { value: 'Reader', tokenType: 'ideaClass' },
      { value: 'value', tokenType: 'ideaProperty' },
      { value: 'Reader', tokenType: 'ideaClass' },
      { value: 'read', tokenType: 'ideaMethod' },
      { value: 'key', tokenType: 'ideaParameter' },
      { value: 'local', tokenType: 'ideaVariable' },
      { value: 'value', tokenType: 'ideaProperty' },
    ],
  );
});

test('Rust impl targets color trait and implementing type declarations', () => {
  const text = [
    'use std::fmt::{Display, Formatter};',
    '',
    'pub struct Reader;',
    '',
    'impl Display for Reader {',
    "    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {",
    '        write!(formatter, "reader")',
    '    }',
    '}',
    '',
    'pub trait Source {',
    '    type Item;',
    '    fn item(&self) -> Self::Item;',
    '}',
  ].join('\n');
  const tokens = helpers.mergeIdeaLightSemanticTokens(helpers.collectIdeaLightHeuristicSemanticTokens(text, 'rust'));
  const lines = text.split('\n');
  const implTargets = tokens
    .filter((token) => token.line === 4)
    .map((token) => ({
      value: (lines[token.line] ?? '').slice(token.startCharacter, token.startCharacter + token.length),
      tokenType: token.tokenType,
    }))
    .filter((token) => ['Display', 'Reader'].includes(token.value));
  assert.deepEqual(implTargets, [
    { value: 'Display', tokenType: 'ideaInterface' },
    { value: 'Reader', tokenType: 'ideaClass' },
  ]);
  assert.deepEqual(
    tokens
      .filter((token) =>
        ['Source', 'Item', 'item'].includes(
          lines[token.line]?.slice(token.startCharacter, token.startCharacter + token.length),
        ),
      )
      .map((token) => token.tokenType),
    ['ideaInterface', 'ideaTypeAlias', 'ideaMethod'],
  );
});

test('C and C++ namespaces, parameters and type members use semantic colors', () => {
  const text = [
    '#include "../include/widget.hpp"',
    'namespace app {',
    'struct Point { int x; int y; };',
    'class Widget {',
    'public:',
    '  Widget(int id);',
    '  int render(const Point& point) const;',
    'private:',
    '  int id_;',
    '};',
    'int helper(int value) {',
    '  return value;',
    '}',
    '}',
  ].join('\n');
  const tokens = helpers.mergeIdeaLightSemanticTokens(helpers.collectIdeaLightHeuristicSemanticTokens(text, 'cpp'));
  const lines = text.split('\n');
  const declarations = tokens.map((token) => ({
    value: (lines[token.line] ?? '').slice(token.startCharacter, token.startCharacter + token.length),
    tokenType: token.tokenType,
  }));
  assert.deepEqual(
    declarations.filter((token) =>
      ['app', 'Point', 'Widget', 'x', 'y', 'id', 'render', 'point', 'id_', 'helper', 'value'].includes(token.value),
    ),
    [
      { value: 'app', tokenType: 'ideaModule' },
      { value: 'Point', tokenType: 'ideaClass' },
      { value: 'x', tokenType: 'ideaProperty' },
      { value: 'y', tokenType: 'ideaProperty' },
      { value: 'Widget', tokenType: 'ideaClass' },
      { value: 'Widget', tokenType: 'ideaMethod' },
      { value: 'id', tokenType: 'ideaParameter' },
      { value: 'render', tokenType: 'ideaMethod' },
      { value: 'point', tokenType: 'ideaParameter' },
      { value: 'id_', tokenType: 'ideaProperty' },
      { value: 'helper', tokenType: 'ideaMethod' },
      { value: 'value', tokenType: 'ideaParameter' },
      { value: 'value', tokenType: 'ideaVariable' },
    ],
  );
  assert.equal(
    declarations.some(
      (token) => ['public', 'private', 'protected'].includes(token.value) && token.tokenType === 'ideaProperty',
    ),
    false,
  );
});

test('C headers color prototypes, parameters and aggregate fields', () => {
  const text = ['#pragma once', 'struct Pair { int x; int y; };', 'int helper(int value);'].join('\n');
  const tokens = helpers.mergeIdeaLightSemanticTokens(helpers.collectIdeaLightHeuristicSemanticTokens(text, 'c'));
  const lines = text.split('\n');
  const declarations = tokens.map((token) => ({
    value: (lines[token.line] ?? '').slice(token.startCharacter, token.startCharacter + token.length),
    tokenType: token.tokenType,
  }));
  assert.deepEqual(
    declarations.filter((token) => ['Pair', 'x', 'y', 'helper', 'value'].includes(token.value)),
    [
      { value: 'Pair', tokenType: 'ideaClass' },
      { value: 'x', tokenType: 'ideaProperty' },
      { value: 'y', tokenType: 'ideaProperty' },
      { value: 'helper', tokenType: 'ideaMethod' },
      { value: 'value', tokenType: 'ideaParameter' },
    ],
  );
});

test('C++ templates, inheritance and qualified definitions use declaration roles', () => {
  const text = [
    'template <class T>',
    'class Widget final : public Base<T> {',
    'public:',
    '  Widget* next;',
    '  const Config& config_;',
    '  T value;',
    '};',
    'Widget::Widget(int id) {}',
    'int Widget::render(const Point& point) const { return point.x; }',
  ].join('\n');
  const tokens = helpers.mergeIdeaLightSemanticTokens(helpers.collectIdeaLightHeuristicSemanticTokens(text, 'cpp'));
  const lines = text.split('\n');
  const tokenAt = (line, value) =>
    tokens
      .filter(
        (token) =>
          token.line === line &&
          lines[line]?.slice(token.startCharacter, token.startCharacter + token.length) === value,
      )
      .map((token) => token.tokenType);

  assert.deepEqual(tokenAt(0, 'T'), ['ideaTypeParameter']);
  assert.ok(tokenAt(1, 'Widget').includes('ideaClass'));
  assert.ok(tokenAt(1, 'Base').includes('ideaClass'));
  assert.deepEqual(tokenAt(3, 'next'), ['ideaProperty']);
  assert.deepEqual(tokenAt(4, 'config_'), ['ideaProperty']);
  assert.deepEqual(tokenAt(5, 'value'), ['ideaProperty']);
  assert.ok(tokenAt(7, 'Widget').includes('ideaClass'));
  assert.ok(tokenAt(7, 'Widget').includes('ideaMethod'));
  assert.equal(tokenAt(7, 'Widget').includes('ideaProperty'), false);
  assert.ok(tokenAt(8, 'Widget').includes('ideaClass'));
  assert.deepEqual(tokenAt(8, 'render'), ['ideaMethod']);
  assert.ok(tokenAt(8, 'point').includes('ideaParameter'));
});

test('C++ operators, function-pointer parameters and initializer members keep IDEA roles', () => {
  const text = [
    'class Point {',
    'public:',
    '  bool operator==(const Point& other) const;',
    '  Point& operator+=(const Point& rhs);',
    '  explicit operator bool() const;',
    '};',
    '',
    'using Callback = int (*)(int value, const Point& point);',
    '',
    'Point operator+(const Point& left, const Point& right);',
    'void register_callback(int (*callback)(int value), const Point& point);',
    '',
    'class Widget {',
    'public:',
    '  Widget(int id, const Point& origin);',
    'private:',
    '  Point origin_;',
    '  Callback callback_;',
    '};',
    '',
    'Widget::Widget(int id, const Point& origin) : origin_(origin) {}',
    '',
    'bool Point::operator==(const Point& other) const { return x == other.x; }',
  ].join('\n');
  const tokens = helpers.mergeIdeaLightSemanticTokens(helpers.collectIdeaLightHeuristicSemanticTokens(text, 'cpp'));
  const lines = text.split('\n');
  const tokenAt = (line, value) =>
    tokens
      .filter(
        (token) =>
          token.line === line &&
          lines[line]?.slice(token.startCharacter, token.startCharacter + token.length) === value,
      )
      .map((token) => token.tokenType);

  assert.deepEqual(tokenAt(2, 'operator=='), ['ideaMethod']);
  assert.ok(tokenAt(2, 'other').includes('ideaParameter'));
  assert.deepEqual(tokenAt(3, 'operator+='), ['ideaMethod']);
  assert.deepEqual(tokenAt(4, 'operator bool'), ['ideaMethod']);
  assert.deepEqual(tokenAt(7, 'int'), []);
  assert.deepEqual(tokenAt(9, 'operator+'), ['ideaMethod']);
  assert.ok(tokenAt(9, 'left').includes('ideaParameter'));
  assert.ok(tokenAt(9, 'right').includes('ideaParameter'));
  assert.deepEqual(tokenAt(10, 'register_callback'), ['ideaMethod']);
  assert.ok(tokenAt(10, 'callback').includes('ideaParameter'));
  assert.ok(tokenAt(10, 'point').includes('ideaParameter'));
  assert.equal(tokenAt(10, 'value').includes('ideaParameter'), false);
  assert.ok(tokenAt(20, 'origin_').includes('ideaProperty'));
  assert.ok(tokenAt(22, 'Point').includes('ideaClass'));
  assert.deepEqual(tokenAt(22, 'operator=='), ['ideaMethod']);
  assert.ok(tokenAt(22, 'other').includes('ideaParameter'));
});

test('C++ macros and advanced parameter declarations keep IDEA roles', () => {
  const text = [
    '#define MAX(a, b) ((a) > (b) ? (a) : (b))',
    '#define HANDLE_NAME "sample"',
    '#define CALLBACK(fn) fn',
    '',
    '#if defined(ENABLE_TRACE) && !defined(DISABLE_TRACE)',
    'void trace(const char* message);',
    '#endif',
    '',
    'void register_handler(void (Widget::*callback)(int value), int numbers[4], int timeout = 10);',
    'void register_unnamed(int (*)(int), const Point& point);',
  ].join('\n');
  const tokens = helpers.mergeIdeaLightSemanticTokens(helpers.collectIdeaLightHeuristicSemanticTokens(text, 'cpp'));
  const lines = text.split('\n');
  const tokenAt = (line, value) =>
    tokens
      .filter(
        (token) =>
          token.line === line &&
          lines[line]?.slice(token.startCharacter, token.startCharacter + token.length) === value,
      )
      .map((token) => token.tokenType);

  assert.deepEqual(tokenAt(0, 'MAX'), ['ideaMethod']);
  assert.ok(tokenAt(0, 'a').includes('ideaParameter'));
  assert.ok(tokenAt(0, 'b').includes('ideaParameter'));
  assert.deepEqual(tokenAt(1, 'HANDLE_NAME'), ['ideaConstant']);
  assert.deepEqual(tokenAt(2, 'CALLBACK'), ['ideaMethod']);
  assert.ok(tokenAt(2, 'fn').includes('ideaParameter'));
  assert.ok(tokenAt(4, 'ENABLE_TRACE').includes('ideaConstant'));
  assert.ok(tokenAt(4, 'DISABLE_TRACE').includes('ideaConstant'));
  assert.deepEqual(tokenAt(5, 'trace'), ['ideaMethod']);
  assert.ok(tokenAt(5, 'message').includes('ideaParameter'));
  assert.deepEqual(tokenAt(8, 'register_handler'), ['ideaMethod']);
  assert.ok(tokenAt(8, 'callback').includes('ideaParameter'));
  assert.ok(tokenAt(8, 'numbers').includes('ideaParameter'));
  assert.ok(tokenAt(8, 'timeout').includes('ideaParameter'));
  assert.equal(tokenAt(8, 'value').includes('ideaParameter'), false);
  assert.deepEqual(tokenAt(9, 'register_unnamed'), ['ideaMethod']);
  assert.ok(tokenAt(9, 'point').includes('ideaParameter'));
});

test('C++ multiline, stringified and pasted macro parameters stay parameters', () => {
  const text = [
    '#define TRACE_CALL(fn, value) \\',
    '  do { fn(value); } while (0)',
    '#define PASTE(a, b) a##b',
    '#define STRINGIFY(x) #x',
    '#define CALL_MAX(a, b) MAX(a, b)',
  ].join('\n');
  const tokens = helpers.mergeIdeaLightSemanticTokens(helpers.collectIdeaLightHeuristicSemanticTokens(text, 'cpp'));
  const lines = text.split('\n');
  const tokenAt = (line, value) =>
    tokens
      .filter(
        (token) =>
          token.line === line &&
          lines[line]?.slice(token.startCharacter, token.startCharacter + token.length) === value,
      )
      .map((token) => token.tokenType);

  assert.deepEqual(tokenAt(0, 'TRACE_CALL'), ['ideaMethod']);
  assert.ok(tokenAt(0, 'fn').includes('ideaParameter'));
  assert.ok(tokenAt(0, 'value').includes('ideaParameter'));
  assert.deepEqual(tokenAt(1, 'fn'), ['ideaParameter']);
  assert.deepEqual(tokenAt(1, 'value'), ['ideaParameter']);
  assert.ok(tokenAt(2, 'a').includes('ideaParameter'));
  assert.ok(tokenAt(2, 'b').includes('ideaParameter'));
  assert.ok(tokenAt(3, 'x').includes('ideaParameter'));
  assert.ok(tokenAt(4, 'a').includes('ideaParameter'));
  assert.ok(tokenAt(4, 'b').includes('ideaParameter'));
});

test('preview text ranges preserve IDEA variable and method foregrounds', () => {
  const text = 'const endValue = buildValue();';
  const ranges = helpers.ideLightTextStyleRanges(text);
  assert.deepEqual(
    ranges.map((range) => ({
      text: text.slice(range.start, range.end),
      foreground: range.foreground,
      fontStyle: range.fontStyle,
    })),
    [
      { text: 'endValue', foreground: '#458383', fontStyle: undefined },
      { text: 'buildValue', foreground: '#914c07', fontStyle: undefined },
    ],
  );
});

test('semantic token types resolve to shared decoration class names', () => {
  assert.equal(helpers.ideaLightSemanticTokenClass('ideaVariable'), 'dsh-idea-token-variable');
  assert.equal(helpers.ideaLightSemanticTokenClass('ideaMethod'), 'dsh-idea-token-method');
  assert.equal(helpers.ideaLightSemanticTokenClass('ideaGlobalVariable'), 'dsh-idea-token-global-variable');
  assert.equal(helpers.ideaLightSemanticTokenClass('unknownToken'), null);
});
