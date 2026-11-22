import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const findTool = await readFile(new URL('../src/client/find-tool.ts', import.meta.url), 'utf8');
const findWindow = await readFile(
  new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url),
  'utf8',
);
const searchEverywhere = await readFile(
  new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url),
  'utf8',
);
const locales = await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8');

test('preview read failures keep the real detail inside localized context', () => {
  const message = loadTypeScriptFunction(
    findTool.slice(findTool.indexOf('export function searchPreviewFailureMessage(')),
    'searchPreviewFailureMessage',
  );
  const translate = (key, params) => `${key}:${params.message}`;
  assert.equal(
    message(translate, new Error('EACCES: permission denied')),
    'editor.searchPreviewFailed:EACCES: permission denied',
  );
  assert.equal(message(translate, 'host disconnected'), 'editor.searchPreviewFailed:host disconnected');
});

test('Search Everywhere and Find share the localized preview failure helper', () => {
  for (const source of [findWindow, searchEverywhere]) {
    assert.match(source, /searchPreviewFailureMessage\(t, failure\)/u);
  }
  assert.equal((locales.match(/searchPreviewFailed:/g) ?? []).length, 2);
});
