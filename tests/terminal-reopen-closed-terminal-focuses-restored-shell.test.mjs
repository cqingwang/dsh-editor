import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const source = await readFile(
  new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url),
  'utf8',
);

function reloadHarness(created) {
  let focusCount = 0;
  const reopenClosed = loadTypeScriptCallback(source, 'reopenClosed', {
    callTerminal: async () => ({
      shells: [{ path: '/bin/zsh' }],
    }),
    createTerminal: async () => created,
    emulatorRef: {
      current: {
        focus: () => {
          focusCount += 1;
        },
      },
    },
    window: {
      setTimeout(callback) {
        callback();
      },
    },
  });
  return { reopenClosed, focusCount: () => focusCount };
}

test('reopening a closed terminal focuses the restored shell', async () => {
  const { reopenClosed, focusCount } = reloadHarness({ id: 'restored' });

  await reopenClosed({
    shell: '/bin/zsh',
    cwd: '/tmp',
    title: 'zsh',
  });

  assert.equal(focusCount(), 1);
});

test('a failed reopen does not steal focus', async () => {
  const { reopenClosed, focusCount } = reloadHarness(null);

  await reopenClosed({
    shell: '/bin/zsh',
    cwd: '/tmp',
    title: 'zsh',
  });

  assert.equal(focusCount(), 0);
});
