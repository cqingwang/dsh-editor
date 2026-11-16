import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extractSource(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`unterminated ${name}`);
}

function createHarness() {
  const store = new Map();
  const window = {
    sessionStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, String(value)),
    },
  };
  const api = new Function(
    'window',
    'currentTerminalScope',
    `const TERMINAL_RESTORE_TAB_LIMIT = 4;
     const TERMINAL_RESTORE_BUFFER_CHARS = 64 * 1024;
     const terminalLiveBuffers = new Map();
     const terminalPendingRestoreBuffers = new Map();
     ${extractSource('terminalRestoreStorageKey')}
     ${extractSource('boundTerminalRestoreBuffer')}
     ${extractSource('readTerminalRestoreSnapshots')}
     ${extractSource('writeTerminalRestoreSnapshots')}
     ${extractSource('seedTerminalRestoreBuffer')}
     ${extractSource('takeTerminalRestoreBuffer')}
     ${extractSource('resetTerminalLiveBuffer')}
     ${extractSource('appendTerminalLiveBuffer')}
     ${extractSource('clearTerminalLiveBuffer')}
     ${extractSource('forgetTerminalLiveBuffer')}
     ${extractSource('persistTerminalRestoreSnapshots')}
     return {
       boundTerminalRestoreBuffer,
       readTerminalRestoreSnapshots,
       writeTerminalRestoreSnapshots,
       seedTerminalRestoreBuffer,
       takeTerminalRestoreBuffer,
       resetTerminalLiveBuffer,
       appendTerminalLiveBuffer,
       clearTerminalLiveBuffer,
       forgetTerminalLiveBuffer,
       persistTerminalRestoreSnapshots,
       terminalLiveBuffers,
       terminalPendingRestoreBuffers,
     };`,
  )(window, () => 'workspace:test');
  return { api, store };
}

test('terminal restore buffers are bounded per tab and per browser session', () => {
  const { api, store } = createHarness();
  const large = 'x'.repeat(70_000);
  assert.equal(api.boundTerminalRestoreBuffer(large).length, 64 * 1024);
  api.writeTerminalRestoreSnapshots(['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(api.readTerminalRestoreSnapshots(), ['a', 'b', 'c', 'd']);
  assert.ok(store.has('dsh-editor.terminal.scrollback:workspace:test'));
});

test('restored scrollback is consumed once and remains appendable', () => {
  const { api } = createHarness();
  api.seedTerminalRestoreBuffer('terminal-1', 'old\n');
  assert.equal(api.takeTerminalRestoreBuffer('terminal-1'), 'old\n');
  assert.equal(api.takeTerminalRestoreBuffer('terminal-1'), '');
  api.resetTerminalLiveBuffer('terminal-1', 'new\n', 'old\n');
  api.appendTerminalLiveBuffer('terminal-1', 'next\n');
  assert.equal(api.terminalLiveBuffers.get('terminal-1'), 'old\nnew\nnext\n');
});

test('clear and close drop session-restorable terminal history', () => {
  const { api } = createHarness();
  api.seedTerminalRestoreBuffer('terminal-1', 'secret\n');
  api.clearTerminalLiveBuffer('terminal-1');
  assert.equal(api.terminalLiveBuffers.get('terminal-1'), '');
  assert.equal(api.terminalPendingRestoreBuffers.has('terminal-1'), false);
  api.forgetTerminalLiveBuffer('terminal-1');
  assert.equal(api.terminalLiveBuffers.has('terminal-1'), false);
});

test('session persistence follows terminal order and preserves unseen slots', () => {
  const { api } = createHarness();
  api.writeTerminalRestoreSnapshots(['first', 'second']);
  api.persistTerminalRestoreSnapshots([]);
  assert.deepEqual(api.readTerminalRestoreSnapshots(), ['first', 'second']);
  api.persistTerminalRestoreSnapshots([{ id: 'new-b' }, { id: 'known-a' }]);
  assert.deepEqual(api.readTerminalRestoreSnapshots(), ['first', 'second']);
  api.resetTerminalLiveBuffer('known-a', 'known\n');
  api.persistTerminalRestoreSnapshots([{ id: 'new-b' }, { id: 'known-a' }]);
  assert.deepEqual(api.readTerminalRestoreSnapshots(), ['first', 'known\n']);
});

test('TerminalScreen and restore path wire the bounded buffer through the existing stream', () => {
  assert.match(source, /takeTerminalRestoreBuffer\(terminalId\)/);
  assert.match(source, /resetTerminalLiveBuffer\(terminalId, event\.data, restored\)/);
  assert.match(source, /appendTerminalLiveBuffer\(terminalId, event\.data\)/);
  assert.match(source, /const snapshots = readTerminalRestoreSnapshots\(\)/);
  assert.match(source, /createTerminal\(exists \? entry\.shell : undefined, undefined, snapshots\[index\] \?\? ''\)/);
  assert.match(source, /clearTerminalLiveBuffer\(terminal\.id\)/);
  assert.match(source, /forgetTerminalLiveBuffer\(id\)/);
  assert.match(source, /if \(remaining\.length === 0\) writeTerminalRestoreSnapshots\(\[\]\)/);
  assert.match(source, /window\.setInterval\(persist, 1000\)/);
});
