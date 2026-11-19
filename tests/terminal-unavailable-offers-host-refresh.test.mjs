import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url),
  'utf8',
);

test('an unavailable Terminal host exposes a direct refresh action', () => {
  const start = source.indexOf("{t('editor.terminalUnavailable')}");
  assert.notEqual(start, -1);
  const block = source.slice(Math.max(0, start - 300), start + 500);

  assert.match(block, /onClick=\{\(\) => void refresh\(\)\}/u);
  assert.match(block, /\{t\('editor\.refresh'\)\}/u);
});
