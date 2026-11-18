import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

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

function extract(name) {
  return new Function(`${extractSource(name)}; return ${name};`)();
}

test('recent command history is bounded, unique and newest first', () => {
  const remember = extract('rememberCommandHistory');
  assert.deepEqual(remember(['replace'], 'find'), ['find', 'replace']);
  assert.deepEqual(remember(['find', 'replace'], 'find'), ['find', 'replace']);
  assert.deepEqual(remember([], ''), []);
  const many = Array.from({ length: 16 }, (_, index) => `cmd-${index}`);
  assert.equal(remember(many, 'latest', 12).length, 12);
  assert.equal(remember(many, 'latest', 12)[0], 'latest');
});

test('command ranking keeps recent commands ahead on an empty query', () => {
  const rank = new Function(
    `${extractSource('fuzzyScore')}\n${extractSource('rankSearchActions')}\nreturn rankSearchActions;`,
  )();
  const actions = [
    { id: 'goToFile', label: 'Go to File', description: '' },
    { id: 'find', label: 'Find…', description: 'Find' },
    { id: 'replace', label: 'Replace…', description: 'Replace' },
  ];
  const ranked = rank(actions, '', ['replace', 'find']);
  assert.deepEqual(ranked.map((action) => action.id), ['replace', 'find', 'goToFile']);
  const filtered = rank(actions, 'replace', ['find']);
  assert.deepEqual(filtered.map((action) => action.id), ['replace']);
});

test('disabled Search Everywhere actions cannot run and advertise their state', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindowView('));
  const actions = source.slice(source.indexOf('const searchEverywhereActions = React.useMemo'), source.indexOf('/* Recompute match count'));
  assert.match(actions, /disabled: !hasEditorModel \|\| replaceState === null \|\| replaceState\.find === ''/);
  assert.match(dialog, /result\.disabled === true/);
  assert.match(dialog, /'aria-disabled': result\.disabled === true/);
  assert.match(dialog, /onRememberCommand\(result\.id\)/);
  assert.match(source, /dsh-editor\.search\.commandHistory/);
});
