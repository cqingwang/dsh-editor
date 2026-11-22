import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTypeScriptCallback, transpileTypeScriptFunction } from './ts-source.mjs';

const terminalSource = await readFile(new URL('../src/client/terminal.ts', import.meta.url), 'utf8');
const panelSource = await readFile(
  new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url),
  'utf8',
);
const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

function compileActivation() {
  const state = { request: null };
  const events = [];
  const request = transpileTypeScriptFunction(terminalSource, 'requestTerminalDockActivation');
  const consume = transpileTypeScriptFunction(terminalSource, 'consumePendingTerminalDockActivation');
  const fakeWindow = {
    dispatchEvent: (event) => {
      events.push(event);
      return true;
    },
  };
  const api = new Function(
    'terminalDockActivationState',
    'window',
    `${request}\n${consume}\nreturn { requestTerminalDockActivation, consumePendingTerminalDockActivation };`,
  )(state, fakeWindow);
  return { state, events, ...api };
}

test('a return request survives an unmounted dock until the Host lists the terminal', () => {
  const activation = compileActivation();
  activation.requestTerminalDockActivation('term-b', { title: 'Shell B', cwd: '/repo/b' });
  assert.deepEqual(activation.state.request, { id: 'term-b', title: 'Shell B', cwd: '/repo/b' });
  assert.equal(activation.events.length, 1);
  assert.deepEqual(activation.events[0].detail, { id: 'term-b', title: 'Shell B', cwd: '/repo/b' });

  assert.equal(activation.consumePendingTerminalDockActivation(['term-a']), null);
  assert.equal(activation.state.request, null);

  activation.requestTerminalDockActivation('term-b');
  assert.deepEqual(activation.consumePendingTerminalDockActivation(['term-a', 'term-b']), { id: 'term-b' });
  assert.equal(activation.state.request, null);
});

test('a mounted dock can consume the pending request immediately', () => {
  const activation = compileActivation();
  activation.requestTerminalDockActivation('term-live');
  assert.deepEqual(activation.consumePendingTerminalDockActivation(null), { id: 'term-live' });
  assert.equal(activation.consumePendingTerminalDockActivation(null), null);
});

test('workspace and TerminalPanel share the durable return activation', () => {
  assert.match(workspaceSource, /requestTerminalDockActivation\(terminal\.id, terminal\)/u);
  assert.doesNotMatch(workspaceSource, /window\.dispatchEvent\(\s+new CustomEvent\('dsh-editor-return-terminal'/u);
  assert.match(panelSource, /consumePendingTerminalDockActivation\(terminals\.map\(\(terminal\) => terminal\.id\)\)/u);
  assert.match(panelSource, /if \(request === null\) return;[\s\S]*?setActiveId\(request\.id\);/u);
  assert.match(panelSource, /applyEditorReturnMetadata\(request\.id, request\.title \?\? '', request\.cwd \?\? ''\)/u);
});

test('returned metadata updates the dock without overwriting a manual rename', () => {
  const apply = (manual) => {
    let terminals = [{ id: 'term', title: 'Original', cwd: '/repo' }];
    const cwdById = new Map([['term', '/repo']]);
    const metadata = new Map();
    const callback = loadTypeScriptCallback(panelSource, 'applyEditorReturnMetadata', {
      renamedRef: { current: new Set(manual ? ['term'] : []) },
      renameInFlightRef: { current: null },
      terminalCwdRef: { current: cwdById },
      terminalMetadataRef: { current: metadata },
      terminalManualRenameOwnsTitle: (id, renamed, inFlight) =>
        renamed.has(id) || (typeof inFlight === 'string' && inFlight.startsWith(`${id}\u0000`)),
      setTerminals: (update) => {
        terminals = typeof update === 'function' ? update(terminals) : update;
      },
    });
    callback('term', 'Shell /tmp', '/tmp');
    return { terminal: terminals[0], cwd: cwdById.get('term'), metadata: metadata.get('term') };
  };

  assert.deepEqual(apply(false), {
    terminal: { id: 'term', title: 'Shell /tmp', cwd: '/tmp' },
    cwd: '/tmp',
    metadata: { title: 'Shell /tmp', cwd: '/tmp' },
  });
  assert.deepEqual(apply(true), {
    terminal: { id: 'term', title: 'Original', cwd: '/tmp' },
    cwd: '/tmp',
    metadata: { cwd: '/tmp' },
  });
});
