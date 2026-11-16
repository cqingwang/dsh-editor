import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extract(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  assert.fail(`unterminated ${name}`);
}

function findTool() {
  const start = source.indexOf('function FindToolWindow(');
  const end = source.indexOf('function QuickOpen(', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('Find tool connects its query combobox to the result listbox', () => {
  const panel = findTool();
  assert.match(panel, /const FIND_TOOL_LISTBOX_ID = 'dsh-editor-find-tool-listbox'/);
  assert.match(panel, /role: 'combobox'/);
  assert.match(panel, /'aria-autocomplete': 'list'/);
  assert.match(panel, /'aria-controls': FIND_TOOL_LISTBOX_ID/);
  assert.match(panel, /id: FIND_TOOL_LISTBOX_ID/);
  assert.match(panel, /'aria-activedescendant': active === null \? undefined : findToolOptionId\(active\.rowKey\)/);
});

test('Find file and occurrence rows expose stable option ids', () => {
  const panel = findTool();
  assert.match(panel, /rowKey: `file:\$\{file\.path\}`/);
  assert.match(panel, /id: findToolOptionId\(rowKey\)/);
  assert.match(panel, /'aria-selected': position === activeIndex/);
});

test('Find option ids encode result identities without collisions', () => {
  const optionId = extract('findToolOptionId');
  assert.equal(optionId('file:src/app.ts'), optionId('file:src/app.ts'));
  assert.notEqual(optionId('text:src/a/b.ts:1:2'), optionId('text:src/a-b.ts:1:2'));
  assert.match(optionId('text:docs/a b.md:1:2'), /^dsh-editor-find-option-[A-Za-z0-9%._~()'!*;-]+$/);
});

test('Find exposes one non-duplicated live result status', () => {
  const panel = findTool();
  assert.match(panel, /const findResultStatus = state\.loading === true/);
  assert.match(panel, /'aria-live': 'polite'/);
  assert.match(panel, /'aria-atomic': 'true'/);
  assert.match(panel, /style: styles\.screenReaderOnly/);
  assert.match(panel, /findToolResultSummary\(t, resultMatches, resultFiles\)/);
  assert.match(panel, /!hasFindToolContentQuery\(query\)[\s\S]*?styles\.findToolPopupMessage[\s\S]*?t\('editor\.findToolEmptyQuery'\)/);
});
