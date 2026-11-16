import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const component = source.slice(source.indexOf('function FindToolWindow('), source.indexOf('function QuickOpen('));
const replaceAllButton = component.slice(component.indexOf("'data-dsh-find-bottom-bar': ''"), component.indexOf('filterMenu === null', component.indexOf("'data-dsh-find-bottom-bar': ''")));

test('Replace All exposes a disabled loading state while the host write is busy', () => {
  assert.match(replaceAllButton, /disabled: state\.replaceBusy === true \|\| scopedMatches\.length === 0/);
  assert.match(replaceAllButton, /state\.replaceBusy \? t\('editor\.loading'\) : t\('editor\.searchReplaceAll'\)/);
});
