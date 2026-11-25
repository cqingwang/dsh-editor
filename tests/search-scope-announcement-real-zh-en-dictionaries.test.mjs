import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { en, flattenDictionary, interpolateMessage, zh } from './locale-source.mjs';
import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const source = await read('src/client/components/commit/commit-log-scope-announcement.ts');
const { commitLogScopeAnnouncement } = loadTypeScriptModule(source, ['commitLogScopeAnnouncement']);

function translator(dictionary) {
  const messages = flattenDictionary(dictionary);
  return (key, params) => interpolateMessage(messages[key] ?? key, params);
}

test('scope announcement uses the real zh and en dictionaries', () => {
  const zhTranslate = translator(zh);
  const enTranslate = translator(en);
  const hash = '8d5451a';

  assert.equal(
    commitLogScopeAnnouncement(zhTranslate, hash, ''),
    '提交图已限定为提交 8d5451a 的历史',
  );
  assert.equal(
    commitLogScopeAnnouncement(enTranslate, hash, ''),
    'Commit graph limited to history at 8d5451a',
  );
  assert.equal(
    commitLogScopeAnnouncement(zhTranslate, '', hash),
    '已清除提交图的标签范围',
  );
  assert.equal(
    commitLogScopeAnnouncement(enTranslate, '', hash),
    'Commit graph tag scope cleared',
  );
});

test('scope announcement suppresses duplicate state and handles initial empty state', () => {
  const enTranslate = translator(en);

  assert.equal(commitLogScopeAnnouncement(enTranslate, '8d5451a', '8d5451a'), null);
  assert.equal(commitLogScopeAnnouncement(enTranslate, '', ''), null);
});

test('CommitLogToolbar delegates announcement formatting to the shared model', async () => {
  const toolbar = await read('src/client/components/commit/CommitLogToolbar.tsx');
  const build = await read('scripts/build-client.mjs');
  const client = await read('lib/client.js');

  assert.match(toolbar, /import \{ commitLogScopeAnnouncement \} from '\.\/commit-log-scope-announcement'/u);
  assert.match(toolbar, /commitLogScopeAnnouncement\(t, scopeHash, previous\)/u);
  assert.match(build, /commit-log-scope-announcement\.ts/u);
  assert.match(client, /function commitLogScopeAnnouncement\(/u);
});
