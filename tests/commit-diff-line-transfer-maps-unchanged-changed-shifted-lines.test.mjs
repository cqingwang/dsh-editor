import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'tests/fixtures/diff-preview.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));
const diffModelSource = readFileSync(join(root, 'src/client/components/ui/diff-model.ts'), 'utf8');
const transferDiffLine = loadTypeScriptFunction(diffModelSource, 'transferDiffLine');

const changes = [
  { originalStartLineNumber: 3, originalEndLineNumber: 4, modifiedStartLineNumber: 3, modifiedEndLineNumber: 6 },
  { originalStartLineNumber: 10, originalEndLineNumber: 10, modifiedStartLineNumber: 13, modifiedEndLineNumber: 13 },
];

test('diff line transfer maps unchanged, changed, and shifted lines', () => {
  assert.equal(transferDiffLine(1, 'original', changes), 1);
  assert.equal(transferDiffLine(3, 'original', changes), 3);
  assert.equal(transferDiffLine(4, 'original', changes), 6);
  assert.equal(transferDiffLine(6, 'original', changes), 8);
  assert.equal(transferDiffLine(10, 'original', changes), 13);
  assert.equal(transferDiffLine(13, 'original', changes), 15);
  assert.equal(transferDiffLine(5, 'modified', changes), 4);
  assert.equal(transferDiffLine(12, 'modified', changes), 10);
});

test('diff line transfer normalises malformed input', () => {
  assert.equal(transferDiffLine(0, 'original', []), 1);
  assert.equal(transferDiffLine(Number.NaN, 'modified', null), 1);
  assert.equal(transferDiffLine(5, 'unknown', changes), 5);
});

test('diff line transfer keeps zero-length insertion and deletion boundaries', () => {
  const topInsertion = [
    { originalStartLineNumber: 1, originalEndLineNumber: 0, modifiedStartLineNumber: 1, modifiedEndLineNumber: 2 },
  ];
  const deletion = [
    { originalStartLineNumber: 1, originalEndLineNumber: 2, modifiedStartLineNumber: 1, modifiedEndLineNumber: 0 },
  ];
  assert.equal(transferDiffLine(1, 'original', topInsertion), 3);
  assert.equal(transferDiffLine(1, 'original', deletion), 1);
  assert.equal(transferDiffLine(3, 'original', deletion), 1);
});

test('Diff exposes IDEA Select Position in Opposite Diff Pane', () => {
  const diff = source.slice(source.indexOf('function DiffPreview('), source.indexOf('* Commit tool window: grouped'));
  assert.match(diff, /const selectPositionInOppositeDiffPane = React\.useCallback\(/);
  assert.match(diff, /const lastFocusedDiffSideRef = React\.useRef\('modified'\)/);
  assert.match(diff, /onDidFocusEditorText\?\.\(\(\) => \{\s+lastFocusedDiffSideRef\.current = 'original'/);
  assert.match(diff, /onDidFocusEditorText\?\.\(\(\) => \{\s+lastFocusedDiffSideRef\.current = 'modified'/);
  assert.match(diff, /transferDiffLine\(/);
  assert.match(diff, /setPosition\(/);
  assert.match(diff, /revealPositionInCenterIfOutsideViewport\(/);
  assert.match(diff, /id: 'selectPositionInOppositePane'/);
  assert.match(diff, /label: t\('editor\.diffSelectOppositePosition'\)/);
  assert.match(diff, /id: 'selectPositionInOppositePane'[\s\S]*?restoreFocus: false[\s\S]*?run: selectPositionInOppositeDiffPane/);
  assert.match(diff, /run: selectPositionInOppositeDiffPane/);
  assert.match(diff, /restoreFocus: action\.restoreFocus === false \? false : undefined/);
});

test('Select Position wording exists in both dictionaries', () => {
  assert.ok(source.includes("diffSelectOppositePosition: '在对侧选择相同位置'"));
  assert.ok(source.includes("diffSelectOppositePosition: 'Select Position in Opposite Diff Pane'"));
});
