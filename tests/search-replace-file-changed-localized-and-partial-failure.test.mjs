import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const localesSource = await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8');

const replaceFailureMessage = loadTypeScriptFunction(commitSource, 'replaceFailureMessage');
const searchReplaceFailureMessage = new Function(
  'searchTextFailureMessage',
  'replaceFailureMessage',
  `${loadTypeScriptFunction(commitSource, 'searchReplaceFailureMessage')}
return searchReplaceFailureMessage;`,
)(() => 'host search failure', replaceFailureMessage);

test('a file changed after search reports the path without leaking host English', () => {
  const failure = new Error('the file changed on disk since it was searched: .dsh-replace-probe-b.ts');
  const message = searchReplaceFailureMessage(failure, 0, (key, params) =>
    params === undefined ? key : `${key}:${params.path}`,
  );
  assert.equal(message, 'editor.searchReplaceFileChanged:.dsh-replace-probe-b.ts');
  assert.doesNotMatch(message, /changed on disk since it was searched/u);
});

test('the localized conflict still preserves partial-success wording', () => {
  const failure = new Error('the file changed on disk since it was searched: src/changed.ts');
  const calls = [];
  const message = searchReplaceFailureMessage(failure, 1, (key, params) => {
    calls.push([key, params]);
    return params === undefined ? key : `${key}:${params.path ?? params.message}`;
  });
  assert.equal(message, 'editor.searchReplacePartialFailure:editor.searchReplaceFileChanged:src/changed.ts');
  assert.deepEqual(calls, [
    ['editor.searchReplaceFileChanged', { path: 'src/changed.ts' }],
    ['editor.searchReplacePartialFailure', { message: 'editor.searchReplaceFileChanged:src/changed.ts' }],
  ]);
});

test('both locales provide the replacement conflict message', () => {
  assert.match(
    localesSource,
    /searchReplaceFileChanged: '搜索后文件已在磁盘上被修改：\{path\}。请重新搜索后再替换。'/u,
  );
  assert.match(
    localesSource,
    /searchReplaceFileChanged: 'The file changed on disk after it was searched: \{path\}\. Search again before replacing\.'/u,
  );
});
