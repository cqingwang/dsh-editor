import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const source = await readFile(
  new URL('../src/client/components/editor/editor-theme-model.ts', import.meta.url),
  'utf8',
);
const helpers = loadTypeScriptModule(source, [
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
  assert.deepEqual(reactNodeTokens.map((token) => token.tokenType), ['ideaClass']);
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
