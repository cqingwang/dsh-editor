import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));
const component = source.slice(source.lastIndexOf('function FindToolWindowView('), source.indexOf('const FindToolWindow = FindToolWindowView;', source.lastIndexOf('function FindToolWindowView(')));
const replaceAllButton = component.slice(
  component.indexOf("data-dsh-find-bottom-bar=''"),
  component.indexOf('filterMenu === null', component.indexOf("data-dsh-find-bottom-bar=''")),
);

test('Replace All is disabled while the host write or a new search generation is busy', () => {
  assert.match(
    replaceAllButton,
    /disabled=\{\s+state\.replaceBusy === true \|\|\s+state\.loading === true \|\|\s+state\.error !== null \|\|\s+scopedMatches\.length === 0 \|\|\s+!findToolResultsAreCurrent\(state\)\s+\}/u,
  );
  assert.match(replaceAllButton, /state\.replaceBusy \? t\('editor\.loading'\) : t\('editor\.searchReplaceAll'\)/);
});
