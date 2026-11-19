import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(new URL('../src/client/components/search/QuickOpen.tsx', import.meta.url), 'utf8');

test('Quick Open ranks the file set only when its real inputs change', () => {
  assert.match(component, /const matches = React\.useMemo\(/u);
  assert.match(component, /\[files, query, recent\]/u);
  assert.match(component, /\.slice\(0, 60\)/u);
});
