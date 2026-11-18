import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { extractUseEffectExpressionContaining, loadTypeScriptExpression } from './ts-source.mjs';

const client = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

test('reload restores only live editor terminals and persists the pruned placement', async () => {
  let restored = [];
  let persisted = [];
  const effect = loadTypeScriptExpression(client, extractUseEffectExpressionContaining(client, 'readEditorTerminals()'), {
    readEditorTerminals: () => ['live'],
    callTerminal: async () => ({
      terminals: [
        { id: 'live', title: 'Live shell', cwd: '/repo' },
        { id: 'dead', title: 'Dead shell', cwd: '/repo' },
      ],
    }),
    setEditorTerminals: (value) => {
      restored = value;
    },
    writeEditorTerminals: (value) => {
      persisted = value;
    },
  });
  const cleanup = effect();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(restored, [{ id: 'live', title: 'Live shell', cwd: '/repo' }]);
  assert.deepEqual(persisted, ['live']);
  cleanup();
});
