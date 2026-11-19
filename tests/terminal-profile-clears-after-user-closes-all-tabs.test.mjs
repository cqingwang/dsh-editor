import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const terminal = await read('src/client/terminal.ts');
const panel = await read('src/client/components/terminal/TerminalPanel.tsx');
const { shouldPersistTerminalProfile } = loadTypeScriptModule(terminal, ['shouldPersistTerminalProfile']);

test('terminal profile is not cleared before the host list settles', () => {
  assert.equal(shouldPersistTerminalProfile(2, false, true), true);
  assert.equal(shouldPersistTerminalProfile(0, false, true), false);
});

test('a user-closed empty list clears the saved profile', () => {
  assert.equal(shouldPersistTerminalProfile(0, true, true, true), true);
});

test('an unexpected host restart keeps the saved profile for restore', () => {
  assert.equal(shouldPersistTerminalProfile(0, true, true, false), false);
});

test('an unavailable terminal host keeps the existing profile for recovery', () => {
  assert.equal(shouldPersistTerminalProfile(0, true, false), false);
});

test('TerminalPanel uses the profile persistence gate', () => {
  assert.match(
    panel,
    /if \(\s*shouldPersistTerminalProfile\(terminals\.length, loaded, available, userClosedLastRef\.current\),?\s*\)\s*\{[\s\S]*?rememberTerminalsRef\.current\?\.\(terminals\);[\s\S]*?\}/u,
  );
  assert.match(panel, /\[available, loaded, terminals\]/u);
});
