import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { transformSync } from 'esbuild';

const source = [
  await readFile(new URL('../src/client/find-tool.ts', import.meta.url), 'utf8'),
  await readFile(new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url), 'utf8'),
  await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8'),
].join('\n');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  let paramsDepth = 0;
  let paramsEnd = -1;
  for (let index = source.indexOf('(', start); index < source.length; index += 1) {
    if (source[index] === '(') paramsDepth += 1;
    if (source[index] === ')') {
      paramsDepth -= 1;
      if (paramsDepth === 0) {
        paramsEnd = index;
        break;
      }
    }
  }
  assert.notEqual(paramsEnd, -1, `${name} has no parameter list`);
  const bodyStart = source.indexOf('{', paramsEnd);
  assert.ok(bodyStart > 1, `${name} has no function body`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const current = source[index];
    const next = source[index + 1];
    if (current === '/' && next === '/') {
      index = source.indexOf('\n', index + 2);
      if (index < 0) break;
      continue;
    }
    if (current === '/' && next === '*') {
      index = source.indexOf('*/', index + 2);
      if (index < 0) break;
      index += 1;
      continue;
    }
    if (current === '\'' || current === '"' || current === '`') {
      const quote = current;
      index += 1;
      while (index < source.length && source[index] !== quote) {
        if (source[index] === '\\') index += 1;
        index += 1;
      }
      continue;
    }
    if (current === '{') depth += 1;
    if (current === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

test('Terminal menu exposes IDEA Page and Line scrolling actions', () => {
  const factory = new Function(
    `${transformSync(extractFunction('terminalMenuModel'), { loader: 'ts', format: 'esm', target: 'es2022' }).code}; return terminalMenuModel;`,
  )();
  const calls = [];
  const emulator = {
    getSelection: () => '',
    scrollPages: (count) => calls.push(['page', count]),
    scrollLines: (count) => calls.push(['line', count]),
    focus: () => calls.push(['focus']),
  };
  const model = factory({
    t: (key) => key,
    emulator,
    active: { id: 't1', state: 'running' },
    onSelectAll: () => {},
    onFind: () => {},
    onClear: () => {},
    onClearBuffer: () => {},
    onCreate: () => {},
    pasteHistory: [],
  });
  const items = model.items.filter((item) => item !== null);
  const ids = items.map((item) => item.id);
  assert.deepEqual(ids.slice(ids.indexOf('clearBuffer'), ids.indexOf('clearBuffer') + 5), [
    'clearBuffer',
    'pageUp',
    'pageDown',
    'lineUp',
    'lineDown',
  ]);
  for (const id of ['pageUp', 'pageDown', 'lineUp', 'lineDown']) {
    items.find((item) => item.id === id).run();
  }
  assert.deepEqual(calls, [
    ['page', -1],
    ['focus'],
    ['page', 1],
    ['focus'],
    ['line', -1],
    ['focus'],
    ['line', 1],
    ['focus'],
  ]);
});

test('terminal keyboard owns Shift+PageUp/PageDown for the focused pane', () => {
  const start = source.indexOf('if (\n        event.shiftKey &&');
  const shortcuts = source.slice(start, source.indexOf('const directShortcut', start));
  assert.match(shortcuts, /event\.key === 'PageUp'/);
  assert.match(shortcuts, /event\.key === 'PageDown'/);
  assert.match(shortcuts, /focusedEmulator !== null/);
  assert.match(shortcuts, /scrollPages\(event\.key === 'PageUp' \? -1 : 1\)/);
});

test('Page and Line actions are localized in both dictionaries', () => {
  assert.match(source, /terminalPageUp: '上翻一页'/);
  assert.match(source, /terminalPageDown: '下翻一页'/);
  assert.match(source, /terminalLineUp: '上移一行'/);
  assert.match(source, /terminalLineDown: '下移一行'/);
  assert.match(source, /terminalPageUp: 'Page Up'/);
  assert.match(source, /terminalPageDown: 'Page Down'/);
  assert.match(source, /terminalLineUp: 'Line Up'/);
  assert.match(source, /terminalLineDown: 'Line Down'/);
});
