import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const source = await readFile(
  new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url),
  'utf8',
);

function loadFunction(name) {
  return new Function(`${transpileTypeScriptFunction(source, name)}\nreturn ${name};`)();
}

test('terminal cap failures become a limit-owned error state', () => {
  const capFailure = loadFunction('terminalCreateFailureLimitReached');
  assert.equal(capFailure(new Error('at most 6 terminals are retained per Session')), true);
  assert.equal(capFailure(new Error('shell is unavailable')), false);
});

test('closing a terminal clears only the terminal-limit alert', () => {
  const afterClose = loadFunction('terminalErrorAfterTabClosed');
  assert.equal(afterClose({ message: 'Close a terminal before creating another', limitReached: true }), null);

  const ordinary = { message: 'Unable to rename terminal', limitReached: false };
  assert.equal(afterClose(ordinary), ordinary);
  assert.equal(afterClose(null), null);
});

test('both close paths apply the cap-alert cleanup', () => {
  const closeTerminal = source.slice(
    source.indexOf('const closeTerminal = React.useCallback('),
    source.indexOf('const moveTab = React.useCallback('),
  );
  const closeOthers = source.slice(
    source.indexOf('const closeOtherTerminals = React.useCallback('),
    source.indexOf('const dockTerminals = terminals.filter'),
  );
  assert.match(closeTerminal, /setError\(terminalErrorAfterTabClosed\)/u);
  assert.match(closeOthers, /setError\(terminalErrorAfterTabClosed\)/u);
});
