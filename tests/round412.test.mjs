import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('Commit Log file rows keep their complete path instead of ellipsizing it', () => {
  const files = source.slice(source.indexOf('logFiles: {'), source.indexOf('commitBody: {'));
  assert.match(files, /width: 'max-content'/);
  assert.match(files, /minWidth: '100%'/);

  const row = source.slice(source.indexOf('logFileRow: {'), source.indexOf('logFilePath: {'));
  assert.match(row, /width: 'max-content'/);
  assert.match(row, /minWidth: 'max-content'/);

  const path = source.slice(source.indexOf('logFilePath: {'), source.indexOf('commitBody: {'));
  assert.match(path, /flex: '0 0 auto'/);
  assert.match(path, /minWidth: 'max-content'/);
  assert.match(path, /overflow: 'visible'/);
  assert.match(path, /textOverflow: 'clip'/);
});

test('the Log detail scroll container remains the horizontal overflow owner', () => {
  const detail = source.slice(source.indexOf('ref: detailScrollRef,'), source.indexOf('detail === null', source.indexOf('ref: detailScrollRef,')));
  assert.match(detail, /style: styles\.commitScroll/);
  assert.match(detail, /className: 'dsh-editor-tool-scroll'/);
});
