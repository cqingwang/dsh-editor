import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const occurrence = source.slice(source.indexOf('const replaceFindToolOccurrence = React.useCallback'), source.indexOf('const dismissExternal = React.useCallback'));

test('successful single replacement keeps the replace field ready for the next occurrence', () => {
  const successPatch = occurrence.slice(occurrence.indexOf("flashStatus(t('editor.searchReplaceDone'"), occurrence.indexOf('} catch (failure)'));
  assert.match(successPatch, /replaceFocusRequest: \(current\.replaceFocusRequest \?\? 0\) \+ 1/);
});

test('the success path still advances the active search result', () => {
  const successPatch = occurrence.slice(occurrence.indexOf("flashStatus(t('editor.searchReplaceDone'"), occurrence.indexOf('} catch (failure)'));
  assert.match(successPatch, /index: Math\.max\(0, Number\(activeIndex\) \|\| 0\)/);
  assert.match(successPatch, /searchGeneration: \(current\.searchGeneration \?\? 0\) \+ 1/);
});
