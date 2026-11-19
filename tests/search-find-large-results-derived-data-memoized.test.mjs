import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8');
const view = source.slice(
  source.indexOf('function FindToolWindowView('),
  source.indexOf('const FindToolWindow = FindToolWindowView;'),
);

test('Find scoped results and visible groups are memoized from their real inputs', () => {
  assert.match(view, /const scopeFilterOptions = React\.useMemo\(/u);
  assert.match(view, /const scopedFileResults = React\.useMemo\(/u);
  assert.match(view, /const scopedMatches = React\.useMemo\(/u);
  assert.match(view, /const dockVisibleRows = React\.useMemo\(/u);
  assert.match(view, /const displayGroups = React\.useMemo\(/u);
});

test('Find popup rows, handoff target and replacement path set are derived caches', () => {
  assert.match(view, /const popupOccurrences = React\.useMemo\(/u);
  assert.match(view, /const handoffTarget = React\.useMemo\(/u);
  assert.match(view, /const scopedReplacementPaths = React\.useMemo\(/u);
  assert.match(view, /const fileMaskSuggestions = React\.useMemo\(/u);
});

test('Find result counts reuse the memoized scoped and grouped arrays', () => {
  assert.match(view, /const resultFiles = React\.useMemo\(/u);
  assert.match(view, /const resultMatches = React\.useMemo\(/u);
  assert.match(view, /const resultRowCount = React\.useMemo\(/u);
});
