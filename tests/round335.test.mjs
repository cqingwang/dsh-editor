import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('the diff toolbar exposes IDEA Swap Sides', () => {
  assert.ok(source.includes("diffSwapSides: '交换对比方向'"));
  assert.ok(source.includes("diffSwapSides: 'Swap Sides'"));
  assert.match(source, /id: 'swapSides'/);
  assert.match(source, /icon: 'swap'/);
  assert.match(source, /label: t\('editor\.diffSwapSides'\)/);
  assert.match(source, /setSwapSides\(\(value\) => !value\)/);
});

test('swapping keeps both loaded models and only changes their view order', () => {
  assert.match(source, /const \[swapSides, setSwapSides\] = React\.useState\(false\)/);
  assert.match(source, /const diffModelsRef = React\.useRef\(null\)/);
  const bind = source.slice(
    source.indexOf('const applyDiffSideOrder = React.useCallback('),
    source.indexOf('/* Track which hunk the modified pane'),
  );
  assert.match(bind, /const pair = diffModelsRef\.current/);
  assert.match(bind, /original: pair\.modified/);
  assert.match(bind, /modified: pair\.original/);
  assert.match(bind, /diff\.setModel\(next\)/);
  assert.doesNotMatch(bind, /createModel\(|\.dispose\(/);
});

test('loaded models come from the stored pair and swapped mode is read-only', () => {
  assert.match(source, /diffModelsRef\.current = \{ original, modified \}/);
  assert.match(source, /const loadedModels = diffModelsRef\.current/);
  assert.match(source, /swapSidesRef\.current === true/);
  assert.match(source, /const canEdit = diffEditingEnabled\(\{[\s\S]*?writable,[\s\S]*?swapped: swapSidesRef\.current,/);
  assert.match(source, /readOnly: canEdit === false/);
  assert.match(source, /renderMarginRevertIcon: canEdit/);
});

test('side headers and restore actions follow the displayed orientation', () => {
  assert.match(source, /const displayedSideLabels = swapSides \? \{ left: sideLabels\.right, right: sideLabels\.left \} : sideLabels/);
  assert.match(source, /styles\.diffSideHeader \}, displayedSideLabels\.left/);
  assert.match(source, /displayedSideLabels\.right/);
  assert.match(source, /swapSides === false/);
  assert.match(source, /actionableSelection = selectionRange !== null[\s\S]*?&& !diffReadOnly[\s\S]*?&& !swapSides[\s\S]*?&& !editLocked/);
});

test('DiffPreview never captures the editor-split callback that is not in its scope', () => {
  const diff = source.slice(source.indexOf('function DiffPreview('), source.indexOf('* Commit tool window: grouped'));
  assert.doesNotMatch(diff, /closeSplitTab/);
});
