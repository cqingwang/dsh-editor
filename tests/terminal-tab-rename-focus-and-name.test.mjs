import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const helperSource = await readFile(new URL('../src/client/find-tool.ts', import.meta.url), 'utf8');
const panel = await readFile(
  new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url),
  'utf8',
);

test('the rename menu action owns focus instead of restoring the tab opener', () => {
  const { terminalTabMenu } = loadTypeScriptModule(helperSource, ['terminalTabMenu']);
  const menu = terminalTabMenu((key) => key, { id: 't1', title: 'zsh', cwd: '/repo' }, {
    rename: () => {},
    close: () => {},
    closeOthers: () => {},
    duplicate: () => {},
    canDuplicate: true,
    canMoveLeft: false,
    canMoveRight: false,
    moveLeft: null,
    moveRight: null,
    cycleColor: () => {},
    reopen: null,
    moveToEditor: () => {},
    switchFocusToEditor: () => {},
    revealCwd: () => {},
    readmePath: '',
    openReadme: () => {},
  });
  const rename = menu.find((item) => item?.id === 'rename');
  assert.equal(rename?.restoreFocus, false);
});

test('the inline terminal rename input has a stable localized name', () => {
  const inputStart = panel.indexOf('style={styles.terminalRenameInput}');
  const input = panel.slice(inputStart, panel.indexOf('onChange=', inputStart));
  assert.match(input, /aria-label=\{t\('editor\.terminalRename'\)\}/u);
});
