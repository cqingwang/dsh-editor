import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(
  new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url),
  'utf8',
);

test('Find builds one occurrence index instead of scanning every row', () => {
  assert.match(component, /const occurrenceIndexByKey = React\.useMemo\(/u);
  assert.match(component, /if \(!positions\.has\(entry\.rowKey\)\) positions\.set\(entry\.rowKey, position\);/u);
  assert.doesNotMatch(component, /occurrences\.findIndex\(/u);
  assert.ok((component.match(/occurrenceIndexByKey\.get\(/gu) ?? []).length >= 4);
});
