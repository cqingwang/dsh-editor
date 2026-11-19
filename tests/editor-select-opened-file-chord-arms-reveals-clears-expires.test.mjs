import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const diffSource = readFileSync(join(root, 'src/client/diff.ts'), 'utf8');
const source = [
  readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8'),
  diffSource,
  readFileSync(join(root, 'src/client/locales.ts'), 'utf8'),
].join('\n');

function extractFunction(name) {
  return transpileTypeScriptFunction(diffSource, name);
}

test('the Select Opened File chord arms, reveals, clears and expires', () => {
  const fn = new Function(`${extractFunction('selectOpenedChordAction')}; return selectOpenedChordAction;`)();
  const f1 = { key: 'F1', altKey: true, metaKey: false, ctrlKey: false, shiftKey: false };
  const one = { key: '1', altKey: false, metaKey: false, ctrlKey: false, shiftKey: false };
  assert.equal(fn(f1, 0, 1000, true), 'arm');
  assert.equal(fn(f1, 0, 1000, false), 'ignore');
  assert.equal(fn(one, 1200, 2000, true), 'reveal');
  assert.equal(fn(one, 1200, 2800, true), 'clear');
  assert.equal(fn(one, 0, 2000, true), 'ignore');
  assert.equal(fn({ ...one, key: '2' }, 1200, 1500, true), 'clear');
  assert.equal(fn({ ...one, altKey: true }, 1200, 1500, true), 'clear');
});

test('the Project keyboard listener routes Alt+F1 then 1 through the real reveal action', () => {
  const listener = source.slice(
    source.indexOf('Alt+F12, Alt+1..3 and Ctrl+Shift+`'),
    source.indexOf('}, [selectActivity, terminalOpen]);', source.indexOf('Alt+F12, Alt+1..3 and Ctrl+Shift+`')),
  );
  assert.match(
    listener,
    /selectOpenedChordAction\(\s*event,\s*selectOpenedChordAt\.current,\s*Date\.now\(\),\s*activePathRef\.current !== null,?\s*\)/,
  );
  assert.match(listener, /chordAction === 'arm'[\s\S]{0,220}?selectOpenedChordAt\.current = Date\.now\(\)/);
  assert.match(listener, /chordAction === 'reveal'[\s\S]{0,220}?void revealActiveRef\.current\?\.\(\)/);
});

test('the reveal callback is exposed through a stable ref without changing the shortcut effect deps', () => {
  assert.match(source, /const revealActiveRef = React\.useRef\(null\);/);
  assert.match(source, /revealActiveRef\.current = revealActive;/);
  assert.match(source, /\}, \[focusWorkspaceSurface, selectActivity, terminalOpen\]\);/);
});

test('Project Select Opened File advertises IDEA shortcut in both languages', () => {
  assert.match(source, /reveal: '定位当前文件 \(⌥F1, 1\)'/);
  assert.match(source, /reveal: 'Select Opened File \(⌥F1, 1\)'/);
});
