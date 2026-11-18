import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { extractJavaScriptFunctionSource } from './ts-source.mjs';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const findBarSource = await readFile(
  new URL('../src/client/components/editor/EditorFindBar.tsx', import.meta.url),
  'utf8',
);

function extractSource(name) {
  return extractJavaScriptFunctionSource(source, name);
}

function buildFunctions(names) {
  return new Function(`${names.map(extractSource).join('\n')}\nreturn { ${names.join(', ')} };`)();
}

test('editor literal replacements preserve all-upper, all-lower and title case', () => {
  const { editorReplaceAll } = buildFunctions([
    'editorFindResult',
    'editorReplaceAll',
    'editorReplaceAt',
    'editorApplyPreserveCase',
    'editorRegexReplacementText',
  ]);
  const all = editorReplaceAll('foo FOO Foo fOo', 'foo', 'bar', {
    caseSensitive: false,
    preserveCase: true,
  });
  assert.equal(all.error, null);
  assert.equal(all.count, 4);
  assert.equal(all.text, 'bar BAR Bar bar');

  const off = editorReplaceAll('foo FOO Foo', 'foo', 'bar', {
    caseSensitive: false,
    preserveCase: false,
  });
  assert.equal(off.text, 'bar bar bar');
});

test('editor single replacement follows the matched occurrence casing', () => {
  const { editorReplaceAt } = buildFunctions([
    'editorFindResult',
    'editorReplaceAll',
    'editorReplaceAt',
    'editorApplyPreserveCase',
    'editorRegexReplacementText',
  ]);
  const text = 'foo FOO Foo';
  const one = editorReplaceAt(text, 'foo', 'name', 4, {
    caseSensitive: false,
    preserveCase: true,
  });
  assert.equal(one.error, null);
  assert.equal(one.text, 'foo NAME Foo');
  assert.equal(one.replacementText, 'NAME');
});

test('editor Regex replacement expands captures before preserving case', () => {
  const { editorReplaceAll, editorReplaceAt } = buildFunctions([
    'editorFindResult',
    'editorReplaceAll',
    'editorReplaceAt',
    'editorApplyPreserveCase',
    'editorRegexReplacementText',
  ]);
  const text = 'foo-12 FOO-34 Foo-56 fOo-78';
  const all = editorReplaceAll(text, '(foo)-(\\d+)', 'id-$2', {
    regex: true,
    caseSensitive: false,
    preserveCase: true,
  });
  assert.equal(all.text, 'id-12 ID-34 Id-56 id-78');

  const one = editorReplaceAt(text, '(foo)-(\\d+)', 'id-$2', 7, {
    regex: true,
    caseSensitive: false,
    preserveCase: true,
  });
  assert.equal(one.text, 'foo-12 ID-34 Foo-56 fOo-78');
});

test('selection-scoped editor replacement uses the same case adapter', () => {
  const { editorReplaceAll } = buildFunctions([
    'editorFindResult',
    'editorReplaceAll',
    'editorReplaceAt',
    'editorApplyPreserveCase',
    'editorRegexReplacementText',
  ]);
  const text = 'foo FOO Foo foo';
  const result = editorReplaceAll(text, 'foo', 'bar', {
    caseSensitive: false,
    preserveCase: true,
    scope: { start: 4, end: 11 },
  });
  assert.equal(result.count, 2);
  assert.equal(result.text, 'foo BAR Bar foo');
});

test('editor Replace row exposes Preserve case with the shared persisted option', () => {
  assert.match(
    findBarSource,
    /state\.withReplace === true[\s\S]*?icon='preserveCase'[\s\S]*?label=\{t\('editor\.searchPreserveCase'\)\}[\s\S]*?active=\{state\.preserveCase === true\}/s,
  );
  assert.match(source, /writeSearchOptions\(\{ \.\.\.readSearchOptions\(\), \.\.\.replaceState \}\)/);
  assert.match(source, /replaceState\?\.preserveCase/);
  assert.match(source, /preserveCase: savedOptions\.preserveCase/);
});
