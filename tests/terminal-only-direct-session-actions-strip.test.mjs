import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = [
  readFileSync(join(root, 'src/client/components/terminal/TerminalPanel.tsx'), 'utf8'),
  readFileSync(join(root, 'src/client/locales.ts'), 'utf8'),
].join('\n');

function terminalToolbar() {
  const start = source.indexOf('<span\n          ref={newButtonRef}');
  assert.notEqual(start, -1);
  return source.slice(start, source.indexOf('find === null', start));
}

test('Terminal keeps only direct session actions in the strip', () => {
  const toolbar = terminalToolbar();
  assert.match(toolbar, /label=\{t\('editor\.terminalNew'\)\}/);
  assert.match(toolbar, /label=\{t\('editor\.terminalNewPredefinedSession'\)\}/);
  assert.match(toolbar, /label=\{splitId === null \? t\('editor\.terminalSplit'\) : t\('editor\.terminalUnsplit'\)\}/);
  assert.match(toolbar, /label=\{t\('editor\.find'\)\}/);
  assert.match(toolbar, /label=\{t\('editor\.terminalOptions'\)\}/);
  assert.match(toolbar, /label=\{t\('editor\.hideTerminal'\)\}/);
});

test('clear, font size and refresh move into Terminal Options', () => {
  const toolbar = terminalToolbar();
  assert.doesNotMatch(toolbar, /icon='collapse'[\s\S]{0,80}editor\.terminalClear/s);
  assert.doesNotMatch(toolbar, /icon='settings'[\s\S]{0,80}editor\.terminalFontSize/s);
  assert.doesNotMatch(toolbar, /icon='refresh'[\s\S]{0,80}editor\.refresh/s);
  assert.match(toolbar, /id: 'clear',\s+label: t\('editor\.terminalClear'\),\s+shortcut: '⌘K'/s);
  assert.match(toolbar, /id: 'increaseFont',\s+label: t\('editor\.terminalIncreaseFontSize'\)/s);
  assert.match(toolbar, /id: 'decreaseFont',\s+label: t\('editor\.terminalDecreaseFontSize'\)/s);
  assert.match(toolbar, /id: 'resetFont',\s+label: t\('editor\.terminalResetFontSize'\)/s);
  assert.match(toolbar, /id: 'refresh',\s+label: t\('editor\.refresh'\)/s);
});

test('the Options labels are localised in both dictionaries', () => {
  assert.match(source, /terminalOptions: 'Terminal 选项',/);
  assert.match(source, /terminalOptions: 'Terminal Options',/);
});
