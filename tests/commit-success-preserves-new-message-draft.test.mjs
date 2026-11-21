import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const editorSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const { commitDraftAfterSuccess } = loadTypeScriptModule(commitSource, ['commitDraftAfterSuccess']);

test('a successful commit clears only the message that was actually submitted', () => {
  assert.equal(commitDraftAfterSuccess('old message', 'old message'), '');
  assert.equal(
    commitDraftAfterSuccess('next message typed during commit', 'old message'),
    'next message typed during commit',
  );
});

test('the editor commit success path uses the latest message value', () => {
  assert.match(editorSource, /commitDraftAfterSuccess\(commitMessageValueRef\.current, commitMessage\)/u);
  assert.match(editorSource, /setCommitMessage\(nextDraft\);/u);
  assert.match(editorSource, /writeCommitDraft\(root, nextDraft\);/u);
});
