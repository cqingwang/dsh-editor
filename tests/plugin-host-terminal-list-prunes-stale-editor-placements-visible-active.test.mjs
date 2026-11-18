import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = (await readFile(new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

function extractFunction(name) {
  const start = client.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const body = client.indexOf('{', client.indexOf(')', start));
  let depth = 0;
  for (let index = body; index < client.length; index += 1) {
    if (client[index] === '{') depth += 1;
    if (client[index] === '}') depth -= 1;
    if (depth === 0) return client.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

test('host terminal list prunes stale editor placements and keeps a visible active tab', () => {
  const reconcile = new Function(
    `${extractFunction('reconcileTerminalDockState')}\nreturn reconcileTerminalDockState;`,
  )();
  const listed = [{ id: 'dock-a' }, { id: 'dock-b' }, { id: 'editor-c' }];
  assert.deepEqual(
    reconcile(listed, ['editor-c', 'missing'], 'dock-a'),
    { editorIds: ['editor-c'], activeId: 'dock-a' },
  );
  assert.deepEqual(
    reconcile(listed, ['editor-c'], 'editor-c'),
    { editorIds: ['editor-c'], activeId: 'dock-a' },
  );
  assert.deepEqual(
    reconcile([{ id: 'editor-c' }], ['editor-c', 'missing'], null),
    { editorIds: ['editor-c'], activeId: null },
  );
});

test('Terminal refresh applies the reconciled editor ids and active terminal', () => {
  const terminalStart = client.indexOf('function TerminalPanel(');
  const terminal = client.slice(terminalStart, client.indexOf('\n    function ', terminalStart + 10));
  const start = terminal.indexOf('const refresh = React.useCallback(async () => {');
  const end = terminal.indexOf('      }, []);', start);
  const block = terminal.slice(start, end);
  assert.match(block, /const reconciled = reconcileTerminalDockState\(listed, editorIdsRef\.current, activeRef\.current\);/u);
  assert.match(block, /setEditorIds\(reconciled\.editorIds\);/u);
  assert.match(block, /setActiveId\(reconciled\.activeId\);/u);
});
