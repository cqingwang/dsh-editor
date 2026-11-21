import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const source = await readFile(
  new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url),
  'utf8',
);
const claimSearchProviderRetry = new Function(
  `${transpileTypeScriptFunction(source, 'claimSearchProviderRetry')}\nreturn claimSearchProviderRetry;`,
)();

test('provider Retry claims one synchronous request and releases for a later attempt', () => {
  const guard = { current: false };

  assert.equal(claimSearchProviderRetry(guard), true);
  assert.equal(guard.current, true);
  assert.equal(claimSearchProviderRetry(guard), false);

  guard.current = false;
  assert.equal(claimSearchProviderRetry(guard), true);
});

test('provider Retry ignores unavailable or already-claimed guards', () => {
  assert.equal(claimSearchProviderRetry(null), false);
  assert.equal(claimSearchProviderRetry(undefined), false);
  assert.equal(claimSearchProviderRetry({ current: true }), false);
});

test('both provider Retry actions pass through the synchronous claim', () => {
  assert.match(
    source,
    /const providerRetryGuardRef = React\.useRef\(false\);/u,
  );
  assert.match(
    source,
    /const retryProvider = \(retry: \(\) => void\): void => \{\s+if \(!claimSearchProviderRetry\(providerRetryGuardRef\)\) return;/u,
  );
  assert.match(source, /retryProvider\(onRetryFiles\)/u);
  assert.match(source, /retryProvider\(onRetryText\)/u);
});
