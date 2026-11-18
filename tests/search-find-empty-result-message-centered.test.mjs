import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const builtClient = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const findToolSource = await readFile(
  new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url),
  'utf8',
);

test('Find empty result list uses the centered message layout', () => {
  const inlineStylesStart = builtClient.indexOf('/* ─────────────────────── inline-styles.ts');
  assert.ok(inlineStylesStart >= 0);
  const listStart = builtClient.indexOf('findToolList: {', inlineStylesStart);
  const emptyStart = builtClient.indexOf('findToolListEmpty: {', listStart);
  const messageStart = builtClient.indexOf('findToolPopupMessage: {', emptyStart);
  assert.ok(listStart >= 0 && emptyStart > listStart && messageStart > emptyStart);

  const emptyStyle = builtClient.slice(emptyStart, messageStart);
  assert.match(emptyStyle, /display: 'flex'/u);
  assert.match(emptyStyle, /flexDirection: 'column'/u);
});

test('Find applies the centered layout only while there are no result rows', () => {
  assert.match(findToolSource, /\.\.\.\(occurrences\.length === 0 \? styles\.findToolListEmpty : null\)/u);
  assert.match(findToolSource, /styles\.findToolPopupMessage/u);
  assert.match(findToolSource, /styles\.findToolMessage/u);
});
