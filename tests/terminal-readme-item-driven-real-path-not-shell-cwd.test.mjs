import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const panelSource = readFileSync(join(root, 'src/client/components/terminal/TerminalPanel.tsx'), 'utf8');
const source = panelSource + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8');

test('the README item is driven by a real path, not by the shell cwd', () => {
  /* `readmePath: terminal.cwd` is ALWAYS a non-empty string, so `disabled` never
     fired: a directory without a README offered a live item that then errored. */
  /* Round 122 made the menu read the LIVE directory (OSC 7) rather than the render
     snapshot, so the key now comes from `terminalCwdRef`. */
  const lines = panelSource.split('\n').filter((line) => /readmePath:/.test(line));
  assert.equal(lines.length, 1);
  assert.match(lines[0], /readmePaths\[cwd\]/);
  assert.match(panelSource, /await refreshTerminalCwd\(terminal\.id,/);
  /* `''` is the "checked and missing" marker; `undefined` means "not resolved". */
  assert.match(source, /disabled: actions\.readmePath === ''/);
});

test('the resolved README path is tracked per terminal', () => {
  const start = panelSource.indexOf('const openTerminalReadme = React.useCallback(');
  assert.notEqual(start, -1);
  const block = panelSource.slice(start, start + 1600);
  assert.match(block, /setReadmePaths\(/);
});
