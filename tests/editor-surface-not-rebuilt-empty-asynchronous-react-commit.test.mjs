import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const stripeSource = await readFile(new URL('../src/client/components/ui/ActivityStripe.tsx', import.meta.url), 'utf8');

test('the Editor surface is not rebuilt for an empty asynchronous React commit', () => {
  const start = source.indexOf('function ensureHost(body) {');
  const end = source.indexOf('function idleHost()', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const ensureHost = source.slice(start, end);
  assert.match(ensureHost, /host !== null && root !== null/);
  assert.doesNotMatch(ensureHost, /childElementCount/);
  assert.doesNotMatch(ensureHost, /requestAnimationFrame/);
});

test('the final host lifecycle has no periodic recovery interval', () => {
  assert.doesNotMatch(source, /setInterval\(recoverUnhealthyEditorHost/);
  assert.doesNotMatch(source, /hostHealthTimer/);
  assert.doesNotMatch(source, /hostRecoveryPending/);
});

test('the Activity Stripe exposes a stable workspace marker', () => {
  assert.match(stripeSource, /data-dsh-editor-activity-stripe=''/);
});
