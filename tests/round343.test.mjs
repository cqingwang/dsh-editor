import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function extractFunction(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} is missing`);
  const paramsEnd = source.indexOf(') {', start);
  assert.notEqual(paramsEnd, -1, `${name} has no function body`);
  let depth = 0;
  for (let index = paramsEnd + 2; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`${name} has no closing brace`);
}

const terminalMenuModel = new Function(
  `${extractFunction('terminalMenuModel')}; return terminalMenuModel;`,
)();

function menuFor(state) {
  const writes = [];
  let focused = 0;
  const emulator = {
    getSelection: () => '',
    input: (data, _transform) => writes.push(data),
    focus: () => { focused += 1; },
  };
  const menu = terminalMenuModel({
    t: (key) => key,
    emulator,
    active: { id: 't1', state, exitCode: state === 'exited' ? 1 : null },
    onSelectAll: () => {},
    onFind: () => {},
    onClose: () => {},
    onClear: () => {},
    onClearBuffer: () => {},
    onCreate: () => {},
    onSplitRight: null,
    onMoveToEditor: null,
    onSwitchFocusToEditor: null,
    onClipboardError: () => {},
    onPastedText: () => {},
    pasteHistory: [],
    onPasteHistory: () => {},
  });
  return { menu, writes, focused: () => focused };
}

test('Terminal exposes IDEA Interrupt Command and Clear Command Prompt', () => {
  assert.ok(source.includes("terminalInterruptCommand: '中断命令'"));
  assert.ok(source.includes("terminalInterruptCommand: 'Interrupt Command'"));
  assert.ok(source.includes("terminalClearPrompt: '清除命令行'"));
  assert.ok(source.includes("terminalClearPrompt: 'Clear Command Prompt'"));
});

test('terminal menu sends Ctrl+C and Ctrl+U to the pane emulator', () => {
  const { menu, writes, focused } = menuFor('running');
  const byId = new Map(menu.items.filter(Boolean).map((item) => [item.id, item]));
  assert.equal(byId.get('interruptCommand')?.label, 'editor.terminalInterruptCommand');
  assert.equal(byId.get('clearPrompt')?.label, 'editor.terminalClearPrompt');
  byId.get('interruptCommand').run();
  byId.get('clearPrompt').run();
  assert.deepEqual(writes, ['\u0003', '\u0015']);
  assert.equal(focused(), 2);
});

test('command control actions are disabled after the shell exits', () => {
  const { menu } = menuFor('exited');
  const byId = new Map(menu.items.filter(Boolean).map((item) => [item.id, item]));
  assert.equal(byId.get('interruptCommand')?.disabled, true);
  assert.equal(byId.get('clearPrompt')?.disabled, true);
});

test('screen context menu passes the clicked pane emulator and terminal', () => {
  const open = source.slice(
    source.indexOf("const openScreenMenu = (event, emulator, terminal, pane = 'left') => {"),
    source.indexOf('/* Recompute the match count whenever the query changes. */'),
  );
  assert.match(open, /const model = terminalMenuModel\(\{/);
  assert.match(open, /active: terminal/);
  assert.match(open, /onSelectAll: \(\) => emulator\.selectAll\(\)/);
  assert.match(open, /onFind: \(\) => openTerminalFind\(emulator\)/);
  assert.match(source, /onContextMenu: \(event\) => openScreenMenu\(event, splitEmulatorRef\.current, splitTerminal, 'right'\)/);
});
