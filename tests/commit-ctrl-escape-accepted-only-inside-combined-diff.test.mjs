import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'tests/fixtures/diff-preview.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

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

test('Ctrl+Escape is accepted only inside a combined diff', () => {
  const fn = new Function(`${extractFunction('isCombinedFileCollapseShortcut')}; return isCombinedFileCollapseShortcut;`)();
  const shortcut = { key: 'Escape', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false };
  assert.equal(fn(shortcut, true, true), true);
  assert.equal(fn({ ...shortcut, ctrlKey: false }, true, true), false);
  assert.equal(fn({ ...shortcut, metaKey: true }, true, true), false);
  assert.equal(fn({ ...shortcut, altKey: true }, true, true), false);
  assert.equal(fn({ ...shortcut, shiftKey: true }, true, true), false);
  assert.equal(fn({ ...shortcut, key: 'Esc' }, true, true), false);
  assert.equal(fn(shortcut, false, true), false);
  assert.equal(fn(shortcut, true, false), false);
});

test('the diff handler reuses the combined-file collapse action', () => {
  const diff = source.slice(source.indexOf('function DiffPreview('), source.indexOf('* Commit tool window: grouped'));
  assert.match(diff, /isCombinedFileCollapseShortcut\(event, insideDiffPane, target\?\.combined === true\)/);
  assert.match(
    diff,
    /isCombinedFileCollapseShortcut\(event, insideDiffPane, target\?\.combined === true\)[\s\S]{0,220}?event\.preventDefault\(\);[\s\S]{0,120}?event\.stopPropagation\(\);[\s\S]{0,120}?toggleCombinedFileCollapse\(\);[\s\S]{0,40}?return;/,
  );
  assert.match(
    diff,
    /id: 'collapseCombinedFile',[\s\S]*?shortcut: '⌃Esc',[\s\S]*?run: toggleCombinedFileCollapse/,
  );
});

test('the shortcut is wired into the key listener dependencies', () => {
  const diff = source.slice(source.indexOf('function DiffPreview('), source.indexOf('* Commit tool window: grouped'));
  const listener = diff.slice(diff.indexOf('React.useEffect(() => {\n        const onKeyDown'), diff.indexOf('const hidden = target === null'));
  assert.match(listener, /toggleCombinedFileCollapse/);
  assert.match(listener, /\}, \[actionableSelection,[\s\S]*?toggleCombinedFileCollapse,[\s\S]*?undoRestore, walkHunk\]\);/);
});
