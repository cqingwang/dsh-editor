import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const buildSource = await readFile(new URL('../scripts/build-client.mjs', import.meta.url), 'utf8');
const clientSource = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('the client build keeps readable generator output after the workspace crosses the compact threshold', () => {
  assert.match(buildSource, /generatorOpts:\s*\{[\s\S]*?retainLines:\s*true,[\s\S]*?compact:\s*false,/u);
  assert.match(clientSource, /const applyPatchText = React\.useCallback\(/u);
  assert.match(clientSource, /onSwitchFocusToEditor: focusEditorFromTerminal/u);
});
