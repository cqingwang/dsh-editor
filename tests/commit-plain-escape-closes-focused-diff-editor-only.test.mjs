import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/diff/DiffPreview.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

test('plain Escape closes the focused diff editor only', () => {
  const fn = new Function(`${extractFunction('isDiffCloseShortcut')}; return isDiffCloseShortcut;`)();
  const escape = { key: 'Escape', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false };
  assert.equal(fn(escape, true, false), true);
  assert.equal(fn(escape, false, false), false);
  assert.equal(fn(escape, true, true), false);
  assert.equal(fn({ ...escape, ctrlKey: true }, true, false), false);
  assert.equal(fn({ ...escape, metaKey: true }, true, false), false);
  assert.equal(fn({ ...escape, altKey: true }, true, false), false);
  assert.equal(fn({ ...escape, shiftKey: true }, true, false), false);
  assert.equal(fn({ ...escape, key: 'Esc' }, true, false), false);
});

test('the diff key listener routes Escape to closeDiff after popup guards', () => {
  const diff = source.slice(source.indexOf('function DiffPreview('), source.indexOf('export { DiffPreview };'));
  assert.match(diff, /isDiffCloseShortcut\(event, insideDiffPane, popupOwnsEscape\)/);
  assert.match(
    diff,
    /find-widget\.visible[\s\S]*?suggest-widget\.visible[\s\S]*?popupOwnsEscape/,
  );
  assert.match(diff, /document\.querySelector\('\[role="menu"\]'\)/);
  assert.doesNotMatch(diff, /\[role="menu"\], \[role="dialog"\]/);
  assert.match(
    diff,
    /isDiffCloseShortcut\(event, insideDiffPane, popupOwnsEscape\)[\s\S]{0,220}?event\.preventDefault\(\);[\s\S]{0,120}?event\.stopPropagation\(\);[\s\S]{0,120}?onClose\(\);[\s\S]{0,40}?return;/,
  );
});

test('the close-diff affordance advertises the Esc shortcut', () => {
  assert.match(source, /closeDiff: '关闭差异编辑器 \(Esc\)'/);
  assert.match(source, /closeDiff: 'Close Diff Editor \(Esc\)'/);
});
