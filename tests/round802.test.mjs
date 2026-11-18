import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('TerminalPanel is a reusable TSX terminal feature component', async () => {
  const panel = await read('src/client/components/terminal/TerminalPanel.tsx');

  assert.match(panel, /export interface TerminalPanelProps/u);
  assert.match(panel, /<TerminalScreen/u);
  assert.match(panel, /<ContextMenu/u);
  assert.match(panel, /terminalReorderRequestRef/u);
  assert.match(panel, /data-dsh-terminal-pane-role='left'/u);
  assert.match(panel, /data-dsh-terminal-pane-role='right'/u);
  assert.doesNotMatch(panel, /React\.createElement/u);
});

test('build embeds TerminalPanel and terminal.js has no duplicate component', async () => {
  const build = await read('scripts/build-client.mjs');
  const legacy = await read('src/client/terminal.ts');
  const fixture = await read('tests/fixtures/terminal-panel.legacy.js');

  assert.match(build, /TerminalPanel\.tsx/u);
  assert.match(build, /terminalPanelModule/u);
  assert.doesNotMatch(legacy, /function TerminalPanel\(/u);
  assert.match(fixture, /function TerminalPanel\(/u);
});
