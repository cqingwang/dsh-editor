import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));
const replaceAll = source.slice(source.indexOf('const replaceInFindTool = React.useCallback'), source.indexOf('const replaceFindToolOccurrence = React.useCallback'));
const replaceOne = source.slice(source.indexOf('const replaceFindToolOccurrence = React.useCallback'), source.indexOf('/**', source.indexOf('const replaceFindToolOccurrence = React.useCallback') + 100));
const component = source.slice(source.indexOf('function FindToolWindowView('), source.indexOf('const FindToolWindow = FindToolWindowView;'));

test('Replace All requests replacement-field focus after dirty or mtime failures', () => {
  assert.match(replaceAll, /replaceFocusRequest: \(current\.replaceFocusRequest \?\? 0\) \+ 1/);
  assert.ok((replaceAll.match(/replaceFocusRequest:/g) ?? []).length >= 2);
});

test('single-occurrence replacement failures use the same focus request', () => {
  assert.match(replaceOne, /replaceFocusRequest: \(current\.replaceFocusRequest \?\? 0\) \+ 1/);
  assert.ok((replaceOne.match(/replaceFocusRequest:/g) ?? []).length >= 2);
});

test('Find reacts to the request without rebuilding results', () => {
  assert.match(component, /const replaceFocusRequest = Math\.max\(0, Number\(state\.replaceFocusRequest\) \|\| 0\)/);
  assert.match(component, /replaceFocusRequest/);
  assert.match(component, /replaceInputRef\.current\?\.focus\?\.\(\)/);
  assert.doesNotMatch(component.slice(component.indexOf('const replaceFocusRequest'), component.indexOf('const previewWindow')), /setFindTool|onQuery|onMove/);
});
