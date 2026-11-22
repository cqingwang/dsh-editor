import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = client.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = client.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < client.length; index += 1) {
    if (client[index] === '{') depth += 1;
    if (client[index] === '}') depth -= 1;
    if (depth === 0) return client.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

test('a non-empty Find query enters Loading before the debounced request', () => {
  const findToolContentQuery = new Function(
    `${extractFunction('findToolContentQuery')}\nreturn findToolContentQuery;`,
  )();
  const hasFindToolContentQuery = new Function(
    'findToolContentQuery',
    `${extractFunction('hasFindToolContentQuery')}\nreturn hasFindToolContentQuery;`,
  )(findToolContentQuery);
  const transition = new Function(
    'findToolContentQuery',
    'hasFindToolContentQuery',
    `${extractFunction('findToolQueryTransition')}\nreturn findToolQueryTransition;`,
  )(findToolContentQuery, hasFindToolContentQuery);

  const current = {
    query: 'end',
    files: [{ path: 'docs/notes.md' }],
    matches: [{ path: 'docs/notes.md', line: 3 }],
    truncated: true,
    index: 2,
    loading: false,
    error: 'old failure',
    searchGeneration: 4,
    loadedGeneration: 4,
  };
  assert.deepEqual(transition(current, 'endV'), {
    ...current,
    query: 'endV',
    files: [],
    matches: [],
    truncated: false,
    index: 0,
    loading: true,
    error: null,
    searchGeneration: 5,
    loadedGeneration: -1,
    activeRowKey: null,
    collapsedFiles: [],
  });
});

test('clearing the Find query does not announce a loading search', () => {
  const findToolContentQuery = new Function(
    `${extractFunction('findToolContentQuery')}\nreturn findToolContentQuery;`,
  )();
  const hasFindToolContentQuery = new Function(
    'findToolContentQuery',
    `${extractFunction('hasFindToolContentQuery')}\nreturn hasFindToolContentQuery;`,
  )(findToolContentQuery);
  const transition = new Function(
    'findToolContentQuery',
    'hasFindToolContentQuery',
    `${extractFunction('findToolQueryTransition')}\nreturn findToolQueryTransition;`,
  )(findToolContentQuery, hasFindToolContentQuery);

  const next = transition({ query: 'end', searchGeneration: 7, loadedGeneration: 7 }, '');
  assert.equal(next.loading, false);
  assert.equal(next.query, '');
  assert.equal(next.searchGeneration, 8);
  assert.equal(next.loadedGeneration, -1);
});

test('EditorWorkspace uses the shared query transition for its Find field', () => {
  assert.match(
    client,
    /onQuery: \(query\) => \{\s+setFindTool\(\(current\) => current === null \? current : findToolQueryTransition\(current, query\)\);\s+\},/u,
  );
});
