import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

test('editor split ratio clamps to readable pane widths', () => {
  const fn = new Function(`${extractFunction('clampEditorSplitPercent')}; return clampEditorSplitPercent;`)();
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
  assert.match(source, /const \[editorSplitPercent, setEditorSplitPercent\] = React\.useState\(\(\) => readStoredNumber\('dsh-editor\.editor\.splitPercent', 50\)\)/);
  assert.match(source, /writeStoredNumber\('dsh-editor\.editor\.splitPercent', final\)/);
  assert.ok(source.includes("resizeEditorSplit: '拖动调整编辑器拆分比例'"));
  assert.ok(source.includes("resizeEditorSplit: 'Resize Editor Split'"));
});

test('a real vertical separator updates only flex layout state', () => {
  assert.match(source, /'data-dsh-editor-split-divider': ''/);
  assert.match(source, /role: 'separator'/);
  assert.match(source, /'aria-orientation': 'vertical'/);
  assert.match(source, /'aria-valuenow': Math\.round\(editorSplitPercent\)/);
  assert.match(source, /setEditorSplitPercent\(next\)/);
  assert.doesNotMatch(source, /setEditorSplitPercent[\s\S]{0,200}setSplitEditorRef/);
});

test('focused group gets an accent edge while the other stays transparent', () => {
  assert.match(source, /const splitFocused = splitFile !== null && focusedPath === splitFile\.path/);
  assert.match(source, /const leftFocused = focusedPath === activePath && splitFocused === false/);
  assert.match(source, /borderTop: `2px solid \$\{leftFocused \? 'var\(--dsw-alias-state-business-primary\)' : 'transparent'\}`/);
  assert.match(source, /borderTop: `2px solid \$\{splitFocused \? 'var\(--dsw-alias-state-business-primary\)' : 'transparent'\}`/);
});
