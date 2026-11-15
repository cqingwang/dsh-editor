import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const commit = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function groupActionMenuItems('));

test('the Changes filter clear button has a localized accessible name', () => {
  const clear = commit.slice(commit.indexOf("pathQuery === ''"), commit.indexOf('React.createElement(\n              \'div\',\n              {\n                style: styles.commitScroll'));
  assert.match(clear, /'aria-label': t\('editor\.clearChangeFilter'\)/);
  assert.match(clear, /title: t\('editor\.clearChangeFilter'\)/);
  assert.match(clear, /onClick: \(\) => clearChangeFilter\(\)/);
});

test('both dictionaries contain the clear-filter label', () => {
  assert.equal(source.split("clearChangeFilter: '清除更改过滤器'").length - 1, 1);
  assert.equal(source.split("clearChangeFilter: 'Clear changes filter'").length - 1, 1);
});
