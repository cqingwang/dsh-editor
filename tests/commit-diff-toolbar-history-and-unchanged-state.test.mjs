import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const diffSource = read('src/client/components/diff/DiffPreview.tsx');
const localeSource = read('src/client/locales.ts');

function diffPreview() {
  return diffSource.slice(diffSource.indexOf('function DiffPreview('), diffSource.indexOf('export { DiffPreview };'));
}

test('empty diff history disables Undo and Redo instead of advertising no-op actions', () => {
  const diff = diffPreview();
  assert.match(diff, /const \[historyDepth, setHistoryDepth\] = React\.useState\(\(\) => \(\{/u);
  assert.match(diff, /const syncHistoryDepth = React\.useCallback\(\(\) => \{/u);
  assert.match(diff, /const canUndo = historyDepth\.undo > 0;/u);
  assert.match(diff, /const canRedo = historyDepth\.redo > 0;/u);
  assert.match(
    diff,
    /label: t\('editor\.diffUndoRestore'\),\s+group: 'history',\s+shortcut: '⌘Z',\s+disabled: editLocked \|\| diffUnavailable \|\| !canUndo,/u,
  );
  assert.match(
    diff,
    /label: t\('editor\.diffRedoRestore'\),\s+group: 'history',\s+shortcut: '⇧⌘Z',\s+disabled: editLocked \|\| diffUnavailable \|\| !canRedo,/u,
  );
  assert.match(diff, /syncHistoryDepth\(\);/u);
});

test('Show unchanged regions is checked only when unchanged regions are visible', () => {
  const diff = diffPreview();
  assert.match(diff, /label: t\('editor\.diffShowUnchanged'\),/u);
  assert.match(diff, /active: !collapseUnchanged,/u);
  assert.doesNotMatch(diff, /label: collapseUnchanged \? t\('editor\.diffShowUnchanged'\)/u);
});

test('the diff summary uses singular wording for one difference', () => {
  const diff = diffPreview();
  assert.match(diff, /hunks\.total === 1 \? 'editor\.diffSummaryAllOne' : 'editor\.diffSummaryAll'/u);
  assert.match(diff, /hunks\.total === 1 \? 'editor\.diffSummaryNoneOne' : 'editor\.diffSummaryNone'/u);
  assert.match(localeSource, /diffSummaryAllOne: '\{count\} 个差异'/u);
  assert.match(localeSource, /diffSummaryNoneOne: '\{count\} 个差异，0 个已包含'/u);
  assert.match(localeSource, /diffSummaryAllOne: '\{count\} difference'/u);
  assert.match(localeSource, /diffSummaryNoneOne: '\{count\} difference, 0 included'/u);
});
