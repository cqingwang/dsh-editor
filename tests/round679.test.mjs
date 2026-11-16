import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('The tab close focus state follows host theme alias tokens', () => {
  assert.match(
    source,
    /\.dsh-editor-tab-close:focus-visible \{ background: var\(--dsw-alias-interactive-bg-hover-solid\) !important; color: var\(--dsw-alias-label-primary\) !important; border-color: var\(--dsw-alias-border-l3\) !important; border-radius: 5px; outline: none; \}/u,
  );
  assert.doesNotMatch(source, /\.dsh-editor-tab-close:focus-visible \{[^}]*#[0-9a-f]{3,8}/iu);
});

test('A file tab middle click closes only that tab', () => {
  const fileTabs = source.slice(
    source.indexOf('const tabs = openFiles.map((file) => {'),
    source.indexOf('/**\n       * The diff\'s own editor tab'),
  );
  assert.match(fileTabs, /onAuxClick: \(event\) => \{[\s\S]*?event\.button !== 1[\s\S]*?closeFile\(file\.path\)/u);
  assert.match(fileTabs, /className: 'dsh-editor-tab-close'/u);
});
