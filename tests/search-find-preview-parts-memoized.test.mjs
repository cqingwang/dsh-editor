import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(
  new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url),
  'utf8',
);

test('Find caches text highlight segments outside active-row rendering', () => {
  assert.match(component, /const previewPartsByRowKey = React\.useMemo\(\(\) => \{/u);
  assert.match(component, /highlightParts\(result\.preview \|\| basename\(result\.path\), query\)/u);
  assert.match(component, /\}, \[occurrences, query\]\);/u);

  const previewPartsAt = component.indexOf('const previewParts =');
  const resizeAt = component.indexOf('const popupResizeHandleStyle =');
  assert.ok(previewPartsAt > 0);
  assert.ok(resizeAt > previewPartsAt);
  const previewParts = component.slice(previewPartsAt, resizeAt);
  assert.match(previewParts, /previewPartsByRowKey\.get/u);
  assert.doesNotMatch(previewParts, /highlightParts\(/u);
});
