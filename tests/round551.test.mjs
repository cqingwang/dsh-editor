import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const inputStart = source.indexOf("'data-dsh-editor-find-replace-input': ''");
const inputEnd = source.indexOf('}),', inputStart);
const replacementInput = source.slice(inputStart, inputEnd);

test('editor replacement input submits the current Replace on Enter', () => {
  assert.match(replacementInput, /if \(event\.isComposing === true\) return/);
  assert.match(replacementInput, /else if \(event\.key === 'Enter'\)/);
  assert.match(replacementInput, /event\.preventDefault\(\)/);
  assert.match(replacementInput, /event\.stopPropagation\(\)/);
  assert.match(replacementInput, /if \(replaceState\.error === null && replaceState\.total > 0\) replaceCurrent\(\)/);
});

test('editor replacement Enter preserves the existing disabled boundary', () => {
  assert.match(replacementInput, /replaceState\.error === null/);
  assert.match(replacementInput, /replaceState\.total > 0/);
  assert.doesNotMatch(replacementInput, /editorReplaceAt|editorReplaceAll|callFs|executeEdits/);
});

test('editor replacement input Escape closes Find without starting a replacement', () => {
  const escape = replacementInput.slice(replacementInput.indexOf("else if (event.key === 'Escape')"));
  assert.match(escape, /event\.preventDefault\(\)/);
  assert.match(escape, /closeFind\(\)/);
  assert.doesNotMatch(escape, /replaceCurrent\(/);
});
