import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function terminalPanel() {
  const start = source.indexOf('function TerminalPanel(');
  assert.notEqual(start, -1);
  const end = source.indexOf('function terminalTheme(', start);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('the dock active terminal is selected only from dock tabs', () => {
  const panel = terminalPanel();
  assert.match(panel, /const dockTerminals = terminals\.filter\(\(terminal\) => !editorIds\.includes\(terminal\.id\)\);/);
  assert.match(panel, /const active = dockTerminals\.find\(\(terminal\) => terminal\.id === activeId\) \?\? null;/);
  assert.match(panel, /const splitTerminal = splitId === null \? null : dockTerminals\.find/);
  assert.equal((panel.match(/const dockTerminals =/g) ?? []).length, 1);
});

test('moving the active tab to the editor activates another dock tab or clears the pane', () => {
  const panel = terminalPanel();
  const block = panel.slice(
    panel.indexOf('const moveTerminalToEditor = React.useCallback('),
    panel.indexOf('const returnTerminalToDock = React.useCallback(', panel.indexOf('const moveTerminalToEditor = React.useCallback(')),
  );
  assert.match(block, /const remaining = terminals\.find/);
  assert.match(block, /!editorIds\.includes\(candidate\.id\)/);
  assert.match(block, /setActiveId\(\(current\) => current === terminal\.id \? remaining\?\.id \?\? null : current\)/);
  assert.match(block, /\[editorIds, terminals\]/);
});

test('returning a terminal to the dock makes it the active dock tab', () => {
  const panel = terminalPanel();
  const block = panel.slice(
    panel.indexOf('const returnTerminalToDock = React.useCallback('),
    panel.indexOf('/* IDEA splits the terminal dock:', panel.indexOf('const returnTerminalToDock = React.useCallback(')),
  );
  assert.match(block, /setActiveId\(terminal\.id\)/);
});

test('returning from the editor does not depend on a mounted, open dock', () => {
  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  const helper = workspace.slice(
    workspace.indexOf('const returnEditorTerminalToDock = React.useCallback('),
    workspace.indexOf('const [createState, setCreateState]', workspace.indexOf('const returnEditorTerminalToDock = React.useCallback(')),
  );
  assert.notEqual(helper.length, 0);
  assert.match(helper, /filter\(\(entry\) => entry\.id !== terminal\.id\)/);
  assert.match(helper, /writeEditorTerminals\(next\.map/);
  assert.match(helper, /setTerminalOpen\(true\)/);
  assert.match(helper, /dsh-editor-return-terminal/);
  assert.match(workspace, /onReturnToDock: \(terminal\) => returnEditorTerminalToDock\(terminal\)/);
});
