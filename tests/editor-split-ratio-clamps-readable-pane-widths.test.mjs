import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = [
  readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8'),
  readFileSync(join(root, 'src/client/terminal.ts'), 'utf8'),
].join('\n');
const terminalSource = readFileSync(join(root, 'src/client/terminal.ts'), 'utf8');
const splitPaneSource = readFileSync(join(root, 'src/client/components/editor/EditorSplitPane.tsx'), 'utf8');
const mainPaneSource = readFileSync(join(root, 'src/client/components/editor/EditorMainPane.tsx'), 'utf8');
const splitDividerSource = readFileSync(
  join(root, 'src/client/components/editor/EditorSplitDivider.tsx'),
  'utf8',
);

test('editor split ratio clamps to readable pane widths', () => {
  const fn = loadTypeScriptFunction(terminalSource, 'clampEditorSplitPercent');
  assert.equal(fn(5), 20);
  assert.equal(fn(20), 20);
  assert.equal(fn(50), 50);
  assert.equal(fn(80), 80);
  assert.equal(fn(95), 80);
  assert.equal(fn('bad'), 50);
  assert.equal(Math.round(fn(90, 250)), 59);
  assert.equal(Math.round(fn(10, 250)), 41);
});

test('split ratio is stateful and persisted after drag', () => {
  assert.match(source, /const \[editorSplitPercent, setEditorSplitPercent\] = React\.useState\(\(\) =>\s+readStoredNumber\('dsh-editor\.editor\.splitPercent', 50\),?\s+\)/);
  assert.match(source, /writeStoredNumber\('dsh-editor\.editor\.splitPercent', final\)/);
  const locales = readFileSync(join(root, 'src/client/locales.ts'), 'utf8');
  assert.ok(locales.includes("resizeEditorSplit: '拖动调整编辑器拆分比例'"));
  assert.ok(locales.includes("resizeEditorSplit: 'Resize Editor Split'"));
});

test('a real vertical separator updates only flex layout state', () => {
  assert.match(splitDividerSource, /data-dsh-editor-split-divider=''/);
  assert.match(splitDividerSource, /role='separator'/);
  assert.match(splitDividerSource, /aria-orientation=\{orientation === 'horizontal' \? 'horizontal' : 'vertical'\}/);
  assert.match(splitDividerSource, /aria-valuenow=\{Math\.round\(percent\)\}/);
  assert.match(source, /onChange=\{setEditorSplitPercent\}/);
  assert.match(source, /onDraggingChange=\{setEditorSplitDragging\}/);
  assert.doesNotMatch(source, /setEditorSplitPercent[\s\S]{0,200}setSplitEditorRef/);
});

test('focused group gets an accent edge while the other stays transparent', () => {
  assert.match(source, /const splitFocused = splitFile !== null && focusedPath === splitFile\.path/);
  assert.match(source, /const leftFocused = focusedPath === activePath && splitFocused === false/);
  assert.match(source, /focused=\{splitFocused\}/);
  assert.match(source, /focused=\{leftFocused\}/);
  assert.match(
    mainPaneSource,
    /borderTop: `2px solid \$\{focused \? 'var\(--dsw-alias-state-business-primary\)' : 'transparent'\}`/,
  );
  assert.match(
    splitPaneSource,
    /borderTop: `2px solid \$\{focused \? 'var\(--dsw-alias-state-business-primary\)' : 'transparent'\}`/,
  );
});
