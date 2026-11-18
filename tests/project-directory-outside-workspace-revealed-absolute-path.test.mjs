import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { revealInFileManager } from '../lib/index.js';

test('a directory OUTSIDE the workspace can be revealed by absolute path', async (t) => {
  /* The terminal follows `cd`, so a shell can sit in /tmp. Revealing it used to fall
     back to the workspace root — the user asked for the directory they are in. */
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-r126-root-'));
  const outside = await mkdtemp(join(tmpdir(), 'dsh-editor-r126-out-'));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  });
  /* `open`/`explorer`/`xdg-open` are stubbed by pointing the platform check at a
     directory that exists; the assertion is about path RESOLUTION, not the launch. */
  const result = await revealInFileManager(root, outside, { absolute: true, launch: false });
  assert.equal(result.path, outside);
  assert.equal(result.revealed, true);
});

test('an absolute path that does not exist is refused instead of silently opening the root', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-r126-root2-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(
    () => revealInFileManager(root, join(root, 'nope'), { absolute: true, launch: false }),
    /does not exist/,
  );
});

test('the workspace-relative form keeps working', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-r126-root3-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'src'));
  const result = await revealInFileManager(root, 'src', { launch: false });
  assert.equal(result.path, 'src');
});

test('an absolute path outside the root is ignored without the flag', async (t) => {
  /* The default must stay sandboxed: a stray absolute path cannot escape the root. */
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-r126-root4-'));
  const outside = await mkdtemp(join(tmpdir(), 'dsh-editor-r126-out4-'));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  });
  await assert.rejects(() => revealInFileManager(root, outside, { launch: false }), /escapes the workspace|outside the workspace|does not exist/);
});
