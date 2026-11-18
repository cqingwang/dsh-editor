import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const ensureHostStart = source.indexOf('      function ensureHost(body) {');
const ensureHostEnd = source.indexOf('      /**\n       * Hide the editor without unmounting it.', ensureHostStart);
assert.ok(ensureHostStart >= 0 && ensureHostEnd > ensureHostStart);
const ensureHost = source.slice(ensureHostStart, ensureHostEnd);

test('Editor keeps the same React root when its host parent is replaced', () => {
  assert.match(ensureHost, /if \(host !== null && root !== null\) \{/);
  assert.match(ensureHost, /hostParent\.appendChild\(host\)/);
  assert.match(ensureHost, /observeHostPosition\(body\);\s*return host;/);
  assert.ok(
    ensureHost.indexOf('hostParent.appendChild(host)') < ensureHost.indexOf('destroyHost()'),
    'the existing host must be reattached before any destructive rebuild',
  );
});

test('Editor never removes the live host while pruning stale copies', () => {
  assert.match(ensureHost, /document\.querySelectorAll\('\[data-dsh-editor-host\]'\)[\s\S]*?if \(stale !== host\) stale\.remove\(\)/);
  assert.match(ensureHost, /root = createRoot\(host\)/);
});

test('The Editor host is moved as a node instead of re-rendering its whole subtree', () => {
  assert.doesNotMatch(
    ensureHost,
    /host\.innerHTML\s*=|replaceChildren\(|host\.textContent\s*=/,
  );
});
