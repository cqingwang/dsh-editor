import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const replaceAll = source.slice(source.indexOf('const replaceInFindTool = React.useCallback'), source.indexOf('const replaceFindToolOccurrence = React.useCallback'));
const replaceOne = source.slice(source.indexOf('const replaceFindToolOccurrence = React.useCallback'), source.indexOf('const dismissExternal = React.useCallback'));

test('Replace All keeps the replacement field focused while the write is busy', () => {
  const busyStart = replaceAll.slice(replaceAll.indexOf('replaceBusy: true'), replaceAll.indexOf('try {'));
  assert.match(busyStart, /replaceFocusRequest: \(current\.replaceFocusRequest \?\? 0\) \+ 1/);
});

test('single Replace keeps the replacement field focused while the write is busy', () => {
  const busyStart = replaceOne.slice(replaceOne.indexOf('replaceBusy: true'), replaceOne.indexOf('try {'));
  assert.match(busyStart, /replaceFocusRequest: \(current\.replaceFocusRequest \?\? 0\) \+ 1/);
});
