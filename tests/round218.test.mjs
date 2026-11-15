import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote !== '') {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  assert.fail(`unterminated function ${name}`);
}

test('paste history deduplicates to the head and stays bounded', () => {
  const pushPasteHistory = extractFunction('pushPasteHistory');
  let history = [];
  for (let index = 0; index < 12; index += 1) history = pushPasteHistory(history, `text-${index}`);
  assert.equal(history.length, 10);
  assert.equal(history[0], 'text-11');
  assert.equal(history[9], 'text-2');
  history = pushPasteHistory(history, 'text-5');
  assert.equal(history[0], 'text-5');
  assert.equal(history.filter((entry) => entry === 'text-5').length, 1);
  assert.equal(history.length, 10);
});

test('paste history preview is single-line and bounded', () => {
  const pasteHistoryPreview = extractFunction('pasteHistoryPreview');
  assert.equal(pasteHistoryPreview('one\ntwo\tthree'), 'one↵two\tthree');
  assert.ok(pasteHistoryPreview('x'.repeat(100), 20).length <= 21);
});

test('Terminal exposes Paste from History through the screen menu', () => {
  assert.match(source, /terminalPasteHistory: '从历史粘贴…',/);
  assert.match(source, /terminalPasteHistory: 'Paste from History…',/);
  assert.match(source, /id: 'pasteHistory',\s+label: t\('editor\.terminalPasteHistory'\)/);
  assert.match(source, /const \[pasteHistory, setPasteHistory\] = React\.useState\(\[\]\);/);
  assert.match(source, /pushPasteHistory\(current, text\)/);
  assert.match(source, /onPasted\?\.\(text\)/);
});
