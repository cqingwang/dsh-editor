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

test('editor Find supports smart case, Whole Words and Regex', () => {
  const { editorFindResult } = buildFunctions(['editorFindResult']);
  const text = 'Alpha alpha ALPHA needleValue needle\n';

  assert.equal(editorFindResult(text, 'alpha', {}).matches.length, 3);
  assert.equal(editorFindResult(text, 'alpha', { caseSensitive: true }).matches.length, 1);
  assert.deepEqual(
    editorFindResult(text, 'needle', { wholeWords: true }).matches.map((match) => match.offset),
    [30],
  );
  assert.deepEqual(
    editorFindResult(text, 'needle\\w*', { regex: true }).matches.map((match) => match.text),
    ['needleValue', 'needle'],
  );
  assert.match(editorFindResult(text, '[', { regex: true }).error, /invalid regular expression/u);
});

test('editor replacements reuse Regex captures for all and current match', () => {
  const { editorReplaceAll, editorReplaceAt } = buildFunctions([
    'editorFindResult',
    'editorReplaceAll',
    'editorReplaceAt',
  ]);
  const text = 'foo-12 FOO-345 foo-9';
  const all = editorReplaceAll(text, 'foo-(\\d+)', 'id-$1', { regex: true });
  assert.equal(all.error, null);
  assert.equal(all.count, 3);
  assert.equal(all.text, 'id-12 id-345 id-9');

  const one = editorReplaceAt(text, 'foo-(\\d+)', 'id-$1', 0, { regex: true });
  assert.equal(one.error, null);
  assert.equal(one.count, 1);
  assert.equal(one.text, 'id-12 FOO-345 foo-9');
});

test('editor Find bar exposes option toggles and an invalid-pattern alert', () => {
  const findBar = source.slice(
    source.indexOf("'div',\n                    { style: styles.findBar }"),
    source.indexOf('monacoError !== null', source.indexOf("'div',\n                    { style: styles.findBar }")),
  );
  assert.match(findBar, /t\('editor\.searchMatchCase'\)/);
  assert.match(findBar, /t\('editor\.searchWholeWords'\)/);
  assert.match(findBar, /t\('editor\.searchRegex'\)/);
  assert.match(findBar, /replaceState\.error !== null/);
  assert.match(findBar, /role: 'alert'/);
  assert.match(source, /writeSearchOptions\(\{ \.\.\.readSearchOptions\(\), \.\.\.replaceState \}\)/);
});

test('Find controls wrap instead of overflowing the narrow editor pane', () => {
  const style = source.slice(source.indexOf('      findBar: {'), source.indexOf('      findInput: {'));
  assert.match(style, /flexWrap: 'wrap'/);
  assert.match(style, /minHeight: 30/);
  assert.doesNotMatch(style, /height: 30/);
});
