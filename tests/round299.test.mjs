import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('Project Options uses IDEA action wording for hidden files and sorting', () => {
  for (const line of [
    "showHidden: '显示隐藏文件和目录'",
    "showHidden: 'Show Hidden Files and Directories'",
    "sort_name: 'Sort by Name'",
    "sort_type: 'Sort by Type'",
    "sort_modified: 'Sort by Modification Time (Newest First)'",
    "sort_modified_asc: 'Sort by Modification Time (Oldest First)'",
  ]) {
    assert.ok(source.includes(line), `missing ${line}`);
  }
});
