import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('Terminal exposes a fixed IDEA tool-window title', () => {
  assert.match(source, /terminalTitleLocal: '终端: 本地',/);
  assert.match(source, /terminalTitleLocal: 'Terminal: Local',/);
  assert.match(source, /className: 'dsh-editor-terminal-title'/);
  assert.match(source, /t\('editor\.terminalTitleLocal'\)/);
});

test('the fixed title sits before the scrollable terminal tabs', () => {
  const start = source.indexOf("className: 'dsh-editor-terminal-title'");
  const tabs = source.indexOf('ref: tabStripRef', start);
  assert.notEqual(start, -1);
  assert.notEqual(tabs, -1);
  assert.ok(start < tabs);
});

test('the title gives way when the editor surface is very narrow', () => {
  assert.match(
    source,
    /@container dsh-editor-editor \(max-width: 440px\) \{ \.dsh-editor-terminal-title \{ display: none !important; \} \}/,
  );
});
