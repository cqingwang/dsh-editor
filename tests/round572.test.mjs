import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('./fixtures/terminal-panel.legacy.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf(') {', start) + 2;
  assert.ok(bodyStart > 1, `${name} has no function body`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

test('Terminal menu exposes IDEA Page and Line scrolling actions', () => {
  const factory = new Function(
    `${extractFunction('terminalMenuModel')}; return terminalMenuModel;`,
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
  const start = source.indexOf('if (\n            event.shiftKey\n            && !event.metaKey');
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
