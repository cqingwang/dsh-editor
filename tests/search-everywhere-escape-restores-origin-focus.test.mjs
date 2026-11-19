import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dialog = await readFile(
  new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url),
  'utf8',
);
const workspace = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

test('Search Everywhere separates dismissal from action-driven close', () => {
  assert.match(dialog, /onDismiss\?: \(\) => void;/u);
  assert.match(dialog, /const dismissSearchEverywhere = onDismiss \?\? onClose;/u);
  assert.match(dialog, /onMouseDown=\{dismissSearchEverywhere\}/u);
  assert.equal((dialog.match(/event\.key === 'Escape'[\s\S]{0,120}?dismissSearchEverywhere\(\)/gu) ?? []).length, 2);
});

test('dismiss restores the recorded opener and falls back to the current editor', () => {
  assert.match(workspace, /searchEverywhereReturnFocusRef = React\.useRef<HTMLElement \| null>\(null\)/u);
  assert.match(
    workspace,
    /if \(\s*activeElement !== null &&\s*activeElement !== document\.body &&\s*!activeElement\.closest\('\[data-dsh-search-everywhere\]'\)\s*\)\s*searchEverywhereReturnFocusRef\.current = activeElement;/u,
  );
  assert.match(
    workspace,
    /const dismissSearchEverywhere = React\.useCallback\(\(\) => \{[\s\S]*?const previous = searchEverywhereReturnFocusRef\.current;[\s\S]*?window\.setTimeout\(\(\) => \{[\s\S]*?if \(previous !== null && previous\.isConnected\) previous\.focus\(\);[\s\S]*?else currentCodeEditor\(\)\?\.focus\?\.\(\);[\s\S]*?\}, 0\);/u,
  );
  assert.match(workspace, /onDismiss=\{dismissSearchEverywhere\}/u);
});
