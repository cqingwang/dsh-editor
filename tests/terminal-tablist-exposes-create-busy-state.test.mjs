import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(
  new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url),
  'utf8',
);

test('Terminal tablist exposes terminal creation as busy', () => {
  assert.match(component, /aria-busy=\{busy \? 'true' : undefined\}/u);
  assert.match(
    component,
    /role='tablist'[\s\S]*?aria-busy=\{busy \? 'true' : undefined\}[\s\S]*?aria-label=\{t\('editor\.terminalTabs'\)\}/u,
  );
});
