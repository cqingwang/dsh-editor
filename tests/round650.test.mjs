import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { workspaceFileOperations } from '../lib/index.js';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const findTool = source.slice(
  source.indexOf('function FindToolWindow('),
  source.indexOf('function QuickOpen('),
);

test('Find keeps the exact content query and uses only a separate non-empty gate', () => {
  const functions = new Function(
    `${extractFunction('findToolContentQuery')}\n${extractFunction('hasFindToolContentQuery')}\nreturn { findToolContentQuery, hasFindToolContentQuery };`,
  )();
  assert.equal(functions.findToolContentQuery(' \nend\n '), ' \nend\n ');
  assert.equal(functions.findToolContentQuery(null), '');
  assert.equal(functions.hasFindToolContentQuery(' '), true);
  assert.equal(functions.hasFindToolContentQuery('\n'), true);
  assert.equal(functions.hasFindToolContentQuery(''), false);

  assert.match(source, /const findToolQuery = findToolContentQuery\(findTool\?\.query\)/);
  assert.doesNotMatch(source, /const findToolQuery = findTool\?\.query\.trim\(\)/);
  assert.match(source, /query: findToolQuery,/);
  assert.match(source, /hasFindToolContentQuery\(findToolQuery\)/);
});

test('Every Find replacement path forwards the same raw query', () => {
  const replaceAll = source.slice(
    source.indexOf('const replaceInFindTool = React.useCallback'),
    source.indexOf('const replaceFindToolOccurrence = React.useCallback'),
  );
  const replaceOne = source.slice(
    source.indexOf('const replaceFindToolOccurrence = React.useCallback'),
    source.indexOf('const dismissExternal = React.useCallback'),
  );
  assert.match(replaceAll, /const query = findToolContentQuery\(findTool\?\.query\)/);
  assert.match(replaceAll, /if \(!hasFindToolContentQuery\(query\) \|\| matches\.length === 0\) return/);
  assert.match(replaceAll, /query,\n\s+replacement: findTool\.replace/);
  assert.match(replaceOne, /const query = findToolContentQuery\(findTool\?\.query\)/);
  assert.match(replaceOne, /!hasFindToolContentQuery\(query\)/);
  assert.match(findTool, /hasFindToolContentQuery\(query\)/);
});

test('Workspace search and replace treat newlines and spaces as literal text', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-r650-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'sample.txt');
  await writeFile(path, 'alpha\nbeta\ngamma\n');

  const crossLine = await workspaceFileOperations.searchText(root, 'alpha\nbeta', { maxMatches: 20 });
  assert.equal(crossLine.matches.length, 1);
  assert.equal(crossLine.matches[0].path, 'sample.txt');
  assert.equal(crossLine.matches[0].line, 1);
  assert.equal(crossLine.matches[0].column, 1);

  const multilineReplace = await workspaceFileOperations.replaceText(
    root,
    'alpha\nbeta',
    'ALPHA\nBETA',
    [{ path: 'sample.txt', mtime: crossLine.matches[0].mtime }],
  );
  assert.deepEqual(multilineReplace, {
    changedFiles: 1,
    replacements: 1,
    files: ['sample.txt'],
  });
  assert.equal(await readFile(path, 'utf8'), 'ALPHA\nBETA\ngamma\n');

  const newlines = await workspaceFileOperations.searchText(root, '\n', { maxMatches: 20 });
  assert.equal(newlines.matches.length, 3);
  const newlineReplace = await workspaceFileOperations.replaceText(
    root,
    '\n',
    '|',
    [{ path: 'sample.txt', mtime: newlines.matches[0].mtime }],
  );
  assert.equal(newlineReplace.replacements, 3);
  assert.equal(await readFile(path, 'utf8'), 'ALPHA|BETA|gamma|');
});

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf(') {', start) + 2;
  assert.ok(bodyStart > 1, `${name} has no function body`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}
