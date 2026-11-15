import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('Project search surfaces truncated host results instead of silently dropping them', () => {
  const panel = source.slice(source.indexOf('function ProjectPanel('), source.indexOf('/**\n     * IDEA-style context menu'));
  assert.match(panel, /const \[searchTruncated, setSearchTruncated\] = React\.useState\(false\)/);
  assert.match(panel, /setSearchTruncated\(value\?\.truncated === true\)/);
  assert.match(panel, /searchTruncated \? React\.createElement\('div', \{ style: styles\.treeMessage \}, t\('editor\.treeSearchTruncated'\)\)/);
  assert.match(source, /treeSearchTruncated: '搜索结果已截断；请继续输入以缩小范围'/);
  assert.match(source, /treeSearchTruncated: 'Search results were truncated\. Keep typing to narrow the search\.'/);
});
