import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const source = await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8');
const locales = await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8');

test('an incomplete text scope cannot claim that the whole workspace has no matches', () => {
  const emptyLabel = loadTypeScriptFunction(
    source.slice(
      source.indexOf('export function searchEverywhereEmptyResultLabel('),
      source.indexOf('\n}\n', source.indexOf('export function searchEverywhereEmptyResultLabel(')) + 2,
    ),
    'searchEverywhereEmptyResultLabel',
  );
  const t = (key) => key;

  assert.equal(
    emptyLabel(
      {
        tab: 'text',
        queryLength: 6,
        textTruncated: true,
        filesTruncated: false,
      },
      t,
    ),
    'editor.searchNoMatchesIncomplete',
  );
  assert.equal(
    emptyLabel(
      {
        tab: 'text',
        queryLength: 6,
        textTruncated: false,
        filesTruncated: false,
      },
      t,
    ),
    'editor.searchNoMatches',
  );
});

test('truncation copy describes incomplete scope without prescribing a misleading query change', () => {
  assert.match(locales, /searchNoMatchesIncomplete:\s*'已搜索范围内没有匹配（结果不完整）'/u);
  assert.match(locales, /searchTextTruncated:\s*'文本结果已达到上限或扫描范围不完整；结果可能缺少部分匹配'/u);
  assert.match(locales, /searchFilesTruncated:\s*'文件列表已达到上限；部分项目文件未显示'/u);
});

test('a provider truncation message is visible only on its owning tab', () => {
  const visible = loadTypeScriptFunction(
    source.slice(
      source.indexOf('export function searchEverywhereTruncationMessageIsVisible('),
      source.indexOf('\n}\n', source.indexOf('export function searchEverywhereTruncationMessageIsVisible(')) + 2,
    ),
    'searchEverywhereTruncationMessageIsVisible',
  );
  const filters = { files: true, text: true };

  assert.equal(visible({ tab: 'text', provider: 'text', filters }), true);
  assert.equal(visible({ tab: 'files', provider: 'text', filters }), false);
  assert.equal(visible({ tab: 'files', provider: 'files', filters }), true);
  assert.equal(visible({ tab: 'all', provider: 'text', filters }), true);
  assert.equal(visible({ tab: 'all', provider: 'text', filters: { ...filters, text: false } }), false);
  assert.equal(visible({ tab: 'actions', provider: 'files', filters }), false);
});

test('the initial file-list cap warning disappears once a typed query owns the provider', () => {
  const providerTruncationVisible = source.slice(
    source.indexOf('export function searchEverywhereTruncationMessageIsVisible('),
    source.indexOf('\n}\n', source.indexOf('export function searchEverywhereTruncationMessageIsVisible(')) + 2,
  );
  const visible = loadTypeScriptFunction(
    `${providerTruncationVisible}\n${source.slice(
      source.indexOf('export function searchEverywhereFileListTruncationIsVisible('),
      source.indexOf('\n}\n', source.indexOf('export function searchEverywhereFileListTruncationIsVisible(')) + 2,
    )}`,
    'searchEverywhereFileListTruncationIsVisible',
  );
  const filters = { files: true, text: true };

  assert.equal(visible({ query: '', tab: 'files', filters }), true);
  assert.equal(visible({ query: 'application', tab: 'files', filters }), false);
  assert.equal(visible({ query: 'application', tab: 'all', filters }), false);
});
