import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const replaceAll = source.slice(source.indexOf('const replaceInFindTool = React.useCallback'), source.indexOf('const replaceFindToolOccurrence = React.useCallback'));
const replaceOne = source.slice(source.indexOf('const replaceFindToolOccurrence = React.useCallback'), source.indexOf('const dismissExternal = React.useCallback'));

test('Replace All rejects a second submission while the first is busy', () => {
  assert.match(replaceAll, /findTool\?\.replaceBusy === true/);
  assert.match(replaceAll, /replaceBusy: true/);
});

test('single Replace rejects a second submission while the first is busy', () => {
  assert.match(replaceOne, /findTool\?\.replaceBusy === true/);
  assert.match(replaceOne, /replaceBusy: true/);
});
