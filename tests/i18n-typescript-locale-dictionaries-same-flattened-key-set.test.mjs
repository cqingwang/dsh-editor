import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  commitEnglish,
  en,
  flattenDictionary,
  inject,
  interpolateMessage,
  searchReplaceCountParams,
  zh,
} from './locale-source.mjs';

test('TypeScript locale dictionaries keep the same flattened key set', () => {
  const zhFlat = flattenDictionary(zh);
  const enFlat = flattenDictionary(en);
  assert.deepEqual(Object.keys(zhFlat).sort(), Object.keys(enFlat).sort());
  assert.equal(zhFlat['view.editor'], 'Editor');
  assert.equal(zhFlat['editor.toolWindows'], '工具窗口');
  assert.equal(enFlat['editor.toolWindows'], 'Tool windows');
  assert.deepEqual(inject, ['locale']);
});

test('TypeScript locale helpers preserve interpolation and Commit English', () => {
  assert.equal(
    interpolateMessage('Deleted {count} files under {path}', {
      count: 2,
      path: 'src',
    }),
    'Deleted 2 files under src',
  );
  assert.equal(
    interpolateMessage('No placeholders', undefined),
    'No placeholders',
  );
  assert.equal(
    commitEnglish('editor.changes', { count: 2 }),
    'Changes',
  );
  assert.deepEqual(
    searchReplaceCountParams((key) => key, 1, 4),
    {
      matches: 1,
      files: 4,
      matchUnit: 'editor.searchReplaceMatchOne',
      fileUnit: 'editor.searchReplaceFileMany',
    },
  );
});
