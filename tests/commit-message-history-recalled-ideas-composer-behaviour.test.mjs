import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function blockAt(anchor, length = 1200) {
  const start = source.indexOf(anchor);
  assert.notEqual(start, -1, `${anchor} is missing`);
  return source.slice(start, start + length);
}

test('commit message history is recalled with ↑/↓, IDEA\'s composer behaviour', () => {
  const block = blockAt('/* ↑/↓ walk the message history only when the caret sits on the first/last line. */', 900);
  assert.match(block, /atStart/);
  assert.match(block, /atEnd/);
  assert.match(block, /onRecall\(event\.key === 'ArrowUp' \? 1 : -1\)/);
});

test('a multi-line message keeps ↑/↓ for the caret, not the history', () => {
  /* The guard is what makes this safe: ↑ inside the body must move the caret. */
  const block = blockAt('/* ↑/↓ walk the message history only when the caret sits on the first/last line. */', 900);
  assert.match(block, /if \(event\.key === 'ArrowUp' && !atStart\) return;/);
  assert.match(block, /if \(event\.key === 'ArrowDown' && !atEnd\) return;/);
});

test('⌘/Ctrl+Enter commits and refuses when the message or the selection is empty', () => {
  const block = blockAt('/* ⌘/Ctrl+Enter commits without reaching for the mouse. */', 400);
  assert.match(block, /event\.metaKey \|\| event\.ctrlKey/);
  assert.match(block, /selectedPaths\.size > 0 && message\.trim\(\) !== ''/);
});
