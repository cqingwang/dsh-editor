import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const screen = await readFile(new URL('src/client/components/terminal/TerminalScreen.tsx', root), 'utf8');
const panel = await readFile(new URL('src/client/components/terminal/TerminalPanel.tsx', root), 'utf8');

test('font changes reuse the grid measurement that reports PTY resize', () => {
  assert.match(screen, /const measureGrid = React\.useCallback\(\(\): void => \{/u);
  assert.match(screen, /observer\?\.observe\(node\);[\s\S]*?\}, \[measureGrid, ready\]\);/u);
  assert.match(
    screen,
    /emulator\.options\.fontSize = fontSize;[\s\S]*?measureGrid\(\);[\s\S]*?\}, \[fontSize, measureGrid, ready\]\);/u,
  );
});

test('Terminal Options font actions restore focus to the current pane', () => {
  assert.match(panel, /const updateTerminalFontSize = \(action: string\): void => \{/u);
  assert.match(panel, /run: \(\) => updateTerminalFontSize\('increase'\)/u);
  assert.match(panel, /run: \(\) => updateTerminalFontSize\('decrease'\)/u);
  assert.match(panel, /run: \(\) => updateTerminalFontSize\('reset'\)/u);
  assert.match(
    panel,
    /setFocusedPane\(splitId === null \? 'left' : pane\);[\s\S]*?const emulator = pane === 'right' && splitId !== null \? splitEmulatorRef\.current : emulatorRef\.current;[\s\S]*?emulator\?\.focus\(\);/u,
  );
});
