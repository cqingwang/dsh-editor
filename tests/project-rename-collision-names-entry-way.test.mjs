import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptCallback } from './ts-source.mjs';

import { workspaceFileOperations } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

/** Two files in one workspace directory. */
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r33-'));
  await writeFile(join(dir, 'a.txt'), 'alpha\n');
  await writeFile(join(dir, 'b.txt'), 'beta\n');
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('a rename collision names the entry that is in the way', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await assert.rejects(
    () => workspaceFileOperations.rename(dir, 'a.txt', 'b.txt'),
    (error) => {
      assert.match(error.message, /b\.txt already exists/);
      /* A stable code lets the panel style this differently from a generic failure. */
      assert.equal(error.code, 'dsh-editor/exists');
      return true;
    },
  );
  /* Nothing moved: the source is intact and the target untouched. */
  assert.equal(await readFile(join(dir, 'a.txt'), 'utf8'), 'alpha\n');
  assert.equal(await readFile(join(dir, 'b.txt'), 'utf8'), 'beta\n');
});

test('a rename into a fresh name still works', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const moved = await workspaceFileOperations.rename(dir, 'a.txt', 'nested/c.txt');
  assert.equal(moved.path, 'nested/c.txt');
  assert.equal(await readFile(join(dir, 'nested', 'c.txt'), 'utf8'), 'alpha\n');
});

test('amend prefills subject and body, and only into an empty box', () => {
  const client = read('src/client/editor-workspace.tsx');
  let message = '';
  const preAmendMessage = { current: null };
  const scope = {
    setAmend: () => {},
    preAmendMessage,
    git: { lastCommit: { subject: 'Subject', body: 'Body\n' } },
    setCommitMessage: (value) => {
      message = value;
    },
    get commitMessage() {
      return message;
    },
  };
  const toggleAmend = loadTypeScriptCallback(client, 'toggleAmend', scope);
  toggleAmend(true);
  assert.equal(message, 'Subject\n\nBody');
  assert.equal(preAmendMessage.current, '');
  message = 'draft';
  toggleAmend(true);
  assert.equal(message, 'draft');

  const host = read('lib/index.js');
  assert.match(host, /return \{ hash, subject, body: body\.trim\(\) \};/);
});

test('unticking amend restores what the box held before', () => {
  const client = read('src/client/editor-workspace.tsx');
  assert.match(client, /if \(\s+preAmendMessage\.current !== null\s+\) \{/);
  assert.match(client, /setCommitMessage\(preAmendMessage\.current\);/);
  assert.match(client, /preAmendMessage\.current = null;/);
  /* The snapshot is taken at the moment of prefill, not at untick time. */
  const prefillAt = client.indexOf('preAmendMessage.current = commitMessage;');
  const setAt = client.indexOf('setCommitMessage(body ===', prefillAt);
  assert.ok(prefillAt > 0 && setAt > prefillAt);
});
