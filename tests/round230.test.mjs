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
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`unterminated function ${name}`);
}

const directActionCount = new Function(
  `${extractFunction('groupDiffToolbarActions')}\n${extractFunction('diffDirectActionCountForWidth')}\nreturn diffDirectActionCountForWidth;`,
)();

const actions = [
  { id: 'open', group: 'open' },
  { id: 'view', group: 'mode' },
  { id: 'swap', group: 'mode' },
  { id: 'focus', group: 'selection' },
  { id: 'reload', group: 'inspect' },
  { id: 'find', group: 'inspect' },
  { id: 'collapse', group: 'inspect' },
  { id: 'settings', group: 'inspect' },
  { id: 'undo', group: 'history' },
  { id: 'redo', group: 'history' },
];

test('diff actions recover by measured capacity instead of a full/compact cliff', () => {
  assert.equal(directActionCount(220, 220, actions), 0);
  const medium = directActionCount(420, 220, actions);
  const wider = directActionCount(520, 220, actions);
  assert.ok(medium > 0 && medium < actions.length);
  assert.ok(wider >= medium && wider < actions.length);
  assert.equal(directActionCount(1200, 220, actions), actions.length);
});

test('the toolbar measures fixed controls and keeps overflow reachable', () => {
  const state = source.indexOf('const [diffDirectActionCount, setDiffDirectActionCount]');
  assert.notEqual(state, -1);
  const start = source.indexOf('const measure = () => {', state);
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 700);
  assert.match(block, /querySelectorAll\('\[data-dsh-diff-fixed\]'\)/);
  assert.match(block, /diffDirectActionCountForWidth\(width, fixedWidth, diffToolbarActions\)/);
  assert.match(source, /items: hiddenDiffActionEntries\.map/);
});
