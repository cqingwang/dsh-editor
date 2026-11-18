import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const panel = readFileSync(join(root, 'src/client/components/project/ProjectPanel.tsx'), 'utf8');
const client = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('Project search surfaces truncated host results instead of silently dropping them', () => {
  assert.match(panel, /const \[searchTruncated, setSearchTruncated\] = React\.useState\(false\)/);
  assert.match(panel, /setSearchTruncated\(value\?\.truncated === true\)/);
  assert.match(panel, /searchTruncated \?/);
  assert.match(panel, /state='truncated'/);
  assert.match(panel, /t\('editor\.treeSearchTruncated'\)/);
  assert.match(client, /treeSearchTruncated: '搜索结果已截断；请继续输入以缩小范围'/);
  assert.match(client, /treeSearchTruncated: 'Search results were truncated\. Keep typing to narrow the search\.'/);
});
