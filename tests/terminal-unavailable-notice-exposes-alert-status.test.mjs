import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(
  new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url),
  'utf8',
);

test('Terminal unavailable notice is announced and keeps its recovery action', () => {
  assert.match(component, /<div\s+style=\{\{\s+\.\.\.styles\.terminalNotice,[\s\S]*?\}\}\s+role='alert'>/u);
  assert.match(component, /t\('editor\.terminalUnavailable'\)/u);
  assert.match(component, /onClick=\{\(\) => void refresh\(\)\}/u);
});
