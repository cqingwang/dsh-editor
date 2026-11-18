import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const asyncPrefix = 'async ';
  const declarationStart =
    source.slice(Math.max(0, start - asyncPrefix.length), start) === asyncPrefix ? start - asyncPrefix.length : start;
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(declarationStart, index + 1);
  }
  throw new Error(`${name} has no closing brace`);
}

test('cancelling an upload interrupts its retry backoff instead of waiting for it', async () => {
  const waitForRetry = new Function(
    'window',
    `${extractFunction('uploadCancelledFailure')};` +
      `${extractFunction('waitForWorkspaceUploadRetry')};` +
      'return waitForWorkspaceUploadRetry;',
  )(globalThis);
  const controller = new AbortController();
  const startedAt = Date.now();
  const waiting = waitForRetry(8000, () => controller.signal.aborted, controller.signal);
  setTimeout(() => controller.abort(), 20);

  await assert.rejects(waiting, (failure) => failure?.code === 'dsh-editor/upload-cancelled');
  assert.ok(Date.now() - startedAt < 500, 'cancel must not wait for the remaining retry delay');
});

test('chunk requests receive the batch abort signal', () => {
  assert.match(source, /async function requestWorkspaceUpload\(action, options = \{\}\)/u);
  assert.match(source, /signal: options\.signal/u);
  assert.match(
    source,
    /async function uploadWorkspaceFile\(\s+file,\s+path,\s+onProgress,\s+shouldCancel,\s+signal\s*\)/u,
  );
  assert.match(source, /waitForWorkspaceUploadRetry\(delay, shouldCancel, signal\)/u);
  assert.match(source, /cancelController\?\.abort\(\)/u);
});
