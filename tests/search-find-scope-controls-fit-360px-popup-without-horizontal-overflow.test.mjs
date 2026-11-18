import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('Find Scope controls fit the 360px popup without horizontal overflow', () => {
  const groupStart = source.indexOf('findToolScopeModeGroup: {');
  const buttonStart = source.indexOf('findToolScopeButton: {', groupStart);
  const selectStart = source.indexOf('findToolScopeSelect: {', buttonStart);
  const group = source.slice(groupStart, buttonStart);
  const button = source.slice(buttonStart, selectStart);

  assert.match(group, /gap: 3/u);
  assert.match(button, /padding: '0 4px'/u);
  assert.match(source.slice(selectStart), /minWidth: 96/u);
});

test('Find Scope fixes preserve every direct action at minimum width', () => {
  assert.match(source, /'data-dsh-find-scope': ''/u);
  assert.match(source, /findToolScopeModeTarget\(current, event\.key\)/u);
  assert.match(source, /onClick: \(\) => setScopeEditorOpen\(true\)/u);
});
