import assert from 'node:assert/strict';
import test from 'node:test';

import { WorkspaceWatcher } from '../lib/index.js';

/**
 * Wait for the watcher's own 120ms coalescing timer.
 * @returns {Promise<void>} resolves after one frame would have been emitted.
 */
const settle = () => new Promise((resolve) => setTimeout(resolve, 180));

test('recursive watcher ignores Git lock churn but keeps real index changes', async (t) => {
  let listener = null;
  const fakeWatch = (_path, _options, callback) => {
    listener = callback;
    return { close() {}, on() {} };
  };
  const events = [];
  const watcher = new WorkspaceWatcher('/workspace', (event) => events.push(event), {
    recursive: true,
    watchImpl: fakeWatch,
  });
  t.after(() => watcher.close());
  watcher.start();
  const changes = () => events.filter((event) => event.type === 'change');

  listener('rename', '.git/index.lock');
  await settle();
  assert.equal(changes().length, 0, 'self-generated Git locks must not trigger a refresh loop');

  listener('rename', '.git/index');
  await settle();
  assert.equal(changes().length, 1);
  assert.equal(changes()[0].dirs, null);
});
