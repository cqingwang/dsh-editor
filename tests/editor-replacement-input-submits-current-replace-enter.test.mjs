import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const findBar = await readFile(
  new URL('../src/client/components/editor/EditorFindBar.tsx', import.meta.url),
  'utf8',
);
const inputStart = findBar.indexOf("data-dsh-editor-find-replace-input=''");
const replacementInput = findBar.slice(inputStart, findBar.indexOf(') : null}', inputStart));

test('editor replacement input submits the current Replace on Enter', () => {
  assert.match(replacementInput, /if \(event\.isComposing === true\) return/);
  assert.match(replacementInput, /else if \(event\.key === 'Enter'\)/);
  assert.match(replacementInput, /event\.preventDefault\(\)/);
  assert.match(replacementInput, /event\.stopPropagation\(\)/);
  assert.match(replacementInput, /if \(state\.error === null && state\.total > 0\) onReplaceCurrent\(\)/);
});

test('editor replacement Enter preserves the existing disabled boundary', () => {
  assert.match(replacementInput, /state\.error === null/);
  assert.match(replacementInput, /state\.total > 0/);
  assert.doesNotMatch(replacementInput, /editorReplaceAt|editorReplaceAll|callFs|executeEdits/);
});

test('editor replacement input Escape closes Find without starting a replacement', () => {
  const escape = replacementInput.slice(replacementInput.indexOf("else if (event.key === 'Escape')"));
  assert.match(escape, /event\.preventDefault\(\)/);
  assert.match(escape, /onClose\(\)/);
  assert.doesNotMatch(escape, /onReplaceCurrent\(/);
});
