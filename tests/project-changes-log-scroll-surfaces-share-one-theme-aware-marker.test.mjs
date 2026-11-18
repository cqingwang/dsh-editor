import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('./fixtures/project-panel.legacy.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

test('Project, Changes and Log scroll surfaces share one theme-aware marker class', () => {
  assert.match(source, /className: 'dsh-editor-tool-scroll',\s+ref: treeRef,/);
  assert.match(source, /className: 'dsh-editor-tool-scroll',\s+ref: scrollRefs\?\.changes/);
  assert.match(source, /className: 'dsh-editor-tool-scroll',\s+ref: setLogListRef,/);
});

test('the tool-window scrollbar is discoverable in Chromium and Firefox', () => {
  const styles = source.slice(source.indexOf('function installStyles()'), source.indexOf('/** Owns the custom tab'));
  assert.match(styles, /\.dsh-editor-tool-scroll\s*\{[^}]*scrollbar-width: thin;/s);
  assert.match(styles, /\.dsh-editor-tool-scroll\s*\{[^}]*scrollbar-color: color-mix\(/s);
  assert.match(styles, /\.dsh-editor-tool-scroll::-webkit-scrollbar\s*\{[^}]*width: 8px;[^}]*height: 8px;/s);
  assert.match(styles, /\.dsh-editor-tool-scroll::-webkit-scrollbar-thumb\s*\{[^}]*border-radius: 999px;[^}]*background-clip: content-box;/s);
});

test('scrollbar hover and drag feedback use the host accent tokens', () => {
  const styles = source.slice(source.indexOf('function installStyles()'), source.indexOf('/** Owns the custom tab'));
  assert.match(styles, /\.dsh-editor-tool-scroll:hover::-webkit-scrollbar-thumb\s*\{[^}]*var\(--dsw-alias-label-secondary\)/s);
  assert.match(styles, /\.dsh-editor-tool-scroll::-webkit-scrollbar-thumb:active\s*\{[^}]*var\(--dsw-alias-state-business-primary\)/s);
});
