import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function terminalToolbar() {
  const start = source.indexOf('/* The clipboard notice and the new-tab button share one span');
  assert.notEqual(start, -1);
  return source.slice(start, source.indexOf('find === null', start));
}

test('Terminal keeps only direct session actions in the strip', () => {
  const toolbar = terminalToolbar();
  assert.match(toolbar, /label: t\('editor\.terminalNew'\)/);
  assert.match(toolbar, /label: t\('editor\.terminalNewPredefinedSession'\)/);
  assert.match(toolbar, /label: splitId === null \? t\('editor\.terminalSplit'\)/);
  assert.match(toolbar, /label: t\('editor\.find'\)/);
  assert.match(toolbar, /label: t\('editor\.terminalOptions'\)/);
  assert.match(toolbar, /label: t\('editor\.hideTerminal'\)/);
});

test('clear, font size and refresh move into Terminal Options', () => {
  const toolbar = terminalToolbar();
  assert.doesNotMatch(toolbar, /icon: 'collapse', label: t\('editor\.terminalClear'\)/);
  assert.doesNotMatch(toolbar, /icon: 'settings',\s+label: t\('editor\.terminalFontSize'\)/);
  assert.doesNotMatch(toolbar, /icon: 'refresh', label: t\('editor\.refresh'\)/);
  assert.match(toolbar, /id: 'clear', label: t\('editor\.terminalClear'\), shortcut: '⌘K'/);
  assert.match(toolbar, /id: 'increaseFont', label: t\('editor\.terminalIncreaseFontSize'\)/);
  assert.match(toolbar, /id: 'decreaseFont', label: t\('editor\.terminalDecreaseFontSize'\)/);
  assert.match(toolbar, /id: 'resetFont', label: t\('editor\.terminalResetFontSize'\)/);
  assert.match(toolbar, /id: 'refresh', label: t\('editor\.refresh'\)/);
});

test('the Options labels are localised in both dictionaries', () => {
  assert.match(source, /terminalOptions: 'Terminal 选项',/);
  assert.match(source, /terminalOptions: 'Terminal Options',/);
});
