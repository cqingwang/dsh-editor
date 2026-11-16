import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const findTool = source.slice(
  source.indexOf('function FindToolWindow('),
  source.indexOf('function QuickOpen('),
);

test('Find in Files accepts a one-character query like IDEA', () => {
  assert.match(source, /const findToolQuery = findToolContentQuery\(findTool\?\.query\)/);
  assert.match(source, /hasFindToolContentQuery\(findToolQuery\)/);
  assert.doesNotMatch(source, /findToolQuery\.length < 2/);
  assert.match(findTool, /hasFindToolContentQuery\(query\)/);
  assert.match(findTool, /hasFindToolContentQuery\(query\) && occurrences\.length === 0/);
  assert.match(findTool, /previewOpen && \(floating \? active !== null && hasFindToolContentQuery\(query\) : true\)/);
  assert.match(source, /findToolEmptyQuery: '输入至少 1 个字符搜索文件内容'/);
  assert.match(source, /findToolEmptyQuery: 'Type at least 1 character to search file contents'/);
});

test('Search Everywhere Text keeps its separate two-character threshold', () => {
  assert.match(source, /searchEverywhereTextQuery\.length < 2/);
  assert.match(source, /searchTextHint: '输入至少 2 个字符搜索文件内容'/);
  assert.match(source, /searchTextHint: 'Type at least 2 characters to search file contents'/);
});
