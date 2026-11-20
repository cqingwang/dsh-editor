import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const panel = await readFile(new URL('src/client/components/commit/CommitPanel.tsx', root), 'utf8');
const locales = await readFile(new URL('src/client/locales.ts', root), 'utf8');

test('Commit selection status has grammatically correct singular and plural wording', () => {
  assert.match(locales, /partialSelected: '已选择 \{count\} 个文件',/u);
  assert.match(locales, /partialSelectedOne: '已选择 \{count\} 个文件',/u);
  assert.match(locales, /partialSelected: '\{count\} files selected',/u);
  assert.match(locales, /partialSelectedOne: '\{count\} file selected',/u);
  assert.match(
    panel,
    /t\(\s*selectedPaths\.size === 1 \? 'editor\.partialSelectedOne' : 'editor\.partialSelected',\s*\{\s*count: selectedPaths\.size,\s*\},?\s*\)/u,
  );
});
