import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = [
  await readFile(new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url), 'utf8'),
  await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8'),
].join('\n');

test('terminal tabs expose a localized tablist and roving tab semantics', () => {
  assert.match(source, /terminalTabs: '终端标签',/);
  assert.match(source, /terminalTabs: 'Terminal tabs',/);
  assert.match(
    source,
    /role='tablist'\s+aria-busy=\{busy \? 'true' : undefined\}\s+aria-label=\{t\('editor\.terminalTabs'\)\}/s,
  );
  assert.match(
    source,
    /role='tab'\s+aria-label=\{terminal\.title\}\s+aria-selected=\{terminal\.id === activeId\}\s+tabIndex=\{terminal\.id === activeId \? 0 : -1\}\s+data-dsh-terminal-tab-id=\{terminal\.id\}/s,
  );
});

test('terminal tabs support arrow, Home/End, activation and keyboard context menus', () => {
  const start = source.indexOf('function TerminalPanel(');
  const end = source.indexOf('export { TerminalPanel };', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const panel = source.slice(start, end);
  assert.match(panel, /event\.key === 'ArrowLeft' \|\| event\.key === 'ArrowRight'/);
  assert.match(panel, /event\.key === 'Home' \|\| event\.key === 'End'/);
  assert.match(panel, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(panel, /event\.key === 'ContextMenu' \|\| \(event\.shiftKey === true && event\.key === 'F10'\)/);
  assert.match(panel, /openTerminalTabMenu\(terminal, rect\.left \+ 12, rect\.bottom\)/);
});

test('the terminal overflow control participates in keyboard tab navigation', () => {
  const panel = source.slice(source.indexOf('function TerminalPanel('), source.indexOf('export { TerminalPanel };'));
  assert.match(panel, /className='dsh-editor-terminal-overflow'/);
  assert.match(panel, /event\.key === 'ArrowLeft'[\s\S]{0,260}focusLastVisibleTerminalTab\(\)/);
  assert.match(panel, /activateTerminalTab\(terminal\);[\s\S]{0,220}focusTerminalTab\(terminal\.id\)/);
});
