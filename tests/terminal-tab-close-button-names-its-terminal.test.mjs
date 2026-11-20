import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const panel = await readFile(
  new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url),
  'utf8',
);

const closeStart = panel.indexOf('style={styles.terminalTabClose}');
const closeEnd = panel.indexOf('</button>', closeStart);
const closeButton = panel.slice(closeStart, closeEnd);

test('each terminal close control names the terminal it closes', () => {
  assert.ok(closeStart >= 0 && closeEnd > closeStart, 'terminal close button must remain present');
  assert.match(
    panel,
    /aria-label=\{t\('editor\.closeTab', \{\s+name: terminal\.title,\s+\}\)\}/u,
  );
  assert.doesNotMatch(closeButton, /aria-label=\{t\('editor\.terminalClose'\)\}/u);
});
