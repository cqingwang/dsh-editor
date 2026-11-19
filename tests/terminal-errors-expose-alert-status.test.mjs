import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(
  new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url),
  'utf8',
);

test('Terminal errors are announced through an alert region and clear normally', () => {
  assert.match(component, /error === null \? null : \(\s*<div\s+style=\{styles\.terminalStatusBar\}\s+role='alert'>/u);
  assert.match(component, /setError\(null\)/u);
});
