import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const terminalSource = await readFile(new URL('src/client/terminal.ts', root), 'utf8');
const workspaceSource = await readFile(new URL('src/client/editor-workspace.tsx', root), 'utf8');
const hookSource = await readFile(
  new URL('src/client/components/terminal/use-persistent-terminal-dock-open.ts', root),
  'utf8',
);
const buildSource = await readFile(new URL('scripts/build-client.mjs', root), 'utf8');

function loadDockState(storage, scope, sessionId = scope) {
  const factory = new Function(
    'window',
    'currentTerminalScope',
    'currentSessionId',
    `'use strict';
${transpileTypeScriptFunction(terminalSource, 'readTerminalDockOpen')}
${transpileTypeScriptFunction(terminalSource, 'writeTerminalDockOpen')}
${transpileTypeScriptFunction(terminalSource, 'clearSessionTerminalDockOpen')}
return { readTerminalDockOpen, writeTerminalDockOpen, clearSessionTerminalDockOpen };`,
  );
  return factory(
    { localStorage: storage },
    () => scope,
    () => sessionId,
  );
}

function storageOf(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    values,
  };
}

test('terminal dock open state is scoped to one workspace', () => {
  const childA = loadDockState(storageOf({ 'dsh-editor.terminal.open:workspace:child-a': '1' }), 'workspace:child-a');
  assert.equal(childA.readTerminalDockOpen('workspace:child-a'), true);
  childA.writeTerminalDockOpen(false, 'workspace:child-a');
  assert.equal(childA.readTerminalDockOpen('workspace:child-a'), false);

  const other = loadDockState(storageOf({ 'dsh-editor.terminal.open:workspace:child-a': '1' }), 'workspace:dsh-editor');
  assert.equal(other.readTerminalDockOpen('workspace:dsh-editor'), false);

  const migrated = loadDockState(
    storageOf({
      'dsh-editor.terminal.open:workspace:child-a': '1',
      'dsh-editor.terminal.open:session-child-a': '1',
    }),
    'workspace:child-a',
    'session-child-a',
  );
  migrated.clearSessionTerminalDockOpen();
  assert.equal(migrated.readTerminalDockOpen('session-child-a'), false);
});

test('EditorWorkspace initializes and persists the scoped dock open state', () => {
  assert.match(
    workspaceSource,
    /import \{ usePersistentTerminalDockOpen \} from '\.\/components\/terminal\/use-persistent-terminal-dock-open'/u,
  );
  assert.match(
    workspaceSource,
    /const \[terminalOpen, setTerminalOpen\] =\s+usePersistentTerminalDockOpen\(workspaceId\)/u,
  );
  assert.match(hookSource, /const scope = workspaceId === '' \? undefined : `workspace:\$\{workspaceId\}`/u);
  assert.match(hookSource, /scope === undefined \? false : readTerminalDockOpen\(scope\)/u);
  assert.match(hookSource, /hydratedScopeRef\.current !== scope/u);
  assert.match(hookSource, /clearSessionTerminalDockOpen\(\)/u);
  assert.match(hookSource, /writeTerminalDockOpen\(open, scope\)/u);
  assert.match(buildSource, /components', 'terminal', 'use-persistent-terminal-dock-open\.ts'/u);
  assert.match(buildSource, /\$\{persistentTerminalDockOpenModule\}/u);
});
