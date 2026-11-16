import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extractSource(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`unterminated ${name}`);
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
  const findBar = source.slice(
    source.indexOf("'div',\n                    { style: styles.findBar }"),
    source.indexOf('monacoError !== null', source.indexOf("'div',\n                    { style: styles.findBar }")),
  );
  assert.match(findBar, /replaceState\.withReplace === true\s*\? React\.createElement\(ToolbarButton, \{\s*icon: 'preserveCase',\s*label: t\('editor\.searchPreserveCase'\),\s*active: replaceState\.preserveCase === true/s);
  assert.match(source, /writeSearchOptions\(\{ \.\.\.readSearchOptions\(\), \.\.\.replaceState \}\)/);
  assert.match(source, /replaceState\?\.preserveCase/);
  assert.match(source, /preserveCase: savedOptions\.preserveCase/);
});
