import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const screenSource = await readFile(
  new URL('../src/client/components/terminal/TerminalScreen.tsx', import.meta.url),
  'utf8',
);
const panelSource = await readFile(
  new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url),
  'utf8',
);
const clientSource = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const source = `${screenSource}\n${panelSource}\n${clientSource}`;

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

function createHarness(initialEntries = {}, initialScope = 'workspace:test') {
  const store = new Map(Object.entries(initialEntries));
  const scopeState = { value: initialScope };
  let reads = 0;
  let writes = 0;
  const window = {
    sessionStorage: {
      getItem: (key) => {
        reads += 1;
        return store.get(key) ?? null;
      },
      setItem: (key, value) => {
        writes += 1;
        store.set(key, String(value));
      },
    },
  };
  const api = new Function(
    'window',
    'currentTerminalScope',
    `const TERMINAL_RESTORE_TAB_LIMIT = 4;
     const TERMINAL_RESTORE_BUFFER_CHARS = 64 * 1024;
     const terminalLiveBuffers = new Map();
     const terminalPendingRestoreBuffers = new Map();
     let terminalRestoreSnapshotCache = null;
     ${extractSource('terminalRestoreStorageKey')}
     ${extractSource('boundTerminalRestoreBuffer')}
     ${extractSource('readTerminalRestoreSnapshots')}
     ${extractSource('writeTerminalRestoreSnapshots')}
     ${extractSource('terminalRestoreSnapshotsEqual')}
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
  )(window, () => scopeState.value);
  return {
    api,
    store,
    scopeState,
    reads: () => reads,
    writes: () => writes,
  };
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

test('unchanged restore persistence parses the previous snapshot only once', () => {
  const key = 'dsh-editor.terminal.scrollback:workspace:test';
  const { api, store, reads, writes } = createHarness({
    [key]: JSON.stringify(['restored']),
  });
  const terminals = [{ id: 'terminal-a' }];

  api.persistTerminalRestoreSnapshots(terminals);
  api.persistTerminalRestoreSnapshots(terminals);
  api.persistTerminalRestoreSnapshots(terminals);
  assert.equal(reads(), 1);
  assert.equal(writes(), 0);

  api.resetTerminalLiveBuffer('terminal-a', 'new\n');
  api.persistTerminalRestoreSnapshots(terminals);
  assert.equal(reads(), 1);
  assert.equal(writes(), 1);
  assert.equal(store.get(key), JSON.stringify(['new\n']));

  api.persistTerminalRestoreSnapshots(terminals);
  assert.equal(reads(), 1);
  assert.equal(writes(), 1);
});

test('restore snapshot cache invalidates when the terminal scope changes', () => {
  const { api, scopeState, reads, writes } = createHarness({
    'dsh-editor.terminal.scrollback:scope-a': JSON.stringify(['from-a']),
    'dsh-editor.terminal.scrollback:scope-b': JSON.stringify(['from-b']),
  });
  const terminals = [{ id: 'terminal-a' }];

  scopeState.value = 'scope-a';
  api.persistTerminalRestoreSnapshots(terminals);
  scopeState.value = 'scope-b';
  api.persistTerminalRestoreSnapshots(terminals);

  assert.equal(reads(), 2);
  assert.equal(writes(), 0);
});

test('TerminalScreen and restore path wire the bounded buffer through the existing stream', () => {
  assert.match(screenSource, /takeTerminalRestoreBuffer\(terminalId\)/);
  assert.match(screenSource, /resetTerminalLiveBuffer\(terminalId, event\.data, restored\)/);
  assert.match(screenSource, /appendTerminalLiveBuffer\(terminalId, event\.data\)/);
  assert.match(panelSource, /const snapshots = readTerminalRestoreSnapshots\(\)/);
  assert.match(
    panelSource,
    /createTerminal\(exists \? entry\.shell : undefined, entry\.cwd, snapshots\[index\] \?\? ''\)/,
  );
  assert.match(panelSource, /clearTerminalLiveBuffer\(terminal\.id\)/);
  assert.match(panelSource, /forgetTerminalLiveBuffer\(id\)/);
  assert.match(
    panelSource,
    /if \(remaining\.length === 0\) \{\s+userClosedLastRef\.current = true;\s+writeTerminalRestoreSnapshots\(\[\]\);/u,
  );
  assert.match(panelSource, /const schedulePersist = \(\): void =>/);
});
